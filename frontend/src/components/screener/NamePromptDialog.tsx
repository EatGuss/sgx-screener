import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface NamePromptResult {
  name: string;
  description?: string;
}

interface NamePromptDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  initialName?: string;
  /** When true, show an editable description field (Save as…). */
  showDescriptionField?: boolean;
  /** Async AI suggestion — applied only while the field is still untouched. */
  suggestedDescription?: string;
  /** Optional AI name suggestion when the name field is empty. */
  suggestedName?: string;
  descriptionSuggesting?: boolean;
  /** Quiet inline note when describe failed; save still works. */
  descriptionSuggestFailed?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (result: NamePromptResult) => void | Promise<void>;
}

export function NamePromptDialog({
  open,
  title,
  description,
  confirmLabel = "Save",
  initialName = "",
  showDescriptionField = false,
  suggestedDescription = "",
  suggestedName = "",
  descriptionSuggesting = false,
  descriptionSuggestFailed = false,
  onOpenChange,
  onConfirm,
}: NamePromptDialogProps) {
  const [name, setName] = useState(initialName);
  const [screenDescription, setScreenDescription] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const appliedSuggestionRef = useRef<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setScreenDescription("");
      setNameTouched(false);
      setDescriptionTouched(false);
      setError(null);
      setBusy(false);
      appliedSuggestionRef.current = null;
      queueMicrotask(() => inputRef.current?.select());
    }
  }, [open, initialName]);

  // Apply AI name only when the field is still empty / untouched.
  useEffect(() => {
    if (!open || nameTouched || !suggestedName.trim()) return;
    if (name.trim()) return;
    setName(suggestedName.trim());
  }, [open, suggestedName, nameTouched, name]);

  // Apply AI description only until the user edits the field.
  useEffect(() => {
    if (!open || !showDescriptionField || descriptionTouched) return;
    const next = suggestedDescription.trim();
    if (!next) return;
    if (
      screenDescription === "" ||
      screenDescription === appliedSuggestionRef.current
    ) {
      setScreenDescription(next);
      appliedSuggestionRef.current = next;
    }
  }, [
    open,
    showDescriptionField,
    suggestedDescription,
    descriptionTouched,
    screenDescription,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const desc = screenDescription.trim();
      await onConfirm({
        name: trimmed,
        ...(showDescriptionField && desc ? { description: desc } : {}),
      });
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const showSuggestOverlay =
    descriptionSuggesting && !screenDescription.trim() && !descriptionTouched;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <div className="grid gap-2">
              <Label htmlFor="screen-name-input">Name</Label>
              <Input
                ref={inputRef}
                id="screen-name-input"
                value={name}
                onChange={(e) => {
                  setNameTouched(true);
                  setName(e.target.value);
                }}
                placeholder="High-Yield Blue Chips"
                autoComplete="off"
                disabled={busy}
              />
            </div>
            {showDescriptionField ? (
              <div className="grid gap-2">
                <Label htmlFor="screen-description-input">Description</Label>
                <div className="relative">
                  <textarea
                    id="screen-description-input"
                    value={screenDescription}
                    onChange={(e) => {
                      setDescriptionTouched(true);
                      setScreenDescription(e.target.value);
                    }}
                    placeholder={
                      showSuggestOverlay
                        ? ""
                        : "Optional plain-English summary of this screen"
                    }
                    rows={3}
                    maxLength={280}
                    disabled={busy}
                    aria-busy={descriptionSuggesting || undefined}
                    className={cn(
                      "w-full min-w-0 resize-y rounded-md border border-input bg-transparent px-2.5 py-2 text-base shadow-xs outline-none",
                      "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                      "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                      showSuggestOverlay &&
                        "animate-pulse bg-muted/50 text-transparent caret-transparent",
                    )}
                  />
                  {showSuggestOverlay ? (
                    <div className="pointer-events-none absolute inset-x-2.5 top-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2
                        className="size-3.5 shrink-0 animate-spin"
                        aria-hidden
                      />
                      <span>Suggesting description…</span>
                    </div>
                  ) : null}
                </div>
                {descriptionSuggesting && !showSuggestOverlay ? (
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Loader2
                      className="size-3 shrink-0 animate-spin"
                      aria-hidden
                    />
                    Suggesting description…
                  </p>
                ) : null}
                {descriptionSuggestFailed &&
                !descriptionSuggesting &&
                !screenDescription.trim() ? (
                  <p className="text-[11px] text-muted-foreground">
                    Couldn&apos;t suggest a description — you can add one
                    yourself.
                  </p>
                ) : null}
              </div>
            ) : null}
            {error ? (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
