# AlgaTwin inference API

This folder is a standalone, GitHub-ready inference service. It contains the API runtime, all validated model artifacts, request examples, Docker packaging, model documentation, and tests. It does not require the original CSVs or notebooks.

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

Before publishing publicly, confirm that the source datasets permit redistribution of the included derived models and ATP3 reference table. No license is assigned automatically by this package.

## What the API returns

- current AFDW biomass estimate and model confidence;
- accepted near-6-hour forecast;
- gated 24-hour prediction (safe persistence fallback because the trained model did not beat persistence);
- crash risk, multivariate novelty, sensor-quality flags, and combined anomaly probability;
- health score, band, likely stress, and explanation;
- gross biological CO2-uptake estimate;
- non-mutating temperature/pH/nutrient/light/experimental-CO2 scenarios;
- remote-observation verification confidence;
- fishpond image condition predictions from uploaded base64 images;
- Utah Lake chlorophyll-a and turbidity predictions from reflectance.

## Quick start

Python 3.12 is recommended because the artifacts were serialized with the pinned versions in `requirements.txt`.

```bash
git clone <your-repository-url>
cd alga_twin_api_package

python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python -m uvicorn alga_twin_api.main:app --host 0.0.0.0 --port 8000
```

Open:

- Swagger UI: `http://localhost:8000/docs`
- Health/model readiness: `http://localhost:8000/health`
- OpenAPI JSON: `http://localhost:8000/openapi.json`

Run the example client in another terminal:

```bash
source .venv/bin/activate
python examples/client.py
```

## Docker

```bash
docker build -t algatwin-api .
docker run --rm -p 8000:8000 algatwin-api
```

Or:

```bash
docker compose up --build
```

## API use

Detailed payloads, fields, responses, authentication, and frontend examples are in [API_USAGE.md](API_USAGE.md). Model metrics and appropriate-use limits are in [MODEL_CARD.md](MODEL_CARD.md).

The shortest sensor request is:

```bash
curl -X POST http://localhost:8000/ponds/pond-01/update \
  -H 'Content-Type: application/json' \
  --data @examples/update.json
```

Then retrieve state or run a scenario:

```bash
curl http://localhost:8000/ponds/pond-01/state

curl -X POST http://localhost:8000/ponds/pond-01/scenario \
  -H 'Content-Type: application/json' \
  --data @examples/scenario.json
```

## Tests

```bash
python -m pytest -q
```

## Configuration

Copy `.env.example` to `.env` for Docker Compose, or export variables in your shell.

| Variable | Purpose | Default |
|---|---|---|
| `ALGATWIN_MODEL_DIR` | Model artifact directory | `models` relative to package root |
| `ALGATWIN_CORS_ORIGINS` | Comma-separated browser origins | localhost ports 3000 and 5173 |
| `ALGATWIN_API_KEY` | Optional shared API key | Unset; local requests are open |

When `ALGATWIN_API_KEY` is set, protected endpoints require `X-API-Key`. Health and API documentation remain public.

## Important deployment notes

- Run one Uvicorn worker with the current in-memory state design. Multiple workers would hold different pond states. Use Redis/PostgreSQL before horizontally scaling.
- Models are loaded once at startup. Do not reload joblib artifacts per request.
- Only load the included or otherwise trusted joblib files; joblib/pickle is unsafe for untrusted artifacts.
- State disappears on restart. Connect an event/state store for production.
- Confirm the source datasets' redistribution and derived-artifact terms before making a public repository. The package includes a compact ATP3-derived reference table required for normalization and scenario context.
- Every individual model artifact is below GitHub's 100 MB per-file limit. Git LFS is optional for this version but recommended if future artifacts grow.
- Core artifact hashes are recorded in `models/SHA256SUMS`; verify them with `(cd models && sha256sum -c SHA256SUMS)`.

## Repository layout

```text
alga_twin_api_package/
├── alga_twin_api/       # API, registry, state engine and inference features
├── models/              # Serialized models, metrics, manifest and reference table
├── examples/            # JSON requests and Python client
├── tests/               # API and state-isolation tests
├── .github/workflows/   # GitHub Actions test workflow
├── API_USAGE.md
├── MODEL_CARD.md
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

