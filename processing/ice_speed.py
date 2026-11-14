"""Ice speed at Jakobshavn from NISAR, by feature tracking.

For two NISAR pictures 12 days apart, cut both into patches, and for each patch find the shift
that best lines up the crevasse pattern (cross-correlation). Shift / days = speed.
Rock does not move, so patches on rock should give about zero: that is the built-in check.

Usage: python ice_speed.py     (writes speed numbers into public/data/jakobshavn.json and a speed picture)
"""
import glob
import json
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache", "jakobshavn", "170_D_053")
OUT = os.path.join(HERE, "..", "public", "data")
PATCH, STEP, MAX_SHIFT = 96, 32, 40      # pixels of 20 m: patch 1.9 km, grid 640 m, search up to 800 m


def load(path):
    d = np.load(path)
    a = d["HHHH"].astype("float32")
    a = np.where(a > 0, a, np.nan)
    return np.log10(a), float(abs(d["x"][1] - d["x"][0]))


def shift_of(p0, p1):
    """Shift (rows, cols) that moves p0 onto p1, and how sharp the match is."""
    a = p0 - np.nanmean(p0)
    b = p1 - np.nanmean(p1)
    a = np.nan_to_num(a) * WINDOW
    b = np.nan_to_num(b) * WINDOW
    c = np.fft.irfft2(np.conj(np.fft.rfft2(a)) * np.fft.rfft2(b), s=a.shape)
    c = np.fft.fftshift(c)
    mid = PATCH // 2
    win = c[mid - MAX_SHIFT: mid + MAX_SHIFT + 1, mid - MAX_SHIFT: mid + MAX_SHIFT + 1]
    r, k = np.unravel_index(np.argmax(win), win.shape)
    peak = win[r, k]
    rest = win.copy()
    rest[max(0, r - 3): r + 4, max(0, k - 3): k + 4] = -np.inf
    second = rest.max()
    return r - MAX_SHIFT, k - MAX_SHIFT, float(peak / (abs(second) + 1e-9))


WINDOW = np.outer(np.hanning(PATCH), np.hanning(PATCH)).astype("float32")


def track(f0, f1):
    a, dx = load(f0)
    b, _ = load(f1)
    days = (np.datetime64(os.path.basename(f1)[:10]) - np.datetime64(os.path.basename(f0)[:10])).astype(int)
    rows = range(0, a.shape[0] - PATCH, STEP)
    cols = range(0, a.shape[1] - PATCH, STEP)
    speed = np.full((len(rows), len(cols)), np.nan, "float32")
    vx = speed.copy(); vy = speed.copy(); q = speed.copy()
    for i, r in enumerate(rows):
        for j, c in enumerate(cols):
            p0, p1 = a[r: r + PATCH, c: c + PATCH], b[r: r + PATCH, c: c + PATCH]
            if np.isnan(p0).mean() > 0.1 or np.isnan(p1).mean() > 0.1:
                continue
            dr, dc, sharp = shift_of(p0, p1)
            q[i, j] = sharp
            vx[i, j] = dc * dx / days          # metres per day, east (+)
            vy[i, j] = -dr * dx / days         # metres per day, north (+)
            speed[i, j] = np.hypot(dr, dc) * dx / days
    return speed, vx, vy, q, int(days)


if __name__ == "__main__":
    files = sorted(glob.glob(os.path.join(CACHE, "*.npz")))
    pairs = [(a, b) for a, b in zip(files, files[1:])
             if (np.datetime64(os.path.basename(b)[:10]) - np.datetime64(os.path.basename(a)[:10])).astype(int) == 12]
    speeds, vxs, names = [], [], []
    for f0, f1 in pairs:
        speed, vx, vy, q, days = track(f0, f1)
        good = q > 1.3                                   # keep only clear matches
        speeds.append(np.where(good, speed, np.nan))
        vxs.append(np.where(good, vx, np.nan))
        names.append(os.path.basename(f0)[:10])
        print(names[-1], "tracked", int(good.sum()), "of", int(np.isfinite(q).sum()), "patches", flush=True)
    S = np.array(speeds)
    n = np.isfinite(S).sum(0)
    med = np.nanmedian(np.where(n >= 8, S, np.nan), 0)   # typical speed of each patch over all pairs
    steady = n >= 8
    still = steady & (med < 1.5)
    sheet = steady & (med >= 1.5) & (med < 15)
    lane = steady & (med >= 15) & (med <= 30)            # the fast lane where tracking holds
    fjord = steady & (med > 30)                          # floating ice: faster, less reliable
    path = os.path.join(OUT, "jakobshavn.json")
    meta = json.load(open(path))
    rows = meta["tracks"]["170_D_053"]["series"]
    for r in rows:
        r.pop("ice_speed_mday", None)
    per_pair = []
    for name, sp in zip(names, S):
        v = sp[lane]
        v = v[np.isfinite(v)]
        if len(v) >= 10:
            per_pair.append(float(np.median(v)))
            next(r for r in rows if r["date"] == name)["ice_speed_mday"] = round(float(np.median(v)), 1)
    west = float(np.nanmedian(np.array(vxs)[:, lane]))
    meta["ice_speed"] = {
        "method": "feature tracking between NISAR HH pictures 12 days apart (patches of 1.9 km)",
        "pairs": len(pairs), "patches_tracked": int(steady.sum()),
        "still_pct": round(100 * still.sum() / steady.sum(), 1),
        "slow_ice_pct": round(100 * sheet.sum() / steady.sum(), 1),
        "lane_patches": int(lane.sum()), "lane_median_mday": round(float(np.median(med[lane])), 1),
        "lane_range_mday": [round(min(per_pair), 1), round(max(per_pair), 1)],
        "lane_eastward_mday": round(west, 1),
        "fjord_patches": int(fjord.sum()),
        "max_trackable_mday": round(MAX_SHIFT * 20 / 12, 1),
    }
    print(meta["ice_speed"])
    json.dump(meta, open(path, "w"), indent=1)
