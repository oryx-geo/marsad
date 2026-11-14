# MARSAD · مرصد

**The rhythm of the land, seen by radar.**

MARSAD is an open, interactive web app that shows how the NISAR radar satellite sees the land
change over time, and explains in plain words why it changed, or why it did not.

- Live site: https://oryx-geo.github.io/marsad/
- Team: **ORYX GEO**
- Event: 2026 NASA Space Apps Challenge, challenge "Dancing with the SARs"

## What you can do on the site

- Compare two NISAR dates with a before/after handle on an interactive map.
- See the same place in real colour (NASA HLS) next to the radar picture.
- Click any point to read its radar brightness over time.
- "Anywhere": click any place on Earth and MARSAD asks NASA's public catalogue, live, what NISAR
  has recorded there (how many passes, which dates, which radar channels).
- Play the time series and follow a chart of what the radar measured.
- Switch between the HH and HV radar channels, with one plain sentence on what each shows.
- Read "Why did it change?" and "Why didn't it?" for every place.
- Choose who you are (curious, decision-maker, resource manager, educator, scientist) to get the
  explanation that fits you.
- Read everything in English or Arabic.

## Places

| Place | Story | NISAR track | Dates |
|---|---|---|---|
| Sindh, Pakistan | The seasonal pulse of water on the Indus plain | 041 ascending | 16, Nov 2025 to Oct 2026 |
| Manah, Oman | A solar field that brightened in the evening pass only; nothing new was built | 150 descending, 128 ascending | 11 + 11, Jun to Nov 2026 |
| Po valley, Italy | Field-by-field rhythm of crops | 144 ascending | 11, Jun to Nov 2026 |
| Salalah, Oman | The monsoon green that L-band radar barely sees | 157 ascending | 9, Jun to Oct 2026 |
| Rondônia, Brazil | Where the forest ends (no new clearing is claimed) | 161 ascending | 9, Jun to Oct 2026 |
| Jakobshavn, Greenland | Ice that changes between summer and autumn (HH only) | 170 descending | 17, Oct 2025 to Oct 2026 |

Every number and picture on the site is computed from real data by the scripts in `processing/`.
Where the data did not show a clear change, or where we are not sure of the cause, the site says so.

## How it works

The site is static: there is no server. The NISAR data for each place is processed once and saved
inside the site as small images and JSON files (`public/data/`).

```
processing/sites.py     the places (bounding boxes, tracks)
processing/fetch.py     finds NISAR granules in NASA CMR and reads only the needed window over HTTPS
processing/build.py     averages, re-projects, writes the images and all numbers
processing/rain.py      adds NASA POWER rainfall to the Sindh series
processing/optical.py   saves the nearest NASA HLS true-colour picture for every NISAR date
src/                    the web app (React, MapLibre GL JS, hand-written SVG chart)
```

Method in short: NISAR L2 GCOV backscatter (gamma-0) is averaged in linear power to 10–40 m cells,
re-projected to a north-up grid, and shown in decibels (HH from −22 to −2 dB, HV from −30 to −10 dB).
"Changed" means a difference of more than 3 dB (a factor of two) after 3×3 smoothing.

### Run the site on your computer

```bash
npm install
```

```bash
npm run dev
```

### Rebuild the data (optional)

You need a free NASA Earthdata Login token in the environment variable `EARTHDATA_TOKEN`.
Never write the token in a file.

```bash
pip install -r processing/requirements.txt
```

```bash
python processing/fetch.py
```

```bash
python processing/build.py
```

```bash
python processing/rain.py
```

```bash
python processing/optical.py
```

## Live analysis (optional, experimental)

"Anywhere" can also compare the first and the latest NISAR picture of a 10 km square around any
point. This needs a small program (`server/app.py`) running on a computer that holds an Earthdata
token, reached through a tunnel. Its address is in `public/live.json`. When that computer is off,
the "Analyse this place" button does not appear and the rest of the site works as usual.

```bash
pip install -r server/requirements.txt
```

On Windows, double-click `server/start-server.bat` (it needs the environment variable
`EARTHDATA_TOKEN` and a Microsoft Dev Tunnel created once with `devtunnel create -a` and
`devtunnel port create -p 8000`).

## Use of AI

Idea, study area, design, data choices and verification by the team. Code written with the help of
an AI coding assistant, reviewed and tested by the team.

The ORYX GEO team logo is an AI-generated image and carries a visible "AI-generated" mark.
The MARSAD logos were designed by the team in Canva.

## References

Data

- NISAR L2 Geocoded Polarimetric Covariance (GCOV), NASA and ISRO, distributed by the NASA Alaska
  Satellite Facility DAAC. Collections `C3622241360-ASF`, `C2854338529-ASF`, `C3622214170-ASF`.
  https://search.asf.alaska.edu/
- NASA Common Metadata Repository (CMR) search API. https://cmr.earthdata.nasa.gov/
- NASA POWER daily precipitation (PRECTOTCORR). https://power.larc.nasa.gov/
- NASA Harmonized Landsat Sentinel-2 (HLS) true-colour imagery through NASA GIBS, shown next to the
  radar pictures.
  Contains modified Copernicus Sentinel data (ESA). https://gibs.earthdata.nasa.gov/
- Base map tiles: © OpenStreetMap contributors. https://www.openstreetmap.org/copyright

Background on the Manah solar plants

- Arctech, tracker supply for the 500 MW Manah I plant (press release, 2024).
  https://prnewswire.com/news-releases/arctech-scores-new-spring-win---awarded-500mw-manah-i-pv-plant-in-oman-302103257.html
- Oman Observer, "Oman's largest solar power plants Manah 1, Manah 2 inaugurated" (2025).
  https://www.omanobserver.om/ampArticle/1165105

Software

- React (MIT), Vite (MIT), MapLibre GL JS (BSD-3-Clause)
- Font: Readex Pro (SIL Open Font License 1.1), served from the site itself through Fontsource
- Python: NumPy, h5py, fsspec, aiohttp, requests, pyproj, Pillow, FastAPI, Uvicorn
- Microsoft Dev Tunnels (tunnel for the optional live analysis)

Design

- MARSAD wordmark and icon: made by the team in Canva.
- ORYX GEO logo: AI-generated image.

NASA does not endorse this project. Names of NASA, ISRO and ESA are used only to credit the data.

## Licence

MIT. See [LICENSE](LICENSE).
