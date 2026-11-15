# MARSAD — text for the Space Apps project page

Copy each block into the field with the same name on the project page (field names as in the
2026 Project Submission Guide).
Everything here is in English, as the rules ask. Numbers come from the live site.

---

## Project Name

MARSAD

## High-Level Project Summary

MARSAD ("observatory" in Arabic) turns NISAR radar into a story anyone can read. Pick a place, drag a
handle between two radar dates, play the time series and hear it, then read why the land changed or
why it did not. Six prepared places on four continents show different rhythms: the seasonal pulse of
water on the Indus plain, a solar park in Oman whose panels the radar saw move, rice fields in Italy,
a green monsoon the radar barely sees, the edge of the Amazon forest and a Greenland glacier. Every
place can be seen in radar, in real colour and next to Sentinel-1 C-band. Visitors can also click any
spot on Earth to ask NASA's catalogue what NISAR recorded there and run a live comparison. The
explanation adapts to five audiences, and one report gathers them all. Radar data is free but hard
to read; MARSAD makes it readable, and honest about what radar can and cannot tell.

## Link to Project Demo

(paste the public link of the 29-second video here, or of the 7 slides if the team uses the slides as the demo)

## Link to Final Project

https://oryx-geo.github.io/marsad/

Source code: https://github.com/oryx-geo/marsad

## Detailed Project Description

**What it does**

MARSAD is an open, interactive web app built on NISAR L-band radar (NASA and ISRO).

- **Compare.** A handle wipes between two NISAR dates on an interactive map.
- **Track.** A time slider plays every available date (9 to 17 per place) with a chart of what the
  radar measured. With sound on, each date plays a note: the rhythm of the land becomes audible.
- **Understand the radar.** One switch between the HH and HV channels, each with a plain sentence.
  Two rules open the site: rough surfaces shine, wet surfaces shine, calm water stays dark.
- **See it three ways.** NISAR radar, a real-colour picture (NASA HLS) and Sentinel-1 C-band
  (NASA OPERA RTC-S1) for the same weeks, side by side.
- **Ask why, and why not.** Each place has three cards: why it changed, why it did not, and what to
  read with care.
- **Read any point.** Click a point on the picture to get its radar brightness over time.
- **Go anywhere.** Click any place on Earth: MARSAD asks NASA's Common Metadata Repository, live,
  how many NISAR passes exist there, on which dates and with which channels. A small server then
  compares the first and latest NISAR picture of a 10 km square around the point (experimental).
- **Five audiences, one report.** "I am..." rewrites the explanation for the public,
  decision-makers, resource managers, educators and scientists. A full report with all five can be
  read on the site or saved as a PDF.

**The six places and what we found**

1. **Sindh, Pakistan (the pulse of water).** Dark, smooth surfaces grew from 164 km² (17 June 2026)
   to 309 km² (16 August) and fell to 90 km² (15 October). We checked this against NASA's optical
   water map (OPERA DSWx-HLS) on 12 dates. Where that map shows open water, the radar is dark in 55
   to 99% of cells, so the rule holds. But only 6 to 80% of the dark area is confirmed as water, so
   the site calls it "dark, smooth surface" and not a measured flood extent.
2. **Manah, Oman (the panels that danced).** One of Oman's largest solar fields became 3.6 times
   brighter (+5.5 dB) between 4 and 16 September 2026, in the evening pass only. Optical pictures
   show nothing new was built, the dawn pass shows no change, and the field next to it stays flat.
   The jump falls when the sun at pass time drops from 6.4° to 9.1° below the horizon. The likely
   cause is the night position of sun-tracking panels. We first read it as new construction; the
   site tells that story as a lesson: radar shows that something changed, not what changed.
3. **Po valley, Italy (the rhythm of the fields).** Field by field, crops change the radar
   brightness through the season while the towns stay fixed.
4. **Salalah, Oman (the green the radar cannot see).** The khareef monsoon turns the mountains
   green, yet L-band brightness moves by less than 1.5 dB: the 24 cm wave passes through grass.
5. **Rondônia, Brazil (where the forest ends).** HV separates forest from pasture through cloud.
   About half of the window reads as forest (47 to 62% depending on the date). That swing is
   weather, not forest: wet pasture brightens. We do not claim new deforestation.
6. **Jakobshavn, Greenland (ice that never stands still).** By tracking the crevasse pattern
   between passes 12 days apart, we measured the ice moving 15 to 30 metres per day in the fast
   lane, towards the sea, while 73% of the tracked patches (rock and slow ice) did not move.
   Only HH exists there, and the very fastest ice could not be matched.

**How it addresses the challenge**

The challenge asks for a tool that tracks and visualises surface change with SAR at different time
steps, explains the physical drivers of what we see or do not see, and speaks to the public,
decision-makers, resource managers, educators and scientists. MARSAD does each of these with NISAR
as its core data, and it treats "what we do not see" as seriously as what we do.

We also checked ourselves: the Sindh series mixes product versions, so we followed buildings that
never change. Their brightness differs by 0.07 dB between the 2025 and 2026 products.

**How we built it**

