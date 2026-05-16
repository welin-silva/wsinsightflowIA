import { useEffect, useRef, useState } from 'react'
import WSLogo from './WSLogo'

const STEPS = [
  { msg: 'Leyendo estructura del archivo...', duration: 600 },
  { msg: 'Detectando variables numericas...', duration: 700 },
  { msg: 'Construyendo matriz de correlacion...', duration: 800 },
  { msg: 'Analizando distribuciones...', duration: 700 },
  { msg: 'Evaluando calidad de datos...', duration: 600 },
  { msg: 'Seleccionando modelo predictivo...', duration: 900 },
  { msg: 'Entrenando pipeline inteligente...', duration: 1000 },
  { msg: 'Generando explicaciones IA...', duration: 800 },
  { msg: 'Preparando dashboard visual...', duration: 700 },
]

export default function AIProcessingOverlay({ onComplete, isDataReady }) {
  const canvasRef = useRef()
  const [stepIndex, setStepIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)

  // ── Neural canvas ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId, t = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const nodes = Array.from({ length: 34 }, () => ({
      x: 80 + Math.random() * (canvas.width - 160),
      y: 80 + Math.random() * (canvas.height - 160),
      r: Math.random() * 3.5 + 2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.018 + Math.random() * 0.028,
    }))

    const edges = []
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x
        const dy = nodes[i].y - nodes[j].y
        if (Math.sqrt(dx * dx + dy * dy) < 220) edges.push([i, j])
      }
    }

    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 1.2,
      vy: (Math.random() - 0.5) * 1.2,
      size: Math.random() * 2 + 0.4,
      opacity: Math.random() * 0.5 + 0.15,
    }))

    const streams = Array.from({ length: 18 }, () => ({
      x: Math.random() * canvas.width,
      speed: 0.8 + Math.random() * 2.5,
      chars: Array.from({ length: 24 }, () => String.fromCharCode(48 + Math.floor(Math.random() * 74))),
      y: -300,
    }))

    const draw = () => {
      ctx.fillStyle = 'rgba(5,5,5,0.14)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      t += 0.016

      // Data streams
      streams.forEach(s => {
        s.y += s.speed
        if (s.y > canvas.height + 300) { s.y = -300; s.x = Math.random() * canvas.width }
        s.chars.forEach((c, i) => {
          const alpha = (1 - i / s.chars.length) * 0.14
          ctx.fillStyle = `rgba(56,189,248,${alpha})`
          ctx.font = '12px monospace'
          ctx.fillText(c, s.x, s.y - i * 15)
        })
      })

      // Particles
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(103,232,249,${p.opacity * 0.45})`
        ctx.fill()
      })

      // Neural edges
      edges.forEach(([a, b]) => {
        const na = nodes[a], nb = nodes[b]
        const pulse = (Math.sin(t * 2 + na.phase) + 1) / 2
        ctx.beginPath()
        ctx.moveTo(na.x, na.y)
        ctx.lineTo(nb.x, nb.y)
        const grad = ctx.createLinearGradient(na.x, na.y, nb.x, nb.y)
        grad.addColorStop(0, `rgba(56,189,248,${pulse * 0.22})`)
        grad.addColorStop(0.5, `rgba(103,232,249,${pulse * 0.38})`)
        grad.addColorStop(1, `rgba(56,189,248,${pulse * 0.22})`)
        ctx.strokeStyle = grad
        ctx.lineWidth = pulse * 1.8
        ctx.stroke()
      })

      // Neural nodes
      nodes.forEach(n => {
        const glow = (Math.sin(t * n.speed * 60 + n.phase) + 1) / 2
        const r = n.r + glow * 2.5
        const outerGlow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 7)
        outerGlow.addColorStop(0, `rgba(56,189,248,${0.28 + glow * 0.38})`)
        outerGlow.addColorStop(1, 'rgba(56,189,248,0)')
        ctx.beginPath()
        ctx.arc(n.x, n.y, r * 7, 0, Math.PI * 2)
        ctx.fillStyle = outerGlow
        ctx.fill()
        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(56,189,248,${0.7 + glow * 0.3})`
        ctx.fill()
      })

      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [])

  // ── Step progression ───────────────────────────────────────────────────
  useEffect(() => {
    const totalTime = STEPS.reduce((s, step) => s + step.duration, 0)
    let elapsed = 0
    let idx = 0

    setStepIndex(0)
    setProgress(0)
    setDone(false)

    const interval = setInterval(() => {
      elapsed += 1000

      while (idx < STEPS.length) {
        const stepEnd = STEPS.slice(0, idx + 1).reduce((sum, step) => sum + step.duration, 0)
        if (elapsed < stepEnd) break
        idx += 1
      }

      if (idx >= STEPS.length) {
        setStepIndex(STEPS.length - 1)
        setProgress(100)
        setDone(true)
        clearInterval(interval)
        return
      }

      setStepIndex(idx)
      setProgress(Math.min(99, Math.round((elapsed / totalTime) * 100)))
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (done && isDataReady) {
      const t = setTimeout(onComplete, 900)
      return () => clearTimeout(t)
    }
  }, [done, isDataReady, onComplete])

  const pct = done ? 100 : progress

  return (
    <div className="fixed inset-0 bg-[#050505] z-50 overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Deep radial vignette so center pops */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 0%, rgba(5,5,5,0.55) 100%)',
        }}
      />

      {/* Center UI */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-6">

        {/* ── Logo ── */}
        <div
          className="flex items-center justify-center mb-14"
        >
          <div className="relative">
            <div
              className="absolute -inset-6 rounded-full border border-[#38BDF8]/20"
            />
            <div className="absolute -inset-2 bg-[#38BDF8] blur-2xl opacity-15 animate-pulse rounded-full" />
            <WSLogo size="lg" />
          </div>
        </div>

        {/* ── Hero title ── */}
        <div
          className="text-center mb-10"
        >
          <h2
            className="font-grotesk font-bold text-[#F5F5F5] leading-none tracking-tight mb-4"
            style={{ fontSize: 'clamp(3rem, 7vw, 5.5rem)' }}
          >
            {done ? 'Analysis Complete' : 'Analyzing Dataset'}
          </h2>

          <p
            className="font-inter text-[#9CA3AF] leading-relaxed"
            style={{ fontSize: 'clamp(1rem, 2vw, 1.25rem)' }}
          >
            {done
              ? 'Intelligence ready — loading your dashboard'
              : 'AI agent is reasoning through your data'}
          </p>
        </div>

        {/* ── Percentage hero number ── */}
        <div
          className="relative mb-10 flex items-end gap-3 justify-center"
        >
          {/* Glow halo behind number */}
          <div
            className="absolute inset-0 blur-3xl opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #38BDF8 0%, transparent 70%)' }}
          />
          <span
            className="font-grotesk font-bold electric-gradient leading-none relative"
            style={{ fontSize: 'clamp(5rem, 14vw, 11rem)' }}
          >
            {pct}
          </span>
          <span
            className="font-grotesk font-semibold text-[#38BDF8]/60 relative mb-3"
            style={{ fontSize: 'clamp(1.5rem, 4vw, 3rem)' }}
          >
            %
          </span>
        </div>

        {/* ── Current step reasoning ── */}
        <div
          className="mb-10 flex items-center justify-center"
          style={{ minHeight: '2.5rem' }}
        >
          <div
            className="flex items-center gap-4"
          >
              {!done && (
                <div className="flex gap-1.5 shrink-0">
                  {[0, 1, 2].map(i => (
                    <div
                      key={`processing-dot-${i}`}
                      className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-pulse"
                      style={{ animationDelay: `${i * 220}ms` }}
                    />
                  ))}
                </div>
              )}
              {done && (
                <div className="w-5 h-5 rounded-full border border-[#38BDF8]/50 flex items-center justify-center shrink-0">
                  <span className="text-[#38BDF8] text-xs">✓</span>
                </div>
              )}
              <span
                className="font-inter font-medium text-[#67E8F9]"
                style={{ fontSize: 'clamp(0.95rem, 2vw, 1.2rem)' }}
              >
                {done ? 'All systems ready' : STEPS[stepIndex]?.msg}
              </span>
            </div>
        </div>

        {/* ── Progress bar ── */}
        <div
          className="w-full mb-8"
          style={{ maxWidth: '640px' }}
        >
          <div className="h-[2px] bg-white/[0.06] rounded-full overflow-hidden mb-3">
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #38BDF8, #67E8F9)',
                boxShadow: '0 0 12px rgba(56,189,248,0.5)',
              }}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-inter text-[#9CA3AF]/60 uppercase tracking-widest">Processing</span>
            <span className="text-xs font-inter text-[#38BDF8]/80 font-medium">
              Step {Math.min(stepIndex + 1, STEPS.length)} of {STEPS.length}
            </span>
          </div>
        </div>

        {/* ── Log terminal ── */}
        <div
          className="w-full"
          style={{ maxWidth: '640px' }}
        >
          <div
            className="rounded-2xl border border-white/[0.06] overflow-hidden"
            style={{ background: 'rgba(13,13,13,0.85)', backdropFilter: 'blur(24px)' }}
          >
            {/* Terminal header */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.05]">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
              </div>
              <span className="ml-2 text-xs font-inter text-[#9CA3AF]/50 tracking-wider uppercase">
                AI Reasoning Log
              </span>
              <div className="ml-auto flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-pulse" />
                <span className="text-[10px] font-inter text-[#38BDF8]/70">LIVE</span>
              </div>
            </div>

            {/* Log entries */}
            <div className="p-5 h-44 overflow-hidden relative">
              <div className="absolute inset-0 flex flex-col-reverse p-5">
                {STEPS.slice(0, stepIndex + 1).reverse().map((s, i) => (
                  <div
                    key={s.msg}
                    className="flex items-center gap-3 mb-2.5 shrink-0"
                    style={{ opacity: i === 0 ? 1 : Math.max(0, 0.35 - i * 0.07) }}
                  >
                    <span
                      className="font-inter shrink-0"
                      style={{
                        fontSize: '0.72rem',
                        color: i === 0 ? 'rgba(103,232,249,0.5)' : 'rgba(156,163,175,0.25)',
                      }}
                    >
                      {i === 0 && !done ? '›' : '✓'}
                    </span>
                    <span
                      className="font-inter"
                      style={{
                        fontSize: i === 0 ? '0.875rem' : '0.78rem',
                        color: i === 0 ? '#67E8F9' : 'rgba(156,163,175,0.3)',
                        fontWeight: i === 0 ? 500 : 400,
                      }}
                    >
                      {s.msg}
                    </span>
                  </div>
                ))}
              </div>

              {/* Scan line */}
              {!done && (
                <div
                  className="absolute left-0 right-0 top-1/2 h-px pointer-events-none"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.3), transparent)' }}
                />
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
