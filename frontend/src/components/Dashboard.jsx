import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import DatasetOverview from './DatasetOverview'
import VisualizationPanel from './VisualizationPanel'
import AIInsightsPanel from './AIInsightsPanel'
import AIChatPanel from './AIChatPanel'
import ModelPanel from './ModelPanel'
import LivePredictions from './LivePredictions'
import ErrorBoundary from './ErrorBoundary'
import DataTableModal from './DataTableModal'

const TABS = [
  { id: 'overview',       label: 'Overview',       dot: '#38BDF8' },
  { id: 'visualizations', label: 'Visualizations', dot: '#67E8F9' },
  { id: 'model',          label: 'AI Model',       dot: '#818CF8' },
  { id: 'predictions',    label: 'Predictions',    dot: '#34D399' },
]

export default function Dashboard({
  data,
  onReset,
  onChartUpdate,
  activeView: controlledActiveView,
  onActiveViewChange,
  visualizationFilter,
  onVisualizationFilterChange,
}) {
  const [internalActiveView, setInternalActiveView] = useState(controlledActiveView || 'overview')
  const [rightPanel, setRightPanel] = useState('insights') // 'insights' | 'chat'
  const [showDataTable, setShowDataTable] = useState(false)
  const [liveCharts, setLiveCharts] = useState({})
  const activeView = controlledActiveView || internalActiveView

  const handleChartUpdate = (chartKey, chartData) => {
    setLiveCharts(prev => ({ ...prev, [chartKey]: chartData }))
    onChartUpdate?.(chartKey, chartData)
  }

  useEffect(() => {
    if (controlledActiveView) setInternalActiveView(controlledActiveView)
  }, [controlledActiveView])

  const setActiveView = view => {
    setInternalActiveView(view)
    onActiveViewChange?.(view)
  }

  return (
    <div className="flex h-screen bg-[#050505] overflow-hidden">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        onReset={onReset}
        datasetName={data?.dataset_name}
        rightPanel={rightPanel}
        onRightPanelChange={setRightPanel}
        onDataTableOpen={() => setShowDataTable(true)}
      />

      {showDataTable && (
        <DataTableModal
          headers={data?._rawHeaders}
          rows={data?._rawRows}
          datasetName={data?.dataset_name}
          onClose={() => setShowDataTable(false)}
        />
      )}

      <div className="flex-1 flex overflow-hidden min-w-0">

        {/* ── Center panel ── */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-10 py-8 min-w-0">

          {/* Top bar */}
          <div className="flex items-start justify-between mb-10">
            <div>
              <h1 className="font-grotesk text-4xl font-bold text-[#F5F5F5] tracking-tight mb-2">
                {data?.dataset_name || 'Dataset Analysis'}
              </h1>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-inter text-base text-[#9CA3AF]">{data?.rows?.toLocaleString()} rows</span>
                <span className="w-1 h-1 rounded-full bg-[#9CA3AF]/30" />
                <span className="font-inter text-base text-[#9CA3AF]">{data?.columns} columns</span>
                <span className="w-1 h-1 rounded-full bg-[#9CA3AF]/30" />
                <span className="font-inter text-base font-medium text-[#38BDF8]">{data?.problem_type}</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl border border-green-500/20 bg-green-500/5 mt-1 shrink-0">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm font-inter text-green-400 font-medium">Analysis Complete</span>
            </div>
          </div>

          {/* Navigation tabs */}
          <div className="mb-10">
            <div className="inline-flex gap-1.5 p-1.5 rounded-2xl bg-[#0D0D0D] border border-white/[0.06]">
              {TABS.map(tab => {
                const active = activeView === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveView(tab.id)}
                    className={`relative px-6 py-3 rounded-xl font-grotesk font-medium text-sm transition-colors duration-200 select-none ${active ? 'text-[#F5F5F5]' : 'text-[#9CA3AF] hover:text-[#F5F5F5]'}`}
                  >
                    <span
                      className="absolute inset-0 rounded-xl border transition-all duration-200"
                      style={{
                        background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
                        borderColor: active ? 'rgba(255,255,255,0.10)' : 'transparent',
                      }}
                    />
                    <span className="relative flex items-center gap-2.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0 transition-all duration-200"
                        style={{
                          background: active ? tab.dot : 'transparent',
                          boxShadow: active ? `0 0 8px ${tab.dot}80` : 'none',
                          opacity: active ? 1 : 0,
                          width: active ? '0.5rem' : 0,
                        }}
                      />
                      {tab.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Panels — always mounted, toggled with display */}
          <div style={{ display: activeView === 'overview' ? undefined : 'none' }}>
            <ErrorBoundary><DatasetOverview data={data} /></ErrorBoundary>
          </div>
          <div style={{ display: activeView === 'visualizations' ? undefined : 'none' }}>
            <ErrorBoundary>
              <VisualizationPanel
                data={data}
                liveCharts={liveCharts}
                activeFilter={visualizationFilter}
                onActiveFilterChange={onVisualizationFilterChange}
              />
            </ErrorBoundary>
          </div>
          <div style={{ display: activeView === 'model' ? undefined : 'none' }}>
            <ErrorBoundary><ModelPanel data={data} onChartUpdate={handleChartUpdate} /></ErrorBoundary>
          </div>
          <div style={{ display: activeView === 'predictions' ? undefined : 'none' }}>
            <ErrorBoundary><LivePredictions data={data} /></ErrorBoundary>
          </div>
        </div>

        {/* ── Right panel — insights or chat ── */}
        {rightPanel === 'chat'
          ? <AIChatPanel data={data} />
          : <AIInsightsPanel insights={data?.ai_insights} summary={data?.summary} data={data} />
        }
      </div>
    </div>
  )
}
