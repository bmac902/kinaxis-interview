import { kpis } from './data/mockData'
import MonthlyCostByService from './components/MonthlyCostByService'
import CostByProject from './components/CostByProject'
import CUDCoverage from './components/CUDCoverage'
import DatabricksBreakdown from './components/DatabricksBreakdown'
import UntaggedSpend from './components/UntaggedSpend'
import MoMTrend from './components/MoMTrend'

const fmt = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M`
  : v >= 1_000   ? `$${(v / 1_000).toFixed(0)}K`
  : `$${v}`

interface KPICardProps {
  label: string
  value: string
  sub?: string
  accent?: 'default' | 'red' | 'amber' | 'emerald'
  badge?: string
}

function KPICard({ label, value, sub, accent = 'default', badge }: KPICardProps) {
  const valueColor =
    accent === 'red'     ? 'text-red-400'
    : accent === 'amber'   ? 'text-amber-400'
    : accent === 'emerald' ? 'text-emerald-400'
    : 'text-white'

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-xl px-5 py-4 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
        {badge && (
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium
            ${accent === 'red' ? 'bg-red-950/60 text-red-400'
            : accent === 'amber' ? 'bg-amber-950/60 text-amber-400'
            : accent === 'emerald' ? 'bg-emerald-950/60 text-emerald-400'
            : 'bg-slate-800 text-slate-400'}`}>
            {badge}
          </span>
        )}
      </div>
      <p className={`text-2xl font-bold font-mono tracking-tight ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-100">GCP FinOps Dashboard</h1>
              <p className="text-xs text-slate-500">Kinaxis SaaS POC · Dec 2024 – Feb 2025</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live data · BigQuery
            </div>
            <span className="text-xs bg-blue-500/10 border border-blue-500/30 text-blue-400 px-2 py-1 rounded font-medium">
              FOCUS 1.0
            </span>
            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded">
              {kpis.projects} projects · {kpis.months} months
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-5">
        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Total Spend (3 mo)"
            value={fmt(kpis.totalSpend)}
            sub={`${kpis.projects} projects · ${kpis.dataSource}`}
          />
          <KPICard
            label="MoM Growth"
            value={`+${kpis.momGrowthPct}%`}
            sub="Consistent 8% month-over-month. Tracks ~18% ARR growth."
            accent="emerald"
            badge="on target"
          />
          <KPICard
            label="Untagged Spend"
            value={fmt(kpis.untaggedSpend)}
            sub={`${kpis.untaggedPct}% of total · no team attribution`}
            accent="red"
            badge="governance gap"
          />
          <KPICard
            label="CUD Opportunity"
            value={fmt(kpis.cudOpportunityAnnual)}
            sub="Annualised 1-yr CUD savings (20%). No CUDs purchased today."
            accent="amber"
            badge="0% coverage"
          />
        </div>

        {/* Full-width: Monthly cost by service */}
        <MonthlyCostByService />

        {/* Row: Cost by project + MoM Trend */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <CostByProject />
          <MoMTrend />
        </div>

        {/* Row: CUD Coverage + Databricks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <CUDCoverage />
          <DatabricksBreakdown />
        </div>

        {/* Full-width: Untagged spend */}
        <UntaggedSpend />

        {/* Footer */}
        <div className="border-t border-slate-800 pt-4 flex items-center justify-between text-xs text-slate-600">
          <span>Data source: <code className="text-slate-500">gcp_finops_poc.focus_v1</code> · FOCUS 1.0 schema · JSON pre-baked for demo</span>
          <span>Kinaxis FinOps POC · {new Date().toLocaleDateString('en-CA')}</span>
        </div>
      </div>
    </div>
  )
}
