# API usage

Local base URL: `http://localhost:8000`

All model inputs and outputs use JSON. Set `ALGATWIN_API_KEY` and send `X-API-Key` when authentication is enabled.

## POST /predict

Cron calls this stateful endpoint to consume the next circular CSV rows.

```json
{
  "batch_size": 3,
  "include_images": true,
  "return_image_base64": true
}
```

Options:

| Field | Default | Meaning |
|---|---:|---|
| `batch_size` | 3 | Rows to process, 1–100 |
| `reset` | false | Rewind to row 1 and clear model histories |
| `include_images` | true | Load and classify each row's mapped image |
| `return_image_base64` | true | Include displayable image bytes in JSON |
| `images_by_pond` | {} | Optional base64 images overriding mapped fixtures |

Override example:

```json
{
  "batch_size": 3,
  "images_by_pond": {
    "pond-01": {
      "filename": "current.jpg",
      "image_base64": "BASE64_DATA"
    }
  }
}
```

Response:

```json
{
  "data": [
    {
      "pond_id": "pond-01",
      "observed_at": "2026-09-12T10:00:00+05:30",
      "stream_row": 1,
      "stream_cycle": 0,
      "source_data": {
        "iot_data": {},
        "satellite_data": {},
        "image": {
          "filename": "pond-01-step-001.jpg",
          "expected_condition": "OPTIMUM",
          "image_provenance": "fishpond_visual_condition_v2_fixture",
          "association_provenance": "synthetic_condition_matched_mapping",
          "base64": "..."
        }
      },
      "dashboard": {
        "current_biomass_g_l": 0.31,
        "biomass_6h_g_l": 0.28,
        "biomass_24h_g_l": 0.31,
        "health_score": 86,
        "health_band": "healthy",
        "anomaly_probability": 0.24,
        "anomaly_severity": "normal",
        "chlorophyll_a": 24.2,
        "turbidity": 5.8,
        "image_state": "OPTIMUM",
        "image_confidence": 0.81
      },
      "insights": [],
      "results": {
        "digital_twin": {},
        "satellite": {},
        "image": {}
      }
    }
  ],
  "cursor": {
    "start_row": 1,
    "next_row": 4,
    "batch_size": 3,
    "total_rows": 999,
    "cycle": 0,
    "restarted": false,
    "mode": "circular"
  }
}
```

For Axios, the pond array is `response.data.data`. Avoid overlapping cron executions.

## POST /simulate

Uses the latest streamed baseline for one pond. It does not advance the cursor or change live state.

```json
{
  "pond_id": "pond-02",
  "changes": {
    "water_temp_avg_c": 27.5,
    "nitrate_mg_l": 50,
    "global_light_w_m2": 280,
    "co2_ppm": 900
  },
  "image_data": {
    "filename": "uploaded-current-view.jpg",
    "image_base64": "BASE64_DATA"
  }
}
```

`image_data` is optional. Without it, the latest streamed image result is returned. Image classification is supporting evidence only and does not causally change simulated biomass.

Response is under `data` and includes:

- `baseline_source_data`;
- `dashboard` including simulated values;
- `insights`;
- full `baseline` and `simulation`;
- satellite and image results;
- `live_state_changed: false`;
- `cursor_advanced: false`.

Call `/predict` at least once for the chosen pond before simulation.

## GET /dashboard

Read-only endpoint. It never advances the stream.

All ponds:

```http
GET /dashboard?limit=20
```

One pond:

```http
GET /dashboard?pond_id=pond-02&limit=50
```

Response:

```json
{
  "data": [
    {
      "pond_id": "pond-02",
      "latest": {},
      "history": [],
      "returned_history_count": 20,
      "latest_simulation": {},
      "simulation_history": []
    }
  ],
  "query": {
    "pond_id": null,
    "limit": 20
  },
  "cursor": {
    "position": 6,
    "cycle": 0
  }
}
```

