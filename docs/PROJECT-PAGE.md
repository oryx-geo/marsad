# MARSAD — text for the Space Apps project page

Field names exactly as on the 2026 project form.

## Project Name

MARSAD

## Summary

MARSAD ("observatory" in Arabic) turns NISAR radar into a story anyone can read. Pick a place, drag a
handle between two radar dates, play the time series and hear it, then read why the land changed or
why it did not. Six prepared places on four continents show different rhythms: the seasonal pulse of
water on the Indus plain, a solar park in Oman whose panels the radar saw move, rice fields in Italy,
a green monsoon the radar barely sees, the edge of the Amazon forest and a Greenland glacier. Every
place can be seen in radar, in real colour and next to Sentinel-1 C-band. Visitors can also click any
spot on Earth to ask NASA's catalogue what NISAR recorded there and run a live comparison. The
explanation adapts to five audiences, and one report gathers them all. Radar data is free but hard
to read; MARSAD makes it readable, and honest about what radar can and cannot tell.

## Project Demonstration

(the public link of the 29-second video)

If the team uses the slides as the demo instead: https://docs.google.com/presentation/d/1ZQ8yjToQ1ZMPq8kE-T51_U9uwEO5Q9uI/edit?usp=sharing

## Project

https://oryx-geo.github.io/marsad/

## Project Details

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

**How is it creative?**

- The challenge's own image, the dance and rhythm of the land, runs through the whole site: an opening
  built from our logo, a radar echo that turns into a landscape, and a sound mode where each date plays
  a note so the rhythm can be heard.
- It treats "what the radar does not see" as a result, not a failure: Salalah's green monsoon that L-band
  barely notices, and Manah, where a change we first read as new construction turned out to be the
  solar panels themselves.
- Every place can be seen three ways (radar, real colour, C-band), and the explanation rewrites itself
  for five kinds of reader.

**What factors did the team consider?**

- Honesty: every number is computed from the data, each place has a "read with care" card, and we
  checked ourselves against second sources (NASA's optical water map for Sindh, optical pictures and a
  second orbit for Manah, rock that must not move for the Greenland ice speed, unchanging buildings
  for the mix of NISAR product versions).
- Access: a static site with no login, readable on a phone, and a report that can be saved as a PDF.
- What NISAR could give in its first months: dates from mid-2025 to November 2026, so we chose places
  where change happens within a season.
- Rules: no NASA branding, SI use disclosed, no person under 18 in any material.

**What is next (what we hope to achieve)**

More years of NISAR will separate a normal season from an unusual one. Next steps: interferometry
for ground motion, calibrated C-band numbers, tracking of the fastest ice, and alerts when a place leaves its usual rhythm.

Source code: https://github.com/oryx-geo/marsad

## Use of Super Intelligence (SI)

Tick the options that match (the exact labels are on the form): code / coding assistance; text or writing assistance; image generation (team logo). Do not tick audio or video.

If there is a text box: Yes. All ideas and decisions are the team's. We used an SI coding assistant (Claude, by Anthropic) to help write the code and process the data, and to help with the English wording. The team reviewed and tested everything. The ORYX GEO team logo is an SI-generated image and is marked as such. All maps and numbers come from real satellite data.

## NASA Data

| Link Text | Link Url |
|---|---|
| NISAR L2 GCOV (NASA-ISRO), Alaska Satellite Facility DAAC | https://search.asf.alaska.edu/ |
| NISAR mission (NASA) | https://science.nasa.gov/mission/nisar/ |
| NASA Earthdata Login | https://urs.earthdata.nasa.gov/ |
| NASA Common Metadata Repository (CMR) search API | https://cmr.earthdata.nasa.gov/search/ |
| NASA GIBS (imagery service used for HLS, OPERA RTC-S1 and OPERA DSWx-HLS) | https://gibs.earthdata.nasa.gov/ |
| NASA Harmonized Landsat Sentinel-2 (HLS) | https://hls.gsfc.nasa.gov/ |
| NASA OPERA products (RTC-S1, DSWx-HLS) | https://www.jpl.nasa.gov/go/opera |
| NASA POWER rainfall | https://power.larc.nasa.gov/ |

## Space Agency Partner & Other Data

| Link Text | Link Url |
|---|---|
| ISRO, NISAR partner agency | https://www.isro.gov.in/ |
| ESA Copernicus Sentinel-1 (inside NASA OPERA RTC-S1) | https://www.esa.int/Applications/Observing_the_Earth/Copernicus/Sentinel-1 |
| ESA Copernicus Sentinel-2 (inside NASA HLS) | https://www.esa.int/Applications/Observing_the_Earth/Copernicus/Sentinel-2 |
| OpenStreetMap base map (© OpenStreetMap contributors) | https://www.openstreetmap.org/copyright |
| MARSAD source code (MIT licence) | https://github.com/oryx-geo/marsad |
| React | https://react.dev/ |
| Vite | https://vite.dev/ |
| MapLibre GL JS | https://maplibre.org/ |
| Fontsource (Readex Pro and other open fonts) | https://fontsource.org/ |
| NumPy | https://numpy.org/ |
| h5py | https://www.h5py.org/ |
| fsspec | https://filesystem-spec.readthedocs.io/ |
| pyproj | https://pyproj4.github.io/pyproj/ |
| Pillow | https://python-pillow.org/ |
| requests | https://requests.readthedocs.io/ |
| aiohttp | https://docs.aiohttp.org/ |
| FastAPI | https://fastapi.tiangolo.com/ |
| Uvicorn | https://www.uvicorn.org/ |
| GitHub Pages (hosting) | https://pages.github.com/ |
| Microsoft Dev Tunnels (live analysis) | https://learn.microsoft.com/azure/developer/dev-tunnels/ |
| Canva (MARSAD logos, made by the team) | https://www.canva.com/ |
| Claude by Anthropic (SI coding assistant) | https://www.anthropic.com/claude |
| python-pptx (slides) | https://python-pptx.readthedocs.io/ |
| Playwright (testing) | https://playwright.dev/ |
| LibreOffice (slide previews) | https://www.libreoffice.org/ |
| Manah I trackers, Arctech press release (2024) | https://prnewswire.com/news-releases/arctech-scores-new-spring-win---awarded-500mw-manah-i-pv-plant-in-oman-302103257.html |
| Manah-1 project, NS Energy | https://www.nsenergybusiness.com/projects/manah-1-solar-pv-independent-power-plant-oman/ |
| Manah 1 and 2 inauguration, Oman Observer (2025) | https://www.omanobserver.om/ampArticle/1165105 |
| Manah I, Power Technology | https://www.power-technology.com/projects/manah-i-solar-power-plant-oman/ |
| Manah II, PV Magazine (2024) | https://www.pv-magazine.com/2024/12/31/sembcorp-utilities-activates-588-mw-of-solar-in-oman/ |
| Slides (7), Google Slides | https://docs.google.com/presentation/d/1ZQ8yjToQ1ZMPq8kE-T51_U9uwEO5Q9uI/edit?usp=sharing |

NASA does not endorse this project.
