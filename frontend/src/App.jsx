import { useState, useCallback, useRef, useEffect } from 'react'
import LandingHero from './components/LandingHero'
import AIProcessingOverlay from './components/AIProcessingOverlay'
import Dashboard from './components/Dashboard'
import axios from 'axios'

const LS_KEY = 'insightflow_session_id'

export default function App() {
  const [phase, setPhase]               = useState('landing')
  const [analysisData, setAnalysisData] = useState(null)
  const [error, setError]               = useState(null)
  const [restoring, setRestoring]       = useState(false)
  const readyRef = useRef(false)

  // On mount: check if a session was saved in localStorage and is still valid
  useEffect(() => {
    const savedId = localStorage.getItem(LS_KEY)
    if (!savedId) return

    setRestoring(true)
    axios.get(`/api/session/${savedId}/validate`)
      .then(res => {
        if (res.data?.valid) {
          localStorage.setItem(LS_KEY, savedId)
        } else {
          localStorage.removeItem(LS_KEY)
        }
      })
      .catch(() => {
        localStorage.removeItem(LS_KEY)
      })
      .finally(() => setRestoring(false))
  }, [])

  const handleFileUpload = useCallback(async (file) => {
    setPhase('processing')
    setError(null)
    readyRef.current = false

    let rawRows = null
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim())
      rawRows = lines.slice(1, 201).map(line => {
        const vals = line.split(',').map(v => v.replace(/^"|"$/g, '').trim())
        const row = {}
        headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
        return row
      })
      rawRows._headers = headers
    } catch { rawRows = null }

    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await axios.post('/api/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      })
      const data = { ...response.data, _rawRows: rawRows, _rawHeaders: rawRows?._headers }

      if (data.session_id) {
        localStorage.setItem(LS_KEY, data.session_id)
      }

      readyRef.current = true
      setAnalysisData(data)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Análisis fallido. Inténtalo de nuevo.'
      setError(msg)
      setPhase('landing')
    }
  }, [])

  const handleProcessingComplete = useCallback(() => {
    if (readyRef.current) setPhase('dashboard')
  }, [])

  const handleChartUpdate = useCallback((chartKey, chartData) => {
    setAnalysisData(prev => prev ? { ...prev, charts: { ...prev.charts, [chartKey]: chartData } } : prev)
  }, [])

  const handleReset = useCallback(() => {
    setPhase('landing')
    setAnalysisData(null)
    readyRef.current = false
    setError(null)
    // Do NOT clear localStorage here — session stays alive on backend
    // so user can come back to it. Only clear when explicitly logging out.
  }, [])

  return (
    <div className="min-h-screen bg-[#050505] overflow-hidden">
      {phase === 'landing' && (
        <LandingHero onFileUpload={handleFileUpload} error={error} />
      )}
      {phase === 'processing' && (
        <AIProcessingOverlay
          onComplete={handleProcessingComplete}
          isDataReady={!!analysisData}
        />
      )}
      {phase === 'dashboard' && (
        <Dashboard
          data={analysisData}
          onReset={handleReset}
          onChartUpdate={handleChartUpdate}
        />
      )}
    </div>
  )
}
