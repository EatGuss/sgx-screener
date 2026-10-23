import {
  boolean,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  ticker: text("ticker").notNull().unique(),
  name: text("name").notNull(),
  exchange: text("exchange").notNull().default("SGX"),
  board: text("board"),
  sector: text("sector"),
  industry: text("industry"),
  country: text("country").notNull().default("SG"),
  currency: text("currency").notNull().default("SGD"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
