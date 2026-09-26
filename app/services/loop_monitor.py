"""Spots anything that holds up a web worker's event loop, and says what.

Each uvicorn worker serves requests *and* runs the scrapers and email loops
on the same event loop, so code that keeps the loop busy (CPU work, a
blocking call) delays every request on that worker until it finishes. A
heartbeat task ticks every 100 ms; a watchdog thread notices when it stops
ticking for more than STALL_SECONDS, samples what the loop thread is
running, and when the loop recovers records how long it was stuck and where.

When the loop thread itself is idle but still late, another thread is
holding the GIL (e.g. PDF building handed to asyncio.to_thread), so those
threads' stacks are reported instead.

Individual stalls of LOG_SECONDS or more are logged as they happen; every
SUMMARY_SECONDS a summary line gives the worst call sites. /api/v1/health
reports this worker's counts for the last five minutes.
"""
from __future__ import annotations

import asyncio
import collections
import logging
import os
import sys
import threading
import time
import traceback
from typing import Any

logger = logging.getLogger(__name__)

STALL_SECONDS = 0.3
LOG_SECONDS = 1.0
SUMMARY_SECONDS = 600
_TICK = 0.1

_APP_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_SHOW_FROM = os.path.dirname(_APP_ROOT) + os.sep

_beat = time.monotonic()
_recent: collections.deque = collections.deque(maxlen=500)  # (ended_at, seconds, where)
_task: asyncio.Task | None = None


def _app_frames(frame: Any) -> list[traceback.FrameSummary]:
    return [
        f for f in traceback.extract_stack(frame)
        if f.filename.startswith(_APP_ROOT + os.sep) and not f.filename.endswith("loop_monitor.py")
    ]


def _fmt(frames: list[traceback.FrameSummary]) -> str:
    return " <- ".join(
        f"{f.filename.replace(_SHOW_FROM, '')}:{f.lineno} {f.name}" for f in reversed(frames[-3:])
    )


def _where(loop_thread_id: int) -> str:
    frames = sys._current_frames()
    loop_frame = frames.get(loop_thread_id)
    ours = _app_frames(loop_frame) if loop_frame is not None else []
    if ours:
        return _fmt(ours)
    busy = []
    for thread_id, frame in frames.items():
        if thread_id in (loop_thread_id, threading.get_ident()):
            continue
        theirs = _app_frames(frame)
        if theirs:
            busy.append(_fmt(theirs))
    if busy:
        return "GIL held by thread: " + " | ".join(sorted(set(busy))[:2])
    if loop_frame is not None:
        top = traceback.extract_stack(loop_frame)[-1]
        return f"outside app code: {os.path.basename(top.filename)}:{top.lineno} {top.name}"
    return "unknown"


def _watch(loop_thread_id: int) -> None:
    stall_start: float | None = None
    samples: list[str] = []
    last_summary = time.monotonic()
    while True:
        time.sleep(_TICK)
        try:
            now = time.monotonic()
            if now - _beat > STALL_SECONDS:
                if stall_start is None:
                    stall_start, samples = _beat, []
                if len(samples) < 50:
                    samples.append(_where(loop_thread_id))
            elif stall_start is not None:
                seconds = max(0.0, _beat - stall_start - _TICK)
                where = collections.Counter(samples).most_common(1)[0][0] if samples else "unknown"
                _recent.append((now, seconds, where))
                if seconds >= LOG_SECONDS:
                    logger.warning("Event loop blocked %.1fs (worker %d): %s", seconds, os.getpid(), where)
                stall_start = None
            if now - last_summary >= SUMMARY_SECONDS:
                last_summary = now
                _log_summary(now)
        except Exception:  # noqa: BLE001 -- the monitor must never take the worker down
            logger.debug("loop monitor sample failed", exc_info=True)


def _log_summary(now: float) -> None:
    window = [r for r in _recent if r[0] >= now - SUMMARY_SECONDS]
    if not window:
        return
    by_site: dict[str, list[float]] = collections.defaultdict(list)
    for _, seconds, where in window:
        by_site[where].append(seconds)
    top = sorted(by_site.items(), key=lambda item: -sum(item[1]))[:3]
    logger.warning(
        "Event loop stalls, last %d min (worker %d): %d stalls, %.1fs blocked in total. Worst: %s",
        SUMMARY_SECONDS // 60, os.getpid(), len(window), sum(r[1] for r in window),
        " || ".join(f"{sum(s):.1f}s over {len(s)}x at {site}" for site, s in top),
    )


async def _heartbeat() -> None:
    global _beat
    while True:
        _beat = time.monotonic()
        await asyncio.sleep(_TICK)


def start() -> None:
    """Call once per worker, from inside its running event loop."""
    global _task, _beat
    if _task is not None:
        return
    _beat = time.monotonic()
    _task = asyncio.get_running_loop().create_task(_heartbeat())
    threading.Thread(target=_watch, args=(threading.get_ident(),), name="loop-monitor", daemon=True).start()


def stats(window_seconds: int = 300) -> dict[str, Any]:
    """This worker's stalls over the last few minutes (numbers only)."""
    cutoff = time.monotonic() - window_seconds
    window = [r for r in _recent if r[0] >= cutoff]
    return {
        "worker": os.getpid(),
        "stalls_5min": len(window),
        "blocked_seconds_5min": round(sum(r[1] for r in window), 1),
        "longest_stall_seconds_5min": round(max((r[1] for r in window), default=0.0), 1),
    }
