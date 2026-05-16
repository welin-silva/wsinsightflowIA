import { useState } from 'react'
import { Brain, CheckCircle, Layers, Award, Activity, Trophy, Loader, AlertTriangle, RefreshCw } from 'lucide-react'
import axios from 'axios'
import AIVisualIntelligence from './AIVisualIntelligence'

function MetricBar({ label, value, max = 1, color, delay = 0 }) {
  const raw = typeof value === 'number' ? value : 0
  const pct = Math.min((max === 1 ? raw : raw / max) * 100, 100)
  const display = max === 1 ? `${(raw * 100).toFixed(1)}%` : raw.toFixed(4)

  return (
    <div className="space-y-2.5">
      <div className="flex justify-between items-center">
        <span className="font-inter text-sm text-[#9CA3AF]">{label}</span>
        <span className="font-grotesk text-sm font-semibold text-[#F5F5F5]">{display}</span>
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: color || 'linear-gradient(90deg, #38BDF8, #67E8F9)',
            boxShadow: '0 0 8px rgba(56,189,248,0.35)',
          }}
        />
      </div>
    </div>
  )
}

function MetricRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-white/[0.05]">
      <span className="font-inter text-sm text-[#9CA3AF]">{label}</span>
      <span className="font-grotesk text-sm font-semibold text-[#F5F5F5] tabular-nums">{value}</span>
    </div>
  )
}

const RANK_MEDALS = ['🥇', '🥈', '🥉', '4º', '5º']
const RANK_COLORS = [
  { border: 'border-[#38BDF8]/30', bg: 'bg-[#38BDF8]/[0.07]', bar: '#38BDF8', text: 'text-[#38BDF8]' },
  { border: 'border-[#818CF8]/25', bg: 'bg-[#818CF8]/[0.05]', bar: '#818CF8', text: 'text-[#818CF8]' },
  { border: 'border-[#34D399]/20', bg: 'bg-[#34D399]/[0.04]', bar: '#34D399', text: 'text-[#34D399]' },
  { border: 'border-white/[0.07]', bg: 'bg-white/[0.02]',     bar: '#6B7280', text: 'text-[#9CA3AF]' },
  { border: 'border-white/[0.05]', bg: 'bg-transparent',      bar: '#4B5563', text: 'text-[#6B7280]' },
]

function RankCard({ entry, rank, metricKey, activeModel, loading, busy, onSelect }) {
  const score     = entry[metricKey]
  const isActive  = entry.name === activeModel
  const isLoading = loading === entry.name
  const isDisabled = isActive || busy || score === null
  const c   = RANK_COLORS[Math.min(rank, 4)]
  const pct = score !== null ? Math.max(2, Math.min(100, score * 100)) : 0
  const scoreLabel = score === null
    ? '—'
    : metricKey === 'r2'
      ? score.toFixed(4)
      : `${(score * 100).toFixed(1)}%`

  return (
    <button
      onClick={() => { if (!isDisabled) onSelect(entry.name) }}
      disabled={isDisabled}
      className={`w-full text-left rounded-xl border px-4 py-3.5 transition-all duration-200 group
        ${isActive
          ? `${c.border} ${c.bg} cursor-default`
          : score === null
            ? 'border-white/[0.04] bg-transparent opacity-40 cursor-not-allowed'
            : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.18] hover:bg-white/[0.05] cursor-pointer active:scale-[0.99]'}
      `}
    >
      <div className="flex items-center gap-3 mb-2.5">
        <div className="w-7 h-7 rounded-lg bg-black/30 border border-white/[0.06] flex items-center justify-center shrink-0">
          {isLoading
            ? <Loader className="w-3.5 h-3.5 text-[#38BDF8] animate-spin" />
            : isActive
              ? <CheckCircle className="w-4 h-4 text-[#38BDF8]" strokeWidth={1.5} />
              : <span className="text-xs font-grotesk text-[#9CA3AF]">{RANK_MEDALS[rank]}</span>
          }
        </div>
        <span className={`font-inter text-sm font-medium flex-1 ${isActive ? c.text : 'text-[#E5E7EB]'}`}>
          {entry.name}
        </span>
        <span className={`font-grotesk text-sm font-bold tabular-nums shrink-0 ${isActive ? c.text : 'text-[#9CA3AF]'}`}>
          {metricKey === 'r2' ? 'R²=' : metricKey === 'accuracy' ? 'Acc=' : 'Sil='}{scoreLabel}
        </span>
      </div>

      <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: isActive ? c.bar : '#374151',
            boxShadow: isActive ? `0 0 8px ${c.bar}60` : 'none',
          }}
        />
      </div>

      {!isActive && !isLoading && score !== null && (
        <p className="text-[10px] font-inter text-[#9CA3AF]/40 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          Haz clic para usar este modelo
        </p>
      )}
      {isLoading && (
        <p className="text-[10px] font-inter text-[#38BDF8]/70 mt-1.5">
          Entrenando…
        </p>
      )}
    </button>
  )
}

