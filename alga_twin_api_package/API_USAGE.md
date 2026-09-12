# Two-endpoint API usage

Base URL during local development:

```text
http://localhost:8000
```

All inputs and outputs use JSON.

## 1. Prediction endpoint

`POST /predict`

Use this endpoint for incoming IoT readings, satellite reflectance, a pond image, or any combination of them.

### Request shape

```json
{
  "pond_id": "pond-01",
  "observed_at": "2026-09-12T10:00:00+05:30",
  "iot_data": {
    "site_id": "ASU",
    "strain_id": "KA32",
    "sensor_ph": 8.2,
    "water_temp_avg_c": 28.4,
    "do_mg_l": 7.8,
    "nitrate_mg_l": 45,
    "phosphorus_mg_l": 3.1,
    "global_light_w_m2": 320
  },
  "satellite_data": {
    "red": 0.10,
    "green": 0.16,
    "blue": 0.12,
    "RE1": 0.11,
    "latitude": 40.15,
    "longitude": -111.86,
    "dataset": "whole-lake",
    "category": "whole-lake"
  }
}
```

At least one of `iot_data`, `satellite_data`, or `image_data` is required. For an image, add:

```json
{
  "image_data": {
    "filename": "pond.jpg",
    "image_base64": "BASE64_ENCODED_IMAGE"
  }
}
```

The satellite `date` field is optional and defaults to `observed_at`. `dataset` and `category` default to `custom`. Latitude, longitude and four reflectance bands are required when satellite data is supplied.

### Response shape

```json
{
  "request_type": "prediction",
  "pond_id": "pond-01",
  "observed_at": "2026-09-12T10:00:00+05:30",
  "dashboard": {
    "current_biomass_g_l": 0.31,
    "biomass_6h_g_l": 0.32,
    "biomass_24h_g_l": 0.31,
    "health_score": 86.0,
    "health_band": "healthy",
    "anomaly_probability": 0.24,
    "anomaly_severity": "normal",
    "gross_co2_uptake_rate_g_l_h": 0.001,
    "chlorophyll_a": 24.2,
    "turbidity": 5.8
  },
  "results": {
    "digital_twin": {},
    "satellite": {},
    "image": null
  }
}
```

Values for omitted input types are `null`. Sending repeated IoT observations with the same `pond_id` maintains that pond's in-memory history.

Example:

```bash
curl -X POST http://localhost:8000/predict \
  -H 'Content-Type: application/json' \
  --data @examples/predict.json
```

## 2. Simulation endpoint

`POST /simulate`

This endpoint is self-contained: send a custom baseline and the changes you want to test. It does not require an earlier prediction call and does not alter live pond state.

### Request shape

```json
{
  "pond_id": "pond-01-scenario",
  "observed_at": "2026-09-12T10:00:00+05:30",
  "baseline_iot_data": {
    "site_id": "ASU",
    "strain_id": "KA32",
    "sensor_ph": 8.2,
    "water_temp_avg_c": 28.4,
    "do_mg_l": 7.8,
    "nitrate_mg_l": 45,
    "phosphorus_mg_l": 3.1,
    "global_light_w_m2": 320
  },
  "changes": {
    "water_temp_avg_c": 27.5,
    "nitrate_mg_l": 70,
    "global_light_w_m2": 280,
    "co2_ppm": 900
  }
}
```

Supported scenario controls are water temperature, pH, nitrate, phosphorus, PAR, global light and experimental CO2. Optional `satellite_data` uses the same structure as `/predict`.

### Response shape

```json
{
  "request_type": "simulation",
  "pond_id": "pond-01-scenario",
  "dashboard": {},
  "baseline": {},
  "simulation": {
    "provenance": "simulated",
    "current_biomass_g_l": 0.31,
    "simulated_biomass_g_l": 0.34,
    "biomass_delta_g_l": 0.03,
    "relative_biomass_delta_pct": 9.68,
    "simulated_health_score": 89.0,
    "classification": "beneficial"
  },
  "satellite": null,
  "live_state_changed": false
}
```

Example:

```bash
curl -X POST http://localhost:8000/simulate \
  -H 'Content-Type: application/json' \
  --data @examples/simulate.json
```

## Frontend example

```javascript
const response = await fetch("http://localhost:8000/predict", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    // "X-API-Key": "your-key"
  },
  body: JSON.stringify(sensorAndSatellitePayload)
});

if (!response.ok) throw new Error(await response.text());

const data = await response.json();
setDashboard(data.dashboard);
```

## Authentication and errors

Set `ALGATWIN_API_KEY` to protect both workflow endpoints, then send `X-API-Key`.

- `401`: missing or invalid API key;
- `422`: invalid input, no prediction data, unsupported simulation control, or invalid image;
- `500`: unexpected server failure.

Operational routes:

- `GET /health` checks model readiness;
- `GET /models` returns the model manifest;
- `GET /docs` provides interactive Swagger documentation.
