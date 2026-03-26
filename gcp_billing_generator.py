#!/usr/bin/env python3
"""
GCP Billing Synthetic Data Generator
=====================================
Generates realistic GCP billing export data matching the exact
gcp_billing_export_v1 schema, modelled on a Kinaxis-like SaaS company.

Includes:
- Compute Engine (VMs, GPUs)
- Cloud Storage
- BigQuery
- Databricks (via GCP Marketplace)
- Kubernetes Engine (GKE)
- Cloud SQL
- Networking (egress, load balancers)
- Vertex AI / AI Platform
- Pub/Sub
- Cloud Functions
- Committed Use Discounts (CUDs) - resource and spend-based
- Tagging gaps (intentional) for FinOps discovery practice
- Idle/waste signals to find

Output:
  gcp_billing_export.csv        - main billing table (gcp_billing_export_v1 schema)
  focus_v1_view.sql             - BigQuery SQL view transforming to FOCUS 1.0
  sample_queries.sql            - FinOps queries to run against the data
  load_to_bigquery.sh           - shell script to load into BigQuery

Usage:
  python3 gcp_billing_generator.py
  bash load_to_bigquery.sh <your-project-id> <your-dataset-name>
"""

import csv
import json
import random
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

random.seed(42)

# ── Configuration ──────────────────────────────────────────────────────────────

BILLING_ACCOUNT_ID = "01A2B3-C4D5E6-F7G8H9"
COMPANY            = "kinaxis-saas-poc"
START_DATE         = datetime(2024, 12, 1, tzinfo=timezone.utc)
END_DATE           = datetime(2025, 3, 1, tzinfo=timezone.utc)

# GCP Projects — mimic a real SaaS org hierarchy
PROJECTS = [
    {"id": "maestro-platform-prod",   "name": "Maestro Platform (Prod)",   "team": "platform-engineering", "env": "production"},
    {"id": "maestro-platform-dev",    "name": "Maestro Platform (Dev)",    "team": "platform-engineering", "env": "development"},
    {"id": "data-analytics-prod",     "name": "Data & Analytics (Prod)",   "team": "data-analytics",       "env": "production"},
    {"id": "ml-inference-prod",       "name": "ML Inference (Prod)",       "team": "ml-platform",          "env": "production"},
    {"id": "ml-training-prod",        "name": "ML Training (Prod)",        "team": "ml-platform",          "env": "production"},
    {"id": "supply-chain-api-prod",   "name": "Supply Chain API (Prod)",   "team": "supply-chain",         "env": "production"},
    {"id": "customer-portal-prod",    "name": "Customer Portal (Prod)",    "team": "product",              "env": "production"},
    {"id": "devops-tooling",          "name": "DevOps Tooling",            "team": "devops",               "env": "shared"},
    {"id": "shared-services",         "name": "Shared Services",           "team": None,                   "env": "shared"},   # intentional tagging gap
    {"id": "legacy-migration-proj",   "name": "Legacy Migration (Idle)",   "team": None,                   "env": None},       # waste signal
]

REGIONS = ["us-central1", "us-east1", "us-east4", "northamerica-northeast1", "europe-west1"]

# ── SKU definitions ────────────────────────────────────────────────────────────
# Each entry: (service_desc, sku_desc, unit, base_unit_cost, daily_qty_range, resource_type)

