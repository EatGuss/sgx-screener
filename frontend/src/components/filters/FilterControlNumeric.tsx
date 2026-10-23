import type { FieldDef, FilterCondition, Operator } from "screener-contract";
import { FILTER_BANDS, type FilterBandOption } from "screener-contract";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFilterCondition } from "@/hooks/useFilterCondition";
import {
  billionsToRaw,
  decimalToPercent,
  percentToDecimal,
  rawToBillions,
} from "@/lib/screener/format";
import {
  isNumericOp,
  NUMERIC_OP_LABELS,
  NUMERIC_OPS,
  type NumericOp,
} from "@/lib/screener/filter-controls";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface FilterControlNumericProps {
  def: FieldDef;
}

function parseDisplayValue(def: FieldDef, raw: number): string {
  if (def.kind === "percent") return String(decimalToPercent(raw));
  if (def.kind === "currency" && def.field === "market_cap") {
    return String(rawToBillions(raw));
  }
  return String(raw);
}

function toApiValue(def: FieldDef, display: number): number {
  if (def.kind === "percent") return percentToDecimal(display);
  if (def.kind === "currency" && def.field === "market_cap") {
    return billionsToRaw(display);
  }
  return display;
}

function isValidDisplay(def: FieldDef, display: number): boolean {
  if (!Number.isFinite(display)) return false;
  if (def.kind === "currency" && def.field === "market_cap") return display > 0;
  if (def.kind === "percent" || def.kind === "number" || def.kind === "currency") {
    return true;
  }
  return false;
}

function isValidBetween(def: FieldDef, minStr: string, maxStr: string): boolean {
  const minDisplay = Number.parseFloat(minStr);
  const maxDisplay = Number.parseFloat(maxStr);
  if (!isValidDisplay(def, minDisplay) || !isValidDisplay(def, maxDisplay)) return false;
  return toApiValue(def, minDisplay) <= toApiValue(def, maxDisplay);
}

function nearlyEqual(a: number, b: number): boolean {
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= scale * 1e-6;
}

function valuesMatch(
  op: Operator,
  left: FilterCondition["value"],
  right: number | [number, number],
): boolean {
  if (op === "between") {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== 2 || right.length !== 2) return false;
    if (typeof left[0] !== "number" || typeof left[1] !== "number") return false;
    return nearlyEqual(left[0], right[0]) && nearlyEqual(left[1], right[1]);
  }
  return typeof left === "number" && typeof right === "number" && nearlyEqual(left, right);
}

function matchingBandId(
  existing: FilterCondition | undefined,
  options: FilterBandOption[],
): string | null {
  if (!existing) return null;
  for (const opt of options) {
    if (
      existing.operator === opt.operator &&
      valuesMatch(opt.operator, existing.value, opt.value)
    ) {
      return opt.id;
    }
  }
  return null;
}

