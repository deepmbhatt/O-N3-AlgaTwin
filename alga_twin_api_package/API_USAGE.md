# API usage

## Authentication

Authentication is optional locally. To protect a deployed instance:

```bash
export ALGATWIN_API_KEY='replace-with-a-long-random-secret'
```

Then include the header on all endpoints except health/docs:

```bash
-H 'X-API-Key: replace-with-a-long-random-secret'
```

## Pond update

`POST /ponds/{pond_id}/update`

Use the stable feature names below. Missing numeric fields are imputed and reported through quality/confidence logic, but supplying all available values is strongly recommended.

| Field | Meaning | Typical unit |
|---|---|---|
| `site_id` | Site/domain identifier | string |
| `strain_id` | Algae strain identifier | string |
| `duration_days` | Time since experiment/batch start | days |
| `depth_cm` | Pond depth | cm |
| `nitrate_mg_l` | Nitrate | mg/L |
| `ammonium_mg_l` | Ammonium | mg/L |
| `phosphorus_mg_l` | Phosphorus | mg/L |
| `sensor_ph` | Water pH | pH |
| `water_temp_avg_c` | Mean water temperature | °C |
| `water_temp_max_c` | Maximum water temperature | °C |
| `water_temp_min_c` | Minimum water temperature | °C |
| `conductivity_reported_ms_cm` | Conductivity using the source dataset's reported label | source-reported |
| `do_mg_l` | Dissolved oxygen | mg/L |
| `do_pct_sat` | Dissolved-oxygen saturation | % |
| `salinity_g_l` | Salinity | g/L |
| `par_umol_m2_s` | Photosynthetically active radiation | µmol/m²/s |
| `air_temp_c` | Air temperature | °C |
| `relative_humidity_pct` | Relative humidity | % |
| `global_light_w_m2` | Global light energy | W/m² |
| `wind_km_h` | Wind speed | km/h |
| `precipitation_cm` | Precipitation | cm |

Example:

```bash
curl -X POST http://localhost:8000/ponds/pond-01/update \
  -H 'Content-Type: application/json' \
  --data @examples/update.json
```

The response separates provenance:

```json
{
  "pond_id": "pond-01",
  "updated_at": "2026-09-12T04:30:00+00:00",
  "measured": {
    "values": {},
    "source": "replayed_iot_daily",
    "quality_flags": []
  },
  "estimated": {
    "biomass_g_l": 0.31,
    "growth_rate_g_l_h": 0.001,
    "model_confidence": 0.72
  },
  "predicted": {
    "biomass_6h_g_l": 0.32,
    "biomass_24h_g_l": 0.31,
    "method": "direct_supervised_near_horizon_afdw_model"
  },
  "anomaly": {
    "probability": 0.24,
    "severity": "normal",
    "components": {
      "supervised_crash_risk_0_2d": 0.08,
      "unsupervised_novelty": 0.12,
      "quality_and_stress_rules": 0.20
    }
  },
  "carbon": {},
  "verified": {},
  "health": {"score": 86, "band": "healthy"}
}
```

## Current state and pond list

```bash
curl http://localhost:8000/ponds
curl http://localhost:8000/ponds/pond-01/state
```

## Scenario mode

Call update at least once before running a scenario.

```bash
curl -X POST http://localhost:8000/ponds/pond-01/scenario \
  -H 'Content-Type: application/json' \
  --data @examples/scenario.json
```

Supported controls are water temperature, pH, nitrate, phosphorus, PAR, global light, and experimental CO2. Scenario mode copies the state and never changes the observed state. CO2 results are explicitly marked as an external laboratory calibration.

## Add drone/remote verification

```bash
curl -X POST http://localhost:8000/ponds/pond-01/verify \
  -H 'Content-Type: application/json' \
  --data @examples/verification.json
```

Verification changes confidence/agreement metadata. It does not overwrite the sensor-based biomass estimate.

## Satellite reflectance prediction

```bash
curl -X POST http://localhost:8000/remote/predict \
  -H 'Content-Type: application/json' \
  --data @examples/remote.json
```

This returns estimated chlorophyll-a and turbidity. The model is calibrated on Utah Lake and must not be presented as an ATP3 pond measurement.

## Image prediction

Images are sent as base64 JSON, so no shared filesystem is required:

```bash
IMAGE_B64=$(base64 -w 0 pond.jpg)
curl -X POST http://localhost:8000/image/predict \
  -H 'Content-Type: application/json' \
  -d "{\"filename\":\"pond.jpg\",\"image_base64\":\"$IMAGE_B64\"}"
```

Maximum decoded image size is 10 MB. Supported content is JPG, PNG, or WebP. The response contains the predicted condition, confidence, and all class probabilities.

## Browser/frontend example

```javascript
const response = await fetch("http://localhost:8000/ponds/pond-01/update", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    // "X-API-Key": "your-key"
  },
  body: JSON.stringify(sensorPayload),
});

if (!response.ok) throw new Error(await response.text());
const twinState = await response.json();
console.log(twinState.health.score, twinState.predicted.biomass_6h_g_l);
```

## Error responses

- `401`: missing/invalid configured API key;
- `404`: pond has not been updated;
- `422`: invalid payload, unsupported scenario control, or invalid image.