SKUS = [
    # Compute Engine — standard VMs
    ("Compute Engine", "N2 Instance Core running in Americas",          "hour",    0.031171, (200,  600),  "compute"),
    ("Compute Engine", "N2 Instance Ram running in Americas",           "gibibyte hour", 0.004177, (800, 2400), "compute"),
    ("Compute Engine", "E2 Instance Core running in Americas",          "hour",    0.021811, (100,  300),  "compute"),
    ("Compute Engine", "E2 Instance Ram running in Americas",           "gibibyte hour", 0.002923, (400, 1200), "compute"),
    # Compute Engine — GPU
    ("Compute Engine", "Nvidia T4 GPU running in Americas",             "hour",    0.350000, (48,   168),  "gpu"),
    ("Compute Engine", "Nvidia A100 40GB GPU running in Americas",      "hour",    2.933800, (24,    72),  "gpu"),
    # Compute Engine — storage
    ("Compute Engine", "Storage PD Capacity in us-central1",           "gibibyte month", 0.040000, (5000, 15000), "storage"),
    ("Compute Engine", "Storage PD Capacity in us-east1",              "gibibyte month", 0.040000, (2000,  8000), "storage"),
    # GKE
    ("Kubernetes Engine", "GKE Cluster Management Fee",                "hour",    0.100000, (720,   720),  "compute"),
    ("Kubernetes Engine", "Autopilot Pod requests CPU",                "cpu second", 0.00001011, (500000, 1500000), "compute"),
    ("Kubernetes Engine", "Autopilot Pod requests memory",             "gibibyte second", 0.00000106, (2000000, 5000000), "compute"),
    # Cloud Storage
    ("Cloud Storage",    "Standard Storage US Multi-region",           "gibibyte month", 0.026000, (10000, 50000), "storage"),
    ("Cloud Storage",    "Class A Operations",                         "operation", 0.000005, (5000000, 20000000), "storage"),
    ("Cloud Storage",    "Class B Operations",                         "operation", 0.0000004, (10000000, 50000000), "storage"),
    ("Cloud Storage",    "Nearline Storage US",                        "gibibyte month", 0.010000, (20000, 80000), "storage"),
    # BigQuery
    ("BigQuery",         "Analysis - queries",                         "tebibyte", 5.000000, (5, 40), "analytics"),
    ("BigQuery",         "Active Storage",                             "gibibyte month", 0.020000, (3000, 12000), "analytics"),
    ("BigQuery",         "Long-term Storage",                          "gibibyte month", 0.010000, (5000, 20000), "analytics"),
    ("BigQuery",         "Streaming Inserts",                          "gibibyte", 0.010000, (100, 500), "analytics"),
    # Databricks (GCP Marketplace)
    ("Databricks",       "Databricks Premium All-Purpose Compute DBUs","DBU hour", 0.550000, (200,  800),  "databricks"),
    ("Databricks",       "Databricks Premium Jobs Compute DBUs",       "DBU hour", 0.150000, (500, 2000),  "databricks"),
    ("Databricks",       "Databricks Premium SQL Compute DBUs",        "DBU hour", 0.220000, (100,  400),  "databricks"),
    ("Databricks",       "Databricks Premium DLT Core DBUs",           "DBU hour", 0.200000, (50,   200),  "databricks"),
    # Vertex AI
    ("Vertex AI",        "Prediction - Online - N1 CPU",               "node hour", 0.090000, (200, 600), "ai"),
    ("Vertex AI",        "Custom Training - A100 GPU",                 "node hour", 3.673800, (24,   96),  "ai"),
    ("Vertex AI",        "Gemini 1.5 Pro - Input characters",          "character", 0.0000000035, (500000000, 2000000000), "ai"),
    ("Vertex AI",        "Gemini 1.5 Pro - Output characters",         "character", 0.0000000105, (100000000, 500000000), "ai"),
    # Cloud SQL
    ("Cloud SQL",        "Cloud SQL for PostgreSQL (db-custom-4-15360) in us-central1", "hour", 0.540000, (720, 720), "database"),
    ("Cloud SQL",        "Cloud SQL for PostgreSQL storage",           "gibibyte month", 0.170000, (500, 2000), "database"),
    # Networking
    ("Networking",       "Premium Tier Egress Americas to Americas",   "gibibyte", 0.080000, (500, 3000), "network"),
    ("Networking",       "Premium Tier Egress Americas to Europe",     "gibibyte", 0.085000, (100,  500), "network"),
    ("Networking",       "Cloud Load Balancing Forwarding Rule",       "hour",    0.025000, (720,  720), "network"),
    ("Networking",       "Cloud NAT Gateway Uptime",                   "hour",    0.044000, (720,  720), "network"),
    # Pub/Sub
    ("Cloud Pub/Sub",    "Message Delivery Basic",                     "tebibyte", 40.000000, (0.5,  5.0), "messaging"),
    # Cloud Functions
    ("Cloud Functions",  "CPU time",                                   "GHz second", 0.000024, (500000, 2000000), "serverless"),
    ("Cloud Functions",  "Memory time",                                "GB second",  0.0000025, (500000, 2000000), "serverless"),
    ("Cloud Functions",  "Invocations",                                "invocation", 0.0000004, (5000000, 20000000), "serverless"),
    # Cloud Monitoring
    ("Cloud Monitoring", "Metric data ingested",                       "mebibyte", 0.258000, (1000, 5000), "operations"),
    # Support
    ("Support",          "Enhanced Support",                           "month",   1500.000000, (1, 1), "support"),
]

