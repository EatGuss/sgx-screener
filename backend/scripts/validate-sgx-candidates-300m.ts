/**
 * Stage 1 — validate SGX ≥ S$300M candidates against Yahoo.
 *
 * Source of tickers/names: scripts/sgx-candidates-300m.json only.
 * Rules (same as last liquid-core reconciliation):
 *   - reject non-EQUITY, non-SGD, unresolvable/delisted
 *   - name mismatch is an ERROR (wrong mapping), not a soft warning
 *   - on name-only mismatch: confirm the JSON ticker appears in
 *     yahooFinance.search() for the SGX name, then accept it
 *     (abbreviated SGX names ≠ Yahoo longName is expected)
 *   - on other failures: one re-resolution via search(); drop if none
 *
 * Read-only for seed lists — writes report JSON under scripts/ only.
 *
 * Usage (from backend/): npx tsx scripts/validate-sgx-candidates-300m.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  classifyProbe,
  entryFromProbe,
  extractPrice,
  isNameOnlyMismatch,
  searchQueryVariants,
  siSearchCandidatesOrdered,
} from "../src/services/ingest/universe/probe";
import type { UniverseSeedEntry } from "../src/services/ingest/universe/types";
import { YahooProvider } from "../src/services/ingest/yahoo/provider";

interface Candidate {
  ticker: string;
  sgxCode: string;
  name: string;
  sector: string;
  mktCapSgdM: number;
}

interface DropRecord {
  ticker: string;
  sgxCode: string;
  name: string;
  reason: string;
  resolvedAttempt?: string;
}

interface KeptRecord {
  ticker: string;
  name: string;
  yahooLongName: string;
  sector: string;
  mktCapSgdM: number;
  sourceTicker: string;
  remapped: boolean;
  how: "direct" | "search-confirmed" | "search-remapped";
}

async function probeTicker(
  provider: YahooProvider,
  ticker: string,
  intendedName: string,
  requireNameMatch = true,
) {
  let lookupError: string | null = null;
  let price = extractPrice({});
  try {
    const qs = await provider.fetchQuoteSummary(ticker, ["price"]);
    price = extractPrice(qs);
  } catch (err) {
    lookupError = (err as Error).message;
  }
  return classifyProbe(intendedName, lookupError, price, { requireNameMatch });
}

/**
 * Name-only mismatch: JSON ticker is EQUITY/SGD but abbreviated SGX name
 * doesn't fuzzy-match Yahoo longName. Confirm via search that this ticker
 * is returned for the SGX name — then keep the JSON ticker.
 */
async function confirmTickerViaSearch(
  provider: YahooProvider,
  ticker: string,
  intendedName: string,
): Promise<{ price: ReturnType<typeof extractPrice>; via: string } | null> {
  for (const query of searchQueryVariants(intendedName)) {
    const searchResult = await provider.search(query);
    const candidates = siSearchCandidatesOrdered(searchResult).slice(0, 8);
    if (!candidates.includes(ticker)) continue;

    // Equity/currency/delist checks only — name already confirmed by search hit.
    const probe = await probeTicker(provider, ticker, intendedName, false);
    if (probe.ok) {
      return { price: probe.price, via: `search("${query}") confirms ${ticker}` };
    }
  }
  return null;
}

/** Other failures: search SGX name → first valid SGD .SI EQUITY (strict name match). */
async function resolveViaSearch(
  provider: YahooProvider,
  intendedName: string,
  entry: UniverseSeedEntry,
): Promise<{ entry: UniverseSeedEntry; via: string } | { drop: string }> {
  for (const query of searchQueryVariants(intendedName)) {
    const searchResult = await provider.search(query);
    const candidates = siSearchCandidatesOrdered(searchResult);

    for (const symbol of candidates) {
      const probe = await probeTicker(provider, symbol, intendedName, true);
      if (probe.ok) {
        return {
          entry: entryFromProbe(symbol, entry, probe.price),
          via: `search("${query}") → ${symbol}`,
        };
      }
    }
  }

  return {
    drop: "no valid SGD .SI EQUITY from yahooFinance.search() on SGX name",
  };
}

