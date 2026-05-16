import { useState, useCallback, useEffect, useRef } from 'react'
import { Zap, RotateCcw, AlertCircle, ChevronDown, TrendingUp } from 'lucide-react'
import axios from 'axios'

// ── Animated number counter ────────────────────────────────────────────
function AnimatedNumber({ value, decimals = 2 }) {
  const display = typeof value === 'number' ? value.toFixed(decimals) : String(value)
  return <span>{display}</span>
}

// ── Premium Slider ─────────────────────────────────────────────────────
function PremiumSlider({ feat, value, onChange }) {
  const trackRef = useRef()
  const { name, min = 0, max = 100, mean, std } = feat

  const clamp = v => Math.min(max, Math.max(min, v))
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0
  const meanPct = mean != null && max > min ? ((mean - min) / (max - min)) * 100 : null

  // Format display value
  const fmt = v => {
    if (v == null || isNaN(v)) return '—'
    return Math.abs(v) >= 10000
      ? v.toLocaleString('en', { maximumFractionDigits: 0 })
      : v.toFixed(2)
  }

  const handleTrackClick = useCallback(e => {
    const rect = trackRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onChange(clamp(min + ratio * (max - min)))
  }, [min, max, onChange])

  const handleInput = useCallback(e => {
    onChange(parseFloat(e.target.value))
  }, [onChange])

  return (
    <div className="group">
      {/* Label row */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-grotesk text-sm font-medium text-[#F5F5F5]">{name}</span>
        <span
          className="font-grotesk text-base font-semibold text-[#38BDF8]"
        >
          {fmt(value)}
        </span>
      </div>

      {/* Track */}
      <div className="relative py-2" ref={trackRef} onClick={handleTrackClick}>
        {/* Background track */}
        <div className="relative h-1 bg-white/[0.08] rounded-full overflow-visible">
          {/* Fill */}
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-all duration-100"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #38BDF8, #67E8F9)',
              boxShadow: '0 0 8px rgba(56,189,248,0.4)',
            }}
          />

          {/* Mean marker */}
          {meanPct != null && (
            <div
              className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
              style={{ left: `${meanPct}%` }}
            >
              <div className="w-0.5 h-3 bg-white/20 rounded-full -mt-1" />
            </div>
          )}

          {/* Invisible native range for accessibility + dragging */}
          <input
            type="range"
            min={min}
            max={max}
            step={(max - min) / 200}
            value={value}
            onChange={handleInput}
            className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
            style={{ margin: 0, padding: 0 }}
          />

          {/* Custom thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none"
            style={{ left: `${pct}%` }}
          >
            <div
              className="w-4 h-4 rounded-full border-2 border-[#050505] shadow-lg"
              style={{
                background: '#38BDF8',
                boxShadow: '0 0 12px rgba(56,189,248,0.5)',
              }}
            />
          </div>
        </div>

        {/* Range labels */}
        <div className="flex justify-between mt-2">
          <span className="font-inter text-[10px] text-[#9CA3AF]/50">{fmt(min)}</span>
          {meanPct != null && (
            <div className="flex flex-col items-center" style={{ position: 'absolute', left: `${meanPct}%`, top: '100%', transform: 'translateX(-50%)' }}>
              <span className="font-inter text-[10px] text-[#9CA3AF]/40 whitespace-nowrap">avg {fmt(mean)}</span>
            </div>
          )}
          <span className="font-inter text-[10px] text-[#9CA3AF]/50">{fmt(max)}</span>
        </div>
      </div>

      {/* Contextual hint */}
      {std != null && (
        <p className="font-inter text-[11px] text-[#9CA3AF]/45 mt-1 leading-snug">
          Most frequent range: {fmt(mean - std)} – {fmt(mean + std)}
        </p>
      )}
    </div>
  )
}

