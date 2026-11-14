import React, { useEffect, useMemo, useRef, useState } from 'react'
import SwipeMap, { BLANK } from './SwipeMap.jsx'
import ExploreMap, { askCatalogue } from './Explore.jsx'
import Chart from './Chart.jsx'
import Report from './Report.jsx'
import { probe } from './probe.js'
import { SITES, UI, channelText } from './content.js'

const BASE = import.meta.env.BASE_URL
const AUDIENCES = ['public', 'decision', 'resource', 'educator', 'scientist']
// the colours of the change map (the same as in server/app.py)
const KIND_COLOUR = { to_water: '#286EFF', from_water: '#00C8DC', built_up: '#FF3C3C', veg_up: '#46C850', both_up: '#FF78C8', both_down: '#6E6EA0', veg_down: '#BE7828', brighter: '#FFBE28', darker: '#965AC8' }
const REPO = 'https://github.com/oryx-geo/marsad'

// Fonts the team can compare (temporary switch). Arabic letters always use Readex Pro.
const FONTS = [
  { id: '1', name: 'Readex Pro', css: '"Readex Pro Variable"', weight: 350 },
  { id: '2', name: 'Inter', css: '"Inter Variable"', weight: 400 },
  { id: '3', name: 'IBM Plex Sans', css: '"IBM Plex Sans"', weight: 400 },
  { id: '4', name: 'Space Grotesk', css: '"Space Grotesk Variable"', weight: 400 },
  { id: '5', name: 'DM Sans', css: '"DM Sans Variable"', weight: 400 },
  { id: '6', name: 'Lora (serif)', css: '"Lora Variable"', weight: 400 },
]

function makeFormat(lang) {
  const loc = lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB'
  const f = (v, digits = 0) => new Intl.NumberFormat(loc, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v)
  const df = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  f.d = (iso) => df.format(new Date(iso + 'T00:00:00Z'))
  f.locale = loc
  return f
}

const radarUrl = (site, track, date, pol) => `${BASE}data/${site}/${track}/${date}_${pol}.webp`

// Opening: the MARSAD logo assembles itself. The three strokes of the M land one after
// another like beats, the leaves sprout, the rest of the word slides out, a radar pulse
// goes out, and the team signs it. The pieces are cut from the team's own logo file.
function Intro({ t, onDone }) {
  useEffect(() => {
    const id = setTimeout(onDone, 6200)
    return () => clearTimeout(id)
  }, [onDone])
  const part = (name) => `${BASE}logos/parts/${name}.png`
  return (
    <div className="intro" onClick={onDone} role="presentation">
      <div className="intro-box" dir="ltr">
        <div className="intro-logo" role="img" aria-label="MARSAD">
          <img className="ip navy" src={part('navy')} alt="" />
          <img className="ip brown" src={part('brown')} alt="" />
          <img className="ip green" src={part('green')} alt="" />
          <img className="ip leaves" src={part('leaves')} alt="" />
          <img className="ip letters" src={part('letters')} alt="" />
        </div>
        {/* the radar echo: three beats under the M that settle into the shape of the land */}
        <svg className="intro-echo" viewBox="0 0 1204 110" aria-hidden="true">
          <path pathLength="1" d="M10 78 H52 L70 22 L92 96 L112 78 H140 L158 10 L182 100 L204 78 H226 L242 34 L262 92 L280 78
            C340 78 372 52 430 52 S520 84 590 80 S700 40 770 44 S880 86 950 78 S1080 58 1194 66" />
        </svg>
        <p className="intro-tag">{t.tagline}</p>
        <div className="intro-by">
          <img src={`${BASE}logos/oryx-geo-ai.png`} alt="ORYX GEO team logo (AI-generated image)" />
          <span>ORYX GEO</span>
        </div>
      </div>
      {/* the land itself rises at the bottom of the screen */}
      <svg className="intro-land" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true">
        <path className="l1" d="M0 190 C180 120 330 150 520 175 S860 110 1080 150 S1340 190 1440 140 V320 H0 Z" />
        <path className="l2" d="M0 240 C200 190 380 250 600 225 S940 170 1160 215 S1380 250 1440 220 V320 H0 Z" />
        <path className="l3" d="M0 285 C220 250 420 300 660 280 S1000 245 1220 275 S1400 295 1440 280 V320 H0 Z" />
      </svg>
      <button type="button" className="intro-skip" onClick={onDone}>{t.skip}</button>
    </div>
  )
}

function Audience({ t, audience, setAudience, text }) {
  return (
    <section className="who">
      <div className="who-row" role="group" aria-label={t.audienceTitle}>
        <span className="who-label">{t.audienceTitle}</span>
        {AUDIENCES.map((k) => (
          <button key={k} type="button" aria-pressed={audience === k} onClick={() => setAudience(k)}>{t.audience[k]}</button>
        ))}
      </div>
      {text && <p className="who-text" key={audience} aria-live="polite">{text}</p>}
    </section>
  )
}

