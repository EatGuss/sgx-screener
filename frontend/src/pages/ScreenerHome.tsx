import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { NlParseResponse, ScreenerField, ScreenSpec } from "screener-contract";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NlEditor, type NlEditorValue } from "@/components/nl/NlEditor";
import { NlParsedReview } from "@/components/nl/NlParsedReview";
import { PresetsGrid } from "@/components/presets/PresetsGrid";
import { SavedScreensGrid } from "@/components/presets/SavedScreensGrid";
import { CollapsibleScreenSection } from "@/components/screener/CollapsibleScreenSection";
import { ScreenerAppShell } from "@/components/ScreenerAppShell";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useScreenSpec } from "@/hooks/useScreenSpec";
import { getScreenerApi } from "@/lib/screener/api";
import {
  NL_EDITOR_PLACEHOLDER,
  NL_EXAMPLE_PROMPTS,
} from "@/lib/screener/nlExamples";
import { DEFAULT_SCREEN_SPEC } from "@/lib/screener/spec";

const EMPTY_NL: NlEditorValue = { text: "", references: [] };

export default function ScreenerHome() {
  const navigate = useNavigate();
  const { signedIn } = useAuth();
  const { loadSpec } = useScreenSpec();

  const [nl, setNl] = useState<NlEditorValue>(EMPTY_NL);
  const [editorKey, setEditorKey] = useState(0);
  const [seedText, setSeedText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<NlParseResponse | null>(null);

  const canParse = nl.text.trim().length > 0 && !parsing;

  /** Fill the editor from an example chip — does not parse/submit. */
  function fillExample(text: string) {
    setSeedText(text);
    setNl({ text, references: [] });
    setEditorKey((k) => k + 1);
    setParsed(null);
    setParseError(null);
  }

  async function handleParse() {
    const text = nl.text.trim();
    if (!text) return;

    setParsing(true);
    setParseError(null);
    setParsed(null);

    try {
      const result = await getScreenerApi().parseNl({
        text,
        references: nl.references.length > 0 ? nl.references : undefined,
      });
      setParsed(result);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Couldn't understand that";
      setParseError(
        /couldn'?t understand|validation|failed/i.test(message)
          ? message
          : `Couldn't understand that — ${message}`,
      );
    } finally {
      setParsing(false);
    }
  }

  function removeParsedCondition(field: ScreenerField) {
    setParsed((prev) => {
      if (!prev) return prev;
      const conditions = prev.spec.conditions.filter((c) => c.field !== field);
      // Last chip removed → drop the proposal (not the empty-parse message).
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

  function clearParsed() {
    setParsed(null);
    setParseError(null);
  }

  function applyProposedFilters() {
    if (!parsed || parsed.spec.conditions.length === 0) return;
    const spec: ScreenSpec = {
      ...DEFAULT_SCREEN_SPEC,
      ...parsed.spec,
      page: 1,
    };
    loadSpec(spec, {
      screenName: "Untitled screen",
      source: "nl",
      screenId: null,
    });
    setParsed(null);
    navigate("/screener");
  }

  return (
    <ScreenerAppShell>
      <div className="flex min-h-svh flex-col">
        <header className="border-b px-4 py-3">
          <div className="mx-auto flex max-w-5xl items-center gap-2">
            <SidebarTrigger className="-ml-1 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold">SGX Stock Screener</h1>
              <p className="text-xs text-muted-foreground">
                Curated screens for Singapore equities
              </p>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-8">
          <section className="space-y-2">
            <Label className="text-sm font-medium">
              Describe what you&apos;re looking for
            </Label>
            <NlEditor
              key={editorKey}
              initialText={seedText}
              placeholder={NL_EDITOR_PLACEHOLDER}
              onChange={setNl}
            />
            <p className="text-xs text-muted-foreground">
              Find filters from your description, then review and edit before
              running.
            </p>
            <div className="flex flex-wrap gap-2">
              {NL_EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => fillExample(prompt)}
                  className="rounded-full border border-border bg-background px-3 py-1 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                type="button"
                onClick={() => void handleParse()}
                disabled={!canParse}
              >
                {parsing ? "Finding…" : "Find filters"}
              </Button>
            </div>

            {parseError ? (
              <div
                className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                <p className="font-medium">Couldn&apos;t understand that</p>
                <p className="mt-1 text-xs opacity-90">{parseError}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Your text is still in the editor — try rephrasing.
                </p>
              </div>
            ) : null}

            {parsed ? (
              <NlParsedReview
                spec={parsed.spec}
                warnings={parsed.warnings}
                onRemoveCondition={removeParsedCondition}
                onApply={applyProposedFilters}
                onDiscard={clearParsed}
              />
            ) : null}

            {!parsed && nl.references.length > 0 ? (
              <p className="font-mono text-[11px] text-muted-foreground">
                Referenced: {nl.references.join(", ")}
              </p>
            ) : null}
          </section>

          <CollapsibleScreenSection
            sectionId="homePresets"
            title="Presets"
            description="Click a card to open the builder with those filters applied."
          >
            <PresetsGrid />
          </CollapsibleScreenSection>

          {signedIn ? (
            <CollapsibleScreenSection
              sectionId="homeSaved"
              title="My screens"
              description="Screens you’ve saved from the builder."
            >
              <SavedScreensGrid />
            </CollapsibleScreenSection>
          ) : null}
        </main>
      </div>
    </ScreenerAppShell>
  );
}
