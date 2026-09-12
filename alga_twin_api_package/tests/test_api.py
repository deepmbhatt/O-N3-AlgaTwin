from __future__ import annotations

import base64
from copy import deepcopy
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


def _valid_update(client: TestClient, pond_id: str = "test-pond"):
    registry = client.app.state.registry
    row = registry.master.dropna(subset=["water_temp_avg_c", "sensor_ph", "do_mg_l"]).iloc[0]
    values = row.to_dict()
    values.pop("date", None)
    values = {
        key: value.item() if isinstance(value, np.generic) else value
        for key, value in values.items()
        if not (isinstance(value, float) and np.isnan(value))
    }
    response = client.post(
        f"/ponds/{pond_id}/update",
        json={"observed_at": row.date.isoformat(), "values": values},
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_health_and_model_inventory():
    client = _client()
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["ready"] is True
    assert health.json()["model_families"] == 6
    assert health.json()["logical_estimators"] == 9
    assert all(item["exists"] for item in health.json()["artifacts"].values())

    models = client.get("/models")
    assert models.status_code == 200
    assert models.json()["status"].startswith("complete")


def test_update_state_and_non_mutating_scenario():
    client = _client()
    state = _valid_update(client)
    assert state["pond_id"] == "test-pond"
    assert state["predicted"]["method"] == "direct_supervised_near_horizon_afdw_model"
    assert 0 <= state["health"]["score"] <= 100

    before = deepcopy(client.get("/ponds/test-pond/state").json())
    scenario = client.post(
        "/ponds/test-pond/scenario",
        json={"changes": {"water_temp_avg_c": 28.0, "co2_ppm": 900.0}},
    )
    assert scenario.status_code == 200, scenario.text
    assert scenario.json()["provenance"] == "simulated"
    assert scenario.json()["experimental_co2_calibration"] is not None
    assert client.get("/ponds/test-pond/state").json() == before


def test_remote_and_base64_image_predictions():
    client = _client()
    remote = client.post(
        "/remote/predict",
        json={
            "date": "2026-09-12T10:00:00+05:30",
            "red": 0.10,
            "green": 0.16,
            "blue": 0.12,
            "RE1": 0.11,
            "latitude": 40.15,
            "longitude": -111.86,
            "dataset": "whole-lake",
            "category": "whole-lake",
        },
    )
    assert remote.status_code == 200, remote.text
    assert remote.json()["chlorophyll_a"] >= 0
    assert remote.json()["turbidity"] >= 0

    buffer = BytesIO()
    Image.new("RGB", (96, 96), color=(55, 120, 70)).save(buffer, format="JPEG")
    image = client.post(
        "/image/predict",
        json={
            "image_base64": base64.b64encode(buffer.getvalue()).decode("ascii"),
            "filename": "synthetic-pond.jpg",
        },
    )
    assert image.status_code == 200, image.text
    assert image.json()["provenance"] == "estimated_from_image"
    assert image.json()["filename"] == "synthetic-pond.jpg"


def test_optional_api_key(monkeypatch):
    monkeypatch.setenv("ALGATWIN_API_KEY", "test-secret")
    client = _client()
    assert client.get("/health").status_code == 200
    assert client.get("/models").status_code == 401
    assert client.get("/models", headers={"X-API-Key": "test-secret"}).status_code == 200

