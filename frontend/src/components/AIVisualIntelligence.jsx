import { useMemo } from 'react'
import { Activity, BarChart2, Grid, Zap } from 'lucide-react'

// ── colour palette (matches dark theme) ──────────────────────────────────────
const C = { electric: '#38BDF8', cyan: '#67E8F9', violet: '#818CF8', emerald: '#34D399', rose: '#F87171' }
const CLUSTER_COLORS = ['#38BDF8', '#818CF8', '#34D399', '#F87171', '#FBBF24', '#67E8F9', '#A78BFA', '#FB923C']

// ── tiny helpers ──────────────────────────────────────────────────────────────
function nums(arr) { return (arr || []).map(Number).filter(Number.isFinite) }
function ext(arr) {
  const a = nums(arr); if (!a.length) return [0, 1]
  const mn = Math.min(...a), mx = Math.max(...a)
  return mn === mx ? [mn - 1, mx + 1] : [mn, mx]
}
function bins(arr, n = 18) {
  const a = nums(arr); const [mn, mx] = ext(a)
  const w = (mx - mn) / n || 1; const b = new Array(n).fill(0)
  a.forEach(v => { b[Math.min(n - 1, Math.max(0, Math.floor((v - mn) / w)))]++ })
  return b
}

// ── shared wrappers ───────────────────────────────────────────────────────────
function Card({ title, subtitle, icon: Icon, iconColor, children, span2 = false }) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <div className="rounded-2xl border border-white/[0.06] bg-[#0D0D0D] p-6 h-full">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
               style={{ background: `${iconColor}15`, border: `1px solid ${iconColor}25` }}>
            <Icon className="w-4 h-4" style={{ color: iconColor }} strokeWidth={1.8} />
          </div>
          <div>
            <h3 className="font-grotesk text-sm font-semibold text-[#F5F5F5]">{title}</h3>
            {subtitle && <p className="font-inter text-xs text-[#9CA3AF] mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function NoData({ msg }) {
  return (
    <div className="h-52 flex items-center justify-center rounded-xl border border-white/[0.04] bg-white/[0.01]">
      <p className="font-inter text-sm text-[#9CA3AF]/60 text-center px-4">{msg}</p>
    </div>
  )
}

// ── Prediction vs Actual scatter ──────────────────────────────────────────────
function PredActualScatter({ actual, predicted }) {
  const pts = useMemo(() => {
    if (!actual?.length || !predicted?.length) return []
    return actual.map((a, i) => ({ x: Number(a), y: Number(predicted[i]) }))
      .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
  }, [actual, predicted])

  if (!pts.length) return <NoData msg="Selecciona un modelo de regresión para ver las predicciones." />

  const allV = [...pts.map(p => p.x), ...pts.map(p => p.y)]
  const [mn, mx] = ext(allV); const rng = mx - mn || 1
  const toX = v => 44 + ((v - mn) / rng) * 320
  const toY = v => 232 - ((v - mn) / rng) * 200

  return (
    <svg viewBox="0 0 400 260" className="w-full h-52 rounded-xl border border-white/[0.05] bg-white/[0.01]">
      {/* perfect prediction line */}
      <line x1={toX(mn)} y1={toY(mn)} x2={toX(mx)} y2={toY(mx)}
            stroke={C.violet} strokeWidth="1" strokeDasharray="4 3" opacity="0.4" />
      {/* axes */}
      <line x1="44" y1="232" x2="370" y2="232" stroke="rgba(255,255,255,0.08)" />
      <line x1="44" y1="28"  x2="44"  y2="232" stroke="rgba(255,255,255,0.08)" />
      {/* points */}
      {pts.map((p, i) => (
        <circle key={i} cx={toX(p.x)} cy={toY(p.y)} r="2.5"
                fill={C.electric} opacity="0.6" />
      ))}
      {/* labels */}
      <text x="200" y="252" textAnchor="middle" fill="#9CA3AF" fontSize="9" fontFamily="Inter">Valor real</text>
      <text x="12" y="130" textAnchor="middle" fill="#9CA3AF" fontSize="9" fontFamily="Inter"
            transform="rotate(-90,12,130)">Predicción</text>
    </svg>
  )
}

