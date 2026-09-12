from __future__ import annotations

import base64
from copy import deepcopy
from pathlib import Path

import pandas as pd
from fastapi.testclient import TestClient

from alga_twin_api.main import create_app
from alga_twin_api.storage import MemoryPredictionStore
from alga_twin_api.streaming import CircularCsvStream, MemoryCursorBackend


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "models"
STREAM_CSV = ROOT / "data" / "pond_iot_stream.csv"


def _client() -> TestClient:
    return TestClient(
        create_app(
            MODEL_DIR,
            STREAM_CSV,
            cursor_backend=MemoryCursorBackend(),
            prediction_store=MemoryPredictionStore(),
        )
    )


def test_generated_stream_has_999_gradual_rows_and_images():
    frame = pd.read_csv(STREAM_CSV)
    assert len(frame) == 999
    assert frame.groupby("pond_id").size().to_dict() == {
        "pond-01": 333,
        "pond-02": 333,
        "pond-03": 333,
    }
    assert frame.groupby("time_step").size().eq(3).all()
    assert frame.isna().sum().sum() == 0
    assert frame["record_provenance"].eq("synthetic_gradual_stream").all()
    assert frame["association_provenance"].eq(
        "synthetic_condition_matched_mapping"
    ).all()
    assert all((STREAM_CSV.parent / path).exists() for path in frame["image_path"])
    assert len(list((STREAM_CSV.parent / "stream_images").glob("*.jpg"))) == 999

    for _, pond in frame.groupby("pond_id"):
        assert pond["time_step"].tolist() == list(range(1, 334))
        assert pond["water_temp_avg_c"].diff().abs().dropna().max() < 0.2
        assert pond["do_mg_l"].diff().abs().dropna().max() < 0.2


def test_cursor_restarts_after_row_999_without_model_work():
    backend = MemoryCursorBackend()
    stream = CircularCsvStream(STREAM_CSV, backend)
    records, cursor = stream.next_batch(999)
    assert len(records) == 999
    assert records[0]["stream_row"] == 1
    assert records[-1]["stream_row"] == 999
    assert cursor["next_row"] == 1
    assert cursor["cycle"] == 1
    assert cursor["restarted"] is True

    records, cursor = stream.next_batch(3)
    assert [item["stream_row"] for item in records] == [1, 2, 3]
    assert all(item["stream_cycle"] == 1 for item in records)
    assert cursor["next_row"] == 4


def test_health_inventory_and_three_workflow_endpoints():
    client = _client()
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["ready"] is True
    assert health.json()["stream"]["total_rows"] == 999

    schema = client.get("/openapi.json").json()
    post_paths = {path for path, methods in schema["paths"].items() if "post" in methods}
    assert {"/predict", "/simulate", "/assistant/chat"} <= post_paths
    assert "/dashboard" in schema["paths"]


