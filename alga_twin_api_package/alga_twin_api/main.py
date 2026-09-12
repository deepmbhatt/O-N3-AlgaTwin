"""Two-workflow FastAPI surface for the standalone AlgaTwin package."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any
import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, model_validator

from .registry import ModelRegistry


class SatelliteData(BaseModel):
    date: datetime | None = None
    red: float = Field(ge=0)
    green: float = Field(ge=0)
    blue: float = Field(ge=0)
    RE1: float = Field(ge=0)
    latitude: float
    longitude: float
    dataset: str = "custom"
    category: str = "custom"


class ImageData(BaseModel):
    image_base64: str
    filename: str = "upload.jpg"


class PredictionRequest(BaseModel):
    pond_id: str = Field(min_length=1, max_length=100)
    observed_at: datetime
    iot_data: dict[str, Any] | None = None
    satellite_data: SatelliteData | None = None
    image_data: ImageData | None = None

    @model_validator(mode="after")
    def require_an_input(self):
        if self.iot_data is None and self.satellite_data is None and self.image_data is None:
            raise ValueError("Provide at least one of iot_data, satellite_data or image_data")
        return self


class SimulationRequest(BaseModel):
    pond_id: str = Field(min_length=1, max_length=100)
    observed_at: datetime
    baseline_iot_data: dict[str, Any]
    changes: dict[str, float]
    satellite_data: SatelliteData | None = None


def _dashboard_values(
    state: dict[str, Any] | None,
    satellite: dict[str, Any] | None,
) -> dict[str, Any]:
    """Return stable summary fields while preserving full model output separately."""
    if state is None:
        dashboard: dict[str, Any] = {
            "current_biomass_g_l": None,
            "biomass_6h_g_l": None,
            "biomass_24h_g_l": None,
            "health_score": None,
            "health_band": None,
            "anomaly_probability": None,
            "anomaly_severity": None,
            "gross_co2_uptake_rate_g_l_h": None,
        }
    else:
        dashboard = {
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
        }
    dashboard.update(
        {
            "chlorophyll_a": None if satellite is None else satellite.get("chlorophyll_a"),
            "turbidity": None if satellite is None else satellite.get("turbidity"),
        }
    )
    return dashboard


def create_app(model_dir: str | Path | None = None) -> FastAPI:
    package_root = Path(__file__).resolve().parents[1]
    configured = model_dir or os.getenv("ALGATWIN_MODEL_DIR", "models")
    resolved_model_dir = Path(configured)
    if not resolved_model_dir.is_absolute():
        resolved_model_dir = package_root / resolved_model_dir
    registry = ModelRegistry(resolved_model_dir)
    engines: dict[str, Any] = {}

    app = FastAPI(
        title="AlgaTwin Inference API",
        version="2.0.0",
        description="Two-workflow API: live/custom prediction and stateless simulation.",
    )
    origins = [
        item.strip()
        for item in os.getenv(
            "ALGATWIN_CORS_ORIGINS",
            "http://localhost:3000,http://localhost:5173",
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
    app.state.engines = engines

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
        return {"status": "ok", **registry.status()}

    @app.get("/models")
    def models():
        return registry.manifest

    @app.post("/predict")
    def predict(body: PredictionRequest):
        state = None
        satellite = None
        image = None
        try:
            if body.iot_data is not None:
                engine = engines.setdefault(body.pond_id, registry.create_engine())
                observation = registry.prepare_observation(
                    body.iot_data, body.observed_at, body.pond_id
                )
                state = engine.update(observation, body.observed_at)
            if body.satellite_data is not None:
                satellite_payload = body.satellite_data.model_dump()
                satellite_payload["date"] = satellite_payload["date"] or body.observed_at
                satellite = registry.predict_remote(satellite_payload)
            if body.image_data is not None:
                image = registry.predict_image_base64(
                    body.image_data.image_base64,
                    body.image_data.filename,
                )
        except Exception as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        return {
            "request_type": "prediction",
            "pond_id": body.pond_id,
            "observed_at": body.observed_at,
            "dashboard": _dashboard_values(state, satellite),
            "results": {
                "digital_twin": state,
                "satellite": satellite,
                "image": image,
            },
        }

    @app.post("/simulate")
    def simulate(body: SimulationRequest):
        try:
            engine = registry.create_engine()
            observation = registry.prepare_observation(
                body.baseline_iot_data,
                body.observed_at,
                body.pond_id,
            )
            baseline = engine.update(observation, body.observed_at)
            simulation = engine.simulate(body.changes)
            satellite = None
            if body.satellite_data is not None:
                satellite_payload = body.satellite_data.model_dump()
                satellite_payload["date"] = satellite_payload["date"] or body.observed_at
                satellite = registry.predict_remote(satellite_payload)
        except Exception as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        simulation_dashboard = _dashboard_values(baseline, satellite)
        simulation_dashboard.update(
            {
                "simulated_biomass_g_l": simulation.get("simulated_biomass_g_l"),
                "biomass_delta_g_l": simulation.get("biomass_delta_g_l"),
                "relative_biomass_delta_pct": simulation.get("relative_biomass_delta_pct"),
                "simulated_health_score": simulation.get("simulated_health_score"),
                "simulation_classification": simulation.get("classification"),
            }
        )
        return {
            "request_type": "simulation",
            "pond_id": body.pond_id,
            "observed_at": body.observed_at,
            "dashboard": simulation_dashboard,
            "baseline": baseline,
            "simulation": simulation,
            "satellite": satellite,
            "live_state_changed": False,
        }

    return app


app = create_app()
