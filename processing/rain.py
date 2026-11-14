"""Daily rainfall at the Sindh site from NASA POWER, summed over the days before each NISAR pass.

Usage: python rain.py     (needs public/data/sindh.json; adds "rain_mm" to each date)
"""
import datetime as dt
import json
import os
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(HERE, "..", "public", "data", "sindh.json")
LAT, LON = 27.05, 68.10

site = json.load(open(PATH))
track = next(iter(site["tracks"].values()))
dates = [dt.date.fromisoformat(d) for d in track["dates"]]
start, end = dates[0] - dt.timedelta(days=12), dates[-1]
url = ("https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR&community=AG"
       f"&longitude={LON}&latitude={LAT}&start={start:%Y%m%d}&end={end:%Y%m%d}&format=JSON")
with urllib.request.urlopen(url, timeout=120) as r:
    daily = json.load(r)["properties"]["parameter"]["PRECTOTCORR"]
for row, d in zip(track["series"], dates):
    days = [(d - dt.timedelta(days=i)).strftime("%Y%m%d") for i in range(12)]
    vals = [daily[k] for k in days if k in daily and daily[k] >= 0]
    row["rain_mm"] = round(sum(vals), 1)   # rain in the 12 days up to the pass
    print(row["date"], row["rain_mm"])
site["rain_source"] = {"name": "NASA POWER (PRECTOTCORR)", "lat": LAT, "lon": LON, "window_days": 12}
json.dump(site, open(PATH, "w"), indent=1)
