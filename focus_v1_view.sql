-- ============================================================
-- FOCUS 1.0 View over GCP Billing Export
-- FinOps Open Cost and Usage Specification (FOCUS) v1.0
-- Load into BigQuery after importing gcp_billing_export.csv
--
-- Usage:
--   Replace `your_project.your_dataset` with your actual
--   BigQuery project and dataset name.
-- ============================================================

CREATE OR REPLACE VIEW `YOUR_GCP_PROJECT_ID.gcp_finops_poc.focus_v1` AS

WITH billing AS (
  SELECT
    *,
    -- Parse credits JSON array
    JSON_QUERY_ARRAY(credits) AS credits_array,
    -- Parse labels JSON array
    JSON_QUERY_ARRAY(labels)  AS labels_array
  FROM `YOUR_GCP_PROJECT_ID.gcp_finops_poc.gcp_billing_export`
),

credits_unnested AS (
  SELECT
    billing_account_id,
    service_description    AS service,
    sku_description        AS sku,
    project_id,
    usage_start_time,
    cost,
    IFNULL(
      (SELECT SUM(CAST(JSON_VALUE(c, '$.amount') AS FLOAT64))
       FROM UNNEST(credits_array) AS c),
      0
    ) AS total_credits,
    IFNULL(
      (SELECT SUM(
         CASE WHEN JSON_VALUE(c, '$.type') = 'COMMITTED_USAGE_DISCOUNT'
                   OR JSON_VALUE(c, '$.type') = 'COMMITTED_USAGE_DISCOUNT_DOLLAR_BASE'
              THEN CAST(JSON_VALUE(c, '$.amount') AS FLOAT64)
              ELSE 0 END)
       FROM UNNEST(credits_array) AS c),
      0
    ) AS cud_credits,
    IFNULL(
      (SELECT SUM(
         CASE WHEN JSON_VALUE(c, '$.type') = 'SUSTAINED_USE_DISCOUNT'
              THEN CAST(JSON_VALUE(c, '$.amount') AS FLOAT64)
              ELSE 0 END)
       FROM UNNEST(credits_array) AS c),
      0
    ) AS sud_credits,
    location_region        AS region,
    project_labels         AS project_labels_raw,
    labels,
    resource_type,
    invoice_month          AS invoice_month
  FROM billing
)

SELECT
  -- ── FOCUS 1.0 Required Fields ──────────────────────────────

  -- BilledCost: what you actually pay after credits
  ROUND(cost + total_credits, 6)                        AS BilledCost,

  -- ListCost: cost at list price (no discounts)
  ROUND(cost, 6)                                        AS ListCost,

  -- EffectiveCost: amortised cost (approx = BilledCost for non-commitment)
  ROUND(cost + total_credits, 6)                        AS EffectiveCost,

  -- ContractedCost: after negotiated rates (approximated)
  ROUND(cost + cud_credits, 6)                          AS ContractedCost,

  -- Billing currency
  'USD'                                                  AS BillingCurrency,

  -- Charge category
  'Usage'                                                AS ChargeCategory,

  -- ChargeDescription
  sku                                                    AS ChargeDescription,

  -- ChargeFrequency
  'Usage-Based'                                          AS ChargeFrequency,

  -- ChargePeriodStart / End
  TIMESTAMP(usage_start_time)                            AS ChargePeriodStart,
  TIMESTAMP(
    DATETIME_ADD(DATETIME(TIMESTAMP(usage_start_time)), INTERVAL 1 DAY)
  )                                                      AS ChargePeriodEnd,

  -- Provider
  'Google Cloud'                                         AS ProviderName,

  -- Publisher  
  'Google Cloud'                                         AS PublisherName,

  -- InvoiceIssuerName
  'Google Cloud'                                         AS InvoiceIssuerName,

  -- ServiceName
  service                                                AS ServiceName,

  -- ServiceCategory (FOCUS taxonomy)
  CASE
    WHEN service IN ('Compute Engine', 'Kubernetes Engine')      THEN 'Compute'
    WHEN service = 'Cloud Storage'                               THEN 'Storage'
    WHEN service IN ('BigQuery')                                 THEN 'Analytics'
    WHEN service = 'Databricks'                                  THEN 'Analytics'
    WHEN service IN ('Vertex AI')                                THEN 'AI and Machine Learning'
    WHEN service = 'Cloud SQL'                                   THEN 'Database'
    WHEN service IN ('Networking')                               THEN 'Networking'
    WHEN service IN ('Cloud Pub/Sub', 'Cloud Functions')         THEN 'Integration'
    WHEN service = 'Cloud Monitoring'                            THEN 'Management and Governance'
    ELSE 'Other'
  END                                                    AS ServiceCategory,

  -- SkuId / SkuPriceId
  sku                                                    AS SkuId,

  -- RegionId / RegionName
  region                                                 AS RegionId,
  region                                                 AS RegionName,

  -- SubAccountId / SubAccountName (= GCP Project)
  project_id                                             AS SubAccountId,
  project_id                                             AS SubAccountName,

  -- ResourceType
  resource_type                                          AS ResourceType,

  -- Tags (FOCUS uses key-value pairs)
  project_labels_raw                                     AS Tags,

  -- CUD / SUD credit breakdown (non-FOCUS but useful)
  ROUND(cud_credits, 6)                                  AS CUD_Credits,
  ROUND(sud_credits, 6)                                  AS SUD_Credits,

  -- Invoice month for grouping
  invoice_month                                          AS InvoiceMonth

FROM credits_unnested;


-- ============================================================
-- Verification query — run after creating the view
-- ============================================================
-- SELECT
--   InvoiceMonth,
--   ServiceName,
--   SubAccountId,
--   SUM(BilledCost)     AS billed_cost,
--   SUM(ListCost)       AS list_cost,
--   SUM(CUD_Credits)    AS cud_savings,
--   SUM(SUD_Credits)    AS sud_savings
-- FROM `YOUR_GCP_PROJECT_ID.gcp_finops_poc.focus_v1`
-- GROUP BY 1, 2, 3
-- ORDER BY 1, 4 DESC;
