"""MARSAD live analysis server ("analyse any place").

It runs on a computer that holds a NASA Earthdata token in the environment variable
EARTHDATA_TOKEN. The website asks it to compare the first and the latest NISAR picture
of a small square around a point. The token never leaves this computer.

Start:  python -m uvicorn app:app --host 127.0.0.1 --port 8000     (from the server folder)
"""
import base64
import io
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "processing"))
import build  # noqa: E402
import fetch  # noqa: E402

BOX_KM = 10.0          # side of the analysed square
CELL_M = 20            # picture cell size
MAX_PER_MINUTE = 4     # per visitor
MAX_AT_ONCE = 2        # analyses running together
CHANNELS = {"SH": ["HHHH"], "DH": ["HHHH", "HVHV"], "QP": ["HHHH", "HVHV"], "QD": ["HHHH", "HVHV"]}
STABLE = ("C3622241360-ASF", "C2854338529-ASF")   # V1 and provisional products (comparable calibration)

app = FastAPI(title="MARSAD live analysis")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://oryx-geo.github.io", "http://localhost:5173", "http://localhost:4173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)
_cache, _hits, _jobs, _lock = {}, {}, set(), threading.Lock()


def box_around(lon, lat):
    dlat = BOX_KM / 2 / 110.574
    dlon = BOX_KM / 2 / (111.320 * np.cos(np.radians(lat)))
    return [lon - dlon, lat - dlat, lon + dlon, lat + dlat]


def inside(poly, x, y):
    """Is the point inside the polygon (ray casting)?"""
    hit = False
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            hit = not hit
    return hit


def choose_pair(bbox):
    """Pick one orbit that fully covers the square and its first and latest date."""
    import json
    import urllib.parse
    import urllib.request
    w, s, e, n = bbox
    groups = {}
    for col in fetch.COLLECTIONS:
        q = urllib.parse.urlencode({"collection_concept_id": col, "bounding_box": ",".join(f"{v:.5f}" for v in bbox), "page_size": 1000})
        with urllib.request.urlopen("https://cmr.earthdata.nasa.gov/search/granules.umm_json?" + q, timeout=60) as r:
            items = json.load(r)["items"]
        for it in items:
            u = it["umm"]
            p = u["GranuleUR"].split("_")
            mode = p[9][:2]
            if mode not in CHANNELS:
                continue
            pts = u["SpatialExtent"]["HorizontalSpatialDomain"]["Geometry"]["GPolygons"][0]["Boundary"]["Points"]
            poly = [(q["Longitude"], q["Latitude"]) for q in pts]
            if not all(inside(poly, x, y) for x, y in ((w, s), (e, s), (w, n), (e, n))):
                continue
            urls = [x["URL"] for x in u.get("RelatedUrls", []) if x["URL"].startswith("https") and x["URL"].endswith(".h5")]
            if not urls:
                continue
            date = u["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"][:10]
            key = (p[5], p[6], p[7], len(CHANNELS[mode]))
            groups.setdefault(key, {}).setdefault(date, {"url": urls[0], "stable": col in STABLE, "mode": mode})
    best = None
    for key, dates in groups.items():
        stable = sorted(d for d, v in dates.items() if v["stable"])
        use = stable if len(stable) >= 2 else sorted(dates)
        if len(use) < 2:
            continue
        span = (np.datetime64(use[-1]) - np.datetime64(use[0])).astype(int)
        score = (key[3], int(span), len(use))          # prefer HH+HV, then the longest period
        if best is None or score > best[0]:
            best = (score, key, use, dates)
    if best is None:
        return None
    _, key, use, dates = best
    return {"track": key[0], "direction": key[1], "frame": key[2], "dates": use,
            "first": dates[use[0]], "last": dates[use[-1]], "pols": CHANNELS[dates[use[-1]]["mode"]]}


def png(power, pol):
    lo, hi = build.STRETCH[pol]
    v = (build.db(power) - lo) / (hi - lo)
    img = np.where(np.isfinite(v), np.clip(v, 0, 1) * 254 + 1, 0).astype("uint8")
    buf = io.BytesIO()
    Image.fromarray(img, "L").save(buf, "WEBP", quality=82)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


# ---- reading the square in plain categories --------------------------------------------------
# Thresholds in decibels (gamma-0, L-band), applied after 3 x 3 smoothing of 20 m cells.
WATER_HH = -17.0      # darker than this: calm water or very smooth ground
BUILT_HH = -5.0       # brighter than this: buildings, metal, slopes facing the radar
TREES_HV = -15.0      # stronger HV than this: trees and dense vegetation
LOWVEG_HV = -22.0     # between this and TREES_HV: crops, shrubs, rough ground; below: bare smooth ground
CHANGE_DB = 3.0       # a factor of two


