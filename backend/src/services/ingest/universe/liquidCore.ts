import { SGX_300M_UNIVERSE } from "./sgx300mUniverse";
import type { UniverseSeedEntry } from "./types";

/**
 * Active screener universe: SGX equities ≥ ~S$300M (Yahoo-validated).
 *
 * Generated from scripts/sgx-candidates-300m.json via Stage-1 validation +
 * scripts/build-sgx300m-seed.ts. Board forced to Mainboard (unverified).
 *
 * Historical STI/S-REIT/extras lists remain in-repo for reference but are no
 * longer the seed source.
 */
export function buildLiquidCoreUniverse(): UniverseSeedEntry[] {
  return [...SGX_300M_UNIVERSE].sort((a, b) =>
    a.ticker.localeCompare(b.ticker),
  );
}

/** Import this for seeding and nightly ingestion iteration. */
export const LIQUID_CORE_UNIVERSE: UniverseSeedEntry[] = buildLiquidCoreUniverse();
