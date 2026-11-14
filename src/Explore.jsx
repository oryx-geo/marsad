import React, { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'

// "Anywhere": click any place on Earth and ask NASA's public catalogue (CMR)
// what NISAR has recorded there. No login and no server are needed for this.

const COLLECTIONS = ['C3622241360-ASF', 'C2854338529-ASF', 'C3622214170-ASF']
const CHANNELS = { SH: 'HH', DH: 'HH + HV', SV: 'VV', DV: 'VV + VH', QP: 'HH + HV + VH + VV', QD: 'HH + HV + VH + VV' }

export async function askCatalogue(lon, lat) {
  const rows = []
  for (const c of COLLECTIONS) {
    const url = `https://cmr.earthdata.nasa.gov/search/granules.umm_json?collection_concept_id=${c}&point=${lon.toFixed(4)},${lat.toFixed(4)}&page_size=1000`
    const r = await fetch(url)
    if (!r.ok) throw new Error('catalogue')
    const j = await r.json()
    for (const it of j.items) {
      const p = it.umm.GranuleUR.split('_')
      rows.push({
        date: it.umm.TemporalExtent.RangeDateTime.BeginningDateTime.slice(0, 10),
        track: p[5], dir: p[6], mode: p[9].slice(0, 2),
      })
    }
  }
  const seen = new Set()
  const passes = rows.filter((r) => { const k = r.date + r.track; if (seen.has(k)) return false; seen.add(k); return true })
    .sort((a, b) => a.date.localeCompare(b.date))
  const byChannel = {}
  passes.forEach((p) => { const k = CHANNELS[p.mode] || p.mode; byChannel[k] = (byChannel[k] || 0) + 1 })
  const tracks = {}
  passes.forEach((p) => { const k = p.track + p.dir; (tracks[k] = tracks[k] || { track: p.track, dir: p.dir, n: 0, first: p.date, last: p.date }).n += 1; tracks[k].last = p.date })
  return { lon, lat, passes, byChannel, tracks: Object.values(tracks).sort((a, b) => b.n - a.n) }
}

export default function ExploreMap({ onResult, onBusy }) {
  const el = useRef(null)
  const cb = useRef({ onResult, onBusy })
  cb.current = { onResult, onBusy }

  useEffect(() => {
    const wide = window.innerWidth > 980
    const map = new maplibregl.Map({
      container: el.current,
      style: {
        version: 8,
        sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: '© OpenStreetMap contributors' } },
        layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0B0820' } }, { id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: [57, 22], zoom: wide ? 2.4 : 1.4, maxZoom: 13,
      padding: wide ? { left: 430, top: 80, right: 0, bottom: 0 } : 0,
      attributionControl: false, dragRotate: false,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right')
    map.getCanvas().style.cursor = 'crosshair'
    let marker
    map.on('click', async (ev) => {
      const { lng, lat } = ev.lngLat
      const lon = ((lng + 540) % 360) - 180
      marker?.remove()
      const pin = document.createElement('div')
      pin.className = 'probe-pin'
      marker = new maplibregl.Marker({ element: pin }).setLngLat([lng, lat]).addTo(map)
      cb.current.onBusy(true)
      try { cb.current.onResult(await askCatalogue(lon, lat)) } catch { cb.current.onResult({ error: true, lon, lat }) }
      cb.current.onBusy(false)
    })
    return () => map.remove()
  }, [])

  return <div className="swipe"><div className="swipe-map" ref={el} /></div>
}
