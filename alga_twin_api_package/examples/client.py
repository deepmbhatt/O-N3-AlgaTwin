"""Minimal Python client for AlgaTwin's two JSON endpoints."""

from pathlib import Path
import json
import os

import httpx


BASE_URL = os.getenv("ALGATWIN_URL", "http://localhost:8000")
API_KEY = os.getenv("ALGATWIN_API_KEY")
HEADERS = {"X-API-Key": API_KEY} if API_KEY else {}
HERE = Path(__file__).resolve().parent


def load(name: str):
    return json.loads((HERE / name).read_text())


with httpx.Client(base_url=BASE_URL, headers=HEADERS, timeout=30) as api:
    prediction = api.post("/predict", json=load("predict.json"))
    prediction.raise_for_status()
    print("PREDICTION\n", json.dumps(prediction.json(), indent=2))

    simulation = api.post("/simulate", json=load("simulate.json"))
    simulation.raise_for_status()
    print("SIMULATION\n", json.dumps(simulation.json(), indent=2))