The frontend should use:

- `latest.source_data.iot_data` for current sensor values;
- `history` for charts;
- `latest.dashboard` for prediction cards;
- `latest.insights` for alerts;
- `latest.source_data.image.base64` for the current image;
- `latest_simulation` for the last scenario.

## Cron example

```javascript
async function runAlgaTwinBurst() {
  const response = await axios.post(
    process.env.ALGATWIN_URL + "/predict",
    {
      batch_size: 3,
      include_images: true,
      return_image_base64: true
    },
    {
      headers: {
        "X-API-Key": process.env.ALGATWIN_API_KEY
      },
      timeout: 30000
    }
  );

  const updates = response.data.data;
  publishToDashboardClients(updates);
  return updates;
}
```

The default hackathon runtime keeps a bounded history in memory and requires no MongoDB. Optional persistence is used only when ALGATWIN_MONGODB_URI is explicitly configured.

## Frontend example

```javascript
const response = await fetch("/algatwin/dashboard?pond_id=pond-02&limit=50");
const payload = await response.json();
const pond = payload.data[0];

renderSensors(pond.latest.source_data.iot_data);
renderPredictionCards(pond.latest.dashboard);
renderInsights(pond.latest.insights);
renderHistory(pond.history);
renderImage(
  "data:image/jpeg;base64," + pond.latest.source_data.image.base64
);
```

## Errors

- `401`: missing or invalid API key;
- `404`: unknown dashboard pond or simulation before prediction;
- `422`: invalid batch, model input, image or scenario change;
- `503`: simulation completed but persistence failed.

Maximum decoded submitted image size is 10 MB. JPG, PNG and WebP are supported.

## GET /ponds/{pond_id}/ai-insights

Returns the decision package built from the latest real model output. It is read-only: any candidate actions are evaluated through /simulate and never alter the cursor or live state.

~~~http
GET /ponds/pond-01/ai-insights
GET /ponds/pond-01/ai-insights?optimize=true
~~~

The response contains:

- state: compact digital-twin evidence with measured, estimated, predicted and verified provenance;
- insight: current decision mode (RECOVER, VERIFY, STABILIZE, MAINTAIN or OPTIMIZE) and findings;
- action: tested candidate count, ranked scenario result, confidence and live_state_changed: false.

A recommendation is returned only when a tested candidate clears the configured improvement threshold.

## GET /ponds/{pond_id}/mrv

Builds a transparent carbon MRV estimate from the latest model-derived uptake rate and caller-supplied accounting boundary.

~~~http
GET /ponds/pond-01/mrv?pond_volume_m3=1000&window_hours=24&operational_emissions_kg=2.5&permanence_factor=0.9
~~~

This response includes gross modeled capture, operational emissions, permanence adjustment, net estimated claim, confidence factors and model/stream provenance. It is explicitly estimated_not_registry_verified; it does not issue or certify carbon credits.

## POST /assistant/chat

Aoi explains the current pond evidence and the scenario-ranked action. It cannot create measurements, override model outputs or execute interventions.

~~~json
{
  "pond_id": "pond-01",
  "message": "Why is this pond stressed and what should I do?"
}
~~~

Response shape:

~~~json
{
  "answer": "Grounded explanation...",
  "provider": "gemini",
  "intent": "explain",
  "based_on": ["measured_iot", "model_estimated", "model_predicted"],
  "recommended_action": null,
  "action_state": "STABILIZE",
  "evidence": {}
}
~~~

Without a Gemini key, provider is deterministic and the endpoint remains fully usable.

## Gemini configuration

Keep the key in the model API process, never in the browser bundle:

~~~bash
cp .env.example .env
# Edit .env
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-3.8-flash
~~~

From the repository root, scripts/dev.sh automatically loads model-api/.env. Gemini is an explanation layer only; the digital twin and non-mutating simulator remain the source of state and action ranking.
