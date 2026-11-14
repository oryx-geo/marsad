import React from 'react'

// A small line chart drawn by hand in SVG (no chart library).
// series: [{ key, label, color, dash }]   bars: optional { key, label, color } on a second axis

const W = 640, M = { l: 46, r: 46, t: 16, b: 34 }

function ticks(min, max, n = 4) {
  const span = max - min || 1
  const step = Math.pow(10, Math.floor(Math.log10(span / n)))
  const s = [1, 2, 5, 10].map((m) => m * step).find((v) => span / v <= n + 1) || step
  const out = []
  for (let v = Math.ceil(min / s) * s; v <= max + 1e-9; v += s) out.push(+v.toFixed(6))
  return out
}

// Do not draw a line across long gaps with no satellite pass (more than 40 days).
function segments(rows, t, key) {
  const out = [[]]
  rows.forEach((r, i) => {
    if (r[key] == null) return
    const cur = out[out.length - 1]
    if (cur.length && t[i] - t[cur[cur.length - 1]] > 40 * 864e5) out.push([i])
    else cur.push(i)
  })
  return out
}

export default function Chart({ rows, series, bars, unit, current, compare, onPick, locale, yDomain, small }) {
  const H = small ? 200 : 280
  const t = rows.map((r) => new Date(r.date + 'T00:00:00Z').getTime())
  const x = (ms) => M.l + ((ms - t[0]) / (t[t.length - 1] - t[0] || 1)) * (W - M.l - M.r)
  const vals = series.flatMap((s) => rows.map((r) => r[s.key])).filter((v) => v != null)
  let lo = yDomain ? yDomain[0] : Math.min(...vals), hi = yDomain ? yDomain[1] : Math.max(...vals)
  if (!yDomain) { const pad = (hi - lo) * 0.12 || 1; lo -= pad; hi += pad; if (lo < 0 && Math.min(...vals) >= 0) lo = 0 }
  const y = (v) => M.t + (1 - (v - lo) / (hi - lo)) * (H - M.t - M.b)
  const bmax = bars ? Math.max(1, ...rows.map((r) => r[bars.key] || 0)) : 1
  const fmt = new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit', timeZone: 'UTC' })
  const months = []
  const d = new Date(t[0]); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1)
  const stepM = (t[t.length - 1] - t[0]) / 864e5 > 250 ? 2 : 1
  for (; d.getTime() <= t[t.length - 1]; d.setUTCMonth(d.getUTCMonth() + stepM)) months.push(d.getTime())

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={unit}>
      {ticks(lo, hi).map((v) => (
        <g key={v}>
          <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} className="chart-grid" />
          <text x={M.l - 6} y={y(v) + 4} textAnchor="end" className="chart-tick">{v}</text>
        </g>
      ))}
      {months.map((m) => (
        <text key={m} x={x(m)} y={H - 10} textAnchor="middle" className="chart-tick">{fmt.format(m)}</text>
      ))}
      <text x={M.l - 6} y={M.t - 2} textAnchor="end" className="chart-unit">{unit}</text>
      {bars && rows.map((r, i) => {
        const h = ((r[bars.key] || 0) / bmax) * (H - M.t - M.b) * 0.45
        return <rect key={i} x={x(t[i]) - 5} width={10} y={H - M.b - h} height={h} fill={bars.color} opacity="0.55" rx="2" />
      })}
      {bars && <text x={W - M.r + 6} y={H - M.b} className="chart-unit">{`0`}</text>}
      {bars && <text x={W - M.r + 6} y={H - M.b - (H - M.t - M.b) * 0.45 + 4} className="chart-unit">{Math.round(bmax)}</text>}
      {series.map((s) => (
        <g key={s.key}>
          {segments(rows, t, s.key).map((seg, k) => (
            <polyline key={k} fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dash || undefined}
              strokeLinejoin="round" points={seg.map((i) => `${x(t[i])},${y(rows[i][s.key])}`).join(' ')} />
          ))}
          {rows.map((r, i) => r[s.key] != null && (
            <circle key={i} cx={x(t[i])} cy={y(r[s.key])} r={r.date === current ? 6 : 3.2}
              fill={r.date === current ? s.color : 'var(--dot)'} stroke={s.color} strokeWidth="2" />
          ))}
        </g>
      ))}
      {[compare, current].map((dte, k) => {
        const i = rows.findIndex((r) => r.date === dte)
        return i < 0 ? null : <line key={k} x1={x(t[i])} x2={x(t[i])} y1={M.t} y2={H - M.b} className={k ? 'chart-now' : 'chart-ref'} />
      })}
      {rows.map((r, i) => (
        <rect key={r.date} x={x(t[i]) - 10} y={M.t} width={20} height={H - M.t - M.b} fill="transparent"
          style={{ cursor: 'pointer' }} onClick={() => onPick(r.date)}>
          <title>{r.date}</title>
        </rect>
      ))}
    </svg>
  )
}
