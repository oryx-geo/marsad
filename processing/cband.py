"""Sentinel-1 C-band pictures (NASA OPERA RTC-S1, through NASA GIBS) next to every NISAR date.

GIBS serves OPERA RTC-S1 as a colour picture: red and blue carry the VV channel, green carries VH.
We split it into two grey pictures on the same grid as the NISAR images. These are display pictures,
not calibrated decibels, so MARSAD uses them only for looking, never for numbers.

Usage:  python cband.py            (all sites)   |   python cband.py salalah
Output: public/data/<site>/cband/<date>_<vv|vh>.jpg  and a "cband" table inside public/data/<site>.json
"""
import datetime as dt
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from PIL import Image

from optical import OUT, get
from sites import SITES

LAYER = "OPERA_L2_Radiometric_Terrain_Corrected_SAR_Sentinel-1"
MAX_DAYS = 8


def covered(args):
    day, bbox = args
    im = get(LAYER, day, bbox, 96, 96)
    if im is None:
        return None
    a = np.asarray(im)
    return day if (a[..., 3] > 0).mean() > 0.97 else None


def build(site):
    path = os.path.join(OUT, site + ".json")
    meta = json.load(open(path))
    bbox = meta["bbox"]
    w, h = meta["size"]
    scale = min(1.0, 1000 / w)
    w, h = int(w * scale), int(h * scale)
    nisar = sorted({d for t in meta["tracks"].values() for d in t["dates"]})
    days = sorted({(dt.date.fromisoformat(d) + dt.timedelta(k)).isoformat() for d in nisar for k in range(-MAX_DAYS, MAX_DAYS + 1)})
    with ThreadPoolExecutor(12) as ex:
        found = sorted(d for d in ex.map(covered, [(d, bbox) for d in days]) if d)
    table = {}
    for d in nisar:
        d0 = dt.date.fromisoformat(d)
        near = [(abs((dt.date.fromisoformat(f) - d0).days), f) for f in found]
        near = [x for x in near if x[0] <= MAX_DAYS]
        table[d] = {"date": min(near)[1], "gap": min(near)[0]} if near else None
    os.makedirs(os.path.join(OUT, site, "cband"), exist_ok=True)

    def save(day):
        out = os.path.join(OUT, site, "cband", f"{day}_vv.jpg")
        if os.path.exists(out):
            return
        im = get(LAYER, day, bbox, w, h)
        if im is None:
            return
        a = np.asarray(im.convert("RGB"))
        Image.fromarray(a[..., 0], "L").save(out, "JPEG", quality=68, optimize=True)
        Image.fromarray(a[..., 1], "L").save(out.replace("_vv", "_vh"), "JPEG", quality=68, optimize=True)

    picks = sorted({v["date"] for v in table.values() if v})
    with ThreadPoolExecutor(6) as ex:
        list(ex.map(save, picks))
    meta["cband"] = {"source": "NASA OPERA RTC-S1 (Sentinel-1, ESA) via NASA GIBS", "by_nisar_date": table}
    json.dump(meta, open(path, "w"), indent=1)
    print(site, "NISAR dates:", len(nisar), "with C-band:", sum(v is not None for v in table.values()), "pictures:", len(picks), flush=True)


if __name__ == "__main__":
    for s in sys.argv[1:] or list(SITES):
        build(s)
