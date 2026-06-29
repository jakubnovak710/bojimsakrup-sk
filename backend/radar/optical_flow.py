"""
Optický tok (Farneback) na radarových snímkoch → pohybové vektory búrkových buniek.
Každá bunka = lokálne maximum nad dBZ prahom.
"""

import math
from dataclasses import dataclass, field

import cv2
import numpy as np
from scipy.ndimage import label, maximum_filter, minimum_filter

from .rainviewer import RadarFrame


DBZ_THRESHOLD = 35.0    # minimálna intenzita pre deteciu bunky (rain)
HAIL_DBZ = 50.0         # prah pre riziko krupobitia
MIN_CELL_AREA_PX = 20   # minimum pixelov — filtruje šum


@dataclass
class CellVector:
    """Pohybový vektor jednej búrkovej bunky."""
    id: str
    lat: float
    lon: float
    dbz: float
    vx_px: float          # rýchlosť v pixeloch/snímok (x = lon smer)
    vy_px: float          # rýchlosť v pixeloch/snímok (y = lat smer, prevrátené)
    speed_kmh: float
    direction_deg: float  # meteorologická konvencia: 0=S, 90=V, 180=J, 270=Z
    trajectory: list[dict] = field(default_factory=list)  # [{lat, lon, eta_min}]
    trend: str = "stable"     # "growing" | "stable" | "weakening"
    dbz_delta: float = 0.0    # zmena dBZ za 10 minút
    confidence: float = 1.0   # 1.0 = 100%, klesá s časom projekcie


def compute_optical_flow(frame_old: RadarFrame, frame_new: RadarFrame) -> np.ndarray:
    """
    Farneback optický tok medzi dvoma snímkami.
    Vracia flow array tvaru (H, W, 2) — (vx, vy) v pixeloch.
    """
    f_old = _normalize(frame_old.data)
    f_new = _normalize(frame_new.data)

    flow = cv2.calcOpticalFlowFarneback(
        f_old, f_new,
        flow=None,
        pyr_scale=0.5,
        levels=3,
        winsize=15,
        iterations=3,
        poly_n=5,
        poly_sigma=1.2,
        flags=0,
    )
    return flow  # shape (H, W, 2)


def detect_cells(frame: RadarFrame, prev_frame: RadarFrame | None = None) -> list[dict]:
    """
    Nájde búrkové bunky v snímku (lokálne maximá nad prahom).
    Vráti list {'centroid_px', 'dbz', 'area_px', 'lat', 'lon'}.
    """
    data = frame.data
    mask = data >= DBZ_THRESHOLD

    # Morfologické filtrovanie — odstrání šum
    kernel = np.ones((3, 3), dtype=np.uint8)
    mask_clean = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_OPEN, kernel)

    labeled, n_labels = label(mask_clean)
    cells = []

    for i in range(1, n_labels + 1):
        region = labeled == i
        area = int(region.sum())
        if area < MIN_CELL_AREA_PX:
            continue

        ys, xs = np.where(region)
        cy = float(ys.mean())
        cx = float(xs.mean())
        max_dbz = float(data[region].max())

        lat, lon = _px_to_latlon(cx, cy, frame)

        cells.append({
            "centroid_px": (cx, cy),
            "dbz": max_dbz,
            "area_px": area,
            "lat": lat,
            "lon": lon,
        })

    return cells


def track_cells(
    frames: list[RadarFrame],
    time_between_frames_min: float = 10.0,
) -> list[CellVector]:
    """
    Hlavná funkcia: zo sekvencie snímkov vyráta pohybové vektory buniek.
    Potrebuje aspoň 2 snímky.
    """
    if len(frames) < 2:
        return []

    # Optický tok medzi poslednými dvoma snímkami
    flow = compute_optical_flow(frames[-2], frames[-1])

    # Detekcia buniek v najnovšom snímku
    current_cells = detect_cells(frames[-1], frames[-2])

    # Trend: porovnaj dBZ s predchádzajúcim snímkom
    prev_cells = detect_cells(frames[-2]) if len(frames) >= 2 else []

    vectors: list[CellVector] = []

    for i, cell in enumerate(current_cells):
        cx, cy = cell["centroid_px"]
        cx_i, cy_i = int(round(cx)), int(round(cy))

        # Priemerný flow v okolí centroidu (5×5 okno)
        h, w = flow.shape[:2]
        x0 = max(0, cx_i - 2); x1 = min(w, cx_i + 3)
        y0 = max(0, cy_i - 2); y1 = min(h, cy_i + 3)
        patch = flow[y0:y1, x0:x1]
        vx = float(patch[:, :, 0].mean())  # px/frame, + = smer vpravo (V)
        vy = float(patch[:, :, 1].mean())  # px/frame, + = smer dolu (J)

        speed_kmh, direction_deg = _flow_to_speed_direction(
            vx, vy, frames[-1], time_between_frames_min
        )

        # Trend
        nearby_prev = _find_nearest_cell(cell["lat"], cell["lon"], prev_cells, max_dist_km=15)
        dbz_delta = 0.0
        trend = "stable"
        if nearby_prev:
            dbz_delta = cell["dbz"] - nearby_prev["dbz"]
            if dbz_delta > 3:
                trend = "growing"
            elif dbz_delta < -3:
                trend = "weakening"

        # Projekcia trajektórie
        trajectory = _project_trajectory(
            cell["lat"], cell["lon"],
            direction_deg, speed_kmh,
            steps=[15, 30, 45, 60],
            trend=trend,
        )

        vectors.append(CellVector(
            id=f"cell-{i:03d}",
            lat=cell["lat"],
            lon=cell["lon"],
            dbz=cell["dbz"],
            vx_px=vx,
            vy_px=vy,
            speed_kmh=round(speed_kmh, 1),
            direction_deg=round(direction_deg, 1),
            trajectory=trajectory,
            trend=trend,
            dbz_delta=round(dbz_delta, 1),
            confidence=1.0,
        ))

    return vectors


