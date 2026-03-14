import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchProjectSkus } from '../lib/api'
import type { ProjectSkuData } from '../lib/api'

const SERVICE_COLORS: Record<string, string> = {
  'Compute Engine':    '#60a5fa',
  'Kubernetes Engine': '#818cf8',
  'Cloud Storage':     '#a78bfa',
  'BigQuery':          '#fbbf24',
  'Databricks':        '#f87171',
  'Vertex AI':         '#34d399',
  'Cloud SQL':         '#22d3ee',
  'Networking':        '#fb923c',
  'Other':             '#64748b',
}

const fmt = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M`
  : v >= 1_000   ? `$${(v / 1_000).toFixed(1)}K`
  : `$${v}`

interface Props {
  project:   string | null
  startMonth: string
  endMonth:   string
  onClose:   () => void
}

export default function DrillDownModal({ project, startMonth, endMonth, onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const { data, isLoading, isError } = useQuery<ProjectSkuData>({
    queryKey: ['skus', project, startMonth, endMonth],
    queryFn:  () => fetchProjectSkus(project!, startMonth, endMonth),
    enabled:  !!project,
    staleTime: 5 * 60_000,
  })

  if (!project) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">SKU Breakdown</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">{project}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          {isLoading && (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-8 justify-center">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              Loading SKU data…
            </div>
          )}
          {isError && (
            <p className="text-red-400 text-sm py-4 text-center">Failed to load SKU data.</p>
          )}
          {data && (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-slate-500">Top SKUs by BilledCost</p>
                <p className="text-sm font-mono font-semibold text-slate-100">{fmt(data.total)} total</p>
              </div>
              <div className="space-y-2">
                {data.skus.map((sku, i) => {
                  const color = SERVICE_COLORS[sku.service] || '#64748b'
                  return (
                    <div key={i} className="group relative">
                      {/* Bar background */}
                      <div
                        className="absolute inset-0 rounded-lg opacity-10"
                        style={{ backgroundColor: color, width: `${sku.pct}%` }}
                      />
                      <div className="relative flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-800">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                          <div className="min-w-0">
                            <p className="text-xs text-slate-200 truncate max-w-[260px]">{sku.sku}</p>
                            <p className="text-[10px] text-slate-500">{sku.service}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p className="text-xs font-mono font-semibold text-slate-100">{fmt(sku.cost)}</p>
                          <p className="text-[10px] text-slate-500">{sku.pct}%</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800">
          <p className="text-[10px] text-slate-600">
            FOCUS 1.0 · ChargeDescription · BilledCost · filtered by selected date range
          </p>
        </div>
      </div>
    </div>
  )
}
