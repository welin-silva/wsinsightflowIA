import { LayoutDashboard, BarChart3, Brain, Zap, ChevronLeft, Database, MessageSquare, Lightbulb } from 'lucide-react'

const nav = [
  { id: 'overview',       icon: LayoutDashboard, label: 'Overview',       dot: '#38BDF8' },
  { id: 'visualizations', icon: BarChart3,        label: 'Visualizations', dot: '#67E8F9' },
  { id: 'model',          icon: Brain,            label: 'AI Model',       dot: '#818CF8' },
  { id: 'predictions',    icon: Zap,              label: 'Predictions',    dot: '#34D399' },
]

function Tooltip({ label }) {
  return (
    <div className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-[#0D0D0D] border border-white/[0.08] text-sm font-inter text-[#F5F5F5] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-50 shadow-xl">
      {label}
    </div>
  )
}

export default function Sidebar({ activeView, onViewChange, onReset, datasetName, rightPanel, onRightPanelChange, onDataTableOpen }) {
  return (
    <aside
      className="w-[72px] flex flex-col items-center py-5 border-r border-white/[0.06] bg-[#0D0D0D] relative z-10 shrink-0"
    >
      {/* Logo — compact WS mark */}
      <div className="mb-6 w-10 h-10 rounded-xl flex items-center justify-center border border-[#38BDF8]/20 bg-[#38BDF8]/5">
        <span
          className="font-grotesk font-black text-lg leading-none select-none"
          style={{
            background: 'linear-gradient(135deg, #38BDF8 0%, #818CF8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          WS
        </span>
      </div>

      <div className="h-px w-9 bg-white/[0.06] mb-5" />

      {/* Navigation */}
      <nav className="flex flex-col gap-2 flex-1">
        {nav.map(({ id, icon: Icon, label, dot }) => {
          const active = activeView === id
          return (
            <button
              key={id}
              onClick={() => onViewChange(id)}
              title={label}
              className={`
                relative w-11 h-11 rounded-xl flex items-center justify-center
                transition-all duration-200 group
                ${active
                  ? 'bg-[#38BDF8]/10 border border-[#38BDF8]/30'
                  : 'text-[#9CA3AF] hover:text-[#F5F5F5] hover:bg-white/[0.05] border border-transparent'
                }
              `}
              style={{ color: active ? dot : undefined }}
            >
              {/* Always rendered — avoids layoutId conditional mount crash */}
              <span
                className="absolute inset-0 rounded-xl transition-all duration-200"
                style={{ boxShadow: active ? `inset 0 0 0 1px ${dot}40` : 'none' }}
              />
              <Icon className="w-[18px] h-[18px] relative" strokeWidth={1.5} />
              <Tooltip label={label} />
            </button>
          )
        })}
      </nav>

      <div className="h-px w-9 bg-white/[0.06] mb-4" />

      {/* Dataset table */}
      <button
        onClick={onDataTableOpen}
        title={datasetName || 'Dataset'}
        className="relative w-11 h-11 rounded-xl flex items-center justify-center text-[#9CA3AF] hover:text-[#38BDF8] hover:bg-white/[0.04] border border-transparent transition-all group mb-2"
      >
        <Database className="w-[18px] h-[18px]" strokeWidth={1.5} />
        <Tooltip label={datasetName ? `Ver tabla: ${datasetName}` : 'Ver datos'} />
      </button>

      {/* Insights toggle */}
      <button
        onClick={() => onRightPanelChange?.('insights')}
        title="AI Insights"
        className={`relative w-11 h-11 rounded-xl flex items-center justify-center border transition-all group mb-2 ${
          rightPanel === 'insights'
            ? 'bg-[#818CF8]/10 border-[#818CF8]/30 text-[#818CF8]'
            : 'text-[#9CA3AF] hover:text-[#818CF8] hover:bg-white/[0.04] border-transparent'
        }`}
      >
        <Lightbulb className="w-[18px] h-[18px]" strokeWidth={1.5} />
        <Tooltip label="AI Insights" />
      </button>

      {/* Chat toggle */}
      <button
        onClick={() => onRightPanelChange?.('chat')}
        title="Chat con tus datos"
        className={`relative w-11 h-11 rounded-xl flex items-center justify-center border transition-all group mb-3 ${
          rightPanel === 'chat'
            ? 'bg-[#38BDF8]/10 border-[#38BDF8]/30 text-[#38BDF8]'
            : 'text-[#9CA3AF] hover:text-[#38BDF8] hover:bg-white/[0.04] border-transparent'
        }`}
      >
        <MessageSquare className="w-[18px] h-[18px]" strokeWidth={1.5} />
        <Tooltip label="Chat con los datos" />
      </button>

      {/* Back */}
      <button
        onClick={onReset}
        title="Upload new dataset"
        className="relative w-11 h-11 rounded-xl flex items-center justify-center text-[#9CA3AF] hover:text-[#F5F5F5] hover:bg-white/[0.04] border border-transparent transition-all group"
      >
        <ChevronLeft className="w-[18px] h-[18px]" strokeWidth={1.5} />
        <Tooltip label="New dataset" />
      </button>
    </aside>
  )
}
