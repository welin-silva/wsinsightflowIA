import { useEffect, useRef } from 'react'
import { X, Table2 } from 'lucide-react'

export default function DataTableModal({ headers, rows, datasetName, onClose }) {
  const backdropRef = useRef()

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!headers || !rows) return null

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
    >
      <div className="w-full max-w-6xl max-h-[85vh] flex flex-col rounded-2xl border border-white/[0.08] bg-[#0D0D0D] overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center">
              <Table2 className="w-4 h-4 text-[#38BDF8]" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="font-grotesk text-sm font-bold text-[#F5F5F5]">{datasetName || 'Dataset'}</h2>
              <p className="text-[11px] font-inter text-[#9CA3AF] mt-0.5">
                {rows.length} filas · {headers.length} columnas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9CA3AF]/50 hover:text-[#9CA3AF] hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.8} />
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto scrollbar-thin">
          <table className="w-full text-[12px] font-inter border-collapse">
            <thead className="sticky top-0 z-10 bg-[#0D0D0D]">
              <tr>
                <th className="px-3 py-2.5 text-left text-[#9CA3AF] font-medium border-b border-white/[0.06] w-10 shrink-0">#</th>
                {headers.map(h => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left text-[#38BDF8] font-medium border-b border-white/[0.06] whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-3 py-2 text-[#9CA3AF]/40 tabular-nums">{i + 1}</td>
                  {headers.map(h => (
                    <td key={h} className="px-3 py-2 text-[#E5E7EB] whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">
                      {row[h] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 border-t border-white/[0.06] shrink-0">
          <p className="text-[10px] font-inter text-[#9CA3AF]/40 text-center">
            Mostrando primeras {rows.length} filas · Pulsa Esc o fuera del panel para cerrar
          </p>
        </div>
      </div>
    </div>
  )
}
