import { FilterControl } from "./FilterControl";
import { FIELD_DEFS } from "screener-contract";

/** Phase 1 market-cap slice — now a thin wrapper over the generic control. */
export function FilterControlMarketCap() {
  return <FilterControl def={FIELD_DEFS.market_cap} />;
}
