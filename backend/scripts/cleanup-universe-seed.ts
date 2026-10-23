/**
 * One-off cleanup driver: resolve bad tickers via Yahoo search, drop invalid names,
 * emit cleaned seed arrays as JSON.
 *
 * Usage: npx tsx scripts/cleanup-universe-seed.ts
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { LIQUID_EXTRAS } from "../src/services/ingest/universe/liquidExtras";
import {
  classifyProbe,
  entryFromProbe,
  extractPrice,
  isNameOnlyMismatch,
  searchQueryVariants,
  siSearchCandidatesOrdered,
} from "../src/services/ingest/universe/probe";
import { S_REITS } from "../src/services/ingest/universe/sReits";
import { STI_30 } from "../src/services/ingest/universe/sti30";
import type { UniverseSeedEntry } from "../src/services/ingest/universe/types";
import { YahooProvider } from "../src/services/ingest/yahoo/provider";

type Source = "sti30" | "sReits" | "liquidExtras";

interface TaggedEntry extends UniverseSeedEntry {
  source: Source;
}

interface DropRecord {
  intendedName: string;
  oldTicker: string;
  reason: string;
}

function tagEntries(
  entries: UniverseSeedEntry[],
  source: Source,
): TaggedEntry[] {
  return entries.map((e) => ({ ...e, source }));
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

async function confirmTickerViaSearch(
  provider: YahooProvider,
  ticker: string,
  intendedName: string,
): Promise<UniverseSeedEntry | null> {
  for (const query of searchQueryVariants(intendedName)) {
    const searchResult = await provider.search(query);
    const candidates = siSearchCandidatesOrdered(searchResult).slice(0, 5);
    if (!candidates.includes(ticker)) continue;

    const probe = await probeTicker(provider, ticker, intendedName, false);
    if (probe.ok) {
      return entryFromProbe(ticker, { ticker, name: intendedName, board: "Mainboard" }, probe.price);
    }
  }
  return null;
}

async function resolveViaSearch(
  provider: YahooProvider,
  intendedName: string,
  entry: UniverseSeedEntry,
): Promise<{ entry: UniverseSeedEntry } | { drop: string }> {
  for (const query of searchQueryVariants(intendedName)) {
    const searchResult = await provider.search(query);
    const candidates = siSearchCandidatesOrdered(searchResult);

    for (const symbol of candidates) {
      const probe = await probeTicker(provider, symbol, intendedName, true);
      if (probe.ok) {
        return { entry: entryFromProbe(symbol, entry, probe.price) };
      }
    }
  }

  return { drop: "no SGX .SI symbol in Yahoo search results validated as SGD EQUITY" };
}

async function main(): Promise<void> {
  const provider = new YahooProvider();
  const tagged: TaggedEntry[] = [
    ...tagEntries(STI_30, "sti30"),
    ...tagEntries(S_REITS, "sReits"),
    ...tagEntries(LIQUID_EXTRAS, "liquidExtras"),
  ];

  const kept: TaggedEntry[] = [];
  const drops: DropRecord[] = [];
  const seenTickers = new Set<string>();

  console.log(`Cleaning ${tagged.length} seed entries...\n`);

  for (const item of tagged) {
    const intendedName = item.name;
    process.stdout.write(`  ${item.ticker} (${intendedName.slice(0, 40)})... `);

    let probe = await probeTicker(provider, item.ticker, intendedName, true);

    let resolved: UniverseSeedEntry | null = null;

    if (probe.ok) {
      resolved = entryFromProbe(item.ticker, item, probe.price);
      console.log("OK");
    } else if (isNameOnlyMismatch(probe)) {
      console.log("name variant → confirm via search");
      const confirmed = await confirmTickerViaSearch(provider, item.ticker, intendedName);
      if (confirmed) {
        resolved = { ...item, ...confirmed, board: item.board };
        console.log(`    CONFIRMED ${item.ticker}`);
      }
    }

    if (!resolved && !probe.ok) {
      console.log(`ERROR → search`);
      const outcome = await resolveViaSearch(provider, intendedName, item);
      if ("drop" in outcome) {
        drops.push({
          intendedName,
          oldTicker: item.ticker,
          reason: `${probe.errors.join("; ")} → ${outcome.drop}`,
        });
        console.log(`    DROP: ${outcome.drop}`);
        continue;
      }
      resolved = outcome.entry;
      probe = await probeTicker(provider, resolved.ticker, intendedName, true);
      if (!probe.ok) {
        drops.push({
          intendedName,
          oldTicker: item.ticker,
          reason: `resolved ${resolved.ticker} still invalid: ${probe.errors.join("; ")}`,
        });
        console.log(`    DROP after resolve: ${probe.errors.join("; ")}`);
        continue;
      }
      resolved = entryFromProbe(resolved.ticker, item, probe.price);
      console.log(`    FIXED → ${resolved.ticker}`);
    }

    if (!resolved) continue;

    if (seenTickers.has(resolved.ticker)) {
      drops.push({
        intendedName,
        oldTicker: item.ticker,
        reason: `duplicate ticker ${resolved.ticker} already in cleaned list`,
      });
      console.log(`    DROP duplicate ${resolved.ticker}`);
      continue;
    }

    seenTickers.add(resolved.ticker);
    kept.push({ ...resolved, source: item.source });
  }

  const sti30 = kept
    .filter((e) => e.source === "sti30")
    .map(({ source: _s, ...e }) => e)
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
  const sReits = kept
    .filter((e) => e.source === "sReits")
    .map(({ source: _s, ...e }) => e)
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
  const liquidExtras = kept
    .filter((e) => e.source === "liquidExtras")
    .map(({ source: _s, ...e }) => e)
    .sort((a, b) => a.ticker.localeCompare(b.ticker));

  const out = { sti30, sReits, liquidExtras, drops, total: kept.length };
  const outPath = join(__dirname, "cleanup-universe-output.json");
  writeFileSync(outPath, JSON.stringify(out, null, 2));

  console.log(`\nKept: ${kept.length}`);
  console.log(`Dropped: ${drops.length}`);
  console.log(`Written: ${outPath}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
