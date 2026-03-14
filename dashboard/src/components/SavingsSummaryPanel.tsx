import type { DashboardData } from '../lib/api'

const fmt = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M`
  : v >= 1_000   ? `$${(v / 1_000).toFixed(0)}K`
  : `$${v}`

interface LineItemProps {
  label:       string
  sublabel:    string
  amount:      number
  color:       'amber' | 'red' | 'orange'
  action:      string
}

function LineItem({ label, sublabel, amount, color, action }: LineItemProps) {
  const ring = color === 'amber'  ? 'border-amber-500/40  bg-amber-950/30'
             : color === 'red'    ? 'border-red-500/40    bg-red-950/30'
             :                      'border-orange-500/40 bg-orange-950/30'
  const text = color === 'amber'  ? 'text-amber-300'
             : color === 'red'    ? 'text-red-300'
             :                      'text-orange-300'
  const sub  = color === 'amber'  ? 'text-amber-400/60'
             : color === 'red'    ? 'text-red-400/60'
             :                      'text-orange-400/60'

  return (
    <div className={`border rounded-lg px-4 py-3 flex items-center justify-between gap-4 ${ring}`}>
      <div className="min-w-0">
        <p className={`text-xs font-semibold ${text}`}>{label}</p>
        <p className={`text-[11px] mt-0.5 ${sub}`}>{sublabel}</p>
        <p className={`text-[10px] mt-1 ${sub} italic`}>{action}</p>
      </div>
      <p className={`text-lg font-bold font-mono flex-shrink-0 ${text}`}>{fmt(amount)}</p>
    </div>
  )
}

interface Props {
  data: DashboardData
}

export default function SavingsSummaryPanel({ data }: Props) {
  const cudAnnual = data.cudSummary.potential1yrAnnual

  const allPurposeCost = data.databricksByTier.find(t => t.tier === 'All-Purpose Compute')?.cost ?? 0
  // Conservative: assume 50% of All-Purpose can shift to Jobs Compute (73% cheaper)
  const databricksSaving = Math.round(allPurposeCost * 0.50 * 0.73)

  // Untagged = at-risk spend (showback/chargeback can't be applied without tags)
  const untaggedAtRisk = data.kpis.untaggedSpend

  const total = cudAnnual + databricksSaving + untaggedAtRisk

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Savings &amp; Risk Summary</h2>
          <p className="text-xs text-slate-500 mt-0.5">Actionable opportunities identified across the estate</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total opportunity</p>
          <p className="text-xl font-bold font-mono text-white mt-0.5">{fmt(total)}</p>
          <p className="text-[10px] text-slate-500">annualised</p>
        </div>
      </div>

      <div className="space-y-2.5">
        <LineItem
          label="Committed Use Discounts (0% coverage)"
          sublabel={`$${(data.cudSummary.totalEligibleCompute / 1000).toFixed(0)}K eligible compute · 1-yr CUD = 20% off list`}
          amount={cudAnnual}
          color="amber"
          action="→ Purchase 1-yr CUDs for top 3 compute projects"
        />
        <LineItem
          label="Databricks All-Purpose → Jobs Compute"
          sublabel={`All-Purpose at ${data.databricksByTier.find(t => t.tier === 'All-Purpose Compute')?.pct ?? 0}% of DBU spend · Jobs Compute is 73% cheaper`}
          amount={databricksSaving}
          color="orange"
          action="→ Migrate interactive notebooks to scheduled Jobs"
        />
        <LineItem
          label="Untagged Spend (no team attribution)"
          sublabel={`${data.kpis.untaggedPct}% of total spend · chargeback impossible without team label`}
          amount={untaggedAtRisk}
          color="red"
          action="→ Enforce team + cost-center labels via org policy"
        />
      </div>

      <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-600">
        <span>CUD savings annualised · Databricks based on 50% workload migration · Untagged = at-risk spend</span>
        <span>FOCUS 1.0 · BilledCost</span>
      </div>
    </div>
  )
}
