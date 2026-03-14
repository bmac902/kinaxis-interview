#!/bin/bash
# ============================================================
# Load GCP synthetic billing data into BigQuery
# Usage: bash load_to_bigquery.sh <project-id> <dataset-name>
# Example: bash load_to_bigquery.sh my-gcp-project gcp_finops_poc
# ============================================================

set -e

PROJECT_ID="${1:?Usage: $0 <project-id> <dataset-name>}"
DATASET="${2:?Usage: $0 <project-id> <dataset-name>}"
TABLE="gcp_billing_export"
CSV_FILE="gcp_billing_export_fixed.csv"

echo "📦 Creating dataset $DATASET in project $PROJECT_ID..."
bq mk --dataset --location=US "$PROJECT_ID:$DATASET" 2>/dev/null || echo "Dataset already exists."

echo "⬆️  Loading $CSV_FILE into $PROJECT_ID:$DATASET.$TABLE..."
bq load \
  --source_format=CSV \
  --skip_leading_rows=1 \
  --autodetect \
  --replace \
  "$PROJECT_ID:$DATASET.$TABLE" \
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
