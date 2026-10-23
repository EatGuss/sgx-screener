# SGX Universe & Fundamentals Coverage Study

*Evidence for the universe-scoping decision. Source: SGX official screener export (all filters cleared), 16 Jul 2026 — 616 securities. Live product numbers (172 active) are from the Yahoo-validated seed plus ingest completeness.*

## Summary

The shipped screener covers **172 active** SGX names with market cap **≥ ~S$300M**.

That count is derived, not guessed: SGX listed **616 securities** in the July 2026 export. **582** are SGD-denominated equities and trusts; **34** non-SGD (USD 17, EUR 2, HKD 2, GBP 1, JPY 1, CNY 1, or blank) are excluded (single-currency by design). Of the SGD names, **179** sit at ≥ S$300M. Yahoo validation produced a **174**-ticker seed (`SGX_300M_UNIVERSE`). The ingest **completeness guard** then deactivates actives whose `screener_metrics.market_cap` is null, leaving **172** names on the screener.

**Why this floor:** SGX-native fundamentals coverage degrades sharply with size. P/E and dividend yield stay usable through the small band (S$300M–1B) and collapse in micro/nano. A screener with trustworthy ratios is more useful than a larger one filled with “not available” on the fields users actually filter on.

The **57-stock liquid core** (STI 30 + major S-REITs) was the first shipped seed — near-complete coverage, every ticker verified via Yahoo `search()`. It is **superseded** by the ≥S$300M set. The band table and liquid-core notes below are the evidence for keeping the floor, not the current universe size.

## Coverage by market-cap band (SGD securities only)

| Band | Count | ROE | P/E | Dividend Yield | Revenue |
|---|---:|---:|---:|---:|---:|
| Large (≥ S$5B) | 33 | 100% | 96% | 96% | 100% |
| Mid (S$1–5B) | 68 | 100% | 88% | 94% | 100% |
| Small (S$300M–1B) | 78 | 100% | 88% | 84% | 100% |
| Micro (S$50–300M) | 150 | 95% | 74% | 66% | 100% |
| **Nano (< S$50M)** | **253** | 86% | **31%** | **20%** | 100% |

The degradation is monotonic. In the liquid core, P/E and yield coverage exceed 90%. In the nano-cap tail — **253 stocks, 43% of the SGD universe** — P/E is present only 31% of the time and dividend yield only 20%. Adding these names would fill the screener with "not available" placeholders on the exact fields most users screen on.

(Revenue is ~100% everywhere because it's a reported line item; the ratios that require earnings, book value, or dividends are where the tail thins out.)

## Full-coverage counts

- SGD securities: **582**
- With full core fundamentals (ROE + P/E + Revenue): **345**
- Of those, also paying a dividend: **272**

## Scoping decision (shipped)

**In product:** SGD equities **≥ S$300M** — **179** candidates → **174** Yahoo-validated seed → **172 active** after the completeness guard.

**Why not the full 582 SGD names:** the band table shows P/E / yield coverage holding through Small (S$300M–1B: P/E 88%, yield 84%) and collapsing below that floor (micro yield 66%, nano P/E 31% / yield 20%). Sub-S$300M (~403 nano/micro names) stays out until a source covers small-cap fundamentals better.

**Earlier seed (background):** v1 first shipped the **57-stock liquid core** (STI 30 + major S-REITs), where coverage is near-complete and every ticker was independently verified via Yahoo `search()` (correcting mislabels, delisted tickers, and non-SGD listings). Rationale at the time: a smaller universe with trustworthy data beats a larger one with gaps. That core proved the Yahoo path; it is not the live universe.

Of the 179 ≥ S$300M SGD names in the export, **161 (89%) had full core fundamentals** on SGX’s own file — enough to expand without a paid provider. Yahoo then dropped unresolvable / non-SGD names to 174; completeness dropped null market-cap actives to **172**.
