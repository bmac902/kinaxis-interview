require('dotenv').config()
const express = require('express')

const app  = express()
const PORT = process.env.PORT || 3001

// ── BigQuery setup ────────────────────────────────────────────────────────────
const USE_BQ = !!(process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.BQ_PROJECT_ID)
let bqQueries, bq, VIEW

if (USE_BQ) {
  const { BigQuery } = require('@google-cloud/bigquery')
  bq   = new BigQuery({ projectId: process.env.BQ_PROJECT_ID, keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS })
  VIEW = `\`${process.env.BQ_PROJECT_ID}.${process.env.BQ_DATASET || 'gcp_finops_poc'}.focus_v1\``
  bqQueries = require('./queries')
  console.log(`✅  BigQuery connected → ${VIEW}`)
} else {
  console.log('⚠️  No BigQuery credentials — serving mock data (set GOOGLE_APPLICATION_CREDENTIALS + BQ_PROJECT_ID in .env)')
}

const mock = require('./mockFallback')

// ── Databricks setup ───────────────────────────────────────────────────────────
const dbx = require('./databricksQueries')
if (dbx.isConfigured) {
  console.log(`✅  Databricks connected → ${process.env.DATABRICKS_HOST}`)
} else {
  console.log('⚠️  No Databricks credentials — /api/databricks/usage will return 503')
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function defaultRange() {
  // Default: first and last available month
  const months = mock.getAvailableMonths()
  return { start: months[0].value, end: months[months.length - 1].value }
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, bigquery: USE_BQ, view: VIEW || null })
})

app.get('/api/months', async (_req, res) => {
  try {
    const months = USE_BQ
      ? await bqQueries.getAvailableMonths(bq, VIEW)
      : mock.getAvailableMonths()
    res.json(months)
  } catch (err) {
    console.error('/api/months error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/summary', async (req, res) => {
  const def = defaultRange()
  const start = req.query.start || def.start
  const end   = req.query.end   || def.end

  try {
    const data = USE_BQ
      ? await bqQueries.getSummary(bq, VIEW, start, end)
      : mock.getSummary(start, end)
    res.json(data)
  } catch (err) {
    console.error('/api/summary error:', err.message)
    // Fall back to mock on BQ error so the demo never breaks
    try {
      res.json(mock.getSummary(start, end))
    } catch (e) {
      res.status(500).json({ error: err.message })
    }
  }
})

app.get('/api/project/:projectId/skus', async (req, res) => {
  const { projectId } = req.params
  const def = defaultRange()
  const start = req.query.start || def.start
  const end   = req.query.end   || def.end

  try {
    const data = USE_BQ
      ? await bqQueries.getProjectSkus(bq, VIEW, projectId, start, end)
      : mock.getProjectSkus(projectId, start, end)
    res.json(data)
  } catch (err) {
    console.error('/api/project skus error:', err.message)
    try {
      res.json(mock.getProjectSkus(projectId, start, end))
    } catch (e) {
      res.status(500).json({ error: err.message })
    }
  }
})

app.get('/api/chargeback', async (req, res) => {
  const def = defaultRange()
  const start = req.query.start || def.start
  const end   = req.query.end   || def.end

  try {
    const data = USE_BQ
      ? await bqQueries.getChargeback(bq, VIEW, start, end)
      : mock.getChargeback(start, end)
    res.json(data)
  } catch (err) {
    console.error('/api/chargeback error:', err.message)
    try { res.json(mock.getChargeback(start, end)) }
    catch (e) { res.status(500).json({ error: err.message }) }
  }
})

app.get('/api/databricks/usage', async (_req, res) => {
  if (!dbx.isConfigured) {
    return res.status(503).json({ error: 'Databricks not configured' })
  }
  try {
    const data = await dbx.getDatabricksUsage()
    res.json(data)
  } catch (err) {
    console.error('/api/databricks/usage error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`🚀  FinOps server on http://localhost:${PORT}`)
})
