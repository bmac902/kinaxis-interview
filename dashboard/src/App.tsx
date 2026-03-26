import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSummary, fetchMonths } from './lib/api'
import type { DashboardData, MonthOption } from './lib/api'
import MonthlyCostByService from './components/MonthlyCostByService'
import CostByProject from './components/CostByProject'
import CUDCoverage from './components/CUDCoverage'
import DatabricksBreakdown from './components/DatabricksBreakdown'
import UntaggedSpend from './components/UntaggedSpend'
import MoMTrend from './components/MoMTrend'
import DrillDownModal from './components/DrillDownModal'
import ExportButtons from './components/ExportButtons'
import SavingsSummaryPanel from './components/SavingsSummaryPanel'
import ChargebackTable from './components/ChargebackTable'
import AnomalyBanner from './components/AnomalyBanner'
import DatabricksLiveTab from './components/DatabricksLiveTab'

const fmt = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M`
  : v >= 1_000   ? `$${(v / 1_000).toFixed(0)}K`
  : `$${v}`

// ── KPI Card ──────────────────────────────────────────────────────────────────
interface KPICardProps {
  label:  string
  value:  string
  sub?:   string
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
            ${accent === 'red'     ? 'bg-red-950/60 text-red-400'
            : accent === 'amber'   ? 'bg-amber-950/60 text-amber-400'
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

// ── Date Range Picker ─────────────────────────────────────────────────────────
interface DateRangePickerProps {
  months:     MonthOption[]
  startMonth: string
  endMonth:   string
  onChange:   (start: string, end: string) => void
}

function DateRangePicker({ months, startMonth, endMonth, onChange }: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-slate-500">From</span>
      <select
        value={startMonth}
        onChange={e => onChange(e.target.value, endMonth)}
        className="bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
      >
        {months.map(m => (
          <option key={m.value} value={m.value} disabled={m.value > endMonth}>{m.label}</option>
        ))}
      </select>
      <span className="text-slate-500">to</span>
      <select
        value={endMonth}
        onChange={e => onChange(startMonth, e.target.value)}
        className="bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
      >
        {months.map(m => (
          <option key={m.value} value={m.value} disabled={m.value < startMonth}>{m.label}</option>
        ))}
      </select>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-800 rounded-xl ${className}`} />
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab,    setActiveTab]    = useState<'gcp' | 'databricks'>('gcp')
  const [startMonth, setStartMonth] = useState('2024-12')
  const [endMonth,   setEndMonth]   = useState('2025-02')
  const [drillProject, setDrillProject] = useState<string | null>(null)

  const handleDateChange = (start: string, end: string) => {
    if (start <= end) { setStartMonth(start); setEndMonth(end) }
  }

  // Fetch available months (for picker)
  const { data: months = [] } = useQuery<MonthOption[]>({
    queryKey: ['months'],
    queryFn:  fetchMonths,
    staleTime: Infinity,
  })

  // Fetch dashboard summary
  const { data, isLoading, isError, error } = useQuery<DashboardData>({
    queryKey: ['summary', startMonth, endMonth],
    queryFn:  () => fetchSummary(startMonth, endMonth),
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const dateRangeLabel = months.length
    ? `${months.find(m => m.value === startMonth)?.label ?? startMonth} – ${months.find(m => m.value === endMonth)?.label ?? endMonth}`
    : `${startMonth} – ${endMonth}`

  const isLive = data?.kpis.dataSource.startsWith('BigQuery —') && !data.kpis.dataSource.includes('mock')

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4 print:hidden">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-100">GCP FinOps Dashboard</h1>
              <p className="text-xs text-slate-500">Kinaxis SaaS POC · FOCUS 1.0</p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex items-center gap-1 bg-slate-800/60 border border-slate-700/50 rounded-lg p-0.5">
            {(['gcp', 'databricks'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab === 'gcp' ? 'GCP Dashboard' : 'Databricks Live'}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {months.length > 0 && (
              <DateRangePicker
                months={months}
                startMonth={startMonth}
                endMonth={endMonth}
                onChange={handleDateChange}
              />
            )}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
              <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {isLive ? 'Live · BigQuery' : 'Demo data'}
            </div>
            <span className="text-xs bg-blue-500/10 border border-blue-500/30 text-blue-400 px-2 py-1 rounded font-medium">
              FOCUS 1.0
            </span>
            {data && <ExportButtons data={data} dateRange={dateRangeLabel} />}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-5">
        {/* Databricks tab */}
        {activeTab === 'databricks' && <DatabricksLiveTab />}

        {/* GCP tab content below — hidden when Databricks is active */}
        {activeTab === 'gcp' && <div className="space-y-5">

        {/* Error banner */}
        {isError && (
          <div className="bg-red-950/40 border border-red-700/40 rounded-xl px-4 py-3 text-sm text-red-300">
            Failed to load dashboard data. Is the server running?{' '}
            <code className="text-xs text-red-400">{(error as Error)?.message}</code>
          </div>
        )}

        {/* KPI Row */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label={`Total Spend (${data.kpis.months} mo)`}
              value={fmt(data.kpis.totalSpend)}
              sub={`${data.kpis.projects} projects · ${data.kpis.dataSource}`}
            />
            <KPICard
              label="MoM Growth"
              value={`${data.kpis.momGrowthPct >= 0 ? '+' : ''}${data.kpis.momGrowthPct}%`}
              sub="Month-over-month. Tracks ~18% ARR growth."
              accent="emerald"
              badge="on target"
            />
            <KPICard
              label="Untagged Spend"
              value={fmt(data.kpis.untaggedSpend)}
              sub={`${data.kpis.untaggedPct}% of total · no team attribution`}
              accent="red"
              badge="governance gap"
            />
            <KPICard
              label="CUD Opportunity"
              value={fmt(data.kpis.cudOpportunityAnnual)}
              sub="Annualised 1-yr CUD savings (20%). No CUDs purchased today."
              accent="amber"
              badge="0% coverage"
            />
          </div>
        ) : null}

        {/* Charts */}
        {isLoading ? (
          <>
            <Skeleton className="h-80" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Skeleton className="h-80" />
              <Skeleton className="h-80" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Skeleton className="h-72" />
              <Skeleton className="h-72" />
            </div>
            <Skeleton className="h-72" />
          </>
        ) : data ? (
          <>
            <AnomalyBanner data={data.monthlyCostByService} />

            <MonthlyCostByService data={data.monthlyCostByService} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <CostByProject
                data={data.costByProject}
                onProjectClick={setDrillProject}
              />
              <MoMTrend data={data.momTrend} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <CUDCoverage data={data.cudCoverage} summary={data.cudSummary} />
              <DatabricksBreakdown tiers={data.databricksByTier} byProject={data.databricksByProject} />
            </div>

            <UntaggedSpend data={data.untaggedSpend} />

            <SavingsSummaryPanel data={data} />

            <ChargebackTable startMonth={startMonth} endMonth={endMonth} />
          </>
        ) : null}

        {/* Footer */}
        <div className="border-t border-slate-800 pt-4 flex items-center justify-between text-xs text-slate-600 print:hidden">
          <span>
            Data source: <code className="text-slate-500">gcp_finops_poc.focus_v1</code> · FOCUS 1.0 schema
            {data && ` · ${dateRangeLabel}`}
          </span>
          <span>Kinaxis FinOps POC · {new Date().toLocaleDateString('en-CA')}</span>
        </div>
      </div>}
      </div>

      {/* Drill-down modal — outside tab wrapper so it can unmount cleanly */}
      <DrillDownModal
        project={drillProject}
        startMonth={startMonth}
        endMonth={endMonth}
        onClose={() => setDrillProject(null)}
      />
    </div>
  )
}
