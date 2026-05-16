import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BarChart2, GitBranch, TrendingUp, Layers } from 'lucide-react'
import InteractiveChart from './InteractiveChart'

const CHART_CATEGORIES = {
  distribution:       'distributions',
  target_dist:        'distributions',
  correlation:        'correlations',
  scatter:            'correlations',
  cluster_pca:        'correlations',
  predictions:        'predictions',
  feature_importance: 'predictions',
}

const FILTERS = [
  { id: 'all',           label: 'Todos',           icon: Layers    },
  { id: 'distributions', label: 'Distribuciones',  icon: BarChart2 },
  { id: 'correlations',  label: 'Correlaciones',   icon: GitBranch },
  { id: 'predictions',   label: 'Predicciones',    icon: TrendingUp },
]

const CHART_META = {
  distribution:       { title: 'Distribución de Variables',          subtitle: 'Histograma de frecuencias — variables numéricas',             span: '' },
  target_dist:        { title: 'Distribución de la Variable Objetivo', subtitle: 'Frecuencia y rango de la variable a predecir',              span: '' },
  correlation:        { title: 'Matriz de Correlación de Pearson',   subtitle: 'Fuerza y dirección de la relación lineal entre variables',    span: '' },
  scatter:            { title: 'Diagrama de Dispersión',             subtitle: 'Relaciones entre pares de variables del dataset',             span: '' },
  cluster_pca:        { title: 'Clusters — PCA 2D',                  subtitle: 'Proyección PCA de los datos coloreada por cluster',           span: 'col-span-2' },
  predictions:        { title: 'Predicción vs Valor Real',           subtitle: 'Comparación de predicciones del modelo con el conjunto test', span: '' },
  feature_importance: { title: 'Importancia de Variables',           subtitle: 'Top 10 variables más predictivas — modelos basados en árboles', span: 'col-span-2' },
}

const CHART_ORDER = ['distribution', 'target_dist', 'correlation', 'scatter', 'cluster_pca', 'predictions', 'feature_importance']
const COLORS = ['#38BDF8', '#67E8F9', '#818CF8', '#34D399']

// ── helpers ──────────────────────────────────────────────────────────────────

function nums(arr) { return (arr || []).map(Number).filter(Number.isFinite) }

function ext(arr) {
  const a = nums(arr)
  if (!a.length) return [0, 1]
  const mn = Math.min(...a), mx = Math.max(...a)
  return mn === mx ? [mn - 1, mx + 1] : [mn, mx]
}

function bins(arr, n) {
  n = n || 18
  const a = nums(arr)
  const [mn, mx] = ext(a)
  const w = (mx - mn) / n || 1
  const b = new Array(n).fill(0)
  a.forEach(v => { b[Math.min(n - 1, Math.max(0, Math.floor((v - mn) / w)))]++ })
  return b
}

// ── chart sub-components ─────────────────────────────────────────────────────