# CUD definitions — resource-based (vCPU/RAM) and spend-based
CUDS = [
    {"name": "cud-n2-prod-1yr",    "type": "COMMITTED_USAGE_DISCOUNT", "service": "Compute Engine",
     "description": "1-year N2 CPU Committed Use Discount", "discount_pct": 0.20,
     "projects": ["maestro-platform-prod", "supply-chain-api-prod"]},
    {"name": "cud-n2-prod-3yr",    "type": "COMMITTED_USAGE_DISCOUNT", "service": "Compute Engine",
     "description": "3-year N2 CPU Committed Use Discount", "discount_pct": 0.37,
     "projects": ["data-analytics-prod"]},
    {"name": "cud-memory-1yr",     "type": "COMMITTED_USAGE_DISCOUNT", "service": "Compute Engine",
     "description": "1-year N2 RAM Committed Use Discount", "discount_pct": 0.20,
     "projects": ["maestro-platform-prod"]},
    {"name": "cud-bigquery-spend", "type": "COMMITTED_USAGE_DISCOUNT_DOLLAR_BASE", "service": "BigQuery",
     "description": "BigQuery Spend-Based CUD (1-year $5k/mo)", "discount_pct": 0.15,
     "projects": ["data-analytics-prod", "ml-training-prod"]},
    # Intentionally NO CUD on ml-inference-prod GPU — waste signal to find
]

# ── Helpers ────────────────────────────────────────────────────────────────────

def random_date_in_range(start: datetime, end: datetime) -> datetime:
    delta = end - start
    return start + timedelta(seconds=random.randint(0, int(delta.total_seconds())))

def make_labels(project: dict, extra: dict = None) -> list:
    """Return list of {key, value} label dicts. Sometimes drop labels = tagging gap."""
    labels = []
    if project["team"]:
        labels.append({"key": "team",        "value": project["team"]})
    if project["env"]:
        labels.append({"key": "environment", "value": project["env"]})
    labels.append({"key": "cost-center", "value": "cc-" + (project["team"] or "unknown")[:8]})
    if extra:
        for k, v in extra.items():
            labels.append({"key": k, "value": v})
    # Simulate tagging gaps: shared-services and legacy project have no team label
    if project["id"] in ("shared-services", "legacy-migration-proj"):
        labels = [l for l in labels if l["key"] not in ("team", "cost-center")]
    return labels

