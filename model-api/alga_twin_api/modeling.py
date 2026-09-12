"""Reproducible baseline-table builders and leakage-aware model training."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


ATP3_CATEGORICAL_FEATURES = ["site_id", "pond_id", "strain_id"]
ATP3_NUMERIC_FEATURES = [
    "duration_days",
    "depth_cm",
    "nitrate_mg_l",
    "ammonium_mg_l",
    "phosphorus_mg_l",
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
    "day_of_year_sin",
    "day_of_year_cos",
]
ATP3_FEATURES = ATP3_CATEGORICAL_FEATURES + ATP3_NUMERIC_FEATURES

REMOTE_CATEGORICAL_FEATURES = ["dataset", "category"]
REMOTE_NUMERIC_FEATURES = [
    "red",
    "green",
    "blue",
    "RE1",
    "nd_green_red",
    "nd_re_red",
    "green_red_ratio",
    "re_green_ratio",
    "latitude",
    "longitude",
    "day_of_year_sin",
    "day_of_year_cos",
]
REMOTE_FEATURES = REMOTE_CATEGORICAL_FEATURES + REMOTE_NUMERIC_FEATURES


@dataclass
class BiomassTrainingResult:
    model: Pipeline
    metrics: dict[str, Any]
    predictions: pd.DataFrame
    feature_importance: pd.DataFrame


@dataclass
class RemoteTrainingResult:
    models: dict[str, Pipeline]
    metrics: dict[str, Any]
    predictions: pd.DataFrame


def _numeric(frame: pd.DataFrame, columns: list[str]) -> None:
    for column in columns:
        if column in frame:
            frame[column] = pd.to_numeric(frame[column], errors="coerce")


def build_atp3_biomass_table(root: str | Path) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Build one AFDW target per pond/day and join daily sensors and weather."""
    root = Path(root)
    na_values = ["NA", "N/A", ""]

    operational = pd.read_csv(root / "ATP3-UFS-PondOperationalData.csv", low_memory=False, na_values=na_values)
    operational["date"] = pd.to_datetime(operational["DATETIME"], errors="coerce").dt.normalize()
    op_numeric = [
        "AFDW.g.L", "Duration.days", "Depth.cm", "NO3.mg.L", "NH4.mg.L", "P.mg.L",
    ]
    _numeric(operational, op_numeric)
    target_rows = operational[
        operational["date"].notna()
        & operational["AFDW.g.L"].notna()
        & operational["AFDW.g.L"].ge(0)
        & operational["PondID"].ne("inoc")
    ].copy()

    op_keys = ["ExperimentID", "SiteID", "PondID", "StrainID", "date"]
    operational_daily = (
        target_rows.groupby(op_keys, dropna=False)
        .agg(
            afdw_g_l=("AFDW.g.L", "mean"),
            source_target_rows=("AFDW.g.L", "size"),
            duration_days=("Duration.days", "median"),
            depth_cm=("Depth.cm", "median"),
            nitrate_mg_l=("NO3.mg.L", "median"),
            ammonium_mg_l=("NH4.mg.L", "median"),
            phosphorus_mg_l=("P.mg.L", "median"),
        )
        .reset_index()
    )

    instrumentation = pd.read_csv(root / "ATP3-UFS-Instrumentation-daily.csv", low_memory=False, na_values=na_values)
    instrumentation["date"] = pd.to_datetime(instrumentation["Date"], errors="coerce").dt.normalize()
    sensor_source = [
        "pH", "Temp.avg (C)", "Temp.max (C)", "Temp.min (C)", "Cond (mS.cm)",
        "DO (mg.L)", "DO (%sat)", "Sal (g.L)", "PAR (umol.m2.s)",
    ]
    _numeric(instrumentation, sensor_source)
    sensor_keys = ["ExperimentID", "SiteID", "PondID", "StrainID", "date"]
    instrumentation_daily = instrumentation.groupby(sensor_keys, dropna=False)[sensor_source].mean().reset_index()
    instrumentation_daily = instrumentation_daily.rename(
        columns={
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

    weather = pd.read_csv(root / "ATP3-UFS-Weather-daily.csv", low_memory=False, na_values=na_values)
    weather["date"] = pd.to_datetime(weather["Date"], errors="coerce").dt.normalize()
    weather_source = [
        "AirTemp(C)", "RH(%)", "GlobalLightEnergy(W.m2)", "WindSpeed(km.hr)", "Precip.tot(cm)",
    ]
    _numeric(weather, weather_source)
    weather_keys = ["ExperimentID", "SiteID", "StrainID", "date"]
    weather_daily = weather.groupby(weather_keys, dropna=False)[weather_source].mean().reset_index()
    weather_daily = weather_daily.rename(
        columns={
            "AirTemp(C)": "air_temp_c",
            "RH(%)": "relative_humidity_pct",
            "GlobalLightEnergy(W.m2)": "global_light_w_m2",
            "WindSpeed(km.hr)": "wind_km_h",
            "Precip.tot(cm)": "precipitation_cm",
        }
    )

    table = operational_daily.merge(
        instrumentation_daily,
        on=sensor_keys,
        how="left",
        validate="one_to_one",
        indicator="instrument_join",
    )
    table = table.merge(
        weather_daily,
        on=weather_keys,
        how="left",
        validate="many_to_one",
        indicator="weather_join",
    )
    table = table.rename(
        columns={
            "ExperimentID": "experiment_id",
            "SiteID": "site_id",
            "PondID": "pond_id",
            "StrainID": "strain_id",
        }
    )
    day_of_year = table["date"].dt.dayofyear
    table["day_of_year_sin"] = np.sin(2 * np.pi * day_of_year / 365.25)
    table["day_of_year_cos"] = np.cos(2 * np.pi * day_of_year / 365.25)
    table = table.sort_values(["date", "experiment_id", "site_id", "pond_id"]).reset_index(drop=True)

    core = ["sensor_ph", "water_temp_avg_c", "do_mg_l", "salinity_g_l", "air_temp_c", "global_light_w_m2"]
    report = {
        "raw_operational_rows": int(len(operational)),
        "valid_non_inoc_afdw_rows": int(len(target_rows)),
        "unique_target_events": int(len(operational_daily)),
        "instrument_exact_date_matches": int((table["instrument_join"] == "both").sum()),
        "weather_exact_date_matches": int((table["weather_join"] == "both").sum()),
        "core_environment_complete_rows": int(table[core].notna().all(axis=1).sum()),
        "par_available_rows": int(table["par_umol_m2_s"].notna().sum()),
        "date_min": table["date"].min(),
        "date_max": table["date"].max(),
        "experiments": int(table["experiment_id"].nunique()),
        "duplicate_final_keys": int(table.duplicated(["experiment_id", "site_id", "pond_id", "strain_id", "date"]).sum()),
    }
    return table, report


def _regression_metrics(y_true: pd.Series, prediction: np.ndarray, baseline: np.ndarray) -> dict[str, float]:
    return {
        "mae": float(mean_absolute_error(y_true, prediction)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, prediction))),
        "r2": float(r2_score(y_true, prediction)),
        "median_baseline_mae": float(mean_absolute_error(y_true, baseline)),
        "median_baseline_rmse": float(np.sqrt(mean_squared_error(y_true, baseline))),
    }


