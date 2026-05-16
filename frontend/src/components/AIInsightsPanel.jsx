import { useState, useEffect, useRef } from 'react'
import { Brain, TrendingUp, AlertCircle, Lightbulb, ChevronDown } from 'lucide-react'
import axios from 'axios'

function TypewriterText({ text }) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    setDisplayed('')
    let i = 0
    const t = setInterval(() => {
      if (i <= text.length) { setDisplayed(text.slice(0, i)); i++ }
      else clearInterval(t)
    }, 14)
    return () => clearInterval(t)
  }, [text])
  return <span>{displayed}</span>
}

const TYPE_CONFIG = {
  correlation:    { border: 'border-[#38BDF8]/20',   bg: 'bg-[#38BDF8]/[0.06]',   dot: '#38BDF8',   icon: TrendingUp  },
  trend:          { border: 'border-green-500/20',   bg: 'bg-green-500/[0.06]',   dot: '#34D399',   icon: TrendingUp  },
  anomaly:        { border: 'border-yellow-500/20',  bg: 'bg-yellow-500/[0.06]',  dot: '#FBBF24',   icon: AlertCircle },
  recommendation: { border: 'border-purple-500/20',  bg: 'bg-purple-500/[0.06]',  dot: '#818CF8',   icon: Lightbulb   },
}

function InsightCard({ type, text, index }) {
  const [open, setOpen] = useState(index < 2)
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.correlation
  const Icon = cfg.icon

  return (
    <div
      className={`rounded-2xl border ${cfg.border} ${cfg.bg} overflow-hidden`}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4"
      >
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: cfg.dot, boxShadow: `0 0 6px ${cfg.dot}80` }}
        />
        <Icon className="w-4 h-4 shrink-0" style={{ color: cfg.dot }} strokeWidth={1.5} />
        <span className="text-xs font-grotesk font-semibold text-[#F5F5F5] flex-1 text-left uppercase tracking-widest">
          {type}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[#9CA3AF]/60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          strokeWidth={1.5}
        />
      </button>

      {open && (
        <div
          className="overflow-hidden"
        >
          <p className="px-5 pb-5 text-sm font-inter text-[#9CA3AF] leading-relaxed">
            {index === 0 ? <TypewriterText text={text} /> : text}
          </p>
        </div>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-2 h-2 rounded-full bg-white/10 shrink-0" />
        <div className="h-3 bg-white/10 rounded-full w-24" />
        <div className="ml-auto h-3 bg-white/[0.05] rounded-full w-12" />
      </div>
      <div className="space-y-2">
        <div className="h-2.5 bg-white/[0.06] rounded-full w-full" />
        <div className="h-2.5 bg-white/[0.06] rounded-full w-4/5" />
        <div className="h-2.5 bg-white/[0.06] rounded-full w-3/5" />
      </div>
    </div>
  )
}

export default function AIInsightsPanel({ insights: initialInsights, summary, data }) {
  const [insightData, setInsightData] = useState(initialInsights || [])
  const [loading, setLoading] = useState(false)
  const fetched = useRef(false)

  useEffect(() => {
    // If we already have insights or already fetched, skip
    if (fetched.current || insightData.length > 0) return
    if (!data) return
    fetched.current = true
    setLoading(true)

    // Build a lightweight analysis payload for the insights endpoint
    const payload = {
      dataset_name: data.dataset_name,
      rows: data.rows,
      columns: data.columns,
      problem_type: data.problem_type,
      target_column: data.target_column,
      data_quality_score: data.data_quality_score,
      numeric_columns: data.numeric_columns,
      categorical_columns: data.categorical_columns,
      metrics: data.metrics,
      statistics: (data.statistics || []).slice(0, 4),
      feature_importance: (data.feature_importance || []).slice(0, 5),
    }

    axios.post('/api/insights', { analysis: payload }, { timeout: 30000 })
      .then(r => setInsightData(r.data.insights || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [data])

  return (
    <aside
      className="w-88 shrink-0 border-l border-white/[0.06] bg-[#0D0D0D] overflow-y-auto scrollbar-thin flex flex-col"
      style={{ width: '340px' }}
    >
      <div className="p-6 flex flex-col gap-5 flex-1">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 shrink-0">
            <div className="absolute inset-0 rounded-xl bg-[#38BDF8] blur-lg opacity-25 animate-pulse" />
            <div className="relative w-10 h-10 rounded-xl border border-[#38BDF8]/30 bg-[#38BDF8]/8 flex items-center justify-center">
              <Brain className="w-5 h-5 text-[#38BDF8]" strokeWidth={1.5} />
            </div>
          </div>
          <div>
            <h2 className="font-grotesk text-base font-bold text-[#F5F5F5]">AI Insights</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${loading ? 'bg-yellow-400' : 'bg-[#38BDF8]'}`} />
              <span className={`text-xs font-inter ${loading ? 'text-yellow-400' : 'text-[#38BDF8]'}`}>
                {loading ? 'Gemini analizando…' : 'Análisis completado'}
              </span>
            </div>
          </div>
        </div>

        {/* Summary */}
        {summary && (
          <div
            className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5"
          >
            <p className="text-sm font-inter text-[#9CA3AF] leading-relaxed">{summary}</p>
          </div>
        )}

        {/* Insights list */}
        <div className="space-y-3 flex-1">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : insightData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-10 h-10 rounded-2xl border border-white/[0.06] flex items-center justify-center mb-3">
                <Brain className="w-5 h-5 text-[#9CA3AF]/50" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-grotesk text-[#9CA3AF]">Sin insights disponibles</p>
              <p className="text-xs font-inter text-[#9CA3AF]/40 mt-1">Configura GEMINI_API_KEY para activarlos</p>
            </div>
          ) : (
            insightData.map((insight, i) => (
              <InsightCard
                key={`${insight.type}-${i}`}
                index={i}
                type={insight.type}
                text={insight.text}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-white/[0.06] flex items-center gap-2.5">
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div
                key={`insight-pulse-${i}`}
                className="w-1 h-1 rounded-full bg-[#38BDF8]/50 animate-pulse"
                style={{ animationDelay: `${i * 0.3}s` }}
              />
            ))}
          </div>
          <span className="text-xs font-inter text-[#9CA3AF]/50">Powered by Gemini AI</span>
        </div>
      </div>
    </aside>
  )
}