A static site (React, Vite, MapLibre GL JS) on GitHub Pages. Python scripts read only the needed
window from each multi-gigabyte NISAR GCOV file over HTTPS (h5py, fsspec), average the backscatter
in linear power, re-project it and write small pictures and JSON files. Every number on the site is
computed by these scripts from the data; none is typed by hand. The optional live analysis is a
small FastAPI program reached through a tunnel.

**Benefits**

- Free NASA radar becomes readable without radar training: drag, play, listen, read why.
- It works in cloud, dust and night, when cameras cannot see.
- It is honest about limits: every place says what the radar cannot tell, and Manah shows how a
  change can be misread.
- Anyone can look at their own place and keep a report for others.

**Tools and languages**

JavaScript (React, Vite, MapLibre GL JS) for the site; Python (NumPy, h5py, fsspec, pyproj, Pillow,
FastAPI) for processing and the live analysis; GitHub and GitHub Pages for code and hosting; Microsoft
Dev Tunnels for the live-analysis server; Canva for the MARSAD logos. An SI coding assistant was used,
as described in the SI field and in the README.

**What is next (what we hope to achieve)**

More years of NISAR will separate a normal season from an unusual one. Next steps: interferometry
for ground motion, calibrated C-band numbers, tracking of the fastest ice, and alerts when a place leaves its usual rhythm.

## Use of Super Intelligence (SI)

(This field is not shown to the judges, but the same text is in the README, which they can read.)

Yes. The team chose the challenge, the concept of MARSAD (a radar story for five audiences, with
"why did it change, and why not" for every place), the design and theme, and took every decision on
places and wording. We used an SI coding assistant (Claude, by Anthropic) to write most of the code
of the site, the processing scripts and the live-analysis server, to run the data processing, to scan
candidate places in NISAR data (the Manah and Salalah sites came out of this scan and were then
chosen by the team), to draft text for the site, slides and this page, and to check the rules. The
team reviewed and tested everything. Every source file in the repository starts with a line saying
it was written with SI help, and every data file carries a provenance note. The ORYX GEO team logo is
an SI-generated image and carries the caption "SI-generated image". No radar or optical picture and
no number on the site is SI-generated: all come from real satellite data. The plain-language reading
in the live analysis is made by fixed radar rules, not by an SI model. No NASA branding was used.

## NASA Data

- NISAR L2 Geocoded Polarimetric Covariance (GCOV), L-band, HH and HV (NASA and ISRO), from the
  Alaska Satellite Facility DAAC
- NASA Common Metadata Repository (CMR) search API
- NASA OPERA RTC-S1 (Sentinel-1 C-band backscatter) through NASA GIBS
- NASA Harmonized Landsat Sentinel-2 (HLS) true-colour imagery through NASA GIBS
- NASA OPERA DSWx-HLS (surface water extent) through NASA GIBS
- NASA POWER daily precipitation

## Space Agency Partner Data and Other References

Space agency partners

- ISRO (Indian Space Research Organisation): NISAR is a joint NASA and ISRO mission.
- ESA (European Space Agency) / Copernicus: Sentinel-1 data inside NASA OPERA RTC-S1, and
  Sentinel-2 data inside NASA HLS and OPERA DSWx-HLS.

Data and services

- NISAR L2 GCOV, ASF DAAC: https://search.asf.alaska.edu/
- NASA CMR: https://cmr.earthdata.nasa.gov/
- NASA GIBS: https://gibs.earthdata.nasa.gov/
- NASA POWER: https://power.larc.nasa.gov/
- OpenStreetMap base map (© OpenStreetMap contributors): https://www.openstreetmap.org/copyright

Code and libraries (all open source)

- Site: React, React DOM, Vite, @vitejs/plugin-react, MapLibre GL JS
- Fonts (SIL Open Font License, via Fontsource): Readex Pro, Inter, IBM Plex Sans, Space Grotesk,
  DM Sans, Lora
- Processing and server: NumPy, h5py, fsspec, aiohttp, requests, pyproj, Pillow, FastAPI, Uvicorn
- Slides and checks: python-pptx, python-docx, qrcode, scipy, PyMuPDF, opencv-python, Playwright,
  LibreOffice
- Hosting and tools: GitHub, GitHub Pages, Microsoft Dev Tunnels, Canva (MARSAD logos),
  Claude by Anthropic (SI coding assistant)

Text sources on the Manah solar plants

- Arctech press release (Manah I trackers), 2024:
  https://prnewswire.com/news-releases/arctech-scores-new-spring-win---awarded-500mw-manah-i-pv-plant-in-oman-302103257.html
- NS Energy, Manah-1 project page:
  https://www.nsenergybusiness.com/projects/manah-1-solar-pv-independent-power-plant-oman/
- Oman Observer, inauguration of Manah 1 and 2 (2025): https://www.omanobserver.om/ampArticle/1165105
- Power Technology, Manah I: https://www.power-technology.com/projects/manah-i-solar-power-plant-oman/
- PV Magazine, Manah II (2024):
  https://www.pv-magazine.com/2024/12/31/sembcorp-utilities-activates-588-mw-of-solar-in-oman/

Images: all pictures in MARSAD are real satellite data or screenshots of the site. The MARSAD logos
are the team's own (Canva); the ORYX GEO logo is SI-generated and marked.

Full list with licences: https://github.com/oryx-geo/marsad#references

NASA does not endorse this project.