// ── Residuals histogram ───────────────────────────────────────────────────────
function ResidualsHist({ residuals }) {
  const b = useMemo(() => bins(residuals, 20), [residuals])
  const maxB = Math.max(1, ...b)
  if (!b.some(v => v > 0)) return <NoData msg="Selecciona un modelo de regresión para ver los residuos." />

  const [mn] = ext(nums(residuals))
  const rng = (Math.max(...nums(residuals)) - mn) || 1
  const zeroIdx = Math.floor(((0 - mn) / rng) * 20)

  return (
    <div className="h-52 flex flex-col gap-2">
      <div className="flex-1 flex items-end gap-px border-l border-b border-white/[0.08] px-2 pt-3">
        {b.map((v, i) => {
          const pct = Math.max(2, (v / maxB) * 100)
          const color = i === zeroIdx ? C.violet : v > 0 && mn + (i / 20) * rng < 0 ? C.rose : C.electric
          return (
            <div key={i} className="flex-1 rounded-t-sm"
                 style={{ height: pct + '%', background: color, opacity: 0.75 }} />
          )
        })}
      </div>
      <p className="font-inter text-[10px] text-[#9CA3AF]/60 text-center">
        Distribución de errores — centrado en cero = sin sesgo
      </p>
    </div>
  )
}

