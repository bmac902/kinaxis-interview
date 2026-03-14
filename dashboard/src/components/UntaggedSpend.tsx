import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import type { UntaggedSpendRow } from '../lib/api'

const fmtK = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M` : `$${(v / 1_000).toFixed(0)}K`

const LABEL_MAP: Record<string, string> = {
  'shared-services':        'shared-services',
  'legacy-migration-proj':  'legacy-migration',
  'supply-chain-api-prod':  'supply-chain-api',
  'maestro-platform-prod':  'maestro-plat-prod',
  'devops-tooling':          'devops-tooling',
  'customer-portal-prod':    'customer-portal',
  'maestro-platform-dev':    'maestro-plat-dev',
  'data-analytics-prod':     'data-analytics',
  'ml-training-prod':        'ml-training',
  'ml-inference-prod':       'ml-inference',
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-slate-200 font-semibold mb-2">{d.project}</p>
      <p className="text-slate-400">Untagged spend: <span className="text-red-300 font-mono font-semibold">{fmtK(d.untagged)}</span></p>
      <p className="text-slate-400">Total spend: <span className="text-white font-mono">{fmtK(d.total)}</span></p>
      <p className="text-slate-400">Untagged %: <span className={d.pct === 100 ? 'text-red-400 font-bold' : 'text-amber-400'}>{d.pct}%</span></p>
      {d.pct === 100 && <p className="text-red-400 mt-1 font-medium">⚠ Fully untagged — no team label</p>}
    </div>
  )
}

interface Props {
  data: UntaggedSpendRow[]
}

export default function UntaggedSpend({ data }: Props) {
  const sorted = [...data].sort((a, b) => b.untagged - a.untagged)
  const totalUntagged = sorted.reduce((s, d) => s + d.untagged, 0)

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Untagged Spend by Project</h2>
          <p className="text-xs text-slate-500 mt-0.5">Rows missing team label · tagging governance gap</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-mono font-semibold text-red-400">{fmtK(totalUntagged)}</p>
          <p className="text-xs text-slate-500">total unattributed</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 4 }} barSize={14}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis type="number" tickFormatter={fmtK} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="project"
            width={112}
            tick={({ x, y, payload }) => {
              const label = LABEL_MAP[payload.value] || payload.value
              const isFullyUntagged = data.find(d => d.project === payload.value)?.pct === 100
              return (
                <text x={x} y={y} dy={4} textAnchor="end" fontSize={10}
                  fill={isFullyUntagged ? '#f87171' : '#94a3b8'}>
                  {label}
                </text>
              )
            }}
            axisLine={false} tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="untagged" radius={[0, 3, 3, 0]}>
            {sorted.map(d => (
              <Cell
                key={d.project}
                fill={d.pct === 100 ? '#ef4444' : '#f59e0b'}
                opacity={d.pct === 100 ? 0.9 : 0.7}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2">
        <div className="flex items-center gap-1.5 text-xs text-red-400">
          <div className="w-2.5 h-2.5 rounded-sm bg-red-500" /> 100% untagged (no team label)
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-400">
          <div className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> ~15% rows missing tags
        </div>
      </div>
    </div>
  )
}