function DistChart({ traces }) {
  const series = useMemo(
    () => (traces || []).slice(0, 4).map((t, i) => ({
      id: i,
      name: t.name || ('Series ' + (i + 1)),
      color: COLORS[i % COLORS.length],
      bins: bins(t.x || []),
    })),
    [traces],
  )
  const maxB = Math.max(1, ...series.flatMap(s => s.bins))
  if (!series.length) return <EmptyChart />
  return (
    <div className="h-64 flex flex-col gap-3">
      <div className="flex-1 flex items-end gap-px border-l border-b border-white/[0.08] px-2 pt-3">
        {series[0].bins.map((_, bi) => (
          <div key={bi} className="flex-1 h-full flex items-end gap-px">
            {series.map(s => (
              <div
                key={s.id}
                className="flex-1 rounded-t-sm"
                style={{ height: Math.max(2, (s.bins[bi] / maxB) * 100) + '%', background: s.color, opacity: 0.75 }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 shrink-0">
        {series.map(s => (
          <div key={s.id} className="flex items-center gap-2 text-xs font-inter text-[#9CA3AF]">
            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
            <span>{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CorrChart({ trace }) {
  const x = trace?.x || [], y = trace?.y || [], z = trace?.z || []
  if (!x.length || !y.length || !z.length) return <EmptyChart />
  return (
    <div className="h-64 overflow-auto rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
      <table className="border-collapse w-full" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th className="w-20" />
            {x.map((lb, ci) => (
              <th key={ci} className="text-[10px] font-inter font-normal text-[#9CA3AF] text-center p-1 truncate" style={{ maxWidth: 48 }}>{lb}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {y.map((rl, ri) => (
            <tr key={ri}>
              <td className="text-[10px] font-inter text-[#9CA3AF] pr-2 truncate" style={{ maxWidth: 80 }}>{rl}</td>
              {x.map((_, ci) => {
                const v = Number(z[ri]?.[ci] ?? 0)
                const k = Math.min(1, Math.abs(v))
                const bg = v >= 0 ? 'rgba(56,189,248,' + (0.14 + k * 0.72) + ')' : 'rgba(248,113,113,' + (0.14 + k * 0.62) + ')'
                return (
                  <td key={ci} className="p-0.5">
                    <div className="rounded flex items-center justify-center text-[10px] font-inter text-[#F5F5F5]" style={{ background: bg, minHeight: 28 }}>
                      {v.toFixed(2)}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ScatterChart({ traces }) {
  const pts = useMemo(() => {
    const t = (traces || []).find(t => Array.isArray(t.x) && Array.isArray(t.y))
    if (!t) return []
    return t.x.map((x, i) => ({ x: Number(x), y: Number(t.y[i]) }))
      .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)).slice(0, 350)
  }, [traces])

  const [mnX, mxX] = ext(pts.map(p => p.x))
  const [mnY, mxY] = ext(pts.map(p => p.y))
  const rX = mxX - mnX || 1, rY = mxY - mnY || 1
  if (!pts.length) return <EmptyChart />
  return (
    <svg viewBox="0 0 420 260" className="w-full h-64 rounded-xl border border-white/[0.05] bg-white/[0.02]">
      <line x1="42" y1="228" x2="390" y2="228" stroke="rgba(255,255,255,0.12)" />
      <line x1="42" y1="18"  x2="42"  y2="228" stroke="rgba(255,255,255,0.12)" />
      {pts.map((p, i) => (
        <circle key={`scatter-${p.x}-${p.y}-${i}`} cx={42 + ((p.x - mnX) / rX) * 348} cy={228 - ((p.y - mnY) / rY) * 210} r="3" fill="#38BDF8" opacity="0.65" />
      ))}
    </svg>
  )
}

function FIChart({ traces }) {
  const t = (traces || [])[0]
  if (!t?.x?.length || !t?.y?.length) return <EmptyChart />
  const names = t.y || []
  const vals  = t.x || []
  const maxV  = Math.max(1, ...vals.map(Number).filter(Number.isFinite))
  const colors = Array.isArray(t.marker?.color) ? t.marker.color : []
  return (
    <div className="flex flex-col gap-2 py-1">
      {names.map((name, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="font-inter text-xs text-[#9CA3AF] text-right shrink-0" style={{ width: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>{name}</span>
          <div className="flex-1 h-5 bg-white/[0.04] rounded-sm overflow-hidden">
            <div
              className="h-full rounded-sm flex items-center justify-end pr-1.5"
              style={{ width: Math.max(2, (Number(vals[i]) / maxV) * 100) + '%', background: colors[i] || '#38BDF8', opacity: 0.85 }}
            >
              <span className="font-inter text-[10px] text-white/80">{Number(vals[i]).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function TargetDistChart({ traces }) {
  const t = (traces || [])[0]
  if (!t) return <EmptyChart />

  // Categorical bar chart
  if (t.type === 'bar' || (Array.isArray(t.x) && t.x.some(v => typeof v === 'string'))) {
    const labels = t.x || []
    const values = t.y || []
    const maxV = Math.max(1, ...values.map(Number).filter(Number.isFinite))
    if (!labels.length) return <EmptyChart />
    return (
      <div className="h-64 flex flex-col gap-3">
        <div className="flex-1 flex items-end gap-1.5 border-l border-b border-white/[0.08] px-2 pt-3 overflow-x-auto">
          {labels.map((lbl, i) => (
            <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-[28px] h-full justify-end">
              <div
                className="w-full rounded-t-sm"
                style={{ height: Math.max(4, (Number(values[i]) / maxV) * 100) + '%', background: '#818CF8', opacity: 0.8 }}
              />
              <span className="text-[9px] font-inter text-[#9CA3AF] truncate max-w-full" title={String(lbl)}>{String(lbl)}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Numeric histogram — x is raw values, bin manually
  const raw = nums(t.x || [])
  if (!raw.length) return <EmptyChart />
  const binsData = bins(raw, 20)
  const maxB = Math.max(1, ...binsData)
  return (
    <div className="h-64 flex flex-col gap-2">
      <div className="flex-1 flex items-end gap-px border-l border-b border-white/[0.08] px-2 pt-3">
        {binsData.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm"
            style={{ height: Math.max(2, (v / maxB) * 100) + '%', background: '#38BDF8', opacity: 0.75 }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: '#38BDF8' }} />
        <span className="text-xs font-inter text-[#9CA3AF]">{t.name || 'Target'}</span>
      </div>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="h-64 flex items-center justify-center rounded-xl border border-white/[0.05] bg-white/[0.02]">
      <p className="font-inter text-sm text-[#9CA3AF]">No chart data available</p>
    </div>
  )
}

function ChartPreview({ chartKey, chartData }) {
  const traces = chartData?.data || []
  if (chartKey === 'distribution') return <DistChart  traces={traces} />
  if (chartKey === 'target_dist')  return <TargetDistChart traces={traces} />
  if (chartKey === 'correlation')  return <CorrChart  trace={traces[0]} />
  if (chartKey === 'scatter' || chartKey === 'predictions') return <ScatterChart traces={traces} />
  return <EmptyChart />
}

// ── ChartGrid: frozen after mount — React.memo(() => true) prevents ALL
// re-renders. Visibility toggling bypasses React entirely (useLayoutEffect +
// direct DOM style), so commitDeletionEffects is never called on chart nodes.
const ChartGrid = React.memo(
  function ChartGrid({ allCharts, charts, target_column, domRefs }) {
    return (
      <div className="grid grid-cols-2 gap-5">
        {allCharts.map(key => {
          const meta      = CHART_META[key]
          const chartData = charts[key]
          if (!chartData?.data) return null
          const subtitle  = key === 'scatter' && target_column
            ? ('Relaciones clave vs variable objetivo: ' + target_column)
            : meta.subtitle
          return (
            <div
              key={key}
              className={meta.span || ''}
              ref={el => { domRefs.current[key] = el }}
            >
              <div className="rounded-2xl border border-white/[0.06] bg-[#0D0D0D] p-6 h-full">
                <div className="mb-5">
                  <h3 className="font-grotesk text-base font-semibold text-[#F5F5F5] mb-1">{meta.title}</h3>
                  {subtitle && <p className="font-inter text-sm text-[#9CA3AF]">{subtitle}</p>}
                </div>
                <ChartPreview chartKey={key} chartData={chartData} />
              </div>
            </div>
          )
        })}
      </div>
    )
  },
  () => true,  // never re-render after mount
)

// ── main export ───────────────────────────────────────────────────────────────

export default function VisualizationPanel({ data, liveCharts, activeFilter: controlledActiveFilter, onActiveFilterChange }) {
  const [internalActiveFilter, setInternalActiveFilter] = useState(controlledActiveFilter || 'all')
  const activeFilter = controlledActiveFilter || internalActiveFilter
  const domRefs = useRef({})

  useEffect(() => {
    if (controlledActiveFilter) setInternalActiveFilter(controlledActiveFilter)
  }, [controlledActiveFilter])

  const setActiveFilter = filter => {
    setInternalActiveFilter(filter)
    onActiveFilterChange?.(filter)
  }

  if (!data?.charts) return null
  const { charts, target_column } = data

  // feature_importance is rendered separately (live-updatable); exclude from frozen ChartGrid
  const STATIC_CHART_ORDER = CHART_ORDER.filter(k => k !== 'feature_importance')
  const allCharts = STATIC_CHART_ORDER.filter(key => !!charts[key])

  // Live FI chart: prefer retrain-updated version, fall back to initial analyze result
  const fiChart = liveCharts?.feature_importance !== undefined
    ? liveCharts.feature_importance
    : charts.feature_importance

  // Apply visibility directly on DOM nodes — no React reconciliation, no
  // removeChild calls, no fiber-tree traversal on filter change.
  useLayoutEffect(() => {
    allCharts.forEach(key => {
      const el = domRefs.current[key]
      if (!el) return
      el.style.display =
        (activeFilter === 'all' || CHART_CATEGORIES[key] === activeFilter) ? '' : 'none'
    })
  }, [activeFilter, allCharts])

  const fiVisible = !!fiChart?.data && (activeFilter === 'all' || CHART_CATEGORIES['feature_importance'] === activeFilter)
  const visibleCount = (activeFilter === 'all'
    ? allCharts.length
    : allCharts.filter(k => CHART_CATEGORIES[k] === activeFilter).length
  ) + (fiVisible ? 1 : 0)

  return (
    <div className="space-y-6">

      {/* Interactive explorer — always shown when raw data available */}
      {data._rawRows?.length > 0 && (
        <InteractiveChart
          rawRows={data._rawRows}
          rawHeaders={data._rawHeaders}
          columnTypes={data.column_types}
        />
      )}

      {/* Filter bar — only this section re-renders on filter change */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map(({ id, label, icon: Icon }) => {
          const active = activeFilter === id
          const fiContrib = fiChart?.data ? (id === 'all' || CHART_CATEGORIES['feature_importance'] === id ? 1 : 0) : 0
          const count  = id === 'all'
            ? allCharts.length + fiContrib
            : allCharts.filter(k => CHART_CATEGORIES[k] === id).length + fiContrib
          if (count === 0 && id !== 'all') return null

          return (
            <button
              key={id}
              onClick={() => setActiveFilter(id)}
              className={
                'relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-grotesk font-medium ' +
                'transition-colors duration-200 active:scale-95 ' +
                (active ? 'text-[#F5F5F5]' : 'text-[#9CA3AF] hover:text-[#F5F5F5]')
              }
            >
              <span
                className="absolute inset-0 rounded-xl border transition-all duration-200"
                style={{
                  borderColor: active ? 'rgba(56,189,248,0.25)' : 'transparent',
                  background:  active ? 'rgba(56,189,248,0.08)' : 'transparent',
                }}
              />
              <Icon className="relative w-3.5 h-3.5 shrink-0" style={{ color: active ? '#38BDF8' : undefined }} strokeWidth={1.8} />
              <span className="relative">{label}</span>
              <span
                className={
                  'relative text-[10px] font-inter px-1.5 py-0.5 rounded-md transition-colors ' +
                  (active ? 'bg-[#38BDF8]/20 text-[#38BDF8]' : 'bg-white/[0.06] text-[#9CA3AF]/60')
                }
              >{count}</span>
            </button>
          )
        })}

        <div className="ml-auto font-inter text-xs text-[#9CA3AF]/40">
          <span>{visibleCount} gráficas</span>
        </div>
      </div>

      {/* Chart grid — frozen, never re-renders */}
      <ChartGrid
        allCharts={allCharts}
        charts={charts}
        target_column={target_column}
        domRefs={domRefs}
      />

      {/* Feature importance — rendered outside frozen ChartGrid so it updates after retrain */}
      {fiVisible && (
        <div className="grid grid-cols-2 gap-5">
          <div className="col-span-2">
            <div className="rounded-2xl border border-white/[0.06] bg-[#0D0D0D] p-6 h-full">
              <div className="mb-5">
                <h3 className="font-grotesk text-base font-semibold text-[#F5F5F5] mb-1">{CHART_META.feature_importance.title}</h3>
                <p className="font-inter text-sm text-[#9CA3AF]">{CHART_META.feature_importance.subtitle}</p>
              </div>
              <FIChart traces={fiChart.data} />
            </div>
          </div>
        </div>
      )}

      {visibleCount === 0 && (allCharts.length > 0 || !!charts.feature_importance) && (
        <div className="flex flex-col items-center justify-center py-24 rounded-2xl border border-white/[0.06] bg-[#0D0D0D]">
          <div className="w-12 h-12 rounded-2xl border border-white/[0.06] flex items-center justify-center mb-4">
            <BarChart2 className="w-5 h-5 text-[#9CA3AF]" strokeWidth={1.5} />
          </div>
          <p className="font-grotesk text-base font-medium text-[#F5F5F5] mb-1">No hay gráficas en esta categoría</p>
          <p className="font-inter text-sm text-[#9CA3AF]">Prueba con otro filtro</p>
        </div>
      )}
    </div>
  )
}