# ── Helpers ──────────────────────────────────────────────────────────────────

def _normalize(arr: np.ndarray) -> np.ndarray:
    """float32 [0-255] → uint8 pre OpenCV."""
    clipped = np.clip(arr, 0, 255)
    return clipped.astype(np.uint8)


def _px_to_latlon(px_x: float, px_y: float, frame: RadarFrame) -> tuple[float, float]:
    h, w = frame.data.shape
    lat = frame.lat_max - (px_y / h) * (frame.lat_max - frame.lat_min)
    lon = frame.lon_min + (px_x / w) * (frame.lon_max - frame.lon_min)
    return round(lat, 4), round(lon, 4)


def _flow_to_speed_direction(
    vx_px: float, vy_px: float,
    frame: RadarFrame,
    time_min: float,
) -> tuple[float, float]:
    """
    Konvertuje pixelový tok na km/h a meteorologický smer (0=S, 90=V).
    """
    h, w = frame.data.shape
    lat_span_km = _haversine(frame.lat_min, frame.lon_min, frame.lat_max, frame.lon_min)
    lon_span_km = _haversine(frame.lat_min, frame.lon_min, frame.lat_min, frame.lon_max)

    km_per_px_x = lon_span_km / w
    km_per_px_y = lat_span_km / h

    # px/frame → km/frame → km/h
    dx_km = vx_px * km_per_px_x
    dy_km = -vy_px * km_per_px_y  # y je prevrátené (dolu = J = záporný lat)

    speed_kmh = math.sqrt(dx_km**2 + dy_km**2) / (time_min / 60.0)

    # Meteorologický smer: 0=S, 90=V, 180=J, 270=Z
    # atan2 vráti smer pohybu od S cez V
    direction_deg = (math.degrees(math.atan2(dx_km, dy_km)) + 360) % 360

    return speed_kmh, direction_deg


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return 2 * R * math.asin(math.sqrt(a))


def _project_trajectory(
    lat: float, lon: float,
    direction_deg: float, speed_kmh: float,
    steps: list[int],
    trend: str = "stable",
) -> list[dict]:
    """
    Haversine projekcia. Spomaľuje bunky ktoré slabnú, zrýchľuje rastúce.
    Confidence klesá s každým krokom.
    """
    R = 6371.0
    points = []
    for eta_min in steps:
        # Modifikácia rýchlosti podľa trendu (zjednodušený decay model)
        speed_factor = 1.0
        if trend == "weakening":
            speed_factor = max(0.3, 1.0 - 0.15 * (eta_min / 15))
        elif trend == "growing":
            speed_factor = min(1.3, 1.0 + 0.05 * (eta_min / 15))

        dist_km = speed_kmh * speed_factor * (eta_min / 60.0)
        dir_rad = math.radians(direction_deg)
        dist_rad = dist_km / R
        lat_rad = math.radians(lat)
        lon_rad = math.radians(lon)

        new_lat = math.asin(
            math.sin(lat_rad) * math.cos(dist_rad) +
            math.cos(lat_rad) * math.sin(dist_rad) * math.cos(dir_rad)
        )
        new_lon = lon_rad + math.atan2(
            math.sin(dir_rad) * math.sin(dist_rad) * math.cos(lat_rad),
            math.cos(dist_rad) - math.sin(lat_rad) * math.sin(new_lat)
        )

        # Confidence klesá: 15min≈85%, 30min≈70%, 45min≈55%, 60min≈40%
        confidence = max(0.25, 1.0 - (eta_min / 60.0) * 0.6)

        points.append({
            "lat": round(math.degrees(new_lat), 4),
            "lon": round(math.degrees(new_lon), 4),
            "eta_min": eta_min,
            "confidence": round(confidence, 2),
        })

    return points


def _find_nearest_cell(lat: float, lon: float, cells: list[dict], max_dist_km: float) -> dict | None:
    best = None
    best_dist = float("inf")
    for c in cells:
        d = _haversine(lat, lon, c["lat"], c["lon"])
        if d < best_dist and d <= max_dist_km:
            best_dist = d
            best = c
    return best
