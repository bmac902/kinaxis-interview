// BigQuery query functions — called when GOOGLE_APPLICATION_CREDENTIALS is set
// All queries target the FOCUS 1.0 view: gcp_finops_poc.focus_v1

const TIER_COLORS = {
  'All-Purpose Compute': '#f87171',
  'Jobs Compute':        '#fb923c',
  'SQL Compute':         '#fbbf24',
  'DLT Core':            '#a78bfa',
}

function formatMonth(invoiceMonth) {
  // handles both integer 202412 and string '2024-12'
  const s = String(invoiceMonth).replace('-', '')
  const year  = parseInt(s.slice(0, 4))
  const month = parseInt(s.slice(4, 6))
  const date  = new Date(year, month - 1, 1)
  const mon   = date.toLocaleDateString('en-US', { month: 'short' })
  return `${mon} '${String(year).slice(2)}`
}

// '2024-12' → 202412  (integer for BQ WHERE clause)
function toIntMonth(m) { return parseInt(String(m).replace('-', '')) }

function classifyDatabricksTier(sku) {
  const s = (sku || '').toLowerCase()
  if (s.includes('sql') || s.includes('warehouse'))                     return 'SQL Compute'
  if (s.includes('dlt') || s.includes('delta live'))                    return 'DLT Core'
  if (s.includes('jobs') || s.includes('job compute'))                  return 'Jobs Compute'
  return 'All-Purpose Compute'
}

async function getAvailableMonths(bq, view) {
  const sql = `SELECT DISTINCT InvoiceMonth FROM ${view} ORDER BY InvoiceMonth`
  const [rows] = await bq.query({ query: sql })
  return rows.map(r => {
    const s = String(r.InvoiceMonth)
    const value = `${s.slice(0, 4)}-${s.slice(4, 6)}`   // '2024-12'
    return { value, label: formatMonth(r.InvoiceMonth) }
  })
}

