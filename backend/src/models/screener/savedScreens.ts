import {
  bigint,
  index,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Ownership is enforced in the service layer from the authenticated JWT;
 * the FK keeps screens from outliving their user.
 */
export const savedScreens = pgTable(
  "saved_screens",
  {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  filterDsl: jsonb("filter_dsl").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_saved_screens_user").on(table.userId),
  }),
);
