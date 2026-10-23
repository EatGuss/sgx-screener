/**
 * Phase 1 hard gate — verifies screener-contract (ESM) imports cleanly into
 * the CommonJS backend via tsx. Run from backend/: npx tsx scripts/spike-contract-import.ts
 */
import { PRESETS, ScreenSpec } from "screener-contract";

const spec: ScreenSpec = PRESETS[0]!.spec;

console.log("screener-contract import OK");
console.log(`preset: ${PRESETS[0]!.name}`);
console.log(`conditions: ${spec.conditions.length}`);
