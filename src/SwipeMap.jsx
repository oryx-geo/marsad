// MARSAD · written with the help of an SI (Super Intelligence) coding assistant; reviewed and tested by team ORYX GEO.
import React, { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'

// Two maps on top of each other. The top one is clipped at the handle,
// so dragging the handle wipes between the two pictures.

export const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

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
      pic: { type: 'image', url, coordinates: [[w, n], [e, n], [e, s], [w, s]] },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#17122E' } },
      { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-opacity': 0.5, 'raster-saturation': -0.7, 'raster-brightness-max': 0.55 } },
      { id: 'pic', type: 'raster', source: 'pic', paint: { 'raster-fade-duration': 0, 'raster-resampling': 'linear' } },
    ],
  }
}

function padding(inPage) {
  const wide = window.innerWidth > 980 && !inPage
  return wide ? { top: 86, bottom: 150, left: 430, right: 24 } : { top: 12, bottom: 12, left: 12, right: 12 }
}

export default function SwipeMap({ bbox, urlA, urlB, labelA, labelB, hint, onPick, marker, inPage, coop }) {
  const wrap = useRef(null)
  const elA = useRef(null)
  const elB = useRef(null)
  const maps = useRef(null)
  const pick = useRef(onPick)
  pick.current = onPick
  const [split, setSplit] = useState(() => (window.innerWidth > 980 && !inPage ? 62 : 50))

  useEffect(() => {
    const [w, s, e, n] = bbox
    const make = (el, url, interactive) =>
      new maplibregl.Map({
        container: el,
        style: styleFor(bbox, url),
        bounds: [[w, s], [e, n]],
        fitBoundsOptions: { padding: padding(inPage) },
        cooperativeGestures: !!coop && interactive,
        attributionControl: false,
        interactive,
        maxZoom: 15,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      })
    const a = make(elA.current, urlA, true)
    const b = make(elB.current, urlB, false)
    a.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    a.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'top-right')
    a.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right')
    a.touchZoomRotate.disableRotation()
    a.getCanvas().style.cursor = 'crosshair'
    const sync = () => b.jumpTo({ center: a.getCenter(), zoom: a.getZoom(), bearing: 0, pitch: 0 })
    a.on('move', sync)
    a.on('click', (ev) => pick.current && pick.current(ev.lngLat.lng, ev.lngLat.lat))
    maps.current = { a, b, markers: [] }
    // keep the picture framed when the box changes size, until the visitor moves the map
    let touched = false
    a.on('dragstart', () => { touched = true })
    a.on('zoomstart', (ev) => { if (ev.originalEvent) touched = true })
    const ro = new ResizeObserver(() => {
      a.resize(); b.resize()
      if (!touched) a.fitBounds([[w, s], [e, n]], { padding: padding(inPage), duration: 0 })
      sync()
    })
    ro.observe(wrap.current)
    return () => { ro.disconnect(); a.remove(); b.remove(); maps.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const m = maps.current
    if (!m) return
    const [w, s, e, n] = bbox
    const coordinates = [[w, n], [e, n], [e, s], [w, s]]
    const set = (map, url) => {
      const apply = () => map.getSource('pic')?.updateImage({ url, coordinates })
      if (map.isStyleLoaded()) apply(); else map.once('load', apply)
    }
    set(m.a, urlA)
    set(m.b, urlB)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlA, urlB])

  useEffect(() => {
    const m = maps.current
    if (!m) return
    m.markers.forEach((k) => k.remove())
    m.markers = []
    if (marker) {
      for (const map of [m.a, m.b]) {
        const el = document.createElement('div')
        el.className = 'probe-pin'
        m.markers.push(new maplibregl.Marker({ element: el }).setLngLat(marker).addTo(map))
      }
    }
  }, [marker])

  const drag = (ev) => {
    const r = wrap.current.getBoundingClientRect()
    const move = (e) => setSplit(Math.max(2, Math.min(98, ((e.clientX - r.left) / r.width) * 100)))
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
      <div className="swipe-tag swipe-tag-a" style={{ right: `calc(${100 - split}% + 30px)` }}>{labelA}</div>
      <div className="swipe-tag swipe-tag-b" style={{ left: `calc(${split}% + 30px)` }}>{labelB}</div>
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
