CREATE TABLE IF NOT EXISTS "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticker" text NOT NULL,
	"name" text NOT NULL,
	"exchange" text DEFAULT 'SGX' NOT NULL,
	"board" text,
	"sector" text,
	"industry" text,
	"country" text DEFAULT 'SG' NOT NULL,
	"currency" text DEFAULT 'SGD' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_ticker_unique" UNIQUE("ticker")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "daily_prices" (
	"company_id" integer NOT NULL,
	"date" date NOT NULL,
	"open" numeric(14, 4),
	"high" numeric(14, 4),
	"low" numeric(14, 4),
	"close" numeric(14, 4) NOT NULL,
	"adj_close" numeric(14, 4),
	"volume" bigint,
	CONSTRAINT "daily_prices_company_id_date_pk" PRIMARY KEY("company_id","date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fundamentals" (
	"company_id" integer NOT NULL,
	"fiscal_period" text NOT NULL,
	"period_end" date NOT NULL,
	"revenue" numeric(20, 2),
	"net_income" numeric(20, 2),
	"operating_income" numeric(20, 2),
	"eps_diluted" numeric(12, 4),
	"total_assets" numeric(20, 2),
	"total_equity" numeric(20, 2),
	"total_debt" numeric(20, 2),
	"free_cash_flow" numeric(20, 2),
	"shares_outstanding" numeric(20, 2),
	"dividends_per_share" numeric(12, 4),
	CONSTRAINT "fundamentals_company_id_fiscal_period_pk" PRIMARY KEY("company_id","fiscal_period")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saved_screens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"name" text NOT NULL,
	"filter_dsl" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "screener_metrics" (
	"company_id" integer PRIMARY KEY NOT NULL,
	"as_of" date NOT NULL,
	"market_cap" numeric(20, 2),
	"market_cap_bucket" text,
	"pe" numeric(12, 4),
	"pb" numeric(12, 4),
	"ps" numeric(12, 4),
	"peg" numeric(12, 4),
	"profit_margin" numeric(8, 4),
	"operating_margin" numeric(8, 4),
	"roe" numeric(8, 4),
	"roa" numeric(8, 4),
	"eps" numeric(12, 4),
	"revenue_growth_yoy" numeric(8, 4),
	"earnings_growth_yoy" numeric(8, 4),
	"debt_to_equity" numeric(10, 4),
	"free_cash_flow" numeric(20, 2),
	"fcf_margin" numeric(8, 4),
	"dividend_yield" numeric(8, 4),
	"payout_ratio" numeric(8, 4),
	"price" numeric(14, 4),
	"pct_from_52w_high" numeric(8, 4),
	"pct_from_52w_low" numeric(8, 4),
	"price_vs_50ma" numeric(8, 4),
	"price_vs_200ma" numeric(8, 4),
	"rsi_14" numeric(6, 2),
	"avg_volume_30d" bigint,
	"perf_1d" numeric(8, 4),
	"perf_1w" numeric(8, 4),
	"perf_1m" numeric(8, 4),
	"perf_ytd" numeric(8, 4),
	"perf_1y" numeric(8, 4),
	"sparkline_30d" numeric(14, 4)[],
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "daily_prices" ADD CONSTRAINT "daily_prices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fundamentals" ADD CONSTRAINT "fundamentals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "screener_metrics" ADD CONSTRAINT "screener_metrics_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_daily_prices_date" ON "daily_prices" USING btree ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_saved_screens_user" ON "saved_screens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_metrics_market_cap" ON "screener_metrics" USING btree ("market_cap");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_metrics_pe" ON "screener_metrics" USING btree ("pe");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_metrics_dividend_yield" ON "screener_metrics" USING btree ("dividend_yield");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_metrics_roe" ON "screener_metrics" USING btree ("roe");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_metrics_perf_1y" ON "screener_metrics" USING btree ("perf_1y");