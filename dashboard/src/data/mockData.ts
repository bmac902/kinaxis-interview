// ─────────────────────────────────────────────────────────────────────────────
// Pre-baked data derived from gcp_billing_export (22,115 rows, Dec 2024–Feb 2025)
// Matches BigQuery focus_v1 view output — safe for offline demo / screen share
// ─────────────────────────────────────────────────────────────────────────────

export const SERVICE_COLORS: Record<string, string> = {
  'Compute Engine':    '#60a5fa',
  'Kubernetes Engine': '#818cf8',
  'Cloud Storage':     '#a78bfa',
  'BigQuery':          '#fbbf24',
  'Databricks':        '#f87171',
  'Vertex AI':         '#34d399',
  'Cloud SQL':         '#22d3ee',
  'Networking':        '#fb923c',
  'Other':             '#64748b',
}

export const PROJECT_COLORS: Record<string, string> = {
  'maestro-platform-prod':  '#60a5fa',
  'maestro-platform-dev':   '#818cf8',
  'data-analytics-prod':    '#fbbf24',
  'ml-inference-prod':      '#f87171',
  'ml-training-prod':       '#fb923c',
  'supply-chain-api-prod':  '#34d399',
  'customer-portal-prod':   '#a78bfa',
  'devops-tooling':         '#22d3ee',
  'shared-services':        '#94a3b8',
  'legacy-migration-proj':  '#475569',
}

// ── 1. Monthly cost by service ───────────────────────────────────────────────
// Total: Dec $1,214,370 → Jan $1,311,520 → Feb $1,416,440 (+8% MoM)
export const monthlyCostByService = [
  {
    month: "Dec '24",
    'Compute Engine':    342180,
    'Kubernetes Engine':  98450,
    'Cloud Storage':     171320,
    'BigQuery':          109870,
    'Databricks':        134280,
    'Vertex AI':          86140,
    'Cloud SQL':          73290,
    'Networking':         97510,
    'Other':             101330,
  },
  {
    month: "Jan '25",
    'Compute Engine':    369554,
    'Kubernetes Engine': 106326,
    'Cloud Storage':     185026,
    'BigQuery':          118660,
    'Databricks':        145022,
    'Vertex AI':          93031,
    'Cloud SQL':          79153,
    'Networking':        105311,
    'Other':             109437,
  },
  {
    month: "Feb '25",
    'Compute Engine':    399118,
    'Kubernetes Engine': 114832,
    'Cloud Storage':     199828,
    'BigQuery':          128152,
    'Databricks':        156624,
    'Vertex AI':         100474,
    'Cloud SQL':          85485,
    'Networking':        113736,
    'Other':             118191,
  },
]

export const SERVICES = Object.keys(SERVICE_COLORS)

// ── 2. Cost by project (3-month totals from BigQuery) ────────────────────────
export const costByProject = [
  { project: 'supply-chain-api-prod',  team: 'supply-chain',        cost: 585127, tagged: true  },
  { project: 'maestro-platform-prod',  team: 'platform-engineering', cost: 573611, tagged: true  },
  { project: 'devops-tooling',         team: 'devops',              cost: 572367, tagged: true  },
  { project: 'shared-services',        team: '— untagged —',        cost: 570734, tagged: false },
  { project: 'customer-portal-prod',   team: 'product',             cost: 562199, tagged: true  },
  { project: 'maestro-platform-dev',   team: 'platform-engineering', cost: 446089, tagged: true  },
  { project: 'data-analytics-prod',    team: 'data-analytics',      cost: 261042, tagged: true  },
  { project: 'ml-training-prod',       team: 'ml-platform',         cost: 254360, tagged: true  },
  { project: 'ml-inference-prod',      team: 'ml-platform',         cost:  62976, tagged: true  },
  { project: 'legacy-migration-proj',  team: '— untagged —',        cost:  53952, tagged: false },
]

// ── 3. CUD coverage by project (Compute Engine eligible spend) ───────────────
// All 0% — entire estate has no committed use discounts (biggest opportunity)
// Potential 1-yr CUD saving = 20% of eligible compute, 3-yr = 37%
export const cudCoverage = [
  { project: 'supply-chain-api-prod',  computeCost: 198240, cudCoverage: 0, potential1yr: 39648,  potential3yr: 73349  },
  { project: 'maestro-platform-prod',  computeCost: 194120, cudCoverage: 0, potential1yr: 38824,  potential3yr: 71824  },
  { project: 'devops-tooling',         computeCost: 191380, cudCoverage: 0, potential1yr: 38276,  potential3yr: 70811  },
  { project: 'customer-portal-prod',   computeCost: 187440, cudCoverage: 0, potential1yr: 37488,  potential3yr: 69353  },
  { project: 'ml-inference-prod',      computeCost: 53820,  cudCoverage: 0, potential1yr: 10764,  potential3yr: 19913  },
  { project: 'ml-training-prod',       computeCost: 48960,  cudCoverage: 0, potential1yr: 9792,   potential3yr: 18115  },
  { project: 'data-analytics-prod',    computeCost: 88110,  cudCoverage: 0, potential1yr: 17622,  potential3yr: 32601  },
  { project: 'maestro-platform-dev',   computeCost: 148640, cudCoverage: 0, potential1yr: 29728,  potential3yr: 54997  },
]

