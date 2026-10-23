import type { YahooProvider } from "./yahoo/provider";

/** Liquid STI names used for a once-per-run split/dividend sanity check. */
export const SAMPLE_CROSS_CHECK_TICKERS = ["D05.SI", "O39.SI", "C38U.SI"] as const;

export interface CorporateActionWarning {
  ticker: string;
  kind: "dividend_mismatch" | "split_adj_mismatch" | "check_failed";
  detail: string;
}

const n = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * Cross-checks Yahoo dividend/split signals on a small sample of tickers.
 * Compares dividendYield vs dividendRate/price (internal consistency), and
 * flags large adjClose/close divergence without a reported split factor.
 * Logs warnings only — never blocks ingestion.
 */
export async function crossCheckSampleCorporateActions(
  provider: YahooProvider,
  tickers: readonly string[] = SAMPLE_CROSS_CHECK_TICKERS,
): Promise<CorporateActionWarning[]> {
  const warnings: CorporateActionWarning[] = [];

  for (const ticker of tickers) {
    try {
      const qs = await provider.fetchQuoteSummary(ticker, [
        "summaryDetail",
        "defaultKeyStatistics",
        "price",
      ]);
      const sd = (qs.summaryDetail ?? {}) as Record<string, unknown>;
      const ks = (qs.defaultKeyStatistics ?? {}) as Record<string, unknown>;
      const price = (qs.price as Record<string, unknown> | undefined)?.regularMarketPrice;

      const divYield =
        n(sd.dividendYield) ?? n(sd.trailingAnnualDividendYield);
      const divRate = n(sd.dividendRate);
      const px = n(price);

      if (divYield !== null && divRate !== null && px !== null && px > 0) {
        const impliedYield = divRate / px;
        const denom = Math.max(Math.abs(divYield), Math.abs(impliedYield), 1e-6);
        const relDiff = Math.abs(divYield - impliedYield) / denom;
        if (relDiff > 0.25) {
          warnings.push({
            ticker,
            kind: "dividend_mismatch",
            detail:
              `dividendYield=${divYield.toFixed(4)} vs dividendRate/price=${impliedYield.toFixed(4)} ` +
              `(rel diff ${(relDiff * 100).toFixed(1)}%)`,
          });
        }
      }

      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 45);
      const bars = await provider.fetchDailyBars(ticker, from, to);
      const latest = bars.filter((b) => b.close != null).slice(-1)[0];
      if (latest?.adjClose != null && latest.close != null && latest.close > 0) {
        const adjRatio = latest.adjClose / latest.close;
        const lastSplit = ks.lastSplitFactor;
        const hasSplitFactor =
          typeof lastSplit === "string"
            ? lastSplit.length > 0 && lastSplit !== "0:0"
            : lastSplit != null;
        if (Math.abs(adjRatio - 1) > 0.05 && !hasSplitFactor) {
          warnings.push({
            ticker,
            kind: "split_adj_mismatch",
            detail:
              `adjClose/close=${adjRatio.toFixed(4)} on latest bar but no lastSplitFactor reported`,
          });
        }
      }
    } catch (err) {
      warnings.push({
        ticker,
        kind: "check_failed",
        detail: (err as Error).message,
      });
    }
  }

  return warnings;
}
