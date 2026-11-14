import React, { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'

// Two maps on top of each other. The top one ("after") is clipped at the handle,
// so dragging the handle wipes between the two NISAR dates.

const BASE = import.meta.env.BASE_URL

function styleFor(bbox, url) {
  const [w, s, e, n] = bbox
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© OpenStreetMap contributors',
      },
      nisar: { type: 'image', url, coordinates: [[w, n], [e, n], [e, s], [w, s]] },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#e9dcc6' } },
      { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-opacity': 0.55, 'raster-saturation': -0.6 } },
      { id: 'nisar', type: 'raster', source: 'nisar', paint: { 'raster-fade-duration': 0, 'raster-resampling': 'linear' } },
    ],
  }
}

export function imageUrl(site, track, date, pol) {
  return `${BASE}data/${site}/${track}/${date}_${pol}.webp`
}

export default function SwipeMap({ site, track, bbox, pol, dateA, dateB, labelA, labelB, hint }) {
  const wrap = useRef(null)
  const elA = useRef(null)
  const elB = useRef(null)
  const maps = useRef(null)
  const [split, setSplit] = useState(50)

  // create both maps once per site
  useEffect(() => {
    const [w, s, e, n] = bbox
    const make = (el, url, interactive) =>
      new maplibregl.Map({
        container: el,
        style: styleFor(bbox, url),
        bounds: [[w, s], [e, n]],
        fitBoundsOptions: { padding: 8 },
        attributionControl: false,
        interactive,
        maxZoom: 15,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      })
    const a = make(elA.current, imageUrl(site, track, dateA, pol), true)
    const b = make(elB.current, imageUrl(site, track, dateB, pol), false)
    a.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')
    a.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')
    a.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right')
    a.touchZoomRotate.disableRotation()
    const sync = () => b.jumpTo({ center: a.getCenter(), zoom: a.getZoom(), bearing: 0, pitch: 0 })
    a.on('move', sync)
    maps.current = { a, b }
    const ro = new ResizeObserver(() => { a.resize(); b.resize(); sync() })
    ro.observe(wrap.current)
    return () => { ro.disconnect(); a.remove(); b.remove(); maps.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, track])

  // swap the pictures when the dates or the polarisation change
  useEffect(() => {
    const m = maps.current
    if (!m) return
    const [w, s, e, n] = bbox
    const coordinates = [[w, n], [e, n], [e, s], [w, s]]
    const set = (map, date) => {
      const apply = () => map.getSource('nisar')?.updateImage({ url: imageUrl(site, track, date, pol), coordinates })
      if (map.isStyleLoaded()) apply(); else map.once('load', apply)
    }
    set(m.a, dateA)
    set(m.b, dateB)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateA, dateB, pol])

  const drag = (ev) => {
    const r = wrap.current.getBoundingClientRect()
    const move = (e) => {
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left
      setSplit(Math.max(2, Math.min(98, (x / r.width) * 100)))
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    move(ev)
  }

  const key = (e) => {
    if (e.key === 'ArrowLeft') setSplit((v) => Math.max(2, v - 4))
    if (e.key === 'ArrowRight') setSplit((v) => Math.min(98, v + 4))
  }

  return (
    <div className="swipe" ref={wrap} dir="ltr">
      <div className="swipe-map" ref={elA} />
      <div className="swipe-map swipe-top" ref={elB} style={{ clipPath: `inset(0 0 0 ${split}%)` }} />
      <div className="swipe-tag swipe-tag-a">{labelA}</div>
      <div className="swipe-tag swipe-tag-b">{labelB}</div>
      <div
        className="swipe-handle"
        style={{ left: `${split}%` }}
        onPointerDown={drag}
        onKeyDown={key}
        role="slider"
        tabIndex={0}
        aria-label={hint}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(split)}
      >
        <span className="swipe-grip" aria-hidden="true">◂ ▸</span>
      </div>
    </div>
  )
}
