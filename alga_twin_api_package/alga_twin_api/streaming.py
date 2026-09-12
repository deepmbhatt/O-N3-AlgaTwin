"""Circular CSV stream and cursor backends for cron-driven inference."""

from __future__ import annotations

from pathlib import Path
from threading import Lock
from typing import Any, Protocol
import os

import pandas as pd


class CursorBackend(Protocol):
    def read(self) -> dict[str, int]: ...
    def write(self, position: int, cycle: int) -> None: ...
    def reset(self) -> None: ...


class MemoryCursorBackend:
    def __init__(self):
        self.position = 0
        self.cycle = 0

    def read(self) -> dict[str, int]:
        return {"position": self.position, "cycle": self.cycle}

    def write(self, position: int, cycle: int) -> None:
        self.position = position
        self.cycle = cycle

    def reset(self) -> None:
        self.write(0, 0)


class MongoCursorBackend:
    """Optional persistent cursor, activated by ALGATWIN_MONGODB_URI."""

    def __init__(self, uri: str, database: str, stream_id: str):
        try:
            from pymongo import MongoClient
        except ImportError as error:
            raise RuntimeError("Install pymongo to use ALGATWIN_MONGODB_URI") from error
        self.client = MongoClient(uri, serverSelectionTimeoutMS=3000)
        self.collection = self.client[database]["stream_cursors"]
        self.stream_id = stream_id
        self.collection.create_index("stream_id", unique=True)

    def read(self) -> dict[str, int]:
        document = self.collection.find_one({"stream_id": self.stream_id}) or {}
        return {
            "position": int(document.get("position", 0)),
            "cycle": int(document.get("cycle", 0)),
        }

    def write(self, position: int, cycle: int) -> None:
        self.collection.update_one(
            {"stream_id": self.stream_id},
            {"$set": {"position": position, "cycle": cycle}},
            upsert=True,
        )

    def reset(self) -> None:
        self.write(0, 0)


def configured_cursor_backend(stream_id: str) -> CursorBackend:
    uri = os.getenv("ALGATWIN_MONGODB_URI")
    if not uri:
        return MemoryCursorBackend()
    return MongoCursorBackend(
        uri,
        os.getenv("ALGATWIN_MONGODB_DATABASE", "algatwin"),
        stream_id,
    )


class CircularCsvStream:
    def __init__(self, csv_path: str | Path, backend: CursorBackend):
        self.csv_path = Path(csv_path).resolve()
        if not self.csv_path.exists():
            raise FileNotFoundError(f"Stream CSV not found: {self.csv_path}")
        self.frame = pd.read_csv(self.csv_path)
        required = {"pond_id", "observed_at", "time_step", "condition_label"}
        missing = required - set(self.frame.columns)
        if missing:
            raise ValueError(f"Stream CSV missing columns: {sorted(missing)}")
        if self.frame.empty:
            raise ValueError("Stream CSV has no data rows")
        self.backend = backend
        self.lock = Lock()

    @property
    def total_rows(self) -> int:
        return len(self.frame)

    def reset(self) -> None:
        with self.lock:
            self.backend.reset()

    def next_batch(self, batch_size: int) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        with self.lock:
            cursor = self.backend.read()
            start_position = cursor["position"] % self.total_rows
            start_cycle = max(0, cursor["cycle"])
            records: list[dict[str, Any]] = []
            for offset in range(batch_size):
                absolute = start_position + offset
                position = absolute % self.total_rows
                cycle = start_cycle + absolute // self.total_rows
                raw = self.frame.iloc[position].to_dict()
                clean = {
                    key: (None if pd.isna(value) else value.item() if hasattr(value, "item") else value)
                    for key, value in raw.items()
                }
                clean["stream_row"] = position + 1
                clean["stream_cycle"] = cycle
                records.append(clean)
            absolute_next = start_position + batch_size
            next_position = absolute_next % self.total_rows
            next_cycle = start_cycle + absolute_next // self.total_rows
            self.backend.write(next_position, next_cycle)
            return records, {
                "start_row": start_position + 1,
                "next_row": next_position + 1,
                "batch_size": batch_size,
                "total_rows": self.total_rows,
                "cycle": next_cycle,
                "restarted": next_cycle > start_cycle,
                "mode": "circular",
            }
