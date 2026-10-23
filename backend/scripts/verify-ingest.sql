-- Verification queries for nightly screener ingestion (Phase 5).
-- Run after a full ingest pass:
--   psql "$DATABASE_URL" -f backend/scripts/verify-ingest.sql
--
-- Expected (57 active companies):
--   screener_metrics: 57 rows with market_cap and price populated
--   daily_prices:     ~240–260 bars per active company
--   fundamentals:     multi-year rows with revenue/net_income/assets/equity

\echo '=== (1) screener_metrics coverage ==='
SELECT
  (SELECT count(*)::int FROM companies WHERE is_active = true) AS active_companies,
  (SELECT count(*)::int
   FROM screener_metrics sm
   JOIN companies c ON c.id = sm.company_id
   WHERE c.is_active = true) AS metrics_rows,
  (SELECT count(*)::int
   FROM screener_metrics sm
   JOIN companies c ON c.id = sm.company_id
   WHERE c.is_active = true AND sm.market_cap IS NOT NULL) AS with_market_cap,
  (SELECT count(*)::int
   FROM screener_metrics sm
   JOIN companies c ON c.id = sm.company_id
   WHERE c.is_active = true AND sm.price IS NOT NULL) AS with_price,
  (SELECT count(*)::int
   FROM screener_metrics sm
   JOIN companies c ON c.id = sm.company_id
   WHERE c.is_active = true AND sm.rsi_14 IS NOT NULL) AS with_rsi;

\echo ''
\echo '=== (2) daily_prices bar-count distribution ==='
SELECT
  count(*)::int AS companies_with_prices,
  round(avg(bar_count))::int AS avg_bars,
  min(bar_count)::int AS min_bars,
  max(bar_count)::int AS max_bars
FROM (
  SELECT dp.company_id, count(*)::int AS bar_count
  FROM daily_prices dp
  JOIN companies c ON c.id = dp.company_id AND c.is_active = true
  GROUP BY dp.company_id
) t;

\echo ''
\echo '=== (2b) lowest bar counts (should still be ~200+) ==='
SELECT
  c.ticker,
  count(*)::int AS bar_count,
  min(dp.date) AS first_date,
  max(dp.date) AS last_date
FROM daily_prices dp
JOIN companies c ON c.id = dp.company_id
WHERE c.is_active = true
GROUP BY c.ticker
ORDER BY bar_count ASC
LIMIT 10;

\echo ''
\echo '=== (3) fundamentals history coverage ==='
SELECT
  count(DISTINCT f.company_id)::int AS companies_with_fundamentals,
  count(*)::int AS total_rows,
  count(*) FILTER (WHERE f.revenue IS NOT NULL)::int AS rows_with_revenue,
  count(*) FILTER (WHERE f.net_income IS NOT NULL)::int AS rows_with_net_income,
  count(*) FILTER (WHERE f.total_assets IS NOT NULL)::int AS rows_with_assets,
  count(*) FILTER (WHERE f.total_equity IS NOT NULL)::int AS rows_with_equity
FROM fundamentals f
JOIN companies c ON c.id = f.company_id AND c.is_active = true;

\echo ''
\echo '=== (3b) sample fundamentals rows ==='
SELECT
  c.ticker,
  f.fiscal_period,
  f.period_end,
  f.revenue,
  f.net_income,
  f.total_assets,
  f.total_equity
FROM fundamentals f
JOIN companies c ON c.id = f.company_id
WHERE c.is_active = true
  AND f.revenue IS NOT NULL
ORDER BY c.ticker, f.period_end DESC
LIMIT 10;
