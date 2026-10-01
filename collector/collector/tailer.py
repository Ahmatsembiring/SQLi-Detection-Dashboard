"""Stream (tail -F) a growing log file (FR-11)."""
from __future__ import annotations

import os
import time
from collections.abc import Iterator
from pathlib import Path


def follow(path: Path, from_start: bool = False, poll_interval: float = 0.05,
           stop=lambda: False) -> Iterator[str]:
    """Yield complete lines appended to `path`, like `tail -F`:
    waits for the file to appear, survives truncation and re-creation (rotation)."""
    fh = None
    inode = None
    buf = ""
    first_open = True
    while not stop():
        if fh is None:
            try:
                fh = open(path, "r", encoding="utf-8", errors="replace")
            except FileNotFoundError:
                time.sleep(0.5)
                continue
            inode = os.fstat(fh.fileno()).st_ino
            if first_open and not from_start:
                fh.seek(0, os.SEEK_END)
            first_open = False
            buf = ""

        chunk = fh.readline()
        if chunk:
            buf += chunk
            if buf.endswith("\n"):
                yield buf
                buf = ""
            continue

        # No new data: check for truncation or rotation before sleeping.
        try:
            st = os.stat(path)
        except FileNotFoundError:
            st = None
        if st is None or st.st_ino != inode:
            fh.close()
            fh = None
            continue
        if st.st_size < fh.tell():
            fh.seek(0)
            buf = ""
            continue
        time.sleep(poll_interval)
    if fh:
        fh.close()
