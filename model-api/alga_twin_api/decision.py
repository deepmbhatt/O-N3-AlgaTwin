"""Model-grounded insight and scenario-ranked action helpers for Aoi."""

from __future__ import annotations

from copy import deepcopy
from typing import Any


def number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def pct_change(current: float, future: float) -> float:
    return (future - current) / max(abs(current), 0.05) * 100


def compact_pond_state(
    state: dict[str, Any],
    source_data: dict[str, Any],
    satellite: dict[str, Any] | None,
    image: dict[str, Any] | None,
) -> dict[str, Any]:
    """Return only decision-relevant, provenance-labelled model data."""
    measured = source_data.get("iot_data", {})
    estimated = state.get("estimated", {})
    predicted = state.get("predicted", {})
    anomaly = state.get("anomaly", {})
    health = state.get("health", {})
    carbon = state.get("carbon", {})
    current = number(estimated.get("biomass_g_l"))
    forecast_6h = number(predicted.get("biomass_6h_g_l"), current)
    forecast_24h = number(predicted.get("biomass_24h_g_l"), current)
    return {
        "pond_id": state.get("pond_id"),
        "observed_at": state.get("updated_at"),
        "condition": source_data.get("condition_label"),
        "health": {"score": number(health.get("score")), "band": health.get("band", "unknown")},
        "biomass": {
            "current_g_l": current,
            "forecast_6h_g_l": forecast_6h,
            "forecast_24h_g_l": forecast_24h,
            "change_6h_pct": round(pct_change(current, forecast_6h), 2),
            "change_24h_pct": round(pct_change(current, forecast_24h), 2),
            "model_confidence": estimated.get("model_confidence"),
            "forecast_method": predicted.get("method"),
        },
        "anomaly": {
            "probability": number(anomaly.get("probability")),
            "severity": anomaly.get("severity", "normal"),
            "likely_stress": anomaly.get("likely_stress", "none"),
            "explanation": anomaly.get("explanation"),
            "components": deepcopy(anomaly.get("components", {})),
        },
        "environment": {
            "temperature_c": measured.get("water_temp_avg_c"),
            "ph": measured.get("sensor_ph"),
            "dissolved_oxygen_mg_l": measured.get("do_mg_l"),
            "nitrate_mg_l": measured.get("nitrate_mg_l"),
            "phosphorus_mg_l": measured.get("phosphorus_mg_l"),
            "par_umol_m2_s": measured.get("par_umol_m2_s"),
            "global_light_w_m2": measured.get("global_light_w_m2"),
            "co2_ppm": measured.get("co2_ppm", 400),
            "provenance": "measured_or_replayed_iot",
        },
        "water_quality": {
            "chlorophyll_a": None if satellite is None else satellite.get("chlorophyll_a"),
            "turbidity": None if satellite is None else satellite.get("turbidity"),
            "provenance": None if satellite is None else satellite.get("provenance"),
        },
        "carbon": {
            "gross_co2_uptake_rate_g_l_h": number(carbon.get("gross_co2_uptake_rate_g_l_h")),
            "assumption": carbon.get("assumption"),
            "scope": carbon.get("scope"),
        },
        "verification": {
            "image_state": None if image is None else image.get("state"),
            "image_confidence": None if image is None else image.get("confidence"),
            "provenance": None if image is None else image.get("provenance"),
        },
        "stream": {
            "row": source_data.get("stream_row"),
            "cycle": source_data.get("stream_cycle"),
            "record_provenance": source_data.get("record_provenance"),
        },
    }


def decision_state(compact: dict[str, Any]) -> str:
    health = compact["health"]["score"]
    anomaly = compact["anomaly"]["probability"]
    decline = compact["biomass"]["change_6h_pct"]
    image_confidence = compact["verification"]["image_confidence"]
    if health < 50 or anomaly >= 0.65:
        return "RECOVER"
    if image_confidence is not None and number(image_confidence) < 0.5:
        return "VERIFY"
    if health < 80 or anomaly >= 0.35 or decline < -1:
        return "STABILIZE"
    return "MAINTAIN"


def findings(compact: dict[str, Any]) -> list[str]:
    health = compact["health"]["score"]
    anomaly = compact["anomaly"]["probability"]
    change = compact["biomass"]["change_6h_pct"]
    env = compact["environment"]
    items = [f"Current model-derived health score is {health:.1f}/100."]
    if change < -1:
        items.append(f"The 6-hour biomass forecast declines by {abs(change):.1f}%.")
    elif change > 1:
        items.append(f"The 6-hour biomass forecast increases by {change:.1f}%.")
    else:
        items.append("The 6-hour biomass forecast is broadly stable.")
    items.append(f"Combined anomaly probability is {anomaly:.1%}.")
    if number(env.get("dissolved_oxygen_mg_l"), 99) < 4:
        items.append("Measured dissolved oxygen is below 4 mg/L.")
    if number(env.get("temperature_c")) > 32:
        items.append("Measured water temperature is above 32 C.")
    if number(env.get("nitrate_mg_l"), 99) < 3:
        items.append("Measured nitrate is below 3 mg/L.")
    verify = compact["verification"]
    if verify["image_state"]:
        items.append(
            f"The image model reports {verify['image_state']} at "
            f"{number(verify['image_confidence']):.1%} confidence."
        )
    return items


