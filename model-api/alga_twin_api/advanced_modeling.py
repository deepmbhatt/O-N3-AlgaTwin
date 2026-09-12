"""Training utilities for AlgaTwin forecasting, anomaly, image, and CO2 models."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from PIL import Image
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import IsolationForest, RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    balanced_accuracy_score,
    classification_report,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    roc_auc_score,
)
from sklearn.model_selection import GroupShuffleSplit, StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, OneHotEncoder, RobustScaler

from .modeling import ATP3_CATEGORICAL_FEATURES, ATP3_FEATURES, ATP3_NUMERIC_FEATURES


FORECAST_CATEGORICAL_FEATURES = ATP3_CATEGORICAL_FEATURES
FORECAST_NUMERIC_FEATURES = ["current_afdw_g_l", "actual_horizon_h", *ATP3_NUMERIC_FEATURES]
FORECAST_FEATURES = FORECAST_CATEGORICAL_FEATURES + FORECAST_NUMERIC_FEATURES

ANOMALY_CATEGORICAL_FEATURES = ["site_id", "pond_id", "strain_id"]
ANOMALY_BASE_NUMERIC_FEATURES = [
    "sensor_ph",
    "water_temp_avg_c",
    "water_temp_max_c",
    "water_temp_min_c",
    "conductivity_reported_ms_cm",
    "do_mg_l",
    "do_pct_sat",
    "salinity_g_l",
    "par_umol_m2_s",
    "air_temp_c",
    "relative_humidity_pct",
    "global_light_w_m2",
    "wind_km_h",
    "precipitation_cm",
]
ANOMALY_TREND_BASES = ["sensor_ph", "water_temp_avg_c", "do_mg_l", "do_pct_sat", "salinity_g_l"]
ANOMALY_TREND_FEATURES = [f"{column}_delta_1d" for column in ANOMALY_TREND_BASES] + [
    f"{column}_rolling3_std" for column in ANOMALY_TREND_BASES
]
ANOMALY_NUMERIC_FEATURES = ANOMALY_BASE_NUMERIC_FEATURES + ANOMALY_TREND_FEATURES + [
    "day_of_year_sin",
    "day_of_year_cos",
]
ANOMALY_FEATURES = ANOMALY_CATEGORICAL_FEATURES + ANOMALY_NUMERIC_FEATURES

CO2_CATEGORICAL_FEATURES = ["medium", "light"]
CO2_NUMERIC_FEATURES = ["day", "co2_ppm", "current_cell_density", "current_ph"]
CO2_FEATURES = CO2_CATEGORICAL_FEATURES + CO2_NUMERIC_FEATURES


@dataclass
class ForecastTrainingResult:
    models: dict[int, Pipeline]
    metrics: dict[str, Any]
    predictions: pd.DataFrame
    pairs: pd.DataFrame


@dataclass
class AnomalyTrainingResult:
    bundle: dict[str, Any]
    metrics: dict[str, Any]
    predictions: pd.DataFrame
    table: pd.DataFrame


@dataclass
class ImageTrainingResult:
    bundle: dict[str, Any]
    metrics: dict[str, Any]
    predictions: pd.DataFrame
    manifest: pd.DataFrame


@dataclass
class CO2TrainingResult:
    bundle: dict[str, Any]
    metrics: dict[str, Any]
    transitions: pd.DataFrame


def _regression_metrics(y_true, prediction, baseline) -> dict[str, float]:
    return {
        "mae": float(mean_absolute_error(y_true, prediction)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, prediction))),
        "r2": float(r2_score(y_true, prediction)),
        "persistence_mae": float(mean_absolute_error(y_true, baseline)),
        "persistence_rmse": float(np.sqrt(mean_squared_error(y_true, baseline))),
    }


def _tabular_preprocessor(numeric: list[str], categorical: list[str]) -> ColumnTransformer:
    return ColumnTransformer(
        [
            (
                "numeric",
                SimpleImputer(strategy="median", add_indicator=True, keep_empty_features=True),
                numeric,
            ),
            (
                "categorical",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("one_hot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
                    ]
                ),
                categorical,
            ),
        ]
    )


def _nearest_future_pairs(events: pd.DataFrame, horizon_h: int, tolerance_h: int) -> pd.DataFrame:
    keys = ["experiment_id", "site_id", "pond_id", "strain_id"]
    records: list[dict[str, Any]] = []
    for _, group in events.groupby(keys, dropna=False):
        group = group.sort_values("timestamp").reset_index(drop=True)
        times = group["timestamp"].to_numpy(dtype="datetime64[ns]")
        values = group["current_afdw_g_l"].to_numpy(dtype=float)
        for index, timestamp in enumerate(times):
            differences = (times - timestamp) / np.timedelta64(1, "h")
            candidates = np.flatnonzero(
                (differences >= horizon_h - tolerance_h)
                & (differences <= horizon_h + tolerance_h)
            )
            if not len(candidates):
                continue
            chosen = candidates[np.argmin(np.abs(differences[candidates] - horizon_h))]
            record = group.iloc[index].to_dict()
            record.update(
                {
                    "horizon_h": horizon_h,
                    "actual_horizon_h": float(differences[chosen]),
                    "future_afdw_g_l": float(values[chosen]),
                    "future_timestamp": pd.Timestamp(times[chosen]),
                }
            )
            records.append(record)
    return pd.DataFrame(records)


def build_forecast_pairs(root: str | Path, master: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Create directly supervised near-6h and near-24h AFDW transitions."""
    root = Path(root)
    operational = pd.read_csv(root / "ATP3-UFS-PondOperationalData.csv", low_memory=False, na_values=["NA", ""])
    operational["timestamp"] = pd.to_datetime(operational["DATETIME"], errors="coerce")
    operational["current_afdw_g_l"] = pd.to_numeric(operational["AFDW.g.L"], errors="coerce")
    operational = operational[
        operational["timestamp"].notna()
        & operational["current_afdw_g_l"].ge(0)
        & operational["PondID"].ne("inoc")
    ].copy()
    operational = operational.rename(
        columns={
            "ExperimentID": "experiment_id",
            "SiteID": "site_id",
            "PondID": "pond_id",
            "StrainID": "strain_id",
        }
    )
    event_keys = ["experiment_id", "site_id", "pond_id", "strain_id", "timestamp"]
    events = operational.groupby(event_keys, dropna=False, as_index=False)["current_afdw_g_l"].mean()
    events["date"] = events["timestamp"].dt.normalize()

    safe_master = master.drop(columns=["afdw_g_l", "source_target_rows", "instrument_join", "weather_join"], errors="ignore")
    join_keys = ["experiment_id", "site_id", "pond_id", "strain_id", "date"]
    events = events.merge(safe_master, on=join_keys, how="left", validate="many_to_one")
    six = _nearest_future_pairs(events, horizon_h=6, tolerance_h=2)
    day = _nearest_future_pairs(events, horizon_h=24, tolerance_h=2)
    pairs = pd.concat([six, day], ignore_index=True).sort_values(
        ["horizon_h", "experiment_id", "site_id", "pond_id", "timestamp"]
    )
    report = {
        "resolved_afdw_events": int(len(events)),
        "six_hour_pairs": int(len(six)),
        "six_hour_actual_range": [float(six.actual_horizon_h.min()), float(six.actual_horizon_h.max())],
        "twenty_four_hour_pairs": int(len(day)),
        "twenty_four_hour_actual_range": [float(day.actual_horizon_h.min()), float(day.actual_horizon_h.max())],
        "experiments": int(pairs.experiment_id.nunique()),
    }
    return pairs.reset_index(drop=True), report


