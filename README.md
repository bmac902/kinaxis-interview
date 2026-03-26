# GCP FinOps Dashboard — FOCUS 1.0

> Built as a take-home exercise for a FinOps role at Kinaxis.
> Turned into something more.

---

## The story

GCP has always been my thinnest cloud. I know that. So when a FinOps role at Kinaxis came up, I decided to close the gap properly — not by reading about it, but by building something real on it.

I got a GCP account, loaded synthetic billing data into BigQuery, and implemented the FOCUS 1.0 spec from scratch. Hit real errors along the way: BigQuery rejecting dots in column names, `JSON_EXTRACT_ARRAY` failing on autodetected STRING columns, `InvoiceMonth` stored as integer `202412` not string `2024-12`. Debugged them live, fixed them, moved on.

Ran the CUD query. Saw 0% coverage everywhere. Recognised it immediately as the story — not a bug, a finding.

**Then I built the dashboard — with Claude Code as my pair programmer.**

I used this project as a test of AI-assisted development. The entire stack — live BigQuery integration, React Query, drill-down modal, chargeback table, savings panel, anomaly detection, live Databricks system tables, governance panel, multi-cloud overview — was built across a Thursday evening and Friday morning before the interview. Every architectural decision was mine. Claude wrote code I reviewed and directed.

That's the actual workflow I'd bring to Kinaxis: move fast with AI tooling, stay rigorous about what ships.

**Part 2 came the next morning.**

I connected the dashboard to my real Databricks free-tier account — live data, not synthetic. The first pitfall was immediate: the SQL warehouse cold-starts, and Databricks returns `PENDING` after the 50-second wait timeout instead of blocking. Added a polling loop. Problem solved.

Then I built the governance panel — tag coverage, identity coverage, attribution coverage, spend by principal. The tag coverage KPI showed 10.5% and looked wrong. Dug into it: `PREDICTIVE_OPTIMIZATION` rows carry a Databricks-managed system tag (`{"Predictive Optimization": "true"}`) that has nothing to do with user governance. It was inflating the metric. Fixed it by computing tag coverage only over `INTERACTIVE` and `SQL` workloads — the ones users actually control. Coverage dropped to 0.0%. That's the honest number.

Set up a Databricks usage policy (`finops-governance-policy`) enforcing four tags: `environment`, `team`, `cost-center`, `project`. Then built the tag coverage trend chart to show compliance over time. The 0% is a current-state finding, not a flaw — it's exactly what you'd surface on day one in a real engagement.

Last thing: the GCP billing data was already sitting in the Databricks workspace as a Delta table. That opened a different conversation — not "replace BigQuery with Databricks" but "use Databricks as the unified analytics layer for both." The Multi-Cloud Overview panel queries `workspace.default.gcp_billing_export` and `system.billing.usage` from the same SQL warehouse. One endpoint, two providers. That's the Unity Catalog pitch.

---

## What this is

![GCP FinOps Dashboard — GCP tab](docs/screenshots/dashboard-top.png)

A production-quality multi-cloud FinOps dashboard. Live BigQuery backend for GCP. Live Databricks `system.billing.usage` for Databricks. FOCUS 1.0 compliant. Executive-ready exports. Multi-cloud overview powered by Databricks Unity Catalog.

![Savings panel and chargeback table](docs/screenshots/dashboard-bottom.png)

---

## Features

### GCP Dashboard tab — live BigQuery

- **Express proxy** → BigQuery `gcp_finops_poc.focus_v1` on every load
- **FOCUS 1.0 compliance** — `BilledCost`, `ServiceCategory`, `SubAccountId`, `ChargePeriodStart`
- **Date range picker** — slice any window, all charts update live
- **Mock fallback** — runs fully offline without credentials

