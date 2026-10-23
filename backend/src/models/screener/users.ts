import { bigserial, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Accounts for saved screens. Passwords are argon2 hashes, never plaintext. */
export const users = pgTable("users", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
