import React, { useEffect, useMemo, useRef, useState } from 'react'
import SwipeMap, { imageUrl } from './SwipeMap.jsx'
import Chart from './Chart.jsx'
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

function Site({ site, lang, audience }) {
  const t = UI[lang]
  const f = useMemo(() => makeFormat(lang), [lang])
  const [data, setData] = useState(null)
  const [track, setTrack] = useState(site.track)
  const [pol, setPol] = useState(site.pol)
  const [a, setA] = useState(null)
  const [b, setB] = useState(null)
  const [playing, setPlaying] = useState(false)

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

  // keep the chosen dates valid when the pass changes
  useEffect(() => {
    if (!tr) return
    const near = (d) => dates.reduce((p, c) => (Math.abs(new Date(c) - new Date(d)) < Math.abs(new Date(p) - new Date(d)) ? c : p))
    if (a && !dates.includes(a)) setA(near(a))
    if (b && !dates.includes(b)) setB(near(b))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, tr])

  // animation: step the "after" date through the series
  useEffect(() => {
    if (!playing || !dates.length) return
    const id = setInterval(() => setB((cur) => dates[(dates.indexOf(cur) + 1) % dates.length]), 1100)
    return () => clearInterval(id)
  }, [playing, dates])

  // warm the browser cache so the animation does not flicker
  useEffect(() => {
    dates.forEach((d) => { const im = new Image(); im.src = imageUrl(site.id, track, d, usePol) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, usePol, dates.length])

  if (!data || !a || !b || !dates.includes(a) || !dates.includes(b)) return <p className="loading">{t.loading}</p>

  const txt = site.text[lang]
  const n = site.facts(tr.series, data.tracks)
  const say = (v) => (typeof v === 'function' ? v(n, f) : v)
  const iB = dates.indexOf(b)

  return (
    <article className="site">
      <header className="site-head">
        <p className="kicker">{txt.kicker}</p>
        <h2>{txt.name} <span className="place">{txt.place}</span></h2>
        <p className="lead">{say(txt.lead)}</p>
      </header>

      <div className="stage">
        <div className="map-col">
          <SwipeMap key={site.id + track} site={site.id} track={track} bbox={data.bbox} pol={usePol}
            dateA={a} dateB={b} labelA={`${t.before} · ${f.d(a)}`} labelB={`${t.after} · ${f.d(b)}`} hint={t.dragHint} />
          <p className="legend"><span className="ramp" aria-hidden="true" /> {t.grey} · NISAR L-band {usePol.toUpperCase()}</p>

          <div className="controls">
            <div className="control time">
              <label htmlFor={`time-${site.id}`}>{t.timeline}: <strong>{f.d(b)}</strong></label>
              <div className="time-row">
                <button type="button" className="play" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
                  {playing ? `❚❚ ${t.pause}` : `▶ ${t.play}`}
                </button>
                <input id={`time-${site.id}`} type="range" min={0} max={dates.length - 1} value={iB} dir="ltr"
                  onChange={(e) => { setPlaying(false); setB(dates[+e.target.value]) }} />
              </div>
            </div>
            <div className="control">
              <label htmlFor={`cmp-${site.id}`}>{t.compareWith}</label>
              <select id={`cmp-${site.id}`} value={a} onChange={(e) => setA(e.target.value)}>
                {dates.map((d) => <option key={d} value={d}>{f.d(d)}</option>)}
              </select>
            </div>
            <div className="control">
              <span className="label">{t.channel}</span>
              <div className="seg" role="group" aria-label={t.channel}>
                {['hh', 'hv'].map((p) => (
                  <button key={p} type="button" disabled={!pols.includes(p)} aria-pressed={usePol === p}
                    onClick={() => setPol(p)}>{p.toUpperCase()}</button>
                ))}
              </div>
            </div>
            {site.passes && (
              <div className="control">
                <span className="label">{t.pass}</span>
                <div className="seg" role="group" aria-label={t.pass}>
                  {Object.entries(site.passes).map(([k, v]) => (
                    <button key={k} type="button" aria-pressed={track === k} onClick={() => setTrack(k)}>{v[lang]}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <p className="channel-note">{pols.length === 1 ? t.hhOnly : channelText(lang, usePol)}</p>
        </div>

        <div className="side-col">
          <section className="card chart-card">
            <h3>{t.chartTitle}</h3>
            <Chart rows={tr.series} series={site.chart.series} bars={site.chart.bars} unit={site.chart.unit}
              yDomain={site.chart.yDomain} current={b} compare={a} locale={f.locale}
              onPick={(d) => { setPlaying(false); setB(d) }} />
            <ul className="key">
              {site.chart.series.map((s) => (
                <li key={s.key}><span className="swatch" style={{ background: s.color }} />{s.label[lang]}</li>
              ))}
              {site.chart.bars && <li><span className="swatch bar" style={{ background: site.chart.bars.color }} />{site.chart.bars.label[lang]}</li>}
            </ul>
            <p className="hint">{t.chartHint}</p>
          </section>

          <section className="card you">
            <h3>{t.audienceTitle} {t.audience[audience]}</h3>
            <p>{say(txt.audience[audience])}</p>
          </section>
        </div>
      </div>

      <div className="cards">
        <section className="card why">
          <h3>{t.whyTitle}</h3>
          <p>{say(txt.why)}</p>
        </section>
        <section className="card whynot">
          <h3>{t.whyNotTitle}</h3>
          <p>{say(txt.whyNot)}</p>
        </section>
        <section className="card care">
          <h3>{t.careTitle}</h3>
          <p>{say(txt.care)}</p>
        </section>
      </div>
    </article>
  )
}

export default function App() {
  const [lang, setLang] = useState('en')
  const [siteId, setSiteId] = useState(() => {
    const h = window.location.hash.slice(1)
    return SITES.some((s) => s.id === h) ? h : SITES[0].id
  })
  const [audience, setAudience] = useState('public')
  const t = UI[lang]
  const site = SITES.find((s) => s.id === siteId)
  const main = useRef(null)

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])
  useEffect(() => { window.history.replaceState(null, '', '#' + siteId) }, [siteId])

  return (
    <div className="page">
      <header className="top">
        <div className="brand">
          <img src={`${BASE}logos/marsad-wordmark.png`} alt="MARSAD" className="wordmark" />
          <p className="tagline">{t.tagline}</p>
        </div>
        <button type="button" className="lang" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>{t.langButton}</button>
      </header>

      <section className="intro">
        <p>{t.intro1}</p>
        <p><strong>{t.intro2}</strong></p>
        <p>{t.intro3}</p>
      </section>

      <nav className="tabs" aria-label={t.places}>
        {SITES.map((s) => (
          <button key={s.id} type="button" aria-pressed={s.id === siteId} onClick={() => setSiteId(s.id)}>
            <span className="tab-name">{s.text[lang].name}</span>
            <span className="tab-kicker">{s.text[lang].kicker}</span>
          </button>
        ))}
      </nav>

      <div className="who" role="group" aria-label={t.audienceTitle}>
        <span className="who-label">{t.audienceTitle}</span>
        {AUDIENCES.map((k) => (
          <button key={k} type="button" aria-pressed={audience === k} onClick={() => setAudience(k)}>{t.audience[k]}</button>
        ))}
      </div>

      <main ref={main}>
        <Site key={site.id} site={site} lang={lang} audience={audience} />
      </main>

      <section className="future">
        <h2>{t.futureTitle}</h2>
        <p>{t.future}</p>
      </section>

      <footer className="foot">
        <div>
          <h2>{t.creditsTitle}</h2>
          <p>{t.credits}</p>
          <p className="disclaimer">{t.disclaimer}</p>
          <p>{t.team} <a href={REPO}>{t.source}</a></p>
        </div>
        <img src={`${BASE}logos/oryx-geo-ai.png`} alt="ORYX GEO team logo (AI-generated image)" className="team-logo" />
      </footer>
    </div>
  )
}
