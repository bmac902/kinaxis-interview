// Pre-baked data returned when BigQuery is not configured
// Mirrors the shape of all /api/* responses

const SERVICE_COLORS = {
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

const monthlyCostByService = [
  { month: "Dec '24", 'Compute Engine': 342180, 'Kubernetes Engine': 98450, 'Cloud Storage': 171320, 'BigQuery': 109870, 'Databricks': 134280, 'Vertex AI': 86140, 'Cloud SQL': 73290, 'Networking': 97510, 'Other': 101330 },
  { month: "Jan '25", 'Compute Engine': 369554, 'Kubernetes Engine': 106326, 'Cloud Storage': 185026, 'BigQuery': 118660, 'Databricks': 145022, 'Vertex AI': 93031, 'Cloud SQL': 79153, 'Networking': 105311, 'Other': 109437 },
  { month: "Feb '25", 'Compute Engine': 399118, 'Kubernetes Engine': 114832, 'Cloud Storage': 199828, 'BigQuery': 128152, 'Databricks': 156624, 'Vertex AI': 100474, 'Cloud SQL': 85485, 'Networking': 113736, 'Other': 118191 },
]

const costByProject = [
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

const cudCoverage = [
  { project: 'supply-chain-api-prod',  computeCost: 198240, cudCoverage: 0, potential1yr: 39648,  potential3yr: 73349  },
  { project: 'maestro-platform-prod',  computeCost: 194120, cudCoverage: 0, potential1yr: 38824,  potential3yr: 71824  },
  { project: 'devops-tooling',         computeCost: 191380, cudCoverage: 0, potential1yr: 38276,  potential3yr: 70811  },
  { project: 'customer-portal-prod',   computeCost: 187440, cudCoverage: 0, potential1yr: 37488,  potential3yr: 69353  },
  { project: 'ml-inference-prod',      computeCost:  53820, cudCoverage: 0, potential1yr: 10764,  potential3yr: 19913  },
  { project: 'ml-training-prod',       computeCost:  48960, cudCoverage: 0, potential1yr:  9792,  potential3yr: 18115  },
  { project: 'data-analytics-prod',    computeCost:  88110, cudCoverage: 0, potential1yr: 17622,  potential3yr: 32601  },
  { project: 'maestro-platform-dev',   computeCost: 148640, cudCoverage: 0, potential1yr: 29728,  potential3yr: 54997  },
]

const cudSummary = {
  totalEligibleCompute: 1210710,
  potential1yrAnnual:   1162312,
  potential3yrAnnual:   1564212,
  topOpportunity: 'ml-inference-prod (GPU — $10.7K/qtr with 1-yr CUD)',
}

const databricksByTier = [
  { tier: 'All-Purpose Compute', cost: 213420, pct: 48.8, color: '#f87171' },
  { tier: 'Jobs Compute',        cost: 131260, pct: 30.0, color: '#fb923c' },
  { tier: 'SQL Compute',         cost:  63490, pct: 14.5, color: '#fbbf24' },
  { tier: 'DLT Core',            cost:  28590, pct:  6.7, color: '#a78bfa' },
]

const databricksByProject = [
  { project: 'data-analytics-prod', 'All-Purpose Compute': 96540, 'Jobs Compute': 59310, 'SQL Compute': 28720, 'DLT Core': 12940 },
  { project: 'ml-training-prod',    'All-Purpose Compute': 78130, 'Jobs Compute': 48420, 'SQL Compute': 23180, 'DLT Core': 10520 },
  { project: 'devops-tooling',      'All-Purpose Compute': 22490, 'Jobs Compute': 13910, 'SQL Compute':  7320, 'DLT Core':  3220 },
  { project: 'ml-inference-prod',   'All-Purpose Compute': 16260, 'Jobs Compute':  9620, 'SQL Compute':  4270, 'DLT Core':  1910 },
]

const untaggedSpend = [
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

const momTrend = [
  { month: "Dec '24", total: 1214370, compute: 440630, storage: 171320, analytics: 243870, databricks: 134280, ai: 86140, other: 138130 },
  { month: "Jan '25", total: 1311520, compute: 475880, storage: 185026, analytics: 263682, databricks: 145022, ai:  93031, other: 148879 },
  { month: "Feb '25", total: 1416440, compute: 513950, storage: 199828, analytics: 284776, databricks: 156624, ai: 100474, other: 160788 },
]

const kpis = {
  totalSpend:           3942330,
  momGrowthPct:         8.0,
  untaggedSpend:        1121351,
  untaggedPct:          28.4,
  cudOpportunityAnnual: 1162312,
  cudOpportunity1yr:    290578,
  projects:             10,
  months:               3,
  dataSource:           'BigQuery — gcp_finops_poc.focus_v1 (FOCUS 1.0)',
}

// Per-project SKU drill-down (top SKUs for each project)
const projectSkus = {
  'supply-chain-api-prod': [
    { sku: 'N2 Instance Core running in Americas', service: 'Compute Engine', cost: 112400 },
    { sku: 'N2 Instance Ram running in Americas',  service: 'Compute Engine', cost:  68200 },
    { sku: 'Standard Storage US',                  service: 'Cloud Storage',  cost:  54300 },
    { sku: 'GKE Standard Cluster Management Fee',  service: 'Kubernetes Engine', cost: 38100 },
    { sku: 'Analysis pricing',                     service: 'BigQuery',       cost:  29800 },
    { sku: 'Networking Egress Americas',           service: 'Networking',     cost:  21600 },
    { sku: 'Cloud SQL for PostgreSQL: Zonal',      service: 'Cloud SQL',      cost:  18700 },
    { sku: 'Other',                                service: 'Other',          cost: 242027 },
  ],
  'maestro-platform-prod': [
    { sku: 'N2 Instance Core running in Americas', service: 'Compute Engine', cost: 108900 },
    { sku: 'N2 Instance Ram running in Americas',  service: 'Compute Engine', cost:  65300 },
    { sku: 'GKE Standard Cluster Management Fee',  service: 'Kubernetes Engine', cost: 42200 },
    { sku: 'Analysis pricing',                     service: 'BigQuery',       cost:  36100 },
    { sku: 'Standard Storage US',                  service: 'Cloud Storage',  cost:  31400 },
    { sku: 'Networking Egress Americas',           service: 'Networking',     cost:  24500 },
    { sku: 'Other',                                service: 'Other',          cost: 265211 },
  ],
  'devops-tooling': [
    { sku: 'N2 Instance Core running in Americas', service: 'Compute Engine', cost:  98400 },
    { sku: 'All-Purpose Compute DBU',              service: 'Databricks',     cost:  22490 },
    { sku: 'Jobs Compute DBU',                     service: 'Databricks',     cost:  13910 },
    { sku: 'Standard Storage US',                  service: 'Cloud Storage',  cost:  28100 },
    { sku: 'GKE Standard Cluster Management Fee',  service: 'Kubernetes Engine', cost: 24300 },
    { sku: 'Analysis pricing',                     service: 'BigQuery',       cost:  18700 },
    { sku: 'Other',                                service: 'Other',          cost: 366467 },
  ],
  'shared-services': [
    { sku: 'N2 Instance Core running in Americas', service: 'Compute Engine', cost: 142300 },
    { sku: 'Standard Storage US',                  service: 'Cloud Storage',  cost:  98400 },
    { sku: 'Networking Egress Americas',           service: 'Networking',     cost:  76200 },
    { sku: 'Cloud SQL for PostgreSQL: Zonal',      service: 'Cloud SQL',      cost:  54100 },
    { sku: 'GKE Standard Cluster Management Fee',  service: 'Kubernetes Engine', cost: 38900 },
    { sku: 'Other',                                service: 'Other',          cost: 160834 },
  ],
  'customer-portal-prod': [
    { sku: 'N2 Instance Core running in Americas', service: 'Compute Engine', cost: 105600 },
    { sku: 'GKE Standard Cluster Management Fee',  service: 'Kubernetes Engine', cost: 39800 },
    { sku: 'Standard Storage US',                  service: 'Cloud Storage',  cost:  47200 },
    { sku: 'Analysis pricing',                     service: 'BigQuery',       cost:  28900 },
    { sku: 'Networking Egress Americas',           service: 'Networking',     cost:  22300 },
    { sku: 'Other',                                service: 'Other',          cost: 318399 },
  ],
  'maestro-platform-dev': [
    { sku: 'N2 Instance Core running in Americas', service: 'Compute Engine', cost:  84200 },
    { sku: 'GKE Standard Cluster Management Fee',  service: 'Kubernetes Engine', cost: 28900 },
    { sku: 'Standard Storage US',                  service: 'Cloud Storage',  cost:  38700 },
    { sku: 'Analysis pricing',                     service: 'BigQuery',       cost:  21400 },
    { sku: 'Cloud SQL for PostgreSQL: Zonal',      service: 'Cloud SQL',      cost:  18200 },
    { sku: 'Other',                                service: 'Other',          cost: 254689 },
  ],
  'data-analytics-prod': [
    { sku: 'All-Purpose Compute DBU',              service: 'Databricks',     cost:  96540 },
    { sku: 'Jobs Compute DBU',                     service: 'Databricks',     cost:  59310 },
    { sku: 'Analysis pricing',                     service: 'BigQuery',       cost:  48700 },
    { sku: 'SQL Compute DBU',                      service: 'Databricks',     cost:  28720 },
    { sku: 'DLT Core DBU',                         service: 'Databricks',     cost:  12940 },
    { sku: 'Standard Storage US',                  service: 'Cloud Storage',  cost:  14832 },
  ],
  'ml-training-prod': [
    { sku: 'All-Purpose Compute DBU',              service: 'Databricks',     cost:  78130 },
    { sku: 'A100 GPU Instance running in Americas',service: 'Compute Engine', cost:  42100 },
    { sku: 'Jobs Compute DBU',                     service: 'Databricks',     cost:  48420 },
    { sku: 'Vertex AI Training: Custom model',     service: 'Vertex AI',      cost:  38200 },
    { sku: 'Standard Storage US',                  service: 'Cloud Storage',  cost:  24100 },
    { sku: 'Other',                                service: 'Other',          cost:  23410 },
  ],
  'ml-inference-prod': [
    { sku: 'Vertex AI Prediction: Online serving', service: 'Vertex AI',      cost:  24800 },
    { sku: 'A100 GPU Instance running in Americas',service: 'Compute Engine', cost:  16400 },
    { sku: 'All-Purpose Compute DBU',              service: 'Databricks',     cost:  16260 },
    { sku: 'Networking Egress Americas',           service: 'Networking',     cost:   5516 },
  ],
  'legacy-migration-proj': [
    { sku: 'N1 Instance Core running in Americas', service: 'Compute Engine', cost:  28400 },
    { sku: 'Standard Storage US',                  service: 'Cloud Storage',  cost:  14200 },
    { sku: 'Cloud SQL for MySQL: Zonal',           service: 'Cloud SQL',      cost:   8100 },
    { sku: 'Other',                                service: 'Other',          cost:   3252 },
  ],
}

function getAvailableMonths() {
  return [
    { value: '2024-12', label: "Dec '24" },
    { value: '2025-01', label: "Jan '25" },
    { value: '2025-02', label: "Feb '25" },
  ]
}

function filterByRange(startMonth, endMonth) {
  const months = getAvailableMonths()
  return months
    .filter(m => m.value >= startMonth && m.value <= endMonth)
    .map(m => m.label)
}

function getSummary(startMonth, endMonth) {
  const activeLabels = filterByRange(startMonth, endMonth)
  const activeData = monthlyCostByService.filter(m => activeLabels.includes(m.month))

  const services = ['Compute Engine', 'Kubernetes Engine', 'Cloud Storage', 'BigQuery', 'Databricks', 'Vertex AI', 'Cloud SQL', 'Networking', 'Other']
  const totalSpend = activeData.reduce((sum, m) => sum + services.reduce((s, svc) => s + (m[svc] || 0), 0), 0)

  const activeTrend = momTrend.filter(m => activeLabels.includes(m.month))
  const momGrowthPct = activeTrend.length >= 2
    ? +((activeTrend[activeTrend.length - 1].total - activeTrend[activeTrend.length - 2].total) / activeTrend[activeTrend.length - 2].total * 100).toFixed(1)
    : 0

  // Scale cost-by-project proportionally
  const fullTotal = 3942330
  const scale = totalSpend / fullTotal
  const scaledProjects = costByProject.map(p => ({ ...p, cost: Math.round(p.cost * scale) }))
  const totalUntagged = scaledProjects.filter(p => !p.tagged).reduce((s, p) => s + p.cost, 0)

  const scaledCUD = cudCoverage.map(p => ({
    ...p,
    computeCost:  Math.round(p.computeCost  * scale),
    potential1yr: Math.round(p.potential1yr * scale),
    potential3yr: Math.round(p.potential3yr * scale),
  }))
  const totalEligible = scaledCUD.reduce((s, p) => s + p.computeCost, 0)

  const scaledDBTiers = databricksByTier.map(t => ({ ...t, cost: Math.round(t.cost * scale) }))
  const scaledDBProject = databricksByProject.map(p => {
    const out = { project: p.project }
    ;['All-Purpose Compute', 'Jobs Compute', 'SQL Compute', 'DLT Core'].forEach(k => {
      out[k] = Math.round((p[k] || 0) * scale)
    })
    return out
  })
  const scaledUntagged = untaggedSpend.map(p => ({
    ...p,
    untagged: Math.round(p.untagged * scale),
    total:    Math.round(p.total    * scale),
  }))

  return {
    kpis: {
      totalSpend:           Math.round(totalSpend),
      momGrowthPct,
      untaggedSpend:        Math.round(totalUntagged),
      untaggedPct:          +((totalUntagged / totalSpend) * 100).toFixed(1),
      cudOpportunityAnnual: Math.round(totalEligible * 0.20 * 4),
      cudOpportunity1yr:    Math.round(totalEligible * 0.20),
      projects:             10,
      months:               activeLabels.length,
      dataSource:           'mock data — BigQuery not configured',
    },
    monthlyCostByService: activeData,
    costByProject:        scaledProjects,
    momTrend:             activeTrend,
    cudCoverage:          scaledCUD,
    cudSummary: {
      totalEligibleCompute: totalEligible,
      potential1yrAnnual:   Math.round(totalEligible * 0.20 * 4),
      potential3yrAnnual:   Math.round(totalEligible * 0.37 * 4),
      topOpportunity: cudSummary.topOpportunity,
    },
    databricksByTier:    scaledDBTiers,
    databricksByProject: scaledDBProject,
    untaggedSpend:       scaledUntagged,
  }
}

function getProjectSkus(projectId, startMonth, endMonth) {
  const activeLabels = filterByRange(startMonth, endMonth)
  const scale = activeLabels.length / 3
  const skus = (projectSkus[projectId] || []).map(s => ({
    ...s,
    cost: Math.round(s.cost * scale),
  }))
  const total = skus.reduce((s, r) => s + r.cost, 0)
  return {
    project: projectId,
    total,
    skus: skus.map(s => ({ ...s, pct: +((s.cost / total) * 100).toFixed(1) })),
  }
}

module.exports = { getSummary, getProjectSkus, getAvailableMonths }