def cover(hh, hv):
    """Share of the square in each surface type, in percent."""
    ok = np.isfinite(hh)
    n = max(int(ok.sum()), 1)
    water = ok & (hh < WATER_HH)
    built = ok & (hh > BUILT_HH)
    rest = ok & ~water & ~built
    out = {"water": water.sum(), "built": built.sum()}
    if hv is None:
        out["other"] = rest.sum()
    else:
        out["trees"] = (rest & (hv > TREES_HV)).sum()
        out["lowveg"] = (rest & (hv <= TREES_HV) & (hv > LOWVEG_HV)).sum()
        out["bare"] = (rest & (hv <= LOWVEG_HV)).sum()
    return {k: round(100.0 * float(v) / n, 1) for k, v in out.items()}


def read_square(a_hh, b_hh, a_hv, b_hv, cell_km2):
    """Sort every changed cell into one kind of change and say where most of it is."""
    d_hh = b_hh - a_hh
    ok = np.isfinite(d_hh)
    n = max(int(ok.sum()), 1)
    d_hv = (b_hv - a_hv) if a_hv is not None else None
    kinds = {}
    left = ok.copy()

    def take(name, mask):
        nonlocal left
        m = mask & left
        kinds[name] = m
        left = left & ~m

    take("to_water", (b_hh < WATER_HH) & (a_hh >= WATER_HH) & (d_hh < -CHANGE_DB))
    take("from_water", (a_hh < WATER_HH) & (b_hh >= WATER_HH) & (d_hh > CHANGE_DB))
    take("built_up", (b_hh > BUILT_HH) & (d_hh > CHANGE_DB))
    if d_hv is not None:
        # both channels moving together is not vegetation alone (structures, flooded plants, strong roughening)
        take("both_up", (d_hv > CHANGE_DB) & (d_hh > CHANGE_DB))
        take("both_down", (d_hv < -CHANGE_DB) & (d_hh < -CHANGE_DB))
        take("veg_up", d_hv > CHANGE_DB)
        take("veg_down", d_hv < -CHANGE_DB)
    take("brighter", d_hh > CHANGE_DB)
    take("darker", d_hh < -CHANGE_DB)
    changed = np.zeros_like(ok)
    for m in kinds.values():
        changed |= m
    where = None
    if changed.sum() > 0.005 * n:
        rows, cols = np.nonzero(changed)
        h, w = ok.shape
        dy = 0.5 - rows.mean() / h          # north is up
        dx = cols.mean() / w - 0.5
        ns = "n" if dy > 0.08 else "s" if dy < -0.08 else ""
        ew = "e" if dx > 0.08 else "w" if dx < -0.08 else ""
        where = (ns + ew) or "spread"
    changes = [{"kind": k, "pct": round(100.0 * float(m.sum()) / n, 1), "km2": round(float(m.sum()) * cell_km2, 1)}
               for k, m in kinds.items()]
    changes = sorted([c for c in changes if c["pct"] >= 0.5], key=lambda c: -c["pct"])
    return {
        "area_km2": round(n * cell_km2, 1), "has_hv": a_hv is not None,
        "cover_before": cover(a_hh, a_hv), "cover_after": cover(b_hh, b_hv),
        "changes": changes, "changed_pct": round(100.0 * float(changed.sum()) / n, 1),
        "stable_pct": round(100.0 - 100.0 * float(changed.sum()) / n, 1),
        "scene_shift_db": round(float(np.nanmedian(d_hh)), 1), "where": where,
    }, kinds


COLOURS = {"to_water": (40, 110, 255), "from_water": (0, 200, 220), "built_up": (255, 60, 60), "veg_up": (70, 200, 80),
           "both_up": (255, 120, 200), "both_down": (110, 110, 160),
           "veg_down": (190, 120, 40), "brighter": (255, 190, 40), "darker": (150, 90, 200)}


def change_picture(after_power, kinds):
    """The later picture in grey with every kind of change painted in its own colour."""
    lo, hi = build.STRETCH["HHHH"]
    g = np.clip((build.db(after_power) - lo) / (hi - lo), 0, 1)
    g = np.where(np.isfinite(g), g, 0) * 150 + 30
    rgb = np.stack([g, g, g], -1).astype("uint8")
    for name, mask in kinds.items():
        rgb[mask] = COLOURS[name]
    buf = io.BytesIO()
    Image.fromarray(rgb, "RGB").save(buf, "WEBP", quality=85)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


