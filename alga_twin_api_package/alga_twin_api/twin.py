"""Small, serializable digital-twin state engine for the hackathon prototype."""

from __future__ import annotations

from collections import deque
from copy import deepcopy
from dataclasses import dataclass
from datetime import timezone
from typing import Any

import numpy as np
import pandas as pd

from .modeling import ATP3_FEATURES, ATP3_NUMERIC_FEATURES


@dataclass
class TwinConfig:
    recent_window: int = 8
    gross_co2_g_per_g_biomass: float = 1.83
    max_abs_growth_g_l_h: float = 0.05
    remote_freshness_days: float = 3.0
    remote_agreement_scale: float = 0.25


class AlgaTwinEngine:
    """Maintain current/previous state while keeping scenarios isolated."""

    quality_ranges = {
        "sensor_ph": (0.0, 14.0),
        "water_temp_avg_c": (0.0, 50.0),
        "do_mg_l": (0.0, 60.0),
        "do_pct_sat": (0.0, 500.0),
        "salinity_g_l": (0.0, 100.0),
        "par_umol_m2_s": (0.0, 3000.0),
        "relative_humidity_pct": (0.0, 100.0),
        "global_light_w_m2": (0.0, 1600.0),
    }
    scenario_controls = {
        "water_temp_avg_c",
        "sensor_ph",
        "nitrate_mg_l",
        "phosphorus_mg_l",
        "par_umol_m2_s",
        "global_light_w_m2",
    }

    def __init__(self, biomass_model, reference_data: pd.DataFrame, config: TwinConfig | None = None):
        self.biomass_model = biomass_model
        self.config = config or TwinConfig()
        self.reference = reference_data.copy()
        self.history: deque[dict[str, Any]] = deque(maxlen=self.config.recent_window)
        self.current_state: dict[str, Any] | None = None
        self.previous_state: dict[str, Any] | None = None
        numeric = self.reference[ATP3_NUMERIC_FEATURES].apply(pd.to_numeric, errors="coerce")
        self.reference_median = numeric.median()
        self.reference_iqr = (numeric.quantile(0.75) - numeric.quantile(0.25)).replace(0, np.nan)

    @staticmethod
    def _timestamp(value: Any) -> pd.Timestamp:
        timestamp = pd.Timestamp(value)
        if timestamp.tzinfo is None:
            timestamp = timestamp.tz_localize(timezone.utc)
        else:
            timestamp = timestamp.tz_convert(timezone.utc)
        return timestamp

    @staticmethod
    def _safe_float(value: Any) -> float | None:
        try:
            converted = float(value)
        except (TypeError, ValueError):
            return None
        return converted if np.isfinite(converted) else None

    def _feature_frame(self, observation: dict[str, Any]) -> pd.DataFrame:
        row = {column: observation.get(column, np.nan) for column in ATP3_FEATURES}
        return pd.DataFrame([row])

    def _predict_biomass(self, observation: dict[str, Any]) -> tuple[float, float]:
        features = self._feature_frame(observation)
        prediction = max(0.0, float(self.biomass_model.predict(features)[0]))
        uncertainty = np.nan
        try:
            transformed = self.biomass_model.named_steps["preprocess"].transform(features)
            trees = self.biomass_model.named_steps["regressor"].estimators_
            uncertainty = float(np.std([tree.predict(transformed)[0] for tree in trees]))
        except (AttributeError, KeyError):
            pass
        return prediction, uncertainty

    def _quality_flags(self, observation: dict[str, Any]) -> list[str]:
        flags: list[str] = []
        for feature, (lower, upper) in self.quality_ranges.items():
            value = self._safe_float(observation.get(feature))
            if value is None:
                flags.append(f"missing:{feature}")
            elif value < lower or value > upper:
                flags.append(f"out_of_range:{feature}")
        return flags

    def _growth_rate(self, at: pd.Timestamp, biomass: float) -> float:
        points = [(self._timestamp(item["updated_at"]), item["estimated"]["biomass_g_l"]) for item in self.history]
        points.append((at, biomass))
        if len(points) < 2:
            return 0.0
        origin = points[0][0]
        x = np.array([(stamp - origin).total_seconds() / 3600 for stamp, _ in points], dtype=float)
        y = np.array([value for _, value in points], dtype=float)
        if np.ptp(x) <= 0:
            return 0.0
        slope = float(np.polyfit(x, y, 1)[0])
        return float(np.clip(slope, -self.config.max_abs_growth_g_l_h, self.config.max_abs_growth_g_l_h))

    def _anomaly(self, observation: dict[str, Any], quality_flags: list[str]) -> tuple[float, float, list[str]]:
        values = pd.Series({column: self._safe_float(observation.get(column)) for column in ATP3_NUMERIC_FEATURES}, dtype=float)
        robust_distance = ((values - self.reference_median).abs() / self.reference_iqr).replace([np.inf, -np.inf], np.nan)
        available = robust_distance.dropna()
        multivariate = 0.0 if available.empty else float(1 - np.exp(-available.nlargest(min(4, len(available))).mean() / 3))

        stress_reasons: list[str] = []
        stress = 0.0
        temp = self._safe_float(observation.get("water_temp_avg_c"))
        ph = self._safe_float(observation.get("sensor_ph"))
        do = self._safe_float(observation.get("do_mg_l"))
        if temp is not None and (temp < 15 or temp > 35):
            stress += min(abs(temp - np.clip(temp, 15, 35)) / 10, 1)
            stress_reasons.append("water temperature")
        if ph is not None and (ph < 6.5 or ph > 10.0):
            stress += min(abs(ph - np.clip(ph, 6.5, 10.0)) / 3, 1)
            stress_reasons.append("pH")
        if do is not None and do < 3:
            stress += min((3 - do) / 3, 1)
            stress_reasons.append("low dissolved oxygen")
        environmental_stress = float(np.clip(stress / 3, 0, 1))
        quality_penalty = min(len(quality_flags) / max(len(self.quality_ranges), 1), 1)
        probability = float(np.clip(0.65 * multivariate + 0.25 * environmental_stress + 0.10 * quality_penalty, 0, 1))
        return probability, environmental_stress, stress_reasons

    @staticmethod
    def _health_band(score: float) -> str:
        if score >= 80:
            return "healthy"
        if score >= 60:
            return "watch"
        if score >= 35:
            return "stressed"
        return "critical"

    def update(self, observation: dict[str, Any], observed_at: Any) -> dict[str, Any]:
        """Apply one measured event and return the new current state."""
        timestamp = self._timestamp(observed_at)
        biomass, uncertainty = self._predict_biomass(observation)
        quality_flags = self._quality_flags(observation)
        growth_rate = self._growth_rate(timestamp, biomass)
        biomass_6h = max(0.0, biomass + growth_rate * 6 * np.exp(-6 / 48))
        biomass_24h = max(0.0, biomass + growth_rate * 24 * np.exp(-24 / 48))
        anomaly_probability, environmental_stress, stress_reasons = self._anomaly(observation, quality_flags)
        forecast_decline = max(0.0, (biomass - biomass_24h) / max(biomass, 0.05))
        quality_penalty = min(len(quality_flags) / max(len(self.quality_ranges), 1), 1)
        health_score = float(np.clip(100 * (1 - 0.45 * anomaly_probability - 0.25 * environmental_stress - 0.20 * forecast_decline - 0.10 * quality_penalty), 0, 100))
        model_confidence = None if not np.isfinite(uncertainty) else float(np.clip(1 / (1 + uncertainty / max(biomass, 0.1)), 0, 1))

        explanation_parts = []
        if stress_reasons:
            explanation_parts.append("Stress indicators: " + ", ".join(stress_reasons) + ".")
        if growth_rate < 0:
            explanation_parts.append("Recent estimated biomass trend is declining.")
        if quality_flags:
            explanation_parts.append(f"{len(quality_flags)} measurement quality flag(s) reduce confidence.")
        if not explanation_parts:
            explanation_parts.append("Conditions and estimated trajectory are within the learned reference envelope.")

        measured_values = {
            key: self._safe_float(observation.get(key))
            for key in [
                "sensor_ph", "water_temp_avg_c", "do_mg_l", "do_pct_sat", "salinity_g_l",
                "par_umol_m2_s", "nitrate_mg_l", "phosphorus_mg_l", "air_temp_c", "global_light_w_m2",
            ]
        }
        state = {
            "pond_id": str(observation.get("pond_id", "unknown")),
            "updated_at": timestamp.isoformat(),
            "previous_updated_at": None if self.current_state is None else self.current_state["updated_at"],
            "measured": {"values": measured_values, "source": "replayed_iot_daily", "quality_flags": quality_flags},
            "estimated": {
                "biomass_g_l": round(biomass, 6),
                "growth_rate_g_l_h": round(growth_rate, 8),
                "model_confidence": None if model_confidence is None else round(model_confidence, 4),
            },
            "predicted": {
                "biomass_6h_g_l": round(float(biomass_6h), 6),
                "biomass_24h_g_l": round(float(biomass_24h), 6),
                "method": "recent_estimate_slope_with_decay",
            },
            "anomaly": {
                "probability": round(anomaly_probability, 4),
                "severity": "high" if anomaly_probability >= 0.75 else "moderate" if anomaly_probability >= 0.45 else "normal",
                "likely_stress": stress_reasons[0] if stress_reasons else "none",
                "explanation": " ".join(explanation_parts),
            },
            "carbon": {
                "gross_co2_uptake_rate_g_l_h": round(max(0.0, growth_rate) * self.config.gross_co2_g_per_g_biomass, 8),
                "assumption": f"prototype factor {self.config.gross_co2_g_per_g_biomass} g CO2 per g new AFDW",
                "scope": "gross biological uptake; not net MRV",
            },
            "verified": {
                "remote_estimate": None,
                "source": None,
                "observed_at": None,
                "confidence": 0.0,
            },
            "health": {"score": round(health_score, 2), "band": self._health_band(health_score)},
        }
        self.previous_state = deepcopy(self.current_state)
        self.current_state = state
        self.history.append(deepcopy(state))
        return deepcopy(state)

    def simulate(self, changes: dict[str, Any]) -> dict[str, Any]:
        """Evaluate supported controls on a copied feature row without mutating state."""
        if self.current_state is None or not self.history:
            raise RuntimeError("At least one update is required before scenario mode")
        unsupported = sorted(set(changes) - self.scenario_controls)
        if unsupported:
            raise ValueError(f"Unsupported or uncalibrated scenario controls: {unsupported}")

        # Recover the latest feature row by matching the current pond/time in reference data.
        latest_time = self._timestamp(self.current_state["updated_at"]).tz_localize(None).normalize()
        pond = self.current_state["pond_id"]
        candidates = self.reference[(self.reference["pond_id"].astype(str) == pond) & (pd.to_datetime(self.reference["date"]).dt.normalize() == latest_time)]
        base = candidates.iloc[-1].to_dict() if not candidates.empty else {}
        simulated_input = deepcopy(base)
        simulated_input.update(changes)
        simulated_biomass, uncertainty = self._predict_biomass(simulated_input)
        current_biomass = float(self.current_state["estimated"]["biomass_g_l"])
        delta = simulated_biomass - current_biomass
        relative_delta = delta / max(current_biomass, 0.05)
        projected_health = float(np.clip(self.current_state["health"]["score"] + relative_delta * 35, 0, 100))
        classification = "beneficial" if relative_delta > 0.03 else "potentially_harmful" if relative_delta < -0.03 else "neutral"
        return {
            "provenance": "simulated",
            "changes": changes,
            "current_biomass_g_l": current_biomass,
            "simulated_biomass_g_l": round(simulated_biomass, 6),
            "biomass_delta_g_l": round(delta, 6),
            "relative_biomass_delta_pct": round(relative_delta * 100, 2),
            "current_health_score": self.current_state["health"]["score"],
            "simulated_health_score": round(projected_health, 2),
            "gross_co2_uptake_delta_proxy_g_l": round(max(delta, 0) * self.config.gross_co2_g_per_g_biomass, 6),
            "model_uncertainty_g_l": None if not np.isfinite(uncertainty) else round(float(uncertainty), 6),
            "classification": classification,
            "warning": "Associational model response; not a causal intervention guarantee.",
        }

    def add_remote_observation(self, observation: dict[str, Any]) -> dict[str, Any]:
        """Update verification confidence without overwriting the biomass estimate."""
        if self.current_state is None:
            raise RuntimeError("A current state is required before remote verification")
        remote_time = self._timestamp(observation["observed_at"])
        current_time = self._timestamp(self.current_state["updated_at"])
        age_days = max(0.0, (current_time - remote_time).total_seconds() / 86_400)
        freshness = float(np.exp(-age_days / max(self.config.remote_freshness_days, 1e-6)))
        source_confidence = float(np.clip(observation.get("source_confidence", 0.5), 0, 1))
        remote_biomass = float(observation["biomass_proxy_g_l"])
        twin_biomass = float(self.current_state["estimated"]["biomass_g_l"])
        relative_difference = abs(remote_biomass - twin_biomass) / max(twin_biomass, 0.05)
        agreement = float(np.exp(-relative_difference / max(self.config.remote_agreement_scale, 1e-6)))
        confidence = float(np.clip(source_confidence * freshness * agreement, 0, 1))
        verification = {
            "remote_estimate": {"biomass_proxy_g_l": remote_biomass},
            "source": str(observation.get("source", "remote")),
            "observed_at": remote_time.isoformat(),
            "age_days": round(age_days, 3),
            "agreement": round(agreement, 4),
            "confidence": round(confidence, 4),
            "action": "supported" if confidence >= 0.65 else "inspect" if confidence < 0.35 else "uncertain",
        }
        self.current_state["verified"] = verification
        return deepcopy(verification)

