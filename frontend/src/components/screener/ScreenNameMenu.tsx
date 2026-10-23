import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import type { ScreenerField, StockRow } from "screener-contract";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import {
  UNTITLED_SCREEN_NAME,
  useScreenSpec,
} from "@/hooks/useScreenSpec";
import { getScreenerApi } from "@/lib/screener/api";
import { downloadResultsCsv } from "@/lib/screener/csv";
import { describeScreenCached } from "@/lib/screener/describeCache";
import { buildScreenShareUrl } from "@/lib/screener/url-spec";
import { cn } from "@/lib/utils";
import { NamePromptDialog } from "./NamePromptDialog";
import { OpenScreenDialog } from "./OpenScreenDialog";

interface ScreenNameMenuProps {
  rows: StockRow[];
  columns: ScreenerField[];
  className?: string;
}

export function ScreenNameMenu({
  rows,
  columns,
  className,
}: ScreenNameMenuProps) {
  const { signedIn } = useAuth();
  const {
    spec,
    customColumns,
    screenId,
    screenName,
    isDirty,
    createNewScreen,
    setScreenName,
    markSaved,
    makeLocalCopy,
  } = useScreenSpec();

  const [openDialog, setOpenDialog] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [suggestedDescription, setSuggestedDescription] = useState("");
  const [suggestedName, setSuggestedName] = useState("");
  const [descriptionSuggesting, setDescriptionSuggesting] = useState(false);
  const [descriptionSuggestFailed, setDescriptionSuggestFailed] =
    useState(false);

  const displayName = screenName || UNTITLED_SCREEN_NAME;
  const columnsPayload =
    customColumns.length > 0 ? customColumns : undefined;

  // Kick off describe when Save as opens — never await this in persist/save.
  useEffect(() => {
    if (!saveAsOpen) {
      setSuggestedDescription("");
      setSuggestedName("");
      setDescriptionSuggesting(false);
      setDescriptionSuggestFailed(false);
      return;
    }
    const ac = new AbortController();
    setDescriptionSuggesting(true);
    setDescriptionSuggestFailed(false);
    setSuggestedDescription("");
    setSuggestedName("");
    void describeScreenCached(spec, ac.signal)
      .then((res) => {
        if (ac.signal.aborted) return;
        setSuggestedDescription(res.description);
        if (res.name) setSuggestedName(res.name);
      })
      .catch(() => {
        // Missing key / timeout / 5xx — quiet hint in the dialog; save still works.
        if (!ac.signal.aborted) setDescriptionSuggestFailed(true);
      })
      .finally(() => {
        if (!ac.signal.aborted) setDescriptionSuggesting(false);
      });
    return () => ac.abort();
  }, [saveAsOpen, spec]);

  async function persistNew(name: string, description?: string) {
    if (!signedIn) {
      throw new Error("Log in to save screens");
    }
    const saved = await getScreenerApi().saveScreen({
      name,
      spec,
      columns: columnsPayload,
      ...(description?.trim() ? { description: description.trim() } : {}),
    });
    markSaved(saved);
    toast.success(`Saved “${saved.name}”`);
  }

  async function handleSave() {
    if (!signedIn) {
      toast.error("Log in to save screens");
      return;
    }
    if (screenId != null && !isDirty && screenName.trim()) {
      toast.message("Already saved");
      return;
    }
    if (screenId != null) {
      try {
        const saved = await getScreenerApi().updateScreen(screenId, {
          name: screenName,
          spec,
          columns: columnsPayload ?? [],
        });
        markSaved(saved);
        toast.success(`Saved “${saved.name}”`);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
      return;
    }
    setSaveAsOpen(true);
  }

  async function handleRename(name: string) {
    if (screenId != null && signedIn) {
      const saved = await getScreenerApi().updateScreen(screenId, { name });
      markSaved({ ...saved, spec });
      toast.success("Renamed");
      return;
    }
    setScreenName(name);
  }

  async function handleDelete() {
    if (screenId == null) return;
    if (!window.confirm(`Delete “${displayName}”? This cannot be undone.`)) {
      return;
    }
    try {
      await getScreenerApi().deleteScreen(screenId);
      createNewScreen();
      toast.success("Screen deleted");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function handleDownloadCsv() {
    if (rows.length === 0) {
      toast.message("No results to download");
      return;
    }
    downloadResultsCsv(rows, columns, displayName);
  }

  async function handleCopyLink() {
    const shareName =
      screenName.trim() && screenName !== UNTITLED_SCREEN_NAME
        ? screenName.trim()
        : null;
    const url = buildScreenShareUrl(spec, { name: shareName });
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  }

  return (
    <>
      <div className={cn("min-w-0", className)}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="h-auto max-w-full justify-start gap-1.5 px-2 py-1 text-left font-normal"
            >
              <span className="truncate text-base font-semibold sm:text-lg">
                {displayName}
              </span>
              {isDirty ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  • Modified
                </span>
              ) : null}
              <ChevronDown className="size-4 shrink-0 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem
              onSelect={() => {
                void handleSave();
              }}
            >
              Save
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setSaveAsOpen(true)}>
              Save as…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                makeLocalCopy();
                toast.message("Local copy — save to keep it");
              }}
            >
              Make a copy
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                void handleCopyLink();
              }}
            >
              Copy link
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleDownloadCsv}>
              Download results as CSV
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => createNewScreen()}>
              Create new screen
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setOpenDialog(true)}>
              Open screen…
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={screenId == null}
              variant="destructive"
              onSelect={() => {
                void handleDelete();
              }}
            >
              Delete
            </DropdownMenuItem>
            {!signedIn ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/login">Log in to save screens</Link>
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        <p className="hidden px-2 text-xs text-muted-foreground sm:block">
          Filters as pills · full-width results
        </p>
      </div>

      <OpenScreenDialog open={openDialog} onOpenChange={setOpenDialog} />

      <NamePromptDialog
        open={saveAsOpen}
        title="Save as"
        description={
          signedIn
            ? "Save this screen to your account. Description is optional and can be edited."
            : "You need to log in to persist screens."
        }
        confirmLabel="Save"
        initialName={
          displayName === UNTITLED_SCREEN_NAME ? "" : displayName
        }
        showDescriptionField
        suggestedDescription={suggestedDescription}
        suggestedName={
          displayName === UNTITLED_SCREEN_NAME ? suggestedName : ""
        }
        descriptionSuggesting={descriptionSuggesting}
        descriptionSuggestFailed={descriptionSuggestFailed}
        onOpenChange={setSaveAsOpen}
        onConfirm={async ({ name, description }) => {
          if (!signedIn) {
            throw new Error("Log in to save screens");
          }
          await persistNew(name, description);
        }}
      />

      <NamePromptDialog
        open={renameOpen}
        title="Rename screen"
        confirmLabel="Rename"
        initialName={displayName === UNTITLED_SCREEN_NAME ? "" : displayName}
        onOpenChange={setRenameOpen}
        onConfirm={async ({ name }) => {
          await handleRename(name);
        }}
      />
    </>
  );
}