async function getSummary(bq, view, startMonth, endMonth) {
  // BQ stores InvoiceMonth as integer (202412), convert params accordingly
  const params = { startMonth: toIntMonth(startMonth), endMonth: toIntMonth(endMonth) }

  // 1. Monthly cost by service
  const [svcRows] = await bq.query({
    query: `
      SELECT InvoiceMonth, ServiceName, ROUND(SUM(BilledCost), 2) AS cost
      FROM ${view}
      WHERE InvoiceMonth >= @startMonth AND InvoiceMonth <= @endMonth
        AND ServiceName IS NOT NULL
      GROUP BY InvoiceMonth, ServiceName
      ORDER BY InvoiceMonth, cost DESC
    `,
    params,
  })

  const knownServices = ['Compute Engine', 'Kubernetes Engine', 'Cloud Storage', 'BigQuery', 'Databricks', 'Vertex AI', 'Cloud SQL', 'Networking']
  const monthMap = {}
  for (const row of svcRows) {
    const label = formatMonth(row.InvoiceMonth)
    if (!monthMap[label]) monthMap[label] = { month: label }
    const svc = knownServices.includes(row.ServiceName) ? row.ServiceName : 'Other'
    monthMap[label][svc] = (monthMap[label][svc] || 0) + Number(row.cost)
  }
  const monthlyCostByService = Object.values(monthMap).map(m => {
    const out = { month: m.month }
    ;[...knownServices, 'Other'].forEach(s => { out[s] = Math.round(m[s] || 0) })
    return out
  })

  // 2. Cost by project
  const [projRows] = await bq.query({
    query: `
      SELECT
        SubAccountId AS project,
        ROUND(SUM(BilledCost), 2) AS cost,
        JSON_VALUE(Tags, '$.team') AS team
      FROM ${view}
      WHERE InvoiceMonth >= @startMonth AND InvoiceMonth <= @endMonth
      GROUP BY SubAccountId, team
      ORDER BY cost DESC
    `,
    params,
  })
  const costByProject = projRows.map(r => ({
    project: r.project,
    team:    r.team || '— untagged —',
    cost:    Math.round(Number(r.cost)),
    tagged:  !!r.team,
  }))

  // 3. MoM trend
  const [trendRows] = await bq.query({
    query: `
      SELECT
        InvoiceMonth,
        ROUND(SUM(BilledCost), 2) AS total,
        ROUND(SUM(CASE WHEN ServiceCategory = 'Compute' THEN BilledCost ELSE 0 END), 2) AS compute,
        ROUND(SUM(CASE WHEN ServiceCategory = 'Storage' THEN BilledCost ELSE 0 END), 2) AS storage,
        ROUND(SUM(CASE WHEN ServiceCategory IN ('Analytics','Database') THEN BilledCost ELSE 0 END), 2) AS analytics,
        ROUND(SUM(CASE WHEN ServiceName = 'Databricks' THEN BilledCost ELSE 0 END), 2) AS databricks,
        ROUND(SUM(CASE WHEN ServiceCategory = 'AI and Machine Learning' THEN BilledCost ELSE 0 END), 2) AS ai,
        ROUND(SUM(CASE WHEN ServiceCategory NOT IN ('Compute','Storage','Analytics','Database','AI and Machine Learning')
                        AND ServiceName != 'Databricks' THEN BilledCost ELSE 0 END), 2) AS other
      FROM ${view}
      WHERE InvoiceMonth >= @startMonth AND InvoiceMonth <= @endMonth
      GROUP BY InvoiceMonth
      ORDER BY InvoiceMonth
    `,
    params,
  })
  const momTrend = trendRows.map(r => ({
    month:      formatMonth(r.InvoiceMonth),
    total:      Math.round(Number(r.total)),
    compute:    Math.round(Number(r.compute)),
    storage:    Math.round(Number(r.storage)),
    analytics:  Math.round(Number(r.analytics)),
    databricks: Math.round(Number(r.databricks)),
    ai:         Math.round(Number(r.ai)),
    other:      Math.round(Number(r.other)),
  }))

  // 4. CUD coverage (Compute Engine eligible spend, 0% coverage)
  const [cudRows] = await bq.query({
    query: `
      SELECT
        SubAccountId AS project,
        ROUND(SUM(BilledCost), 2) AS computeCost,
        ABS(ROUND(SUM(CUD_Credits), 2)) AS cudCredits
      FROM ${view}
      WHERE ServiceName IN ('Compute Engine','Kubernetes Engine')
        AND InvoiceMonth >= @startMonth AND InvoiceMonth <= @endMonth
      GROUP BY SubAccountId
      ORDER BY computeCost DESC
    `,
    params,
  })
  const cudCoverage = cudRows.map(r => {
    const cc = Math.round(Number(r.computeCost))
    const cud = Math.round(Number(r.cudCredits))
    const pct = cc > 0 ? Math.round((cud / cc) * 100) : 0
    return {
      project:     r.project,
      computeCost: cc,
      cudCoverage: pct,
      potential1yr: Math.round(cc * 0.20),
      potential3yr: Math.round(cc * 0.37),
    }
  })
  const totalEligible = cudCoverage.reduce((s, r) => s + r.computeCost, 0)

  // 5. Databricks by tier + project
  const [dbRows] = await bq.query({
    query: `
      SELECT SubAccountId AS project, ChargeDescription AS sku, ROUND(SUM(BilledCost), 2) AS cost
      FROM ${view}
      WHERE ServiceName = 'Databricks'
        AND InvoiceMonth >= @startMonth AND InvoiceMonth <= @endMonth
      GROUP BY SubAccountId, ChargeDescription
      ORDER BY SubAccountId, cost DESC
    `,
    params,
  })
  const tierTotals = {}
  const projTierMap = {}
  for (const row of dbRows) {
    const tier = classifyDatabricksTier(row.sku)
    const cost = Number(row.cost)
    tierTotals[tier] = (tierTotals[tier] || 0) + cost
    if (!projTierMap[row.project]) projTierMap[row.project] = {}
    projTierMap[row.project][tier] = (projTierMap[row.project][tier] || 0) + cost
  }
  const tierOrder = ['All-Purpose Compute', 'Jobs Compute', 'SQL Compute', 'DLT Core']
  const dbTotal = Object.values(tierTotals).reduce((s, v) => s + v, 0)
  const databricksByTier = tierOrder.map(tier => ({
    tier,
    cost:  Math.round(tierTotals[tier] || 0),
    pct:   dbTotal > 0 ? +((( tierTotals[tier] || 0) / dbTotal) * 100).toFixed(1) : 0,
    color: TIER_COLORS[tier],
  }))
  const databricksByProject = Object.entries(projTierMap).map(([project, tiers]) => {
    const out = { project }
    tierOrder.forEach(t => { out[t] = Math.round(tiers[t] || 0) })
    return out
  })

  // 6. Untagged spend
  const [tagRows] = await bq.query({
    query: `
      SELECT
        SubAccountId AS project,
        ROUND(SUM(CASE
          WHEN Tags IS NULL OR Tags = '{}' OR Tags = ''
            OR JSON_VALUE(Tags, '$.team') IS NULL
          THEN BilledCost ELSE 0 END), 2) AS untagged,
        ROUND(SUM(BilledCost), 2) AS total
      FROM ${view}
      WHERE InvoiceMonth >= @startMonth AND InvoiceMonth <= @endMonth
      GROUP BY SubAccountId
      ORDER BY untagged DESC
    `,
    params,
  })
  const untaggedSpend = tagRows.map(r => {
    const u = Math.round(Number(r.untagged))
    const t = Math.round(Number(r.total))
    return { project: r.project, untagged: u, total: t, pct: t > 0 ? Math.round((u / t) * 100) : 0 }
  })

  // KPIs
  const totalSpend    = momTrend.reduce((s, m) => s + m.total, 0)
  const totalUntagged = untaggedSpend.reduce((s, r) => s + r.untagged, 0)
  const momGrowthPct  = momTrend.length >= 2
    ? +((momTrend.at(-1).total - momTrend.at(-2).total) / momTrend.at(-2).total * 100).toFixed(1)
    : 0

  return {
    kpis: {
      totalSpend,
      momGrowthPct,
      untaggedSpend:        totalUntagged,
      untaggedPct:          totalSpend > 0 ? +((totalUntagged / totalSpend) * 100).toFixed(1) : 0,
      cudOpportunityAnnual: Math.round(totalEligible * 0.20 * 4),
      cudOpportunity1yr:    Math.round(totalEligible * 0.20),
      projects:             costByProject.length,
      months:               momTrend.length,
      dataSource:           `BigQuery — ${view} (FOCUS 1.0)`,
    },
    monthlyCostByService,
    costByProject,
    momTrend,
    cudCoverage,
    cudSummary: {
      totalEligibleCompute: totalEligible,
      potential1yrAnnual:   Math.round(totalEligible * 0.20 * 4),
      potential3yrAnnual:   Math.round(totalEligible * 0.37 * 4),
      topOpportunity: cudCoverage[0]
        ? `${cudCoverage[0].project} ($${Math.round(cudCoverage[0].potential1yr / 1000)}K/period with 1-yr CUD)`
        : '',
    },
    databricksByTier,
    databricksByProject,
    untaggedSpend,
  }
}