def train_biomass_baseline(table: pd.DataFrame, random_state: int = 42) -> BiomassTrainingResult:
    """Train an AFDW estimator with complete experiments held out for testing."""
    data = table.dropna(subset=["afdw_g_l", "experiment_id"]).copy()
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.27, random_state=random_state)
    train_index, test_index = next(splitter.split(data, groups=data["experiment_id"]))
    train, test = data.iloc[train_index], data.iloc[test_index]

    preprocess = ColumnTransformer(
        transformers=[
            (
                "numeric",
                SimpleImputer(strategy="median", add_indicator=True, keep_empty_features=True),
                ATP3_NUMERIC_FEATURES,
            ),
            (
                "categorical",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("one_hot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
                    ]
                ),
                ATP3_CATEGORICAL_FEATURES,
            ),
        ],
        verbose_feature_names_out=True,
    )
    regressor = RandomForestRegressor(
        n_estimators=320,
        max_depth=16,
        min_samples_leaf=3,
        max_features=0.75,
        n_jobs=-1,
        random_state=random_state,
    )
    model = Pipeline([("preprocess", preprocess), ("regressor", regressor)])
    model.fit(train[ATP3_FEATURES], train["afdw_g_l"])
    prediction = model.predict(test[ATP3_FEATURES])
    baseline_value = float(train["afdw_g_l"].median())
    baseline = np.full(len(test), baseline_value)

    transformed_test = model.named_steps["preprocess"].transform(test[ATP3_FEATURES])
    tree_predictions = np.vstack(
        [tree.predict(transformed_test) for tree in model.named_steps["regressor"].estimators_]
    )
    uncertainty = tree_predictions.std(axis=0)

    metrics: dict[str, Any] = _regression_metrics(test["afdw_g_l"], prediction, baseline)
    metrics.update(
        {
            "split": "grouped by experiment_id",
            "train_rows": int(len(train)),
            "test_rows": int(len(test)),
            "train_experiments": sorted(train["experiment_id"].unique().tolist()),
            "held_out_experiments": sorted(test["experiment_id"].unique().tolist()),
            "train_target_median": baseline_value,
        }
    )
    predictions = test[["date", "experiment_id", "site_id", "pond_id", "afdw_g_l"]].copy()
    predictions = predictions.rename(columns={"afdw_g_l": "actual_afdw_g_l"})
    predictions["predicted_afdw_g_l"] = prediction
    predictions["ensemble_std_g_l"] = uncertainty

    feature_names = model.named_steps["preprocess"].get_feature_names_out()
    feature_importance = pd.DataFrame(
        {"feature": feature_names, "importance": model.named_steps["regressor"].feature_importances_}
    ).sort_values("importance", ascending=False, ignore_index=True)
    return BiomassTrainingResult(model, metrics, predictions, feature_importance)


