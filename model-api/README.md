# AlgaTwin stream, simulation and dashboard API

A standalone FastAPI service containing all validated AlgaTwin artifacts, a 999-row circular demonstration stream, 999 condition-matched pond images, MongoDB-aware persistence, frontend-ready responses, Docker packaging and tests.

## API surface

| Method | Path | Consumer | Purpose |
|---|---|---|---|
| POST | `/predict` | Cron worker | Consume the next CSV burst and run IoT, forecast, anomaly, satellite and image inference |
| POST | `/simulate` | Backend/user | Apply changes to the latest streamed baseline; optionally classify a submitted image |
| GET | `/dashboard` | Backend/frontend | Read latest readings and history without advancing the stream |
| GET | `/health` | Infrastructure | Model readiness, row count and cursor |
| GET | `/models` | Developers | Model manifest |
| GET | `/docs` | Developers | Interactive OpenAPI documentation |

## Demonstration data

[data/pond_iot_stream.csv](data/pond_iot_stream.csv) contains 999 rows:

- 333 chronological time steps;
- three ponds per time step;
- gradual stable, heat/low-oxygen and nutrient/light-limitation trajectories;
- IoT features, satellite reflectance, image metadata and explicit provenance;
- one 100×100 condition-matched visual fixture per row in `data/stream_images/`.

The numeric stream and its association with visual fixtures are demonstration mappings, not synchronized real-world observations.

With the default `batch_size: 3`, each cron call returns one reading per pond. After call 333, the cursor automatically restarts at row 1 and increments `stream_cycle`.

## Start locally

```bash
cd alga_twin_api_package
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn alga_twin_api.main:app --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000/docs`.

```bash
curl -X POST http://localhost:8000/predict \
  -H 'Content-Type: application/json' \
  --data @examples/predict.json

curl 'http://localhost:8000/dashboard?limit=20'

curl -X POST http://localhost:8000/simulate \
  -H 'Content-Type: application/json' \
  --data @examples/simulate.json
```

## Persistence

Without MongoDB, cursor and dashboard history are kept in bounded process memory.

With MongoDB:

```bash
export ALGATWIN_MONGODB_URI='mongodb://localhost:27017'
export ALGATWIN_MONGODB_DATABASE='algatwin'
```

The service automatically uses:

- `stream_cursors`;
- `predictions`;
- `simulations`.

See [BACKEND_DATABASE_HANDOFF.md](BACKEND_DATABASE_HANDOFF.md) for schemas, indexes, cron logic, ownership and deployment tasks.

## Docker

```bash
docker compose up --build
```

The included Compose file starts the API and a local MongoDB development container. Secure MongoDB separately for production.

## Verification

```bash
python -m pytest -q
(cd models && sha256sum -c SHA256SUMS)
```

Detailed contracts are in [API_USAGE.md](API_USAGE.md), data design in [data/README.md](data/README.md), and model metrics/limits in [MODEL_CARD.md](MODEL_CARD.md).

Before publishing publicly, confirm redistribution rights for the derived models, ATP3 reference table and visual-condition fixtures.

### Model-grounded decision endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/ponds/{pond_id}/ai-insights` | Compact state, deterministic insight and ranked non-mutating actions |
| POST | `/assistant/chat` | Gemini explanation when configured, deterministic fallback otherwise |
| GET | `/ponds/{pond_id}/mrv` | Assumption-driven carbon accounting from the live model uptake rate |

### Optional Gemini explanation layer

```bash
export GEMINI_API_KEY='your-key'
export GEMINI_MODEL='gemini-3.8-flash'
```

The key stays in the model API environment and is never sent to the browser. Gemini is constrained to explain supplied AlgaTwin evidence. Scenario ranking and recommendations always come from the local digital twin. If Gemini is unavailable, the assistant returns a deterministic response.
