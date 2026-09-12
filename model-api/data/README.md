# Demonstration stream data

## Contents

- `pond_iot_stream.csv`: 999 rows, 333 per pond.
- `stream_images/`: 999 corresponding 100×100 JPEG fixtures.
- `../scripts/build_demo_stream.py`: deterministic generator.

Rows are interleaved by time step:

```text
time_step 1 -> pond-01, pond-02, pond-03
time_step 2 -> pond-01, pond-02, pond-03
...
time_step 333 -> pond-01, pond-02, pond-03
```

The default API burst therefore returns all three ponds at the same demonstration timestamp.

## Gradual trajectories

| Pond | Trajectory |
|---|---|
| `pond-01` | Stable with smooth diurnal temperature/light movement |
| `pond-02` | Normal to heat/low-oxygen stress, critical stage, partial recovery |
| `pond-03` | Normal to nutrient/light limitation, then recovery |

Continuous variables use smooth curves. Tests enforce small step-to-step temperature and dissolved-oxygen changes.

## Provenance

The numeric sensor/satellite sequence is synthetic demonstration data. Images are copied from the Fishpond Visual Condition Dataset v2.0 and selected by condition class. Their association to numeric rows is synthetic; it is not a synchronized real-world observation.

Relevant CSV fields:

- `record_provenance=synthetic_gradual_stream`;
- `image_provenance=fishpond_visual_condition_v2_fixture`;
- `association_provenance=synthetic_condition_matched_mapping`;
- `image_condition_expected` records the mapping class.

These labels are returned to clients so demonstrations cannot be confused with field measurements. Confirm source-data redistribution rights before publishing images publicly.

## Rebuilding

From the standalone package inside the parent project:

```bash
python scripts/build_demo_stream.py
```

The source visual dataset must be present beside `alga_twin_api_package`. Runtime deployments do not need the source dataset because all selected images are already copied into `data/stream_images/`.
