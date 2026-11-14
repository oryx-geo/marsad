"""True-colour pictures from NASA HLS (Harmonized Landsat Sentinel-2), through NASA GIBS.

For every NISAR date of every site, pick the HLS picture closest in time (within 8 days) that
covers the site, preferring the least cloudy one, and save it on the same grid as the radar image.

Usage:  python optical.py            (all sites)   |   python optical.py manah
Output: public/data/<site>/optical/<date>.jpg  and an "optical" table inside public/data/<site>.json
No login is needed for GIBS.
"""
import datetime as dt
import io
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import requests
from PIL import Image

from sites import SITES

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "public", "data")
WMS = "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi"
LAYERS = {"S30": "HLS_S30_Nadir_BRDF_Adjusted_Reflectance", "L30": "HLS_L30_Nadir_BRDF_Adjusted_Reflectance"}
R = 6378137.0
MAX_DAYS = 8


def merc(lon, lat):
    return R * np.radians(lon), R * np.log(np.tan(np.pi / 4 + np.radians(lat) / 2))


def get(layer, day, bbox, w, h):
    x0, y0 = merc(bbox[0], bbox[1])
    x1, y1 = merc(bbox[2], bbox[3])
    params = {"SERVICE": "WMS", "REQUEST": "GetMap", "VERSION": "1.3.0", "STYLES": "", "FORMAT": "image/png",
              "TRANSPARENT": "TRUE", "LAYERS": layer, "CRS": "EPSG:3857", "BBOX": f"{x0},{y0},{x1},{y1}",
              "WIDTH": w, "HEIGHT": h, "TIME": day}
    for _ in range(3):
        try:
            r = requests.get(WMS, params=params, timeout=90)
            if r.status_code == 200 and r.headers.get("content-type", "").startswith("image"):
                return Image.open(io.BytesIO(r.content)).convert("RGBA")
        except requests.RequestException:
            pass
    return None


def score(args):
    """Small preview: how much of the site is covered, and how much looks like cloud."""
    sensor, day, bbox = args
    im = get(LAYERS[sensor], day, bbox, 96, 96)
    if im is None:
        return None
    a = np.asarray(im).astype("int32")
    seen = (a[..., 3] > 0) & (a[..., :3].sum(2) > 0)
    if seen.mean() < 0.97:
        return None
    rgb = a[..., :3]
    cloud = (rgb.min(2) > 190) & (rgb.max(2) - rgb.min(2) < 40)   # bright and grey
    return {"sensor": sensor, "date": day, "cloud_pct": round(float(cloud[seen].mean() * 100), 1)}


def build(site):
    path = os.path.join(OUT, site + ".json")
    meta = json.load(open(path))
    bbox = meta["bbox"]
    w, h = meta["size"]
    scale = min(1.0, 1500 / w)
    w, h = int(w * scale), int(h * scale)
    nisar = sorted({d for t in meta["tracks"].values() for d in t["dates"]})
    days = sorted({(dt.date.fromisoformat(d) + dt.timedelta(k)).isoformat() for d in nisar for k in range(-MAX_DAYS, MAX_DAYS + 1)})
    jobs = [(s, d, bbox) for d in days for s in LAYERS]
    with ThreadPoolExecutor(12) as ex:
        found = [f for f in ex.map(score, jobs) if f]
    table = {}
    for d in nisar:
        d0 = dt.date.fromisoformat(d)
        near = [dict(f, gap=abs((dt.date.fromisoformat(f["date"]) - d0).days)) for f in found]
        near = [f for f in near if f["gap"] <= MAX_DAYS]
        if not near:
            table[d] = None
            continue
        # snow and ice look like cloud, so on the glacier just take the closest picture
        key = (lambda f: f["gap"]) if site == "jakobshavn" else (lambda f: (round(f["cloud_pct"] / 10), f["gap"]))
        best = min(near, key=key)
        table[d] = {k: best[k] for k in ("date", "sensor", "cloud_pct", "gap")}
    os.makedirs(os.path.join(OUT, site, "optical"), exist_ok=True)

    def save(pick):
        out = os.path.join(OUT, site, "optical", f"{pick[1]}_{pick[0]}.jpg")
        if not os.path.exists(out):
            im = get(LAYERS[pick[0]], pick[1], bbox, w, h)
            if im is not None:
                im.convert("RGB").save(out, "JPEG", quality=78, optimize=True)
        return out

    picks = sorted({(v["sensor"], v["date"]) for v in table.values() if v})
    with ThreadPoolExecutor(6) as ex:
        list(ex.map(save, picks))
    meta["optical"] = {"source": "NASA HLS via NASA GIBS", "by_nisar_date": table}
    json.dump(meta, open(path, "w"), indent=1)
    print(site, "NISAR dates:", len(nisar), "with optical:", sum(v is not None for v in table.values()), "pictures:", len(picks), flush=True)


if __name__ == "__main__":
    for s in sys.argv[1:] or list(SITES):
        build(s)
