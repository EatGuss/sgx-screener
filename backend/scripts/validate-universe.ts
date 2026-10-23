/**
 * Validate every liquid-core seed ticker against Yahoo Finance (price module).
 * Usage (from backend/):  npm run validate:universe
 *
 * Read-only — does not modify the seed list.
 */
import { LIQUID_CORE_UNIVERSE } from "../src/services/ingest/universe/liquidCore";
import {
  classifyProbe,
  extractPrice,
} from "../src/services/ingest/universe/probe";
import { YahooProvider } from "../src/services/ingest/yahoo/provider";

type RowStatus = "OK" | "ERROR";

interface ProbeRow {
  ticker: string;
  seedName: string;
  yahooLongName: string;
  quoteType: string;
  currency: string;
  exchangeName: string;
  status: RowStatus;
  note: string;
}

function fmt(value: string, width: number): string {
  if (value.length <= width) return value.padEnd(width);
  return `${value.slice(0, width - 1)}…`;
}

async function probeTicker(
  provider: YahooProvider,
  ticker: string,
  seedName: string,
): Promise<ProbeRow> {
  let lookupError: string | null = null;
  let price = extractPrice({});

  try {
    const qs = await provider.fetchQuoteSummary(ticker, ["price"]);
    price = extractPrice(qs);
  } catch (err) {
    lookupError = (err as Error).message;
  }

  const { ok, errors } = classifyProbe(seedName, lookupError, price);

  return {
    ticker,
    seedName,
    yahooLongName: price.longName,
    quoteType: price.quoteType,
    currency: price.currency,
    exchangeName: price.exchangeName,
    status: ok ? "OK" : "ERROR",
    note: errors.join("; "),
  };
}

async function main(): Promise<void> {
  const provider = new YahooProvider();
  const rows: ProbeRow[] = [];

  console.log(`Probing ${LIQUID_CORE_UNIVERSE.length} liquid-core tickers...\n`);

  for (const entry of LIQUID_CORE_UNIVERSE) {
    const row = await probeTicker(provider, entry.ticker, entry.name);
    rows.push(row);
    process.stdout.write(`  ${entry.ticker} [${row.status}]\n`);
  }

  const col = {
    status: 5,
    ticker: 10,
    seedName: 28,
    yahooLongName: 36,
    quoteType: 10,
    currency: 8,
    exchange: 14,
    note: 30,
  };

  const header = [
    fmt("STATUS", col.status),
    fmt("TICKER", col.ticker),
    fmt("SEED NAME", col.seedName),
    fmt("YAHOO LONG NAME", col.yahooLongName),
    fmt("QUOTE TYPE", col.quoteType),
    fmt("CURRENCY", col.currency),
    fmt("EXCHANGE", col.exchange),
    fmt("NOTE", col.note),
  ].join(" ");

  console.log(`\n${header}`);
  console.log("-".repeat(header.length));

  let ok = 0;
  let error = 0;

  for (const row of rows) {
    if (row.status === "OK") ok++;
    else error++;

    console.log(
      [
        fmt(row.status, col.status),
        fmt(row.ticker, col.ticker),
        fmt(row.seedName, col.seedName),
        fmt(row.yahooLongName, col.yahooLongName),
        fmt(row.quoteType, col.quoteType),
        fmt(row.currency, col.currency),
        fmt(row.exchangeName, col.exchange),
        fmt(row.note, col.note),
      ].join(" "),
    );
  }

  console.log(`\nSummary: ${rows.length} tickers — OK ${ok}, ERROR ${error}`);
  if (error > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
