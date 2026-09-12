"""Cron-driven stream, current-state simulation, and dashboard API."""

from __future__ import annotations

import base64
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import os

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .registry import ModelRegistry
from .storage import PredictionStore, configured_prediction_store
from .streaming import CircularCsvStream, CursorBackend, configured_cursor_backend


SATELLITE_COLUMNS = {
    "satellite_red": "red",
    "satellite_green": "green",
    "satellite_blue": "blue",
    "satellite_RE1": "RE1",
    "latitude": "latitude",
    "longitude": "longitude",
    "dataset": "dataset",
    "category": "category",
}
IMAGE_METADATA_COLUMNS = {
    "image_path",
    "image_source_id",
    "image_condition_expected",
    "image_provenance",
    "association_provenance",
}
STREAM_METADATA = {
    "observed_at",
    "time_step",
    "pond_id",
    "condition_label",
    "condition_severity",
    "record_provenance",
    "stream_row",
    "stream_cycle",
    *SATELLITE_COLUMNS,
    *IMAGE_METADATA_COLUMNS,
}


class ImageData(BaseModel):
    image_base64: str
    filename: str = "upload.jpg"


class StreamPredictionRequest(BaseModel):
    batch_size: int = Field(default=3, ge=1, le=100)
    reset: bool = False
    include_images: bool = True
    return_image_base64: bool = True
    images_by_pond: dict[str, ImageData] = Field(default_factory=dict)


class SimulationRequest(BaseModel):
    pond_id: str = Field(min_length=1, max_length=100)
    changes: dict[str, float]
    image_data: ImageData | None = None


def _dashboard_values(
    state: dict[str, Any],
    satellite: dict[str, Any] | None,
    image: dict[str, Any] | None,
) -> dict[str, Any]:
    return {
        "current_biomass_g_l": state["estimated"].get("biomass_g_l"),
        "biomass_6h_g_l": state["predicted"].get("biomass_6h_g_l"),
        "biomass_24h_g_l": state["predicted"].get("biomass_24h_g_l"),
        "health_score": state["health"].get("score"),
        "health_band": state["health"].get("band"),
        "anomaly_probability": state["anomaly"].get("probability"),
        "anomaly_severity": state["anomaly"].get("severity"),
        "gross_co2_uptake_rate_g_l_h": state["carbon"].get(
            "gross_co2_uptake_rate_g_l_h"
        ),
        "chlorophyll_a": None if satellite is None else satellite.get("chlorophyll_a"),
        "turbidity": None if satellite is None else satellite.get("turbidity"),
        "image_state": None if image is None else image.get("state"),
        "image_confidence": None if image is None else image.get("confidence"),
    }


