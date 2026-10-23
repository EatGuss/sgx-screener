import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { FIELD_DEFS, type NlRefineChange } from "screener-contract";
import {
  NlProposalEmpty,
  NlProposalItem,
  NlProposalPanel,
  NlProposalWarnings,
  splitNlWarnings,
} from "@/components/nl/NlProposalPanel";
import { ScrollFadeRegion } from "@/components/nl/ScrollFadeRegion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { conditionLabel } from "@/lib/screener/spec";
import { cn } from "@/lib/utils";

interface NlRefineReviewProps {
  changes: NlRefineChange[];
  warnings?: string[];
  onApply: (accepted: NlRefineChange[]) => void;
  onDiscard: () => void;
  className?: string;
}

/** Stable key for accept/reject state. */
export function refineChangeKey(change: NlRefineChange, index: number): string {
  if (change.op === "add") return `add:${change.condition.field}:${index}`;
  if (change.op === "remove") return `remove:${change.condition.field}:${index}`;
  return `modify:${change.to.field}:${index}`;
}

/** Human-readable change line, e.g. "P/E ≤ 20 → ≤ 15". */
export function formatRefineChange(change: NlRefineChange): string {
  if (change.op === "add") {
    return `+ ${conditionLabel(change.condition)}`;
  }
  if (change.op === "remove") {
    return `− ${conditionLabel(change.condition)}`;
  }
  const label = FIELD_DEFS[change.from.field]?.label ?? change.from.field;
  const fromFull = conditionLabel(change.from);
  const toFull = conditionLabel(change.to);
  const fromTail = fromFull.startsWith(label)
    ? fromFull.slice(label.length).trim()
    : fromFull;
  const toTail = toFull.startsWith(label)
    ? toFull.slice(label.length).trim()
    : toFull;
  return `${label} ${fromTail} → ${toTail}`;
}

function opBadge(op: NlRefineChange["op"]): string {
  if (op === "add") return "add";
  if (op === "remove") return "remove";
  return "modify";
}

/**
 * Staged NL refine proposal — per-change accept/reject, then apply accepted.
 */
export function NlRefineReview({
  changes,
  warnings,
  onApply,
  onDiscard,
  className,
}: NlRefineReviewProps) {
  const { product, stub } = splitNlWarnings(warnings);
  const keys = useMemo(
    () => changes.map((c, i) => refineChangeKey(c, i)),
    [changes],
  );

  const [accepted, setAccepted] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(keys.map((k) => [k, true])),
  );

  useEffect(() => {
    setAccepted(Object.fromEntries(keys.map((k) => [k, true])));
  }, [keys]);

  const acceptedChanges = changes.filter(
    (_, i) => accepted[keys[i]!] !== false,
  );
  const acceptedCount = acceptedChanges.length;

  // Empty result from the model — keep explanatory message (not user-cleared).
  if (changes.length === 0) {
    return (
      <NlProposalEmpty onDismiss={onDiscard} className={className}>
        <NlProposalWarnings product={product} stub={stub} />
        <p className="text-xs text-muted-foreground">
          No applicable changes — try rephrasing, or the screen may already
          match.
        </p>
      </NlProposalEmpty>
    );
  }

  function acceptKey(key: string) {
    setAccepted((prev) => ({ ...prev, [key]: true }));
  }

  function rejectKey(key: string) {
    const next = { ...accepted, [key]: false };
    const remaining = keys.filter((k) => next[k] !== false).length;
    if (remaining === 0) {
      onDiscard();
      return;
    }
    setAccepted(next);
  }

  return (
    <NlProposalPanel
      className={className}
      title="Proposed changes"
      subtitle="Accept or reject each change, then apply"
      ariaLabel="Proposed refinements"
      onDiscard={onDiscard}
      onApply={() => onApply(acceptedChanges)}
      applyLabel={`Apply changes (${acceptedCount})`}
      applyDisabled={acceptedCount === 0}
    >
      <ScrollFadeRegion className="min-h-0 flex-1">
        <div className="space-y-1.5 pb-0.5">
          <NlProposalWarnings product={product} stub={stub} />
          <ul className="flex flex-col gap-1.5">
            {changes.map((change, index) => {
              const key = keys[index]!;
              const isOn = accepted[key] !== false;
              const label = formatRefineChange(change);
              return (
                <li key={key}>
                  <NlProposalItem
                    muted={!isOn}
                    removeLabel={`Reject ${label}`}
                    onRemove={() => rejectKey(key)}
                    trailing={
                      <Button
                        type="button"
                        variant={isOn ? "secondary" : "ghost"}
                        size="icon"
                        className={cn(
                          "size-6 shrink-0",
                          isOn && "text-foreground",
                        )}
                        aria-label={`Accept ${label}`}
                        aria-pressed={isOn}
                        onClick={() => acceptKey(key)}
                      >
                        <Check className="size-3.5" />
                      </Button>
                    }
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className="h-5 px-1.5 text-[10px] font-normal uppercase tracking-wide"
                      >
                        {opBadge(change.op)}
                      </Badge>
                      <span>{label}</span>
                    </div>
                  </NlProposalItem>
                </li>
              );
            })}
          </ul>
        </div>
      </ScrollFadeRegion>
    </NlProposalPanel>
  );
}