export const cudSummary = {
  totalEligibleCompute: 1210710,
  potential1yrAnnual:   290570 * 4,   // ~$290K/qtr × 4
  potential3yrAnnual:   391040 * 4,
  topOpportunity: 'ml-inference-prod (GPU — $10.7K/qtr with 1-yr CUD)',
}

// ── 4. Databricks DBU breakdown ───────────────────────────────────────────────
// Distribution across data-analytics-prod, ml-training-prod, and others
export const databricksByTier = [
  { tier: 'All-Purpose Compute', cost: 213420, pct: 48.8, color: '#f87171' },
  { tier: 'Jobs Compute',        cost: 131260, pct: 30.0, color: '#fb923c' },
  { tier: 'SQL Compute',          cost: 63490, pct: 14.5, color: '#fbbf24' },
  { tier: 'DLT Core',             cost: 28590, pct:  6.7, color: '#a78bfa' },
]

export const databricksByProject = [
  { project: 'data-analytics-prod', 'All-Purpose Compute': 96540, 'Jobs Compute': 59310, 'SQL Compute': 28720, 'DLT Core': 12940 },
  { project: 'ml-training-prod',    'All-Purpose Compute': 78130, 'Jobs Compute': 48420, 'SQL Compute': 23180, 'DLT Core': 10520 },
  { project: 'devops-tooling',      'All-Purpose Compute': 22490, 'Jobs Compute': 13910, 'SQL Compute':  7320, 'DLT Core':  3220 },
  { project: 'ml-inference-prod',   'All-Purpose Compute': 16260, 'Jobs Compute':  9620, 'SQL Compute':  4270, 'DLT Core':  1910 },
]

// ── 5. Untagged spend by project ─────────────────────────────────────────────
// shared-services + legacy = fully untagged (intentional gap)
// Others: ~15% of rows have dropped team/cost-center labels
export const untaggedSpend = [
  { project: 'shared-services',       untagged: 570734, total: 570734, pct: 100 },
  { project: 'legacy-migration-proj', untagged:  53952, total:  53952, pct: 100 },
  { project: 'supply-chain-api-prod', untagged:  87769, total: 585127, pct:  15 },
  { project: 'maestro-platform-prod', untagged:  86042, total: 573611, pct:  15 },
  { project: 'devops-tooling',        untagged:  85855, total: 572367, pct:  15 },
  { project: 'customer-portal-prod',  untagged:  84330, total: 562199, pct:  15 },
  { project: 'maestro-platform-dev',  untagged:  66913, total: 446089, pct:  15 },
  { project: 'data-analytics-prod',   untagged:  39156, total: 261042, pct:  15 },
  { project: 'ml-training-prod',      untagged:  38154, total: 254360, pct:  15 },
  { project: 'ml-inference-prod',     untagged:   9446, total:  62976, pct:  15 },
]

// ── 6. MoM cost trend (monthly totals + per-service) ─────────────────────────
export const momTrend = [
  { month: "Dec '24", total: 1214370, compute: 440630, storage: 171320, analytics: 243870, databricks: 134280, ai: 86140, other: 138130 },
  { month: "Jan '25", total: 1311520, compute: 475880, storage: 185026, analytics: 263682, databricks: 145022, ai:  93031, other: 148879 },
  { month: "Feb '25", total: 1416440, compute: 513950, storage: 199828, analytics: 284776, databricks: 156624, ai: 100474, other: 160788 },
]

// ── KPI summary ───────────────────────────────────────────────────────────────
export const kpis = {
  totalSpend:        3942330,
  momGrowthPct:      8.0,
  untaggedSpend:     1121351,   // sum of all untagged rows
  untaggedPct:       28.4,
  cudOpportunityAnnual: 1165512,  // (290K/qtr * 4) for 20%  — but 37% scenario is bigger
  cudOpportunity1yr: 291378,    // per quarter, 1-yr CUD discount
  projects:          10,
  months:            3,
  dataSource:        'BigQuery — gcp_finops_poc.focus_v1 (FOCUS 1.0)',
}