def make_credits(cost: float, sku_desc: str, project_id: str, cud_map: dict, svc_desc: str = "") -> list:
    """Apply CUD credits where applicable."""
    credits = []
    for cud in CUDS:
        if project_id in cud["projects"]:
            if cud["service"] == "Compute Engine" and cud["service"] in svc_desc:
                if "CPU" in cud["description"] and "Core" in sku_desc:
                    credits.append({
                        "name": cud["name"],
                        "full_name": cud["description"],
                        "type": cud["type"],
                        "amount": round(-cost * cud["discount_pct"], 6)
                    })
                elif "RAM" in cud["description"] and "Ram" in sku_desc:
                    credits.append({
                        "name": cud["name"],
                        "full_name": cud["description"],
                        "type": cud["type"],
                        "amount": round(-cost * cud["discount_pct"], 6)
                    })
            elif cud["service"] == "BigQuery" and "BigQuery" in sku_desc:
                credits.append({
                    "name": cud["name"],
                    "full_name": cud["description"],
                    "type": cud["type"],
                    "amount": round(-cost * cud["discount_pct"], 6)
                })
    # Sustained use discounts on Compute (automatic ~20% for 100% month usage)
    if "Instance Core" in sku_desc or "Instance Ram" in sku_desc:
        credits.append({
            "name": "sustained-use-discount",
            "full_name": "Sustained use discount",
            "type": "SUSTAINED_USE_DISCOUNT",
            "amount": round(-cost * 0.20, 6)
        })
    return credits

# ── Main generator ─────────────────────────────────────────────────────────────

def generate_billing_rows():
    rows = []
    current = START_DATE

    while current < END_DATE:
        next_day = current + timedelta(days=1)

        for project in PROJECTS:
            # Legacy project: only runs minimal storage — waste signal
            if project["id"] == "legacy-migration-proj":
                active_skus = [s for s in SKUS if s[5] == "storage"][:2]
            # ML training: GPU heavy
            elif project["id"] == "ml-training-prod":
                active_skus = [s for s in SKUS if s[5] in ("gpu", "ai", "storage", "databricks")]
            # Data analytics: BigQuery + Databricks heavy
            elif project["id"] == "data-analytics-prod":
                active_skus = [s for s in SKUS if s[5] in ("analytics", "databricks", "storage", "compute")]
            # ML inference: GPU + Vertex AI (no CUD — the waste to find)
            elif project["id"] == "ml-inference-prod":
                active_skus = [s for s in SKUS if s[5] in ("gpu", "ai", "compute", "network")]
            else:
                active_skus = SKUS

            for sku in active_skus:
                svc_desc, sku_desc, unit, unit_cost, qty_range, resource_type = sku

                # Skip some SKUs per project randomly to keep data realistic
                if random.random() < 0.15:
                    continue

                qty = random.uniform(*qty_range)

                # Add weekend dip for non-production
                if current.weekday() >= 5 and project["env"] == "development":
                    qty *= 0.2

                # Add monthly growth trend (8% MoM — reflecting Kinaxis 18% ARR growth)
                months_in = (current - START_DATE).days / 30
                qty *= (1 + 0.08) ** months_in

                cost = round(qty * unit_cost, 6)

                # Build credits
                credits = make_credits(cost, sku_desc, project["id"], CUDS, svc_desc)
                credit_amount = sum(c["amount"] for c in credits)

                labels = make_labels(project, {"resource-type": resource_type})

                # Randomly drop labels on ~15% of rows — creates untagged cost to discover
                if random.random() < 0.15:
                    labels = [l for l in labels if l["key"] not in ("team", "cost-center")]

                row = {
                    "billing_account_id":   BILLING_ACCOUNT_ID,
                    "service.id":           "svc-" + svc_desc.lower().replace(" ", "-")[:20],
                    "service.description":  svc_desc,
                    "sku.id":               "sku-" + str(uuid.uuid4())[:8],
                    "sku.description":      sku_desc,
                    "usage_start_time":     current.strftime("%Y-%m-%d %H:%M:%S UTC"),
                    "usage_end_time":       next_day.strftime("%Y-%m-%d %H:%M:%S UTC"),
                    "project.id":           project["id"],
                    "project.name":         project["name"],
                    "project.labels":       json.dumps({l["key"]: l["value"] for l in labels}),
                    "labels":               json.dumps(labels),
                    "location.location":    random.choice(REGIONS),
                    "location.country":     "US",
                    "location.region":      random.choice(REGIONS),
                    "location.zone":        random.choice(REGIONS) + "-a",
                    "cost":                 round(cost, 6),
                    "currency":             "USD",
                    "currency_conversion_rate": 1.0,
                    "usage.amount":         round(qty, 4),
                    "usage.unit":           unit,
                    "usage.amount_in_pricing_units": round(qty, 4),
                    "usage.pricing_unit":   unit,
                    "credits":              json.dumps(credits),
                    "invoice.month":        current.strftime("%Y%m"),
                    "cost_type":            "regular",
                    "adjustment_info.id":   "",
                    "adjustment_info.description": "",
                    "adjustment_info.mode": "",
                    "adjustment_info.type": "",
                    "export_time":          datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
                    "resource_type":        resource_type,
                }
                rows.append(row)

        current = next_day
        if current.day == 1:
            print(f"  Generated through {current.strftime('%Y-%m')}")

    return rows


