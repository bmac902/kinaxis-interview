# GCP FinOps Dashboard — FOCUS 1.0

> Built as a take-home exercise for a FinOps role at Kinaxis.
> Turned into something more.

---

## The story

**Friday night, 9:30 PM.**
Found out the thinnest part of my cloud knowledge was GCP. Instead of noting it and moving on, I opened the docs. By midnight I was watching Databricks cost videos and reading the FOCUS 1.0 BigQuery spec. Not because anyone told me to. Because I couldn't stop.

**Saturday morning, coffee in hand.**
Opened a GCP account from scratch. First command — hit a real error. BigQuery doesn't allow dots in column names. `service.id` rejected. Debugged it, fixed it, reloaded. Clean.

Created the FOCUS 1.0 view. Hit a JSON parsing error on the credits column — `JSON_EXTRACT_ARRAY` doesn't work on autodetected STRING columns in BigQuery. Debugged it live in the console. Fixed it.

Ran the CUD query. Saw 0% coverage everywhere. Recognised it immediately as the story — not a bug, a finding.

**Then I built.**

In three hours, starting from a working BigQuery dataset:

---

## What this is

![GCP FinOps Dashboard](docs/screenshots/dashboard-top.png)

A production-quality GCP FinOps dashboard. Live BigQuery backend. FOCUS 1.0 compliant. Executive-ready exports. Not a demo — the thing you'd actually deploy.

![Savings panel and chargeback table](docs/screenshots/dashboard-bottom.png)

---

## Features

### Live data pipeline
- **Express proxy** → BigQuery `gcp_finops_poc.focus_v1` on every load
- **FOCUS 1.0 compliance** — every metric uses standard field names: `BilledCost`, `ServiceCategory`, `SubAccountId`, `ChargePeriodStart`
- **Date range picker** — slice any window, all charts update live
- **Mock fallback** — runs fully offline without credentials (for demos)

### Dashboard panels
| Panel | What it shows |
|---|---|
| **KPI row** | Total spend, MoM growth, untagged spend, CUD opportunity — all with live status badges |
| **Monthly Cost by Service** | Stacked bar, 9 services, MoM badge computed from real data |
| **Cost by Project** | Tagged vs untagged highlighted in red, click to drill down |
| **MoM Trend** | Total + 5 service categories, Dec through Feb |
| **CUD Coverage** | Every project at 0%, 1-yr and 3-yr savings calculated per project |
| **Databricks DBU Breakdown** | Donut by workload type, bar by project, migration recommendation |
| **Untagged Spend** | $1.11M surfaced, colour-coded by severity (100% vs partial) |

### Savings & Risk Summary
The executive one-pager — three line items, one number:

| Finding | Action | Value |
|---|---|---|
| CUD gap (0% coverage) | Purchase 1-yr CUDs for top 3 compute projects | **$513K/yr** |
| Databricks All-Purpose waste | Migrate interactive notebooks to Jobs Compute | **$67K/yr** |
| Untagged spend | Enforce team + cost-center labels via org policy | **$1.11M at risk** |
| | **Total annualised opportunity** | **$1.69M** |

### Chargeback by Team
- Live from tag data (`JSON_VALUE(Tags, '$.team')`)
- Sortable by total, last month cost, or MoM%
- Untagged rows flagged in red with "no label" badge
- **Export CSV** — one click, ready for the finance team

### Drill-down & Export
- Click any project bar → modal shows full SKU breakdown with percentages
- **CSV export** — all 6 datasets in one file
- **PDF export** — `window.print()` with print-optimised layout

---

## Tech stack

```
dashboard/          React 18 + TypeScript + Vite + Tailwind + Recharts
server/             Express + @google-cloud/bigquery
focus_v1_view.sql   BigQuery FOCUS 1.0 view over gcp_billing_export
```

**Data:** 22,115 synthetic GCP billing rows across 10 projects, Dec 2024 – Feb 2025, loaded into BigQuery and queried live through the FOCUS view.

---

## Running it

### Prerequisites
- Node.js 18+
- A GCP project with BigQuery enabled
- The `gcp_finops_poc.focus_v1` view (see `focus_v1_view.sql`)

### Setup

```bash
# Install all dependencies
npm run install:all

# Configure server credentials
cp server/.env.example server/.env
# Fill in: GOOGLE_APPLICATION_CREDENTIALS, BQ_PROJECT_ID

# Start both server + dashboard
npm run dev
```

**Without BigQuery credentials** — the server auto-detects and serves mock data. The dashboard runs fully offline.

### BigQuery setup

```bash
# Load the billing export
bash load_to_bigquery.sh

# Create the FOCUS 1.0 view
# Run focus_v1_view.sql in BigQuery console
# Replace YOUR_GCP_PROJECT_ID with your project
```

---

## The finding

0% CUD coverage across $641K of eligible quarterly compute spend.

That's not a misconfiguration. That's a purchasing decision that hasn't been made. At 1-yr CUD rates (20% discount), that's **$513K/year left on the table**. At 3-yr rates (37%), it's **$948K/year**.

The Databricks finding is separate: 50.4% of DBU spend on All-Purpose Compute — the most expensive tier, designed for interactive development, not production workloads. Jobs Compute runs the same pipelines at 73% lower cost. That's another **$67K/year** with a scheduler change.

Total opportunity surfaced in one dashboard: **$1.69M annualised.**

---

*Built with [Claude Code](https://claude.ai/claude-code) · FOCUS 1.0 · GCP BigQuery · React · TypeScript*
