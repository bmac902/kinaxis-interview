import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import type { ProjectCostRow } from '../lib/api'

const fmt = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M`
  : `$${(v / 1_000).toFixed(0)}K`

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-slate-200 font-semibold mb-1">{d.project}</p>
      <p className="text-slate-400">Team: <span className={d.tagged ? 'text-slate-300' : 'text-red-400'}>{d.team}</span></p>
      <p className="text-slate-400 mt-1">Total: <span className="text-white font-mono font-semibold">{fmt(d.cost)}</span></p>
      {!d.tagged && <p className="text-red-400 mt-1 font-medium">⚠ Untagged — no team attribution</p>}
      <p className="text-blue-400 mt-1.5 text-[10px]">Click to drill down →</p>
    </div>
  )
}

const LABEL_MAP: Record<string, string> = {
  'supply-chain-api-prod': 'supply-chain-api',
  'maestro-platform-prod': 'maestro-plat-prod',
  'devops-tooling':         'devops-tooling',
  'shared-services':        'shared-services',
  'customer-portal-prod':   'customer-portal',
  'maestro-platform-dev':   'maestro-plat-dev',
  'data-analytics-prod':    'data-analytics',
  'ml-training-prod':       'ml-training',
  'ml-inference-prod':      'ml-inference',
  'legacy-migration-proj':  'legacy-migration',
}

interface Props {
  data: ProjectCostRow[]
  onProjectClick: (project: string) => void
}

export default function CostByProject({ data, onProjectClick }: Props) {
  const sorted = [...data].sort((a, b) => b.cost - a.cost)

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5 h-full">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-100">Cost by Project</h2>
        <p className="text-xs text-slate-500 mt-0.5">Total spend · SubAccountId · BilledCost · click to drill down</p>
      </div>
      <ResponsiveContainer width="100%" height={310}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 0, right: 16, bottom: 0, left: 4 }}
          barSize={14}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis type="number" tickFormatter={fmt} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="project"
            width={118}
            tick={({ x, y, payload }) => {
              const label = LABEL_MAP[payload.value] || payload.value
              const isUntagged = !sorted.find(d => d.project === payload.value)?.tagged
              return (
                <text x={x} y={y} dy={4} textAnchor="end" fontSize={10}
                  fill={isUntagged ? '#f87171' : '#94a3b8'}>
                  {label}
                </text>
              )
            }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Bar
            dataKey="cost"
            radius={[0, 3, 3, 0]}
            style={{ cursor: 'pointer' }}
            onClick={(d) => onProjectClick(d.project)}
          >
            {sorted.map((d) => (
              <Cell
                key={d.project}
                fill={d.tagged ? '#60a5fa' : '#f87171'}
                opacity={d.tagged ? 0.85 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <div className="w-2.5 h-2.5 rounded-sm bg-blue-400" /> Tagged
        </div>
        <div className="flex items-center gap-1.5 text-xs text-red-400">
          <div className="w-2.5 h-2.5 rounded-sm bg-red-400" /> Untagged
        </div>
      </div>
    </div>
  )
}