async function main(): Promise<void> {
  const candidatesPath = join(__dirname, "sgx-candidates-300m.json");
  const candidates = JSON.parse(
    readFileSync(candidatesPath, "utf8"),
  ) as Candidate[];

  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error(`No candidates in ${candidatesPath}`);
  }

  const provider = new YahooProvider();
  const kept: KeptRecord[] = [];
  const drops: DropRecord[] = [];
  const seenTickers = new Set<string>();

  console.log(
    `Validating ${candidates.length} SGX ≥ S$300M candidates ` +
      `(name mismatch = ERROR; confirm via search)...\n`,
  );

  for (const c of candidates) {
    const intendedName = c.name;
    const seed: UniverseSeedEntry = {
      ticker: c.ticker,
      name: intendedName,
      board: "Mainboard",
      sector: c.sector,
      currency: "SGD",
    };

    process.stdout.write(`  ${c.ticker} (${intendedName.slice(0, 36)})... `);

    const probe = await probeTicker(provider, c.ticker, intendedName, true);

    let how: KeptRecord["how"] | null = null;
    let ticker = c.ticker;
    let yahooLongName = probe.price.longName;
    let note = "";

    if (probe.ok) {
      how = "direct";
      console.log("OK");
    } else if (isNameOnlyMismatch(probe)) {
      console.log("name mismatch → confirm via search");
      const confirmed = await confirmTickerViaSearch(
        provider,
        c.ticker,
        intendedName,
      );
      if (confirmed) {
        how = "search-confirmed";
        yahooLongName = confirmed.price.longName;
        note = confirmed.via;
        console.log(`    CONFIRMED ${c.ticker} (${confirmed.via})`);
      } else {
        console.log("    not confirmed → search remap");
        const outcome = await resolveViaSearch(provider, intendedName, seed);
        if ("drop" in outcome) {
          drops.push({
            ticker: c.ticker,
            sgxCode: c.sgxCode,
            name: intendedName,
            reason: `name mismatch (wrong ticker mapping) → ${outcome.drop}`,
          });
          console.log(`    DROP: ${outcome.drop}`);
          continue;
        }
        how = "search-remapped";
        ticker = outcome.entry.ticker;
        yahooLongName = outcome.entry.name;
        note = outcome.via;
        console.log(`    REMAP ${c.ticker} → ${ticker} (${outcome.via})`);
      }
    } else {
      console.log(`ERROR (${probe.errors.join("; ")}) → search`);
      const outcome = await resolveViaSearch(provider, intendedName, seed);
      if ("drop" in outcome) {
        drops.push({
          ticker: c.ticker,
          sgxCode: c.sgxCode,
          name: intendedName,
          reason: `${probe.errors.join("; ")} → ${outcome.drop}`,
        });
        console.log(`    DROP: ${outcome.drop}`);
        continue;
      }
      how = "search-remapped";
      ticker = outcome.entry.ticker;
      yahooLongName = outcome.entry.name;
      note = outcome.via;
      console.log(`    REMAP ${c.ticker} → ${ticker} (${outcome.via})`);
    }

    if (seenTickers.has(ticker)) {
      drops.push({
        ticker: c.ticker,
        sgxCode: c.sgxCode,
        name: intendedName,
        reason: `duplicate of already-kept ${ticker}`,
        resolvedAttempt: note || undefined,
      });
      console.log(`    DROP: duplicate ${ticker}`);
      continue;
    }

    seenTickers.add(ticker);
    kept.push({
      ticker,
      name: intendedName,
      yahooLongName,
      sector: c.sector,
      mktCapSgdM: c.mktCapSgdM,
      sourceTicker: c.ticker,
      remapped: ticker !== c.ticker,
      how: how!,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    source: "sgx-candidates-300m.json",
    candidates: candidates.length,
    kept: kept.length,
    dropped: drops.length,
    remapped: kept.filter((k) => k.remapped).length,
    searchConfirmed: kept.filter((k) => k.how === "search-confirmed").length,
    keptTickers: kept,
    drops,
  };

  const outPath = join(__dirname, "sgx-candidates-300m-validation.json");
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log("\n======== DROP LIST ========");
  if (drops.length === 0) {
    console.log("(none)");
  } else {
    for (const d of drops) {
      console.log(`- ${d.ticker} | ${d.name}`);
      console.log(`  ${d.reason}`);
      if (d.resolvedAttempt) console.log(`  attempt: ${d.resolvedAttempt}`);
    }
  }

  console.log("\n======== SUMMARY ========");
  console.log(`Candidates:        ${candidates.length}`);
  console.log(`Kept:              ${kept.length}`);
  console.log(`  direct OK:       ${kept.filter((k) => k.how === "direct").length}`);
  console.log(`  search-confirmed:${report.searchConfirmed}`);
  console.log(`  search-remapped: ${report.remapped}`);
  console.log(`Dropped:           ${drops.length}`);
  console.log(`Report:            ${outPath}`);
  console.log("(Stage 1 only — seed list not modified.)");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
