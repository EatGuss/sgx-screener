import { eq } from "drizzle-orm";
import { db } from "../../../db/drizzleClient";
import { companies } from "../../../models/screener/companies";

export interface MiniSeedEntry {
  ticker: string;
  name: string;
  board?: string;
}

/** Liquid-core SGX names for the Phase 2 vertical slice. */
export const MINI_UNIVERSE: MiniSeedEntry[] = [
  { ticker: "D05.SI", name: "DBS Group Holdings Ltd", board: "Mainboard" },
  { ticker: "O39.SI", name: "OCBC Bank Ltd", board: "Mainboard" },
  { ticker: "U11.SI", name: "United Overseas Bank Ltd", board: "Mainboard" },
  { ticker: "C6L.SI", name: "Singapore Airlines Ltd", board: "Mainboard" },
  { ticker: "Z74.SI", name: "Singapore Telecommunications Ltd", board: "Mainboard" },
  { ticker: "C38U.SI", name: "CapitaLand Integrated Commercial Trust", board: "Mainboard" },
  { ticker: "S68.SI", name: "Singapore Exchange Ltd", board: "Mainboard" },
  { ticker: "G13.SI", name: "Genting Singapore Ltd", board: "Mainboard" },
  { ticker: "BN4.SI", name: "Keppel Ltd", board: "Mainboard" },
  { ticker: "A17U.SI", name: "Ascendas Real Estate Investment Trust", board: "Mainboard" },
];

export async function seedMiniUniverse(): Promise<Map<string, number>> {
  const tickerToId = new Map<string, number>();

  for (const entry of MINI_UNIVERSE) {
    const existing = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.ticker, entry.ticker))
      .limit(1);

    if (existing[0]) {
      tickerToId.set(entry.ticker, existing[0].id);
      continue;
    }

    const inserted = await db
      .insert(companies)
      .values({
        ticker: entry.ticker,
        name: entry.name,
        board: entry.board ?? null,
      })
      .returning({ id: companies.id });

    const row = inserted[0];
    if (!row) throw new Error(`Failed to seed ${entry.ticker}`);
    tickerToId.set(entry.ticker, row.id);
  }

  return tickerToId;
}
