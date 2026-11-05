"""Storage for conversation recordings (WAV files).

Audio is megabytes per call, so it lives outside the run document: one file per
conversation under `<base>/<run id>/<conversation id>.wav`. Ids come from stored runs
(ObjectId hex and uuid hex), never straight from a request, and are checked again here.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Protocol

_ID_RE = re.compile(r"^[0-9a-f]{1,32}$")


class RecordingStore(Protocol):
    def save(self, run_id: str, conversation_id: str, wav: bytes) -> None: ...

    def path(self, run_id: str, conversation_id: str) -> Path | None: ...


class LocalRecordingStore:
    def __init__(self, base_dir: str | Path) -> None:
        self._base = Path(base_dir)

    def _file(self, run_id: str, conversation_id: str) -> Path:
        if not (_ID_RE.match(run_id) and _ID_RE.match(conversation_id)):
            raise ValueError("recording ids must be lowercase hex")
        return self._base / run_id / f"{conversation_id}.wav"

    def save(self, run_id: str, conversation_id: str, wav: bytes) -> None:
        target = self._file(run_id, conversation_id)
        target.parent.mkdir(parents=True, exist_ok=True)
        # Write then rename, so a reader never gets a half-written file.
        tmp = target.with_suffix(".tmp")
        tmp.write_bytes(wav)
        tmp.replace(target)

    def path(self, run_id: str, conversation_id: str) -> Path | None:
        target = self._file(run_id, conversation_id)
        return target if target.is_file() else None
