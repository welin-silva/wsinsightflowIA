import { useMemo, useState } from 'react'
import { BarChart2, TrendingUp, Circle, AlignLeft } from 'lucide-react'

const COLORS = ['#38BDF8', '#818CF8', '#34D399', '#F59E0B', '#F87171', '#67E8F9']

// ── helpers ───────────────────────────────────────────────────────────────────

function toNum(v) {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : null
}

function isYearCol(name, values) {
  if (/year|año|fecha|date|mes|month|period|periodo/i.test(name)) return true
  const sample = values.slice(0, 30).map(toNum).filter(v => v !== null)
  return sample.length > 5 && sample.every(v => v >= 1900 && v <= 2200)
}

function extent(arr) {
  const mn = Math.min(...arr), mx = Math.max(...arr)
  return mn === mx ? [mn - 1, mx + 1] : [mn, mx]
}

// ── axis tick helpers ─────────────────────────────────────────────────────────

function yTicks(min, max, n = 5) {
  const step = (max - min) / (n - 1) || 1
  return Array.from({ length: n }, (_, i) => +(min + step * i).toFixed(2))
}

function fmt(v) {
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'k'
  return +v.toFixed(2) + ''
}

// ── chart renderers ───────────────────────────────────────────────────────────

function ScatterSVG({ rows, xCol, yCol }) {
  const pts = useMemo(() => rows.map(r => ({ x: toNum(r[xCol]), y: toNum(r[yCol]) }))
    .filter(p => p.x !== null && p.y !== null).slice(0, 500), [rows, xCol, yCol])
  if (!pts.length) return <Empty />
  const [xMin, xMax] = extent(pts.map(p => p.x))
  const [yMin, yMax] = extent(pts.map(p => p.y))
  const W = 480, H = 260, PAD = { t: 10, r: 10, b: 36, l: 52 }
  const cx = x => PAD.l + ((x - xMin) / (xMax - xMin)) * (W - PAD.l - PAD.r)
  const cy = y => PAD.t + (1 - (y - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b)
  const ticks = yTicks(yMin, yMax)
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      {/* grid */}
      {ticks.map(t => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={cy(t)} y2={cy(t)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <text x={PAD.l - 6} y={cy(t) + 4} textAnchor="end" fontSize="9" fill="#6B7280">{fmt(t)}</text>
        </g>
      ))}
      {/* axes */}
      <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b} stroke="rgba(255,255,255,0.10)" />
      <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="rgba(255,255,255,0.10)" />
      {/* dots */}
      {pts.map((p, i) => (
        <circle key={i} cx={cx(p.x)} cy={cy(p.y)} r="3" fill="#38BDF8" fillOpacity="0.55" />
      ))}
      {/* axis labels */}
      <text x={W / 2} y={H - 2} textAnchor="middle" fontSize="10" fill="#9CA3AF">{xCol}</text>
      <text x={14} y={H / 2} textAnchor="middle" fontSize="10" fill="#9CA3AF" transform={`rotate(-90,14,${H/2})`}>{yCol}</text>
    </svg>
  )
}

