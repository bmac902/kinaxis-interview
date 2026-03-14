import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { databricksByTier, databricksByProject } from '../data/mockData'

const fmt = (v: number) => `$${(v / 1_000).toFixed(0)}K`
const TIERS = ['All-Purpose Compute', 'Jobs Compute', 'SQL Compute', 'DLT Core']
const TIER_COLORS: Record<string, string> = {
  'All-Purpose Compute': '#f87171',
  'Jobs Compute':        '#fb923c',
  'SQL Compute':         '#fbbf24',
  'DLT Core':            '#a78bfa',
}

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs shadow-xl">
      <p style={{ color: d.color }} className="font-semibold">{d.tier}</p>
      <p className="text-slate-300 mt-1 font-mono">{fmt(d.cost)} ({d.pct}%)</p>
    </div>
  )
}

const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0)
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs shadow-xl min-w-[180px]">
      <p className="text-slate-300 font-semibold mb-2 truncate">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-3 py-0.5">
          <span style={{ color: TIER_COLORS[p.dataKey] }}>{p.dataKey.replace(' Compute', '').replace(' DBUs', '')}</span>
          <span className="font-mono text-slate-200">{fmt(p.value)}</span>
        </div>
      ))}
      <div className="border-t border-slate-700 mt-1.5 pt-1.5 flex justify-between">
        <span className="text-slate-400">Total</span>
        <span className="font-mono text-white font-semibold">{fmt(total)}</span>
      </div>
    </div>
  )
}

const PROJECT_LABELS: Record<string, string> = {
  'data-analytics-prod': 'data-analytics',
  'ml-training-prod':    'ml-training',
  'devops-tooling':      'devops-tooling',
  'ml-inference-prod':   'ml-inference',
}

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct }: any) => {
  const RADIAN = Math.PI / 180
  const r = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  if (pct < 8) return null
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {pct}%
    </text>
  )
}

export default function DatabricksBreakdown() {
  const totalCost = databricksByTier.reduce((s, d) => s + d.cost, 0)

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Databricks DBU Breakdown</h2>
          <p className="text-xs text-slate-500 mt-0.5">3-month total · by workload type</p>
        </div>
        <span className="text-xs font-mono text-slate-300 bg-slate-800 px-2 py-1 rounded">
          {fmt(totalCost)} total
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Pie chart */}
        <div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={databricksByTier}
                dataKey="cost"
                nameKey="tier"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={40}
                labelLine={false}
                label={renderCustomLabel}
              >
                {databricksByTier.map((d) => (
                  <Cell key={d.tier} fill={d.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-1">
            {databricksByTier.map(d => (
              <div key={d.tier} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-slate-400">{d.tier}</span>
                </div>
                <span className="text-slate-300 font-mono">{fmt(d.cost)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stacked bar by project */}
        <div>
          <p className="text-xs text-slate-500 mb-2">by project</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={databricksByProject.map(d => ({ ...d, project: PROJECT_LABELS[d.project] || d.project }))}
              layout="vertical"
              margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
              barSize={14}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" tickFormatter={fmt} tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="project" width={92} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              {TIERS.map(tier => (
                <Bar key={tier} dataKey={tier} stackId="a" fill={TIER_COLORS[tier]}
                  radius={tier === 'DLT Core' ? [0, 3, 3, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-3 bg-red-950/30 border border-red-800/30 rounded-lg px-3 py-2">
        <p className="text-xs text-red-300">
          <span className="font-semibold">All-Purpose at 48.8%</span> of Databricks spend — consider migrating interactive workloads to Jobs Compute (73% cheaper rate).
        </p>
      </div>
    </div>
  )
}
