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

// ── Databricks → FOCUS 1.0 Export ─────────────────────────────────────────────
// Inspired by csyvenky-finops/fox25 (FinOps X 2025), adapted for GCP Databricks.
// Joins system.billing.usage with system.billing.list_prices to produce all
// required FOCUS 1.0 cost fields from native Databricks billing data.

const SQL_FOCUS = `
SELECT
  -- ── Billing account ────────────────────────────────────────
  u.account_id                                                          AS BillingAccountId,
  u.account_id                                                          AS BillingAccountName,
  'USD'                                                                 AS BillingCurrency,

  -- ── Billing & charge period ────────────────────────────────
  DATE_TRUNC('MONTH', CAST(u.usage_date AS DATE))                       AS BillingPeriodStart,
  LAST_DAY(CAST(u.usage_date AS DATE))                                  AS BillingPeriodEnd,
  u.usage_start_time                                                    AS ChargePeriodStart,
  u.usage_end_time                                                      AS ChargePeriodEnd,

  -- ── Charge metadata ────────────────────────────────────────
  'Usage'                                                               AS ChargeCategory,
  'Usage-Based'                                                         AS ChargeFrequency,
  u.usage_type                                                          AS ChargeDescription,

  -- ── Cost fields (list_price × quantity) ───────────────────
  -- No commitment discounts on GCP free tier; all four cost columns converge.
  ROUND(u.usage_quantity * COALESCE(p.pricing.default, 0), 6)          AS BilledCost,
  ROUND(u.usage_quantity * COALESCE(p.pricing.default, 0), 6)          AS ListCost,
  ROUND(u.usage_quantity * COALESCE(p.pricing.default, 0), 6)          AS EffectiveCost,
  ROUND(u.usage_quantity * COALESCE(p.pricing.default, 0), 6)          AS ContractedCost,
  CAST(COALESCE(p.pricing.default, 0) AS DECIMAL(38,10))               AS ListUnitPrice,
  CAST(COALESCE(p.pricing.default, 0) AS DECIMAL(38,10))               AS ContractedUnitPrice,

  -- ── Consumption ────────────────────────────────────────────
  u.usage_quantity                                                      AS ConsumedQuantity,
  u.usage_unit                                                          AS ConsumedUnit,
  u.usage_quantity                                                      AS PricingQuantity,
  u.usage_unit                                                          AS PricingUnit,
  'Standard'                                                            AS PricingCategory,

  -- ── SKU & service ──────────────────────────────────────────
  u.sku_name                                                            AS SkuId,
  u.billing_origin_product || ' | ' || u.sku_name                      AS ServiceName,
  'Analytics'                                                           AS ServiceCategory,

  -- ── Provider ───────────────────────────────────────────────
  'Google Cloud'                                                        AS ProviderName,
  'Databricks'                                                          AS PublisherName,
  'Databricks'                                                          AS InvoiceIssuerName,

  -- ── Sub-account (workspace) ────────────────────────────────
  CASE WHEN u.workspace_id IS NOT NULL AND TRIM(u.workspace_id) <> ''
       THEN u.workspace_id ELSE NULL END                                AS SubAccountId,
  CASE WHEN u.workspace_id IS NOT NULL AND TRIM(u.workspace_id) <> ''
       THEN u.workspace_id ELSE NULL END                                AS SubAccountName,

  -- ── Resource (cluster / warehouse / job — whichever is set) ──
  COALESCE(
    u.usage_metadata.cluster_id,
    u.usage_metadata.warehouse_id,
    CAST(u.usage_metadata.job_id AS STRING)
  )                                                                     AS ResourceId,
  COALESCE(
    u.usage_metadata.cluster_id,
    u.usage_metadata.warehouse_id,
    u.usage_metadata.job_name
  )                                                                     AS ResourceName,

  -- ── Tags & identity ────────────────────────────────────────
  COALESCE(u.custom_tags, CAST(map() AS MAP<STRING,STRING>))            AS Tags,
  u.identity_metadata.run_as                                            AS RunAs

FROM system.billing.usage u
LEFT JOIN system.billing.list_prices p
  ON  u.sku_name = p.sku_name
  AND u.usage_start_time BETWEEN p.price_start_time
      AND COALESCE(p.price_end_time, CURRENT_TIMESTAMP())
WHERE u.usage_unit = 'DBU'
ORDER BY u.usage_start_time DESC
`

async function getDatabricksFocus() {
  const rows = await runStatement(SQL_FOCUS)
  return rows.map(r => ({
    BillingAccountId:    r.BillingAccountId,
    BillingCurrency:     r.BillingCurrency,
    BillingPeriodStart:  r.BillingPeriodStart,
    BillingPeriodEnd:    r.BillingPeriodEnd,
    ChargePeriodStart:   r.ChargePeriodStart,
    ChargePeriodEnd:     r.ChargePeriodEnd,
    ChargeCategory:      r.ChargeCategory,
    ChargeFrequency:     r.ChargeFrequency,
    ChargeDescription:   r.ChargeDescription,
    BilledCost:          parseFloat(r.BilledCost)          || 0,
    ListCost:            parseFloat(r.ListCost)            || 0,
    EffectiveCost:       parseFloat(r.EffectiveCost)       || 0,
    ContractedCost:      parseFloat(r.ContractedCost)      || 0,
    ListUnitPrice:       parseFloat(r.ListUnitPrice)       || 0,
    ContractedUnitPrice: parseFloat(r.ContractedUnitPrice) || 0,
    ConsumedQuantity:    parseFloat(r.ConsumedQuantity)    || 0,
    ConsumedUnit:        r.ConsumedUnit,
    PricingQuantity:     parseFloat(r.PricingQuantity)     || 0,
    PricingUnit:         r.PricingUnit,
    PricingCategory:     r.PricingCategory,
    SkuId:               r.SkuId,
    ServiceName:         r.ServiceName,
    ServiceCategory:     r.ServiceCategory,
    ProviderName:        r.ProviderName,
    PublisherName:       r.PublisherName,
    InvoiceIssuerName:   r.InvoiceIssuerName,
    SubAccountId:        r.SubAccountId,
    SubAccountName:      r.SubAccountName,
    ResourceId:          r.ResourceId,
    ResourceName:        r.ResourceName,
    Tags:                r.Tags,
    RunAs:               r.RunAs,
  }))
}

module.exports = { getDatabricksUsage, getDatabricksGovernance, getMultiCloudOverview, getDatabricksFocus, isConfigured: !!(HOST && TOKEN && WAREHOUSE) }
