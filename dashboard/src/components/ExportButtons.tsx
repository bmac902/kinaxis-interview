import type { DashboardData } from '../lib/api'

interface Props {
  data: DashboardData
  dateRange: string
}

// ── CSV export ────────────────────────────────────────────────────────────────
function buildCsv(data: DashboardData): string {
  const rows: string[] = []

  // KPIs
  rows.push('## KPIs')
  rows.push('Metric,Value')
  rows.push(`Total Spend,${data.kpis.totalSpend}`)
  rows.push(`MoM Growth %,${data.kpis.momGrowthPct}`)
  rows.push(`Untagged Spend,${data.kpis.untaggedSpend}`)
  rows.push(`Untagged %,${data.kpis.untaggedPct}`)
  rows.push(`CUD Opportunity (Annual),${data.kpis.cudOpportunityAnnual}`)
  rows.push(`Projects,${data.kpis.projects}`)
  rows.push(`Months,${data.kpis.months}`)
  rows.push('')

  // Monthly cost by service
  rows.push('## Monthly Cost by Service')
  const services = ['Compute Engine', 'Kubernetes Engine', 'Cloud Storage', 'BigQuery', 'Databricks', 'Vertex AI', 'Cloud SQL', 'Networking', 'Other']
  rows.push(['Month', ...services].join(','))
  for (const m of data.monthlyCostByService) {
    rows.push([m.month, ...services.map(s => m[s] ?? 0)].join(','))
  }
  rows.push('')

  // Cost by project
  rows.push('## Cost by Project')
  rows.push('Project,Team,BilledCost,Tagged')
  for (const p of data.costByProject) {
    rows.push(`${p.project},${p.team},${p.cost},${p.tagged}`)
  }
  rows.push('')

  // CUD coverage
  rows.push('## CUD Coverage')
  rows.push('Project,ComputeCost,CUDCoverage%,Potential1yr,Potential3yr')
  for (const c of data.cudCoverage) {
    rows.push(`${c.project},${c.computeCost},${c.cudCoverage},${c.potential1yr},${c.potential3yr}`)
  }
  rows.push('')

  // Databricks
  rows.push('## Databricks by Tier')
  rows.push('Tier,Cost,Pct%')
  for (const t of data.databricksByTier) {
    rows.push(`${t.tier},${t.cost},${t.pct}`)
  }
  rows.push('')

  // Untagged
  rows.push('## Untagged Spend by Project')
  rows.push('Project,UntaggedCost,TotalCost,UntaggedPct%')
  for (const u of data.untaggedSpend) {
    rows.push(`${u.project},${u.untagged},${u.total},${u.pct}`)
  }

  return rows.join('\n')
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ExportButtons({ data, dateRange }: Props) {
  const handleCsv = () => {
    const csv  = buildCsv(data)
    const slug = dateRange.replace(/\s+/g, '_').replace(/[^a-z0-9_]/gi, '')
    downloadCsv(csv, `gcp_finops_${slug}.csv`)
  }

  const handlePdf = () => {
    window.print()
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCsv}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-700 transition-colors"
        title="Export dashboard data as CSV"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
        CSV
      </button>
      <button
        onClick={handlePdf}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-700 transition-colors"
        title="Print / Save as PDF"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        PDF
      </button>
    </div>
  )
}