def write_csv(rows, path):
    if not rows:
        return
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    print(f"✅ Written: {path}  ({len(rows):,} rows)")


def write_focus_view(path):
    sql = """\
-- ============================================================
-- FOCUS 1.0 View over GCP Billing Export
-- FinOps Open Cost and Usage Specification (FOCUS) v1.0
-- Load into BigQuery after importing gcp_billing_export.csv
--
-- Usage:
--   Replace `your_project.your_dataset` with your actual
--   BigQuery project and dataset name.
-- ============================================================

CREATE OR REPLACE VIEW `your_project.your_dataset.focus_v1` AS

WITH billing AS (
  SELECT
    *,
    -- Parse credits JSON array
    JSON_EXTRACT_ARRAY(credits) AS credits_array,
    -- Parse labels JSON array  
    JSON_EXTRACT_ARRAY(labels)  AS labels_array
  FROM `your_project.your_dataset.gcp_billing_export`
),

credits_unnested AS (
  SELECT
    billing_account_id,
    `service.description`  AS service,
    `sku.description`       AS sku,
    `project.id`            AS project_id,
    usage_start_time,
    cost,
    IFNULL(
      (SELECT SUM(CAST(JSON_EXTRACT_SCALAR(c, '$.amount') AS FLOAT64))
       FROM UNNEST(credits_array) AS c),
      0
    ) AS total_credits,
    IFNULL(
      (SELECT SUM(
         CASE WHEN JSON_EXTRACT_SCALAR(c, '$.type') = 'COMMITTED_USAGE_DISCOUNT'
                   OR JSON_EXTRACT_SCALAR(c, '$.type') = 'COMMITTED_USAGE_DISCOUNT_DOLLAR_BASE'
              THEN CAST(JSON_EXTRACT_SCALAR(c, '$.amount') AS FLOAT64)
              ELSE 0 END)
       FROM UNNEST(credits_array) AS c),
      0
    ) AS cud_credits,
    IFNULL(
      (SELECT SUM(
         CASE WHEN JSON_EXTRACT_SCALAR(c, '$.type') = 'SUSTAINED_USE_DISCOUNT'
              THEN CAST(JSON_EXTRACT_SCALAR(c, '$.amount') AS FLOAT64)
              ELSE 0 END)
       FROM UNNEST(credits_array) AS c),
      0
    ) AS sud_credits,
    `location.region`       AS region,
    `project.labels`        AS project_labels_raw,
    labels,
    resource_type,
    `invoice.month`         AS invoice_month
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
-- FROM `your_project.your_dataset.focus_v1`
-- GROUP BY 1, 2, 3
-- ORDER BY 1, 4 DESC;
"""
    Path(path).write_text(sql)
    print(f"✅ Written: {path}")


def write_sample_queries(path):
    sql = """\
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
"""
    Path(path).write_text(sql)
    print(f"✅ Written: {path}")


