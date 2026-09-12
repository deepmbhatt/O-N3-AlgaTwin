"""Build the deterministic 999-row/999-image demonstration stream."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
import math
import shutil

import pandas as pd


PACKAGE_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = PACKAGE_ROOT.parent / "Fishpond Visual Condition Dataset v2.0"
OUTPUT_CSV = PACKAGE_ROOT / "data" / "pond_iot_stream.csv"
OUTPUT_IMAGES = PACKAGE_ROOT / "data" / "stream_images"
STEPS = 333


def smoothstep(value: float) -> float:
    value = min(1.0, max(0.0, value))
    return value * value * (3.0 - 2.0 * value)


def pond_severity(pond_id: str, fraction: float) -> float:
    if pond_id == "pond-01":
        return 0.06 + 0.04 * (1 + math.sin(4 * math.pi * fraction)) / 2
    if pond_id == "pond-02":
        if fraction <= 0.68:
            return 0.08 + 0.92 * smoothstep(fraction / 0.68)
        return 1.0 - 0.72 * smoothstep((fraction - 0.68) / 0.32)
    if fraction <= 0.58:
        return 0.10 + 0.78 * smoothstep(fraction / 0.58)
    return 0.88 - 0.68 * smoothstep((fraction - 0.58) / 0.42)


def visual_state(pond_id: str, severity: float) -> str:
    if pond_id == "pond-01":
        return "OPTIMUM"
    if pond_id == "pond-02":
        if severity < 0.20:
            return "OPTIMUM"
        if severity < 0.62:
            return "HIGH_PH"
        return "HIGH_PH; HIGH_TEMP"
    if severity < 0.25:
        return "OPTIMUM"
    return "LOW_TEMP;HIGH_PH"


def condition_label(pond_id: str, severity: float) -> str:
    if pond_id == "pond-01":
        return "stable"
    stage = "normal" if severity < 0.20 else "watch" if severity < 0.45 else "stressed" if severity < 0.75 else "critical"
    cause = "heat_low_oxygen" if pond_id == "pond-02" else "nutrient_light_limited"
    return f"{cause}_{stage}"


def image_pools() -> dict[str, list[tuple[str, Path]]]:
    manifest = pd.read_csv(SOURCE_ROOT / "pond_dataset.csv")
    pools: dict[str, list[tuple[str, Path]]] = {}
    for row in manifest.itertuples(index=False):
        source_id = str(row.images)
        path = SOURCE_ROOT / "images" / f"{source_id}.jpg"
        if path.exists():
            pools.setdefault(str(row.State), []).append((source_id, path))
    needed = {"OPTIMUM", "HIGH_PH", "HIGH_PH; HIGH_TEMP", "LOW_TEMP;HIGH_PH"}
    missing = needed - set(pools)
    if missing:
        raise RuntimeError(f"Missing visual-condition pools: {sorted(missing)}")
    return pools


def build() -> None:
    pools = image_pools()
    OUTPUT_IMAGES.mkdir(parents=True, exist_ok=True)
    start = datetime(2026, 9, 12, 10, 0, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    profiles = [
        ("pond-01", "ASU", "KA32", 25.0, 32.0),
        ("pond-02", "CP", "LRB-AZ-1201", 22.0, 35.0),
        ("pond-03", "FA", "C046", 28.0, 25.0),
    ]
    pool_positions = {state: 0 for state in pools}
    rows: list[dict] = []

    for step in range(STEPS):
        fraction = step / (STEPS - 1)
        observed_at = start + timedelta(seconds=10 * step)
        daylight = (1 + math.sin(2 * math.pi * fraction - math.pi / 2)) / 2
        for pond_id, site_id, strain_id, depth, salinity in profiles:
            severity = pond_severity(pond_id, fraction)
            state = visual_state(pond_id, severity)
            source_id, source_path = pools[state][pool_positions[state] % len(pools[state])]
            pool_positions[state] += 1
            output_name = f"{pond_id}-step-{step + 1:03d}.jpg"
            shutil.copy2(source_path, OUTPUT_IMAGES / output_name)

            if pond_id == "pond-01":
                temperature = 26.0 + 1.2 * daylight + 0.2 * math.sin(6 * math.pi * fraction)
                ph = 8.05 + 0.18 * daylight
                oxygen = 8.6 - 0.5 * daylight
                nitrate = 55.0 - 8.0 * fraction
                phosphorus = 3.2 - 0.4 * fraction
                light = 220.0 + 260.0 * daylight
            elif pond_id == "pond-02":
                temperature = 27.0 + 9.0 * severity
                ph = 8.05 + 1.45 * severity
                oxygen = 8.2 - 5.9 * severity
                nitrate = 45.0 - 37.0 * severity
                phosphorus = 2.8 - 2.0 * severity
                light = 260.0 + 330.0 * severity
            else:
                temperature = 25.0 - 5.0 * severity
                ph = 8.0 + 1.0 * severity
                oxygen = 7.7 - 2.0 * severity
                nitrate = 38.0 - 36.5 * severity
                phosphorus = 2.6 - 2.45 * severity
                light = 310.0 - 255.0 * severity

            red = 0.09 + 0.07 * severity
            green = 0.17 - 0.06 * severity
            blue = 0.12 - 0.035 * severity
            red_edge = 0.14 - 0.035 * severity
            rows.append({
                "observed_at": observed_at.isoformat(),
                "time_step": step + 1,
                "pond_id": pond_id,
                "condition_label": condition_label(pond_id, severity),
                "condition_severity": round(severity, 5),
                "record_provenance": "synthetic_gradual_stream",
                "site_id": site_id,
                "strain_id": strain_id,
                "duration_days": round(12 + step / 8640, 6),
                "depth_cm": depth,
                "nitrate_mg_l": round(max(0.1, nitrate), 4),
                "ammonium_mg_l": round(max(0.02, 0.5 - 0.35 * severity), 4),
                "phosphorus_mg_l": round(max(0.05, phosphorus), 4),
                "sensor_ph": round(ph, 4),
                "water_temp_avg_c": round(temperature, 4),
                "water_temp_max_c": round(temperature + 2.0 + daylight, 4),
                "water_temp_min_c": round(temperature - 1.8, 4),
                "conductivity_reported_ms_cm": round(39000 + salinity * 280 + severity * 1800, 2),
                "do_mg_l": round(max(1.5, oxygen), 4),
                "do_pct_sat": round(max(25, oxygen * 13), 3),
                "salinity_g_l": salinity,
                "par_umol_m2_s": round(max(20, light * 1.3), 3),
                "air_temp_c": round(temperature + 2.2, 4),
                "relative_humidity_pct": round(72 - 28 * severity, 3),
                "global_light_w_m2": round(max(20, light), 3),
                "wind_km_h": round(3 + 9 * severity, 3),
                "precipitation_cm": round(0.15 * max(0, math.sin(8 * math.pi * fraction)), 4),
                "satellite_red": round(red, 6),
                "satellite_green": round(green, 6),
                "satellite_blue": round(blue, 6),
                "satellite_RE1": round(red_edge, 6),
                "latitude": 40.15 + {"pond-01": 0, "pond-02": 0.01, "pond-03": -0.01}[pond_id],
                "longitude": -111.86 + {"pond-01": 0, "pond-02": 0.01, "pond-03": -0.01}[pond_id],
                "dataset": "whole-lake",
                "category": "whole-lake",
                "image_path": f"stream_images/{output_name}",
                "image_source_id": source_id,
                "image_condition_expected": state,
                "image_provenance": "fishpond_visual_condition_v2_fixture",
                "association_provenance": "synthetic_condition_matched_mapping",
            })

    frame = pd.DataFrame(rows)
    frame.to_csv(OUTPUT_CSV, index=False)
    print(f"Wrote {len(frame)} rows to {OUTPUT_CSV}")
    print(f"Wrote {len(list(OUTPUT_IMAGES.glob('*.jpg')))} images to {OUTPUT_IMAGES}")


if __name__ == "__main__":
    build()