def train_forecast_models(pairs: pd.DataFrame, random_state: int = 42) -> ForecastTrainingResult:
    """Evaluate on held-out experiments and then fit deployable models on all pairs."""
    models: dict[int, Pipeline] = {}
    metrics: dict[str, Any] = {"split": "grouped by experiment_id"}
    predictions: list[pd.DataFrame] = []
    for horizon in [6, 24]:
        data = pairs[pairs["horizon_h"] == horizon].dropna(subset=["future_afdw_g_l"]).copy()
        selected = None
        for seed in range(random_state, random_state + 100):
            splitter = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=seed)
            train_index, test_index = next(splitter.split(data, groups=data["experiment_id"]))
            if len(data.iloc[train_index]) >= 100 and len(data.iloc[test_index]) >= 40:
                selected = train_index, test_index
                break
        if selected is None:
            raise RuntimeError(f"Could not form a valid grouped split for {horizon}h")
        train_index, test_index = selected
        train, test = data.iloc[train_index], data.iloc[test_index]

        def make_model() -> Pipeline:
            return Pipeline(
                [
                    ("preprocess", _tabular_preprocessor(FORECAST_NUMERIC_FEATURES, FORECAST_CATEGORICAL_FEATURES)),
                    (
                        "regressor",
                        RandomForestRegressor(
                            n_estimators=420,
                            max_depth=14,
                            min_samples_leaf=3,
                            max_features=0.8,
                            n_jobs=-1,
                            oob_score=True,
                            random_state=random_state + horizon,
                        ),
                    ),
                ]
            )

        evaluation_model = make_model()
        evaluation_model.fit(train[FORECAST_FEATURES], train["future_afdw_g_l"])
        raw_prediction = np.clip(evaluation_model.predict(test[FORECAST_FEATURES]), 0, None)
        persistence = test["current_afdw_g_l"].to_numpy()
        oob_prediction = evaluation_model.named_steps["regressor"].oob_prediction_
        train_persistence = train["current_afdw_g_l"].to_numpy()
        blend_grid = np.linspace(0, 1, 21)
        oob_rmse = [
            np.sqrt(mean_squared_error(
                train["future_afdw_g_l"],
                train_persistence * (1 - weight) + oob_prediction * weight,
            ))
            for weight in blend_grid
        ]
        model_weight = float(blend_grid[int(np.argmin(oob_rmse))])
        prediction = persistence * (1 - model_weight) + raw_prediction * model_weight
        horizon_metrics = _regression_metrics(test["future_afdw_g_l"], prediction, persistence)
        horizon_metrics["raw_model"] = _regression_metrics(
            test["future_afdw_g_l"], raw_prediction, persistence
        )
        horizon_metrics.update(
            {
                "train_rows": int(len(train)),
                "test_rows": int(len(test)),
                "train_experiments": sorted(train.experiment_id.unique().tolist()),
                "held_out_experiments": sorted(test.experiment_id.unique().tolist()),
                "actual_horizon_median_h": float(test.actual_horizon_h.median()),
                "model_weight_selected_from_training_oob": model_weight,
            }
        )
        runtime_weight = model_weight if horizon_metrics["rmse"] < horizon_metrics["persistence_rmse"] else 0.0
        horizon_metrics["runtime_model_weight_after_holdout_gate"] = runtime_weight
        horizon_metrics["runtime_status"] = (
            "accepted" if runtime_weight > 0 else "rejected_model_using_persistence_fallback"
        )
        metrics[f"{horizon}h"] = horizon_metrics
        frame = test[["timestamp", "experiment_id", "site_id", "pond_id", "current_afdw_g_l", "future_afdw_g_l"]].copy()
        frame["horizon_h"] = horizon
        frame["raw_model_future_afdw_g_l"] = raw_prediction
        frame["predicted_future_afdw_g_l"] = prediction
        predictions.append(frame)

        final_model = make_model()
        final_model.fit(data[FORECAST_FEATURES], data["future_afdw_g_l"])
        models[horizon] = {
            "model": final_model,
            "model_weight": runtime_weight,
            "research_oob_weight": model_weight,
            "runtime_status": horizon_metrics["runtime_status"],
        }
    return ForecastTrainingResult(models, metrics, pd.concat(predictions, ignore_index=True), pairs)


