import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import type { CUDCoverageRow, CUDSummary } from '../lib/api'

const fmtK = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${(v / 1_000).toFixed(0)}K`

const LABEL_MAP: Record<string, string> = {
  'supply-chain-api-prod':  'supply-chain-api',
  'maestro-platform-prod':  'maestro-plat-prod',
  'devops-tooling':          'devops-tooling',
  'customer-portal-prod':    'customer-portal',
  'ml-inference-prod':       'ml-inference ⚠',
  'ml-training-prod':        'ml-training',
  'data-analytics-prod':     'data-analytics',
  'maestro-platform-dev':    'maestro-plat-dev',
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-slate-200 font-semibold mb-2">{d.project}</p>
      <p className="text-slate-400">CUD Coverage: <span className="text-red-400 font-bold">{d.cudCoverage}%</span></p>
      <p className="text-slate-400">Compute Spend: <span className="text-white font-mono">{fmtK(d.computeCost)}</span></p>
      <div className="border-t border-slate-700 mt-2 pt-2 space-y-1">
        <p className="text-emerald-400">1-yr CUD savings: <span className="font-mono font-semibold">{fmtK(d.potential1yr)}</span></p>
        <p className="text-emerald-300">3-yr CUD savings: <span className="font-mono font-semibold">{fmtK(d.potential3yr)}</span></p>
      </div>
    </div>
  )
}

interface Props {
  data:    CUDCoverageRow[]
  summary: CUDSummary
}

export default function CUDCoverage({ data, summary }: Props) {
  const sorted = [...data].sort((a, b) => b.computeCost - a.computeCost)
  const allZero = sorted.every(d => d.cudCredits === 0)

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">CUD Coverage by Project</h2>
          <p className="text-xs text-slate-500 mt-0.5">Compute Engine spend by project · CUD savings opportunity</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-red-400 font-semibold">{allZero ? '0% coverage' : 'Partial coverage'}</p>
          <p className="text-xs text-slate-500">all projects</p>
        </div>
      </div>

      <div className="bg-amber-950/40 border border-amber-700/40 rounded-lg px-3 py-2 mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-amber-300 font-semibold">Savings Opportunity</p>
          <p className="text-xs text-amber-400/70 mt-0.5">
            1-yr CUD (20%): <span className="text-amber-300 font-mono">{fmtK(summary.potential1yrAnnual)}/yr</span>
            &nbsp;&nbsp;·&nbsp;&nbsp;
            3-yr CUD (37%): <span className="text-amber-300 font-mono">{fmtK(summary.potential3yrAnnual)}/yr</span>
          </p>
        </div>
        <span className="text-xs bg-amber-700/30 text-amber-300 px-2 py-0.5 rounded font-medium">
          {allZero ? 'No CUDs purchased' : 'Partial CUD coverage'}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 4 }} barSize={13}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis type="number" tickFormatter={fmtK} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="project"
            width={116}
            tick={({ x, y, payload }) => {
              const label = LABEL_MAP[payload.value] || payload.value
              const isML = payload.value === 'ml-inference-prod'
              return (
                <text x={x} y={y} dy={4} textAnchor="end" fontSize={10}
                  fill={isML ? '#fbbf24' : '#94a3b8'}>
                  {label}
                </text>
              )
            }}
            axisLine={false} tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="computeCost" name="Compute Cost" radius={[0, 3, 3, 0]}>
            {sorted.map((d) => (
              <Cell
                key={d.project}
                fill={d.project === 'ml-inference-prod' ? '#f59e0b' : '#3b82f6'}
                opacity={0.75}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-slate-600 mt-2">
        Bar = Compute Engine spend. Hover for per-project CUD savings potential.
      </p>
    </div>
  )
}
