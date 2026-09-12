# Included model artifacts

The API loads these trusted, read-only files once at process startup:

| File | Purpose |
|---|---|
| `atp3_biomass_model.joblib` | Current AFDW biomass estimate |
| `biomass_forecast_models.joblib` | Near-6-hour forecast and gated 24-hour candidate |
| `anomaly_models.joblib` | Crash risk, novelty and sensor-quality signals |
| `image_condition_model.joblib` | Fishpond image condition classification |
| `remote_verification_models.joblib` | Reflectance-to-chlorophyll-a/turbidity estimates |
| `co2_growth_model.joblib` | Experimental CO2 response model and metadata |
| `atp3_biomass_master.csv` | Compact reference data used for normalization/context |
| `model_manifest.json` | Machine-readable model inventory and acceptance status |
| `*_metrics.json` | Validation metrics; not required for inference |
| `co2_scenario_calibration.json` | Bounded runtime CO2 scenario calibration |

Do not replace a `.joblib` file with an untrusted download. Joblib uses Python pickle semantics and can execute code during loading. Retraining and evaluation notebooks remain in the parent AlgaTwin project; this folder is intentionally inference-only.