async function getProjectSkus(bq, view, projectId, startMonth, endMonth) {
  const [rows] = await bq.query({
    query: `
      SELECT
        ChargeDescription AS sku,
        ServiceName AS service,
        ROUND(SUM(BilledCost), 2) AS cost
      FROM ${view}
      WHERE SubAccountId = @projectId
        AND InvoiceMonth >= @startMonth AND InvoiceMonth <= @endMonth
      GROUP BY ChargeDescription, ServiceName
      ORDER BY cost DESC
      LIMIT 20
    `,
    params: { projectId, startMonth: toIntMonth(startMonth), endMonth: toIntMonth(endMonth) },
  })
  const total = rows.reduce((s, r) => s + Number(r.cost), 0)
  return {
    project: projectId,
    total:   Math.round(total),
    skus: rows.map(r => ({
      sku:     r.sku,
      service: r.service,
      cost:    Math.round(Number(r.cost)),
      pct:     total > 0 ? +((Number(r.cost) / total) * 100).toFixed(1) : 0,
    })),
  }
}

async function getChargeback(bq, view, startMonth, endMonth) {
  const [rows] = await bq.query({
    query: `
      SELECT
        COALESCE(JSON_VALUE(Tags, '$.team'), '— untagged —') AS team,
        InvoiceMonth,
        ROUND(SUM(BilledCost), 2) AS cost,
        COUNT(DISTINCT SubAccountId) AS projectCount,
        STRING_AGG(DISTINCT SubAccountId ORDER BY SubAccountId LIMIT 5) AS projects
      FROM ${view}
      WHERE InvoiceMonth >= @startMonth AND InvoiceMonth <= @endMonth
      GROUP BY team, InvoiceMonth
      ORDER BY team, InvoiceMonth
    `,
    params: { startMonth: toIntMonth(startMonth), endMonth: toIntMonth(endMonth) },
  })

  // Pivot: team → { total, byMonth: { [month]: cost }, projects }
  const teamMap = {}
  for (const row of rows) {
    const team = row.team
    const month = String(row.InvoiceMonth)
    if (!teamMap[team]) teamMap[team] = { team, byMonth: {}, total: 0, projects: row.projects || '' }
    const cost = Number(row.cost)
    teamMap[team].byMonth[month] = cost
    teamMap[team].total += cost
    if (row.projects) teamMap[team].projects = row.projects
  }

  // Compute MoM from last two distinct months in range
  const allMonths = [...new Set(rows.map(r => String(r.InvoiceMonth)))].sort()
  const prevMonth = allMonths.length >= 2 ? allMonths[allMonths.length - 2] : null
  const lastMonth = allMonths.length >= 1 ? allMonths[allMonths.length - 1] : null

  return Object.values(teamMap)
    .map(t => {
      const prev = prevMonth ? (t.byMonth[prevMonth] || 0) : null
      const last = lastMonth ? (t.byMonth[lastMonth] || 0) : null
      const momPct = (prev && last && prev > 0)
        ? +((last - prev) / prev * 100).toFixed(1)
        : null
      return {
        team:         t.team,
        total:        Math.round(t.total),
        lastMonthCost: last ? Math.round(last) : null,
        momPct,
        projects:     t.projects,
        projectCount: Object.keys(t.byMonth).length > 0 ? (t.projects.split(',').length) : 0,
      }
    })
    .sort((a, b) => b.total - a.total)
}

module.exports = { getSummary, getProjectSkus, getAvailableMonths, getChargeback }
