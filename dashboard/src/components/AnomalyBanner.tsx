import type { MonthlyCostRow } from '../lib/api'

const SERVICES = ['Compute Engine', 'Kubernetes Engine', 'Cloud Storage', 'BigQuery',
                  'Databricks', 'Vertex AI', 'Cloud SQL', 'Networking', 'Other']

const fmt = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M` : `$${(v / 1_000).toFixed(0)}K`

interface Anomaly {
  service:  string
  prevCost: number
  lastCost: number
  pctChg:   number
  delta:    number
}

interface Props {
  data:      MonthlyCostRow[]
  threshold?: number   // default 15%
}

export default function AnomalyBanner({ data, threshold = 15 }: Props) {
  if (data.length < 2) return null

  const prev = data[data.length - 2]
  const last = data[data.length - 1]

  const anomalies: Anomaly[] = SERVICES
    .map(svc => {
      const prevCost = (prev[svc] as number) || 0
      const lastCost = (last[svc] as number) || 0
      if (prevCost === 0) return null
      const pctChg = (lastCost - prevCost) / prevCost * 100
      if (Math.abs(pctChg) < threshold) return null
      return { service: svc, prevCost, lastCost, pctChg, delta: lastCost - prevCost }
    })
    .filter((a): a is Anomaly => a !== null)
    .sort((a, b) => Math.abs(b.pctChg) - Math.abs(a.pctChg))

  if (anomalies.length === 0) return null

  const prevLabel = String(prev.month)
  const lastLabel = String(last.month)

  return (
    <div className="space-y-2">
      {anomalies.map(a => {
        const isSpike = a.pctChg > 0
        return (
          <div
            key={a.service}
            className={`flex items-start gap-3 rounded-xl px-4 py-3 border text-xs
              ${isSpike
                ? 'bg-red-950/30 border-red-700/40'
                : 'bg-emerald-950/30 border-emerald-700/40'}`}
          >
            <span className="text-base leading-none mt-0.5">{isSpike ? '⚠' : '↓'}</span>
            <div className="flex-1 min-w-0">
              <span className={`font-semibold ${isSpike ? 'text-red-300' : 'text-emerald-300'}`}>
                {a.service}
              </span>
              <span className={`ml-2 ${isSpike ? 'text-red-400' : 'text-emerald-400'}`}>
                {isSpike ? '+' : ''}{a.pctChg.toFixed(1)}% MoM
              </span>
              <span className="ml-2 text-slate-400">
                {prevLabel} {fmt(a.prevCost)} → {lastLabel} {fmt(a.lastCost)}
                <span className={`ml-1 font-mono ${isSpike ? 'text-red-400' : 'text-emerald-400'}`}>
                  ({isSpike ? '+' : ''}{fmt(a.delta)})
                </span>
              </span>
            </div>
            <span className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded font-medium
              ${isSpike
                ? 'bg-red-900/50 text-red-300'
                : 'bg-emerald-900/50 text-emerald-300'}`}>
              {isSpike ? 'investigate' : 'reduction'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
