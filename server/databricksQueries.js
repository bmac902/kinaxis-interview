const HOST      = process.env.DATABRICKS_HOST
const TOKEN     = process.env.DATABRICKS_TOKEN
const WAREHOUSE = process.env.DATABRICKS_WAREHOUSE_ID

const SQL = `
SELECT
  CAST(u.usage_date AS STRING)         AS usage_date,
  u.billing_origin_product             AS product,
  u.sku_name,
  ROUND(SUM(u.usage_quantity), 4)      AS dbus,
  ROUND(SUM(u.usage_quantity * COALESCE(p.pricing.default, 0)), 4) AS est_cost
FROM system.billing.usage u
LEFT JOIN system.billing.list_prices p
  ON  u.sku_name = p.sku_name
  AND u.usage_start_time BETWEEN p.price_start_time
      AND COALESCE(p.price_end_time, CURRENT_TIMESTAMP())
WHERE u.usage_unit = 'DBU'
GROUP BY 1, 2, 3
ORDER BY 1, 2
`

async function runStatement(sql) {
  const res = await fetch(`${HOST}/api/2.0/sql/statements`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ statement: sql, warehouse_id: WAREHOUSE, wait_timeout: '50s' }),
  })
  let json = await res.json()

  // Poll if warehouse is still cold-starting (PENDING after wait_timeout)
  const statementId = json.statement_id
  let attempts = 0
  while (json.status?.state === 'PENDING' || json.status?.state === 'RUNNING') {
    if (attempts++ > 12) throw new Error('Databricks query timed out after polling')
    await new Promise(r => setTimeout(r, 5000))
    const poll = await fetch(`${HOST}/api/2.0/sql/statements/${statementId}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    json = await poll.json()
  }

  if (json.status?.state !== 'SUCCEEDED') {
    throw new Error(`Databricks query failed: ${JSON.stringify(json.status)}`)
  }
  const cols = json.manifest.schema.columns.map(c => c.name)
  const rows = (json.result?.data_array || []).map(row =>
    Object.fromEntries(cols.map((c, i) => [c, row[i]]))
  )
  return rows
}

async function getDatabricksUsage() {
  const rows = await runStatement(SQL)

  const totals = { dbus: 0, cost: 0, byProduct: {} }
  for (const r of rows) {
    const dbus = parseFloat(r.dbus) || 0
    const cost = parseFloat(r.est_cost) || 0
    totals.dbus += dbus
    totals.cost += cost
    totals.byProduct[r.product] = (totals.byProduct[r.product] || 0) + dbus
  }
  totals.dbus = Math.round(totals.dbus * 10000) / 10000
  totals.cost = Math.round(totals.cost * 100) / 100

  // Group by date for the timeline chart
  const byDate = {}
  for (const r of rows) {
    if (!byDate[r.usage_date]) byDate[r.usage_date] = {}
    byDate[r.usage_date][r.product] = (byDate[r.usage_date][r.product] || 0) + (parseFloat(r.dbus) || 0)
  }

  return { rows, totals, byDate }
}

const SQL_TAG_TREND = `
SELECT
  CAST(usage_date AS STRING)                                                              AS usage_date,
  COUNT(*)                                                                                AS total_records,
  SUM(CASE WHEN custom_tags IS NOT NULL AND size(custom_tags) > 0 THEN 1 ELSE 0 END)    AS tagged_records,
  ROUND(
    SUM(CASE WHEN custom_tags IS NOT NULL AND size(custom_tags) > 0 THEN 1 ELSE 0 END)
    * 100.0 / COUNT(*), 1)                                                                AS tag_pct
FROM system.billing.usage
WHERE usage_unit = 'DBU'
  AND billing_origin_product IN ('INTERACTIVE', 'SQL')
GROUP BY 1
ORDER BY 1
`

const SQL_GOV_BY_PRODUCT = `
SELECT
  billing_origin_product                                                   AS product,
  COUNT(*)                                                                 AS records,
  ROUND(SUM(u.usage_quantity), 4)                                          AS dbus,
  ROUND(SUM(u.usage_quantity * COALESCE(p.pricing.default, 0)), 4)        AS est_cost,
  SUM(CASE WHEN custom_tags IS NOT NULL AND size(custom_tags) > 0 THEN 1 ELSE 0 END) AS tagged_records,
  SUM(CASE WHEN identity_metadata.run_as IS NOT NULL THEN 1 ELSE 0 END)  AS identified_records,
  SUM(CASE WHEN usage_metadata.notebook_path IS NOT NULL
            OR  usage_metadata.job_name      IS NOT NULL
            OR  usage_metadata.warehouse_id  IS NOT NULL THEN 1 ELSE 0 END) AS attributed_records
FROM system.billing.usage u
LEFT JOIN system.billing.list_prices p
  ON  u.sku_name = p.sku_name
  AND u.usage_start_time BETWEEN p.price_start_time
      AND COALESCE(p.price_end_time, CURRENT_TIMESTAMP())
WHERE u.usage_unit = 'DBU'
GROUP BY 1
ORDER BY dbus DESC
`

const SQL_GOV_BY_PRINCIPAL = `
SELECT
  COALESCE(identity_metadata.run_as, '— anonymous —')                    AS principal,
  COUNT(*)                                                                 AS records,
  ROUND(SUM(u.usage_quantity), 4)                                          AS dbus,
  ROUND(SUM(u.usage_quantity * COALESCE(p.pricing.default, 0)), 4)        AS est_cost
FROM system.billing.usage u
LEFT JOIN system.billing.list_prices p
  ON  u.sku_name = p.sku_name
  AND u.usage_start_time BETWEEN p.price_start_time
      AND COALESCE(p.price_end_time, CURRENT_TIMESTAMP())
WHERE u.usage_unit = 'DBU'
GROUP BY 1
ORDER BY dbus DESC
`

async function getDatabricksGovernance() {
  const [byProduct, byPrincipal, tagTrend] = await Promise.all([
    runStatement(SQL_GOV_BY_PRODUCT),
    runStatement(SQL_GOV_BY_PRINCIPAL),
    runStatement(SQL_TAG_TREND),
  ])

  // Roll up summary metrics
  // Exclude PREDICTIVE_OPTIMIZATION from tag coverage — it carries a Databricks-managed system tag
  // ("Predictive Optimization": "true") that is not a user governance tag.
  // Identity and attribution coverage are rolled up across all products.
  let totalRecords = 0, taggedRecords = 0, identifiedRecords = 0, attributedRecords = 0
  let userWorkloadRecords = 0  // denominator for taggedPct (INTERACTIVE + SQL only)
  for (const r of byProduct) {
    const records = parseInt(r.records) || 0
    totalRecords      += records
    identifiedRecords += parseInt(r.identified_records) || 0
    attributedRecords += parseInt(r.attributed_records) || 0
    if (r.product !== 'PREDICTIVE_OPTIMIZATION') {
      userWorkloadRecords += records
      taggedRecords       += parseInt(r.tagged_records) || 0
    }
  }

  const pct = (n, d) => d ? Math.round((n / d) * 1000) / 10 : 0

  return {
    byProduct: byProduct.map(r => ({
      product:             r.product,
      records:             parseInt(r.records)            || 0,
      dbus:                parseFloat(r.dbus)             || 0,
      est_cost:            parseFloat(r.est_cost)         || 0,
      tagged_records:      parseInt(r.tagged_records)     || 0,
      identified_records:  parseInt(r.identified_records) || 0,
      attributed_records:  parseInt(r.attributed_records) || 0,
    })),
    byPrincipal: byPrincipal.map(r => ({
      principal: r.principal,
      records:   parseInt(r.records)    || 0,
      dbus:      parseFloat(r.dbus)     || 0,
      est_cost:  parseFloat(r.est_cost) || 0,
    })),
    summary: {
      totalRecords,
      taggedPct:      pct(taggedRecords,     userWorkloadRecords),
      identifiedPct:  pct(identifiedRecords, totalRecords),
      attributedPct:  pct(attributedRecords, totalRecords),
    },
    tagTrend: tagTrend.map(r => ({
      date:          r.usage_date,
      totalRecords:  parseInt(r.total_records)  || 0,
      taggedRecords: parseInt(r.tagged_records) || 0,
      tagPct:        parseFloat(r.tag_pct)      || 0,
    })),
  }
}

// ── Multi-Cloud Overview ───────────────────────────────────────────────────────

const SQL_MULTICLOUD_GCP = `
SELECT
  LEFT(CAST(DATE_TRUNC('MONTH', usage_start_time) AS STRING), 7) AS month,
  \`service.description\`                                          AS service,
  ROUND(SUM(cost), 2)                                             AS cost
FROM workspace.default.gcp_billing_export
WHERE cost > 0
GROUP BY 1, 2
ORDER BY 1, 2
`

const SQL_MULTICLOUD_DBX = `
SELECT
  LEFT(CAST(DATE_TRUNC('MONTH', CAST(usage_date AS DATE)) AS STRING), 7) AS month,
  billing_origin_product                                                   AS product,
  ROUND(SUM(u.usage_quantity * COALESCE(p.pricing.default, 0)), 4)        AS cost
FROM system.billing.usage u
LEFT JOIN system.billing.list_prices p
  ON  u.sku_name = p.sku_name
  AND u.usage_start_time BETWEEN p.price_start_time
      AND COALESCE(p.price_end_time, CURRENT_TIMESTAMP())
WHERE u.usage_unit = 'DBU'
GROUP BY 1, 2
ORDER BY 1, 2
`

async function getMultiCloudOverview() {
  const [gcpRows, dbxRows] = await Promise.all([
    runStatement(SQL_MULTICLOUD_GCP),
    runStatement(SQL_MULTICLOUD_DBX),
  ])

  // GCP rollup
  const gcpServices = [...new Set(gcpRows.map(r => r.service))]
  const gcpMonthMap = {}
  let gcpTotal = 0
  for (const r of gcpRows) {
    const cost = parseFloat(r.cost) || 0
    gcpTotal += cost
    if (!gcpMonthMap[r.month]) gcpMonthMap[r.month] = { month: r.month }
    gcpMonthMap[r.month][r.service] = (gcpMonthMap[r.month][r.service] || 0) + cost
  }

  // Databricks rollup
  const dbxProducts = [...new Set(dbxRows.map(r => r.product))]
  const dbxMonthMap = {}
  let dbxTotal = 0
  for (const r of dbxRows) {
    const cost = parseFloat(r.cost) || 0
    dbxTotal += cost
    if (!dbxMonthMap[r.month]) dbxMonthMap[r.month] = { month: r.month }
    dbxMonthMap[r.month][r.product] = (dbxMonthMap[r.month][r.product] || 0) + cost
  }

  return {
    gcp: {
      total:    Math.round(gcpTotal * 100) / 100,
      byMonth:  Object.values(gcpMonthMap).sort((a, b) => a.month.localeCompare(b.month)),
      services: gcpServices,
    },
    databricks: {
      total:    Math.round(dbxTotal * 10000) / 10000,
      byMonth:  Object.values(dbxMonthMap).sort((a, b) => a.month.localeCompare(b.month)),
      products: dbxProducts,
    },
  }
}

module.exports = { getDatabricksUsage, getDatabricksGovernance, getMultiCloudOverview, isConfigured: !!(HOST && TOKEN && WAREHOUSE) }
