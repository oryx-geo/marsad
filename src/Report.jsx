// MARSAD · written with the help of an SI (Super Intelligence) coding assistant; reviewed and tested by team ORYX GEO.
import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Chart from './Chart.jsx'

// A one-click report. It opens as a clean white sheet; the browser's own
// "Save as PDF" turns it into a file. This keeps Arabic text correct.

const BASE = import.meta.env.BASE_URL

export default function Report({ model, t, lang, f, onClose }) {
  useEffect(() => {
    document.body.classList.add('reporting')
    const esc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => { document.body.classList.remove('reporting'); window.removeEventListener('keydown', esc) }
  }, [onClose])

  const now = new Date()   // the visitor's own date, not the UTC one
  const today = f.d(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`)
  return createPortal(
    <div className="report-layer" dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang}>
      <div className="report-tools">
        <button type="button" className="rep-print" onClick={() => window.print()}>⬇ {t.repSave}</button>
        <span>{t.repHow}</span>
        <button type="button" className="rep-close" onClick={onClose}>✕ {t.repClose}</button>
      </div>
      <article className="report">
        <table className="rep-table">
          <thead>
            <tr><td>
              <div className="rep-head">
                <img src={`${BASE}logos/marsad-m.png`} alt="MARSAD" />
                <img src={`${BASE}logos/oryx-geo-ai.png`} alt="ORYX GEO (SI-generated image)" />
                <span>{t.repTitle} · {model.title}</span>
                <span className="rep-url" dir="ltr">{t.repSite}</span>
              </div>
            </td></tr>
          </thead>
          <tbody>
            <tr><td>
        <section className="rep-cover">
          <img className="rep-wordmark" src={`${BASE}logos/marsad-wordmark.png`} alt="MARSAD" />
          <p className="rep-kicker">{model.kicker}</p>
          <h1>{model.title}</h1>
          {model.place && <p className="rep-place">{model.place}</p>}
          {model.lead && <p className="rep-lead">{model.lead}</p>}
          {model.facts && <ul className="rep-facts">{model.facts.map((x, i) => <li key={i}>{x}</li>)}</ul>}
          {model.pictures?.[0] && (
            <div className="rep-pics rep-cover-pics">
              {model.pictures[0].items.map((im) => (
                <figure key={im.caption}><img src={im.src} alt={im.caption} /><figcaption>{im.caption}</figcaption></figure>
              ))}
            </div>
          )}
          <div className="rep-cover-foot">
            <img src={`${BASE}logos/oryx-geo-ai.png`} alt="ORYX GEO team logo (SI-generated image)" />
            <div>
              <p><strong>ORYX GEO</strong></p>
              <p>{t.repMade} {today}</p>
              <p dir="ltr">{t.repSite}</p>
            </div>
          </div>
        </section>

        {model.pictures?.slice(1).map((group) => (
          <section key={group.title} className="rep-block">
            <h2>{group.title}</h2>
            <div className="rep-pics">
              {group.items.map((im) => (
                <figure key={im.caption}>
                  <img src={im.src} alt={im.caption} />
                  <figcaption>{im.caption}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}

        {model.chart && (
          <section className="rep-block rep-chart">
            <h2>{t.repMeasured}</h2>
            <Chart rows={model.chart.rows} series={model.chart.series} bars={model.chart.bars} unit={model.chart.unit}
              yDomain={model.chart.yDomain} current={model.chart.current} compare={model.chart.compare} locale={f.locale} onPick={() => {}} />
            <ul className="key">
              {model.chart.series.map((s) => <li key={s.key}><span className="swatch" style={{ background: s.color }} />{s.label[lang]}</li>)}
              {model.chart.bars && <li><span className="swatch bar" style={{ background: model.chart.bars.color }} />{model.chart.bars.label[lang]}</li>}
            </ul>
          </section>
        )}

        {model.point && (
          <section className="rep-block rep-chart">
            <h2>{t.repPoint}</h2>
            <p className="rep-small" dir="ltr">{model.point.where}</p>
            <Chart rows={model.point.rows} series={[{ key: 'db', color: 'var(--c-probe)', label: '' }]} unit="dB" locale={f.locale} onPick={() => {}} small />
            {model.point.verdict && <p><strong>{model.point.verdict}</strong></p>}
            <p className="rep-small">{t.probeNote}</p>
          </section>
        )}

        {model.audiences && (
          <section className="rep-block">
            <h2>{t.repFor}</h2>
            <div className="rep-aud">
              {model.audiences.map((x) => <div key={x.who}><h3>{x.who}</h3><p>{x.text}</p></div>)}
            </div>
          </section>
        )}

        {model.sections.map((sec) => (
          <section key={sec.h} className="rep-block">
            <h2>{sec.h}</h2>
            {sec.p && <p>{sec.p}</p>}
            {sec.list && <ul className="rep-facts">{sec.list.map((x) => <li key={x}>{x}</li>)}</ul>}
          </section>
        ))}

        <section className="rep-block rep-foot">
          <h2>{t.repMethod}</h2>
          <p>{t.repMethodText}</p>
          <h2>{t.creditsTitle}</h2>
          <p>{t.credits}</p>
          <p><strong>{t.disclaimer}</strong></p>
          <p>{t.team}</p>
        </section>
            </td></tr>
          </tbody>
        </table>
      </article>
    </div>,
    document.body,
  )
}
