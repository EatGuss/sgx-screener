import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { SavedScreen } from "screener-contract";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useScreenSpec } from "@/hooks/useScreenSpec";
import { getScreenerApi } from "@/lib/screener/api";
import { specSummary } from "@/lib/screener/spec";
import { cn } from "@/lib/utils";
import { ClampedScreenSummary } from "@/components/screener/ClampedScreenSummary";
import { CollapsibleScreenSection } from "@/components/screener/CollapsibleScreenSection";
import { NamePromptDialog } from "./NamePromptDialog";

interface OpenScreenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PresetItem {
  id: string;
  name: string;
  summary: string;
  spec: SavedScreen["spec"];
  columns?: SavedScreen["columns"];
}

export function OpenScreenDialog({ open, onOpenChange }: OpenScreenDialogProps) {
  const { signedIn, loading: authLoading } = useAuth();
  const { loadSpec } = useScreenSpec();
  const [query, setQuery] = useState("");
  const [presets, setPresets] = useState<PresetItem[]>([]);
  const [screens, setScreens] = useState<SavedScreen[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<SavedScreen | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const presetsRes = await getScreenerApi().getPresets();
      setPresets(
        presetsRes.presets.map((p) => ({
          id: p.id,
          name: p.name,
          summary: specSummary(p.spec),
          spec: p.spec,
          columns: p.columns,
        })),
      );

      if (signedIn) {
        const saved = await getScreenerApi().listScreens();
        setScreens(saved.screens);
      } else {
        setScreens([]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load screens");
    } finally {
      setLoading(false);
    }
  }, [signedIn]);

  useEffect(() => {
    if (open && !authLoading) {
      setQuery("");
      void refresh();
    }
  }, [open, authLoading, refresh]);

  const needle = query.trim().toLowerCase();

  const filteredPresets = useMemo(() => {
    if (!needle) return presets;
    return presets.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.summary.toLowerCase().includes(needle),
    );
  }, [presets, needle]);

  const filteredScreens = useMemo(() => {
    if (!needle) return screens;
    return screens.filter(
      (s) =>
        s.name.toLowerCase().includes(needle) ||
        (s.description?.toLowerCase().includes(needle) ?? false),
    );
  }, [screens, needle]);

  function openPreset(preset: PresetItem) {
    loadSpec(preset.spec, {
      screenName: preset.name,
      source: "preset",
      screenId: null,
      columns: preset.columns ?? null,
    });
    onOpenChange(false);
  }

  function openSaved(screen: SavedScreen) {
    loadSpec(screen.spec, {
      screenId: screen.id,
      screenName: screen.name,
      source: "saved",
      columns: screen.columns ?? null,
    });
    onOpenChange(false);
  }

  async function handleDuplicate(screen: SavedScreen) {
    const copy = await getScreenerApi().saveScreen({
      name: `${screen.name} (copy)`,
      spec: screen.spec,
      columns: screen.columns,
      ...(screen.description ? { description: screen.description } : {}),
    });
    setScreens((prev) => [copy, ...prev.filter((s) => s.id !== copy.id)]);
  }

  async function handleDelete(screen: SavedScreen) {
    if (!window.confirm(`Delete “${screen.name}”? This cannot be undone.`)) {
      return;
    }
    await getScreenerApi().deleteScreen(screen.id);
    setScreens((prev) => prev.filter((s) => s.id !== screen.id));
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>Open screen</DialogTitle>
            <DialogDescription>
              Presets and your saved screens.
            </DialogDescription>
          </DialogHeader>

          <div className="border-b px-4 py-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search screens…"
              autoFocus
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {loading || authLoading ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Loading…
              </p>
            ) : error ? (
              <p className="px-2 py-6 text-center text-sm text-destructive">
                {error}
              </p>
            ) : (
              <div className="space-y-4 px-1 pb-2">
                <CollapsibleScreenSection
                  sectionId="openPresets"
                  title="Presets"
                  count={filteredPresets.length}
                  className="space-y-1"
                >
                  {filteredPresets.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-muted-foreground">
                      No matching presets
                    </p>
                  ) : (
                    <ul className="space-y-0.5">
                      {filteredPresets.map((preset) => (
                        <li key={preset.id}>
                          <button
                            type="button"
                            className={cn(
                              "w-full rounded-md px-2 py-2 text-left hover:bg-muted",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            )}
                            onClick={() => openPreset(preset)}
                          >
                            <div className="text-sm font-medium">{preset.name}</div>
                            <div className="line-clamp-2 text-[11px] text-muted-foreground">
                              {preset.summary}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CollapsibleScreenSection>

                <CollapsibleScreenSection
                  sectionId="openSaved"
                  title="My screens"
                  count={signedIn ? filteredScreens.length : undefined}
                  className="space-y-1"
                >
                  {!signedIn ? (
                    <p className="px-2 py-3 text-sm text-muted-foreground">
                      <Link
                        to="/login"
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        Log in
                      </Link>{" "}
                      to save screens
                    </p>
                  ) : filteredScreens.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-muted-foreground">
                      {needle
                        ? "No matching saved screens"
                        : "No saved screens yet"}
                    </p>
                  ) : (
                    <ul className="space-y-0.5">
                      {filteredScreens.map((screen) => {
                        const summary =
                          screen.description?.trim() ||
                          specSummary(screen.spec);
                        return (
                          <li
                            key={screen.id}
                            className="group flex items-stretch gap-1 rounded-md hover:bg-muted"
                          >
                            {/* div+role=button: TooltipTrigger must not nest inside <button>. */}
                            <div
                              role="button"
                              tabIndex={0}
                              className="min-w-0 flex-1 cursor-pointer px-2 py-2 text-left"
                              onClick={() => openSaved(screen)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  openSaved(screen);
                                }
                              }}
                            >
                              <div className="truncate text-sm font-medium">
                                {screen.name}
                              </div>
                              <ClampedScreenSummary
                                text={summary}
                                className="text-[11px]"
                              />
                            </div>
                            <div className="flex shrink-0 items-center gap-0.5 pr-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                aria-label={`Rename ${screen.name}`}
                                onClick={() => setRenameTarget(screen)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                aria-label={`Duplicate ${screen.name}`}
                                onClick={() => void handleDuplicate(screen)}
                              >
                                <Copy className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-7 text-destructive hover:text-destructive"
                                aria-label={`Delete ${screen.name}`}
                                onClick={() => void handleDelete(screen)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CollapsibleScreenSection>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <NamePromptDialog
        open={renameTarget != null}
        title="Rename screen"
        confirmLabel="Rename"
        initialName={renameTarget?.name ?? ""}
        onOpenChange={(next) => {
          if (!next) setRenameTarget(null);
        }}
        onConfirm={async ({ name }) => {
          if (!renameTarget) return;
          const updated = await getScreenerApi().updateScreen(renameTarget.id, {
            name,
          });
          setScreens((prev) =>
            prev.map((s) => (s.id === updated.id ? updated : s)),
          );
          setRenameTarget(null);
        }}
      />
    </>
  );
}
