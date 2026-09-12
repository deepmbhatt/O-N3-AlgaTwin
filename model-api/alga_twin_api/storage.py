"""Prediction and simulation history storage for dashboard reads."""

from __future__ import annotations

from collections import defaultdict, deque
from copy import deepcopy
from threading import Lock
from typing import Any, Protocol
import os


class PredictionStore(Protocol):
    def append(self, record: dict[str, Any]) -> None: ...
    def append_simulation(self, record: dict[str, Any]) -> None: ...
    def dashboard(self, pond_id: str | None, limit: int) -> list[dict[str, Any]]: ...


class MemoryPredictionStore:
    def __init__(self, max_per_pond: int = 1000):
        self.records: dict[str, deque] = defaultdict(
            lambda: deque(maxlen=max_per_pond)
        )
        self.simulations: dict[str, deque] = defaultdict(
            lambda: deque(maxlen=max_per_pond)
        )
        self.lock = Lock()

    def append(self, record: dict[str, Any]) -> None:
        with self.lock:
            self.records[str(record["pond_id"])].append(deepcopy(record))

    def append_simulation(self, record: dict[str, Any]) -> None:
        with self.lock:
            self.simulations[str(record["pond_id"])].append(deepcopy(record))

    def dashboard(self, pond_id: str | None, limit: int) -> list[dict[str, Any]]:
        with self.lock:
            pond_ids = [pond_id] if pond_id else sorted(self.records)
            response = []
            for identifier in pond_ids:
                history = list(self.records.get(identifier, []))
                if not history:
                    continue
                selected = list(reversed(history[-limit:]))
                simulations = list(
                    reversed(list(self.simulations.get(identifier, []))[-limit:])
                )
                response.append({
                    "pond_id": identifier,
                    "latest": deepcopy(history[-1]),
                    "history": deepcopy(selected),
                    "returned_history_count": len(selected),
                    "latest_simulation": (
                        deepcopy(simulations[0]) if simulations else None
                    ),
                    "simulation_history": deepcopy(simulations),
                })
            return response


class MongoPredictionStore:
    def __init__(self, uri: str, database: str):
        try:
            from pymongo import DESCENDING, MongoClient
        except ImportError as error:
            raise RuntimeError("Install pymongo to use ALGATWIN_MONGODB_URI") from error
        self.client = MongoClient(uri, serverSelectionTimeoutMS=3000)
        db = self.client[database]
        self.collection = db["predictions"]
        self.simulations = db["simulations"]
        self.collection.create_index([("pond_id", 1), ("observed_at", DESCENDING)])
        self.collection.create_index([("stream_cycle", 1), ("stream_row", 1)])
        self.simulations.create_index([("pond_id", 1), ("created_at", DESCENDING)])

    @staticmethod
    def _without_id(document: dict[str, Any]) -> dict[str, Any]:
        document = deepcopy(document)
        document.pop("_id", None)
        return document

    def append(self, record: dict[str, Any]) -> None:
        self.collection.insert_one(deepcopy(record))

    def append_simulation(self, record: dict[str, Any]) -> None:
        self.simulations.insert_one(deepcopy(record))

    def dashboard(self, pond_id: str | None, limit: int) -> list[dict[str, Any]]:
        if pond_id:
            pond_ids = [pond_id]
        else:
            pond_ids = sorted(self.collection.distinct("pond_id"))
        response = []
        for identifier in pond_ids:
            history = list(
                self.collection.find({"pond_id": identifier})
                .sort([("stream_cycle", -1), ("stream_row", -1)])
                .limit(limit)
            )
            if not history:
                continue
            clean = [self._without_id(item) for item in history]
            simulations = [
                self._without_id(item)
                for item in self.simulations.find({"pond_id": identifier})
                .sort("created_at", -1)
                .limit(limit)
            ]
            response.append({
                "pond_id": identifier,
                "latest": deepcopy(clean[0]),
                "history": clean,
                "returned_history_count": len(clean),
                "latest_simulation": (
                    deepcopy(simulations[0]) if simulations else None
                ),
                "simulation_history": simulations,
            })
        return response


def configured_prediction_store() -> PredictionStore:
    uri = os.getenv("ALGATWIN_MONGODB_URI")
    if uri:
        return MongoPredictionStore(
            uri,
            os.getenv("ALGATWIN_MONGODB_DATABASE", "algatwin"),
        )
    return MemoryPredictionStore(
        max_per_pond=int(os.getenv("ALGATWIN_HISTORY_LIMIT", "1000"))
    )
