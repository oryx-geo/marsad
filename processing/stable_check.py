# MARSAD · written with the help of an SI (Super Intelligence) coding assistant; reviewed and tested by team ORYX GEO.
"""Are the NISAR product versions used for Sindh comparable?

The Sindh series mixes BETA (2025), provisional and V1 products. Buildings do not change with the
season, so their brightness should stay the same. We take the cells that are very bright on every
date (above -4 dB, about 40 m cells) and follow their median.

Usage: python stable_check.py     (writes "version_check" into public/data/sindh.json)
"""
import glob
import json
import os
import warnings

import numpy as np

import build

warnings.filterwarnings("ignore", category=RuntimeWarning)
HERE = os.path.dirname(os.path.abspath(__file__))
files = sorted(glob.glob(os.path.join(HERE, "cache", "sindh", "041_A_015", "*.npz")))
stack = [build.db(build.multilook(np.load(f)["HHHH"], 4)) for f in files]
shape = min(s.shape for s in stack)
stack = np.stack([s[: shape[0], : shape[1]] for s in stack])
towns = np.nanmin(stack, 0) > -4
medians = [float(np.nanmedian(s[towns])) for s in stack]
dates = [os.path.basename(f)[:10] for f in files]
early = [m for d, m in zip(dates, medians) if d < "2026-06-01"]
late = [m for d, m in zip(dates, medians) if d >= "2026-06-01"]
path = os.path.join(HERE, "..", "public", "data", "sindh.json")
meta = json.load(open(path))
meta["version_check"] = {
    "stable_cells": int(towns.sum()),
    "spread_db": round(max(medians) - min(medians), 2),
    "early_vs_late_db": round(float(np.mean(late) - np.mean(early)), 2),
}
print(meta["version_check"])
json.dump(meta, open(path, "w"), indent=1)