| Panel | What it shows |
|---|---|
| **KPI row** | Total spend, MoM growth, untagged spend, CUD opportunity |
| **Monthly Cost by Service** | Stacked bar, 9 services, MoM badge |
| **Cost by Project** | Tagged vs untagged, click to drill down to SKU level |
| **MoM Trend** | Total + 5 service categories |
| **CUD Coverage** | Every project at 0%, 1-yr and 3-yr savings per project |
| **Databricks DBU Breakdown** | Donut by workload type, bar by project |
| **Untagged Spend** | Surfaced and colour-coded by severity |
| **Savings Summary** | Executive one-pager: CUD gap + Databricks waste + tagging risk |
| **Chargeback by Team** | Live from tag data, MoM%, CSV export |
| **Anomaly Banner** | Flags month-over-month spend spikes automatically |

### Databricks Live tab — real system tables

Live data pulled directly from `system.billing.usage` via the Databricks Statement Execution API.

| Panel | What it shows |
|---|---|
| **KPI row** | Total DBUs, est. cost, interactive vs SQL split, unattributed cost |
| **DBU Usage by Day** | Stacked bar by product (INTERACTIVE, SQL, PREDICTIVE_OPTIMIZATION, AI_GATEWAY) |
| **DBU Split by Product** | Active-shape donut |
| **SKU Detail** | Full SKU breakdown with DBUs and list-price cost |
| **Governance & Attribution** | Tag coverage, identity coverage, attribution coverage |
| **Tag Coverage Trend** | Line chart by day with 50% policy threshold line |
| **Chargeback Readiness** | Pass/fail against tag + identity + attribution thresholds |
| **Workload Classification** | HIGH/MEDIUM/LOW confidence per product type |
| **Spend by Principal** | Anonymous SQL spend flagged as governance gap |
| **Multi-Cloud Overview** | GCP + Databricks spend from one SQL warehouse |

---

## Design decisions and trade-offs

### Dual-source architecture: BigQuery + Databricks

**Decision:** GCP billing data lives in BigQuery. Databricks billing data is queried from `system.billing.usage`. Two separate backends, unified by the Express proxy.

**Why:** Each source is the authoritative home for its own data. GCP's billing export pipeline writes to BigQuery natively — it's the right place to query it. `system.billing.usage` is only accessible from within Databricks. Forcing one through the other would add unnecessary complexity and ingestion lag.

**Trade-off:** Two query engines to maintain. In a team environment you'd want a single entrypoint — see "What production looks like" below.

---

### GCP data is synthetic

**Decision:** The GCP billing data is generated — 22,115 synthetic rows across 10 projects, loaded into BigQuery.

**Why:** Setting up a real GCP org billing export takes days (billing accounts, org policy, export pipeline). The goal was to demonstrate FOCUS 1.0 analysis patterns and production-quality tooling, not to wait for a real bill.

**Drawback:** The GCP numbers ($3.95M total spend) are illustrative. The schema, the SQL, the FOCUS mapping, and the findings (0% CUD coverage, $1.11M untagged) are all real and correct — just applied to synthetic input.

**What live data looks like:** Enable billing export in your GCP org → BigQuery table appears within 24 hours → point `BQ_DATASET` at it → dashboard shows real numbers. The code doesn't change.

---

### Databricks data is real

**Decision:** The Databricks tab pulls live from `system.billing.usage` with no caching or mocking.

**Why:** I have a real Databricks free-tier account. The system tables are there, the Statement Execution API works, and showing live data is more honest than synthetic data. Tag coverage is 0.0% — not because I made it up, but because that's the actual state before the governance policy was applied.

**Trade-off:** Cold warehouse starts add 30–45 seconds to the first load. The server polls the Statement Execution API until the query completes. On a pre-warmed warehouse (production) this drops to 2–3 seconds.

---

### Multi-Cloud Overview: Unity Catalog as the analytics layer

**Decision:** The Multi-Cloud Overview panel queries both `workspace.default.gcp_billing_export` (the GCP data, imported as a Delta table) and `system.billing.usage` from the same Databricks SQL warehouse. Both datasets, one query engine.

**Why:** This is the Unity Catalog value proposition. You can federate external data (GCP billing export, AWS CUR, on-prem cost files) into Databricks and govern everything from one place — one access control model, one lineage graph, one query surface.

