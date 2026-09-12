"""Minimal Python client for the running AlgaTwin API."""

from pathlib import Path
import base64
import json
import os

import httpx


BASE_URL = os.getenv("ALGATWIN_URL", "http://localhost:8000")
API_KEY = os.getenv("ALGATWIN_API_KEY")
HEADERS = {"X-API-Key": API_KEY} if API_KEY else {}
HERE = Path(__file__).resolve().parent


def load(name: str):
    return json.loads((HERE / name).read_text())


with httpx.Client(base_url=BASE_URL, headers=HEADERS, timeout=30) as client:
    update = client.post("/ponds/pond-01/update", json=load("update.json"))
    update.raise_for_status()
    print("STATE\n", json.dumps(update.json(), indent=2))

    scenario = client.post("/ponds/pond-01/scenario", json=load("scenario.json"))
    scenario.raise_for_status()
    print("SCENARIO\n", json.dumps(scenario.json(), indent=2))

    remote = client.post("/remote/predict", json=load("remote.json"))
    remote.raise_for_status()
    print("REMOTE\n", json.dumps(remote.json(), indent=2))

    # Optional image example: python examples/client.py path/to/pond.jpg
    import sys
    if len(sys.argv) > 1:
        path = Path(sys.argv[1])
        payload = {
            "filename": path.name,
            "image_base64": base64.b64encode(path.read_bytes()).decode("ascii"),
        }
        image = client.post("/image/predict", json=payload)
        image.raise_for_status()
        print("IMAGE\n", json.dumps(image.json(), indent=2))