def test_predict_returns_three_ponds_images_inputs_and_insights():
    client = _client()
    response = client.post(
        "/predict",
        json={
            "batch_size": 3,
            "include_images": True,
            "return_image_base64": True,
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert [item["pond_id"] for item in body["data"]] == [
        "pond-01",
        "pond-02",
        "pond-03",
    ]
    assert [item["stream_row"] for item in body["data"]] == [1, 2, 3]
    for item in body["data"]:
        assert item["source_data"]["iot_data"]
        assert item["source_data"]["satellite_data"]
        assert item["source_data"]["image"]["base64"]
        assert item["results"]["digital_twin"]
        assert item["results"]["satellite"]
        assert item["results"]["image"]["provenance"] == "estimated_from_image"
        assert item["dashboard"]["image_state"] is not None
        assert any(
            insight["code"].startswith("VISUAL_CONDITION")
            for insight in item["insights"]
        )


def test_dashboard_returns_latest_iot_predictions_and_history():
    client = _client()
    client.post("/predict", json={"batch_size": 3, "include_images": False})
    client.post("/predict", json={"batch_size": 3, "include_images": False})

    all_ponds = client.get("/dashboard", params={"limit": 2})
    assert all_ponds.status_code == 200
    assert len(all_ponds.json()["data"]) == 3
    for pond in all_ponds.json()["data"]:
        assert pond["latest"]["source_data"]["iot_data"]
        assert pond["latest"]["dashboard"]
        assert pond["returned_history_count"] == 2

    one_pond = client.get(
        "/dashboard",
        params={"pond_id": "pond-02", "limit": 1},
    )
    assert one_pond.status_code == 200
    assert one_pond.json()["data"][0]["pond_id"] == "pond-02"
    assert one_pond.json()["data"][0]["returned_history_count"] == 1
    assert client.get("/dashboard", params={"pond_id": "missing"}).status_code == 404


def test_simulation_uses_current_row_accepts_image_and_preserves_state():
    client = _client()
    prediction = client.post("/predict", json={"batch_size": 3})
    assert prediction.status_code == 200
    image = prediction.json()["data"][1]["source_data"]["image"]
    cursor_before = client.app.state.stream.backend.read()
    state_before = deepcopy(client.app.state.engines["pond-02"].current_state)

    response = client.post(
        "/simulate",
        json={
            "pond_id": "pond-02",
            "changes": {
                "water_temp_avg_c": 27.5,
                "nitrate_mg_l": 50,
                "co2_ppm": 900,
            },
            "image_data": {
                "filename": image["filename"],
                "image_base64": image["base64"],
            },
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()["data"]
    assert body["baseline_source_data"]["stream_row"] == 2
    assert body["simulation"]["provenance"] == "simulated"
    assert body["image"]["provenance"] == "estimated_from_image"
    assert body["submitted_image"]["provenance"] == "user_supplied_for_simulation"
    assert body["image_is_supporting_evidence_only"] is True
    assert any(
        insight["code"] == "VISUAL_SUPPORTING_EVIDENCE"
        for insight in body["insights"]
    )
    assert body["live_state_changed"] is False
    assert body["cursor_advanced"] is False
    assert client.app.state.stream.backend.read() == cursor_before
    assert client.app.state.engines["pond-02"].current_state == state_before

    dashboard = client.get(
        "/dashboard",
        params={"pond_id": "pond-02", "limit": 5},
    )
    assert dashboard.status_code == 200
    stored = dashboard.json()["data"][0]
    assert stored["latest_simulation"]["pond_id"] == "pond-02"
    assert len(stored["simulation_history"]) == 1


def test_optional_api_key(monkeypatch):
    monkeypatch.setenv("ALGATWIN_API_KEY", "test-secret")
    client = _client()
    assert client.get("/health").status_code == 200
    assert client.get("/dashboard").status_code == 401
    assert client.post("/predict", json={}).status_code == 401
    assert client.post(
        "/predict",
        json={"include_images": False},
        headers={"X-API-Key": "test-secret"},
    ).status_code == 200


def test_insight_action_chat_and_mrv_use_current_models(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    client = _client()
    client.post("/predict", json={"batch_size": 3, "include_images": True})

    insight = client.get("/ponds/pond-01/ai-insights")
    assert insight.status_code == 200, insight.text
    package = insight.json()["data"]
    assert package["insight"]["action_state"] in {
        "RECOVER", "STABILIZE", "MAINTAIN", "VERIFY"
    }
    assert package["current_state"]["biomass"]["forecast_method"]
    assert package["action"]["live_state_changed"] is False

    chat = client.post(
        "/assistant/chat",
        json={"pond_id": "pond-01", "message": "What should I do?"},
    )
    assert chat.status_code == 200, chat.text
    assert chat.json()["provider"] == "deterministic_fallback"
    assert chat.json()["answer"]

    mrv = client.get(
        "/ponds/pond-01/mrv",
        params={
            "pond_volume_m3": 1000,
            "window_hours": 24,
            "operational_emissions_kg": 1,
            "permanence_factor": 0.8,
        },
    )
    assert mrv.status_code == 200, mrv.text
    result = mrv.json()["data"]
    assert result["status"] == "estimated_not_registry_verified"
    assert result["inputs"]["pond_volume_m3"] == 1000
    assert result["methodology"]["scope"] == "gross biological uptake; not net MRV"
