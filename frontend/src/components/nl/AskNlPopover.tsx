import { useState } from "react";
import { MessageSquareText } from "lucide-react";
import type {
  NlParseResponse,
  NlRefineChange,
  NlRefineResponse,
  ScreenerField,
  ScreenSpec,
} from "screener-contract";
import { NlEditor, type NlEditorValue } from "@/components/nl/NlEditor";
import { NlParsedReview } from "@/components/nl/NlParsedReview";
import { NlRefineReview } from "@/components/nl/NlRefineReview";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useScreenSpec } from "@/hooks/useScreenSpec";
import { getScreenerApi } from "@/lib/screener/api";
import { applyRefineChanges } from "@/lib/screener/applyRefineChanges";
import {
  NL_EDITOR_PLACEHOLDER,
  NL_EXAMPLE_PROMPTS,
  NL_REFINE_EXAMPLE_PROMPTS,
  NL_REFINE_HINT,
  NL_REFINE_PLACEHOLDER,
} from "@/lib/screener/nlExamples";
import { DEFAULT_SCREEN_SPEC } from "@/lib/screener/spec";
import { cn } from "@/lib/utils";

const EMPTY_NL: NlEditorValue = { text: "", references: [] };

const chipClassName =
  "rounded-full border border-border bg-background px-2.5 py-0.5 text-left text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground";

interface AskNlPopoverProps {
  className?: string;
  /** Trigger button size — pill bar uses sm; mobile may prefer default. */
  triggerSize?: "sm" | "xs";
}

/**
 * Builder-side NL entry: parse when the screen is empty; refine (diff) when
 * filters already exist. Applying merges accepted refine ops onto the current
 * spec, or replaces with a one-shot parse result.
 */
export function AskNlPopover({
  className,
  triggerSize = "sm",
}: AskNlPopoverProps) {
  const { spec: activeSpec, loadSpec } = useScreenSpec();
  const hasActiveFilters = activeSpec.conditions.length > 0;

  const [open, setOpen] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [seedText, setSeedText] = useState("");
  const [nl, setNl] = useState<NlEditorValue>(EMPTY_NL);
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<NlParseResponse | null>(null);
  const [refined, setRefined] = useState<NlRefineResponse | null>(null);

  const canSubmit = nl.text.trim().length > 0 && !busy;

  function resetProposal() {
    setParsed(null);
    setRefined(null);
    setRequestError(null);
  }

  function fillExample(text: string) {
    setSeedText(text);
    setNl({ text, references: [] });
    setEditorKey((k) => k + 1);
    resetProposal();
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setEditorKey((k) => k + 1);
      setSeedText("");
      setNl(EMPTY_NL);
      resetProposal();
      setBusy(false);
      return;
    }
    resetProposal();
    setSeedText("");
    setNl(EMPTY_NL);
    setBusy(false);
  }

  async function handleSubmit() {
    const text = nl.text.trim();
    if (!text) return;

    setBusy(true);
    setRequestError(null);
    setParsed(null);
    setRefined(null);

    try {
      if (hasActiveFilters) {
        const result = await getScreenerApi().refineNl({
          text,
          currentSpec: activeSpec,
          references: nl.references.length > 0 ? nl.references : undefined,
        });
        setRefined(result);
      } else {
        const result = await getScreenerApi().parseNl({
          text,
          references: nl.references.length > 0 ? nl.references : undefined,
        });
        setParsed(result);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Couldn't understand that";
      setRequestError(
        /couldn'?t understand|validation|failed|refine/i.test(message)
          ? message
          : `Couldn't understand that — ${message}`,
      );
    } finally {
      setBusy(false);
    }
  }

  function removeParsedCondition(field: ScreenerField) {
    setParsed((prev) => {
      if (!prev) return prev;
      const conditions = prev.spec.conditions.filter((c) => c.field !== field);
      if (conditions.length === 0) return null;
      return {
        ...prev,
        spec: {
          ...prev.spec,
          conditions,
        },
      };
    });
  }

  function applyProposedFilters() {
    if (!parsed || parsed.spec.conditions.length === 0) return;
    const next: ScreenSpec = {
      ...DEFAULT_SCREEN_SPEC,
      ...parsed.spec,
      page: 1,
    };
    loadSpec(next, {
      source: "nl",
      screenId: null,
    });
    handleOpenChange(false);
  }

  function applyRefinements(accepted: NlRefineChange[]) {
    if (accepted.length === 0) return;
    const next = applyRefineChanges(activeSpec, accepted);
    loadSpec(next, {
      source: "nl",
      screenId: null,
    });
    handleOpenChange(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={triggerSize}
          className={cn(
            triggerSize === "sm" && "h-8 rounded-full px-3 text-xs",
            triggerSize === "xs" && "h-6 rounded-full px-2 text-xs",
            "gap-1.5",
            className,
          )}
        >
          <MessageSquareText className="size-3.5" aria-hidden />
          Ask
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="flex max-h-[70vh] w-[min(100vw-2rem,28rem)] flex-col gap-0 overflow-hidden p-3"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* Input + submit stay pinned; only the proposal list scrolls. */}
        <div className="shrink-0 space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-medium">
              {hasActiveFilters
                ? "Refine this screen"
                : "Describe what you're looking for"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {hasActiveFilters
                ? "We'll propose changes to your current filters — accept the ones you want."
                : "We'll turn this into filters you can review and edit before running."}
            </p>
          </div>

          <NlEditor
            key={editorKey}
            className="min-h-[4.5rem] text-sm"
            initialText={seedText}
            onChange={setNl}
            placeholder={
              hasActiveFilters ? NL_REFINE_PLACEHOLDER : NL_EDITOR_PLACEHOLDER
            }
          />

          {hasActiveFilters ? (
            <p className="text-[11px] leading-snug text-muted-foreground">
              {NL_REFINE_HINT}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-1.5">
            {(hasActiveFilters
              ? NL_REFINE_EXAMPLE_PROMPTS
              : NL_EXAMPLE_PROMPTS
            ).map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => fillExample(prompt)}
                className={chipClassName}
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="xs"
              className="h-7 px-2.5 text-xs"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
            >
              {busy
                ? hasActiveFilters
                  ? "Refining…"
                  : "Parsing…"
                : hasActiveFilters
                  ? "Refine"
                  : "Parse"}
            </Button>
            {nl.references.length > 0 ? (
              <p className="font-mono text-[10px] text-muted-foreground">
                @{nl.references.join(", ")}
              </p>
            ) : null}
          </div>

          {requestError ? (
            <div
              className="rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-2 text-xs text-destructive"
              role="alert"
            >
              <p className="font-medium">Couldn&apos;t understand that</p>
              <p className="mt-1 opacity-90">{requestError}</p>
            </div>
          ) : null}
        </div>

        {parsed && !hasActiveFilters ? (
          <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
            <NlParsedReview
              className="min-h-0 flex-1"
              spec={parsed.spec}
              warnings={parsed.warnings}
              onRemoveCondition={removeParsedCondition}
              onApply={applyProposedFilters}
              onDiscard={resetProposal}
              applyLabel="Apply filters"
            />
          </div>
        ) : null}

        {refined && hasActiveFilters ? (
          <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
            <NlRefineReview
              className="min-h-0 flex-1"
              changes={refined.changes}
              warnings={refined.warnings}
              onApply={applyRefinements}
              onDiscard={resetProposal}
            />
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
