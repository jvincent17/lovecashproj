import { useEffect, useRef, useState } from 'react'
import { rupiah, rupiahShort } from '../lib/format.js'

/** Angka sumbu yang "bulat": 0, 50rb, 100rb, ... */
function niceMax(v) {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  const n = v / p
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10
  return step * p
}

/**
 * Grafik kolom (SVG) dengan tooltip saat hover/ketuk.
 * data: [{ key, label, value, line?, highlight? }]
 * line: nilai garis referensi per kolom (mis. jatah harian), digambar sebagai garis bertangga.
 */
export default function ColumnChart({ data, height = 180, lineLabel, valueLabel = 'Pengeluaran', tickEvery = 1 }) {
  const [hover, setHover] = useState(null)
  const box = useRef(null)
  const [W, setW] = useState(640)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const H = height
  const pad = { l: 44, r: 8, t: 12, b: 24 }
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const maxV = niceMax(Math.max(1, ...data.map((d) => Math.max(d.value, d.line ?? 0))))
  const band = iw / Math.max(1, data.length)
  const bw = Math.min(24, Math.max(3, band - 2)) // ≤24px, celah 2px antar kolom
  const y = (v) => pad.t + ih - (v / maxV) * ih
  const ticks = [0, 0.5, 1].map((f) => f * maxV)
  const hasLine = data.some((d) => d.line != null)
  const h = hover != null ? data[hover] : null

  // garis bertangga untuk nilai referensi
  let path = ''
  if (hasLine) {
    data.forEach((d, i) => {
      const x0 = pad.l + i * band
      const yy = y(d.line ?? 0)
      path += `${i === 0 ? 'M' : 'L'}${x0},${yy} L${x0 + band},${yy} `
    })
  }

  return (
    <div className="relative" ref={box}>
      {hasLine && (
        <div className="flex gap-4 text-xs text-muted mb-2">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-accent" /> {valueLabel}</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-ink/50 rounded" /> {lineLabel}</span>
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" role="img" aria-label={valueLabel}
        onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)" className="tabular">
              {t === 0 ? '0' : rupiahShort(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * band + (band - bw) / 2
          const top = y(d.value)
          const hgt = Math.max(0, pad.t + ih - top)
          const r = Math.min(4, hgt / 2, bw / 2)
          const fill = d.value > (d.line ?? Infinity) ? 'var(--danger)' : 'var(--accent)'
          return (
            <g key={d.key} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
              <rect x={pad.l + i * band} y={pad.t} width={band} height={ih} fill="transparent" />
              {hgt > 0 && (
                <path
                  d={`M${x},${pad.t + ih} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${pad.t + ih} Z`}
                  fill={fill} opacity={hover == null || hover === i ? (d.highlight === false ? 0.45 : 1) : 0.35} />
              )}
              {i % tickEvery === 0 && (
                <text x={pad.l + i * band + band / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--muted)">{d.label}</text>
              )}
            </g>
          )
        })}
        {hasLine && <path d={path} fill="none" stroke="var(--ink)" strokeOpacity="0.5" strokeWidth="2" strokeLinejoin="round" pointerEvents="none" />}
      </svg>
      {h && (
        <div className="absolute top-0 right-0 rounded-xl bg-card border border-line shadow-sm px-3 py-2 text-xs pointer-events-none">
          <p className="font-medium">{h.title ?? h.label}</p>
          <p className="tabular">{valueLabel}: {rupiah(h.value)}</p>
          {h.line != null && <p className="tabular text-muted">{lineLabel}: {rupiah(h.line)}</p>}
        </div>
      )}
    </div>
  )
}
