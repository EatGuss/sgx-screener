import type { FilterCondition, ScreenSpec, ScreenerField } from "screener-contract";
import {
  NlProposalEmpty,
  NlProposalItem,
  NlProposalPanel,
  NlProposalWarnings,
  splitNlWarnings,
} from "@/components/nl/NlProposalPanel";
import { ScrollFadeRegion } from "@/components/nl/ScrollFadeRegion";
import { conditionLabel } from "@/lib/screener/spec";

interface NlParsedReviewProps {
  spec: ScreenSpec;
  warnings?: string[];
  onRemoveCondition: (field: ScreenerField) => void;
  onApply: () => void;
  onDiscard: () => void;
  /** Primary confirm label — e.g. "Replace filters" when the builder already has pills. */
  applyLabel?: string;
  /** Overrides the default "Not applied yet…" subtitle. */
  subtitle?: string;
  className?: string;
}

/**
 * Staged NL proposal — visually distinct from the builder's active pill bar.
 * Does not call loadSpec; the parent applies only when the user confirms.
 */
export function NlParsedReview({
  spec,
  warnings,
  onRemoveCondition,
  onApply,
  onDiscard,
  applyLabel = "Apply filters",
  subtitle = "Not applied yet — review, remove any you don't want",
  className,
}: NlParsedReviewProps) {
  const hasConditions = spec.conditions.length > 0;
  const { product, stub } = splitNlWarnings(warnings);

  // Empty parse from the model — keep explanatory message (not user-cleared).
  if (!hasConditions) {
    return (
      <NlProposalEmpty onDismiss={onDiscard} className={className}>
        <NlProposalWarnings product={product} stub={stub} />
        <p className="text-xs text-muted-foreground">
          Couldn&apos;t interpret that — try rephrasing.
        </p>
      </NlProposalEmpty>
    );
  }

  return (
    <NlProposalPanel
      className={className}
      title="Proposed filters"
      subtitle={subtitle}
      ariaLabel="Proposed filters"
      onDiscard={onDiscard}
      onApply={onApply}
      applyLabel={applyLabel}
    >
      <ScrollFadeRegion
        className="min-h-0 flex-1"
        contentClassName="max-h-[min(40vh,16rem)]"
      >
        <div className="space-y-1.5 pb-0.5">
          <NlProposalWarnings product={product} stub={stub} />
          <ul className="flex flex-col gap-1.5">
            {spec.conditions.map((cond: FilterCondition) => (
              <li key={cond.field}>
                <NlProposalItem
                  removeLabel={`Remove proposed ${cond.field} filter`}
                  onRemove={() => {
                    // User cleared the last item — dismiss rather than empty Apply UI.
                    if (spec.conditions.length <= 1) {
                      onDiscard();
                      return;
                    }
                    onRemoveCondition(cond.field);
                  }}
                >
                  <span className="underline decoration-muted-foreground/70 decoration-dashed underline-offset-4">
                    {conditionLabel(cond)}
                  </span>
                </NlProposalItem>
              </li>
            ))}
          </ul>
          {spec.sort ? (
            <p className="text-[10px] text-muted-foreground">
              Proposed sort: {spec.sort.field} {spec.sort.direction}
            </p>
          ) : null}
        </div>
      </ScrollFadeRegion>
    </NlProposalPanel>
  );
}