**Drawback:** The GCP data in Databricks is a point-in-time CSV import, not a live pipeline. It goes stale the moment it's imported. This is fine for a demo; it's not a production design.

**What production looks like:** GCP Billing Export → GCS bucket → Databricks Auto Loader → Delta table (incremental, streaming). The dashboard code doesn't change — just the data stays fresh automatically.

---

### Express proxy over direct frontend queries

**Decision:** All data fetches go through an Express server (`localhost:3001`). The frontend never touches BigQuery or Databricks directly.

**Why:** Keeps credentials server-side. Allows fallback logic (BigQuery error → serve mock data). Gives a clean API contract between frontend and backend that survives data source changes.

**Trade-off:** Extra hop. In a serverless deployment (Cloud Run, Lambda) this is the right pattern anyway. For a static site it would need a rethink.

---

## Drawbacks and honest limitations

| Limitation | Impact | Fix in production |
|---|---|---|
| GCP data is synthetic | Numbers aren't real | Real billing export → BigQuery pipeline |
| GCP data in Databricks is a CSV import | Goes stale immediately | Auto Loader + GCS export schedule |
| Databricks cold-start latency | 30–45s first load | Pre-warmed warehouse or serverless SQL |
| No auth layer | Anyone with localhost access sees everything | OAuth + row-level security in Unity Catalog |
| Tag coverage 0% | Can't do chargeback today | Apply org-level usage policy + enforce tags |
| Single-region | No multi-region cost comparison | Extend FOCUS view with `Region` field |
| No alerting | Anomalies are visible but silent | Connect to PagerDuty / Slack via Cloud Functions |

---

## What production looks like

```
GCP Billing Export
    → Cloud Storage bucket (daily)
    → Databricks Auto Loader → Delta table (streaming ingest)
    → Unity Catalog: gcp_billing.focus_v1

Databricks system.billing.usage
    → Already in Unity Catalog, no pipeline needed

AWS Cost & Usage Report (future)
    → S3 → Auto Loader → Delta table
    → Unity Catalog: aws_billing.cur_v1

Dashboard
    → Databricks SQL warehouse (single endpoint)
    → Governs all three via Unity Catalog policies
    → Tag enforcement via workspace policies (already built)
    → Chargeback reports auto-exported to finance team monthly
```

One warehouse. One governance model. Three clouds.

---

## The finding

**GCP:** 0% CUD coverage across $641K of eligible quarterly compute spend. At 1-yr CUD rates (20% discount): **$513K/year**. At 3-yr rates (37%): **$948K/year**.

**Databricks:** 50.4% of DBU spend on All-Purpose Compute — the most expensive tier. Jobs Compute runs the same pipelines at 73% lower cost. Another **$67K/year** with a scheduler change.

**Governance:** 0% tag coverage on Databricks SQL workloads. $3.64 of $5.69 total Databricks spend is anonymous — no user identity, no team attribution, no chargeback possible.

**Total opportunity surfaced: $1.69M annualised.**

---

## Tech stack

```
dashboard/          React 18 + TypeScript + Vite + Tailwind + Recharts
server/             Express + @google-cloud/bigquery + Databricks Statement Execution API
focus_v1_view.sql   BigQuery FOCUS 1.0 view over gcp_billing_export
```

---

## Running it

### Prerequisites
- Node.js 18+
- A GCP project with BigQuery enabled (optional — mock data works without it)
- A Databricks workspace with system tables enabled (optional)

### Setup

```bash
npm run install:all

cp server/.env.example server/.env
# Fill in: GOOGLE_APPLICATION_CREDENTIALS, BQ_PROJECT_ID
# Optionally: DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_WAREHOUSE_ID

npm run dev
```

**Without BigQuery credentials** — the server auto-detects and serves mock data. The GCP dashboard runs fully offline.

**Without Databricks credentials** — the Databricks Live tab returns 503. Everything else works.

---

*Built with [Claude Code](https://claude.ai/claude-code) as AI pair programmer · FOCUS 1.0 · GCP BigQuery · Databricks Unity Catalog · React · TypeScript*