// ── Feature importance horizontal bars ───────────────────────────────────────
function FIBars({ featureImportance }) {
  if (!featureImportance?.length) {
    return <NoData msg="Este modelo no proporciona importancia de variables. Prueba Random Forest, Gradient Boosting o Decision Tree." />
  }
  const top = featureImportance.slice(0, 10)
  const maxV = Math.max(...top.map(d => d.importance), 0.001)
  const COLORS_FI = [C.electric, C.cyan, C.violet, C.emerald, '#FBBF24', C.rose]

  return (
    <div className="flex flex-col gap-2 py-1">
      {top.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="font-inter text-xs text-[#9CA3AF] text-right shrink-0"
                style={{ width: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={d.feature}>{d.feature}</span>
          <div className="flex-1 h-5 bg-white/[0.04] rounded-sm overflow-hidden">
            <div className="h-full rounded-sm flex items-center justify-end pr-1.5"
                 style={{ width: Math.max(6, (d.importance / maxV) * 100) + '%',
                          background: COLORS_FI[i % COLORS_FI.length], opacity: 0.85 }}>
              <span className="font-inter text-[10px] text-white/80">
                {(d.importance * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Confusion matrix heatmap ──────────────────────────────────────────────────
function ConfusionMatrix({ matrix, labels }) {
  if (!matrix?.length || !labels?.length) return <NoData msg="No hay matriz de confusión disponible. Selecciona un clasificador y haz retrain." />
  const flat = matrix.flat().map(Number)
  const maxV = Math.max(1, ...flat)

  return (
    <div className="overflow-auto rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
      <table className="border-collapse w-full" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th className="w-16" />
            {labels.map((l, ci) => (
              <th key={ci} className="text-[10px] font-inter font-normal text-[#9CA3AF] text-center p-1 truncate"
                  style={{ maxWidth: 48 }}>Pred {l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, ri) => (
            <tr key={ri}>
              <td className="text-[10px] font-inter text-[#9CA3AF] pr-2 truncate"
                  style={{ maxWidth: 64 }}>Real {labels[ri]}</td>
              {row.map((v, ci) => {
                const k = Number(v) / maxV
                const isCorrect = ri === ci
                const bg = isCorrect
                  ? `rgba(56,189,248,${0.1 + k * 0.75})`
                  : k > 0 ? `rgba(248,113,113,${0.08 + k * 0.55})` : 'rgba(255,255,255,0.02)'
                return (
                  <td key={ci} className="p-0.5">
                    <div className="rounded flex items-center justify-center text-[11px] font-grotesk font-semibold text-[#F5F5F5]"
                         style={{ background: bg, minHeight: 30 }}>{v}</div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="font-inter text-[10px] text-[#9CA3AF]/50 mt-2 text-center">
        Diagonal principal = predicciones correctas
      </p>
    </div>
  )
}

// ── Cluster PCA scatter ───────────────────────────────────────────────────────
function ClusterScatter({ clusterPca }) {
  const traces = clusterPca?.data || []
  if (!traces.length) return <NoData msg="Proyección PCA no disponible para este dataset." />

  const allX = traces.flatMap(t => nums(t.x || []))
  const allY = traces.flatMap(t => nums(t.y || []))
  const [mnX, mxX] = ext(allX); const rX = mxX - mnX || 1
  const [mnY, mxY] = ext(allY); const rY = mxY - mnY || 1
  const toX = v => 44 + ((v - mnX) / rX) * 320
  const toY = v => 232 - ((v - mnY) / rY) * 200

  return (
    <div className="flex flex-col gap-2">
      <svg viewBox="0 0 400 260" className="w-full h-52 rounded-xl border border-white/[0.05] bg-white/[0.01]">
        <line x1="44" y1="232" x2="370" y2="232" stroke="rgba(255,255,255,0.08)" />
        <line x1="44" y1="28"  x2="44"  y2="232" stroke="rgba(255,255,255,0.08)" />
        {traces.map((t, ti) => {
          const color = CLUSTER_COLORS[ti % CLUSTER_COLORS.length]
          const pts   = (t.x || []).map((x, i) => ({ x: Number(x), y: Number((t.y || [])[i]) }))
            .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)).slice(0, 200)
          return pts.map((p, i) => (
            <circle key={`${ti}-${i}`} cx={toX(p.x)} cy={toY(p.y)} r="2.5"
                    fill={color} opacity="0.65" />
          ))
        })}
      </svg>
      <div className="flex flex-wrap gap-3">
        {traces.map((t, ti) => (
          <div key={ti} className="flex items-center gap-1.5 text-[10px] font-inter text-[#9CA3AF]">
            <span className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: CLUSTER_COLORS[ti % CLUSTER_COLORS.length] }} />
            {t.name || `Cluster ${ti}`}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Cluster metrics summary ───────────────────────────────────────────────────
function ClusterSummary({ metrics }) {
  if (!metrics) return <NoData msg="Métricas de clustering no disponibles." />
  const rows = [
    { label: 'Clusters detectados', value: metrics.n_clusters ?? '—' },
    { label: 'Silhouette Score',     value: metrics.silhouette != null ? metrics.silhouette.toFixed(3) : '—',
      hint: 'Más alto = clusters más compactos y separados' },
    { label: 'Davies-Bouldin',       value: metrics.davies_bouldin != null ? metrics.davies_bouldin.toFixed(3) : '—',
      hint: 'Más bajo = mejor separación' },
    { label: 'Outliers / Ruido',     value: metrics.noise_points != null ? metrics.noise_points : '—' },
  ]
  return (
    <div className="flex flex-col gap-3">
      {rows.map(({ label, value, hint }) => (
        <div key={label} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
          <div>
            <p className="font-inter text-sm text-[#9CA3AF]">{label}</p>
            {hint && <p className="font-inter text-[10px] text-[#9CA3AF]/40 mt-0.5">{hint}</p>}
          </div>
          <span className="font-grotesk text-base font-semibold text-[#F5F5F5]">{String(value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Accuracy visual for classification ───────────────────────────────────────
function AccuracyBar({ accuracy }) {
  if (accuracy == null) return <NoData msg="Entrena un clasificador para ver el accuracy." />
  const pct   = Math.round(accuracy * 100)
  const color = pct >= 80 ? C.emerald : pct >= 60 ? C.electric : C.rose
  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex items-end gap-3">
        <span className="font-grotesk text-5xl font-bold" style={{ color }}>{pct}%</span>
        <span className="font-inter text-sm text-[#9CA3AF] mb-2">accuracy en test set</span>
      </div>
      <div className="h-3 bg-white/[0.05] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
             style={{ width: pct + '%', background: color, boxShadow: `0 0 10px ${color}60` }} />
      </div>
      <p className="font-inter text-xs text-[#9CA3AF]/60">
        {pct >= 80 ? 'Buen rendimiento. Revisa la matriz de confusión para detectar errores por clase.'
          : pct >= 60 ? 'Rendimiento moderado. Considera otros clasificadores o más datos de entrenamiento.'
          : 'Rendimiento bajo. Revisa el balance de clases o prueba otro modelo.'}
      </p>
    </div>
  )
}

// ── Predicted class distribution from confusion matrix diagonal ───────────────
function ClassDistBar({ matrix, labels }) {
  if (!matrix?.length || !labels?.length) return null
  const totals = labels.map((_, ci) => matrix.reduce((s, row) => s + (row[ci] || 0), 0))
  const total  = totals.reduce((a, b) => a + b, 0) || 1
  const COLORS  = [C.electric, C.violet, C.emerald, C.rose, C.cyan, '#FBBF24']
  return (
    <div className="flex flex-col gap-2 pt-1">
      {labels.map((lbl, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="font-inter text-xs text-[#9CA3AF] text-right shrink-0" style={{ width: 60 }}>{lbl}</span>
          <div className="flex-1 h-5 bg-white/[0.04] rounded-sm overflow-hidden">
            <div className="h-full rounded-sm flex items-center justify-end pr-1.5"
                 style={{ width: Math.max(4, (totals[i] / total) * 100) + '%',
                          background: COLORS[i % COLORS.length], opacity: 0.82 }}>
              <span className="font-inter text-[10px] text-white/80">{totals[i]}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Retraining overlay ────────────────────────────────────────────────────────
function RetrainingBanner() {
  return (
    <div className="flex items-center gap-3 px-5 py-3 rounded-xl border border-[#38BDF8]/20 bg-[#38BDF8]/5 mb-2">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-bounce"
               style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
      <span className="font-inter text-sm text-[#38BDF8] font-medium">⚡ Re-training AI model...</span>
    </div>
  )
}

// ── main export ───────────────────────────────────────────────────────────────
export default function AIVisualIntelligence({ data, activeProblemType, liveIntelligence, isRetraining }) {
  // activeProblemType comes from ModelPanel's local state — updates immediately on retype
  const problemType   = activeProblemType ?? data?.problem_type ?? ''
  const modelName     = liveIntelligence?.model_name    ?? data?.model?.name    ?? ''
  const metrics       = liveIntelligence?.metrics       ?? data?.metrics        ?? {}
  const fi            = liveIntelligence?.feature_importance ?? data?.feature_importance ?? []
  const visual        = liveIntelligence?.visual        ?? {}
  const clusterPca    = data?.charts?.cluster_pca

  const isRegression = problemType === 'Regression'

  if (!isRegression) return null

  return (
    <div className="space-y-5">

      {isRetraining && <RetrainingBanner />}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
             style={{ background: '#38BDF815', border: '1px solid #38BDF825' }}>
          <Zap className="w-4 h-4" style={{ color: C.electric }} strokeWidth={1.8} />
        </div>
        <div>
          <h2 className="font-grotesk text-lg font-semibold text-[#F5F5F5]">Live Model Intelligence</h2>
          <p className="font-inter text-sm text-[#9CA3AF]">
            Modelo activo: <span className="text-[#38BDF8] font-medium">{modelName}</span>
            {' · '}
            <span className="text-[#9CA3AF]/60">{problemType}</span>
          </p>
        </div>
      </div>

      {/* ── Regression ───────────────────────────────── */}
      {isRegression && (
        <div className="grid grid-cols-2 gap-5">
          <Card title="Predicción vs Valor Real" subtitle="Más agrupado en diagonal = mejor ajuste"
                icon={Activity} iconColor={C.electric}>
            <PredActualScatter actual={visual.prediction_vs_actual?.actual}
                               predicted={visual.prediction_vs_actual?.predicted} />
          </Card>

          <Card title="Distribución de Residuos" subtitle="Error de predicción — centrado en cero es ideal"
                icon={BarChart2} iconColor={C.violet}>
            <ResidualsHist residuals={visual.residuals} />
          </Card>

          <Card title="Importancia de Variables" subtitle="Top 10 variables más predictivas"
                icon={Grid} iconColor={C.cyan} span2>
            <FIBars featureImportance={fi} />
          </Card>
        </div>
      )}

    </div>
  )
}
