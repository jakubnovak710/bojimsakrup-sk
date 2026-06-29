"""
FastAPI backend — bojimsakrup.sk
Poskytuje /api/cells (búrkové bunky) a /api/health.
Scheduler beží každých 10 minút a aktualizuje cache.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from radar.rainviewer import fetch_radar_frames
from radar.optical_flow import track_cells, CellVector

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ── Cache ─────────────────────────────────────────────────────────────────────

_cache: dict = {
    "cells": [],
    "updated_at": None,
    "error": None,
}


# ── Scheduler ─────────────────────────────────────────────────────────────────

async def refresh_cells() -> None:
    """Stiahne nové snímky, vypočíta vektory, uloží do cache."""
    log.info("Refreshing radar cells...")
    try:
        async with httpx.AsyncClient() as client:
            frames = await fetch_radar_frames(client, n_frames=4)

        if len(frames) < 2:
            log.warning("Nedostatok snímkov (%d)", len(frames))
            return

        vectors = track_cells(frames)
        _cache["cells"] = [_cell_to_dict(v, frames[-1].timestamp) for v in vectors]
        _cache["updated_at"] = datetime.now(timezone.utc).isoformat()
        _cache["error"] = None
        log.info("Refreshed: %d buniek detekovaných", len(vectors))

    except Exception as exc:
        log.error("Refresh zlyhal: %s", exc, exc_info=True)
        _cache["error"] = str(exc)


def _cell_to_dict(v: CellVector, radar_timestamp: int) -> dict:
    return {
        "id": v.id,
        "lat": v.lat,
        "lon": v.lon,
        "dbz": v.dbz,
        "direction_deg": v.direction_deg,
        "speed_kmh": v.speed_kmh,
        "trajectory": v.trajectory,
        "trend": v.trend,
        "dbz_delta": v.dbz_delta,
        "confidence": v.confidence,
        "radar_timestamp": radar_timestamp,
        "updated_at": _cache.get("updated_at"),
    }


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Prvý refresh hneď pri štarte
    await refresh_cells()

    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(refresh_cells, "interval", minutes=10, id="radar_refresh")
    scheduler.start()
    log.info("Scheduler spustený")

    yield

    scheduler.shutdown()
    log.info("Scheduler zastavený")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="BojímSaKrúp API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://bojimsakrup.sk",
        "https://www.bojimsakrup.sk",
        "http://localhost:3000",   # vývoj
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)


# ── Schemas ───────────────────────────────────────────────────────────────────

class TrajectoryPoint(BaseModel):
    lat: float
    lon: float
    eta_min: int
    confidence: float

class StormCell(BaseModel):
    id: str
    lat: float
    lon: float
    dbz: float
    direction_deg: float
    speed_kmh: float
    trajectory: list[TrajectoryPoint]
    trend: str          # growing | stable | weakening
    dbz_delta: float
    confidence: float
    radar_timestamp: int
    updated_at: str | None

class CellsResponse(BaseModel):
    cells: list[StormCell]
    updated_at: str | None
    count: int


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/api/cells", response_model=CellsResponse)
async def get_cells():
    """Aktuálne búrkové bunky s pohybovými vektormi a trajektóriami."""
    return {
        "cells": _cache["cells"],
        "updated_at": _cache["updated_at"],
        "count": len(_cache["cells"]),
    }


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "cells": len(_cache["cells"]),
        "updated_at": _cache["updated_at"],
        "error": _cache["error"],
    }
