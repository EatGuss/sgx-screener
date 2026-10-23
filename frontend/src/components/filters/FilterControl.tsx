import type { FieldDef } from "screener-contract";
import { FilterControlEnum } from "./FilterControlEnum";
import { FilterControlNumeric } from "./FilterControlNumeric";

interface FilterControlProps {
  def: FieldDef;
}

/** Renders the appropriate sidebar control for a FIELD_DEFS entry. */
export function FilterControl({ def }: FilterControlProps) {
  switch (def.kind) {
    case "enum":
      return <FilterControlEnum def={def} />;
    case "number":
    case "percent":
    case "currency":
      return <FilterControlNumeric def={def} />;
    default:
      return null;
  }
}
