# AlgaTwin inference API

This is a standalone, GitHub-ready inference service with two primary JSON endpoints. It contains the API runtime, all validated model artifacts, examples, Docker packaging, documentation, and tests. The original notebooks and source CSV directories are not required at runtime.

## The two endpoints

| Method and path | Input | JSON output |
|---|---|---|
| `POST /predict` | Any combination of IoT, satellite-reflectance and pond-image data | Dashboard summary plus complete digital-twin, satellite and image results |
| `POST /simulate` | Custom baseline IoT data and proposed control changes | Baseline, simulated outcome, dashboard summary and optional satellite result |

`GET /health` and `GET /models` are operational metadata routes, not prediction workflows.

## Quick start

Python 3.12 is recommended because the model artifacts were serialized with the pinned versions in `requirements.txt`.

```bash
cd alga_twin_api_package
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn alga_twin_api.main:app --host 0.0.0.0 --port 8000
```

Open Swagger UI at `http://localhost:8000/docs`.

Send the included examples:

```bash
curl -X POST http://localhost:8000/predict \
  -H 'Content-Type: application/json' \
  --data @examples/predict.json

curl -X POST http://localhost:8000/simulate \
  -H 'Content-Type: application/json' \
  --data @examples/simulate.json
```

Or run:

```bash
python examples/client.py
```

Both responses contain a compact `dashboard` object for frontend cards and charts. Full outputs remain available alongside it.

## Docker

```bash
docker build -t algatwin-api .
docker run --rm -p 8000:8000 algatwin-api
```

Or run `docker compose up --build`.

## Tests

```bash
python -m pytest -q
```

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `ALGATWIN_MODEL_DIR` | Model artifact directory | `models` relative to package root |
| `ALGATWIN_CORS_ORIGINS` | Comma-separated browser origins | localhost ports 3000 and 5173 |
| `ALGATWIN_API_KEY` | Optional shared API key | Unset; local requests are open |

When `ALGATWIN_API_KEY` is set, include it as the `X-API-Key` header. Health and API documentation remain public.

## Publish this folder to GitHub

Create an empty GitHub repository, then run from this directory:

```bash
git init
git add .
git commit -m "Add standalone AlgaTwin inference API"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git push -u origin main
```

Every file is currently below GitHub's 100 MB per-file limit. Git LFS is optional for the included artifacts. Before publishing publicly, confirm that the source datasets permit redistribution of the derived models and ATP3 reference table. No license is assigned automatically.

## Important deployment notes

- `/predict` keeps per-pond history in memory to improve sequential state updates.
- `/simulate` creates a temporary twin and never changes live pond state.
- Run one Uvicorn worker. Use Redis/PostgreSQL before multiple workers or replicas.
- State disappears on restart unless you connect persistent storage.
- Only load trusted joblib artifacts; joblib/pickle files can execute code when loaded.
- The 24-hour learned candidate is quality-gated; runtime safely falls back to persistence.
- Remote chlorophyll-a/turbidity results use Utah Lake calibration and are not ATP3 biomass measurements.
- Core hashes are in `models/SHA256SUMS`; verify with `(cd models && sha256sum -c SHA256SUMS)`.

See [API_USAGE.md](API_USAGE.md) for exact contracts and [MODEL_CARD.md](MODEL_CARD.md) for metrics and limitations.
