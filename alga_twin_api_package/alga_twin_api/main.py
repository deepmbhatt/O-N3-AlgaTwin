"""Production-shaped FastAPI surface for the standalone AlgaTwin package."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any
import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .registry import ModelRegistry


class UpdateRequest(BaseModel):
    observed_at: datetime
    values: dict[str, Any] = Field(default_factory=dict)


class ScenarioRequest(BaseModel):
    changes: dict[str, float]


class VerificationRequest(BaseModel):
    source: str
    observed_at: datetime
    biomass_proxy_g_l: float = Field(gt=0)
    source_confidence: float = Field(ge=0, le=1)


class RemotePredictionRequest(BaseModel):
    date: datetime
    red: float = Field(ge=0)
    green: float = Field(ge=0)
    blue: float = Field(ge=0)
    RE1: float = Field(ge=0)
    latitude: float
    longitude: float
    dataset: str
    category: str


class ImagePredictionRequest(BaseModel):
    image_base64: str
    filename: str = "upload.jpg"


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
        version="1.0.0",
        description="Biomass, forecasts, anomaly/health, scenarios, image and remote verification.",
    )
    origins = [item.strip() for item in os.getenv(
        "ALGATWIN_CORS_ORIGINS", "http://localhost:3000,http://localhost:5173"
    ).split(",") if item.strip()]
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
                return JSONResponse(status_code=401, content={"detail": "Invalid or missing X-API-Key"})
        return await call_next(request)

    @app.get("/health")
    def health():
        return {"status": "ok", **registry.status()}

    @app.get("/models")
    def models():
        return registry.manifest

    @app.get("/ponds")
    def list_ponds():
        return {"ponds": sorted(engines), "count": len(engines)}

    @app.post("/ponds/{pond_id}/update")
    def update_pond(pond_id: str, body: UpdateRequest):
        engine = engines.setdefault(pond_id, registry.create_engine())
        observation = registry.prepare_observation(body.values, body.observed_at, pond_id)
        try:
            return engine.update(observation, body.observed_at)
        except Exception as error:
            raise HTTPException(status_code=422, detail=str(error)) from error

    @app.get("/ponds/{pond_id}/state")
    def pond_state(pond_id: str):
        if pond_id not in engines or engines[pond_id].current_state is None:
            raise HTTPException(status_code=404, detail="No state exists for this pond")
        return engines[pond_id].current_state

    @app.post("/ponds/{pond_id}/scenario")
    def scenario(pond_id: str, body: ScenarioRequest):
        if pond_id not in engines:
            raise HTTPException(status_code=404, detail="Update the pond before running a scenario")
        try:
            return engines[pond_id].simulate(body.changes)
        except (ValueError, RuntimeError) as error:
            raise HTTPException(status_code=422, detail=str(error)) from error

    @app.post("/ponds/{pond_id}/verify")
    def verify(pond_id: str, body: VerificationRequest):
        if pond_id not in engines:
            raise HTTPException(status_code=404, detail="Update the pond before adding verification")
        try:
            return engines[pond_id].add_remote_observation(body.model_dump())
        except (ValueError, RuntimeError) as error:
            raise HTTPException(status_code=422, detail=str(error)) from error

    @app.post("/remote/predict")
    def remote_predict(body: RemotePredictionRequest):
        try:
            return registry.predict_remote(body.model_dump())
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error

    @app.post("/image/predict")
    def image_predict(body: ImagePredictionRequest):
        try:
            return registry.predict_image_base64(body.image_base64, body.filename)
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error

    return app


app = create_app()