def _prediction_insights(
    state: dict[str, Any],
    iot_data: dict[str, Any],
    image_result: dict[str, Any] | None,
    expected_image_condition: str | None,
) -> list[dict[str, Any]]:
    insights: list[dict[str, Any]] = []
    health_score = float(state["health"]["score"])
    if health_score < 50:
        insights.append({
            "severity": "critical",
            "code": "LOW_HEALTH",
            "message": f"Pond health is critical at {health_score:.1f}/100.",
        })
    elif health_score < 75:
        insights.append({
            "severity": "warning",
            "code": "HEALTH_WATCH",
            "message": f"Pond health needs attention at {health_score:.1f}/100.",
        })
    else:
        insights.append({
            "severity": "info",
            "code": "HEALTH_STABLE",
            "message": f"Pond health is currently {health_score:.1f}/100.",
        })

    anomaly = float(state["anomaly"]["probability"])
    if anomaly >= 0.35:
        insights.append({
            "severity": "warning" if anomaly < 0.65 else "critical",
            "code": "ANOMALY_RISK",
            "message": f"Combined anomaly probability is {anomaly:.1%}.",
        })

    current = float(state["estimated"]["biomass_g_l"])
    forecast = float(state["predicted"].get("biomass_6h_g_l", current))
    change_pct = (forecast - current) / max(current, 0.05) * 100
    direction = "increase" if change_pct > 1 else "decrease" if change_pct < -1 else "remain stable"
    insights.append({
        "severity": "info",
        "code": "BIOMASS_TREND_6H",
        "message": f"Biomass is predicted to {direction} over 6 hours ({change_pct:+.1f}%).",
    })

    dissolved_oxygen = iot_data.get("do_mg_l")
    if dissolved_oxygen is not None and float(dissolved_oxygen) < 4:
        insights.append({
            "severity": "critical",
            "code": "LOW_DISSOLVED_OXYGEN",
            "message": f"Dissolved oxygen is low at {float(dissolved_oxygen):.2f} mg/L.",
        })
    temperature = iot_data.get("water_temp_avg_c")
    if temperature is not None and float(temperature) > 32:
        insights.append({
            "severity": "warning",
            "code": "HIGH_WATER_TEMPERATURE",
            "message": f"Average water temperature is high at {float(temperature):.1f} °C.",
        })
    nitrate = iot_data.get("nitrate_mg_l")
    if nitrate is not None and float(nitrate) < 3:
        insights.append({
            "severity": "warning",
            "code": "LOW_NITRATE",
            "message": f"Nitrate is low at {float(nitrate):.2f} mg/L.",
        })

    if image_result is not None:
        state_name = str(image_result.get("state"))
        confidence = float(image_result.get("confidence", 0))
        matches = expected_image_condition is None or state_name == expected_image_condition
        insights.append({
            "severity": "info" if matches else "warning",
            "code": "VISUAL_CONDITION_MATCH" if matches else "VISUAL_CONDITION_MISMATCH",
            "message": (
                f"Image model classified the pond as {state_name} "
                f"with {confidence:.1%} confidence"
                + (
                    "."
                    if expected_image_condition is None
                    else f"; mapped fixture condition is {expected_image_condition}."
                )
            ),
        })
    return insights


def _simulation_dashboard(
    baseline: dict[str, Any],
    simulation: dict[str, Any],
    satellite: dict[str, Any] | None,
    image: dict[str, Any] | None,
) -> dict[str, Any]:
    dashboard = _dashboard_values(baseline, satellite, image)
    dashboard.update({
        "simulated_biomass_g_l": simulation.get("simulated_biomass_g_l"),
        "biomass_delta_g_l": simulation.get("biomass_delta_g_l"),
        "relative_biomass_delta_pct": simulation.get("relative_biomass_delta_pct"),
        "simulated_health_score": simulation.get("simulated_health_score"),
        "simulation_classification": simulation.get("classification"),
    })
    return dashboard


def _simulation_insights(
    simulation: dict[str, Any],
    image_result: dict[str, Any] | None,
    image_was_submitted: bool,
) -> list[dict[str, Any]]:
    classification = simulation.get("classification", "neutral")
    delta_pct = float(simulation.get("relative_biomass_delta_pct", 0.0))
    severity = (
        "success"
        if classification == "beneficial"
        else "warning"
        if classification == "potentially_harmful"
        else "info"
    )
    insights = [{
        "severity": severity,
        "code": "SCENARIO_OUTCOME",
        "message": (
            f"Scenario is {classification}; simulated biomass change is "
            f"{delta_pct:+.1f}%."
        ),
    }]
    if image_result is not None:
        source = "submitted image" if image_was_submitted else "latest streamed image"
        insights.append({
            "severity": "info",
            "code": "VISUAL_SUPPORTING_EVIDENCE",
            "message": (
                f"The {source} is classified as {image_result.get('state')} "
                f"with {float(image_result.get('confidence', 0)):.1%} confidence. "
                "It is supporting evidence and does not causally alter biomass simulation."
            ),
        })
    return insights


