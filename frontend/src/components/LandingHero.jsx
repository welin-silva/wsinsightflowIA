import { useCallback, useRef, useState } from 'react'
import { Zap, BarChart3, Brain, AlertCircle } from 'lucide-react'
import ParticleCanvas from './ParticleCanvas'
import WSLogo from './WSLogo'
import CSVPicker from './CSVPicker'

const features = [
  {
    icon: Brain,
    label: 'AI Agent',
    desc: 'Motor de razonamiento que lee tus datos, selecciona el modelo óptimo y explica cada decisión en lenguaje natural.',
    accent: '#38BDF8',
    tag: 'LangGraph + Gemini',
  },
  {
    icon: BarChart3,
    label: 'Auto-ML',
    desc: 'Random Forest, Gradient Boosting, SVM, KMeans — el sistema evalúa todos los candidatos y entrena el mejor pipeline.',
    accent: '#67E8F9',
    tag: 'scikit-learn',
  },
  {
    icon: Zap,
    label: 'Real-time',
    desc: 'Predicciones en vivo, inputs interactivos e inferencia instantánea con puntuaciones de confianza.',
    accent: '#818CF8',
    tag: 'FastAPI',
  },
]

export default function LandingHero({ onFileUpload, error }) {
  const [isDragging, setIsDragging] = useState(false)
  const fileRef = useRef()

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith('.csv')) onFileUpload(file)
  }, [onFileUpload])

  const handleFileChange = useCallback((e) => {
    const file = e.target.files[0]
    if (file) onFileUpload(file)
  }, [onFileUpload])

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pb-20">
      <ParticleCanvas />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-10 py-6 z-20">
        <WSLogo size="sm" />
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#38BDF8] animate-pulse" />
          <span className="text-xs text-[#9CA3AF] font-inter">Sistema online</span>
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center text-center w-full max-w-5xl mx-auto px-6">

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#38BDF8]/20 bg-[#38BDF8]/5 mb-8 backdrop-blur-xl">
          <div className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-pulse" />
          <span className="text-xs font-inter text-[#38BDF8] tracking-widest uppercase">
            Predictive Intelligence · Gemini AI
          </span>
        </div>

        <h1 className="font-grotesk text-5xl md:text-7xl font-black text-[#F5F5F5] leading-[0.95] tracking-tight mb-6">
          Los datos hablan,{' '}
          <span style={{
            background: 'linear-gradient(135deg, #38BDF8 0%, #67E8F9 50%, #818CF8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            la IA escucha.
          </span>
        </h1>

        <p className="font-inter text-lg text-[#9CA3AF] max-w-2xl leading-relaxed mb-10">
          Observa cómo surge la inteligencia artificial — predicciones, patrones y perspectivas
          generados en segundos por una IA que realmente comprende tus datos.{' '}
          <span className="text-[#F5F5F5]/50">Sube tu archivo CSV y empieza.</span>
        </p>

        {/* Upload zone */}
        <div className="w-full max-w-2xl">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`
              relative cursor-pointer rounded-[28px] border transition-all duration-500 p-8 md:p-10 overflow-hidden
              ${isDragging
                ? 'border-[#38BDF8]/60 bg-[#38BDF8]/5 shadow-[0_0_60px_rgba(56,189,248,0.12)]'
                : 'border-white/[0.08] bg-white/[0.035] hover:border-[#38BDF8]/25 hover:bg-[#38BDF8]/[0.03]'
              }
            `}
            style={{ backdropFilter: 'blur(26px)' }}
          >
            {isDragging && (
              <div className="absolute inset-0 rounded-[28px] bg-gradient-radial from-[#38BDF8]/10 to-transparent" />
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="relative flex flex-col items-center gap-5">
              <CSVPicker onFile={onFileUpload} />
              <div>
                <p className="font-grotesk text-xl font-medium text-[#F5F5F5] mb-1">
                  {isDragging ? 'Suelta el CSV aquí' : 'Arrastra tu CSV o haz clic para subir'}
                </p>
                <p className="font-inter text-sm text-[#9CA3AF]">
                  La IA analizará estructura, gráficas, modelo y predicciones automáticamente.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 mt-4 px-4 py-3 rounded-xl bg-red-500/5 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-sm text-red-400 font-inter">{error}</span>
            </div>
          )}
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-16 w-full">
          {features.map(({ icon: Icon, label, desc, accent, tag }) => (
            <div
              key={label}
              className="group relative flex flex-col items-start gap-6 px-8 py-9 rounded-2xl border border-white/[0.06] bg-[#0D0D0D] overflow-hidden text-left"
            >
              <div
                className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl pointer-events-none"
                style={{ background: `radial-gradient(circle, ${accent}18 0%, transparent 70%)` }}
              />
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-2xl blur-xl opacity-30" style={{ background: accent }} />
                <div
                  className="relative w-14 h-14 rounded-2xl flex items-center justify-center border"
                  style={{ background: `${accent}10`, borderColor: `${accent}25` }}
                >
                  <Icon className="w-6 h-6" style={{ color: accent }} strokeWidth={1.5} />
                </div>
              </div>
              <div className="flex-1">
                <p className="font-grotesk text-xl font-semibold text-[#F5F5F5] mb-3">{label}</p>
                <p className="font-inter text-sm text-[#9CA3AF] leading-relaxed">{desc}</p>
              </div>
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-inter font-medium border"
                style={{ color: accent, borderColor: `${accent}20`, background: `${accent}08` }}
              >
                <div className="w-1 h-1 rounded-full" style={{ background: accent }} />
                {tag}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#050505] to-transparent pointer-events-none" />
    </div>
  )
}
