# MARSAD · written with the help of an SI (Super Intelligence) coding assistant; reviewed and tested by team ORYX GEO.
"""Find NISAR GCOV granules in NASA CMR and save the window over each site.

Usage:  python fetch.py sindh manah        (no arguments = all sites)
Output: processing/cache/<site>/<track>/<date>.npz   (not committed)
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from multiprocessing import Pool

import numpy as np
from pyproj import Transformer

import nisar_io
from sites import COLLECTIONS, SITES

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
GRID = "science/LSAR/GCOV/grids/frequencyA"


def search(bbox):
    """All GCOV granules touching the bbox: {track: {date: (granule, url)}}."""
    found = {}
    for col in COLLECTIONS:
        page = 1
        while True:
            q = urllib.parse.urlencode({
                "collection_concept_id": col,
                "bounding_box": ",".join(map(str, bbox)),
                "page_size": 500, "page_num": page,
            })
            with urllib.request.urlopen("https://cmr.earthdata.nasa.gov/search/granules.umm_json?" + q, timeout=60) as r:
                items = json.load(r)["items"]
            for it in items:
                u = it["umm"]
                name = u["GranuleUR"]
                p = name.split("_")
                track = "_".join(p[5:8])
                date = u["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"][:10]
                urls = [x["URL"] for x in u.get("RelatedUrls", []) if x["URL"].startswith("https") and x["URL"].endswith(".h5")]
                if urls:
                    found.setdefault(track, {}).setdefault(date, (name, urls[0]))
            if len(items) < 500:
                break
            page += 1
    return found


def read_window(bbox, url):
    h = nisar_io.open_h5(url)
    g = h[GRID]
    epsg = int(g["projection"].attrs["epsg_code"])
    x = g["xCoordinates"][:]
    y = g["yCoordinates"][:]
    w, s, e, n = bbox
    xs, ys = Transformer.from_crs(4326, epsg, always_xy=True).transform([w, e, w, e], [s, s, n, n])
    c0, c1 = np.searchsorted(x, [min(xs), max(xs)])
    r0, r1 = np.searchsorted(-y, [-max(ys), -min(ys)])
    out = {"epsg": epsg, "x": x[c0:c1], "y": y[r0:r1]}
    for pol in ("HHHH", "HVHV"):
        if pol in g:
            out[pol] = g[pol][r0:r1, c0:c1]
    return out


def job(args):
    site, track, date, name, url = args
    out = os.path.join(CACHE, site, track, date + ".npz")
    if os.path.exists(out):
        return site, track, date, "cached"
    os.makedirs(os.path.dirname(out), exist_ok=True)
    for attempt in range(3):
        try:
            data = read_window(SITES[site]["bbox"], url)
            tmp = out + f".{os.getpid()}.tmp.npz"
            np.savez_compressed(tmp, granule=name, **data)
            os.replace(tmp, out)
            return site, track, date, "ok"
        except Exception as ex:  # network hiccup: wait and retry
            err = str(ex)[:100]
            time.sleep(5)
    return site, track, date, "FAILED " + err


if __name__ == "__main__":
    jobs = []
    for site in sys.argv[1:] or list(SITES):
        found = search(SITES[site]["bbox"])
        for track in SITES[site]["tracks"]:
            for date, (name, url) in sorted(found.get(track, {}).items()):
                if "_DH" in name or "_SH" in name or "_QP" in name:
                    jobs.append((site, track, date, name, url))
    with Pool(8) as pool:
        for r in pool.imap_unordered(job, jobs):
            print(*r, flush=True)