function LineSVG({ rows, xCol, yCol }) {
  const pts = useMemo(() => {
    const sorted = rows.map(r => ({ x: toNum(r[xCol]), y: toNum(r[yCol]) }))
      .filter(p => p.x !== null && p.y !== null)
      .sort((a, b) => a.x - b.x)
    // aggregate: group by x, mean y
    const map = new Map()
    sorted.forEach(({ x, y }) => { if (!map.has(x)) map.set(x, []); map.get(x).push(y) })
    return [...map.entries()].map(([x, ys]) => ({ x, y: ys.reduce((a, b) => a + b, 0) / ys.length }))
  }, [rows, xCol, yCol])
  if (pts.length < 2) return <Empty />
  const [xMin, xMax] = extent(pts.map(p => p.x))
  const [yMin, yMax] = extent(pts.map(p => p.y))
  const W = 480, H = 260, PAD = { t: 10, r: 10, b: 36, l: 52 }
  const cx = x => PAD.l + ((x - xMin) / (xMax - xMin || 1)) * (W - PAD.l - PAD.r)
  const cy = y => PAD.t + (1 - (y - yMin) / (yMax - yMin || 1)) * (H - PAD.t - PAD.b)
  const ticks = yTicks(yMin, yMax)
  const polyline = pts.map(p => `${cx(p.x)},${cy(p.y)}`).join(' ')
  // area fill
  const area = `M${cx(pts[0].x)},${H - PAD.b} ` + pts.map(p => `L${cx(p.x)},${cy(p.y)}`).join(' ') + ` L${cx(pts[pts.length - 1].x)},${H - PAD.b} Z`
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map(t => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={cy(t)} y2={cy(t)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <text x={PAD.l - 6} y={cy(t) + 4} textAnchor="end" fontSize="9" fill="#6B7280">{fmt(t)}</text>
        </g>
      ))}
      <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b} stroke="rgba(255,255,255,0.10)" />
      <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="rgba(255,255,255,0.10)" />
      <path d={area} fill="url(#lg)" />
      <polyline points={polyline} fill="none" stroke="#38BDF8" strokeWidth="2" strokeLinejoin="round" />
      {pts.length <= 40 && pts.map((p, i) => (
        <circle key={i} cx={cx(p.x)} cy={cy(p.y)} r="3" fill="#38BDF8" />
      ))}
      <text x={W / 2} y={H - 2} textAnchor="middle" fontSize="10" fill="#9CA3AF">{xCol}</text>
      <text x={14} y={H / 2} textAnchor="middle" fontSize="10" fill="#9CA3AF" transform={`rotate(-90,14,${H/2})`}>{yCol}</text>
    </svg>
  )
}

function BarSVG({ rows, xCol, yCol }) {
  const data = useMemo(() => {
    const map = new Map()
    rows.forEach(r => {
      const k = r[xCol] ?? '?'
      const v = toNum(r[yCol])
      if (!map.has(k)) map.set(k, [])
      if (v !== null) map.get(k).push(v)
    })
    return [...map.entries()]
      .map(([k, vs]) => ({ k, v: vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : 0 }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 18)
  }, [rows, xCol, yCol])
  if (!data.length) return <Empty />
  const maxV = Math.max(...data.map(d => d.v), 1)
  const W = 480, H = 260, PAD = { t: 10, r: 10, b: 60, l: 52 }
  const bw = (W - PAD.l - PAD.r) / data.length
  const bh = v => ((v / maxV) * (H - PAD.t - PAD.b))
  const ticks = yTicks(0, maxV, 5)
  const cy = y => PAD.t + (1 - y / maxV) * (H - PAD.t - PAD.b)
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      {ticks.map(t => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={cy(t)} y2={cy(t)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <text x={PAD.l - 6} y={cy(t) + 4} textAnchor="end" fontSize="9" fill="#6B7280">{fmt(t)}</text>
        </g>
      ))}
      <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b} stroke="rgba(255,255,255,0.10)" />
      <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="rgba(255,255,255,0.10)" />
      {data.map((d, i) => {
        const x = PAD.l + i * bw + bw * 0.15
        const w = bw * 0.7
        const h = bh(d.v)
        const color = COLORS[i % COLORS.length]
        return (
          <g key={i}>
            <rect x={x} y={H - PAD.b - h} width={w} height={h} rx="3" fill={color} fillOpacity="0.75" />
            <text
              x={x + w / 2} y={H - PAD.b + 10}
              textAnchor="middle" fontSize="8" fill="#9CA3AF"
              transform={`rotate(-35,${x + w / 2},${H - PAD.b + 10})`}
            >{String(d.k).slice(0, 12)}</text>
          </g>
        )
      })}
      <text x={14} y={H / 2} textAnchor="middle" fontSize="10" fill="#9CA3AF" transform={`rotate(-90,14,${H/2})`}>{yCol} (media)</text>
    </svg>
  )
}

