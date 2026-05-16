import { useCallback, useEffect, useRef, useState } from 'react'
import { Send, User, RefreshCw } from 'lucide-react'
import axios from 'axios'

// ── Animated robot avatar ──────────────────────────────────────────────────────
function RobotFace({ size = 'sm', talking = false }) {
  const isLg = size === 'lg'
  const s = isLg ? { box: 56, eye: 7, mouth: 22, brow: 16 } : { box: 28, eye: 3.5, mouth: 11, brow: 8 }
  return (
    <svg
      width={s.box} height={s.box}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* Glow */}
      <defs>
        <radialGradient id="rg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="28" cy="28" rx="26" ry="26" fill="url(#rg)" />

      {/* Head */}
      <rect x="10" y="10" width="36" height="32" rx="8" fill="#0F172A" stroke="#38BDF8" strokeWidth="1.5" />

      {/* Antenna */}
      <line x1="28" y1="10" x2="28" y2="4" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="28" cy="3.5" r="2" fill="#67E8F9">
        <animate attributeName="opacity" values="1;0.3;1" dur="1.4s" repeatCount="indefinite" />
      </circle>

      {/* Ears */}
      <rect x="6" y="18" width="4" height="8" rx="2" fill="#1E293B" stroke="#38BDF8" strokeWidth="1" />
      <rect x="46" y="18" width="4" height="8" rx="2" fill="#1E293B" stroke="#38BDF8" strokeWidth="1" />

      {/* Eyes */}
      <rect x="15" y="19" width="10" height="8" rx="3" fill="#38BDF8" opacity="0.9">
        <animate attributeName="opacity" values="0.9;0.3;0.9" dur="2.8s" repeatCount="indefinite" />
      </rect>
      <rect x="31" y="19" width="10" height="8" rx="3" fill="#38BDF8" opacity="0.9">
        <animate attributeName="opacity" values="0.9;0.3;0.9" dur="2.8s" repeatCount="indefinite" />
      </rect>
      {/* Eye shine */}
      <rect x="17" y="21" width="3" height="2" rx="1" fill="white" opacity="0.6" />
      <rect x="33" y="21" width="3" height="2" rx="1" fill="white" opacity="0.6" />

      {/* Mouth */}
      {talking ? (
        <>
          <rect x="17" y="32" width="22" height="5" rx="2.5" fill="#38BDF8" opacity="0.8">
            <animate attributeName="height" values="5;2;5;4;5" dur="0.4s" repeatCount="indefinite" />
            <animate attributeName="y" values="32;33.5;32;32.5;32" dur="0.4s" repeatCount="indefinite" />
          </rect>
        </>
      ) : (
        <path d="M17 34 Q28 40 39 34" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      )}

      {/* Chin bolts */}
      <circle cx="20" cy="40" r="1.5" fill="#38BDF8" opacity="0.5" />
      <circle cx="36" cy="40" r="1.5" fill="#38BDF8" opacity="0.5" />
    </svg>
  )
}

const SUGGESTIONS_BY_TYPE = {
  Regression: [
    '¿Cuál es la variable más importante para la predicción?',
    '¿Qué R² tiene el modelo y qué significa?',
    '¿Por qué eligió este modelo y no uno lineal?',
    'Dame un resumen completo del análisis',
    'Muéstrame la distribución de variables',
    '¿Hay riesgo de overfitting en este dataset?',
  ],
  Classification: [
    '¿Cuántas clases hay y cuál es la más frecuente?',
    '¿Qué accuracy tiene el modelo?',
    '¿Cuáles son las variables más importantes?',
    '¿Por qué eligió este modelo?',
    'Dame un resumen completo',
    '¿Hay variables correlacionadas?',
  ],
  'Unsupervised (Clustering)': [
    '¿Cuántos clusters se detectaron?',
    '¿Qué significa el Silhouette Score?',
    '¿Qué diferencias hay entre los clusters?',
    '¿Qué variables separan mejor los grupos?',
    '¿Qué algoritmo ganó y por qué?',
    'Muéstrame el gráfico PCA de clusters',
  ],
  default: [
    '¿Qué columnas tiene el dataset?',
    '¿Por qué eligió este modelo?',
    '¿Cuáles son las variables más importantes?',
    'Dame un resumen completo',
    'Muéstrame la distribución de variables',
    '¿Hay riesgo de overfitting?',
  ],
}
const SUGGESTIONS = SUGGESTIONS_BY_TYPE.default

