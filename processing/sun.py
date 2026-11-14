"""Sun elevation at Manah at the moment of every NISAR pass (NOAA solar position formulas).

Why: the brightness of the west solar field jumps only in the evening pass. Knowing how far below
the horizon the sun was at each pass shows whether the jump follows the daily rhythm of the panels.

Usage: python sun.py     (adds "sun_elev_deg" to every row of public/data/manah.json)
"""
import datetime as dt
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(HERE, "..", "public", "data", "manah.json")
LAT, LON = 22.607, 57.657
PASS_UTC = {"150_D_077": (14, 48, 5), "128_A_013": (1, 34, 9)}   # from the NISAR granule names


def sun_elevation(lat, lon, t):
    rad, deg = math.radians, math.degrees
    T = (t.timestamp() / 86400 + 2440587.5 - 2451545) / 36525
    L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360
    M = 357.52911 + T * (35999.05029 - 0.0001537 * T)
    e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T)
    C = (math.sin(rad(M)) * (1.914602 - T * (0.004817 + 0.000014 * T))
         + math.sin(rad(2 * M)) * (0.019993 - 0.000101 * T) + math.sin(rad(3 * M)) * 0.000289)
    om = 125.04 - 1934.136 * T
    lam = L0 + C - 0.00569 - 0.00478 * math.sin(rad(om))
    eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * math.cos(rad(om))
    dec = deg(math.asin(math.sin(rad(eps)) * math.sin(rad(lam))))
    y = math.tan(rad(eps / 2)) ** 2
    eot = 4 * deg(y * math.sin(2 * rad(L0)) - 2 * e * math.sin(rad(M)) + 4 * e * y * math.sin(rad(M)) * math.cos(2 * rad(L0))
                  - 0.5 * y * y * math.sin(4 * rad(L0)) - 1.25 * e * e * math.sin(2 * rad(M)))
    solar_time = (t.hour * 60 + t.minute + t.second / 60 + eot + 4 * lon) % 1440
    hour_angle = solar_time / 4 - 180
    cos_z = math.sin(rad(lat)) * math.sin(rad(dec)) + math.cos(rad(lat)) * math.cos(rad(dec)) * math.cos(rad(hour_angle))
    return 90 - deg(math.acos(cos_z))


site = json.load(open(PATH))
for track, (h, m, s) in PASS_UTC.items():
    for row in site["tracks"][track]["series"]:
        t = dt.datetime.fromisoformat(row["date"]).replace(hour=h, minute=m, second=s, tzinfo=dt.timezone.utc)
        row["sun_elev_deg"] = round(sun_elevation(LAT, LON, t), 1)
        print(track, row["date"], row["sun_elev_deg"])
json.dump(site, open(PATH, "w"), indent=1)