function HistSVG({ rows, xCol }) {
  const vals = useMemo(() => rows.map(r => toNum(r[xCol])).filter(v => v !== null), [rows, xCol])
  if (!vals.length) return <Empty />
  const [mn, mx] = extent(vals)
  const n = 20
  const w = (mx - mn) / n || 1
  const buckets = new Array(n).fill(0)
  vals.forEach(v => { buckets[Math.min(n - 1, Math.max(0, Math.floor((v - mn) / w)))]++ })
  const maxB = Math.max(...buckets, 1)
  const W = 480, H = 260, PAD = { t: 10, r: 10, b: 36, l: 52 }
  const bw = (W - PAD.l - PAD.r) / n
  const ticks = yTicks(0, maxB, 5)
  const cy = v => PAD.t + (1 - v / maxB) * (H - PAD.t - PAD.b)
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      {ticks.map(t => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={cy(t)} y2={cy(t)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <text x={PAD.l - 6} y={cy(t) + 4} textAnchor="end" fontSize="9" fill="#6B7280">{fmt(t)}</text>
        </g>
      ))}
      <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b} stroke="rgba(255,255,255,0.10)" />
      <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="rgba(255,255,255,0.10)" />
      {buckets.map((count, i) => {
        const x = PAD.l + i * bw + 1
        const h = (count / maxB) * (H - PAD.t - PAD.b)
        return <rect key={i} x={x} y={H - PAD.b - h} width={bw - 2} height={h} rx="2" fill="#38BDF8" fillOpacity="0.75" />
      })}
      {[0, Math.round(n / 2), n - 1].map(i => (
        <text key={i} x={PAD.l + i * bw + bw / 2} y={H - PAD.b + 14} textAnchor="middle" fontSize="9" fill="#6B7280">
          {fmt(mn + i * w)}
        </text>
      ))}
      <text x={W / 2} y={H - 2} textAnchor="middle" fontSize="10" fill="#9CA3AF">{xCol}</text>
      <text x={14} y={H / 2} textAnchor="middle" fontSize="10" fill="#9CA3AF" transform={`rotate(-90,14,${H/2})`}>Frecuencia</text>
    </svg>
  )
}

function Empty() {
  return <div className="h-64 flex items-center justify-center text-sm font-inter text-[#9CA3AF]">Sin datos suficientes</div>
}

// ── main component ────────────────────────────────────────────────────────────

const CHART_TYPES = [
  { id: 'scatter',    label: 'Dispersión',   icon: Circle,     needsY: true  },
  { id: 'line',       label: 'Líneas',       icon: TrendingUp, needsY: true  },
  { id: 'bar',        label: 'Barras',       icon: BarChart2,  needsY: true  },
  { id: 'histogram',  label: 'Histograma',   icon: AlignLeft,  needsY: false },
]