const MODEL_KEY_MAP = {
  'Random Forest':       'random_forest',
  'Gradient Boosting':   'gradient_boosting',
  'Linear Regression':   'linear_regression',
  'Ridge Regression':    'ridge_regression',
  'SVR':                 'svr',
  'Logistic Regression': 'logistic_regression',
  'SVM':                 'svm',
  'SVM Lineal':          'svm_linear',
}

// Error types for differentiated UX
const ERR = {
  SESSION_MISSING: 'session_missing',  // 404 — session really gone
  TRAIN_FAILED:    'train_failed',     // 500 — backend error during training
  TIMEOUT:         'timeout',          // 504 / network timeout
  INVALID_MODEL:   'invalid_model',    // 400 — bad model type
}

export default function ModelPanel({ data, onChartUpdate }) {
  const [activeModel,      setActiveModel]      = useState(data?.model?.name)
  const [activeMetrics,    setActiveMetrics]    = useState(data?.metrics)
  const [activeProblem,    setActiveProblem]    = useState(data?.problem_type)
  const [candidateList,    setCandidateList]    = useState(data?.model?.candidate_scores || [])
  const [activeReasoning,  setActiveReasoning]  = useState(data?.model?.reasoning)
  const [retrainLoading,   setRetrainLoading]   = useState(null)
  const [retypeLoading,    setRetypeLoading]    = useState(false)
  const [errorType,        setErrorType]        = useState(null)
  const [errorMsg,         setErrorMsg]         = useState('')
  const [liveIntelligence, setLiveIntelligence] = useState(null)
  const [isRetraining,     setIsRetraining]     = useState(false)
  const busy = !!retrainLoading || retypeLoading

  if (!data?.model) return null

  const metricKey = activeMetrics?.r2 !== undefined ? 'r2'
    : activeMetrics?.accuracy !== undefined ? 'accuracy'
    : activeMetrics?.silhouette !== undefined ? 'silhouette'
    : null

  const handleSelectModel = async (modelName) => {
    if (!data.session_id || busy) return
    setErrorType(null)

    const modelType = MODEL_KEY_MAP[modelName] || modelName.toLowerCase().replace(/ /g, '_')
    setRetrainLoading(modelName)
    setIsRetraining(true)
    try {
      const { data: res } = await axios.post('/api/retrain', {
        session_id: data.session_id,
        model_type: modelType,
      }, { timeout: 120000 })

      const cmp = res.comparison || {}

      setActiveModel(modelName)
      if (cmp.new_metrics) setActiveMetrics(cmp.new_metrics)

      // Push updated feature importance chart to EDA VisualizationPanel
      if (cmp.feature_importance_chart) {
        onChartUpdate?.('feature_importance', cmp.feature_importance_chart)
      } else {
        onChartUpdate?.('feature_importance', null)
      }

      // Update local live intelligence (rendered below this panel)
      const intelligencePayload = {
        model_name:         cmp.new_model,
        metrics:            cmp.new_metrics,
        feature_importance: cmp.feature_importance  || [],
        visual:             cmp.visual              || {},
      }
      setLiveIntelligence(intelligencePayload)
    } catch (e) {
      const status = e?.response?.status
      const detail = e?.response?.data?.detail || ''
      console.error('[RETRAIN] error status=%d detail=%s', status, detail)

      if (status === 404) {
        setErrorType(ERR.SESSION_MISSING)
        setErrorMsg('La sesión no existe en el servidor. Vuelve a subir el CSV.')
      } else if (status === 504 || e.code === 'ECONNABORTED') {
        setErrorType(ERR.TIMEOUT)
        setErrorMsg('El entrenamiento tardó demasiado. Inténtalo de nuevo.')
      } else if (status === 400) {
        setErrorType(ERR.INVALID_MODEL)
        setErrorMsg(`Modelo no válido para este tipo de problema: ${detail}`)
      } else {
        setErrorType(ERR.TRAIN_FAILED)
        setErrorMsg(`Error interno: ${detail || 'contacta soporte'}`)
      }
    } finally {
      setRetrainLoading(null)
      setIsRetraining(false)
    }
  }

  const handleSelectProblem = async (newType) => {
    if (!data.session_id || busy || newType === activeProblem) return
    setErrorType(null)

    setRetypeLoading(true)
    try {
      const { data: res } = await axios.post('/api/retype', {
        session_id:   data.session_id,
        problem_type: newType,
      }, { timeout: 120000 })
      setActiveProblem(res.problem_type)
      setActiveModel(res.model?.name)
      setActiveMetrics(res.metrics)
      setCandidateList(res.model?.candidate_scores || [])
      if (res.model?.reasoning) setActiveReasoning(res.model.reasoning)
    } catch (e) {
      const status = e?.response?.status
      const detail = e?.response?.data?.detail || ''
      console.error('[RETYPE] error status=%d detail=%s', status, detail)

      if (status === 404) {
        setErrorType(ERR.SESSION_MISSING)
        setErrorMsg('La sesión no existe en el servidor. Vuelve a subir el CSV.')
      } else if (status === 504 || e.code === 'ECONNABORTED') {
        setErrorType(ERR.TIMEOUT)
        setErrorMsg('El reentrenamiento tardó demasiado. Inténtalo de nuevo.')
      } else {
        setErrorType(ERR.TRAIN_FAILED)
        setErrorMsg(`Error interno: ${detail || 'contacta soporte'}`)
      }
    } finally {
      setRetypeLoading(false)
    }
  }

  const displayMetrics = activeMetrics || data.metrics

  return (
    <div className="space-y-6">

      {/* ── Active model hero ── */}
      <div className="rounded-2xl border border-[#38BDF8]/15 bg-[#38BDF8]/[0.03] px-8 py-7">
        <div className="flex items-start gap-5 mb-6">
          <div className="relative w-14 h-14 shrink-0">
            <div className="absolute inset-0 rounded-2xl bg-[#38BDF8] blur-xl opacity-25" />
            <div className="relative w-14 h-14 rounded-2xl border border-[#38BDF8]/30 bg-[#0D0D0D] flex items-center justify-center">
              <Brain className="w-6 h-6 text-[#38BDF8]" strokeWidth={1.5} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1.5">
              <h3 className="font-grotesk text-2xl font-bold text-[#F5F5F5] leading-tight">
                {activeModel}
              </h3>
              <span className="px-2.5 py-1 text-xs font-inter font-medium rounded-full bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/25 shrink-0">
                Activo
              </span>
            </div>
            <p className="font-inter text-sm text-[#9CA3AF]">
              {activeProblem} · Seleccionado por mejor puntuación
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#0D0D0D] p-5">
          <p className="font-inter text-sm text-[#9CA3AF] leading-relaxed">{activeReasoning || data.model?.reasoning}</p>
        </div>
      </div>

      {/* ── Performance metrics ── */}
      {displayMetrics && (
        <div className="rounded-2xl border border-white/[0.06] bg-[#0D0D0D] px-7 py-7">
          <div className="flex items-center gap-3 mb-7">
            <Award className="w-5 h-5 text-[#38BDF8]" strokeWidth={1.5} />
            <h3 className="font-grotesk text-base font-semibold text-[#F5F5F5]">Performance Metrics</h3>
            {activeModel !== data?.model?.name && (
              <span className="ml-auto text-xs font-inter text-[#34D399] flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Actualizado
              </span>
            )}
          </div>

          <div className="space-y-6">
            {displayMetrics.r2 !== undefined && (
              <MetricBar label="R² Score" value={displayMetrics.r2} max={1}
                color="linear-gradient(90deg, #38BDF8, #67E8F9)" />
            )}
            {displayMetrics.accuracy !== undefined && (
              <MetricBar label="Accuracy" value={displayMetrics.accuracy} max={1}
                color="linear-gradient(90deg, #34D399, #67E8F9)" />
            )}
            {displayMetrics.silhouette !== undefined && displayMetrics.silhouette !== null && (
              <MetricBar label="Silhouette Score" value={displayMetrics.silhouette} max={1}
                color="linear-gradient(90deg, #818CF8, #67E8F9)" />
            )}
          </div>

          {(displayMetrics.mae !== undefined || displayMetrics.rmse !== undefined) && (
            <div className="mt-6 pt-2">
              {displayMetrics.mae !== undefined && (
                <MetricRow label="Mean Absolute Error" value={displayMetrics.mae?.toFixed(4)} />
              )}
              {displayMetrics.rmse !== undefined && (
                <MetricRow label="Root Mean Squared Error" value={displayMetrics.rmse?.toFixed(4)} />
              )}
              {displayMetrics.n_clusters !== undefined && (
                <MetricRow label="Clusters Detectados" value={displayMetrics.n_clusters} />
              )}
              {displayMetrics.davies_bouldin !== undefined && displayMetrics.davies_bouldin !== null && (
                <MetricRow label="Davies-Bouldin Index" value={displayMetrics.davies_bouldin?.toFixed(4)} />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Error banner (differentiated) ── */}
      {errorType && (
        <div className={`rounded-xl border px-5 py-3.5 flex items-start gap-3
          ${errorType === ERR.SESSION_MISSING
            ? 'border-yellow-500/30 bg-yellow-500/5'
            : errorType === ERR.TIMEOUT
              ? 'border-orange-500/30 bg-orange-500/5'
              : 'border-red-500/30 bg-red-500/5'}
        `}>
          <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0
            ${errorType === ERR.SESSION_MISSING ? 'text-yellow-400'
              : errorType === ERR.TIMEOUT ? 'text-orange-400'
              : 'text-red-400'}
          `} />
          <div>
            <p className={`text-sm font-inter font-semibold
              ${errorType === ERR.SESSION_MISSING ? 'text-yellow-400'
                : errorType === ERR.TIMEOUT ? 'text-orange-400'
                : 'text-red-400'}
            `}>
              {errorType === ERR.SESSION_MISSING ? 'Sesión no encontrada'
                : errorType === ERR.TIMEOUT ? 'Timeout'
                : errorType === ERR.INVALID_MODEL ? 'Modelo no compatible'
                : 'Error de entrenamiento'}
            </p>
            <p className="text-xs font-inter text-[#9CA3AF] mt-0.5">{errorMsg}</p>
          </div>
          <button
            onClick={() => setErrorType(null)}
            className="ml-auto text-[#6B7280] hover:text-[#9CA3AF] text-xs shrink-0"
          >✕</button>
        </div>
      )}

      {/* ── Model ranking ── */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#0D0D0D] px-7 py-7">
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="w-5 h-5 text-[#38BDF8]" strokeWidth={1.5} />
          <h3 className="font-grotesk text-base font-semibold text-[#F5F5F5]">Ranking de Modelos</h3>
          <span className="ml-auto text-xs font-inter text-[#9CA3AF]/50">
            {metricKey === 'r2' ? 'ordenado por R²' : metricKey === 'accuracy' ? 'ordenado por Accuracy' : ''}
          </span>
        </div>

        {candidateList.length > 0 && metricKey ? (
          <div className="space-y-2.5">
            {candidateList.map((entry, i) => (
              <RankCard
                key={entry.name}
                entry={entry}
                rank={i}
                metricKey={metricKey}
                activeModel={activeModel}
                loading={retrainLoading}
                busy={busy}
                onSelect={handleSelectModel}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm font-inter text-[#9CA3AF]/50 text-center py-4">
            Sube un CSV para ver el ranking de modelos
          </p>
        )}
      </div>

      {/* ── Problem type selector ── */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#0D0D0D] px-7 py-7">
        <div className="flex items-center gap-3 mb-5">
          <Activity className="w-5 h-5 text-[#9CA3AF]" strokeWidth={1.5} />
          <h3 className="font-grotesk text-base font-semibold text-[#F5F5F5]">Tipo de Problema</h3>
          {retypeLoading && (
            <span className="ml-auto flex items-center gap-2 text-xs font-inter text-yellow-400">
              <Loader className="w-3 h-3 animate-spin" /> Reentrenando…
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'Regression',               label: 'Regresión',     symbol: '~',  desc: 'Predice un valor numérico continuo',  color: '#38BDF8', available: true },
            { id: 'Classification',           label: 'Clasificación', symbol: '≡',  desc: 'Predice una categoría o clase',       color: '#818CF8', available: true },
            { id: 'Unsupervised (Clustering)', label: 'Clustering',    symbol: '◎',  desc: 'Agrupa datos sin etiquetas',         color: '#34D399', available: true },
          ].map(pt => {
            const active = activeProblem === pt.id
            const disabled = active || busy || !pt.available
            return (
              <button
                key={pt.id}
                onClick={() => handleSelectProblem(pt.id)}
                disabled={disabled}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all duration-200
                  ${active
                    ? 'cursor-default'
                    : !pt.available
                      ? 'border-white/[0.04] opacity-40 cursor-not-allowed'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04] cursor-pointer active:scale-[0.98]'}
                `}
                style={active ? { borderColor: `${pt.color}40`, background: `${pt.color}08` } : {}}
              >
                <span
                  className="font-grotesk text-2xl font-bold"
                  style={{ color: active ? pt.color : '#4B5563' }}
                >
                  {pt.symbol}
                </span>
                <span
                  className="font-grotesk text-xs font-semibold"
                  style={{ color: active ? pt.color : '#9CA3AF' }}
                >
                  {pt.label}
                </span>
                <span className="font-inter text-[10px] text-[#6B7280] leading-tight">{pt.desc}</span>
                {active && (
                  <span className="text-[10px] font-inter px-2 py-0.5 rounded-full border font-medium"
                    style={{ color: pt.color, borderColor: `${pt.color}40`, background: `${pt.color}15` }}>
                    Activo
                  </span>
                )}
                {!pt.available && (
                  <span className="text-[10px] font-inter text-[#4B5563]">Auto-detect</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Live visual intelligence — updates on every retrain */}
      <div className="mt-2">
        <AIVisualIntelligence
          data={data}
          activeProblemType={activeProblem}
          liveIntelligence={liveIntelligence}
          isRetraining={isRetraining}
        />
      </div>

    </div>
  )
}
