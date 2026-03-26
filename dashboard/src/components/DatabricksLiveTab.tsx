import { useQuery } from '@tanstack/react-query'
import { fetchDatabricksUsage, fetchDatabricksGovernance, fetchMultiCloudOverview } from '../lib/api'
import type { DatabricksUsageData, GovernanceData, MultiCloudData } from '../lib/api'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Sector,
  LineChart, Line, ReferenceLine,
} from 'recharts'
import { useState } from 'react'

// ── Classification rules ──────────────────────────────────────────────────────
const CLASSIFICATION: Record<string, { category: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; note: string }> = {
  INTERACTIVE:             { category: 'Interactive / Notebook', confidence: 'HIGH',   note: 'User identity present' },
  SQL:                     { category: 'SQL Analytics',          confidence: 'MEDIUM', note: 'Warehouse known, no user' },
  PREDICTIVE_OPTIMIZATION: { category: 'System / Automated',     confidence: 'HIGH',   note: 'System-managed, tagged' },
  AI_GATEWAY:              { category: 'AI / Inference',         confidence: 'LOW',    note: 'Minimal metadata' },
}

function classify(product: string) {
  return CLASSIFICATION[product] ?? { category: 'Unknown', confidence: 'LOW' as const, note: 'No mapping' }
}

const CONFIDENCE_STYLE: Record<string, string> = {
  HIGH:   'bg-emerald-950/60 text-emerald-400',
  MEDIUM: 'bg-amber-950/60 text-amber-400',
  LOW:    'bg-red-950/60 text-red-400',
}

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

// ── GCP service colour palette (blues/teals — distinct from Databricks ambers) ─
const GCP_COLORS = ['#60a5fa','#34d399','#a78bfa','#f472b6','#38bdf8','#fb923c','#94a3b8']
function gcpColor(i: number) { return GCP_COLORS[i % GCP_COLORS.length] }