def create_app(
    model_dir: str | Path | None = None,
    stream_csv: str | Path | None = None,
    cursor_backend: CursorBackend | None = None,
    prediction_store: PredictionStore | None = None,
) -> FastAPI:
    package_root = Path(__file__).resolve().parents[1]
    configured_models = model_dir or os.getenv("ALGATWIN_MODEL_DIR", "models")
    resolved_model_dir = Path(configured_models)
    if not resolved_model_dir.is_absolute():
        resolved_model_dir = package_root / resolved_model_dir

    configured_stream = stream_csv or os.getenv(
        "ALGATWIN_STREAM_CSV", "data/pond_iot_stream.csv"
    )
    resolved_stream = Path(configured_stream)
    if not resolved_stream.is_absolute():
        resolved_stream = package_root / resolved_stream

    registry = ModelRegistry(resolved_model_dir)
    backend = cursor_backend or configured_cursor_backend(resolved_stream.name)
    history_store = prediction_store or configured_prediction_store()
    stream = CircularCsvStream(resolved_stream, backend)
    engines: dict[str, Any] = {}
    latest_records: dict[str, dict[str, Any]] = {}
    latest_satellite: dict[str, dict[str, Any]] = {}
    latest_images: dict[str, dict[str, Any]] = {}
    active_cycle: int | None = None

    app = FastAPI(
        title="AlgaTwin Stream, Simulation and Dashboard API",
        version="4.0.0",
        description="Circular 999-row prediction stream, image-aware simulation, and dashboard history.",
    )
    origins = [
        item.strip()
        for item in os.getenv(
            "ALGATWIN_CORS_ORIGINS",
            "http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
        ).split(",")
        if item.strip()
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.registry = registry
    app.state.stream = stream
    app.state.engines = engines
    app.state.latest_records = latest_records
    app.state.latest_satellite = latest_satellite
    app.state.latest_images = latest_images
    app.state.prediction_store = history_store

    api_key = os.getenv("ALGATWIN_API_KEY")

    @app.middleware("http")
    async def optional_api_key(request: Request, call_next):
        public_paths = {"/health", "/docs", "/openapi.json", "/redoc"}
        if api_key and request.url.path not in public_paths:
            if request.headers.get("X-API-Key") != api_key:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Invalid or missing X-API-Key"},
                )
        return await call_next(request)

    @app.get("/health")
    def health():
        cursor = stream.backend.read()
        return {
            "status": "ok",
            **registry.status(),
            "stream": {
                "file": stream.csv_path.name,
                "total_rows": stream.total_rows,
                **cursor,
            },
        }

    @app.get("/models")
    def models():
        return registry.manifest

    @app.get("/dashboard")
    def dashboard(
        pond_id: str | None = None,
        limit: int = Query(default=20, ge=1, le=500),
    ):
        data = history_store.dashboard(pond_id, limit)
        if pond_id and not data:
            raise HTTPException(
                status_code=404,
                detail="No prediction history exists for this pond.",
            )
        return {
            "data": data,
            "query": {"pond_id": pond_id, "limit": limit},
            "cursor": stream.backend.read(),
        }

    @app.post("/predict")
    def predict(body: StreamPredictionRequest | None = None):
        nonlocal active_cycle
        request_body = body or StreamPredictionRequest()
        if request_body.reset:
            stream.reset()
            engines.clear()
            latest_records.clear()
            latest_satellite.clear()
            latest_images.clear()
            active_cycle = None

        cursor_before = stream.backend.read()
        records, cursor = stream.next_batch(request_body.batch_size)
        output: list[dict[str, Any]] = []
        try:
            for record in records:
                cycle = int(record["stream_cycle"])
                if active_cycle is not None and cycle != active_cycle:
                    engines.clear()
                    latest_records.clear()
                    latest_satellite.clear()
                    latest_images.clear()
                active_cycle = cycle

                pond_id = str(record["pond_id"])
                observed_at = record["observed_at"]
                iot_data = {
                    key: value
                    for key, value in record.items()
                    if key not in STREAM_METADATA
                }
                satellite_data = {
                    target: record[source]
                    for source, target in SATELLITE_COLUMNS.items()
                }
                satellite_data["date"] = observed_at

                image_result = None
                image_for_response = {
                    "available": bool(record.get("image_path")),
                    "filename": (
                        None
                        if not record.get("image_path")
                        else Path(str(record["image_path"])).name
                    ),
                    "expected_condition": record.get("image_condition_expected"),
                    "image_provenance": record.get("image_provenance"),
                    "association_provenance": record.get("association_provenance"),
                    "base64": None,
                }
                image_input = request_body.images_by_pond.get(pond_id)
                if image_input is not None:
                    encoded_image = image_input.image_base64
                    image_filename = image_input.filename
                    image_for_response.update({
                        "available": True,
                        "filename": image_filename,
                        "expected_condition": None,
                        "image_provenance": "user_supplied",
                        "association_provenance": "user_supplied_for_current_burst",
                    })
                    if request_body.return_image_base64:
                        image_for_response["base64"] = encoded_image
                    image_result = registry.predict_image_base64(
                        encoded_image,
                        image_filename,
                    )
                elif request_body.include_images and record.get("image_path"):
                    image_path = (
                        stream.csv_path.parent / str(record["image_path"])
                    ).resolve()
                    encoded_image = base64.b64encode(image_path.read_bytes()).decode("ascii")
                    if request_body.return_image_base64:
                        image_for_response["base64"] = encoded_image
                    image_result = registry.predict_image_base64(
                        encoded_image,
                        image_path.name,
                    )

                engine = engines.setdefault(pond_id, registry.create_engine())
                observation = registry.prepare_observation(iot_data, observed_at, pond_id)
                state = engine.update(observation, observed_at)
                satellite_result = registry.predict_remote(satellite_data)

                source_data = {
                    "stream_row": int(record["stream_row"]),
                    "stream_cycle": cycle,
                    "time_step": int(record["time_step"]),
                    "pond_id": pond_id,
                    "observed_at": observed_at,
                    "condition_label": record["condition_label"],
                    "condition_severity": record.get("condition_severity"),
                    "record_provenance": record.get("record_provenance"),
                    "iot_data": iot_data,
                    "satellite_data": satellite_data,
                    "image": image_for_response,
                }
                item = {
                    "pond_id": pond_id,
                    "observed_at": observed_at,
                    "stream_row": int(record["stream_row"]),
                    "stream_cycle": cycle,
                    "source_data": source_data,
                    "dashboard": _dashboard_values(
                        state,
                        satellite_result,
                        image_result,
                    ),
                    "insights": _prediction_insights(
                        state,
                        iot_data,
                        image_result,
                        record.get("image_condition_expected"),
                    ),
                    "results": {
                        "digital_twin": state,
                        "satellite": satellite_result,
                        "image": image_result,
                    },
                }
                latest_records[pond_id] = deepcopy(source_data)
                latest_satellite[pond_id] = deepcopy(satellite_result)
                if image_result is not None:
                    latest_images[pond_id] = deepcopy(image_result)
                output.append(item)

            for item in output:
                history_store.append(item)
        except Exception as error:
            stream.backend.write(cursor_before["position"], cursor_before["cycle"])
            raise HTTPException(status_code=422, detail=str(error)) from error

        return {
            "data": output,
            "cursor": cursor,
            "message": f"Processed {len(output)} streamed pond reading(s).",
        }

    @app.post("/simulate")
    def simulate(body: SimulationRequest):
        if body.pond_id not in engines or body.pond_id not in latest_records:
            raise HTTPException(
                status_code=404,
                detail="No current streamed row for this pond; call /predict first.",
            )
        engine = engines[body.pond_id]
        baseline = deepcopy(engine.current_state)
        image_result = latest_images.get(body.pond_id)
        submitted_image = None
        try:
            simulation = engine.simulate(body.changes)
            if body.image_data is not None:
                image_result = registry.predict_image_base64(
                    body.image_data.image_base64,
                    body.image_data.filename,
                )
                submitted_image = {
                    "filename": body.image_data.filename,
                    "image_base64": body.image_data.image_base64,
                    "provenance": "user_supplied_for_simulation",
                }
        except Exception as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        satellite = latest_satellite.get(body.pond_id)
        item = {
                "pond_id": body.pond_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "baseline_source_data": deepcopy(latest_records[body.pond_id]),
                "submitted_image": submitted_image,
                "dashboard": _simulation_dashboard(
                    baseline,
                    simulation,
                    satellite,
                    image_result,
                ),
                "insights": _simulation_insights(
                    simulation,
                    image_result,
                    body.image_data is not None,
                ),
                "baseline": baseline,
                "simulation": simulation,
                "satellite": satellite,
                "image": image_result,
                "live_state_changed": False,
                "cursor_advanced": False,
                "image_is_supporting_evidence_only": True,
        }
        try:
            history_store.append_simulation(item)
        except Exception as error:
            raise HTTPException(
                status_code=503,
                detail=f"Simulation completed but persistence failed: {error}",
            ) from error
        return {"data": item}

    return app


app = create_app()