def build_insight(compact: dict[str, Any]) -> dict[str, Any]:
    mode = decision_state(compact)
    change = compact["biomass"]["change_6h_pct"]
    if mode == "RECOVER":
        summary, priority = "The twin indicates a high-priority pond stress condition.", "high"
    elif mode == "STABILIZE":
        summary, priority = "Conditions remain operable, but the twin indicates deterioration that should be stabilized.", "medium"
    elif mode == "VERIFY":
        summary, priority = "The biological state is usable, but image verification confidence is too low for a strong action claim.", "medium"
    else:
        trend = "growing" if change > 1 else "stable"
        summary, priority = f"The pond is healthy and its short-term biomass trajectory is {trend}.", "routine"
    return {
        "overall_state": compact["health"]["band"],
        "action_state": mode,
        "priority": priority,
        "needs_action": mode in {"RECOVER", "STABILIZE"},
        "summary": summary,
        "main_findings": findings(compact),
        "health_score": compact["health"]["score"],
        "provenance": ["current_digital_twin", "trained_forecast", "trained_anomaly", "latest_verification"],
    }


def candidate_actions(compact: dict[str, Any], optimize: bool) -> list[dict[str, Any]]:
    env = compact["environment"]
    result: list[dict[str, Any]] = []
    temp = number(env.get("temperature_c"), 27)
    ph = number(env.get("ph"), 8.1)
    nitrate = number(env.get("nitrate_mg_l"), 35)
    co2 = number(env.get("co2_ppm"), 400)
    if temp < 25 or temp > 29:
        result.append({"label": "Move temperature toward the operating window", "changes": {"water_temp_avg_c": 27.0}})
    elif optimize:
        result.append({"label": "Test a conservative temperature adjustment", "changes": {"water_temp_avg_c": round(temp - 0.8 if temp > 27 else temp + 0.8, 1)}})
    elif abs(temp - 27.0) >= 0.3:
        result.append({"label": "Test the center of the temperature window", "changes": {"water_temp_avg_c": 27.0}})
    if ph < 7.5 or ph > 8.5:
        result.append({"label": "Move pH toward the operating window", "changes": {"sensor_ph": 8.1}})
    elif optimize:
        result.append({"label": "Test a small pH adjustment", "changes": {"sensor_ph": round(ph - 0.12 if ph > 8.1 else ph + 0.12, 2)}})
    if nitrate < 15:
        result.append({"label": "Test restored nitrate availability", "changes": {"nitrate_mg_l": 35.0}})
    elif optimize:
        result.append({"label": "Test a small nitrate adjustment", "changes": {"nitrate_mg_l": round(min(nitrate + 5, 60), 1)}})
    co2_target = min(800.0, max(450.0, co2 * (1.05 if optimize else 1.35)))
    result.append({"label": "Test a bounded CO2 adjustment", "changes": {"co2_ppm": round(co2_target, 1)}})
    combined: dict[str, float] = {"co2_ppm": round(co2_target, 1)}
    if temp < 25 or temp > 29:
        combined["water_temp_avg_c"] = 27.0
    if ph < 7.5 or ph > 8.5:
        combined["sensor_ph"] = 8.1
    if nitrate < 15:
        combined["nitrate_mg_l"] = 35.0
    if len(combined) > 1:
        result.append({"label": "Test the combined bounded correction", "changes": combined})
    return result


def rank_actions(engine: Any, compact: dict[str, Any], *, optimize: bool = False) -> dict[str, Any]:
    insight = build_insight(compact)
    mode = "OPTIMIZE" if optimize else insight["action_state"]
    if mode in {"MAINTAIN", "VERIFY"}:
        reason = (
            "The current state is healthy; no operational change is justified."
            if mode == "MAINTAIN"
            else "Obtain stronger verification evidence before changing operation."
        )
        return {"action_state": mode, "priority": insight["priority"], "recommended_action": None, "alternative_actions": [], "tested_count": 0, "reason": reason, "live_state_changed": False}

    evaluated = []
    for candidate in candidate_actions(compact, optimize):
        try:
            outcome = engine.simulate(candidate["changes"])
        except (ValueError, RuntimeError):
            continue
        evaluated.append({
            "label": candidate["label"],
            "changes": candidate["changes"],
            "expected_biomass_change_pct": number(outcome.get("relative_biomass_delta_pct")),
            "expected_health_score": number(outcome.get("simulated_health_score")),
            "expected_biomass_g_l": number(outcome.get("simulated_biomass_g_l")),
            "classification": outcome.get("classification"),
            "model_uncertainty_g_l": outcome.get("model_uncertainty_g_l"),
            "model_warning": outcome.get("warning"),
            "provenance": "digital_twin_simulation",
        })
    evaluated.sort(key=lambda item: (item["expected_biomass_change_pct"], item["expected_health_score"]), reverse=True)
    threshold = 2.0 if optimize else 0.5
    best = evaluated[0] if evaluated and evaluated[0]["expected_biomass_change_pct"] >= threshold else None
    reason = (
        "The top-ranked action is the best improvement found by the current digital twin."
        if best
        else "None of the tested supported changes produced a meaningful model improvement."
    )
    return {
        "action_state": mode,
        "priority": "optional" if optimize else insight["priority"],
        "recommended_action": best,
        "alternative_actions": [item for item in evaluated if item is not best][:3],
        "tested_count": len(evaluated),
        "reason": reason,
        "live_state_changed": False,
        "warning": "Ranked outcomes are simulated associations, not causal guarantees.",
    }


