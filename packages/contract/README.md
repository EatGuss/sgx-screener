# screener-contract

Shared source of truth for the screener: the **Filter DSL**, field definitions, the **12 SGX presets**, and the **endpoint Zod schemas**. Imported by both apps so they can never disagree on a shape.

It's consumed as **TypeScript source directly** through npm workspaces — there is **no build step**. `package.json` points `main`/`types`/`exports` at `src/index.ts`, and each app transpiles it itself (the API via `tsx`, the web app via Vite).

## What's inside
| File | Purpose |
|---|---|
| `src/dsl.ts` | `ScreenSpec`, `FilterCondition`, `ScreenerField`, `Operator` — the canonical screen representation and security boundary. |
| `src/fields.ts` | `FIELD_DEFS` / `FIELD_GROUPS` — metadata to render the ~30 filter controls. |
| `src/api.ts` | Request/response Zod schemas + inferred types for every endpoint. |
| `src/presets.ts` | `PRESETS` — the 12 curated SGX screens as Filter DSL. |
| `src/index.ts` | Public exports. |

## Using it (from either app)
Declare the dependency in the app's `package.json`:
```json
"dependencies": { "screener-contract": "*" }
```
`npm install` at the repo root links it. Then import normally:
```typescript
import { ScreenSpec, CountResponse, FIELD_DEFS, PRESETS } from "screener-contract";
```
Edit the source and the change is picked up immediately — no rebuild.

## Convention
Ratios (margins, yields, growth, performance) are decimal fractions — `0.05` = 5%. `market_cap`, `eps`, `price`, `free_cash_flow` are raw values in the company's native **currency** (SGD for SGX). `exchange` is `SGX` (retained for multi-market); `board` distinguishes Mainboard vs Catalist.