def build_anomaly_table(root: str | Path, precrash_days: int = 2) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Build daily sensor/trend rows labeled for a crash within the next N days."""
    root = Path(root)
    sensors = pd.read_csv(root / "ATP3-UFS-Instrumentation-daily.csv", low_memory=False, na_values=["NA", ""])
    sensors["date"] = pd.to_datetime(sensors["Date"], errors="coerce").dt.normalize()
    sensors = sensors.rename(
        columns={
            "ExperimentID": "experiment_id",
            "SiteID": "site_id",
            "PondID": "pond_id",
            "StrainID": "strain_id",
            "pH": "sensor_ph",
            "Temp.avg (C)": "water_temp_avg_c",
            "Temp.max (C)": "water_temp_max_c",
            "Temp.min (C)": "water_temp_min_c",
            "Cond (mS.cm)": "conductivity_reported_ms_cm",
            "DO (mg.L)": "do_mg_l",
            "DO (%sat)": "do_pct_sat",
            "Sal (g.L)": "salinity_g_l",
            "PAR (umol.m2.s)": "par_umol_m2_s",
        }
    )
    for column in ANOMALY_BASE_NUMERIC_FEATURES[:9]:
        sensors[column] = pd.to_numeric(sensors[column], errors="coerce")

    weather = pd.read_csv(root / "ATP3-UFS-Weather-daily.csv", low_memory=False, na_values=["NA", ""])
    weather["date"] = pd.to_datetime(weather["Date"], errors="coerce").dt.normalize()
    weather = weather.rename(
        columns={
            "ExperimentID": "experiment_id",
            "SiteID": "site_id",
            "StrainID": "strain_id",
            "AirTemp(C)": "air_temp_c",
            "RH(%)": "relative_humidity_pct",
            "GlobalLightEnergy(W.m2)": "global_light_w_m2",
            "WindSpeed(km.hr)": "wind_km_h",
            "Precip.tot(cm)": "precipitation_cm",
        }
    )
    weather_columns = ["air_temp_c", "relative_humidity_pct", "global_light_w_m2", "wind_km_h", "precipitation_cm"]
    for column in weather_columns:
        weather[column] = pd.to_numeric(weather[column], errors="coerce")
    weather = weather.groupby(["experiment_id", "site_id", "strain_id", "date"], as_index=False)[weather_columns].mean()
    table = sensors.merge(weather, on=["experiment_id", "site_id", "strain_id", "date"], how="left", validate="many_to_one")

    group_keys = ["experiment_id", "site_id", "pond_id", "strain_id"]
    table = table.sort_values(group_keys + ["date"]).reset_index(drop=True)
    for column in ANOMALY_TREND_BASES:
        grouped = table.groupby(group_keys, dropna=False)[column]
        table[f"{column}_delta_1d"] = grouped.diff()
        table[f"{column}_rolling3_std"] = grouped.transform(lambda values: values.rolling(3, min_periods=2).std())
    day_of_year = table.date.dt.dayofyear
    table["day_of_year_sin"] = np.sin(2 * np.pi * day_of_year / 365.25)
    table["day_of_year_cos"] = np.cos(2 * np.pi * day_of_year / 365.25)

    harvest = pd.read_csv(root / "ATP3-UFS-HarvestData.csv", low_memory=False, na_values=["NA", ""])
    harvest["date"] = pd.to_datetime(harvest["Date"], errors="coerce").dt.normalize()
    harvest["is_crash"] = harvest["crash"].fillna("").astype(str).str.strip().str.lower().eq("yes")
    crash_dates = harvest[harvest.is_crash][["ExperimentID", "SiteID", "PondID", "date"]].drop_duplicates()
    crash_lookup: dict[tuple[str, str, str], np.ndarray] = {}
    for key, group in crash_dates.groupby(["ExperimentID", "SiteID", "PondID"]):
        crash_lookup[tuple(map(str, key))] = group.date.to_numpy(dtype="datetime64[D]")

    labels = []
    days_to_crash = []
    for row in table[["experiment_id", "site_id", "pond_id", "date"]].itertuples(index=False):
        dates = crash_lookup.get((str(row.experiment_id), str(row.site_id), str(row.pond_id)), np.array([], dtype="datetime64[D]"))
        differences = (dates - np.datetime64(row.date, "D")).astype(int)
        future = differences[(differences >= 0) & (differences <= precrash_days)]
        labels.append(bool(len(future)))
        days_to_crash.append(int(future.min()) if len(future) else np.nan)
    table["crash_within_window"] = np.array(labels, dtype=int)
    table["days_to_crash"] = days_to_crash
    report = {
        "rows": int(len(table)),
        "positive_rows": int(table.crash_within_window.sum()),
        "positive_rate_pct": float(table.crash_within_window.mean() * 100),
        "precrash_window_days": precrash_days,
        "crash_events": int(len(crash_dates)),
        "experiments": int(table.experiment_id.nunique()),
    }
    return table, report


def _choose_anomaly_split(data: pd.DataFrame, random_state: int) -> tuple[np.ndarray, np.ndarray]:
    for seed in range(random_state, random_state + 500):
        splitter = GroupShuffleSplit(n_splits=1, test_size=0.27, random_state=seed)
        train_index, test_index = next(splitter.split(data, groups=data.experiment_id))
        train, test = data.iloc[train_index], data.iloc[test_index]
        if train.crash_within_window.sum() >= 30 and test.crash_within_window.sum() >= 15:
            return train_index, test_index
    raise RuntimeError("Unable to create an experiment-grouped split with crash positives on both sides")


def train_anomaly_models(table: pd.DataFrame, random_state: int = 42) -> AnomalyTrainingResult:
    """Train supervised crash-risk plus an unsupervised healthy-envelope detector."""
    data = table.dropna(subset=["date", "experiment_id"]).copy()
    train_index, test_index = _choose_anomaly_split(data, random_state)
    train, test = data.iloc[train_index], data.iloc[test_index]

    def make_classifier() -> Pipeline:
        return Pipeline(
            [
                ("preprocess", _tabular_preprocessor(ANOMALY_NUMERIC_FEATURES, ANOMALY_CATEGORICAL_FEATURES)),
                (
                    "classifier",
                    RandomForestClassifier(
                        n_estimators=520,
                        max_depth=16,
                        min_samples_leaf=3,
                        max_features=0.75,
                        class_weight="balanced_subsample",
                        n_jobs=-1,
                        random_state=random_state,
                    ),
                ),
            ]
        )

    evaluation_model = make_classifier()
    evaluation_model.fit(train[ANOMALY_FEATURES], train.crash_within_window)
    probability = evaluation_model.predict_proba(test[ANOMALY_FEATURES])[:, 1]
    # Fixed before test evaluation: favor early-warning recall for a 2-3% event rate.
    threshold = 0.10
    predicted = (probability >= threshold).astype(int)
    metrics = {
        "split": "grouped by experiment_id",
        "precrash_window_days": 2,
        "train_rows": int(len(train)),
        "test_rows": int(len(test)),
        "train_positive_rows": int(train.crash_within_window.sum()),
        "test_positive_rows": int(test.crash_within_window.sum()),
        "held_out_experiments": sorted(test.experiment_id.unique().tolist()),
        "fixed_early_warning_threshold": threshold,
        "average_precision": float(average_precision_score(test.crash_within_window, probability)),
        "roc_auc": float(roc_auc_score(test.crash_within_window, probability)),
        "f1": float(f1_score(test.crash_within_window, predicted, zero_division=0)),
        "balanced_accuracy": float(balanced_accuracy_score(test.crash_within_window, predicted)),
        "positive_prevalence_baseline_ap": float(test.crash_within_window.mean()),
        "classification_report": classification_report(test.crash_within_window, predicted, output_dict=True, zero_division=0),
    }
    predictions = test[["date", "experiment_id", "site_id", "pond_id", "crash_within_window", "days_to_crash"]].copy()
    predictions["crash_probability"] = probability
    predictions["predicted_crash_window"] = predicted

    final_classifier = make_classifier()
    final_classifier.fit(data[ANOMALY_FEATURES], data.crash_within_window)

    isolation_preprocess = Pipeline(
        [
            ("imputer", SimpleImputer(strategy="median", add_indicator=True, keep_empty_features=True)),
            ("scale", RobustScaler()),
        ]
    )
    healthy = data.loc[data.crash_within_window.eq(0), ANOMALY_NUMERIC_FEATURES]
    transformed_healthy = isolation_preprocess.fit_transform(healthy)
    isolation_model = IsolationForest(
        n_estimators=320,
        contamination=0.04,
        max_samples="auto",
        n_jobs=-1,
        random_state=random_state,
    ).fit(transformed_healthy)
    healthy_scores = isolation_model.score_samples(transformed_healthy)
    score_calibration = {
        "p01": float(np.quantile(healthy_scores, 0.01)),
        "p50": float(np.quantile(healthy_scores, 0.50)),
        "p99": float(np.quantile(healthy_scores, 0.99)),
    }
    bundle = {
        "crash_classifier": final_classifier,
        "threshold": threshold,
        "isolation_preprocess": isolation_preprocess,
        "isolation_model": isolation_model,
        "isolation_score_calibration": score_calibration,
        "features": ANOMALY_FEATURES,
        "numeric_features": ANOMALY_NUMERIC_FEATURES,
        "trend_bases": ANOMALY_TREND_BASES,
        "label_definition": "recorded harvest crash on current date or within next 2 days",
    }
    return AnomalyTrainingResult(bundle, metrics, predictions, table)


def extract_image_features(path: str | Path, size: int = 96) -> np.ndarray:
    """Extract deterministic color, spatial, and edge features without external weights."""
    with Image.open(path) as source:
        rgb_image = source.convert("RGB").resize((size, size), Image.Resampling.BILINEAR)
        hsv_image = rgb_image.convert("HSV")
        rgb = np.asarray(rgb_image, dtype=np.float32) / 255.0
        hsv = np.asarray(hsv_image, dtype=np.float32) / 255.0

    features: list[float] = []
    for array in [rgb, hsv]:
        for channel in range(3):
            values = array[..., channel].ravel()
            features.extend([float(values.mean()), float(values.std()), *np.quantile(values, [0.1, 0.5, 0.9]).tolist()])
            histogram, _ = np.histogram(values, bins=16, range=(0, 1), density=True)
            features.extend(histogram.astype(float).tolist())
        block = size // 4
        for row in range(4):
            for column in range(4):
                patch = array[row * block : (row + 1) * block, column * block : (column + 1) * block]
                features.extend(patch.mean(axis=(0, 1)).astype(float).tolist())
                features.extend(patch.std(axis=(0, 1)).astype(float).tolist())

    gray = rgb.mean(axis=2)
    grad_y, grad_x = np.gradient(gray)
    magnitude = np.sqrt(grad_x**2 + grad_y**2)
    features.extend(
        [
            float(magnitude.mean()),
            float(magnitude.std()),
            *np.quantile(magnitude, [0.5, 0.75, 0.9, 0.99]).tolist(),
        ]
    )
    return np.asarray(features, dtype=np.float32)


def build_image_feature_table(root: str | Path) -> tuple[pd.DataFrame, np.ndarray, dict[str, Any]]:
    """Resolve available derived images and extract fixed image-only features."""
    root = Path(root)
    dataset_dir = root / "Fishpond Visual Condition Dataset v2.0"
    metadata = pd.read_csv(dataset_dir / "pond_dataset.csv")
    metadata["image_path"] = metadata.images.map(lambda value: dataset_dir / "images" / f"{value}.jpg")
    metadata["image_exists"] = metadata.image_path.map(Path.exists)
    available = metadata[metadata.image_exists].copy().reset_index(drop=True)
    matrix = np.vstack([extract_image_features(path) for path in available.image_path])
    report = {
        "metadata_rows": int(len(metadata)),
        "available_images": int(len(available)),
        "missing_images": int((~metadata.image_exists).sum()),
        "source_photo_groups": int(available.raw_images.nunique()),
        "classes": available.State.value_counts().to_dict(),
        "feature_count": int(matrix.shape[1]),
    }
    return available, matrix, report


def train_image_model(root: str | Path, random_state: int = 42) -> ImageTrainingResult:
    """Train/evaluate an image-only condition model with source-photo group isolation."""
    manifest, matrix, report = build_image_feature_table(root)
    encoder = LabelEncoder()
    labels = encoder.fit_transform(manifest.State)
    splitter = StratifiedGroupKFold(n_splits=2, shuffle=True, random_state=random_state)
    out_probability = np.zeros((len(manifest), len(encoder.classes_)), dtype=float)
    out_prediction = np.zeros(len(manifest), dtype=int)
    fold_ids = np.zeros(len(manifest), dtype=int)
    for fold, (train_index, test_index) in enumerate(splitter.split(matrix, labels, groups=manifest.raw_images)):
        model = RandomForestClassifier(
            n_estimators=600,
            max_depth=20,
            min_samples_leaf=2,
            max_features="sqrt",
            class_weight="balanced_subsample",
            n_jobs=-1,
            random_state=random_state + fold,
        )
        model.fit(matrix[train_index], labels[train_index])
        probability = model.predict_proba(matrix[test_index])
        aligned = np.zeros((len(test_index), len(encoder.classes_)))
        aligned[:, model.classes_.astype(int)] = probability
        out_probability[test_index] = aligned
        out_prediction[test_index] = aligned.argmax(axis=1)
        fold_ids[test_index] = fold

    metrics = {
        **report,
        "split": "2-fold stratified group validation by raw_images",
        "accuracy": float(accuracy_score(labels, out_prediction)),
        "balanced_accuracy": float(balanced_accuracy_score(labels, out_prediction)),
        "macro_f1": float(f1_score(labels, out_prediction, average="macro", zero_division=0)),
        "majority_baseline_accuracy": float(pd.Series(labels).value_counts(normalize=True).max()),
        "classification_report": classification_report(
            labels,
            out_prediction,
            labels=np.arange(len(encoder.classes_)),
            target_names=encoder.classes_,
            output_dict=True,
            zero_division=0,
        ),
    }
    predictions = manifest[["images", "raw_images", "Pond_Label", "State", "image_path"]].copy()
    predictions["fold"] = fold_ids
    predictions["predicted_state"] = encoder.inverse_transform(out_prediction)
    predictions["confidence"] = out_probability.max(axis=1)

    final_model = RandomForestClassifier(
        n_estimators=700,
        max_depth=20,
        min_samples_leaf=2,
        max_features="sqrt",
        class_weight="balanced_subsample",
        n_jobs=-1,
        random_state=random_state,
    ).fit(matrix, labels)
    bundle = {
        "model": final_model,
        "label_encoder": encoder,
        "feature_count": int(matrix.shape[1]),
        "input": "96x96 RGB image; deterministic color/spatial/edge features",
        "split_group": "raw_images",
    }
    return ImageTrainingResult(bundle, metrics, predictions, manifest)


def predict_image_condition(bundle: dict[str, Any], path: str | Path) -> dict[str, Any]:
    features = extract_image_features(path).reshape(1, -1)
    probabilities = bundle["model"].predict_proba(features)[0]
    order = np.argsort(probabilities)[::-1]
    encoder: LabelEncoder = bundle["label_encoder"]
    return {
        "state": str(encoder.inverse_transform([order[0]])[0]),
        "confidence": float(probabilities[order[0]]),
        "probabilities": {
            str(label): float(probability)
            for label, probability in zip(encoder.classes_, probabilities)
        },
        "provenance": "estimated_from_image",
    }


def build_co2_growth_transitions(root: str | Path) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Convert the Hiltunen daily curves into next-day growth transitions."""
    root = Path(root)
    data_dir = root / "15687789"
    growth = pd.read_excel(data_dir / "hiltunen_etal_chlorella_growth_biochem_data.xlsx", sheet_name="data")
    co2 = pd.read_excel(data_dir / "hiltunen_etal_chlorella_CO2_ppm_data.xlsx", sheet_name="data")
    growth["co2_treatment"] = growth.CO2.astype(str).str.lower().str.replace(" ", "", regex=False).map(
        {"rasair": "RASair", "roomair": "RoomAir"}
    )
    density_columns = [column for column in growth if str(column).startswith("celldens_d")]
    ph_columns = [column for column in growth if str(column).startswith("pH_d")]
    density = growth.melt(
        id_vars=["Exp", "Funnel#", "Medium", "Light", "co2_treatment"],
        value_vars=density_columns,
        var_name="day_field",
        value_name="current_cell_density",
    )
    density["day"] = pd.to_numeric(density.day_field.str.extract(r"(\d+)$")[0], errors="coerce")
    ph = growth.melt(
        id_vars=["Exp", "Funnel#"],
        value_vars=ph_columns,
        var_name="day_field",
        value_name="current_ph",
    )
    ph["day"] = pd.to_numeric(ph.day_field.str.extract(r"(\d+)$")[0], errors="coerce")
    daily = density.merge(ph[["Exp", "Funnel#", "day", "current_ph"]], on=["Exp", "Funnel#", "day"], how="left")
    daily = daily.sort_values(["Exp", "Funnel#", "day"])
    daily["future_cell_density"] = daily.groupby(["Exp", "Funnel#"])["current_cell_density"].shift(-1)
    daily["future_day"] = daily.groupby(["Exp", "Funnel#"])["day"].shift(-1)

    ras = co2[["Exp", "Day", "RASair_mean"]].rename(columns={"Day": "day", "RASair_mean": "co2_ppm"})
    ras["co2_treatment"] = "RASair"
    room = co2[["Exp", "Day", "RoomAir_mean"]].rename(columns={"Day": "day", "RoomAir_mean": "co2_ppm"})
    room["co2_treatment"] = "RoomAir"
    co2_long = pd.concat([ras, room], ignore_index=True)
    transitions = daily.merge(co2_long, on=["Exp", "day", "co2_treatment"], how="left", validate="many_to_one")
    transitions = transitions[
        transitions.current_cell_density.gt(0)
        & transitions.future_cell_density.gt(0)
        & transitions.future_day.sub(transitions.day).eq(1)
        & transitions.co2_ppm.notna()
    ].copy()
    transitions["log_growth_next_day"] = np.log(transitions.future_cell_density / transitions.current_cell_density)
    transitions = transitions.rename(columns={"Exp": "experiment_id", "Medium": "medium", "Light": "light"})
    report = {
        "transitions": int(len(transitions)),
        "experiments": sorted(transitions.experiment_id.unique().astype(int).tolist()),
        "co2_ppm_min": float(transitions.co2_ppm.min()),
        "co2_ppm_max": float(transitions.co2_ppm.max()),
        "treatments": transitions.co2_treatment.value_counts().to_dict(),
    }
    return transitions.reset_index(drop=True), report


