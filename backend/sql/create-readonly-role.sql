-- Read-only role for request-time screening (READONLY_DATABASE_URL).
-- Run once as a superuser / database owner after `npm run db:migrate`:
--   psql "$DATABASE_URL" -v ro_password="'choose-a-password'" -f sql/create-readonly-role.sql
-- Then set READONLY_DATABASE_URL=postgresql://screener_ro:<password>@host:5432/<db>

CREATE ROLE screener_ro LOGIN PASSWORD :ro_password;
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO screener_ro', current_database());
END
$$;
GRANT USAGE ON SCHEMA public TO screener_ro;
GRANT SELECT ON companies, daily_prices, fundamentals, screener_metrics TO screener_ro;
-- No access to users or saved_screens: request-time screening never needs them.
ALTER ROLE screener_ro SET default_transaction_read_only = on;