def write_load_script(path, csv_filename):
    script = f"""\
#!/bin/bash
# ============================================================
# Load GCP synthetic billing data into BigQuery
# Usage: bash load_to_bigquery.sh <project-id> <dataset-name>
# Example: bash load_to_bigquery.sh my-gcp-project gcp_finops_poc
# ============================================================

set -e

PROJECT_ID="${{1:?Usage: $0 <project-id> <dataset-name>}}"
DATASET="${{2:?Usage: $0 <project-id> <dataset-name>}}"
TABLE="gcp_billing_export"
CSV_FILE="{csv_filename}"

echo "📦 Creating dataset $DATASET in project $PROJECT_ID..."
bq mk --dataset --location=US "$PROJECT_ID:$DATASET" 2>/dev/null || echo "Dataset already exists."

echo "⬆️  Loading $CSV_FILE into $PROJECT_ID:$DATASET.$TABLE..."
bq load \\
  --source_format=CSV \\
  --skip_leading_rows=1 \\
  --autodetect \\
  --replace \\
  "$PROJECT_ID:$DATASET.$TABLE" \\
  "$CSV_FILE"

echo "✅ Load complete!"
echo ""
echo "Next steps:"
echo "  1. Open BigQuery console: https://console.cloud.google.com/bigquery"
echo "  2. Replace 'your_project.your_dataset' in focus_v1_view.sql with:"
echo "     $PROJECT_ID.$DATASET"
echo "  3. Run focus_v1_view.sql to create the FOCUS 1.0 view"
echo "  4. Run queries from sample_queries.sql"
echo ""
echo "💡 Interesting things to find in the data:"
echo "  - legacy-migration-proj: untagged idle storage cost (waste signal)"
echo "  - ml-inference-prod: GPU spend with ZERO CUD coverage (commitment gap)"
echo "  - shared-services: untagged cost with no team attribution"
echo "  - Databricks All-Purpose vs Jobs Compute cost ratio"
echo "  - Month-over-month 8% growth trend across all services"
"""
    Path(path).write_text(script)
    print(f"✅ Written: {path}")


# ── Run ────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    output_dir = Path(".")
    output_dir.mkdir(exist_ok=True)

    print("🏗️  Generating GCP synthetic billing data...")
    print(f"   Period: {START_DATE.date()} → {END_DATE.date()}")
    print(f"   Projects: {len(PROJECTS)}")
    print(f"   SKUs: {len(SKUS)}")
    print()

    rows = generate_billing_rows()

    csv_path = output_dir / "gcp_billing_export.csv"
    write_csv(rows, csv_path)

    write_focus_view(output_dir / "focus_v1_view.sql")
    write_sample_queries(output_dir / "sample_queries.sql")
    write_load_script(output_dir / "load_to_bigquery.sh", "gcp_billing_export.csv")

    # Summary stats
    total_cost = sum(r["cost"] for r in rows)
    total_credits = sum(
        sum(c["amount"] for c in json.loads(r["credits"]))
        for r in rows
    )

    print()
    print("=" * 55)
    print("📊 Dataset Summary")
    print("=" * 55)
    print(f"  Rows generated:      {len(rows):>12,}")
    print(f"  Gross list cost:     ${total_cost:>12,.2f}")
    print(f"  Total credits:       ${total_credits:>12,.2f}")
    print(f"  Net billed cost:     ${total_cost + total_credits:>12,.2f}")
    print()
    print("🔍 Intentional waste signals to find:")
    print("  • legacy-migration-proj  — idle storage, no team tag")
    print("  • ml-inference-prod      — GPU with no CUD coverage")
    print("  • shared-services        — untagged spend ($??/mo)")
    print("  • ~15% of all rows       — missing team/cost-center labels")
    print()
    print("📁 Output files:")
    for f in sorted(output_dir.iterdir()):
        size = f.stat().st_size
        print(f"  {f.name:<35} {size/1024:>8.1f} KB")
    print()
    print("🚀 Ready to load! Run:")
    print(f"  cd {output_dir}")
    print("  bash load_to_bigquery.sh <your-project-id> gcp_finops_poc")