function buildContext(data) {
  if (!data) return {}
  return {
    dataset_name:        data.dataset_name,
    session_id:          data.session_id,
    rows:                data.rows,
    columns:             data.columns,
    problem_type:        data.problem_type,
    target_column:       data.target_column,
    model_name:          data.model?.name,
    model_reasoning:     data.model?.reasoning,
    metrics:             data.metrics,
    data_quality_score:  data.data_quality_score,
    missing_pct:         data.missing_pct,
    numeric_columns:     data.numeric_columns,
    categorical_columns: data.categorical_columns,
    column_types:        data.column_types || [],
    statistics:          (data.statistics || []).slice(0, 15),
    feature_importance:  (data.feature_importance || []).slice(0, 10),
    prediction_features: data.prediction_features || [],
    summary:             data.summary,
  }
}

// ── Inline mini chart for chat ────────────────────────────────────────────────

const CHART_COLORS = ['#38BDF8', '#67E8F9', '#818CF8', '#34D399']

function miniNums(arr) { return (arr || []).map(Number).filter(Number.isFinite) }

function MiniHist({ traces }) {
  const series = (traces || []).slice(0, 3).map((t, i) => {
    const a = miniNums(t.x || [])
    const n = 14
    const mn = Math.min(...a), mx = Math.max(...a)
    const w = (mx - mn) / n || 1
    const b = new Array(n).fill(0)
    a.forEach(v => { b[Math.min(n-1, Math.max(0, Math.floor((v-mn)/w)))]++ })
    return { name: t.name || `Serie ${i+1}`, bins: b, color: CHART_COLORS[i] }
  })
  const maxB = Math.max(1, ...series.flatMap(s => s.bins))
  if (!series.length) return null
  return (
    <div className="mt-2 rounded-xl border border-white/[0.06] bg-[#050505] p-3">
      <div className="h-28 flex items-end gap-px border-l border-b border-white/[0.08] px-1">
        {series[0].bins.map((_, bi) => (
          <div key={bi} className="flex-1 h-full flex items-end gap-px">
            {series.map((s, si) => (
              <div key={si} className="flex-1 rounded-t-[2px]"
                style={{ height: Math.max(2, (s.bins[bi]/maxB)*100)+'%', background: s.color, opacity: 0.8 }} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {series.map((s,i) => (
          <span key={i} className="flex items-center gap-1 text-[10px] font-inter text-[#9CA3AF]">
            <span className="w-2 h-2 rounded-full" style={{background: s.color}} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  )
}

function MiniScatter({ traces }) {
  const t = traces?.[0]
  const xs = miniNums(t?.x || []).slice(0, 80)
  const ys = miniNums(t?.y || []).slice(0, 80)
  if (!xs.length) return null
  const xMin = Math.min(...xs), xMax = Math.max(...xs) || 1
  const yMin = Math.min(...ys), yMax = Math.max(...ys) || 1
  const W = 220, H = 112
  const px = v => ((v - xMin) / (xMax - xMin || 1)) * (W - 16) + 8
  const py = v => H - 8 - ((v - yMin) / (yMax - yMin || 1)) * (H - 16)
  return (
    <div className="mt-2 rounded-xl border border-white/[0.06] bg-[#050505] p-3">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
        {xs.map((x, i) => (
          <circle key={i} cx={px(x)} cy={py(ys[i])} r="2.5" fill="#38BDF8" fillOpacity="0.6" />
        ))}
      </svg>
      <p className="text-[10px] font-inter text-[#9CA3AF] mt-1">{t?.name || 'Dispersión'}</p>
    </div>
  )
}

function MiniBarImportance({ fi }) {
  if (!fi?.length) return null
  const top = [...fi].sort((a,b) => (b.importance||0)-(a.importance||0)).slice(0,6)
  const max = top[0]?.importance || 1
  return (
    <div className="mt-2 rounded-xl border border-white/[0.06] bg-[#050505] p-3 space-y-1.5">
      {top.map((f, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[10px] font-inter text-[#9CA3AF] w-24 truncate shrink-0">{f.feature}</span>
          <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: ((f.importance/max)*100)+'%', background: CHART_COLORS[i%4] }} />
          </div>
          <span className="text-[10px] font-inter text-[#9CA3AF] w-8 text-right">{(f.importance*100).toFixed(0)}%</span>
        </div>
      ))}
    </div>
  )
}

function InlineChart({ chartType, chartData, fi }) {
  const TITLES = {
    distribution: 'Distribución de Variables — Histograma',
    scatter:      'Diagrama de Dispersión',
    predictions:  'Predicción vs Valor Real',
    importance:   'Importancia de Variables (Modelo Supervisado)',
  }
  const traces = chartData?.data || []
  return (
    <div className="mt-1">
      <p className="text-[11px] font-grotesk font-semibold text-[#38BDF8] mb-1">{TITLES[chartType] || chartType}</p>
      {chartType === 'distribution' && <MiniHist traces={traces} />}
      {(chartType === 'scatter' || chartType === 'predictions') && <MiniScatter traces={traces} />}
      {chartType === 'importance' && <MiniBarImportance fi={fi} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function MdText({ text }) {
  if (!text) return null
  const lines = text.split('\n')
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/)
        return (
          <p key={i} className={line.startsWith('- ') ? 'pl-2' : ''}>
            {parts.map((p, j) =>
              p.startsWith('**') && p.endsWith('**')
                ? <strong key={j} className="text-[#F5F5F5] font-semibold">{p.slice(2, -2)}</strong>
                : p.replace(/^- /, '• ')
            )}
          </p>
        )
      })}
    </div>
  )
}

function RetrainTable({ comparison }) {
  if (!comparison) return null
  const { old_model, new_model, old_metrics, new_metrics } = comparison
  const rows = Object.keys(old_metrics || {}).map(k => ({
    metric: k.toUpperCase(),
    old: typeof old_metrics[k] === 'number' ? old_metrics[k].toFixed(3) : old_metrics[k],
    next: typeof new_metrics[k] === 'number' ? new_metrics[k].toFixed(3) : new_metrics[k],
    better: k === 'r2' || k === 'accuracy' ? new_metrics[k] > old_metrics[k] : new_metrics[k] < old_metrics[k],
  }))
  return (
    <div className="mt-3 rounded-xl border border-white/[0.08] overflow-hidden text-[11px] font-inter">
      <div className="grid grid-cols-3 bg-white/[0.04] px-3 py-1.5 text-[#9CA3AF] font-medium">
        <span>Métrica</span><span>{old_model}</span><span>{new_model}</span>
      </div>
      {rows.map(r => (
        <div key={r.metric} className="grid grid-cols-3 px-3 py-1.5 border-t border-white/[0.04]">
          <span className="text-[#9CA3AF]">{r.metric}</span>
          <span className="text-[#F5F5F5]">{r.old}</span>
          <span className={r.better ? 'text-green-400' : 'text-red-400'}>{r.next}</span>
        </div>
      ))}
    </div>
  )
}

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      {isUser ? (
        <div className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.08] border border-white/[0.10]">
          <User className="w-3.5 h-3.5 text-[#9CA3AF]" strokeWidth={1.8} />
        </div>
      ) : (
        <div className="shrink-0">
          <RobotFace size="sm" talking={!!msg.loading} />
        </div>
      )}

      {/* Bubble */}
      <div className={`max-w-[82%] px-4 py-3 rounded-2xl text-sm font-inter leading-relaxed ${
        isUser
          ? 'bg-white/[0.06] text-[#F5F5F5] rounded-tr-sm'
          : 'bg-[#38BDF8]/[0.07] border border-[#38BDF8]/10 text-[#E5E7EB] rounded-tl-sm'
      }`}>
        {msg.loading
          ? <span className="flex gap-1 items-center py-0.5">
              {[0,1,2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]/60 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
          : <>
              <MdText text={msg.text} />
              {msg.chart && <InlineChart chartType={msg.chart.type} chartData={msg.chart.data} fi={msg.chart.fi} />}
              {msg.retrain && <RetrainTable comparison={msg.retrain} />}
            </>
        }
      </div>
    </div>
  )
}

export default function AIChatPanel({ data }) {
  const [messages, setMessages] = useState([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [aiStatus, setAiStatus] = useState(null) // { active, provider, model }
  const bottomRef = useRef()
  const inputRef  = useRef()

  useEffect(() => {
    axios.get('/api/ai-status').then(r => setAiStatus(r.data)).catch(() => {})
  }, [])

  // Greeting on mount
  useEffect(() => {
    if (!data) return
    setMessages([{
      id: 'greeting',
      role: 'assistant',
      text: `He analizado **${data.dataset_name}** — ${data.rows?.toLocaleString()} filas, ${data.columns} columnas, problema de tipo ${data.problem_type}. Puedes preguntarme cualquier cosa sobre los datos, el modelo o las predicciones.`,
    }])
  }, [data])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text) => {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')

    const userMsg = { id: Date.now(), role: 'user', text: q }
    const loadingMsg = { id: 'loading', role: 'assistant', loading: true }
    setMessages(prev => [...prev, userMsg, loadingMsg])
    setLoading(true)

    try {
      const ctx = buildContext(data)

      // Detect inline chart request client-side
      const qLow = q.toLowerCase()
      const wantsChart = /gr[aá]fica|chart|histograma|scatter|dispersi[oó]n|distribuci[oó]n|correlaci[oó]n|importancia|visualiza|dibuja|muestra.*(dato|variable|resultado)/.test(qLow)
      if (wantsChart && data?.charts) {
        let chartType = 'distribution'
        let chartData = data.charts.distribution
        let fi = data.feature_importance
        if (/scatter|dispersi[oó]n/.test(qLow)) { chartType = 'scatter'; chartData = data.charts.scatter }
        else if (/predicci[oó]n|predicted|actual/.test(qLow)) { chartType = 'predictions'; chartData = data.charts.predictions }
        else if (/importancia|feature|variable/.test(qLow)) { chartType = 'importance'; chartData = null }
        else if (/correlaci[oó]n/.test(qLow)) { chartType = 'scatter'; chartData = data.charts.scatter || data.charts.correlation }
        const hasData = chartType === 'importance' ? !!fi?.length : !!chartData?.data?.length
        if (hasData) {
          setMessages(prev => [
            ...prev.filter(m => m.id !== 'loading'),
            { id: Date.now()+1, role: 'assistant', text: `Aquí tienes la gráfica de **${chartType === 'distribution' ? 'Distribución de Variables' : chartType === 'scatter' ? 'Dispersión' : chartType === 'predictions' ? 'Predicción vs Real' : 'Importancia de Variables'}**. Puedes verla en detalle en la pestaña Visualizaciones.`, chart: { type: chartType, data: chartData, fi } },
          ])
          setLoading(false)
          inputRef.current?.focus()
          return
        }
      }

      // Detect retrain request client-side
      const retrainMatch = q.match(/(?:regresion lineal|linear regression|lineal|gradient boosting|random forest|logistic|svm|kmeans)/i)
      if (retrainMatch && ctx.session_id) {
        const modelMap = {
          'lineal': 'linear_regression', 'regresion lineal': 'linear_regression', 'linear regression': 'linear_regression',
          'gradient boosting': 'gradient_boosting', 'random forest': 'random_forest',
          'logistic': 'logistic_regression', 'svm': 'svm', 'kmeans': 'kmeans',
        }
        const key = Object.keys(modelMap).find(k => q.toLowerCase().includes(k))
        const modelType = key ? modelMap[key] : null
        if (modelType) {
          try {
            const { data: rr } = await axios.post('/api/retrain', { session_id: ctx.session_id, model_type: modelType }, { timeout: 30000 })
            setMessages(prev => [
              ...prev.filter(m => m.id !== 'loading'),
              { id: Date.now() + 1, role: 'assistant', text: rr.reply, retrain: rr.comparison },
            ])
            setLoading(false)
            inputRef.current?.focus()
            return
          } catch { /* fall through to normal chat */ }
        }
      }

      // Pass last 6 messages as conversation history for memory
      const history = messages
        .filter(m => !m.loading && m.id !== 'greeting' && m.id !== 'greeting-2')
        .slice(-6)
        .map(m => ({ role: m.role, text: m.text?.slice(0, 300) }))

      const { data: res } = await axios.post('/api/chat', {
        message: q,
        context: { ...ctx, history },
      }, { timeout: 20000 })

      setMessages(prev => [
        ...prev.filter(m => m.id !== 'loading'),
        { id: Date.now() + 1, role: 'assistant', text: res.reply },
      ])
    } catch {
      setMessages(prev => [
        ...prev.filter(m => m.id !== 'loading'),
        { id: Date.now() + 1, role: 'assistant', text: 'Lo siento, no he podido conectar con el servidor. Comprueba que el backend está activo.' },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [data, input, loading])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const clearChat = () => {
    setMessages([{
      id: 'greeting-2',
      role: 'assistant',
      text: `Chat reiniciado. ¿Qué quieres saber sobre ${data?.dataset_name}?`,
    }])
  }

  return (
    <aside className="w-[340px] shrink-0 border-l border-white/[0.06] bg-[#0D0D0D] flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/[0.05] shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-[#38BDF8] blur-xl opacity-20 rounded-full" />
              <RobotFace size="lg" talking={loading} />
            </div>
            <div>
              <h2 className="font-grotesk text-sm font-bold text-[#F5F5F5]">
                DataBot <span className="text-[#38BDF8]">·</span> v2.0
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${loading ? 'bg-yellow-400' : 'bg-[#34D399]'}`} />
                <span className={`text-[11px] font-inter ${loading ? 'text-yellow-400' : 'text-[#34D399]'}`}>
                  {loading ? 'Pensando…' : aiStatus?.active ? `Gemini · ${aiStatus.model}` : 'Modo inteligente local'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={clearChat}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9CA3AF]/50 hover:text-[#9CA3AF] hover:bg-white/[0.05] transition-colors"
            title="Reiniciar chat"
          >
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.8} />
          </button>
        </div>
        <div className="px-3 py-2 rounded-xl bg-[#38BDF8]/5 border border-[#38BDF8]/10">
          <p className="text-[11px] font-inter text-[#67E8F9]/70 text-center">
            ¡Hola! Soy <strong className="text-[#67E8F9]">DataBot</strong>, tu analista de datos IA 🤖 Pregúntame lo que quieras sobre tu dataset
          </p>
        </div>
      </div>


      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 flex flex-col gap-4">
        {messages.map(msg => <Message key={msg.id} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions — dynamic by problem type */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2 shrink-0">
          {(SUGGESTIONS_BY_TYPE[data?.problem_type] || SUGGESTIONS_BY_TYPE.default).map(s => (
            <button
              key={s}
              onClick={() => sendMessage(s)}
              className="text-[11px] font-inter text-[#9CA3AF] px-2.5 py-1 rounded-lg border border-white/[0.06] bg-white/[0.03] hover:border-[#38BDF8]/30 hover:text-[#38BDF8] transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-4 border-t border-white/[0.05] shrink-0">
        <div className="flex items-end gap-2 px-4 py-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] focus-within:border-[#38BDF8]/30 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Pregunta sobre los datos..."
            rows={1}
            className="flex-1 bg-transparent text-sm font-inter text-[#F5F5F5] placeholder-[#9CA3AF]/50 resize-none outline-none leading-relaxed"
            style={{ maxHeight: 96, overflowY: 'auto' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-30"
            style={{
              background: input.trim() && !loading ? 'rgba(56,189,248,0.15)' : 'transparent',
              border: `1px solid ${input.trim() && !loading ? 'rgba(56,189,248,0.3)' : 'transparent'}`,
            }}
          >
            <Send className="w-3.5 h-3.5 text-[#38BDF8]" strokeWidth={2} />
          </button>
        </div>
        <p className="text-[10px] font-inter text-[#9CA3AF]/30 mt-2 text-center">
          Enter para enviar · Shift+Enter nueva línea
        </p>
      </div>
    </aside>
  )
}