// ── Multi-Cloud Overview panel ────────────────────────────────────────────────
function MultiCloudOverview({ data }: { data: MultiCloudData }) {
  const grandTotal = data.gcp.total + data.databricks.total
  const gcpPct = grandTotal > 0 ? (data.gcp.total / grandTotal) * 100 : 0
  const dbxPct = 100 - gcpPct

  const fmtK = (v: number) =>
    v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M`
    : v >= 1_000   ? `$${(v / 1_000).toFixed(1)}K`
    : `$${v.toFixed(2)}`

  // Combined monthly chart — merge GCP + Databricks months
  const allMonths = Array.from(new Set([
    ...data.gcp.byMonth.map(r => r.month),
    ...data.databricks.byMonth.map(r => r.month),
  ])).sort()

  const gcpIdx   = Object.fromEntries(data.gcp.byMonth.map(r => [r.month, r]))
  const dbxIdx   = Object.fromEntries(data.databricks.byMonth.map(r => [r.month, r]))

  const chartData = allMonths.map(month => {
    const gcpRow = gcpIdx[month] ?? {}
    const dbxRow = dbxIdx[month] ?? {}
    const entry: Record<string, string | number> = { month: month.slice(0, 7) }
    for (const s of data.gcp.services) entry[`gcp_${s}`] = (gcpRow[s] as number) ?? 0
    for (const p of data.databricks.products) entry[`dbx_${p}`] = (dbxRow[p] as number) ?? 0
    return entry
  })

  const providers = [
    { label: 'GCP',         total: data.gcp.total,        pct: gcpPct,  color: '#60a5fa', note: 'Synthetic export · workspace.default.gcp_billing_export' },
    { label: 'Databricks',  total: data.databricks.total, pct: dbxPct,  color: '#f59e0b', note: 'Live · system.billing.usage' },
  ]

  return (
    <div className="bg-slate-900 border border-blue-500/20 rounded-xl p-5 space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-slate-100">Multi-Cloud Overview</p>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 font-medium">
            Unity Catalog
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Both providers queried from one Databricks SQL warehouse ·{' '}
          <code className="text-slate-400">workspace.default</code> + <code className="text-slate-400">system.billing.usage</code>
        </p>
      </div>

      {/* Grand total + provider bars */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Total card */}
        <div className="bg-slate-800/50 rounded-lg px-4 py-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Cloud Spend</p>
          <p className="text-2xl font-bold font-mono text-white">{fmtK(grandTotal)}</p>
          <p className="text-[11px] text-slate-600 mt-0.5">All providers combined</p>
        </div>

        {/* Share-of-wallet bars */}
        <div className="lg:col-span-2 space-y-3 pt-1">
          {providers.map(p => (
            <div key={p.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium w-24">{p.label}</span>
                <div className="flex-1 mx-3 h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${p.pct.toFixed(1)}%`, background: p.color }}
                  />
                </div>
                <span className="font-mono text-slate-200 w-16 text-right">{fmtK(p.total)}</span>
                <span className="text-slate-500 w-10 text-right">{p.pct.toFixed(1)}%</span>
              </div>
              <p className="text-[10px] text-slate-600 pl-24">{p.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Combined monthly bar chart */}
      {chartData.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Monthly Spend by Provider</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v}`} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                formatter={(v: unknown, name: string) => {
                  const label = name.startsWith('gcp_')
                    ? `GCP · ${name.slice(4)}`
                    : `DBX · ${productLabel(name.slice(4))}`
                  return [`$${(v as number).toFixed(2)}`, label]
                }}
              />
              {data.gcp.services.map((s, i) => (
                <Bar key={`gcp_${s}`} dataKey={`gcp_${s}`} stackId="a" fill={gcpColor(i)} name={`gcp_${s}`} />
              ))}
              {data.databricks.products.map(p => (
                <Bar key={`dbx_${p}`} dataKey={`dbx_${p}`} stackId="a" fill={productColor(p)} name={`dbx_${p}`} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
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

  const { data: gov } = useQuery<GovernanceData>({
    queryKey: ['databricks-governance'],
    queryFn:  fetchDatabricksGovernance,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const { data: multicloud } = useQuery<MultiCloudData>({
    queryKey: ['databricks-multicloud'],
    queryFn:  fetchMultiCloudOverview,
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

  // Unattributed cost — anonymous principal
  const anonRow        = gov?.byPrincipal.find(r => r.principal === '— anonymous —')
  const unattribCost   = anonRow?.est_cost ?? 0
  const unattribPct    = totals.cost > 0 ? Math.round((unattribCost / totals.cost) * 100) : 0

  // Policy readiness — all three thresholds must pass
  const tagThreshold   = 50
  const idThreshold    = 50
  const attrThreshold  = 50
  const tagPass   = (gov?.summary.taggedPct     ?? 0) >= tagThreshold
  const idPass    = (gov?.summary.identifiedPct  ?? 0) >= idThreshold
  const attrPass  = (gov?.summary.attributedPct  ?? 0) >= attrThreshold
  const chargebackReady = tagPass && idPass && attrPass
  const failReasons = [
    !tagPass  && `Tag coverage ${gov?.summary.taggedPct.toFixed(1)}% < ${tagThreshold}%`,
    !idPass   && `Identity coverage ${gov?.summary.identifiedPct.toFixed(1)}% < ${idThreshold}%`,
    !attrPass && `Attribution coverage ${gov?.summary.attributedPct.toFixed(1)}% < ${attrThreshold}%`,
  ].filter(Boolean) as string[]

  return (
    <div className="space-y-5">

      {/* Multi-Cloud Overview */}
      {multicloud && <MultiCloudOverview data={multicloud} />}

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPI label="Total DBUs"       value={totals.dbus.toFixed(2)} sub="All products" />
        <KPI label="Est. Cost"        value={fmt$(totals.cost)}      sub="From list_prices" />
        <KPI label="Interactive DBUs" value={interactiveDbus.toFixed(2)} sub="Notebook / cluster" />
        <KPI label="SQL DBUs"         value={sqlDbus.toFixed(2)}         sub="SQL Warehouse" />
        <div className="bg-slate-900 border border-red-700/40 rounded-xl px-5 py-4 flex flex-col gap-1">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Unattributed Cost</p>
          <p className="text-2xl font-bold font-mono tracking-tight text-red-400">{fmt$(unattribCost)}</p>
          <p className="text-xs text-slate-500">{unattribPct}% of total · no user identity</p>
        </div>
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

      {/* ── Governance Panel ──────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5 space-y-5">
        <div>
          <p className="text-sm font-semibold text-slate-100 mb-0.5">Governance &amp; Attribution</p>
          <p className="text-xs text-slate-500">Coverage metrics from identity_metadata · custom_tags · usage_metadata</p>
        </div>

        {/* Coverage KPIs */}
        {gov && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Tag Coverage',      value: gov.summary.taggedPct,     note: 'Rows with custom_tags set',           accent: gov.summary.taggedPct < 20 ? 'red' : 'emerald' },
              { label: 'Identity Coverage', value: gov.summary.identifiedPct, note: 'Rows with run_as principal',          accent: gov.summary.identifiedPct > 50 ? 'emerald' : 'amber' },
              { label: 'Attribution Coverage', value: gov.summary.attributedPct, note: 'Rows with notebook / job / warehouse', accent: gov.summary.attributedPct > 50 ? 'emerald' : 'amber' },
            ].map(({ label, value, note, accent }) => (
              <div key={label} className="bg-slate-800/50 rounded-lg px-4 py-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</p>
                <p className={`text-xl font-bold font-mono ${
                  accent === 'red' ? 'text-red-400' : accent === 'amber' ? 'text-amber-400' : 'text-emerald-400'
                }`}>{value.toFixed(1)}%</p>
                <p className="text-[11px] text-slate-600 mt-0.5">{note}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tag Coverage Trend */}
        {gov && gov.tagTrend.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Tag Coverage by Day</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={gov.tagTrend} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={d => d.slice(5)} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={v => `${v}%`} width={36} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: unknown) => [`${(v as number).toFixed(1)}%`, 'Tag Coverage']}
                  labelFormatter={l => `Date: ${l}`}
                />
                <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="4 2"
                  label={{ value: 'Threshold', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
                <Line type="monotone" dataKey="tagPct" stroke="#3b82f6" strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
            {gov.tagTrend.length > 0 && gov.tagTrend[gov.tagTrend.length - 1].tagPct >= 50 && (
              <p className="text-xs text-emerald-400 mt-1">
                ✓ Latest day above threshold — policy enforcement detected
              </p>
            )}
          </div>
        )}

        {/* Policy Readiness */}
        {gov && (
          <div className={`rounded-lg border px-4 py-3 flex items-start justify-between gap-4 ${
            chargebackReady
              ? 'bg-emerald-950/30 border-emerald-700/40'
              : 'bg-red-950/20 border-red-700/30'
          }`}>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Chargeback Readiness</p>
              <p className={`text-lg font-bold ${chargebackReady ? 'text-emerald-400' : 'text-red-400'}`}>
                {chargebackReady ? '✓ Ready' : '✗ Not Ready'}
              </p>
              {!chargebackReady && (
                <ul className="mt-1 space-y-0.5">
                  {failReasons.map(r => (
                    <li key={r} className="text-[11px] text-red-400/80">· {r}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-slate-500 mb-1">Thresholds</p>
              {[
                { label: 'Tag',         pass: tagPass,  val: gov.summary.taggedPct },
                { label: 'Identity',    pass: idPass,   val: gov.summary.identifiedPct },
                { label: 'Attribution', pass: attrPass, val: gov.summary.attributedPct },
              ].map(({ label, pass, val }) => (
                <p key={label} className="text-[11px] font-mono">
                  <span className={pass ? 'text-emerald-400' : 'text-red-400'}>{pass ? '✓' : '✗'}</span>
                  {' '}
                  <span className="text-slate-400">{label} {val.toFixed(1)}%</span>
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Classification table */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Workload Classification</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700/60 text-slate-500 uppercase text-left">
                <th className="pb-2 font-medium tracking-wide">Product</th>
                <th className="pb-2 font-medium tracking-wide">Category</th>
                <th className="pb-2 font-medium tracking-wide">Confidence</th>
                <th className="pb-2 font-medium tracking-wide text-right">DBUs</th>
                <th className="pb-2 font-medium tracking-wide text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {(gov?.byProduct ?? []).map(r => {
                const cls = classify(r.product)
                return (
                  <tr key={r.product} className="border-b border-slate-800/50">
                    <td className="py-2 pr-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                        style={{ background: productColor(r.product) + '22', color: productColor(r.product) }}>
                        {productLabel(r.product)}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-300">{cls.category}</td>
                    <td className="py-2 pr-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${CONFIDENCE_STYLE[cls.confidence]}`}>
                        {cls.confidence}
                      </span>
                      <span className="ml-2 text-slate-600 text-[10px]">{cls.note}</span>
                    </td>
                    <td className="py-2 text-right font-mono text-slate-300">{r.dbus.toFixed(2)}</td>
                    <td className="py-2 text-right font-mono text-emerald-400">{fmt$(r.est_cost)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Spend by principal */}
        {gov && gov.byPrincipal.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Spend by Principal</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/60 text-slate-500 uppercase text-left">
                  <th className="pb-2 font-medium tracking-wide">Principal</th>
                  <th className="pb-2 font-medium tracking-wide text-right">DBUs</th>
                  <th className="pb-2 font-medium tracking-wide text-right">Cost</th>
                  <th className="pb-2 font-medium tracking-wide text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {gov.byPrincipal.map(r => {
                  const isAnon = r.principal === '— anonymous —'
                  const share = gov.summary.totalRecords
                    ? Math.round((r.records / gov.summary.totalRecords) * 100)
                    : 0
                  return (
                    <tr key={r.principal} className="border-b border-slate-800/50">
                      <td className={`py-2 pr-3 font-mono text-[11px] ${isAnon ? 'text-amber-400' : 'text-slate-300'}`}>
                        {r.principal}
                        {isAnon && <span className="ml-2 text-[10px] bg-amber-950/60 text-amber-400 px-1.5 py-0.5 rounded">governance gap</span>}
                      </td>
                      <td className="py-2 text-right font-mono text-slate-300">{r.dbus.toFixed(2)}</td>
                      <td className="py-2 text-right font-mono text-emerald-400">{fmt$(r.est_cost)}</td>
                      <td className="py-2 text-right text-slate-500">{share}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-xs text-slate-600 text-center pb-2">
        Live · <code className="text-slate-500">system.billing.usage</code> · Databricks Free Tier ·{' '}
        Priced from <code className="text-slate-500">system.billing.list_prices</code> ·{' '}
        GCP from <code className="text-slate-500">workspace.default.gcp_billing_export</code>
      </p>
    </div>
  )
}
