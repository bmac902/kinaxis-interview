-- ============================================================
-- GCP FinOps Sample Queries — Kinaxis POC
-- Run these in BigQuery against gcp_billing_export table
-- or against the focus_v1 view
--
-- Replace `your_project.your_dataset` throughout
-- ============================================================


-- ── 1. Monthly cost by service ────────────────────────────────────────────────
-- Q: Where is the money going at the service level?

SELECT
  invoice_month,
  ServiceName,
  ROUND(SUM(BilledCost), 2)   AS billed_cost,
  ROUND(SUM(ListCost), 2)     AS list_cost,
  ROUND(SUM(CUD_Credits), 2)  AS cud_savings,
  ROUND(SUM(SUD_Credits), 2)  AS sud_savings
FROM `your_project.your_dataset.focus_v1`
GROUP BY 1, 2
ORDER BY 1, 3 DESC;


-- ── 2. Cost by team (via project labels) ─────────────────────────────────────
-- Q: Which team is spending the most? (chargeback foundation)

SELECT
  invoice_month,
  SubAccountId                                      AS project,
  JSON_EXTRACT_SCALAR(Tags, '$.team')               AS team,
  JSON_EXTRACT_SCALAR(Tags, '$.environment')        AS environment,
  ROUND(SUM(BilledCost), 2)                         AS billed_cost
FROM `your_project.your_dataset.focus_v1`
GROUP BY 1, 2, 3, 4
ORDER BY 1, 5 DESC;


-- ── 3. Untagged cost — tagging governance gap ─────────────────────────────────
-- Q: How much spend has no team label? (FinOps waste signal)

SELECT
  invoice_month,
  SubAccountId                                      AS project,
  ROUND(SUM(BilledCost), 2)                         AS untagged_billed_cost
FROM `your_project.your_dataset.focus_v1`
WHERE JSON_EXTRACT_SCALAR(Tags, '$.team') IS NULL
GROUP BY 1, 2
ORDER BY 1, 3 DESC;


-- ── 4. Databricks cost breakdown ──────────────────────────────────────────────
-- Q: What are Databricks DBU costs by workload type and project?

SELECT
  invoice_month,
  SubAccountId                                      AS project,
  ChargeDescription                                 AS dbu_tier,
  ROUND(SUM(BilledCost), 2)                         AS cost,
  ROUND(SUM(ListCost), 2)                           AS list_cost
FROM `your_project.your_dataset.focus_v1`
WHERE ServiceName = 'Databricks'
GROUP BY 1, 2, 3
ORDER BY 1, 4 DESC;


-- ── 5. CUD coverage analysis ──────────────────────────────────────────────────
-- Q: Which projects have CUD coverage? Which don't? (commitment gap finder)

SELECT
  invoice_month,
  SubAccountId                                      AS project,
  ServiceName,
  ROUND(SUM(ListCost), 2)                           AS list_cost,
  ROUND(SUM(CUD_Credits), 2)                        AS cud_credits,
  ROUND(SUM(SUD_Credits), 2)                        AS sud_credits,
  ROUND(SUM(BilledCost), 2)                         AS billed_cost,
  ROUND(ABS(SUM(CUD_Credits)) / NULLIF(SUM(ListCost), 0) * 100, 1)
                                                    AS cud_coverage_pct
FROM `your_project.your_dataset.focus_v1`
WHERE ServiceName IN ('Compute Engine', 'BigQuery')
GROUP BY 1, 2, 3
ORDER BY 1, 8 ASC;   -- lowest coverage first = biggest opportunity


-- ── 6. GPU cost — no CUD on ml-inference-prod ────────────────────────────────
-- Q: Where is GPU spend highest and what is the CUD savings opportunity?

SELECT
  invoice_month,
  SubAccountId                                      AS project,
  ChargeDescription,
  ROUND(SUM(ListCost), 2)                           AS list_cost,
  ROUND(SUM(CUD_Credits), 2)                        AS cud_credits,
  ROUND(SUM(BilledCost), 2)                         AS billed_cost,
  ROUND(SUM(ListCost) * 0.37, 2)                    AS potential_3yr_cud_savings
FROM `your_project.your_dataset.focus_v1`
WHERE ResourceType IN ('gpu', 'ai')
GROUP BY 1, 2, 3
ORDER BY 1, 4 DESC;
-- Expected: ml-inference-prod shows $0 CUD credits — that's the gap to flag


-- ── 7. Month-over-month growth by service ────────────────────────────────────
-- Q: Is cost growth tracking sub-linearly vs. revenue? (exec KPI)

WITH monthly AS (
  SELECT
    invoice_month,
    ServiceName,
    ROUND(SUM(BilledCost), 2) AS billed_cost
  FROM `your_project.your_dataset.focus_v1`
  GROUP BY 1, 2
),
with_prev AS (
  SELECT
    *,
    LAG(billed_cost) OVER (PARTITION BY ServiceName ORDER BY invoice_month) AS prev_cost
  FROM monthly
)
SELECT
  invoice_month,
  ServiceName,
  billed_cost,
  prev_cost,
  ROUND((billed_cost - prev_cost) / NULLIF(prev_cost, 0) * 100, 1) AS mom_growth_pct
FROM with_prev
WHERE prev_cost IS NOT NULL
ORDER BY invoice_month, mom_growth_pct DESC;


-- ── 8. Legacy project idle cost ───────────────────────────────────────────────
-- Q: What is the cost of the legacy-migration-proj with no team label?
--    This is the "stopped VM still costing money" equivalent on GCP.

SELECT
  invoice_month,
  SubAccountId                                      AS project,
  ServiceName,
  ChargeDescription,
  ROUND(SUM(BilledCost), 2)                         AS billed_cost
FROM `your_project.your_dataset.focus_v1`
WHERE SubAccountId = 'legacy-migration-proj'
GROUP BY 1, 2, 3, 4
ORDER BY 1, 5 DESC;


-- ── 9. ServiceCategory spend (FOCUS taxonomy) ────────────────────────────────
-- Q: FOCUS-standard cost breakdown for cross-cloud comparison

SELECT
  invoice_month,
  ServiceCategory,
  ROUND(SUM(BilledCost), 2)   AS billed_cost,
  ROUND(SUM(CUD_Credits), 2)  AS discount_credits
FROM `your_project.your_dataset.focus_v1`
GROUP BY 1, 2
ORDER BY 1, 3 DESC;


-- ── 10. Top 10 most expensive SKUs this month ────────────────────────────────
SELECT
  ChargeDescription,
  ServiceName,
  SubAccountId,
  ROUND(SUM(BilledCost), 2) AS billed_cost
FROM `your_project.your_dataset.focus_v1`
WHERE invoice_month = FORMAT_DATE('%Y%m', DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH))
GROUP BY 1, 2, 3
ORDER BY 4 DESC
LIMIT 10;