export function FilterControlNumeric({ def }: FilterControlNumericProps) {
  const { existing, upsertCondition, removeCondition } = useFilterCondition(def.field);
  const bands = FILTER_BANDS.byField[def.field];

  const [operator, setOperator] = useState<NumericOp>(() =>
    existing?.operator && isNumericOp(existing.operator) ? existing.operator : "gte",
  );
  const [value, setValue] = useState("");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [manualOpen, setManualOpen] = useState(false);

  const selectedBandId = useMemo(
    () => matchingBandId(existing, bands?.options ?? []),
    [existing, bands],
  );

  useEffect(() => {
    if (!existing || !isNumericOp(existing.operator)) {
      setOperator("gte");
      setValue("");
      setMinValue("");
      setMaxValue("");
      return;
    }

    setOperator(existing.operator);

    if (existing.operator === "between" && Array.isArray(existing.value)) {
      const [min, max] = existing.value as [number, number];
      setMinValue(parseDisplayValue(def, min));
      setMaxValue(parseDisplayValue(def, max));
      setValue("");
      return;
    }

    if (typeof existing.value === "number") {
      setValue(parseDisplayValue(def, existing.value));
      setMinValue("");
      setMaxValue("");
    }
  }, [existing, def]);

  // Open manual when an active condition isn't one of the quick bands.
  useEffect(() => {
    if (!bands?.options.length) {
      setManualOpen(true);
      return;
    }
    if (existing && !selectedBandId) {
      setManualOpen(true);
    }
  }, [bands, existing, selectedBandId]);

  function clearField() {
    removeCondition(def.field);
  }

  function applySingle(op: NumericOp, displayStr: string) {
    const parsed = Number.parseFloat(displayStr);
    if (!isValidDisplay(def, parsed)) {
      clearField();
      return;
    }

    upsertCondition({
      field: def.field,
      operator: op,
      value: toApiValue(def, parsed),
    });
  }

  function applyBetween(minStr: string, maxStr: string) {
    if (!isValidBetween(def, minStr, maxStr)) {
      clearField();
      return;
    }

    const minDisplay = Number.parseFloat(minStr);
    const maxDisplay = Number.parseFloat(maxStr);
    upsertCondition({
      field: def.field,
      operator: "between",
      value: [toApiValue(def, minDisplay), toApiValue(def, maxDisplay)],
    });
  }

  function handleOperatorChange(op: NumericOp) {
    setOperator(op);
    if (op === "between") {
      applyBetween(minValue, maxValue);
    } else {
      applySingle(op, value);
    }
  }

  function applyBand(opt: FilterBandOption) {
    setManualOpen(false);
    upsertCondition({
      field: def.field,
      operator: opt.operator,
      value: opt.value,
    });
  }

  const hint =
    def.kind === "percent"
      ? "Enter whole percent (e.g. 4 for 4%)"
      : def.kind === "currency" && def.field === "market_cap"
        ? "Enter value in billions SGD"
        : def.unit
          ? `Value in ${def.unit}`
          : undefined;

  const inputMin = def.min;
  const inputMax = def.max;
  const step =
    def.kind === "percent" ? 0.1 : def.field === "market_cap" ? 0.1 : def.kind === "currency" ? 0.01 : 1;

  const hasBands = Boolean(bands && bands.options.length > 0);

  return (
    <div className="space-y-2">
      <Label className="text-xs">{def.label}</Label>

      {hasBands ? (
        <div className="space-y-1" role="listbox" aria-label={`${def.label} quick options`}>
          {bands!.options.map((opt) => {
            const selected = selectedBandId === opt.id && !manualOpen;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left text-xs transition-colors",
                  selected
                    ? "border-primary/50 bg-primary/10"
                    : "border-transparent hover:bg-muted",
                )}
                onClick={() => applyBand(opt)}
              >
                <span className="font-medium leading-snug">{opt.label}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  {opt.basis}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            role="option"
            aria-selected={manualOpen}
            className={cn(
              "flex w-full flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left text-xs transition-colors",
              manualOpen
                ? "border-primary/50 bg-primary/10"
                : "border-transparent hover:bg-muted",
            )}
            onClick={() => setManualOpen(true)}
          >
            <span className="font-medium">Manual setup</span>
            <span className="text-[10px] text-muted-foreground leading-tight">
              Pick an operator and enter an exact value
            </span>
          </button>
        </div>
      ) : null}

      {(manualOpen || !hasBands) && (
        <div className="space-y-2 border-t border-border pt-2">
          {hint && (
            <p className="text-[11px] text-muted-foreground leading-tight">{hint}</p>
          )}

          <Select
            value={operator}
            onValueChange={(next) => handleOperatorChange(next as NumericOp)}
          >
            <SelectTrigger id={`${def.field}-op`} className="w-full" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[60]">
              {NUMERIC_OPS.map((op) => (
                <SelectItem key={op} value={op}>
                  {NUMERIC_OP_LABELS[op]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {operator === "between" ? (
            <div className="flex items-center gap-2">
              <NumericValueInput
                def={def}
                id={`${def.field}-min`}
                value={minValue}
                min={inputMin}
                max={inputMax}
                step={step}
                onChange={(next) => {
                  setMinValue(next);
                  applyBetween(next, maxValue);
                }}
              />
              <span className="text-xs text-muted-foreground shrink-0">–</span>
              <NumericValueInput
                def={def}
                id={`${def.field}-max`}
                value={maxValue}
                min={inputMin}
                max={inputMax}
                step={step}
                onChange={(next) => {
                  setMaxValue(next);
                  applyBetween(minValue, next);
                }}
              />
            </div>
          ) : (
            <NumericValueInput
              def={def}
              id={`${def.field}-value`}
              value={value}
              min={inputMin}
              max={inputMax}
              step={step}
              onChange={(next) => {
                setValue(next);
                applySingle(operator, next);
              }}
            />
          )}
        </div>
      )}

      {hasBands && (
        <p className="text-[10px] text-muted-foreground leading-tight">
          Bands from live SGX percentiles (as of {FILTER_BANDS.metricsAsOf ?? FILTER_BANDS.generatedAt}).
        </p>
      )}
    </div>
  );
}

function NumericValueInput({
  def,
  id,
  value,
  min,
  max,
  step,
  onChange,
}: {
  def: FieldDef;
  id: string;
  value: string;
  min?: number;
  max?: number;
  step: number;
  onChange: (value: string) => void;
}) {
  const isMarketCap = def.kind === "currency" && def.field === "market_cap";
  const isPercent = def.kind === "percent";
  const isSgd = def.kind === "currency" && !isMarketCap;

  return (
    <div className="relative flex-1">
      {isSgd && (
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          S$
        </span>
      )}
      {isMarketCap && (
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          S$
        </span>
      )}
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        placeholder={isMarketCap ? "e.g. 5" : isPercent ? "e.g. 4" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`tabular-nums ${isSgd || isMarketCap ? "pl-8" : ""} ${isMarketCap ? "pr-8" : isPercent ? "pr-7" : ""}`}
      />
      {isMarketCap && (
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          B
        </span>
      )}
      {isPercent && (
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          %
        </span>
      )}
    </div>
  );
}
