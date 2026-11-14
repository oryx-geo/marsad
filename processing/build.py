"""Turn the cached NISAR windows into the small files the website shows.

Usage:  python build.py            (all sites)   |   python build.py sindh
Input:  processing/cache/<site>/<track>/<date>.npz   (made by fetch.py)
Output: public/data/<site>/<track>/<date>_<hh|hv>.webp  and  public/data/<site>.json

Every number in the JSON files is computed here from the NISAR data.
"""
import glob
import json
import os
import sys
import warnings

import numpy as np
from PIL import Image
from pyproj import Transformer

from sites import SITES

warnings.filterwarnings("ignore", category=RuntimeWarning)
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
OUT = os.path.join(HERE, "..", "public", "data")

# display stretch in decibels (gamma-0 backscatter)
STRETCH = {"HHHH": (-22.0, -2.0), "HVHV": (-30.0, -10.0)}
R_EARTH = 6378137.0


def merc_y(lat):
    return np.log(np.tan(np.pi / 4 + np.radians(lat) / 2))


def inv_merc_y(y):
    return np.degrees(2 * np.arctan(np.exp(y)) - np.pi / 2)


def multilook(power, k):
    """Average k x k pixels in linear power (reduces speckle)."""
    p = np.where(power > 0, power, np.nan)
    h, w = (p.shape[0] // k) * k, (p.shape[1] // k) * k
    return np.nanmean(p[:h, :w].reshape(h // k, k, w // k, k), axis=(1, 3))


class Grid:
    """Output grid: north-up, linear in longitude and in Web-Mercator y."""

    def __init__(self, bbox, cell_m):
        w, s, e, n = bbox
        mid = np.radians((s + n) / 2)
        self.bbox = bbox
        self.W = int(round(np.radians(e - w) * R_EARTH * np.cos(mid) / cell_m))
        self.H = int(round((merc_y(n) - merc_y(s)) * R_EARTH * np.cos(mid) / cell_m))
        self.lon = w + (np.arange(self.W) + 0.5) * (e - w) / self.W
        self.lat = inv_merc_y(merc_y(n) - (np.arange(self.H) + 0.5) * (merc_y(n) - merc_y(s)) / self.H)
        self.cell_km2 = (cell_m / 1000.0) ** 2

    def warp(self, d, pol, cell_m):
        """Resample one cached window (UTM) onto this grid. Returns linear power."""
        x, y = d["x"], d["y"]
        dx = abs(float(x[1] - x[0]))
        k = max(1, int(round(cell_m / dx)))
        p = multilook(d[pol], k)
        xm = x[: p.shape[1] * k].reshape(-1, k).mean(1)
        ym = y[: p.shape[0] * k].reshape(-1, k).mean(1)
        lon2, lat2 = np.meshgrid(self.lon, self.lat)
        X, Y = Transformer.from_crs(4326, int(d["epsg"]), always_xy=True).transform(lon2, lat2)
        ci = np.rint((X - xm[0]) / (xm[1] - xm[0])).astype(int)
        ri = np.rint((Y - ym[0]) / (ym[1] - ym[0])).astype(int)
        ok = (ci >= 0) & (ci < p.shape[1]) & (ri >= 0) & (ri < p.shape[0])
        out = np.full(lon2.shape, np.nan, dtype="float32")
        out[ok] = p[ri[ok], ci[ok]]
        return out

    def window(self, lon0, lon1, lat0, lat1):
        """Boolean mask of a lon/lat box on this grid."""
        return np.outer((self.lat >= lat0) & (self.lat <= lat1), (self.lon >= lon0) & (self.lon <= lon1))


def db(power):
    return 10 * np.log10(power)


def mean_db(power, mask=None):
    v = power if mask is None else power[mask]
    return round(float(db(np.nanmean(v))), 2)


def smooth(power, k=3):
    """k x k box mean in power, same shape (edge cells use what is available)."""
    p = np.nan_to_num(power, nan=0.0)
    n = np.isfinite(power).astype("float32")
    for a in (0, 1):
        p = sum(np.roll(p, s, a) for s in range(-(k // 2), k // 2 + 1))
        n = sum(np.roll(n, s, a) for s in range(-(k // 2), k // 2 + 1))
    return np.where(n > 0, p / np.maximum(n, 1), np.nan)


def save_image(power, pol, path):
    lo, hi = STRETCH[pol]
    v = (db(power) - lo) / (hi - lo)
    img = np.where(np.isfinite(v), np.clip(v, 0, 1) * 254 + 1, 0).astype("uint8")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(img, "L").save(path, "WEBP", quality=80, method=6)


# ---------- per-site numbers -------------------------------------------------

def stats_sindh(grid, layers):
    """Dark, smooth surfaces (mostly open water): HH below -16 dB on ~90 m cells."""
    hh = smooth(layers["HHHH"], 3)
    valid = np.isfinite(hh)
    dark = valid & (db(hh) < -16.0)
    return {
        "dark_pct": round(float(dark.sum() / valid.sum() * 100), 2),
        "dark_km2": round(float(dark.sum() * grid.cell_km2), 1),
        "hh_db": mean_db(layers["HHHH"]),
        "hv_db": mean_db(layers["HVHV"]),
    }


MANAH_BOXES = {
    "west": (57.648, 57.667, 22.600, 22.616),
    "east": (57.676, 57.692, 22.600, 22.616),
    "desert": (57.625, 57.640, 22.585, 22.593),
}


def stats_manah(grid, layers):
    out = {}
    for name, b in MANAH_BOXES.items():
        m = grid.window(*b)
        out[name + "_hh_db"] = mean_db(layers["HHHH"], m)
        out[name + "_hv_db"] = mean_db(layers["HVHV"], m)
    return out


def stats_salalah(grid, layers):
    m = grid.window(53.95, 54.45, 17.09, 17.25)  # the monsoon-facing mountain belt
    return {"mountain_hh_db": mean_db(layers["HHHH"], m), "mountain_hv_db": mean_db(layers["HVHV"], m)}


def stats_mean(grid, layers):
    return {("hh_db" if p == "HHHH" else "hv_db"): mean_db(v) for p, v in layers.items()}


STATS = {"sindh": stats_sindh, "manah": stats_manah, "salalah": stats_salalah}


def changed_pct(first, now):
    """Share of the area whose brightness moved by more than 3 dB since the first date (~3x3 cells)."""
    a, b = smooth(first, 3), smooth(now, 3)
    d = db(b) - db(a)
    ok = np.isfinite(d)
    return round(float((np.abs(d[ok]) > 3).mean() * 100), 2)


def build(site):
    cfg = SITES[site]
    grid = Grid(cfg["bbox"], cfg["cell_m"])
    meta = {"id": site, "bbox": cfg["bbox"], "size": [grid.W, grid.H], "cell_m": cfg["cell_m"],
            "stretch_db": {"hh": STRETCH["HHHH"], "hv": STRETCH["HVHV"]}, "tracks": {}}
    for track in cfg["tracks"]:
        files = sorted(glob.glob(os.path.join(CACHE, site, track, "*.npz")))
        rows, first = [], {}
        for f in files:
            date = os.path.basename(f)[:10]
            d = np.load(f)
            layers = {p: grid.warp(d, p, cfg["cell_m"]) for p in ("HHHH", "HVHV") if p in d.files}
            for p, v in layers.items():
                save_image(v, p, os.path.join(OUT, site, track, f"{date}_{p[:2].lower()}.webp"))
            row = {"date": date, **STATS.get(site, stats_mean)(grid, layers)}
            for p, v in layers.items():
                first.setdefault(p, v)
                row[f"changed_{p[:2].lower()}_pct"] = changed_pct(first[p], v)
            rows.append(row)
            print(site, track, row, flush=True)
        meta["tracks"][track] = {"pols": [p[:2].lower() for p in layers], "dates": [r["date"] for r in rows], "series": rows}
    with open(os.path.join(OUT, site + ".json"), "w") as fh:
        json.dump(meta, fh, indent=1)


if __name__ == "__main__":
    for s in sys.argv[1:] or list(SITES):
        build(s)
