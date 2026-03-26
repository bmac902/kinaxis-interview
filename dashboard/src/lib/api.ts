// ── Types ─────────────────────────────────────────────────────────────────────

export interface MonthOption {
  value: string   // 'YYYY-MM'
  label: string   // "Dec '24"
}

export interface KPIs {
  totalSpend:           number
  momGrowthPct:         number
  untaggedSpend:        number
  untaggedPct:          number
  cudOpportunityAnnual: number
  cudOpportunity1yr:    number
  projects:             number
  months:               number
  dataSource:           string
}

export interface MonthlyCostRow {
  month: string
  [service: string]: number | string
}

export interface ProjectCostRow {
  project: string
  team:    string
  cost:    number
  tagged:  boolean
}

export interface MoMTrendRow {
  month:      string
  total:      number
  compute:    number
  storage:    number
  analytics:  number
  databricks: number
  ai:         number
  other:      number
}

export interface CUDCoverageRow {
  project:     string
  computeCost: number
  cudCoverage: number
  potential1yr: number
  potential3yr: number
}

export interface CUDSummary {
  totalEligibleCompute: number
  potential1yrAnnual:   number
  potential3yrAnnual:   number
  topOpportunity:       string
}

export interface DatabricksTierRow {
  tier:  string
  cost:  number
  pct:   number
  color: string
}

export interface DatabricksProjectRow {
  project: string
  [tier: string]: number | string
}

export interface UntaggedSpendRow {
  project:  string
  untagged: number
  total:    number
  pct:      number
}

export interface DashboardData {
  kpis:                 KPIs
  monthlyCostByService: MonthlyCostRow[]
  costByProject:        ProjectCostRow[]
  momTrend:             MoMTrendRow[]
  cudCoverage:          CUDCoverageRow[]
  cudSummary:           CUDSummary
  databricksByTier:     DatabricksTierRow[]
  databricksByProject:  DatabricksProjectRow[]
  untaggedSpend:        UntaggedSpendRow[]
}

export interface SkuRow {
  sku:     string
  service: string
  cost:    number
  pct:     number
}

export interface ProjectSkuData {
  project: string
  total:   number
  skus:    SkuRow[]
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

export function fetchMonths(): Promise<MonthOption[]> {
  return get<MonthOption[]>('/api/months')
}

export function fetchSummary(start: string, end: string): Promise<DashboardData> {
  return get<DashboardData>(`/api/summary?start=${start}&end=${end}`)
}

export function fetchProjectSkus(projectId: string, start: string, end: string): Promise<ProjectSkuData> {
  return get<ProjectSkuData>(`/api/project/${encodeURIComponent(projectId)}/skus?start=${start}&end=${end}`)
}

export interface ChargebackRow {
  team:          string
  total:         number
  lastMonthCost: number | null
  momPct:        number | null
  projects:      string
  projectCount:  number
}

export function fetchChargeback(start: string, end: string): Promise<ChargebackRow[]> {
  return get<ChargebackRow[]>(`/api/chargeback?start=${start}&end=${end}`)
}

// ── Databricks types ───────────────────────────────────────────────────────────

export interface DatabricksUsageRow {
  usage_date: string
  product:    string
  sku_name:   string
  dbus:       string
  est_cost:   string
}

export interface DatabricksUsageData {
  rows:    DatabricksUsageRow[]
  totals:  { dbus: number; cost: number; byProduct: Record<string, number> }
  byDate:  Record<string, Record<string, number>>
}

export function fetchDatabricksUsage(): Promise<DatabricksUsageData> {
  return get<DatabricksUsageData>('/api/databricks/usage')
}
