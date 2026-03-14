import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { monthlyCostByService, SERVICES, SERVICE_COLORS } from '../data/mockData'

const fmt = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M`
  : v >= 1_000   ? `$${(v / 1_000).toFixed(0)}K`
  : `$${v}`

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0)
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs shadow-xl min-w-[200px]">
      <p className="text-slate-300 font-semibold mb-2">{label}</p>
      {[...payload].reverse().map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4 py-0.5">
          <span style={{ color: p.fill }} className="truncate max-w-[130px]">{p.dataKey}</span>
          <span className="text-slate-200 font-mono">{fmt(p.value)}</span>
        </div>
      ))}
      <div className="border-t border-slate-600 mt-2 pt-1 flex justify-between">
        <span className="text-slate-400">Total</span>
        <span className="text-white font-semibold font-mono">{fmt(total)}</span>
      </div>
    </div>
  )
}

export default function MonthlyCostByService() {
  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Monthly Cost by Service</h2>
          <p className="text-xs text-slate-500 mt-0.5">FOCUS 1.0 · ServiceName · BilledCost</p>
        </div>
        <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">
          +8% MoM growth
        </span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={monthlyCostByService} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmt} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={62} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Legend
            wrapperStyle={{ paddingTop: 12 }}
            formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v}</span>}
          />
          {SERVICES.map(svc => (
            <Bar key={svc} dataKey={svc} stackId="a" fill={SERVICE_COLORS[svc]} radius={svc === 'Other' ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
