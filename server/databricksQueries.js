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
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ statement: sql, warehouse_id: WAREHOUSE, wait_timeout: '50s' }),
  })
  const json = await res.json()
  if (json.status?.state !== 'SUCCEEDED') {
    throw new Error(`Databricks query failed: ${JSON.stringify(json.status)}`)
  }
  const cols  = json.manifest.schema.columns.map(c => c.name)
  const rows  = (json.result?.data_array || []).map(row =>
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
  const [byProduct, byPrincipal] = await Promise.all([
    runStatement(SQL_GOV_BY_PRODUCT),
    runStatement(SQL_GOV_BY_PRINCIPAL),
  ])

  // Roll up summary metrics
  let totalRecords = 0, taggedRecords = 0, identifiedRecords = 0, attributedRecords = 0
  for (const r of byProduct) {
    totalRecords     += parseInt(r.records)       || 0
    taggedRecords    += parseInt(r.tagged_records)     || 0
    identifiedRecords+= parseInt(r.identified_records) || 0
    attributedRecords+= parseInt(r.attributed_records) || 0
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
      taggedPct:      pct(taggedRecords,     totalRecords),
      identifiedPct:  pct(identifiedRecords, totalRecords),
      attributedPct:  pct(attributedRecords, totalRecords),
    },
  }
}

module.exports = { getDatabricksUsage, getDatabricksGovernance, isConfigured: !!(HOST && TOKEN && WAREHOUSE) }
