"""Check MARSAD's "dark, water-like" radar measure in Sindh against an independent water map.

The independent map is NASA OPERA DSWx-HLS (surface water seen by Landsat and Sentinel-2), read
as a picture from NASA GIBS: blue = open water, light blue = partial surface water, grey = cloud.

For every NISAR date we take the DSWx picture closest in time (within 6 days) with little cloud and:
  * add its water area to public/data/sindh.json (series key "optical_water_km2")
  * count how the two maps agree, cell by cell (written under "water_check"):
      - where the optical map has open water, how often is the radar dark?
      - how much of the radar-dark area does the optical map confirm as water?

Usage: python water_check.py
"""
import datetime as dt
import json
import os
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from PIL import Image

import build
from optical import OUT, get
from sites import SITES

LAYER = "OPERA_L3_Dynamic_Surface_Water_Extent-HLS"
SITE, TRACK = "sindh", "041_A_015"
OPEN, PARTIAL, CLOUD = (0, 0, 255), (180, 213, 244), (175, 175, 175)


def is_colour(a, c):
    return (a[..., 0] == c[0]) & (a[..., 1] == c[1]) & (a[..., 2] == c[2])


def main():
    path = os.path.join(OUT, SITE + ".json")
    meta = json.load(open(path))
    bbox, (w, h) = meta["bbox"], meta["size"]
    grid = build.Grid(bbox, SITES[SITE]["cell_m"])
    rows = meta["tracks"][TRACK]["series"]
    dates = [r["date"] for r in rows]
    days = sorted({(dt.date.fromisoformat(d) + dt.timedelta(k)).isoformat() for d in dates for k in range(-6, 7)})

    def fetch(day):
        im = get(LAYER, day, bbox, w, h)
        if im is None:
            return day, None
        a = np.asarray(im)
        seen = a[..., 3] > 0
        if seen.mean() < 0.97:
            return day, None
        return day, a

    with ThreadPoolExecutor(10) as ex:
        maps = {d: a for d, a in ex.map(fetch, days) if a is not None}
    open_dark, dark_water = [], []
    for r in rows:
        d0 = dt.date.fromisoformat(r["date"])
        best = None
        for day, a in maps.items():
            gap = abs((dt.date.fromisoformat(day) - d0).days)
            cloud = float(is_colour(a, CLOUD).mean() * 100)
            if gap <= 6 and cloud < 5 and (best is None or (gap, cloud) < best[:2]):
                best = (gap, cloud, day, a)
        for k in ("optical_water_km2", "optical_open_km2", "optical_date"):
            r.pop(k, None)
        if best is None:
            continue
        gap, cloud, day, a = best
        open_w, partial = is_colour(a, OPEN), is_colour(a, PARTIAL)
        water = open_w | partial
        r["optical_water_km2"] = round(float(water.sum() * grid.cell_km2), 1)
        r["optical_open_km2"] = round(float(open_w.sum() * grid.cell_km2), 1)
        r["optical_date"] = day
        # the radar mask, made exactly as in build.py
        img = np.asarray(Image.open(os.path.join(OUT, SITE, TRACK, f"{r['date']}_hh.webp")).convert("L")).astype("float32")
        lo, hi = build.STRETCH["HHHH"]
        power = np.where(img > 0, 10 ** ((lo + (img - 1) / 254 * (hi - lo)) / 10), np.nan)
        dark = build.db(build.smooth(power, 3)) < -16.0
        # allow two cells (80 m) of mismatch: the two maps are a few days apart and differently gridded
        a_pct = 100 * (grow(dark) & open_w).sum() / max(open_w.sum(), 1)
        b_pct = 100 * (dark & grow(water)).sum() / max(dark.sum(), 1)
        if open_w.sum() * grid.cell_km2 >= 10:
            open_dark.append(a_pct)
        dark_water.append(b_pct)
        print(r["date"], "optical", day, f"cloud {cloud:.1f}%", "radar dark", r["dark_km2"], "optical water", r["optical_water_km2"],
              f"| open water that is radar-dark {a_pct:.0f}% | radar-dark that is water {b_pct:.0f}%")
    meta["water_check"] = {
        "source": "NASA OPERA DSWx-HLS via NASA GIBS", "dates_compared": len(dark_water), "tolerance_cells": 2,
        "open_water_that_is_radar_dark_pct": [round(min(open_dark)), round(max(open_dark))],
        "radar_dark_confirmed_as_water_pct": [round(min(dark_water)), round(max(dark_water))],
    }
    print(meta["water_check"])
    json.dump(meta, open(path, "w"), indent=1)


def grow(mask, n=2):
    """Grow a mask by n cells in every direction."""
    out = mask.copy()
    for _ in range(n):
        m = out.copy()
        m[1:] |= out[:-1]; m[:-1] |= out[1:]; m[:, 1:] |= out[:, :-1]; m[:, :-1] |= out[:, 1:]
        out = m
    return out


if __name__ == "__main__":
    main()
