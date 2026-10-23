import Mention from "@tiptap/extension-mention";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { cn } from "@/lib/utils";
import { mentionSuggestion } from "./mentionSuggestion";
import "tippy.js/dist/tippy.css";

/** Payload Stage 2's parse call will consume. */
export interface NlEditorValue {
  text: string;
  references: string[];
}

export interface NlEditorProps {
  className?: string;
  onChange?: (value: NlEditorValue) => void;
  placeholder?: string;
  /**
   * Seed text when the editor mounts. Remount with a new `key` to apply a
   * different seed (e.g. example-prompt chips).
   */
  initialText?: string;
}

function collectMentionIds(doc: JSONContent): string[] {
  const ids: string[] = [];
  const walk = (node: JSONContent) => {
    if (node.type === "mention" && typeof node.attrs?.id === "string") {
      ids.push(node.attrs.id);
    }
    node.content?.forEach(walk);
  };
  walk(doc);
  return [...new Set(ids)];
}

export function NlEditor({
  className,
  onChange,
  placeholder = "e.g. REITs yielding over 6%",
  initialText = "",
}: NlEditorProps) {
  const editor = useEditor({
    content: initialText,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      Mention.configure({
        HTMLAttributes: {
          class: "nl-mention",
        },
        suggestion: mentionSuggestion,
      }),
    ],
    editorProps: {
      attributes: {
        class: cn(
          "min-h-[5.5rem] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "prose-nl",
        ),
        "aria-label": "Describe what you're looking for",
        "data-placeholder": placeholder,
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange?.({
        text: ed.getText(),
        references: collectMentionIds(ed.getJSON()),
      });
    },
  });

  return (
    <div className={cn("relative", className)}>
      <EditorContent editor={editor} />
      {editor?.isEmpty ? (
        <p
          className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground"
          aria-hidden
        >
          {placeholder}
        </p>
      ) : null}
    </div>
  );
}
