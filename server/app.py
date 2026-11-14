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
_cache, _hits, _slots = {}, {}, threading.Semaphore(MAX_AT_ONCE)


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
    for pol in pair["pols"]:
        if pol not in a or pol not in b:
            continue
        pa, pb = grid.warp(a, pol, CELL_M), grid.warp(b, pol, CELL_M)
        d = build.db(build.smooth(pb, 3)) - build.db(build.smooth(pa, 3))
        ok = np.isfinite(d)
        if ok.mean() < 0.5:
            continue
        out["channels"][pol[:2].lower()] = {
            "before": png(pa, pol), "after": png(pb, pol),
            "before_db": round(float(build.db(np.nanmean(pa))), 1), "after_db": round(float(build.db(np.nanmean(pb))), 1),
            "brighter_pct": round(float((d[ok] > 3).mean() * 100), 1), "darker_pct": round(float((d[ok] < -3).mean() * 100), 1),
            "stretch_db": list(build.STRETCH[pol]),
        }
    if not out["channels"]:
        return {"found": False, "bbox": bbox}
    return out


@app.get("/health")
def health():
    return {"ok": True, "box_km": BOX_KM, "token": bool(os.environ.get("EARTHDATA_TOKEN"))}


@app.get("/analyze")
def analyze(lon: float, lat: float, request: Request):
    if not (-180 <= lon <= 180 and -85 <= lat <= 85):
        raise HTTPException(400, "bad coordinates")
    key = (round(lon, 2), round(lat, 2))
    if key in _cache:
        return _cache[key]
    who = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "?")).split(",")[0].strip()
    now = time.time()
    _hits[who] = [t for t in _hits.get(who, []) if now - t < 60]
    if len(_hits[who]) >= MAX_PER_MINUTE:
        raise HTTPException(429, "too many requests, wait a minute")
    _hits[who].append(now)
    if not _slots.acquire(timeout=5):
        raise HTTPException(503, "busy, try again in a minute")
    try:
        result = analyse(key[0], key[1])
    except Exception as ex:  # never leak details (they could include a signed URL)
        print("analysis failed:", type(ex).__name__, flush=True)
        raise HTTPException(502, "could not read NISAR data")
    finally:
        _slots.release()
    if len(_cache) > 200:
        _cache.clear()
    _cache[key] = result
    return result
