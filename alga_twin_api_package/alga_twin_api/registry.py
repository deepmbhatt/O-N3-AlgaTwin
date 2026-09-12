"""Load all model artifacts once and provide stable inference entry points."""

from __future__ import annotations

import base64
import binascii
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any
import json

import joblib
import numpy as np
import pandas as pd

from .advanced_modeling import predict_image_condition
from .integrated_twin import IntegratedAlgaTwinEngine
from .modeling import REMOTE_FEATURES
from .twin import TwinConfig


class ModelRegistry:
    """Own shared read-only model objects and create per-pond state engines."""

    required_artifacts = {
        "biomass": "atp3_biomass_model.joblib",
        "forecast": "biomass_forecast_models.joblib",
        "anomaly": "anomaly_models.joblib",
        "image": "image_condition_model.joblib",
        "remote": "remote_verification_models.joblib",
        "co2": "co2_growth_model.joblib",
        "master": "atp3_biomass_master.csv",
        "manifest": "model_manifest.json",
    }

    def __init__(self, model_dir: str | Path):
        self.model_dir = Path(model_dir).resolve()
        missing = [name for name in self.required_artifacts.values() if not (self.model_dir / name).exists()]
        if missing:
            raise FileNotFoundError(f"Missing AlgaTwin model artifacts: {missing}")
        self.biomass_model = joblib.load(self.model_dir / self.required_artifacts["biomass"])
        self.forecast_models = joblib.load(self.model_dir / self.required_artifacts["forecast"])
        self.anomaly_bundle = joblib.load(self.model_dir / self.required_artifacts["anomaly"])
        self.image_bundle = joblib.load(self.model_dir / self.required_artifacts["image"])
        self.remote_models = joblib.load(self.model_dir / self.required_artifacts["remote"])
        self.co2_bundle = joblib.load(self.model_dir / self.required_artifacts["co2"])
        self.master = pd.read_csv(self.model_dir / self.required_artifacts["master"], parse_dates=["date"])
        self.manifest = json.loads((self.model_dir / self.required_artifacts["manifest"]).read_text())

    def create_engine(self) -> IntegratedAlgaTwinEngine:
        return IntegratedAlgaTwinEngine(
            self.biomass_model,
            self.master,
            forecast_models=self.forecast_models,
            anomaly_bundle=self.anomaly_bundle,
            co2_bundle=self.co2_bundle,
            config=TwinConfig(recent_window=8, gross_co2_g_per_g_biomass=1.83),
        )

    @staticmethod
    def prepare_observation(values: dict[str, Any], observed_at: Any, pond_id: str) -> dict[str, Any]:
        observation = dict(values)
        timestamp = pd.Timestamp(observed_at)
        day = timestamp.dayofyear
        observation.update(
            {
                "pond_id": pond_id,
                "date": timestamp.normalize(),
                "day_of_year_sin": np.sin(2 * np.pi * day / 365.25),
                "day_of_year_cos": np.cos(2 * np.pi * day / 365.25),
            }
        )
        return observation

    def predict_remote(self, payload: dict[str, Any]) -> dict[str, Any]:
        row = dict(payload)
        timestamp = pd.Timestamp(row["date"])
        red, green, red_edge = float(row["red"]), float(row["green"]), float(row["RE1"])
        row["nd_green_red"] = (green - red) / (green + red) if green + red else np.nan
        row["nd_re_red"] = (red_edge - red) / (red_edge + red) if red_edge + red else np.nan
        row["green_red_ratio"] = green / red if red else np.nan
        row["re_green_ratio"] = red_edge / green if green else np.nan
        row["day_of_year_sin"] = np.sin(2 * np.pi * timestamp.dayofyear / 365.25)
        row["day_of_year_cos"] = np.cos(2 * np.pi * timestamp.dayofyear / 365.25)
        features = pd.DataFrame([{feature: row.get(feature, np.nan) for feature in REMOTE_FEATURES}])
        return {
            "chlorophyll_a": max(0.0, float(self.remote_models["chla"].predict(features)[0])),
            "turbidity": max(0.0, float(self.remote_models["turbidity"].predict(features)[0])),
            "observed_at": timestamp.isoformat(),
            "provenance": "estimated_from_remote_reflectance",
            "warning": "Utah Lake calibration; not an ATP3 biomass measurement.",
        }

    def predict_image_base64(self, encoded: str, filename: str = "upload.jpg") -> dict[str, Any]:
        if encoded.startswith("data:"):
            try:
                encoded = encoded.split(",", 1)[1]
            except IndexError as error:
                raise ValueError("Invalid base64 data URL") from error
        try:
            payload = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError) as error:
            raise ValueError("image_base64 is not valid base64") from error
        if not payload:
            raise ValueError("Decoded image is empty")
        if len(payload) > 10 * 1024 * 1024:
            raise ValueError("Decoded image exceeds the 10 MB limit")
        suffix = Path(filename).suffix.lower()
        if suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
            suffix = ".jpg"
        try:
            with NamedTemporaryFile(suffix=suffix) as temporary:
                temporary.write(payload)
                temporary.flush()
                result = predict_image_condition(self.image_bundle, temporary.name)
        except Exception as error:
            raise ValueError("Decoded payload is not a supported image") from error
        result["filename"] = Path(filename).name
        return result

    def status(self) -> dict[str, Any]:
        return {
            "ready": True,
            "model_families": 6,
            "logical_estimators": 9,
            "manifest_status": self.manifest.get("status"),
            "artifacts": {
                key: {"file": value, "exists": (self.model_dir / value).exists()}
                for key, value in self.required_artifacts.items()
            },
        }

