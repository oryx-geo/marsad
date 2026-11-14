import React, { useEffect, useMemo, useState } from 'react'
import SwipeMap, { BLANK } from './SwipeMap.jsx'
import ExploreMap from './Explore.jsx'
import Chart from './Chart.jsx'
import { probe } from './probe.js'
import { SITES, UI, channelText } from './content.js'

const BASE = import.meta.env.BASE_URL
const AUDIENCES = ['public', 'decision', 'resource', 'educator', 'scientist']
const REPO = 'https://github.com/oryx-geo/marsad'

function makeFormat(lang) {
  const loc = lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB'
  const f = (v, digits = 0) => new Intl.NumberFormat(loc, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v)
  const df = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  f.d = (iso) => df.format(new Date(iso + 'T00:00:00Z'))
  f.locale = loc
  return f
}

const radarUrl = (site, track, date, pol) => `${BASE}data/${site}/${track}/${date}_${pol}.webp`

function Intro({ t, onDone }) {
  useEffect(() => {
    const id = setTimeout(onDone, 4300)
    return () => clearTimeout(id)
  }, [onDone])
  return (
    <div className="intro" onClick={onDone} role="presentation">
      <div className="intro-stage">
        <img className="intro-team" src={`${BASE}logos/oryx-geo-ai.png`} alt="ORYX GEO (AI-generated image)" />
        <div className="intro-beam" aria-hidden="true" />
        <div className="intro-mark">
          <img src={`${BASE}logos/marsad-wordmark.png`} alt="MARSAD" />
          <p>{t.tagline}</p>
        </div>
      </div>
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

function Site({ site, lang, audience, setAudience }) {
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

  if (!data || !a || !b || !dates.includes(a) || !dates.includes(b)) return <p className="loading">{t.loading}</p>

  const txt = site.text[lang]
  const n = site.facts(tr.series, data.tracks)
  const say = (v) => (typeof v === 'function' ? v(n, f) : v)
  const opt = (d) => data.optical?.by_nisar_date?.[d]
  const optUrl = (d) => (opt(d) ? `${BASE}data/${site.id}/optical/${opt(d).date}_${opt(d).sensor}.jpg` : BLANK)
  const optLabel = (d) => (opt(d) ? `${t.realTag} · ${f.d(opt(d).date)}` : `${t.realTag} · ${t.noReal}`)
  const rad = (d) => radarUrl(site.id, track, d, usePol)
  const radLabel = (d) => `${t.radarTag} ${usePol.toUpperCase()} · ${f.d(d)}`

  let urlA, urlB, labelA, labelB
  if (view === 'radar') { urlA = rad(a); urlB = rad(b); labelA = `${t.before} · ${f.d(a)}`; labelB = `${t.after} · ${f.d(b)}` }
  else if (view === 'real') { urlA = optUrl(a); urlB = optUrl(b); labelA = optLabel(a); labelB = optLabel(b) }
  else { urlA = optUrl(b); urlB = rad(b); labelA = optLabel(b); labelB = radLabel(b) }

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

  return (
    <>
      <div className="map-area">
        <SwipeMap key={site.id + track} bbox={data.bbox} urlA={urlA} urlB={urlB} labelA={labelA} labelB={labelB}
          hint={t.dragHint} onPick={(lon, lat) => setPoint([lon, lat])} marker={point} />
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
            yDomain={site.chart.yDomain} current={b} compare={view === 'both' ? null : a} locale={f.locale}
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
              <Chart rows={series} series={[{ key: 'db', color: '#FFFFFF', label: '' }]} unit="dB" current={b}
                compare={view === 'both' ? null : a} locale={f.locale} onPick={(d) => { setPlaying(false); setB(d) }} small />
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
            <label htmlFor="time">{t.timeline}: <strong>{f.d(b)}</strong></label>
            <input id="time" type="range" min={0} max={dates.length - 1} value={dates.indexOf(b)} dir="ltr"
              onChange={(e) => { setPlaying(false); setB(dates[+e.target.value]) }} />
          </div>
          {view !== 'both' && (
            <div className="cmp">
              <label htmlFor="cmp">{t.compareWith}</label>
              <select id="cmp" value={a} onChange={(e) => setA(e.target.value)}>
                {dates.map((d) => <option key={d} value={d}>{f.d(d)}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="dock-row">
          <div className="seg" role="group" aria-label={t.view}>
            {[['radar', t.viewRadar], ['real', t.viewReal], ['both', t.viewBoth]].map(([k, label]) => (
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
        </div>
        <p className="dock-note">
          {view === 'radar' ? (pols.length === 1 ? t.hhOnly : channelText(lang, usePol)) : t.realNote}
        </p>
      </div>
    </>
  )
}

function Anywhere({ lang }) {
  const t = UI[lang]
  const f = useMemo(() => makeFormat(lang), [lang])
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const hasHV = res && Object.keys(res.byChannel || {}).some((k) => k.includes('HV'))
  return (
    <>
      <div className="map-area"><ExploreMap onResult={setRes} onBusy={setBusy} /></div>
      <aside className="panel">
        <header className="site-head">
          <p className="kicker">{t.anywhereKicker}</p>
          <h1>{t.exTitle}</h1>
          <p className="lead">{t.exLead}</p>
        </header>
        <section className="block" aria-live="polite">
          {busy && <p className="hint">{t.exBusy}</p>}
          {!busy && res?.error && <p className="verdict">{t.exError}</p>}
          {!busy && res && !res.error && (
            <>
              <p className="coords" dir="ltr">{res.lat.toFixed(3)}°, {res.lon.toFixed(3)}°</p>
              {res.passes.length === 0 ? <p className="verdict">{t.exNone}</p> : (
                <>
                  <p className="verdict">{t.exCount(f(res.passes.length), f.d(res.passes[0].date), f.d(res.passes[res.passes.length - 1].date))}</p>
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
          <p className="hint">{t.exNote}</p>
        </section>
      </aside>
    </>
  )
}

export default function App() {
  const [lang, setLang] = useState('en')
  const [siteId, setSiteId] = useState(() => {
    const h = window.location.hash.slice(1)
    return h === 'anywhere' || SITES.some((s) => s.id === h) ? h : SITES[0].id
  })
  const [audience, setAudience] = useState('public')
  const [intro, setIntro] = useState(() => {
    try { return !sessionStorage.getItem('marsad-intro') && !window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return true }
  })
  const [about, setAbout] = useState(false)
  const t = UI[lang]
  const site = SITES.find((s) => s.id === siteId)

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])
  useEffect(() => { window.history.replaceState(null, '', '#' + siteId) }, [siteId])
  const endIntro = () => { setIntro(false); try { sessionStorage.setItem('marsad-intro', '1') } catch { /* private mode */ } }

  return (
    <div className="app">
      {intro && <Intro t={t} onDone={endIntro} />}

      <header className="bar">
        <a className="logo" href="#sindh" onClick={() => setSiteId('sindh')}>
          <img src={`${BASE}logos/marsad-wordmark.png`} alt="MARSAD" />
        </a>
        <nav className="places" aria-label={t.places}>
          {SITES.map((s) => (
            <button key={s.id} type="button" aria-pressed={s.id === siteId} onClick={() => setSiteId(s.id)} title={s.text[lang].kicker}>
              {s.text[lang].name}
            </button>
          ))}
          <button type="button" className="any" aria-pressed={siteId === 'anywhere'} onClick={() => setSiteId('anywhere')}>＋ {t.anywhere}</button>
        </nav>
        <div className="bar-end">
          <button type="button" className="ghost" onClick={() => setAbout(true)} aria-label={t.creditsTitle}>ⓘ</button>
          <button type="button" className="ghost lang" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>{t.langButton}</button>
        </div>
      </header>

      {site ? <Site key={site.id} site={site} lang={lang} audience={audience} setAudience={setAudience} /> : <Anywhere lang={lang} />}

      {about && (
        <div className="about" role="dialog" aria-modal="true" aria-label={t.creditsTitle} onClick={() => setAbout(false)}>
          <div className="about-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="ghost close" onClick={() => setAbout(false)} aria-label="Close">✕</button>
            <h2>MARSAD · مرصد</h2>
            <p>{t.intro1}</p>
            <p><strong>{t.intro2}</strong></p>
            <h2>{t.futureTitle}</h2>
            <p>{t.future}</p>
            <h2>{t.creditsTitle}</h2>
            <p>{t.credits}</p>
            <p><strong>{t.disclaimer}</strong></p>
            <div className="about-team">
              <img src={`${BASE}logos/oryx-geo-ai.png`} alt="ORYX GEO team logo (AI-generated image)" />
              <p>{t.team} <a href={REPO}>{t.source}</a></p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