def real_colour(bbox, size, date):
    """Nearest real-colour picture (NASA HLS through GIBS), within 8 days. None if nothing clear."""
    import datetime as dt
    import optical
    d0 = dt.date.fromisoformat(date)
    days = [(d0 + dt.timedelta(k)).isoformat() for k in sorted(range(-8, 9), key=abs)]
    with ThreadPoolExecutor(8) as ex:
        found = [f for f in ex.map(optical.score, [(s, d, bbox) for d in days for s in optical.LAYERS]) if f]
    if not found:
        return None
    best = min(found, key=lambda f: (round(f["cloud_pct"] / 10), abs((dt.date.fromisoformat(f["date"]) - d0).days)))
    im = optical.get(optical.LAYERS[best["sensor"]], best["date"], bbox, size[0], size[1])
    if im is None:
        return None
    buf = io.BytesIO()
    im.convert("RGB").save(buf, "JPEG", quality=80)
    return {"date": best["date"], "cloud_pct": best["cloud_pct"],
            "src": "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()}


def analyse(lon, lat):
    bbox = box_around(lon, lat)
    pair = choose_pair(bbox)
    if pair is None:
        return {"found": False, "bbox": bbox}
    with ThreadPoolExecutor(2) as ex:
        a, b = ex.map(lambda g: fetch.read_window(bbox, g["url"]), (pair["first"], pair["last"]))
    grid = build.Grid(bbox, CELL_M)
    out = {"found": True, "bbox": bbox, "size": [grid.W, grid.H], "track": pair["track"], "direction": pair["direction"],
           "dates": [pair["dates"][0], pair["dates"][-1]], "passes": len(pair["dates"]), "channels": {}}
    smoothed = {}
    for pol in pair["pols"]:
        if pol not in a or pol not in b:
            continue
        pa, pb = grid.warp(a, pol, CELL_M), grid.warp(b, pol, CELL_M)
        smoothed[pol] = (build.db(build.smooth(pa, 3)), build.db(build.smooth(pb, 3)), pb)
        d = smoothed[pol][1] - smoothed[pol][0]
        ok = np.isfinite(d)
        if ok.mean() < 0.5:
            continue
        out["channels"][pol[:2].lower()] = {
            "before": png(pa, pol), "after": png(pb, pol),
            "before_db": round(float(build.db(np.nanmean(pa))), 1), "after_db": round(float(build.db(np.nanmean(pb))), 1),
            "brighter_pct": round(float((d[ok] > 3).mean() * 100), 1), "darker_pct": round(float((d[ok] < -3).mean() * 100), 1),
            "stretch_db": list(build.STRETCH[pol]),
        }
    if not out["channels"] or "HHHH" not in smoothed:
        return {"found": False, "bbox": bbox}
    a_hh, b_hh, after_power = smoothed["HHHH"]
    a_hv, b_hv = (smoothed["HVHV"][0], smoothed["HVHV"][1]) if "HVHV" in smoothed and "hv" in out["channels"] else (None, None)
    out["reading"], kinds = read_square(a_hh, b_hh, a_hv, b_hv, grid.cell_km2)
    out["change_map"] = change_picture(after_power, kinds)
    out["thresholds_db"] = {"water_hh": WATER_HH, "built_hh": BUILT_HH, "trees_hv": TREES_HV, "lowveg_hv": LOWVEG_HV, "change": CHANGE_DB}
    # real-colour pictures are fetched separately (GET /real), so the radar reading is not kept waiting
    return out


@app.get("/health")
def health():
    return {"ok": True, "box_km": BOX_KM, "token": bool(os.environ.get("EARTHDATA_TOKEN"))}


@app.get("/analyze")
def analyze(lon: float, lat: float, request: Request):
    """Start an analysis, or report on one already started.

    The answer comes back at once: {"status": "working"} while the NISAR files are being read,
    then the result. The website asks again every few seconds, so no request stays open long
    (tunnels cut long requests).
    """
    if not (-180 <= lon <= 180 and -85 <= lat <= 85):
        raise HTTPException(400, "bad coordinates")
    key = (round(lon, 2), round(lat, 2))
    with _lock:
        if key in _cache:
            return _cache[key]
        if key in _jobs:
            return {"status": "working"}
        who = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "?")).split(",")[0].strip()
        now = time.time()
        _hits[who] = [t for t in _hits.get(who, []) if now - t < 60]
        if len(_hits[who]) >= MAX_PER_MINUTE:
            raise HTTPException(429, "too many requests, wait a minute")
        if len(_jobs) >= MAX_AT_ONCE:
            raise HTTPException(503, "busy, try again in a minute")
        _hits[who].append(now)
        _jobs.add(key)
    threading.Thread(target=_run, args=(key,), daemon=True).start()
    return {"status": "working"}


def _run(key):
    try:
        result = analyse(key[0], key[1])
    except Exception as ex:  # never leak details (they could include a signed URL)
        print("analysis failed:", type(ex).__name__, flush=True)
        result = {"status": "failed"}
    with _lock:
        if len(_cache) > 200:
            _cache.clear()
        _cache[key] = result
        _jobs.discard(key)


_real = {}


@app.get("/real")
def real(lon: float, lat: float, date: str):
    """Nearest clear real-colour picture (NASA HLS) of the same 10 km square, asked for after the analysis."""
    import datetime as dt
    if not (-180 <= lon <= 180 and -85 <= lat <= 85):
        raise HTTPException(400, "bad coordinates")
    try:
        dt.date.fromisoformat(date)
    except ValueError:
        raise HTTPException(400, "bad date")
    key = (round(lon, 2), round(lat, 2), date)
    if key not in _real:
        bbox = box_around(key[0], key[1])
        size = [build.Grid(bbox, CELL_M).W, build.Grid(bbox, CELL_M).H]
        try:
            _real[key] = {"picture": real_colour(bbox, size, date)}
        except Exception as ex:
            print("real colour failed:", type(ex).__name__, flush=True)
            return {"picture": None}
    return _real[key]
