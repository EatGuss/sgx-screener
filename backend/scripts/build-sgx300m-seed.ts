/**
 * Build Stage-2 seed list from Stage-1 validation + approved fold-ins.
 * Writes src/services/ingest/universe/sgx300mUniverse.ts
 *
 * Keep = validation kept − Z77.SI + F99/NPW/S3N (direct quoteSummary).
 * Drop = O6Z, N33, S2D, 5VJ (MUTUALFUND).
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { extractPrice } from "../src/services/ingest/universe/probe";
import { YahooProvider } from "../src/services/ingest/yahoo/provider";

interface KeptRecord {
  ticker: string;
  name: string;
  yahooLongName: string;
  sector: string;
  mktCapSgdM: number;
}

interface Candidate {
  ticker: string;
  sgxCode: string;
  name: string;
  sector: string;
  mktCapSgdM: number;
}

const EXCLUDE = new Set(["Z77.SI", "O6Z.SI", "N33.SI", "S2D.SI", "5VJ.SI"]);
const FOLD_IN = ["F99.SI", "NPW.SI", "S3N.SI"] as const;

async function fetchLongName(
  provider: YahooProvider,
  ticker: string,
): Promise<{ longName: string; quoteType: string; currency: string }> {
  const qs = await provider.fetchQuoteSummary(ticker, ["price"]);
  const price = extractPrice(qs);
  if (price.quoteType !== "EQUITY" || price.currency !== "SGD") {
    throw new Error(
      `${ticker}: expected EQUITY/SGD, got ${price.quoteType}/${price.currency}`,
    );
  }
  if (price.longName === "—") {
    throw new Error(`${ticker}: missing longName`);
  }
  return {
    longName: price.longName,
    quoteType: price.quoteType,
    currency: price.currency,
  };
}

async function main(): Promise<void> {
  const validationPath = join(__dirname, "sgx-candidates-300m-validation.json");
  const candidatesPath = join(__dirname, "sgx-candidates-300m.json");
  const report = JSON.parse(readFileSync(validationPath, "utf8")) as {
    keptTickers: KeptRecord[];
  };
  const candidates = JSON.parse(
    readFileSync(candidatesPath, "utf8"),
  ) as Candidate[];
  const byTicker = new Map(candidates.map((c) => [c.ticker, c]));

  const provider = new YahooProvider();
  const entries: {
    ticker: string;
    name: string;
    board: "Mainboard";
    sector: string;
    currency: "SGD";
    country: "SG";
  }[] = [];

  for (const k of report.keptTickers) {
    if (EXCLUDE.has(k.ticker)) {
      console.log(`exclude ${k.ticker} (${k.name})`);
      continue;
    }
    entries.push({
      ticker: k.ticker,
      name: k.yahooLongName,
      board: "Mainboard",
      sector: k.sector,
      currency: "SGD",
      country: "SG",
    });
  }

  for (const ticker of FOLD_IN) {
    if (entries.some((e) => e.ticker === ticker)) {
      console.log(`fold-in ${ticker} already present`);
      continue;
    }
    const c = byTicker.get(ticker);
    if (!c) throw new Error(`${ticker} missing from candidates JSON`);
    const { longName } = await fetchLongName(provider, ticker);
    console.log(`fold-in ${ticker} → ${longName}`);
    entries.push({
      ticker,
      name: longName,
      board: "Mainboard",
      sector: c.sector,
      currency: "SGD",
      country: "SG",
    });
  }

  entries.sort((a, b) => a.ticker.localeCompare(b.ticker));

  // 172 Stage-1 kept − Z77 + F99/NPW/S3N = 174 (not 175: excluding Z77 after the +3 fold).
  if (entries.length !== 174) {
    throw new Error(`Expected 174 seed entries, got ${entries.length}`);
  }

  // Z74/Z77 sanity: Z77 must be absent; Z74 present.
  if (entries.some((e) => e.ticker === "Z77.SI")) {
    throw new Error("Z77.SI must be excluded");
  }
  if (!entries.some((e) => e.ticker === "Z74.SI")) {
    throw new Error("Z74.SI must be present");
  }

  const body = `/**
 * AUTO-GENERATED SGX ≥ S$300M universe seed (Stage 2).
 *
 * Built by: npm run / npx tsx scripts/build-sgx300m-seed.ts
 * Source: scripts/sgx-candidates-300m.json + Yahoo quoteSummary longName.
 * Board forced to Mainboard (unverified — see HLD).
 *
 * Do not hand-edit tickers/names — regenerate from the validated candidate set.
 */
import type { UniverseSeedEntry } from "./types";

export const SGX_300M_UNIVERSE: UniverseSeedEntry[] = ${JSON.stringify(entries, null, 2)};
`;

  const outPath = join(
    __dirname,
    "../src/services/ingest/universe/sgx300mUniverse.ts",
  );
  writeFileSync(outPath, `${body}\n`, "utf8");
  console.log(`\nWrote ${entries.length} entries → ${outPath}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