def build_remote_verification_table(root: str | Path) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Join resolved reflectance to chlorophyll/turbidity labels and point metadata."""
    root = Path(root)
    reflectance = pd.read_csv(root / "UL-modis-s2_Rrs_01.csv")
    reflectance["date"] = pd.to_datetime(reflectance["date"], errors="coerce")
    bands = ["red", "green", "blue", "RE1"]
    duplicate_pairs = int(reflectance.duplicated(["date", "point_id"]).sum())
    reflectance = reflectance.groupby(["date", "point_id"], as_index=False)[bands].mean()

    label_parts: list[pd.DataFrame] = []
    metadata_parts: list[pd.DataFrame] = []
    usecols = ["date", "point_id", "latitude", "longitude", "dataset", "category", "inPB", "parameter", "value"]
    for chunk in pd.read_csv(root / "UL-modis-s2_data_06.csv", usecols=usecols, chunksize=400_000):
        metadata_parts.append(
            chunk[["point_id", "latitude", "longitude", "dataset", "category", "inPB"]].drop_duplicates("point_id")
        )
        labels = chunk[chunk["parameter"].isin(["chla", "turbidity"])][["date", "point_id", "parameter", "value"]].copy()
        if not labels.empty:
            labels["date"] = pd.to_datetime(labels["date"], errors="coerce")
            labels["point_id"] = pd.to_numeric(labels["point_id"], errors="coerce", downcast="integer")
            labels["value"] = pd.to_numeric(labels["value"], errors="coerce", downcast="float")
            labels["parameter"] = labels["parameter"].astype("category")
            label_parts.append(labels)

    metadata = pd.concat(metadata_parts, ignore_index=True).drop_duplicates("point_id", keep="first")
    labels_long = pd.concat(label_parts, ignore_index=True)
    labels = (
        labels_long.groupby(["date", "point_id", "parameter"], observed=True, as_index=False)["value"]
        .mean()
        .pivot(index=["date", "point_id"], columns="parameter", values="value")
        .reset_index()
    )
    labels.columns.name = None
    table = reflectance.merge(labels, on=["date", "point_id"], how="left", validate="one_to_one")
    table = table.merge(metadata, on="point_id", how="left", validate="many_to_one")
    table["nd_green_red"] = (table["green"] - table["red"]) / (table["green"] + table["red"]).replace(0, np.nan)
    table["nd_re_red"] = (table["RE1"] - table["red"]) / (table["RE1"] + table["red"]).replace(0, np.nan)
    table["green_red_ratio"] = table["green"] / table["red"].replace(0, np.nan)
    table["re_green_ratio"] = table["RE1"] / table["green"].replace(0, np.nan)
    day_of_year = table["date"].dt.dayofyear
    table["day_of_year_sin"] = np.sin(2 * np.pi * day_of_year / 365.25)
    table["day_of_year_cos"] = np.cos(2 * np.pi * day_of_year / 365.25)
    table = table.dropna(subset=["chla", "turbidity"]).sort_values(["date", "point_id"]).reset_index(drop=True)

    report = {
        "raw_reflectance_rows": 267_399,
        "repeated_date_point_rows_beyond_first": duplicate_pairs,
        "resolved_reflectance_rows": int(len(reflectance)),
        "matched_rows_with_both_targets": int(len(table)),
        "match_rate_pct": round(len(table) / len(reflectance) * 100, 2),
        "points": int(table["point_id"].nunique()),
        "date_min": table["date"].min(),
        "date_max": table["date"].max(),
    }
    return table, report


def train_remote_baselines(table: pd.DataFrame, random_state: int = 42) -> RemoteTrainingResult:
    """Train reflectance proxies and evaluate strictly on later observation dates."""
    dates = np.sort(table["date"].dropna().unique())
    cutoff = pd.Timestamp(dates[int(len(dates) * 0.8)])
    train = table[table["date"] < cutoff].copy()
    test = table[table["date"] >= cutoff].copy()

    def make_model() -> Pipeline:
        preprocess = ColumnTransformer(
            transformers=[
                (
                    "numeric",
                    SimpleImputer(strategy="median", add_indicator=True, keep_empty_features=True),
                    REMOTE_NUMERIC_FEATURES,
                ),
                (
                    "categorical",
                    Pipeline(
                        [
                            ("imputer", SimpleImputer(strategy="most_frequent")),
                            ("one_hot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
                        ]
                    ),
                    REMOTE_CATEGORICAL_FEATURES,
                ),
            ]
        )
        regressor = HistGradientBoostingRegressor(
            learning_rate=0.08,
            max_iter=180,
            max_leaf_nodes=31,
            l2_regularization=1.0,
            random_state=random_state,
        )
        return Pipeline([("preprocess", preprocess), ("regressor", regressor)])

    predictions = test[["date", "point_id", "chla", "turbidity"]].copy()
    models: dict[str, Pipeline] = {}
    metrics: dict[str, Any] = {
        "split": "chronological future-date holdout",
        "cutoff_date": cutoff.isoformat(),
        "train_rows": int(len(train)),
        "test_rows": int(len(test)),
    }
    for target in ["chla", "turbidity"]:
        model = make_model()
        model.fit(train[REMOTE_FEATURES], train[target])
        prediction = np.clip(model.predict(test[REMOTE_FEATURES]), 0, None)
        baseline = np.full(len(test), float(train[target].median()))
        predictions[f"predicted_{target}"] = prediction
        metrics[target] = _regression_metrics(test[target], prediction, baseline)
        models[target] = model
    return RemoteTrainingResult(models, metrics, predictions)