// ── Category pill selector ─────────────────────────────────────────────
function CategorySelect({ feat, value, onChange }) {
  const { name, categories = [] } = feat
  const [open, setOpen] = useState(false)

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-3">
        <span className="font-grotesk text-sm font-medium text-[#F5F5F5]">{name}</span>
        <span className="font-inter text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
          categorical
        </span>
      </div>

      {/* Pill grid for short lists */}
      {categories.length <= 6 ? (
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => onChange(cat)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-inter font-medium transition-all duration-200 border
                ${value === cat
                  ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                  : 'bg-white/[0.03] border-white/[0.06] text-[#9CA3AF] hover:text-[#F5F5F5] hover:border-white/10'
                }
              `}
            >
              {cat}
            </button>
          ))}
        </div>
      ) : (
        /* Dropdown for long lists */
        <div className="relative">
          <button
            onClick={() => setOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.03] text-sm font-inter text-[#F5F5F5] hover:border-white/10 transition-colors"
          >
            <span>{value || 'Select category...'}</span>
            <ChevronDown className={`w-4 h-4 text-[#9CA3AF] transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={1.5} />
          </button>
          {open && (
            <div
              className="absolute top-full mt-2 left-0 right-0 z-20 rounded-xl border border-white/[0.08] bg-[#0D0D0D] overflow-hidden shadow-2xl"
            >
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => { onChange(cat); setOpen(false) }}
                    className={`
                      w-full px-4 py-2.5 text-left text-sm font-inter transition-colors
                      ${value === cat ? 'text-[#38BDF8] bg-[#38BDF8]/5' : 'text-[#9CA3AF] hover:text-[#F5F5F5] hover:bg-white/[0.03]'}
                    `}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
        </div>
      )}
    </div>
  )
}

// ── Result card ─────────────────────────────────────────────────────────
function ResultCard({ result, target }) {
  const isNum = typeof result.prediction === 'number'

  return (
    <div
      className="rounded-2xl border border-[#38BDF8]/20 overflow-hidden"
      style={{ background: 'linear-gradient(135deg, rgba(56,189,248,0.04) 0%, rgba(13,13,13,0.95) 100%)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-white/[0.05]">
        <div className="relative w-8 h-8">
          <div className="absolute inset-0 rounded-lg bg-[#38BDF8] blur-md opacity-30 animate-pulse" />
          <div className="relative w-8 h-8 rounded-lg border border-[#38BDF8]/30 bg-[#38BDF8]/5 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-[#38BDF8]" strokeWidth={1.5} />
          </div>
        </div>
        <div>
          <p className="font-grotesk text-sm font-semibold text-[#F5F5F5]">AI Prediction</p>
          <p className="font-inter text-xs text-[#9CA3AF]">Target: <span className="text-[#38BDF8]">{target}</span></p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-pulse" />
          <span className="text-[11px] font-inter text-[#38BDF8]">Live result</span>
        </div>
      </div>

      <div className="px-6 py-6 space-y-5">
        {/* Main prediction value */}
        <div className="flex items-end gap-3">
          <span className="font-grotesk font-bold electric-gradient leading-none"
            style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)' }}>
            {isNum ? <AnimatedNumber value={result.prediction} decimals={2} /> : result.prediction}
          </span>
          {result.unit && (
            <span className="font-inter text-lg text-[#9CA3AF] mb-1">{result.unit}</span>
          )}
        </div>

        {/* Confidence bar */}
        {result.confidence != null && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-inter text-sm text-[#9CA3AF]">Model confidence</span>
              <span className="font-grotesk text-sm font-semibold text-[#38BDF8]">
                {(result.confidence * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${result.confidence * 100}%`,
                  background: 'linear-gradient(90deg, #38BDF8, #67E8F9)',
                  boxShadow: '0 0 8px rgba(56,189,248,0.4)',
                }}
              />
            </div>
          </div>
        )}

        {/* Explanation */}
        {result.explanation && (
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
            <p className="font-inter text-sm text-[#9CA3AF] leading-relaxed">{result.explanation}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────
export default function LivePredictions({ data }) {
  const { prediction_features, target_column, problem_type, session_id } = data || {}

  // Initialize inputs with feature means / first category
  const initInputs = useCallback(() => {
    const init = {}
    ;(prediction_features || []).forEach(feat => {
      if (feat.type === 'numeric') {
        init[feat.name] = feat.mean ?? ((feat.min ?? 0) + (feat.max ?? 1)) / 2
      } else {
        init[feat.name] = feat.categories?.[0] ?? ''
      }
    })
    return init
  }, [prediction_features])

  const [inputs, setInputs] = useState(initInputs)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const debounceRef = useRef()

  const runPrediction = useCallback(async (currentInputs) => {
    if (!session_id) {
      console.warn('[Predictions] No session_id — skipping prediction')
      return
    }
    // Sanitize: replace undefined/NaN with 0 or first category
    const safeInputs = {}
    ;(prediction_features || []).forEach(feat => {
      const raw = currentInputs[feat.name]
      if (feat.type === 'numeric') {
        const n = typeof raw === 'number' && isFinite(raw) ? raw : (feat.mean ?? 0)
        safeInputs[feat.name] = n
      } else {
        safeInputs[feat.name] = raw ?? feat.categories?.[0] ?? ''
      }
    })
    setLoading(true)
    setError(null)
    try {
      const resp = await axios.post('/api/predict', { inputs: safeInputs, session_id })
      setResult(resp.data)
    } catch (e) {
      const detail = e.response?.data?.detail || 'Prediction failed. Please try again.'
      console.error('[Predictions] error:', detail, e.response?.status)
      setError(detail)
    } finally {
      setLoading(false)
    }
  }, [session_id, prediction_features])

  // Debounced auto-predict on any input change
  const handleChange = useCallback((name, value) => {
    const next = { ...inputs, [name]: value }
    setInputs(next)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runPrediction(next), 500)
  }, [inputs, runPrediction])

  const handleReset = useCallback(() => {
    setInputs(initInputs())
    setResult(null)
    setError(null)
  }, [initInputs])

  // Auto-run on mount
  useEffect(() => {
    const init = initInputs()
    runPrediction(init)
    return () => clearTimeout(debounceRef.current)
  }, [])

  if (!prediction_features?.length) return null

  const numericFeats = prediction_features.filter(f => f.type === 'numeric')
  const catFeats     = prediction_features.filter(f => f.type !== 'numeric')

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">

      {/* ── Left: controls ── */}
      <div className="space-y-5">
        {/* Header card */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#0D0D0D] px-7 py-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9">
                <div className="absolute inset-0 rounded-xl bg-[#38BDF8] blur-md opacity-20 animate-pulse" />
                <div className="relative w-9 h-9 rounded-xl border border-[#38BDF8]/30 bg-[#38BDF8]/5 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-[#38BDF8]" strokeWidth={1.5} />
                </div>
              </div>
              <div>
                <h3 className="font-grotesk text-lg font-bold text-[#F5F5F5]">Live Prediction Engine</h3>
                <p className="font-inter text-sm text-[#9CA3AF] mt-0.5">
                  Predicting{' '}
                  <span className="text-[#38BDF8] font-medium">{target_column}</span>
                  {' '}· {problem_type}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {loading && (
                <div
                  className="flex items-center gap-1.5 text-xs font-inter text-[#38BDF8]"
                >
                  <div className="w-3.5 h-3.5 border border-[#38BDF8]/40 border-t-[#38BDF8] rounded-full animate-spin" />
                  Computing
                </div>
              )}
              <button
                onClick={handleReset}
                title="Reset to defaults"
                className="w-8 h-8 rounded-lg border border-white/[0.06] flex items-center justify-center text-[#9CA3AF] hover:text-[#F5F5F5] hover:border-white/10 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          <p className="font-inter text-sm text-[#9CA3AF]/60 mt-3 leading-relaxed">
            Adjust the sliders below. Predictions update automatically in real time as you explore the parameter space.
          </p>
        </div>

        {/* Numeric sliders */}
        {numericFeats.length > 0 && (
          <div className="rounded-2xl border border-white/[0.06] bg-[#0D0D0D] px-7 py-6">
            <p className="font-grotesk text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest mb-6">
              Numerical Features
            </p>
            <div className="space-y-8">
              {numericFeats.map(feat => (
                <PremiumSlider
                  key={feat.name}
                  feat={feat}
                  value={inputs[feat.name] ?? feat.mean ?? 0}
                  onChange={v => handleChange(feat.name, v)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Categorical inputs */}
        {catFeats.length > 0 && (
          <div className="rounded-2xl border border-white/[0.06] bg-[#0D0D0D] px-7 py-6">
            <p className="font-grotesk text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest mb-6">
              Categorical Features
            </p>
            <div className="space-y-6">
              {catFeats.map(feat => (
                <CategorySelect
                  key={feat.name}
                  feat={feat}
                  value={inputs[feat.name] ?? ''}
                  onChange={v => handleChange(feat.name, v)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="flex items-start gap-3 px-4 py-4 rounded-xl border border-red-500/20 bg-red-500/5"
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="font-inter text-sm text-red-400">{error}</p>
              {error.toLowerCase().includes('session') && (
                <p className="font-inter text-xs text-red-400/60 mt-1">
                  The server was restarted. Please go back and re-upload your dataset.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Right: result ── */}
      <div className="space-y-5">
        {result ? (
          <ResultCard result={result} target={target_column} />
        ) : (
          <div
            className="rounded-2xl border border-white/[0.06] bg-[#0D0D0D] p-8 flex flex-col items-center justify-center text-center"
            style={{ minHeight: '260px' }}
          >
              <div className="relative w-14 h-14 mb-4">
                <div className="absolute inset-0 rounded-2xl bg-[#38BDF8] blur-xl opacity-15 animate-pulse" />
                <div className="relative w-14 h-14 rounded-2xl border border-[#38BDF8]/20 bg-[#38BDF8]/5 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-[#38BDF8]" strokeWidth={1.5} />
                </div>
              </div>
              <p className="font-grotesk text-base font-semibold text-[#F5F5F5] mb-2">
                {loading ? 'Computing prediction...' : 'Prediction will appear here'}
              </p>
              <p className="font-inter text-sm text-[#9CA3AF] leading-relaxed max-w-xs">
                {loading
                  ? 'The AI model is analyzing your feature combination'
                  : 'Adjust any slider to see the AI prediction update in real time'}
              </p>
              {loading && (
                <div className="mt-5 flex gap-1.5">
                  {[0, 1, 2, 3].map(i => (
                    <div
                      key={`prediction-loading-dot-${i}`}
                      className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]"
                    />
                  ))}
                </div>
              )}
            </div>
          )}

        {/* Feature summary mini-card */}
        {result && (
          <div
            className="rounded-2xl border border-white/[0.06] bg-[#0D0D0D] px-6 py-5"
          >
            <p className="font-grotesk text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest mb-4">
              Current Feature Values
            </p>
            <div className="space-y-2">
              {prediction_features.map(feat => (
                <div key={feat.name} className="flex items-center justify-between gap-4">
                  <span className="font-inter text-sm text-[#9CA3AF] truncate">{feat.name}</span>
                  <span className="font-inter text-sm font-medium text-[#F5F5F5] shrink-0">
                    {feat.type === 'numeric'
                      ? Number(inputs[feat.name] ?? 0).toFixed(2)
                      : (inputs[feat.name] || '—')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
