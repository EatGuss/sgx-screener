import {
  bigint,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const dailyPrices = pgTable(
  "daily_prices",
  {
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    open: numeric("open", { precision: 14, scale: 4 }),
    high: numeric("high", { precision: 14, scale: 4 }),
    low: numeric("low", { precision: 14, scale: 4 }),
    close: numeric("close", { precision: 14, scale: 4 }).notNull(),
    adjClose: numeric("adj_close", { precision: 14, scale: 4 }),
    volume: bigint("volume", { mode: "number" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.companyId, table.date] }),
    dateIdx: index("idx_daily_prices_date").on(table.date),
  }),
);
