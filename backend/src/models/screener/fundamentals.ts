import { date, integer, numeric, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const fundamentals = pgTable(
  "fundamentals",
  {
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    fiscalPeriod: text("fiscal_period").notNull(),
    periodEnd: date("period_end").notNull(),
    revenue: numeric("revenue", { precision: 20, scale: 2 }),
    netIncome: numeric("net_income", { precision: 20, scale: 2 }),
    operatingIncome: numeric("operating_income", { precision: 20, scale: 2 }),
    epsDiluted: numeric("eps_diluted", { precision: 12, scale: 4 }),
    totalAssets: numeric("total_assets", { precision: 20, scale: 2 }),
    totalEquity: numeric("total_equity", { precision: 20, scale: 2 }),
    totalDebt: numeric("total_debt", { precision: 20, scale: 2 }),
    freeCashFlow: numeric("free_cash_flow", { precision: 20, scale: 2 }),
    sharesOutstanding: numeric("shares_outstanding", { precision: 20, scale: 2 }),
    dividendsPerShare: numeric("dividends_per_share", { precision: 12, scale: 4 }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.companyId, table.fiscalPeriod] }),
  }),
);