function Site({ site, lang, audience, setAudience, inPage, coop }) {
  const t = UI[lang]
  const f = useMemo(() => makeFormat(lang), [lang])
  const [data, setData] = useState(null)
  const [track, setTrack] = useState(site.track)
  const [pol, setPol] = useState(site.pol)
  const [view, setView] = useState('radar')
  const [a, setA] = useState(null)
  const [b, setB] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [tab, setTab] = useState('why')
  const [point, setPoint] = useState(null)
  const [series, setSeries] = useState(null)
  const [rep, setRep] = useState(false)
  // Sound is on unless the visitor turned it off. Browsers only allow sound after a first
  // click or key press, so the audio engine wakes up on that first touch.
  const [sound, setSound] = useState(() => { try { return localStorage.getItem('marsad-sound') !== '0' } catch { return true } })
  const audio = useRef(null)
  useEffect(() => {
    const wake = () => {
      if (!audio.current) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audio.current = new AC() }
      audio.current?.resume?.()
    }
    window.addEventListener('pointerdown', wake)
    window.addEventListener('keydown', wake)
    return () => { window.removeEventListener('pointerdown', wake); window.removeEventListener('keydown', wake) }
  }, [])

  useEffect(() => {
    let alive = true
    fetch(`${BASE}data/${site.id}.json`).then((r) => r.json()).then((d) => {
      if (!alive) return
      const dates = d.tracks[site.track].dates
      setData(d)
      setA(site.from || dates[0])
      setB(site.to || dates[dates.length - 1])
    })
    return () => { alive = false }
  }, [site])

  const tr = data?.tracks[track]
  const dates = tr?.dates || []
  const pols = tr?.pols || ['hh']
  const usePol = pols.includes(pol) ? pol : pols[0]

  useEffect(() => {
    if (!tr) return
    const near = (d) => dates.reduce((p, c) => (Math.abs(new Date(c) - new Date(d)) < Math.abs(new Date(p) - new Date(d)) ? c : p))
    if (a && !dates.includes(a)) setA(near(a))
    if (b && !dates.includes(b)) setB(near(b))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, tr])

  useEffect(() => {
    if (!playing || !dates.length) return
    const id = setInterval(() => setB((cur) => dates[(dates.indexOf(cur) + 1) % dates.length]), 1100)
    return () => clearInterval(id)
  }, [playing, dates])

  // warm the browser cache so the animation does not flicker
  useEffect(() => {
    dates.forEach((d) => { const im = new Image(); im.src = radarUrl(site.id, track, d, usePol) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, usePol, dates.length])

  // read the clicked point on every date
  useEffect(() => {
    if (!point || !data || !dates.length) { setSeries(null); return }
    let alive = true
    setSeries('busy')
    probe({
      urls: dates.map((d) => ({ date: d, url: radarUrl(site.id, track, d, usePol) })),
      bbox: data.bbox, size: data.size, stretch: data.stretch_db[usePol], lon: point[0], lat: point[1],
    }).then((rows) => { if (alive) setSeries(rows || 'outside') }).catch(() => { if (alive) setSeries(null) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [point, track, usePol, data])

  // "hear the rhythm": every date plays a short note, higher when the charted value is higher
  useEffect(() => {
    if (!sound || !tr || !audio.current) return
    const key = site.chart.series[0].key
    const vals = tr.series.map((r) => r[key]).filter((v) => v != null)
    const row = tr.series.find((r) => r.date === b)
    if (!row || row[key] == null) return
    const lo = site.chart.yDomain ? site.chart.yDomain[0] : Math.min(...vals)
    const hi = site.chart.yDomain ? site.chart.yDomain[1] : Math.max(...vals)
    const x = Math.max(0, Math.min(1, (row[key] - lo) / (hi - lo || 1)))
    const ctx = audio.current
    const now = ctx.currentTime
    const osc = ctx.createOscillator(), gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = 196 * Math.pow(2, x * 2)        // two octaves, from G3 up
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now); osc.stop(now + 0.6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b, sound, track])
  const toggleSound = () => setSound((v) => { try { localStorage.setItem('marsad-sound', v ? '0' : '1') } catch { /* private mode */ } return !v })

  if (!data || !a || !b || !dates.includes(a) || !dates.includes(b)) return <p className="loading">{t.loading}</p>

  const txt = site.text[lang]
  const n = site.facts(tr.series, data.tracks, data)
  const say = (v) => (typeof v === 'function' ? v(n, f) : v)
  const opt = (d) => data.optical?.by_nisar_date?.[d]
  const optUrl = (d) => (opt(d) ? `${BASE}data/${site.id}/optical/${opt(d).date}_${opt(d).sensor}.jpg` : BLANK)
  const optLabel = (d) => (opt(d) ? `${t.realTag} · ${f.d(opt(d).date)}` : `${t.realTag} · ${t.noReal}`)
  const rad = (d) => radarUrl(site.id, track, d, usePol)
  const radLabel = (d) => `${t.radarTag} ${usePol.toUpperCase()} · ${f.d(d)}`
  const cb = (d) => data.cband?.by_nisar_date?.[d]
  const hasC = Object.values(data.cband?.by_nisar_date || {}).some(Boolean)
  const cPol = usePol === 'hh' ? 'vv' : 'vh'
  const cUrl = (d) => (cb(d) ? `${BASE}data/${site.id}/cband/${cb(d).date}_${cPol}.jpg` : BLANK)
  const cLabel = (d) => (cb(d) ? `${t.cTag} ${cPol.toUpperCase()} · ${f.d(cb(d).date)}` : `${t.cTag} · ${t.noC}`)

  let urlA, urlB, labelA, labelB
  if (view === 'radar') { urlA = rad(a); urlB = rad(b); labelA = `${t.before} · ${f.d(a)}`; labelB = `${t.after} · ${f.d(b)}` }
  else if (view === 'real') { urlA = optUrl(a); urlB = optUrl(b); labelA = optLabel(a); labelB = optLabel(b) }
  else if (view === 'cband') { urlA = cUrl(b); urlB = rad(b); labelA = cLabel(b); labelB = `${t.lTag} ${usePol.toUpperCase()} · ${f.d(b)}` }
  else { urlA = optUrl(b); urlB = rad(b); labelA = optLabel(b); labelB = radLabel(b) }
  const single = view === 'both' || view === 'cband'   // both sides show the same date

  let verdict = null
  if (Array.isArray(series)) {
    const ok = series.filter((r) => r.db != null)
    if (ok.length > 1) {
      const lo = ok.reduce((p, c) => (c.db < p.db ? c : p)), hi = ok.reduce((p, c) => (c.db > p.db ? c : p))
      const range = hi.db - lo.db
      const [d1, d2] = [lo.date, hi.date].sort()
      verdict = range < 3 ? t.probeSteady(f(range, 1)) : t.probeMoved(f(range, 1), f.d(d1), f.d(d2))
    }
  }

  const model = rep && {
    kicker: txt.kicker, title: txt.name, place: txt.place, lead: say(txt.lead),
    facts: site.passes ? [site.passes[track][lang]] : null,
    pictures: [
      { title: `${t.repPictures} · NISAR ${usePol.toUpperCase()}`, items: [
        { src: rad(a), caption: `${t.before} · ${f.d(a)}` },
        { src: rad(b), caption: `${t.after} · ${f.d(b)}` },
      ] },
      ...(opt(a) || opt(b) ? [{ title: t.repReal, items: [a, b].filter(opt).map((d) => ({ src: optUrl(d), caption: f.d(opt(d).date) })) }] : []),
    ],
    chart: { rows: tr.series, series: site.chart.series, bars: site.chart.bars, unit: site.chart.unit, yDomain: site.chart.yDomain, current: b, compare: a },
    point: Array.isArray(series) ? { where: `${point[1].toFixed(4)}°, ${point[0].toFixed(4)}° · NISAR ${usePol.toUpperCase()}`, rows: series, verdict } : null,
    audiences: AUDIENCES.map((k) => ({ who: `${t.audienceTitle} ${t.audience[k]}`, text: say(txt.audience[k]) })),
    sections: [
      { h: t.whyTitle, p: say(txt.why) },
      { h: t.whyNotTitle, p: say(txt.whyNot) },
      { h: t.careTitle, p: say(txt.care) },
    ],
  }

  return (
    <>
      <div className="map-area">
        <SwipeMap key={site.id + track} bbox={data.bbox} urlA={urlA} urlB={urlB} labelA={labelA} labelB={labelB}
          hint={t.dragHint} onPick={(lon, lat) => setPoint([lon, lat])} marker={point} inPage={inPage} coop={coop} />
      </div>

      <aside className="panel">
        <header className="site-head">
          <p className="kicker">{txt.kicker}</p>
          <h1>{txt.name} <span className="place">{txt.place}</span></h1>
          <p className="lead">{say(txt.lead)}</p>
        </header>

        <Audience t={t} audience={audience} setAudience={setAudience} text={say(txt.audience[audience])} />

        <section className="tabs2">
          <div className="tabs2-row" role="tablist">
            {[['why', t.tabWhy], ['whyNot', t.tabWhyNot], ['care', t.tabCare]].map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>
            ))}
          </div>
          <p className={`tabs2-body ${tab}`} role="tabpanel">{say(txt[tab])}</p>
        </section>

        <section className="block">
          <h2>{t.chartTitle}</h2>
          <Chart rows={tr.series} series={site.chart.series} bars={site.chart.bars} unit={site.chart.unit}
            yDomain={site.chart.yDomain} current={b} compare={single ? null : a} locale={f.locale}
            onPick={(d) => { setPlaying(false); setB(d) }} />
          <ul className="key">
            {site.chart.series.map((s) => (
              <li key={s.key}><span className="swatch" style={{ background: s.color }} />{s.label[lang]}</li>
            ))}
            {site.chart.bars && <li><span className="swatch bar" style={{ background: site.chart.bars.color }} />{site.chart.bars.label[lang]}</li>}
          </ul>
          <p className="hint">{t.chartHint}</p>
        </section>

        <section className="block probe">
          <h2>{t.probeTitle}</h2>
          {!point && <p className="hint">{t.probeHint}</p>}
          {series === 'busy' && <p className="hint">{t.loading}</p>}
          {series === 'outside' && <p className="hint">{t.probeOutside}</p>}
          {Array.isArray(series) && (
            <>
              <p className="coords" dir="ltr">{point[1].toFixed(4)}°, {point[0].toFixed(4)}° · NISAR {usePol.toUpperCase()}</p>
              <Chart rows={series} series={[{ key: 'db', color: 'var(--c-probe)', label: '' }]} unit="dB" current={b}
                compare={single ? null : a} locale={f.locale} onPick={(d) => { setPlaying(false); setB(d) }} small />
              {verdict && <p className="verdict">{verdict}</p>}
              <p className="hint">{t.probeNote}</p>
            </>
          )}
        </section>
      </aside>

      <div className="dock">
        <div className="dock-time">
          <button type="button" className="play" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
            {playing ? `❚❚ ${t.pause}` : `▶ ${t.play}`}
          </button>
          <div className="time-col">
            <label htmlFor={`time-${site.id}`}>{t.timeline}: <strong>{f.d(b)}</strong></label>
            <input id={`time-${site.id}`} type="range" min={0} max={dates.length - 1} value={dates.indexOf(b)} dir="ltr"
              onChange={(e) => { setPlaying(false); setB(dates[+e.target.value]) }} />
          </div>
          {!single && (
            <div className="cmp">
              <label htmlFor={`cmp-${site.id}`}>{t.compareWith}</label>
              <select id={`cmp-${site.id}`} value={a} onChange={(e) => setA(e.target.value)}>
                {dates.map((d) => <option key={d} value={d}>{f.d(d)}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="dock-row">
          <div className="seg" role="group" aria-label={t.view}>
            {[['radar', t.viewRadar], ['real', t.viewReal], ['both', t.viewBoth], ...(hasC ? [['cband', t.viewC]] : [])].map(([k, label]) => (
              <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)}>{label}</button>
            ))}
          </div>
          <div className="seg" role="group" aria-label={t.channel}>
            {['hh', 'hv'].map((p) => (
              <button key={p} type="button" disabled={!pols.includes(p)} aria-pressed={usePol === p} onClick={() => setPol(p)}>{p.toUpperCase()}</button>
            ))}
          </div>
          {site.passes && (
            <div className="seg" role="group" aria-label={t.pass}>
              {Object.entries(site.passes).map(([k, v]) => (
                <button key={k} type="button" aria-pressed={track === k} onClick={() => setTrack(k)}>{v[lang]}</button>
              ))}
            </div>
          )}
          <button type="button" className="snd" aria-pressed={sound} onClick={toggleSound} title={t.soundHint}>{sound ? '🔊' : '🔈'} {t.sound}</button>
          <button type="button" className="rep-open" onClick={() => setRep(true)}>📄 {t.report}</button>
        </div>
        <p className="dock-note">
          {sound ? t.soundHint + ' ' : ''}{view === 'radar' ? (pols.length === 1 ? t.hhOnly : channelText(lang, usePol)) : view === 'cband' ? t.cNote : t.realNote}
        </p>
      </div>
      {model && <Report model={model} t={t} lang={lang} f={f} onClose={() => setRep(false)} />}
    </>
  )
}

// The live analysis server is optional. Its address is in public/live.json.
// If it does not answer, the "Analyse this place" button simply does not appear.
// This header tells the tunnel to skip its "you are about to visit" page for our requests.
const NGROK = { 'X-Tunnel-Skip-AntiPhishing-Page': 'true' }
function useLiveServer() {
  const [api, setApi] = useState(null)
  useEffect(() => {
    let alive = true
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 6000)
    fetch(`${BASE}live.json`, { cache: 'no-store' }).then((r) => r.json()).then((cfg) => {
      if (!cfg.api) return null
      return fetch(`${cfg.api}/health`, { headers: NGROK, signal: ctl.signal }).then((r) => r.json()).then((h) => (h.ok ? cfg.api : null))
    }).then((url) => { if (alive && url) setApi(url) }).catch(() => {}).finally(() => clearTimeout(timer))
    return () => { alive = false }
  }, [])
  return api
}

function Anywhere({ lang, inPage, coop }) {
  const t = UI[lang]
  const f = useMemo(() => makeFormat(lang), [lang])
  const api = useLiveServer()
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const [ana, setAna] = useState(null)
  const [pol, setPol] = useState('hh')
  const [rv, setRv] = useState('pair')     // which picture pair the map shows: before/after, change map, real colour
  const [rep, setRep] = useState(false)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const lon = parseFloat(q.get('lon')), lat = parseFloat(q.get('lat'))
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 85) return
    setBusy(true)
    askCatalogue(lon, lat).then(setRes).catch(() => setRes({ error: true, lon, lat })).finally(() => setBusy(false))
  }, [])
  const hasHV = res && Object.keys(res.byChannel || {}).some((k) => k.includes('HV'))

  // The server answers at once with {status: "working"}; we ask again every few seconds.
  const run = () => {
    setAna('busy')
    const url = `${api}/analyze?lon=${res.lon.toFixed(4)}&lat=${res.lat.toFixed(4)}`
    const started = Date.now()
    const ask = () => fetch(url, { headers: NGROK })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        if (d.status === 'working') {
          if (Date.now() - started > 8 * 60 * 1000) return setAna('error')
          return new Promise((ok) => setTimeout(ok, 5000)).then(ask)
        }
        if (d.status === 'failed') return setAna('error')
        setAna(d.found ? d : 'none')
        if (d.found) setPol(d.channels.hh ? 'hh' : Object.keys(d.channels)[0])
      })
    ask().catch((code) => setAna(code === 429 ? 'limit' : 'error'))
  }
  const shown = ana && typeof ana === 'object' ? ana : null
  const ch = shown && (shown.channels[pol] || Object.values(shown.channels)[0])
  const total = ch ? ch.brighter_pct + ch.darker_pct : 0

  const baseVerdict = total < 2 ? t.anaLittle : total < 10 ? t.anaSome : t.anaMuch

  // The plain-language reading. The server sends numbers; every sentence is built from them here.
  const rd = shown?.reading
  const coverLines = rd ? Object.entries(rd.cover_after).filter(([, v]) => v >= 1).sort((x, y) => y[1] - x[1])
    .map(([k, v]) => `${f(v)}% ${t.rdCover[k]}`) : []
  const changeLines = rd ? rd.changes.map((c) => `${t.rdKind[c.kind]}: ${t.rdLine(f(c.pct, 1), f(c.km2, 1))}`) : []
  const reasonLines = rd ? rd.changes.map((c) => `${t.rdKind[c.kind]}: ${t.rdReason[c.kind]}`) : []
  const notes = rd ? [
    rd.changes.length && rd.where && Math.abs(rd.scene_shift_db) < 3 && Math.max(rd.cover_before.water, rd.cover_after.water) < 50 ? t.rdWhere[rd.where] : null,
    Math.abs(rd.scene_shift_db) >= 1.5 ? t.rdShift(f(Math.abs(rd.scene_shift_db), 1), rd.scene_shift_db > 0) : null,
    rd.cover_after.water >= 50 ? t.rdWaterMostly : null,
  ].filter(Boolean) : []
  // water or weather: the whole square moved together, so the parts cannot be explained one by one
  const weather = !!rd && (Math.abs(rd.scene_shift_db) >= 3 || Math.max(rd.cover_before.water, rd.cover_after.water) >= 50)
  const real = shown?.real || [null, null]
  const hasReal = real.some(Boolean)
  const verdictText = weather ? t.rdWeather : baseVerdict
  let mapA = ch?.before, mapB = ch?.after
  let tagA = shown ? `${t.before} · ${f.d(shown.dates[0])}` : '', tagB = shown ? `${t.after} · ${f.d(shown.dates[1])}` : ''
  if (shown && rv === 'map' && shown.change_map) { mapA = shown.channels.hh?.after || ch.after; mapB = shown.change_map; tagA = `${t.after} · ${f.d(shown.dates[1])}`; tagB = t.rdViewMap }
  if (shown && rv === 'real' && hasReal) {
    mapA = real[0]?.src || BLANK; mapB = real[1]?.src || BLANK
    tagA = real[0] ? `${t.realTag} · ${f.d(real[0].date)}` : `${t.realTag} · ${t.noReal}`
    tagB = real[1] ? `${t.realTag} · ${f.d(real[1].date)}` : `${t.realTag} · ${t.noReal}`
  }
  const model = rep && shown && {
    kicker: t.anaBeta, title: t.anaTitle,
    place: `${res.lat.toFixed(3)}°, ${res.lon.toFixed(3)}° · 10 km × 10 km`,
    lead: verdictText,
    facts: [
      t.anaPeriod(f.d(shown.dates[0]), f.d(shown.dates[1]), f(shown.passes)),
      ...Object.entries(shown.channels).flatMap(([k, c]) => [
        `${k.toUpperCase()}: ${t.anaNumbers(f(c.brighter_pct, 1), f(c.darker_pct, 1))}`,
        `${k.toUpperCase()}: ${t.anaMean(f(c.before_db, 1), f(c.after_db, 1))}`,
      ]),
    ],
    pictures: [
      ...Object.entries(shown.channels).map(([k, c]) => ({
        title: `${t.repPictures} · NISAR ${k.toUpperCase()}`,
        items: [{ src: c.before, caption: `${t.before} · ${f.d(shown.dates[0])}` }, { src: c.after, caption: `${t.after} · ${f.d(shown.dates[1])}` }],
      })),
      ...(shown.change_map ? [{ title: t.rdViewMap, items: [{ src: shown.change_map, caption: t.rdMapNote }] }] : []),
      ...(hasReal ? [{ title: t.repReal, items: real.filter(Boolean).map((x) => ({ src: x.src, caption: f.d(x.date) })) }] : []),
    ],
    sections: [
      ...(rd ? [
        { h: `${t.rdTitle}: ${t.rdLooks}`, p: t.rdIntro(f(rd.area_km2)), list: coverLines },
        { h: weather ? `${t.rdChanged} ${t.rdUnreliable}` : t.rdChanged, p: rd.changes.length ? [weather ? t.rdWeather : null, ...notes].filter(Boolean).join(' ') : t.rdNothing, list: changeLines },
        ...(rd.changes.length && !weather ? [{ h: t.rdWhy, list: reasonLines }] : []),
        { h: t.rdSame, p: t.rdStable(f(rd.stable_pct, 1)) },
      ] : []),
      { h: t.careTitle, p: t.anaCare },
    ],
  }

  return (
    <>
      <div className="map-area">
        {shown ? (
          <SwipeMap key={shown.bbox.join()} bbox={shown.bbox} urlA={mapA} urlB={mapB}
            labelA={tagA} labelB={tagB} hint={t.dragHint} inPage={inPage} coop={coop} />
        ) : (
          <ExploreMap onResult={(r) => { setRes(r); setAna(null); setRv('pair') }} onBusy={setBusy} inPage={inPage} coop={coop} />
        )}
      </div>
      <aside className="panel">
        <header className="site-head">
          <p className="kicker">{t.anywhereKicker}</p>
          <h1>{t.exTitle}</h1>
          <p className="lead">{t.exLead}</p>
        </header>

        {shown && (
          <section className="who">
            <p className="beta">{t.anaBeta}</p>
            <h2>{t.anaTitle}</h2>
            <p className="coords" dir="ltr">{res.lat.toFixed(3)}°, {res.lon.toFixed(3)}° · NISAR {Object.keys(shown.channels).map((k) => k.toUpperCase()).join(' + ')}</p>
            <p className="verdict">{verdictText}</p>
            <p>{t.anaNumbers(f(ch.brighter_pct, 1), f(ch.darker_pct, 1))}</p>
            <p>{t.anaMean(f(ch.before_db, 1), f(ch.after_db, 1))}</p>
            <p className="hint">{t.anaPeriod(f.d(shown.dates[0]), f.d(shown.dates[1]), f(shown.passes))}</p>
            {rd && (
              <div className="seg" role="group" aria-label={t.view} style={{ marginTop: 10 }}>
                {[['pair', t.rdViewPair], ['map', t.rdViewMap], ...(hasReal ? [['real', t.rdViewReal]] : [])].map(([k, label]) => (
                  <button key={k} type="button" aria-pressed={rv === k} onClick={() => setRv(k)}>{label}</button>
                ))}
              </div>
            )}
            {rd && rv === 'map' && (
              <ul className="legend">
                {rd.changes.map((c) => <li key={c.kind}><span style={{ background: KIND_COLOUR[c.kind] }} />{t.rdKind[c.kind]}</li>)}
              </ul>
            )}
            <div className="seg" role="group" aria-label={t.channel} style={{ marginTop: 10 }}>
              {['hh', 'hv'].map((p) => (
                <button key={p} type="button" disabled={!shown.channels[p]} aria-pressed={pol === p} onClick={() => setPol(p)}>{p.toUpperCase()}</button>
              ))}
              <button type="button" onClick={() => setAna(null)}>↩ {t.anaBack}</button>
              <button type="button" className="rep-open" onClick={() => setRep(true)}>📄 {t.report}</button>
            </div>
            <p className="hint">{Object.keys(shown.channels).length === 1 ? t.hhOnly : channelText(lang, pol)}</p>
            <p className="hint">{t.anaCare}</p>
          </section>
        )}

        {shown && rd && (
          <section className="block reading">
            <h2>{t.rdTitle}</h2>
            <p className="hint">{t.rdIntro(f(rd.area_km2))}</p>
            <h3>{t.rdLooks}</h3>
            <ul className="facts">{coverLines.map((x) => <li key={x}>{x}</li>)}</ul>
            <h3>{t.rdChanged} {weather && <span className="hint">{t.rdUnreliable}</span>}</h3>
            {weather && <p className="rd-note">{t.rdWeather}</p>}
            {notes.map((x) => <p key={x} className="rd-note">{x}</p>)}
            {rd.changes.length ? <ul className="facts">{changeLines.map((x) => <li key={x}>{x}</li>)}</ul> : <p>{t.rdNothing}</p>}
            {rd.changes.length > 0 && !weather && (
              <>
                <h3>{t.rdWhy}</h3>
                <ul className="facts">{reasonLines.map((x) => <li key={x}>{x}</li>)}</ul>
              </>
            )}
            <h3>{t.rdSame}</h3>
            <p>{t.rdStable(f(rd.stable_pct, 1))}</p>
          </section>
        )}

        {!shown && (
          <section className="block" aria-live="polite">
            {busy && <p className="hint">{t.exBusy}</p>}
            {!busy && res?.error && <p className="verdict">{t.exError}</p>}
            {!busy && res && !res.error && (
              <>
                <p className="coords" dir="ltr">{res.lat.toFixed(3)}°, {res.lon.toFixed(3)}°</p>
                {res.passes.length === 0 ? <p className="verdict">{t.exNone}</p> : (
                  <>
                    <p className="verdict">{t.exCount(f(res.passes.length), f.d(res.passes[0].date), f.d(res.passes[res.passes.length - 1].date))}</p>
                    {api && (
                      <div className="ana">
                        <button type="button" className="play" onClick={run} disabled={ana === 'busy'}>{ana === 'busy' ? '…' : `▶ ${t.anaButton}`}</button>
                        <p className="hint">{ana === 'busy' ? t.anaBusy : ana === 'error' ? t.anaError : ana === 'limit' ? t.anaLimit : ana === 'none' ? t.anaNone : t.anaTime}</p>
                      </div>
                    )}
                    <h2>{t.exChannels}</h2>
                    <ul className="facts">
                      {Object.entries(res.byChannel).map(([k, v]) => <li key={k}><strong dir="ltr">{k}</strong> · {f(v)} {t.exPasses}</li>)}
                    </ul>
                    <p>{hasHV ? t.exHasHV : t.exOnlyHH}</p>
                    <h2>{t.exTracks}</h2>
                    <ul className="facts">
                      {res.tracks.map((k) => (
                        <li key={k.track + k.dir}><strong dir="ltr">{k.track}</strong> · {k.dir === 'A' ? t.exAsc : t.exDesc} · {f(k.n)} {t.exPasses} · {f.d(k.first)} → {f.d(k.last)}</li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
            {!api && <p className="hint">{t.exNote}</p>}
          </section>
        )}
      </aside>
      {model && <Report model={model} t={t} lang={lang} f={f} onClose={() => setRep(false)} />}
    </>
  )
}

// A chapter of the scrolling design. Its maps are created only while it is near the screen,
// so a phone never has to hold all the maps at once.
function Chapter({ id, number, children }) {
  const ref = useRef(null)
  const [near, setNear] = useState(false)
  const [seen, setSeen] = useState(false)
  const [height, setHeight] = useState(900)
  useEffect(() => {
    const el = ref.current
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) setHeight(el.offsetHeight)
      setNear(e.isIntersecting)
    }, { rootMargin: '900px 0px' })
    const io2 = new IntersectionObserver(([e]) => { if (e.isIntersecting) setSeen(true) }, { threshold: 0.08 })
    io.observe(el); io2.observe(el)
    return () => { io.disconnect(); io2.disconnect() }
  }, [])
  return (
    <section ref={ref} id={id} className={`chapter${seen ? ' in' : ''}`} style={near ? undefined : { minHeight: height }}>
      <span className="chapter-no" aria-hidden="true">{number}</span>
      {near && children}
    </section>
  )
}

function About({ t }) {
  return (
    <>
      <h2>{t.futureTitle}</h2>
      <p>{t.future}</p>
      <h2>{t.creditsTitle}</h2>
      <p>{t.credits}</p>
      <p><strong>{t.disclaimer}</strong></p>
      <div className="about-team">
        <img src={`${BASE}logos/oryx-geo-ai.png`} alt="ORYX GEO team logo (AI-generated image)" />
        <p>{t.team} <a href={REPO}>{t.source}</a></p>
      </div>
    </>
  )
}

export default function App() {
  const [lang, setLang] = useState('en')
  const [design, setDesign] = useState(() => {
    const q = new URLSearchParams(window.location.search).get('design')
    try { return q || localStorage.getItem('marsad-design') || 'a' } catch { return q || 'a' }
  })
  const [siteId, setSiteId] = useState(() => {
    const h = window.location.hash.slice(1)
    return h === 'anywhere' || SITES.some((s) => s.id === h) ? h : SITES[0].id
  })
  const [font, setFont] = useState(() => {
    const q = new URLSearchParams(window.location.search).get('font')
    try { return q || localStorage.getItem('marsad-font') || '1' } catch { return q || '1' }
  })
  useEffect(() => {
    const f = FONTS.find((x) => x.id === font) || FONTS[0]
    document.documentElement.style.setProperty('--font', `${f.css}, "Readex Pro Variable"`)
    document.documentElement.style.setProperty('--fw', f.weight)
    try { localStorage.setItem('marsad-font', font) } catch { /* private mode */ }
  }, [font])
  const [audience, setAudience] = useState('public')
  const [intro, setIntro] = useState(() => {
    try { return !sessionStorage.getItem('marsad-intro') && !window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return true }
  })
  const [about, setAbout] = useState(false)
  const t = UI[lang]
  const site = SITES.find((s) => s.id === siteId)
  const story = design === 'b'
  const paged = design === 'b' || design === 'd'   // the page itself scrolls

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])
  useEffect(() => { document.documentElement.dataset.design = design; try { localStorage.setItem('marsad-design', design) } catch { /* private mode */ } }, [design])
  useEffect(() => { if (!story) window.history.replaceState(null, '', '#' + siteId) }, [siteId, story])
  useEffect(() => {
    const on = () => { const h = window.location.hash.slice(1); if (h === 'anywhere' || SITES.some((x) => x.id === h)) setSiteId(h) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  useEffect(() => {
    if (!story) return
    const h = window.location.hash.slice(1)
    if (h) setTimeout(() => document.getElementById(h)?.scrollIntoView(), 300)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story])
  // on the scrolling designs the full logo gives way to the M icon once the page moves
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    if (!paged) { setScrolled(false); return }
    const on = () => setScrolled(window.scrollY > 90)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [paged])
  const endIntro = () => { setIntro(false); try { sessionStorage.setItem('marsad-intro', '1') } catch { /* private mode */ } }
  const go = (id) => {
    setSiteId(id)
    if (story) {
      const jump = () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
      jump(); setTimeout(jump, 900)   // chapters load as they come near, so aim twice
      window.history.replaceState(null, '', '#' + id)
    }
  }

  const bar = (
    <header className="bar">
      <a className="logo" href="#top" onClick={(e) => { e.preventDefault(); story ? window.scrollTo({ top: 0, behavior: 'smooth' }) : go('sindh') }}>
        <span className="logo-mark" dir="ltr">
          <img className="logo-m" src={`${BASE}logos/marsad-m.png`} alt="MARSAD" />
          <span className="logo-rest"><img src={`${BASE}logos/marsad-letters.png`} alt="" /></span>
        </span>
        <img className="logo-team" src={`${BASE}logos/oryx-geo-ai.png`} alt="ORYX GEO (AI-generated image)" title="ORYX GEO · AI-generated image" />
      </a>
      <nav className="places" aria-label={t.places}>
        {SITES.map((s) => (
          <button key={s.id} type="button" aria-pressed={!story && s.id === siteId} onClick={() => go(s.id)} title={s.text[lang].kicker}>
            {s.text[lang].name}
          </button>
        ))}
        <button type="button" className="any" aria-pressed={!story && siteId === 'anywhere'} onClick={() => go('anywhere')}>＋ {t.anywhere}</button>
      </nav>
      <div className="bar-end">
        {!paged && <button type="button" className="ghost" onClick={() => setAbout(true)} aria-label={t.creditsTitle}>ⓘ</button>}
        <button type="button" className="ghost lang" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>{t.langButton}</button>
      </div>
    </header>
  )

  const switcher = (
    <div className="design-switch">
      <div role="group" aria-label={t.designLabel}>
        <span>{t.designLabel}</span>
        {['a', 'b', 'c', 'd'].map((d) => (
          <button key={d} type="button" aria-pressed={design === d} onClick={() => { setDesign(d); window.scrollTo(0, 0) }}>{d.toUpperCase()}</button>
        ))}
      </div>
      <div role="group" aria-label="Font">
        <span>Font</span>
        {FONTS.map((x) => (
          <button key={x.id} type="button" aria-pressed={font === x.id} title={x.name} onClick={() => setFont(x.id)}>{x.id}</button>
        ))}
        <em>{(FONTS.find((x) => x.id === font) || FONTS[0]).name}</em>
      </div>
    </div>
  )

  if (story) {
    return (
      <div className={`app story${scrolled ? ' scrolled' : ''}`} id="top">
        {intro && <Intro t={t} onDone={endIntro} />}
        {bar}
        <section className="hero">
          <img className="hero-mark" src={`${BASE}logos/marsad-wordmark.png`} alt="MARSAD · مرصد" />
          <p className="hero-tag">{t.tagline}</p>
          <p className="hero-lead">{t.heroLead}</p>
          <div className="hero-rules">
            <p>{t.intro1}</p>
            <p><strong>{t.intro2}</strong></p>
          </div>
          <button type="button" className="hero-go" onClick={() => go(SITES[0].id)}>{t.scroll} <span aria-hidden="true">↓</span></button>
        </section>
        {SITES.map((s, i) => (
          <Chapter key={s.id} id={s.id} number={String(i + 1).padStart(2, '0')}>
            <Site site={s} lang={lang} audience={audience} setAudience={setAudience} inPage coop />
          </Chapter>
        ))}
        <Chapter id="anywhere" number="＋">
          <Anywhere lang={lang} inPage coop />
        </Chapter>
        <footer className="foot"><About t={t} /></footer>
        {switcher}
      </div>
    )
  }

  const one = site
    ? <Site key={site.id} site={site} lang={lang} audience={audience} setAudience={setAudience} inPage={design !== 'a'} coop={paged} />
    : <Anywhere lang={lang} inPage={design !== 'a'} coop={paged} />
  const dialog = about && (
    <div className="about" role="dialog" aria-modal="true" aria-label={t.creditsTitle} onClick={() => setAbout(false)}>
      <div className="about-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ghost close" onClick={() => setAbout(false)} aria-label="Close">✕</button>
        <h2>MARSAD · مرصد</h2>
        <p>{t.intro1}</p>
        <p><strong>{t.intro2}</strong></p>
        <About t={t} />
      </div>
    </div>
  )

  if (design === 'd') {
    return (
      <div className={`app story classic${scrolled ? ' scrolled' : ''}`} id="top">
        {intro && <Intro t={t} onDone={endIntro} />}
        {bar}
        <p className="classic-intro">{t.intro1} <strong>{t.intro2}</strong></p>
        <section className="chapter in" key={siteId}>{one}</section>
        <footer className="foot"><About t={t} /></footer>
        {dialog}
        {switcher}
      </div>
    )
  }

  return (
    <div className={design === 'c' ? 'app story dash' : 'app'}>
      {intro && <Intro t={t} onDone={endIntro} />}
      {bar}
      {one}
      {dialog}
      {switcher}
    </div>
  )
}
