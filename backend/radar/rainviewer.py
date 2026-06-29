"""
Stiahne radar snímky z Rainviewer API a vráti ich ako numpy arrays.
Rainviewer poskytuje posledných ~12 snímkov (každých 10 minút).
"""

import asyncio
import io
from dataclasses import dataclass
from datetime import datetime

import httpx
import numpy as np


RAINVIEWER_API = "https://api.rainviewer.com/public/weather-maps.json"

# Bounding box Slovenska + okolie pre istotu
SLOVAKIA_BBOX = {"lat_min": 47.5, "lat_max": 49.8, "lon_min": 16.5, "lon_max": 23.0}

# Rainviewer tile size na zoom 6
TILE_SIZE = 256
ZOOM = 6


@dataclass
class RadarFrame:
    timestamp: int          # unix epoch
    dt: datetime
    data: np.ndarray        # float32 array, hodnoty 0-255 (reflektivita)
    # Metadata pre georeferencovanie
    lat_min: float
    lat_max: float
    lon_min: float
    lon_max: float


def _tile_to_latlon(x: int, y: int, z: int) -> tuple[float, float]:
    """Maplibre/OSM tile coords → lat, lon ľavého horného rohu."""
    n = 2 ** z
    lon = x / n * 360.0 - 180.0
    lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * y / n))))
    return lat, lon


def _latlon_to_tile(lat: float, lon: float, z: int) -> tuple[int, int]:
    n = 2 ** z
    x = int((lon + 180.0) / 360.0 * n)
    y = int((1 - np.log(np.tan(np.radians(lat)) + 1 / np.cos(np.radians(lat))) / np.pi) / 2 * n)
    return x, y


def _get_tiles_for_bbox(lat_min: float, lat_max: float, lon_min: float, lon_max: float, z: int):
    """Vráti rozsah tiles pokrývajúci bbox."""
    x0, y0 = _latlon_to_tile(lat_max, lon_min, z)  # top-left (y je prevrátené)
    x1, y1 = _latlon_to_tile(lat_min, lon_max, z)  # bottom-right
    return x0, y0, x1, y1


async def fetch_radar_frames(client: httpx.AsyncClient, n_frames: int = 6) -> list[RadarFrame]:
    """
    Stiahne posledných n_frames radarových snímkov z Rainviewer.
    Vracia list RadarFrame zoradený od najstaršieho po najnovší.
    """
    resp = await client.get(RAINVIEWER_API, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    frames_meta = data.get("radar", {}).get("past", [])
    frames_meta = frames_meta[-n_frames:]  # posledných N

    if not frames_meta:
        raise ValueError("Rainviewer nevrátil žiadne snímky")

    host = data.get("host", "https://tilecache.rainviewer.com")

    frames: list[RadarFrame] = []
    for meta in frames_meta:
        ts = meta["time"]
        path = meta["path"]
        frame = await _fetch_single_frame(client, host, path, ts)
        frames.append(frame)

    return frames


async def _fetch_single_frame(
    client: httpx.AsyncClient, host: str, path: str, timestamp: int
) -> RadarFrame:
    """Stiahne tiles pre jeden snímok a poskladá ich do jedného numpy array."""
    bb = SLOVAKIA_BBOX
    x0, y0, x1, y1 = _get_tiles_for_bbox(
        bb["lat_min"], bb["lat_max"], bb["lon_min"], bb["lon_max"], ZOOM
    )

    tile_tasks = []
    positions = []
    for ty in range(y0, y1 + 1):
        for tx in range(x0, x1 + 1):
            # Rainviewer tile URL: /v2/radar/{timestamp}/{size}/{z}/{x}/{y}/1/1_1.png
            url = f"{host}{path}/{TILE_SIZE}/{ZOOM}/{tx}/{ty}/1/1_1.png"
            tile_tasks.append(client.get(url, timeout=15))
            positions.append((tx - x0, ty - y0))

    responses = await asyncio.gather(*tile_tasks, return_exceptions=True)

    cols = x1 - x0 + 1
    rows = y1 - y0 + 1
    canvas = np.zeros((rows * TILE_SIZE, cols * TILE_SIZE), dtype=np.float32)

    for (col, row), resp in zip(positions, responses):
        if isinstance(resp, Exception) or resp.status_code != 200:
            continue
        img = _decode_png_to_array(resp.content)
        if img is None:
            continue
        y_off = row * TILE_SIZE
        x_off = col * TILE_SIZE
        canvas[y_off:y_off + TILE_SIZE, x_off:x_off + TILE_SIZE] = img

    lat_top, lon_left = _tile_to_latlon(x0, y0, ZOOM)
    lat_bot, lon_right = _tile_to_latlon(x1 + 1, y1 + 1, ZOOM)

    return RadarFrame(
        timestamp=timestamp,
        dt=datetime.utcfromtimestamp(timestamp),
        data=canvas,
        lat_min=lat_bot,
        lat_max=lat_top,
        lon_min=lon_left,
        lon_max=lon_right,
    )


def _decode_png_to_array(content: bytes) -> np.ndarray | None:
    """PNG bajty → grayscale float32 array [0-255]."""
    try:
        import cv2
        buf = np.frombuffer(content, dtype=np.uint8)
        img = cv2.imdecode(buf, cv2.IMREAD_UNCHANGED)
        if img is None:
            return None
        if img.ndim == 3:
            # RGBA → alpha kanál = intenzita v Rainviewer tiles
            return img[:, :, 3].astype(np.float32)
        return img.astype(np.float32)
    except Exception:
        return None
