import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import { getScreenerApi } from "@/lib/screener/api";
import {
  MentionList,
  type MentionItem,
  type MentionListHandle,
} from "./MentionList";

const SEARCH_DEBOUNCE_MS = 200;

/** Mentions-only abort — never shared with facets / screen fetches. */
let searchAbort: AbortController | null = null;
let searchSeq = 0;

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && /aborted/i.test(err.message))
  );
}

/** TipTap applies whatever `items()` resolves to — never resolve stale work with []. */
function ignoreStaleResult(): Promise<MentionItem[]> {
  return new Promise(() => {
    /* intentionally never settles */
  });
}

async function searchMentions(query: string): Promise<MentionItem[]> {
  const seq = ++searchSeq;

  searchAbort?.abort();
  const controller = new AbortController();
  searchAbort = controller;

  await new Promise((r) => setTimeout(r, SEARCH_DEBOUNCE_MS));
  if (seq !== searchSeq) return ignoreStaleResult();

  try {
    const res = await getScreenerApi().searchStocks(
      query.trim(),
      controller.signal,
    );
    if (seq !== searchSeq) return ignoreStaleResult();
    return res.results;
  } catch (err) {
    if (controller.signal.aborted || isAbortError(err) || seq !== searchSeq) {
      return ignoreStaleResult();
    }
    return [];
  }
}

function listProps(
  props: SuggestionProps<MentionItem>,
  extras: { items: MentionItem[]; loading: boolean },
) {
  return {
    items: extras.items,
    query: props.query,
    loading: extras.loading,
    command: props.command,
  };
}

export const mentionSuggestion: Omit<SuggestionOptions, "editor"> = {
  char: "@",
  allowSpaces: false,
  decorationClass: "nl-mention-active",
  items: async ({ query }) => searchMentions(query),

  render: () => {
    let component: ReactRenderer<MentionListHandle> | undefined;
    let popup: TippyInstance[] | undefined;
    /** Last settled results — kept dimmed while a newer search is in flight. */
    let lastItems: MentionItem[] = [];

    function ensurePopup(props: SuggestionProps<MentionItem>) {
      if (!props.clientRect) return;
      if (popup?.[0]) {
        popup[0].setProps({
          getReferenceClientRect: props.clientRect as () => DOMRect,
        });
        return;
      }
      if (!component) return;
      popup = tippy("body", {
        getReferenceClientRect: props.clientRect as () => DOMRect,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: "manual",
        placement: "bottom-start",
      });
    }

    return {
      // Runs before `items()` awaits — show Searching… immediately.
      onBeforeStart: (props: SuggestionProps<MentionItem>) => {
        lastItems = [];
        component = new ReactRenderer(MentionList, {
          props: listProps(props, { items: [], loading: true }),
          editor: props.editor,
        });
        ensurePopup(props);
      },

      onStart: (props: SuggestionProps<MentionItem>) => {
        lastItems = props.items;
        component?.updateProps(
          listProps(props, { items: props.items, loading: false }),
        );
        ensurePopup(props);
      },

      onBeforeUpdate: (props: SuggestionProps<MentionItem>) => {
        component?.updateProps(
          listProps(props, { items: lastItems, loading: true }),
        );
        ensurePopup(props);
      },

      onUpdate: (props: SuggestionProps<MentionItem>) => {
        lastItems = props.items;
        component?.updateProps(
          listProps(props, { items: props.items, loading: false }),
        );
        ensurePopup(props);
      },

      onKeyDown: (props) => {
        if (props.event.key === "Escape") {
          popup?.[0]?.hide();
          return true;
        }
        return component?.ref?.onKeyDown(props) ?? false;
      },

      onExit: () => {
        searchAbort?.abort();
        searchAbort = null;
        searchSeq += 1;
        lastItems = [];
        popup?.[0]?.destroy();
        component?.destroy();
        popup = undefined;
        component = undefined;
      },
    };
  },
};
