import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchChargeback } from '../lib/api'
import type { ChargebackRow } from '../lib/api'

const fmt = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M`
  : v >= 1_000   ? `$${(v / 1_000).toFixed(0)}K`
  : `$${v}`

type SortKey = 'total' | 'lastMonthCost' | 'momPct' | 'team'
type SortDir = 'asc' | 'desc'

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <svg className={`w-3 h-3 inline ml-0.5 ${active ? 'text-blue-400' : 'text-slate-600'}`}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      {dir === 'desc' || !active
        ? <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        : <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />}
    </svg>
  )
}

function buildCsv(rows: ChargebackRow[]): string {
  const lines = ['Team,Projects,TotalCost,LastMonthCost,MoM%']
  for (const r of rows) {
    lines.push(`"${r.team}","${r.projects}",${r.total},${r.lastMonthCost ?? ''},${r.momPct ?? ''}`)
  }
  return lines.join('\n')
}

function downloadCsv(csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'chargeback.csv'
  a.click()
  URL.revokeObjectURL(url)
}

interface Props {
  startMonth: string
  endMonth:   string
}

export default function ChargebackTable({ startMonth, endMonth }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('total')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const { data, isLoading } = useQuery<ChargebackRow[]>({
    queryKey: ['chargeback', startMonth, endMonth],
    queryFn:  () => fetchChargeback(startMonth, endMonth),
    staleTime: 5 * 60_000,
  })

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = data ? [...data].sort((a, b) => {
    const av = a[sortKey] ?? (sortDir === 'desc' ? -Infinity : Infinity)
    const bv = b[sortKey] ?? (sortDir === 'desc' ? -Infinity : Infinity)
    if (typeof av === 'string' && typeof bv === 'string')
      return sortDir === 'desc' ? bv.localeCompare(av) : av.localeCompare(bv)
    return sortDir === 'desc' ? (bv as number) - (av as number) : (av as number) - (bv as number)
  }) : []

  const totalSpend = sorted.reduce((s, r) => s + r.total, 0)

  const thClass = 'text-left text-[10px] text-slate-500 uppercase tracking-wide px-3 py-2 cursor-pointer select-none hover:text-slate-300 transition-colors'
  const tdClass = 'px-3 py-2.5 text-xs'

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Chargeback by Team</h2>
          <p className="text-xs text-slate-500 mt-0.5">BilledCost grouped by team label · click column to sort</p>
        </div>
        <button
          onClick={() => data && downloadCsv(buildCsv(sorted))}
          disabled={!data}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-700 transition-colors disabled:opacity-40"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          Export CSV
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-9 bg-slate-800 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className={thClass} onClick={() => handleSort('team')}>
                  Team <SortIcon active={sortKey === 'team'} dir={sortDir} />
                </th>
                <th className="text-left text-[10px] text-slate-500 uppercase tracking-wide px-3 py-2">Projects</th>
                <th className={`${thClass} text-right`} onClick={() => handleSort('total')}>
                  Total <SortIcon active={sortKey === 'total'} dir={sortDir} />
                </th>
                <th className={`${thClass} text-right`} onClick={() => handleSort('lastMonthCost')}>
                  Last Month <SortIcon active={sortKey === 'lastMonthCost'} dir={sortDir} />
                </th>
                <th className={`${thClass} text-right`} onClick={() => handleSort('momPct')}>
                  MoM <SortIcon active={sortKey === 'momPct'} dir={sortDir} />
                </th>
                <th className="text-left text-[10px] text-slate-500 uppercase tracking-wide px-3 py-2">Share</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const isUntagged = row.team === '— untagged —'
                const sharePct   = totalSpend > 0 ? (row.total / totalSpend * 100) : 0
                const momColor   = row.momPct === null ? 'text-slate-500'
                                 : row.momPct > 15    ? 'text-red-400 font-semibold'
                                 : row.momPct > 5     ? 'text-amber-400'
                                 : row.momPct < 0     ? 'text-emerald-400'
                                 : 'text-slate-300'

                return (
                  <tr key={i} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                    <td className={tdClass}>
                      <span className={isUntagged ? 'text-red-400 font-medium' : 'text-slate-200'}>
                        {row.team}
                      </span>
                      {isUntagged && (
                        <span className="ml-1.5 text-[9px] bg-red-950/60 text-red-400 px-1 py-0.5 rounded">no label</span>
                      )}
                    </td>
                    <td className={`${tdClass} text-slate-500 font-mono text-[10px] max-w-[180px] truncate`}>
                      {row.projects}
                    </td>
                    <td className={`${tdClass} text-right font-mono font-semibold text-slate-100`}>
                      {fmt(row.total)}
                    </td>
                    <td className={`${tdClass} text-right font-mono text-slate-300`}>
                      {row.lastMonthCost != null ? fmt(row.lastMonthCost) : '—'}
                    </td>
                    <td className={`${tdClass} text-right font-mono ${momColor}`}>
                      {row.momPct != null ? `${row.momPct >= 0 ? '+' : ''}${row.momPct}%` : '—'}
                    </td>
                    <td className={`${tdClass}`}>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-800 rounded-full h-1.5 min-w-[60px]">
                          <div
                            className={`h-1.5 rounded-full ${isUntagged ? 'bg-red-500' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min(sharePct, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 w-8 text-right">{sharePct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-700">
                <td className={`${tdClass} text-slate-400 font-medium`} colSpan={2}>Total</td>
                <td className={`${tdClass} text-right font-mono font-bold text-white`}>{fmt(totalSpend)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
