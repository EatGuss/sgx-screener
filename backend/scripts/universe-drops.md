# Liquid-core universe — dropped tickers (Yahoo validation cleanup)

13 names removed from the original 70-ticker seed. All drops were determined by
`scripts/cleanup-universe-seed.ts` using `yahooFinance.search()` — no tickers
were supplied from memory.

| Intended name | Old ticker | Reason |
|---|---|---|
| Hongkong Land Holdings Ltd | H78.SI | Non-SGD listing (USD); no valid SGD .SI equity in search |
| SPH Media Trust | T39.SI | Delisted / unresolvable on Yahoo |
| Cromwell European REIT | CMOU.SI | Non-SGD listing (USD); no valid SGD .SI equity in search |
| Digital Core REIT | DCRU.SI | Non-SGD listing (USD); no valid SGD .SI equity in search |
| Frasers Hospitality Trust | ACV.SI | Delisted / unresolvable on Yahoo |
| Lippo Malls Indonesia Retail Trust | O5RU.SI | Wrong ticker mapping; no valid SGD .SI equity in search |
| Ascendas India Trust | CY6U.SI | Wrong ticker mapping (Yahoo: CapitaLand India Trust); no re-resolve |
| Elite Commercial REIT | MXNU.SI | Non-SGD listing (GBP); no valid SGD .SI equity in search |
| Sabana Industrial REIT | 5E2.SI | Ticker recycled (Seatrium); Sabana unresolvable in search |
| United Industrial Corporation Ltd | U06.SI | Wrong ticker mapping at old symbol; resolved to U06 for Singapore Land Group instead |
| Wheelock Properties (Singapore) Ltd | W05.SI | Wrong ticker mapping; no valid SGD .SI equity in search |
| Mandarin Oriental International Ltd | M04.SI | Delisted / unresolvable on Yahoo |
| Millennium & Copthorne Hotels Ltd | MCH.SI | Delisted / unresolvable on Yahoo |

**Final universe: 57 tickers** — `npm run validate:universe` exits 0.
