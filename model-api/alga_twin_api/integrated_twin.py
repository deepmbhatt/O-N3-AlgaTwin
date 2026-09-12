"""Integrated runtime using every validated AlgaTwin model artifact."""

from __future__ import annotations

from collections import deque
from copy import deepcopy
from typing import Any

import numpy as np
import pandas as pd

from .advanced_modeling import (
    ANOMALY_FEATURES,
    ANOMALY_NUMERIC_FEATURES,
    ANOMALY_TREND_BASES,
    FORECAST_FEATURES,
)
from .twin import AlgaTwinEngine, TwinConfig


class IntegratedAlgaTwinEngine(AlgaTwinEngine):
    """Upgrade the baseline engine with trained forecast/anomaly/CO2 artifacts."""

    def __init__(
        self,
        biomass_model,
        reference_data: pd.DataFrame,
        *,
        forecast_models: dict[int, Any] | None = None,
        anomaly_bundle: dict[str, Any] | None = None,
        co2_bundle: dict[str, Any] | None = None,
        config: TwinConfig | None = None,
    ):
        super().__init__(biomass_model, reference_data, config=config)
        self.forecast_models = forecast_models or {}
        self.anomaly_bundle = anomaly_bundle
        self.co2_bundle = co2_bundle
        self.observation_history: deque[dict[str, Any]] = deque(maxlen=self.config.recent_window)
        self.scenario_controls = set(self.scenario_controls) | {"co2_ppm"}

    @staticmethod
    def _bounded_probability(value: float) -> float:
        return float(np.clip(value, 0.0, 1.0))

    def _anomaly_feature_row(self, observation: dict[str, Any]) -> pd.DataFrame:
        row = {feature: observation.get(feature, np.nan) for feature in ANOMALY_FEATURES}
        history = [*self.observation_history, observation]
        for base in ANOMALY_TREND_BASES:
            values = pd.to_numeric(pd.Series([item.get(base, np.nan) for item in history]), errors="coerce")
            row[f"{base}_delta_1d"] = values.iloc[-1] - values.iloc[-2] if len(values) >= 2 else np.nan
            row[f"{base}_rolling3_std"] = values.tail(3).std() if len(values) >= 2 else np.nan
        return pd.DataFrame([row])

    def _trained_anomaly_probability(self, observation: dict[str, Any]) -> tuple[float, dict[str, float]]:
        if not self.anomaly_bundle:
            return 0.0, {"crash_risk": 0.0, "novelty": 0.0}
        row = self._anomaly_feature_row(observation)
        crash_risk = float(self.anomaly_bundle["crash_classifier"].predict_proba(row[ANOMALY_FEATURES])[0, 1])
        numeric = row[ANOMALY_NUMERIC_FEATURES]
        transformed = self.anomaly_bundle["isolation_preprocess"].transform(numeric)
        score = float(self.anomaly_bundle["isolation_model"].score_samples(transformed)[0])
        calibration = self.anomaly_bundle["isolation_score_calibration"]
        denominator = max(calibration["p50"] - calibration["p01"], 1e-9)
        novelty = self._bounded_probability((calibration["p50"] - score) / denominator)
        combined = self._bounded_probability(0.75 * crash_risk + 0.25 * novelty)
        return combined, {"crash_risk": crash_risk, "novelty": novelty}

    def _trained_forecast(self, observation: dict[str, Any], current_biomass: float, horizon: int) -> float | None:
        entry = self.forecast_models.get(horizon) or self.forecast_models.get(str(horizon))
        if entry is None:
            return None
        if isinstance(entry, dict):
            model = entry["model"]
            model_weight = float(entry.get("model_weight", 1.0))
        else:
            model = entry
            model_weight = 1.0
        row = dict(observation)
        row["current_afdw_g_l"] = current_biomass
        row["actual_horizon_h"] = float(horizon)
        features = pd.DataFrame([{feature: row.get(feature, np.nan) for feature in FORECAST_FEATURES}])
        raw_prediction = max(0.0, float(model.predict(features)[0]))
        return max(0.0, (1 - model_weight) * current_biomass + model_weight * raw_prediction)

    def update(self, observation: dict[str, Any], observed_at: Any) -> dict[str, Any]:
        state = super().update(observation, observed_at)
        current_biomass = float(state["estimated"]["biomass_g_l"])

        trained_forecasts = {}
        for horizon in [6, 24]:
            prediction = self._trained_forecast(observation, current_biomass, horizon)
            if prediction is not None:
                state["predicted"][f"biomass_{horizon}h_g_l"] = round(prediction, 6)
                trained_forecasts[horizon] = prediction
        if trained_forecasts:
            state["predicted"]["method"] = "direct_supervised_near_horizon_afdw_model"
            if 24 in trained_forecasts:
                state["carbon"]["gross_co2_uptake_rate_g_l_h"] = round(
                    max(0.0, trained_forecasts[24] - current_biomass)
                    / 24
                    * self.config.gross_co2_g_per_g_biomass,
                    8,
                )

        trained_probability, components = self._trained_anomaly_probability(observation)
        rule_probability = float(state["anomaly"]["probability"])
        combined_probability = self._bounded_probability(0.7 * trained_probability + 0.3 * rule_probability)
        old_probability = rule_probability
        state["anomaly"].update(
            {
                "probability": round(combined_probability, 4),
                "severity": "high" if combined_probability >= 0.65 else "moderate" if combined_probability >= 0.35 else "normal",
                "components": {
                    "supervised_crash_risk_0_2d": round(components["crash_risk"], 4),
                    "unsupervised_novelty": round(components["novelty"], 4),
                    "quality_and_stress_rules": round(rule_probability, 4),
                },
                "model_threshold": None if not self.anomaly_bundle else self.anomaly_bundle["threshold"],
            }
        )
        adjusted_health = float(np.clip(state["health"]["score"] - (combined_probability - old_probability) * 45, 0, 100))
        state["health"] = {"score": round(adjusted_health, 2), "band": self._health_band(adjusted_health)}

        self.current_state = deepcopy(state)
        if self.history:
            self.history[-1] = deepcopy(state)
        self.observation_history.append(deepcopy(observation))
        return deepcopy(state)

    def simulate(self, changes: dict[str, Any]) -> dict[str, Any]:
        co2_ppm = changes.get("co2_ppm")
        model_changes = {key: value for key, value in changes.items() if key != "co2_ppm"}
        result = super().simulate(model_changes)
        calibration = None if not self.co2_bundle else self.co2_bundle.get("scenario_calibration")
        if co2_ppm is not None:
            if calibration is None:
                raise ValueError("CO2 scenario requested but no external calibration artifact is loaded")
            raw_log_effect = calibration["log_effect_per_100ppm"] * (
                float(co2_ppm) - calibration["reference_ppm"]
            ) / 100
            cap = np.log1p(calibration.get("effect_cap_pct", 15.0) / 100)
            multiplier = float(np.exp(np.clip(raw_log_effect, -cap, cap)))
            current = float(result["current_biomass_g_l"])
            simulated = float(result["simulated_biomass_g_l"]) * multiplier
            delta = simulated - current
            relative = delta / max(current, 0.05)
            health = float(np.clip(self.current_state["health"]["score"] + relative * 35, 0, 100))
            result.update(
                {
                    "changes": deepcopy(changes),
                    "simulated_biomass_g_l": round(simulated, 6),
                    "biomass_delta_g_l": round(delta, 6),
                    "relative_biomass_delta_pct": round(relative * 100, 2),
                    "simulated_health_score": round(health, 2),
                    "gross_co2_uptake_delta_proxy_g_l": round(
                        max(delta, 0) * self.config.gross_co2_g_per_g_biomass, 6
                    ),
                    "classification": "beneficial" if relative > 0.03 else "potentially_harmful" if relative < -0.03 else "neutral",
                    "experimental_co2_calibration": {
                        "requested_ppm": float(co2_ppm),
                        "multiplier": round(multiplier, 5),
                        **calibration,
                    },
                    "warning": "Associational ATP3 response plus bounded external lab CO2 calibration; not a causal guarantee.",
                }
            )
        else:
            result["experimental_co2_calibration"] = None
        return result

