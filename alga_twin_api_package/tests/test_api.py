from __future__ import annotations

import base64
from io import BytesIO
from pathlib import Path

import numpy as np
from fastapi.testclient import TestClient
from PIL import Image

from alga_twin_api.main import create_app


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "models"


def _client() -> TestClient:
    return TestClient(create_app(MODEL_DIR))


def _iot_data(client: TestClient) -> tuple[str, dict]:
    registry = client.app.state.registry
    row = registry.master.dropna(subset=["water_temp_avg_c", "sensor_ph", "do_mg_l"]).iloc[0]
    values = row.to_dict()
    observed_at = row.date.isoformat()
    values.pop("date", None)
    clean = {
        key: value.item() if isinstance(value, np.generic) else value
        for key, value in values.items()
        if not (isinstance(value, float) and np.isnan(value))
    }
    return observed_at, clean


def _satellite_data() -> dict:
    return {
        "red": 0.10,
        "green": 0.16,
        "blue": 0.12,
        "RE1": 0.11,
        "latitude": 40.15,
        "longitude": -111.86,
        "dataset": "whole-lake",
        "category": "whole-lake",
    }


def test_health_inventory_and_two_workflow_endpoints():
    client = _client()
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["ready"] is True
    assert health.json()["model_families"] == 6
    assert health.json()["logical_estimators"] == 9

    models = client.get("/models")
    assert models.status_code == 200
    assert models.json()["status"].startswith("complete")

    schema = client.get("/openapi.json").json()
    post_paths = {path for path, methods in schema["paths"].items() if "post" in methods}
    assert post_paths == {"/predict", "/simulate"}


def test_predict_combines_iot_satellite_and_image_as_json():
    client = _client()
    observed_at, iot_data = _iot_data(client)
    buffer = BytesIO()
    Image.new("RGB", (96, 96), color=(55, 120, 70)).save(buffer, format="JPEG")
    response = client.post(
        "/predict",
        json={
            "pond_id": "test-pond",
            "observed_at": observed_at,
            "iot_data": iot_data,
            "satellite_data": _satellite_data(),
            "image_data": {
                "image_base64": base64.b64encode(buffer.getvalue()).decode("ascii"),
                "filename": "synthetic-pond.jpg",
            },
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["request_type"] == "prediction"
    assert body["results"]["digital_twin"]["pond_id"] == "test-pond"
    assert body["results"]["satellite"]["chlorophyll_a"] >= 0
    assert body["results"]["satellite"]["turbidity"] >= 0
    assert body["results"]["image"]["provenance"] == "estimated_from_image"
    assert 0 <= body["dashboard"]["health_score"] <= 100
    assert body["dashboard"]["current_biomass_g_l"] is not None


def test_predict_accepts_satellite_without_iot():
    client = _client()
    response = client.post(
        "/predict",
        json={
            "pond_id": "satellite-only",
            "observed_at": "2026-09-12T10:00:00+05:30",
            "satellite_data": _satellite_data(),
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["results"]["digital_twin"] is None
    assert response.json()["dashboard"]["chlorophyll_a"] >= 0


def test_simulation_uses_custom_baseline_without_changing_live_state():
    client = _client()
    observed_at, iot_data = _iot_data(client)
    assert client.app.state.engines == {}
    response = client.post(
        "/simulate",
        json={
            "pond_id": "scenario-pond",
            "observed_at": observed_at,
            "baseline_iot_data": iot_data,
            "changes": {"water_temp_avg_c": 28.0, "co2_ppm": 900.0},
            "satellite_data": _satellite_data(),
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["request_type"] == "simulation"
    assert body["simulation"]["provenance"] == "simulated"
    assert body["simulation"]["experimental_co2_calibration"] is not None
    assert body["dashboard"]["simulated_biomass_g_l"] == body["simulation"]["simulated_biomass_g_l"]
    assert body["dashboard"]["simulation_classification"] == body["simulation"]["classification"]
    assert body["live_state_changed"] is False
    assert client.app.state.engines == {}


def test_empty_prediction_and_optional_api_key(monkeypatch):
    client = _client()
    empty = client.post(
        "/predict",
        json={"pond_id": "empty", "observed_at": "2026-09-12T10:00:00+05:30"},
    )
    assert empty.status_code == 422

    monkeypatch.setenv("ALGATWIN_API_KEY", "test-secret")
    protected = _client()
    assert protected.get("/health").status_code == 200
    assert protected.get("/models").status_code == 401
    assert protected.get("/models", headers={"X-API-Key": "test-secret"}).status_code == 200
