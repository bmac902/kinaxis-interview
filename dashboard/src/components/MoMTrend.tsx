import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { momTrend } from '../data/mockData'

const fmtK = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M` : `$${(v / 1_000).toFixed(0)}K`

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const total = payload.find((p: any) => p.dataKey === 'total')?.value
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs shadow-xl min-w-[190px]">
      <p className="text-slate-200 font-semibold mb-2">{label}</p>
      <div className="flex justify-between mb-2 pb-1.5 border-b border-slate-700">
        <span className="text-slate-300 font-semibold">Total</span>
        <span className="text-white font-mono font-bold">{fmtK(total)}</span>
      </div>
      {payload.filter((p: any) => p.dataKey !== 'total').map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-3 py-0.5">
          <span style={{ color: p.stroke }}>{p.dataKey}</span>
          <span className="font-mono text-slate-200">{fmtK(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

const lines = [
  { key: 'total',      color: '#f1f5f9', strokeWidth: 2.5, dashed: false },
  { key: 'compute',    color: '#60a5fa', strokeWidth: 1.5, dashed: false },
  { key: 'storage',    color: '#a78bfa', strokeWidth: 1.5, dashed: false },
  { key: 'analytics',  color: '#fbbf24', strokeWidth: 1.5, dashed: false },
  { key: 'databricks', color: '#f87171', strokeWidth: 1.5, dashed: false },
  { key: 'ai',         color: '#34d399', strokeWidth: 1.5, dashed: false },
]

export default function MoMTrend() {
  const pct = (a: number, b: number) => `+${(((b - a) / a) * 100).toFixed(1)}%`

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5 h-full">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">MoM Cost Trend</h2>
          <p className="text-xs text-slate-500 mt-0.5">Monthly BilledCost · all projects</p>
        </div>
        <div className="flex gap-2 text-xs">
          <div className="bg-slate-800 rounded px-2 py-1 text-center">
            <p className="text-slate-400">Dec→Jan</p>
            <p className="text-emerald-400 font-semibold">{pct(momTrend[0].total, momTrend[1].total)}</p>
          </div>
          <div className="bg-slate-800 rounded px-2 py-1 text-center">
            <p className="text-slate-400">Jan→Feb</p>
            <p className="text-emerald-400 font-semibold">{pct(momTrend[1].total, momTrend[2].total)}</p>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={290}>
        <LineChart data={momTrend} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmtK} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={62} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: 8 }}
            formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v}</span>}
          />
          {lines.map(l => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              stroke={l.color}
              strokeWidth={l.strokeWidth}
              dot={{ fill: l.color, r: 4, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
