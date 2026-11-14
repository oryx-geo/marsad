# MARSAD — text for the Space Apps project page

Copy each block into the field with the same name on the project page.
Everything here is in English, as the rules ask. Numbers come from the live site.

---

## Project name

MARSAD

## High-level summary

MARSAD ("observatory" in Arabic) turns NISAR radar into a story anyone can read. Pick a place, drag a
handle between two radar dates, play the time series and hear it, then read why the land changed or
why it did not. Six prepared places on four continents show different rhythms: the seasonal pulse of
water on the Indus plain, a solar park in Oman whose panels the radar saw move, rice fields in Italy,
a green monsoon the radar barely sees, the edge of the Amazon forest and a Greenland glacier. Every
place can be seen in radar, in real colour and next to Sentinel-1 C-band. Visitors can also click any
spot on Earth to ask NASA's catalogue what NISAR recorded there and run a live comparison. The
explanation adapts to five audiences, and one report gathers them all. Radar data is free but hard
to read; MARSAD makes it readable, and honest about what radar can and cannot tell.

## Link to project "demo"

(paste the public link of the 29-second video here)

## Link to final project

https://oryx-geo.github.io/marsad/

Source code: https://github.com/oryx-geo/marsad

## Detailed project description

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
   We do not claim new deforestation: the signal we saw followed the dry season.
6. **Jakobshavn, Greenland (ice that never stands still).** Summer melt darkens the ice and
   refreezing brightens it. Only HH exists there; we did not measure ice speed.

**How it addresses the challenge**

The challenge asks for a tool that tracks and visualises surface change with SAR at different time
steps, explains the physical drivers of what we see or do not see, and speaks to the public,
decision-makers, resource managers, educators and scientists. MARSAD does each of these with NISAR
as its core data, and it treats "what we do not see" as seriously as what we do.

**How we built it**

A static site (React, Vite, MapLibre GL JS) on GitHub Pages. Python scripts read only the needed
window from each multi-gigabyte NISAR GCOV file over HTTPS (h5py, fsspec), average the backscatter
in linear power, re-project it and write small pictures and JSON files. Every number on the site is
computed by these scripts from the data; none is typed by hand. The optional live analysis is a
small FastAPI program reached through a tunnel.

**What is next**

More years of NISAR will separate a normal season from an unusual one. Next steps: interferometry
for ground motion, calibrated C-band numbers, and alerts when a place leaves its usual rhythm.

## NASA data

- NISAR L2 Geocoded Polarimetric Covariance (GCOV), L-band, HH and HV (NASA and ISRO), from the
  Alaska Satellite Facility DAAC
- NASA Common Metadata Repository (CMR) search API
- NASA OPERA RTC-S1 (Sentinel-1 C-band backscatter) through NASA GIBS
- NASA Harmonized Landsat Sentinel-2 (HLS) true-colour imagery through NASA GIBS
- NASA OPERA DSWx-HLS (surface water extent) through NASA GIBS
- NASA POWER daily precipitation

## Space agency partner and other data

- ISRO: NISAR is a joint NASA and ISRO mission
- ESA / Copernicus: Sentinel-1 and Sentinel-2 data inside the OPERA and HLS products
- OpenStreetMap contributors: base map

## Use of artificial intelligence

Idea, study area, design, data choices and verification by the team. Code written with the help of
an AI coding assistant, reviewed and tested by the team. The ORYX GEO team logo is an AI-generated
image and is marked as such. The MARSAD logos were designed by the team in Canva. No AI-generated
data, pictures of the Earth or numbers are used: all radar and optical pictures are real satellite
data.

## References

See the full list in the repository README: https://github.com/oryx-geo/marsad#references

- NISAR GCOV, ASF DAAC: https://search.asf.alaska.edu/
- NASA CMR: https://cmr.earthdata.nasa.gov/
- NASA GIBS: https://gibs.earthdata.nasa.gov/
- NASA POWER: https://power.larc.nasa.gov/
- OpenStreetMap: https://www.openstreetmap.org/copyright
- React, Vite, MapLibre GL JS, NumPy, h5py, fsspec, pyproj, Pillow, FastAPI
- Fonts: Readex Pro and others, SIL Open Font License, via Fontsource
- Manah solar plants: see README for the press sources

NASA does not endorse this project.
