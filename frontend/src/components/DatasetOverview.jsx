import {
  Database, Columns, Target, AlertTriangle, CheckCircle, Hash, Type,
} from 'lucide-react'

function StatCard({ icon: Icon, label, value, sub, iconBg, iconColor }) {
  return (
    <div
      className="rounded-2xl border border-white/[0.06] bg-[#0D0D0D] px-7 py-6 relative overflow-hidden"
    >
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-5 ${iconBg || 'bg-[#38BDF8]/10'}`}>
        <Icon className={`w-5 h-5 ${iconColor || 'text-[#38BDF8]'}`} strokeWidth={1.5} />
      </div>
      <p className="font-grotesk text-3xl font-bold text-[#F5F5F5] mb-1.5 leading-none">{value}</p>
      <p className="font-inter text-sm text-[#9CA3AF] mb-1">{label}</p>
      {sub && <p className="font-inter text-xs text-[#38BDF8]/60">{sub}</p>}
    </div>
  )
}

function QualityBar({ label, value, color }) {
  return (
    <div className="flex items-center gap-4">
      <span className="font-inter text-sm text-[#9CA3AF] w-32 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${value}%`,
            background: color || '#38BDF8',
            boxShadow: `0 0 8px ${color || '#38BDF8'}60`,
          }}
        />
      </div>
      <span className="font-inter text-sm font-semibold text-[#F5F5F5] w-10 text-right">{value}%</span>
    </div>
  )
}

export default function DatasetOverview({ data }) {
  if (!data) return null
  const {
    rows, columns, numeric_columns, categorical_columns, missing_pct,
    target_column, problem_type, data_quality_score, column_types, statistics,
  } = data

  const qualityColor = data_quality_score >= 80 ? '#4ADE80'
    : data_quality_score >= 60 ? '#FBBF24' : '#F87171'

  return (
    <div className="space-y-7">

      {/* ── Stat grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          icon={Database}
          label="Total Records"
          value={rows?.toLocaleString()}
          sub={`${columns} features detected`}
        />
        <StatCard
          icon={Columns}
          label="Features"
          value={columns}
          sub={`${numeric_columns} numeric · ${categorical_columns} categorical`}
        />
        <StatCard
          icon={Target}
          label="Target Variable"
          value={target_column || 'Auto'}
          sub={problem_type}
          iconBg="bg-purple-500/10"
          iconColor="text-purple-400"
        />
        <StatCard
          icon={data_quality_score >= 80 ? CheckCircle : AlertTriangle}
          label="Data Quality"
          value={`${data_quality_score}%`}
          sub={data_quality_score >= 80 ? 'Excellent' : data_quality_score >= 60 ? 'Good' : 'Needs cleaning'}
          iconBg={data_quality_score >= 80 ? 'bg-green-500/10' : 'bg-yellow-500/10'}
          iconColor={data_quality_score >= 80 ? 'text-green-400' : 'text-yellow-400'}
        />
      </div>

      {/* ── Data quality breakdown ── */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#0D0D0D] px-7 py-7">
        <h3 className="font-grotesk text-base font-semibold text-[#F5F5F5] mb-7">Data Quality Report</h3>
        <div className="space-y-5">
          <QualityBar label="Completeness" value={Math.round(100 - (missing_pct || 0))} color="#38BDF8" />
          <QualityBar label="Overall Score" value={data_quality_score || 85} color={qualityColor} />
          <QualityBar
            label="Numeric Ratio"
            value={columns ? Math.round((numeric_columns / columns) * 100) : 0}
            color="#67E8F9"
          />
        </div>
      </div>

      {/* ── Column profile ── */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#0D0D0D] px-7 py-7">
        <h3 className="font-grotesk text-base font-semibold text-[#F5F5F5] mb-6">Column Profile</h3>
        <div className="space-y-2.5 max-h-72 overflow-y-auto scrollbar-thin pr-2">
          {(column_types || []).map((col, i) => (
            <div
              key={col.name}
              className="flex items-center gap-4 px-4 py-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-[#38BDF8]/15 transition-colors"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                col.dtype === 'numeric' ? 'bg-[#38BDF8]/10' : 'bg-purple-500/10'
              }`}>
                {col.dtype === 'numeric'
                  ? <Hash className="w-3.5 h-3.5 text-[#38BDF8]" strokeWidth={2} />
                  : <Type className="w-3.5 h-3.5 text-purple-400" strokeWidth={2} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-inter text-sm font-medium text-[#F5F5F5] truncate">{col.name}</p>
                <p className="font-inter text-xs text-[#9CA3AF] mt-0.5">
                  {col.dtype} · {col.missing}% missing
                </p>
              </div>
              {col.name === target_column && (
                <span className="text-xs font-inter font-medium px-2.5 py-1 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[#38BDF8] shrink-0">
                  target
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Statistics table ── */}
      {statistics?.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-[#0D0D0D] px-7 py-7">
          <h3 className="font-grotesk text-base font-semibold text-[#F5F5F5] mb-6">Descriptive Statistics</h3>
          <div className="overflow-x-auto">
            <table className="w-full font-inter">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Feature', 'Mean', 'Std Dev', 'Min', 'Max'].map(h => (
                    <th key={h} className="pb-4 pr-6 text-left text-sm text-[#9CA3AF] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {statistics.map((row, i) => (
                  <tr
                    key={row.column}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3.5 pr-6 text-sm font-medium text-[#F5F5F5]">{row.column}</td>
                    <td className="py-3.5 pr-6 text-sm text-[#9CA3AF]">{row.mean?.toFixed(2) ?? '—'}</td>
                    <td className="py-3.5 pr-6 text-sm text-[#9CA3AF]">{row.std?.toFixed(2) ?? '—'}</td>
                    <td className="py-3.5 pr-6 text-sm text-[#9CA3AF]">{row.min?.toFixed(2) ?? '—'}</td>
                    <td className="py-3.5 pr-6 text-sm text-[#9CA3AF]">{row.max?.toFixed(2) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
