import { useQuery } from '@tanstack/react-query'
import { fetchDatabricksUsage } from '../lib/api'
import type { DatabricksUsageData } from '../lib/api'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Sector,
} from 'recharts'
import { useState } from 'react'

// ── Constants ─────────────────────────────────────────────────────────────────
const PRODUCT_COLORS: Record<string, string> = {
  INTERACTIVE:              '#3b82f6',
  SQL:                      '#f59e0b',
  PREDICTIVE_OPTIMIZATION:  '#10b981',
  AI_GATEWAY:               '#8b5cf6',
  OTHER:                    '#64748b',
}

const PRODUCT_LABELS: Record<string, string> = {
  INTERACTIVE:             'Interactive (Notebooks)',
  SQL:                     'SQL Warehouse',
  PREDICTIVE_OPTIMIZATION: 'Predictive Optimisation',
  AI_GATEWAY:              'AI Gateway',
}

function productLabel(p: string) { return PRODUCT_LABELS[p] ?? p }
function productColor(p: string) { return PRODUCT_COLORS[p] ?? PRODUCT_COLORS.OTHER }

const fmt$ = (v: number) =>
  v >= 1000 ? `$${v.toFixed(0)}` : `$${v.toFixed(2)}`

// ── Active Pie Shape ──────────────────────────────────────────────────────────
function renderActiveShape(props: Record<string, unknown>) {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle,
    fill, payload, percent, value,
  } = props as {
    cx: number; cy: number; innerRadius: number; outerRadius: number
    startAngle: number; endAngle: number; fill: string
    payload: { name: string }; percent: number; value: number
  }
  return (
    <g>
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#f1f5f9" className="text-xs font-medium" fontSize={12}>
        {productLabel(payload.name)}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#94a3b8" fontSize={11}>
        {value.toFixed(2)} DBU
      </text>
      <text x={cx} y={cy + 26} textAnchor="middle" fill="#94a3b8" fontSize={11}>
        {(percent * 100).toFixed(1)}%
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={(outerRadius as number) + 4}
        outerRadius={(outerRadius as number) + 8}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-xl px-5 py-4 flex flex-col gap-1">
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold font-mono tracking-tight text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

// ── Main Tab ─────────────────────────────────────────────────────────────────
export default function DatabricksLiveTab() {
  const [activeIndex, setActiveIndex] = useState(0)

  const { data, isLoading, isError, error } = useQuery<DatabricksUsageData>({
    queryKey: ['databricks-usage'],
    queryFn:  fetchDatabricksUsage,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  if (isLoading) {
    return (
      <div className="space-y-5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse bg-slate-800 rounded-xl h-32" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="bg-red-950/40 border border-red-700/40 rounded-xl px-4 py-3 text-sm text-red-300">
        Could not load Databricks usage data.{' '}
        <code className="text-xs text-red-400">{(error as Error)?.message}</code>
      </div>
    )
  }

  if (!data) return null

  const { totals, byDate, rows } = data

  // Timeline chart data
  const allProducts = Array.from(new Set(rows.map(r => r.product)))
  const timelineData = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, products]) => ({
      date: date.slice(5),   // 'MM-DD' or 'YYYY-MM-DD' → strip year for readability
      ...Object.fromEntries(allProducts.map(p => [p, +(products[p] ?? 0).toFixed(4)])),
    }))

  // Donut data
  const donutData = Object.entries(totals.byProduct).map(([name, value]) => ({
    name,
    value: Math.round(value * 10000) / 10000,
  }))

  // SKU table — aggregate across dates
  const skuMap: Record<string, { product: string; dbus: number; cost: number }> = {}
  for (const r of rows) {
    if (!skuMap[r.sku_name]) skuMap[r.sku_name] = { product: r.product, dbus: 0, cost: 0 }
    skuMap[r.sku_name].dbus += parseFloat(r.dbus) || 0
    skuMap[r.sku_name].cost += parseFloat(r.est_cost) || 0
  }
  const skuRows = Object.entries(skuMap)
    .map(([sku, v]) => ({ sku, ...v }))
    .sort((a, b) => b.dbus - a.dbus)

  const interactiveDbus = totals.byProduct['INTERACTIVE'] ?? 0
  const sqlDbus         = totals.byProduct['SQL'] ?? 0

  return (
    <div className="space-y-5">

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Total DBUs" value={totals.dbus.toFixed(2)} sub="All products" />
        <KPI label="Est. Cost"  value={fmt$(totals.cost)}      sub="From list_prices" />
        <KPI label="Interactive DBUs" value={interactiveDbus.toFixed(2)} sub="Notebook / cluster" />
        <KPI label="SQL DBUs"         value={sqlDbus.toFixed(2)}         sub="SQL Warehouse" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Stacked bar by day */}
        <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5">
          <p className="text-sm font-semibold text-slate-100 mb-0.5">DBU Usage by Day</p>
          <p className="text-xs text-slate-500 mb-4">system.billing.usage · usage_quantity by product</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={timelineData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => v.toFixed(1)} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                formatter={(v: unknown, name: string) => [`${(v as number).toFixed(4)} DBU`, productLabel(name)]}
              />
              <Legend formatter={productLabel} wrapperStyle={{ fontSize: 11 }} />
              {allProducts.map(p => (
                <Bar key={p} dataKey={p} stackId="a" fill={productColor(p)} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donut by product */}
        <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5">
          <p className="text-sm font-semibold text-slate-100 mb-0.5">DBU Split by Product</p>
          <p className="text-xs text-slate-500 mb-4">billing_origin_product · all dates</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                activeIndex={activeIndex}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              activeShape={renderActiveShape as any}
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="value"
                onMouseEnter={(_, index) => setActiveIndex(index)}
              >
                {donutData.map((entry) => (
                  <Cell key={entry.name} fill={productColor(entry.name)} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SKU Detail Table */}
      <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5">
        <p className="text-sm font-semibold text-slate-100 mb-0.5">SKU Detail</p>
        <p className="text-xs text-slate-500 mb-4">sku_name · total DBUs · estimated cost from list_prices</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700/60 text-slate-500 uppercase text-left">
              <th className="pb-2 font-medium tracking-wide">SKU</th>
              <th className="pb-2 font-medium tracking-wide">Product</th>
              <th className="pb-2 font-medium tracking-wide text-right">DBUs</th>
              <th className="pb-2 font-medium tracking-wide text-right">Est. Cost</th>
            </tr>
          </thead>
          <tbody>
            {skuRows.map(r => (
              <tr key={r.sku} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="py-2 pr-4 text-slate-300 font-mono text-[11px]">{r.sku}</td>
                <td className="py-2 pr-4">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                    style={{ background: productColor(r.product) + '22', color: productColor(r.product) }}>
                    {productLabel(r.product)}
                  </span>
                </td>
                <td className="py-2 text-right font-mono text-slate-300">{r.dbus.toFixed(4)}</td>
                <td className="py-2 text-right font-mono text-emerald-400">{fmt$(r.cost)}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-700 font-semibold">
              <td className="pt-2 text-slate-300" colSpan={2}>Total</td>
              <td className="pt-2 text-right font-mono text-slate-200">{totals.dbus.toFixed(4)}</td>
              <td className="pt-2 text-right font-mono text-emerald-400">{fmt$(totals.cost)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <p className="text-xs text-slate-600 text-center pb-2">
        Live · <code className="text-slate-500">system.billing.usage</code> · Databricks Free Tier ·{' '}
        Priced from <code className="text-slate-500">system.billing.list_prices</code>
      </p>
    </div>
  )
}