def local_answer(message: str, compact: dict[str, Any], insight: dict[str, Any], action: dict[str, Any]) -> tuple[str, str]:
    question = message.lower()
    recommended = action.get("recommended_action")
    if any(word in question for word in ("what should", "action", "recommend", "improve", "optimize")):
        intent = "recommend_action"
        if recommended:
            changes = ", ".join(f"{key} to {value:g}" for key, value in recommended["changes"].items())
            answer = (
                f"Best tested option: {changes}. The digital twin predicts "
                f"{recommended['expected_biomass_change_pct']:+.1f}% biomass change and a "
                f"health score of {recommended['expected_health_score']:.1f}. "
                "This is a simulated result, not a measured change."
            )
        else:
            answer = (
                f"{insight['summary']} {action['reason']} Continue monitoring the "
                "next live prediction before making an operational change."
            )
    elif "carbon" in question or "co2" in question or "capture" in question:
        intent = "explain_carbon"
        carbon = compact["carbon"]
        answer = (
            f"Gross modeled CO2 uptake is {carbon['gross_co2_uptake_rate_g_l_h']:.6f} g/L/h. "
            f"Its scope is {carbon.get('scope') or 'gross biological uptake only'}; "
            "it is not a verified net-removal claim."
        )
    elif "verify" in question or "image" in question or "satellite" in question:
        intent = "explain_verification"
        verify = compact["verification"]
        if verify["image_state"]:
            answer = f"The latest image model reports {verify['image_state']} at {number(verify['image_confidence']):.1%} confidence. It is supporting evidence, not a replacement for measured telemetry."
        else:
            answer = "The current twin has no image result, so it does not have enough evidence for a visual verification claim."
    elif "why" in question or "stress" in question or "anomaly" in question:
        intent = "explain_state"
        answer = f"{insight['summary']} {compact['anomaly'].get('explanation') or insight['main_findings'][1]}"
    else:
        intent = "summarize_state"
        answer = f"{insight['summary']} {insight['main_findings'][0]} {insight['main_findings'][1]}"
    return answer, intent


def build_mrv(
    compact: dict[str, Any],
    *,
    pond_volume_m3: float,
    window_hours: float,
    operational_emissions_kg: float,
    permanence_factor: float,
) -> dict[str, Any]:
    """Calculate transparent, assumption-driven MRV from the live model rate."""
    rate = compact["carbon"]["gross_co2_uptake_rate_g_l_h"]
    gross = max(0.0, rate * pond_volume_m3 * window_hours)
    net = gross - max(0.0, operational_emissions_kg)
    adjusted = max(0.0, net) * permanence_factor
    environment = compact["environment"]
    completeness = sum(value is not None for key, value in environment.items() if key != "provenance") / 8
    image_confidence = compact["verification"]["image_confidence"]
    model_confidence = compact["biomass"]["model_confidence"]
    factors = {
        "sensor_completeness": round(completeness, 4),
        "model_confidence": round(number(model_confidence, 0.5), 4),
        "image_verification_confidence": round(number(image_confidence), 4),
        "anomaly_consistency": round(1 - compact["anomaly"]["probability"], 4),
        "data_freshness": 1.0,
    }
    confidence = sum(factors.values()) / len(factors)
    return {
        "pond_id": compact["pond_id"],
        "observed_at": compact["observed_at"],
        "status": "estimated_not_registry_verified",
        "accounting": {
            "gross_biological_capture_kg": round(gross, 6),
            "operational_emissions_kg": round(max(0.0, operational_emissions_kg), 6),
            "net_biological_capture_kg": round(net, 6),
            "permanence_adjusted_kg": round(adjusted, 6),
        },
        "inputs": {
            "gross_co2_uptake_rate_g_l_h": rate,
            "pond_volume_m3": pond_volume_m3,
            "window_hours": window_hours,
            "permanence_factor": permanence_factor,
        },
        "confidence": {"score": round(confidence, 4), "factors": factors},
        "provenance": compact["stream"],
        "methodology": {
            "formula": "rate_g_L_h * volume_m3 * hours = kg_CO2",
            "scope": compact["carbon"]["scope"],
            "biomass_factor": compact["carbon"]["assumption"],
            "warning": "Gross biological uptake is model-derived. Net removal requires measured operational emissions, biomass fate, permanence, leakage, and third-party verification.",
        },
    }
