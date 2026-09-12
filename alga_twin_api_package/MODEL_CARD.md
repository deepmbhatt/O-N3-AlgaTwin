# AlgaTwin model card

## Inventory

The API loads six artifact families containing nine logical estimators.

| Model | Validation | Result | Runtime use |
|---|---|---|---|
| Current AFDW biomass | Held-out ATP3 experiments | MAE 0.0692 g/L; R² 0.280 | Active |
| Near-6h biomass | Held-out ATP3 experiments; target ±2h | MAE 0.0563; persistence MAE 0.1312 | Active |
| Near-24h biomass | Held-out ATP3 experiments; target ±2h | MAE 0.0579; persistence MAE 0.0567 | Trained but gated off; persistence fallback |
| Crash risk | Held-out ATP3 experiments | ROC-AUC 0.675; AP 0.067 vs 0.030 prevalence | Active as one warning component |
| Isolation Forest novelty | ATP3 non-crash reference envelope | Unsupervised | Active as one warning component |
| Image condition | Source-photo-grouped validation | Accuracy 0.684 vs 0.545 majority; macro-F1 0.385 | Supporting evidence |
| Satellite chlorophyll | Future-date Utah Lake holdout | R² 0.995 | Utah Lake remote pathway only |
| Satellite turbidity | Future-date Utah Lake holdout | R² 0.916 | Utah Lake remote pathway only |
| CO2 next-day growth | Leave-one-experiment-out lab study | R² -0.541 | Direct model gated off; bounded empirical contrast only |

Exact machine-readable metrics are in `models/model_manifest.json` and the `*_metrics.json` files.

## Intended use

- Hackathon demonstrations and decision-support prototypes.
- Continuous CPU inference for one or a small number of algae ponds.
- State replay, anomaly triage, scenario comparison, and visualization inputs.
- Research starting point for pond-specific recalibration.

## Inappropriate use

- Autonomous actuator control without human review and safety limits.
- Regulatory carbon-credit/MRV claims.
- Claiming Utah Lake satellite output directly verifies an ATP3 pond.
- Treating missing crash annotations as confirmed healthy labels.
- Presenting scenario associations as causal intervention guarantees.
- Applying the models to new species, sites, units, or sensor calibrations without validation.

## Known limitations

- ATP3 has no CO2 telemetry.
- Biomass labels are sampled rather than continuously measured.
- Crash labels are sparse.
- Image classes are imbalanced and originate from few independent photos.
- Satellite inputs/labels may share upstream derivation.
- Conductivity units in the source data require confirmation.
- The 24-hour and direct CO2 models failed their deployment gates.

## Runtime profile

Measured on the development machine with models loaded once:

| Operation | Median | p95 |
|---|---:|---:|
| Full twin update | 560 ms | 736 ms |
| Scenario | 169 ms | 235 ms |
| Image | 210 ms | 261 ms |
| Satellite | 16 ms | 17 ms |

Model artifacts total approximately 76 MB; registry startup is approximately 0.44 seconds on the development machine. Performance varies by hardware and concurrency.

## Version and security

The artifacts use joblib/pickle serialization. Only load trusted files. Dependencies are pinned because scikit-learn does not guarantee cross-version model compatibility.

