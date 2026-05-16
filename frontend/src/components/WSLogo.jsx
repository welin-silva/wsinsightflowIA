export default function WSLogo({ size = 'md', className = '' }) {
  const isLg = size === 'lg'

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      <span
        className={`font-grotesk font-black leading-none ${isLg ? 'text-3xl' : 'text-xl'}`}
        style={{
          background: 'linear-gradient(135deg, #38BDF8 0%, #67E8F9 60%, #818CF8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        WS
      </span>
      <span
        className={`font-grotesk font-semibold leading-none tracking-tight ${isLg ? 'text-2xl' : 'text-base'} text-[#F5F5F5]`}
      >
        InsightFlow
        <span
          className="ml-1 font-light"
          style={{
            background: 'linear-gradient(135deg, #818CF8 0%, #38BDF8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          IA
        </span>
      </span>
    </div>
  )
}