export default function InteractiveChart({ rawRows, rawHeaders, columnTypes }) {
  const headers = rawHeaders || []
  const rows    = rawRows   || []

  const numCols = useMemo(() => (columnTypes || []).filter(c => c.dtype === 'numeric').map(c => c.name), [columnTypes])
  const allCols = headers

  // Detect date/year column
  const yearCol = useMemo(() => {
    for (const h of headers) {
      const vals = rows.map(r => r[h])
      if (isYearCol(h, vals)) return h
    }
    return null
  }, [headers, rows])

  const [chartType, setChartType] = useState('scatter')
  const [xCol, setXCol]           = useState(() => numCols[1] || allCols[1] || '')
  const [yCol, setYCol]           = useState(() => numCols[0] || allCols[0] || '')

  // Year/date range slider
  const yearVals = useMemo(() => {
    if (!yearCol) return []
    return rows.map(r => toNum(r[yearCol])).filter(v => v !== null)
  }, [yearCol, rows])
  const [yearMin, yearMax] = yearVals.length ? extent(yearVals) : [0, 0]
  const [rangeMin, setRangeMin] = useState(yearMin)
  const [rangeMax, setRangeMax] = useState(yearMax)

  // Update range defaults when data changes
  useMemo(() => { setRangeMin(yearMin); setRangeMax(yearMax) }, [yearMin, yearMax])

  const filteredRows = useMemo(() => {
    if (!yearCol || !yearVals.length) return rows
    return rows.filter(r => {
      const v = toNum(r[yearCol])
      return v !== null && v >= rangeMin && v <= rangeMax
    })
  }, [rows, yearCol, rangeMin, rangeMax, yearVals.length])

  const ct = CHART_TYPES.find(c => c.id === chartType) || CHART_TYPES[0]

  if (!headers.length || !rows.length) return null

  const select = 'bg-[#0D0D0D] border border-white/[0.08] rounded-xl px-3 py-2 text-sm font-inter text-[#E5E7EB] focus:outline-none focus:border-[#38BDF8]/40 cursor-pointer'

  return (
    <div className="rounded-2xl border border-[#38BDF8]/15 bg-[#0D0D0D] p-6 mb-6">

      {/* Title */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-xl bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center shrink-0">
          <BarChart2 className="w-4 h-4 text-[#38BDF8]" strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="font-grotesk text-sm font-bold text-[#F5F5F5]">Explorador Interactivo</h3>
          <p className="text-[11px] font-inter text-[#9CA3AF]">Elige tipo de gráfica y variables — actualización en tiempo real</p>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap gap-3 mb-5">

        {/* Chart type pills */}
        <div className="flex gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          {CHART_TYPES.map(({ id, label, icon: Icon }) => {
            const active = chartType === id
            return (
              <button
                key={id}
                onClick={() => setChartType(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-inter font-medium transition-all ${
                  active ? 'bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30' : 'text-[#9CA3AF] hover:text-[#F5F5F5] border border-transparent'
                }`}
              >
                <Icon className="w-3 h-3" strokeWidth={1.8} />
                {label}
              </button>
            )
          })}
        </div>

        {/* X axis */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-inter text-[#9CA3AF]">Eje X</span>
          <select className={select} value={xCol} onChange={e => setXCol(e.target.value)}>
            {allCols.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Y axis (hidden for histogram) */}
        {ct.needsY && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-inter text-[#9CA3AF]">Eje Y</span>
            <select className={select} value={yCol} onChange={e => setYCol(e.target.value)}>
              {allCols.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Year/date range slider */}
      {yearCol && yearVals.length > 1 && (
        <div className="mb-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-inter text-[#9CA3AF]">
              Filtro por <span className="text-[#38BDF8]">{yearCol}</span>
            </span>
            <span className="text-xs font-inter font-medium text-[#F5F5F5]">
              {rangeMin} — {rangeMax}
              <span className="text-[#9CA3AF] ml-2">({filteredRows.length} filas)</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-inter text-[#9CA3AF] w-10 shrink-0">{yearMin}</span>
            <div className="flex-1 flex flex-col gap-1.5">
              <input
                type="range" min={yearMin} max={yearMax} step="1"
                value={rangeMin}
                onChange={e => setRangeMin(Math.min(+e.target.value, rangeMax))}
                className="w-full accent-[#38BDF8] cursor-pointer"
              />
              <input
                type="range" min={yearMin} max={yearMax} step="1"
                value={rangeMax}
                onChange={e => setRangeMax(Math.max(+e.target.value, rangeMin))}
                className="w-full accent-[#818CF8] cursor-pointer"
              />
            </div>
            <span className="text-[11px] font-inter text-[#9CA3AF] w-10 shrink-0 text-right">{yearMax}</span>
          </div>
          <div className="flex justify-between text-[10px] font-inter text-[#9CA3AF]/40 px-10">
            <span>Desde</span><span>Hasta</span>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="rounded-xl border border-white/[0.06] bg-[#050505] p-4">
        {chartType === 'scatter'   && <ScatterSVG rows={filteredRows} xCol={xCol} yCol={yCol} />}
        {chartType === 'line'      && <LineSVG    rows={filteredRows} xCol={xCol} yCol={yCol} />}
        {chartType === 'bar'       && <BarSVG     rows={filteredRows} xCol={xCol} yCol={yCol} />}
        {chartType === 'histogram' && <HistSVG    rows={filteredRows} xCol={xCol} />}
      </div>

      <p className="text-[10px] font-inter text-[#9CA3AF]/30 mt-3 text-center">
        {filteredRows.length.toLocaleString()} filas en el rango seleccionado
      </p>
    </div>
  )
}