def train_co2_growth_model(root: str | Path, random_state: int = 42) -> CO2TrainingResult:
    """Train a small experimental next-day growth model with leave-experiment-out evaluation."""
    transitions, report = build_co2_growth_transitions(root)
    predictions = np.full(len(transitions), np.nan)
    fold_metrics: dict[str, Any] = {}

    def make_model() -> Pipeline:
        return Pipeline(
            [
                ("preprocess", _tabular_preprocessor(CO2_NUMERIC_FEATURES, CO2_CATEGORICAL_FEATURES)),
                (
                    "regressor",
                    RandomForestRegressor(
                        n_estimators=500,
                        max_depth=10,
                        min_samples_leaf=3,
                        max_features=0.8,
                        n_jobs=-1,
                        random_state=random_state,
                    ),
                ),
            ]
        )

    for experiment in sorted(transitions.experiment_id.unique()):
        train = transitions[transitions.experiment_id != experiment]
        test = transitions[transitions.experiment_id == experiment]
        if train.empty or test.empty:
            continue
        model = make_model().fit(train[CO2_FEATURES], train.log_growth_next_day)
        prediction = model.predict(test[CO2_FEATURES])
        predictions[test.index] = prediction
        baseline = np.full(len(test), train.log_growth_next_day.median())
        fold_metrics[str(int(experiment))] = _regression_metrics(test.log_growth_next_day, prediction, baseline)

    valid = np.isfinite(predictions)
    baseline_all = np.zeros(valid.sum())
    metrics = {
        **report,
        "split": "leave-one-experiment-out",
        "overall": _regression_metrics(
            transitions.loc[valid, "log_growth_next_day"], predictions[valid], baseline_all
        ),
        "per_experiment": fold_metrics,
        "warning": "Experimental lab cell-density model; not directly validated on ATP3 AFDW.",
    }
    final_model = make_model().fit(transitions[CO2_FEATURES], transitions.log_growth_next_day)

    # Endpoint AFDW contrast supplies a bounded, transparent scenario calibration.
    growth = pd.read_excel(
        Path(root) / "15687789" / "hiltunen_etal_chlorella_growth_biochem_data.xlsx", sheet_name="data"
    )
    growth["co2_treatment"] = growth.CO2.astype(str).str.lower().str.replace(" ", "", regex=False).map(
        {"rasair": "RASair", "roomair": "RoomAir"}
    )
    paired = growth.groupby(["Exp", "Medium", "Light", "co2_treatment"])["AFDW_mg/L"].mean().unstack("co2_treatment")
    paired = paired.dropna(subset=["RASair", "RoomAir"])
    ratios = paired.RASair / paired.RoomAir
    geometric_ratio = float(np.exp(np.log(ratios).mean()))
    calibration = {
        "reference_ppm": 400.0,
        "approximate_treatment_contrast_ppm": 500.0,
        "afdw_geometric_ratio": geometric_ratio,
        "log_effect_per_100ppm": float(np.log(geometric_ratio) / 5),
        "observed_ratio_min": float(ratios.min()),
        "observed_ratio_max": float(ratios.max()),
        "paired_strata": int(len(ratios)),
        "effect_cap_pct": 15.0,
        "provenance": "Hiltunen Chlorella laboratory experiment",
        "warning": "Context-dependent external calibration; no ATP3 CO2 telemetry.",
    }
    bundle = {
        "model": final_model,
        "features": CO2_FEATURES,
        "target": "next-day log cell-density growth",
        "scenario_calibration": calibration,
    }
    return CO2TrainingResult(bundle, metrics, transitions)

