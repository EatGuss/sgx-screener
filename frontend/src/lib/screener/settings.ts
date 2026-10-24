/**
 * Per-browser screener preferences (localStorage).
 * DB-backed per-user settings are future work — do not put these in /api/v1/settings.
 */
import type { ColumnPresetId } from "./column-presets";
import { COLUMN_PRESETS } from "./column-presets";

export const SCREENER_SETTINGS_KEY = "screener.settings";

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export type ScreenerPageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export type ScreenerRowDensity = "comfortable" | "compact";

export type DefaultScreenPreference =
  | { type: "none" }
  | { type: "preset"; presetId: string }
  | { type: "saved"; screenId: number };

export type CollapsibleSectionId =
  | "homePresets"
  | "homeSaved"
  | "openPresets"
  | "openSaved";

export type SectionCollapsedState = Record<CollapsibleSectionId, boolean>;

/** Desktop stock-detail drawer width (px). */
export const DETAIL_DRAWER_WIDTH_MIN = 320;
export const DETAIL_DRAWER_WIDTH_MAX = 720;
export const DETAIL_DRAWER_WIDTH_DEFAULT = 512;

export interface ScreenerSettings {
  defaultColumnTab: ColumnPresetId;
  defaultScreen: DefaultScreenPreference;
  pageSize: ScreenerPageSize;
  rowDensity: ScreenerRowDensity;
  /** When true, entering /screener collapses the app sidebar. */
  autoCollapseSidebar: boolean;
  /**
   * Unused: left over from an earlier watchlist integration. Still parsed so
   * settings saved by older versions load cleanly.
   */
  defaultWatchlistId: number | null;
  /** Persisted width of the desktop stock detail drawer (px). */
  detailDrawerWidth: number;
  /** Collapsed state for Presets / My screens sections (home + open dialog). */
  sectionCollapsed: SectionCollapsedState;
}

export const DEFAULT_SECTION_COLLAPSED: SectionCollapsedState = {
  homePresets: false,
  homeSaved: false,
  openPresets: false,
  openSaved: false,
};

export const DEFAULT_SCREENER_SETTINGS: ScreenerSettings = {
  defaultColumnTab: "overview",
  defaultScreen: { type: "none" },
  pageSize: 50,
  rowDensity: "comfortable",
  autoCollapseSidebar: true,
  defaultWatchlistId: null,
  detailDrawerWidth: DETAIL_DRAWER_WIDTH_DEFAULT,
  sectionCollapsed: { ...DEFAULT_SECTION_COLLAPSED },
};

export function clampDetailDrawerWidth(width: number): number {
  if (!Number.isFinite(width)) return DETAIL_DRAWER_WIDTH_DEFAULT;
  return Math.min(
    DETAIL_DRAWER_WIDTH_MAX,
    Math.max(DETAIL_DRAWER_WIDTH_MIN, Math.round(width)),
  );
}

const COLUMN_TAB_IDS = new Set<string>(COLUMN_PRESETS.map((p) => p.id));

type Listener = (settings: ScreenerSettings) => void;
const listeners = new Set<Listener>();

function emit(settings: ScreenerSettings): void {
  for (const listener of listeners) {
    listener(settings);
  }
}

/** Subscribe to settings writes (same-tab). Returns unsubscribe. */
export function subscribeScreenerSettings(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function isPageSize(value: unknown): value is ScreenerPageSize {
  return (
    typeof value === "number" &&
    (PAGE_SIZE_OPTIONS as readonly number[]).includes(value)
  );
}

function parseDefaultScreen(raw: unknown): DefaultScreenPreference {
  if (!raw || typeof raw !== "object") return { type: "none" };
  const obj = raw as Record<string, unknown>;
  if (obj.type === "none") return { type: "none" };
  if (obj.type === "preset" && typeof obj.presetId === "string" && obj.presetId.trim()) {
    return { type: "preset", presetId: obj.presetId.trim() };
  }
  if (obj.type === "saved" && typeof obj.screenId === "number" && Number.isFinite(obj.screenId)) {
    return { type: "saved", screenId: Math.trunc(obj.screenId) };
  }
  return { type: "none" };
}

/** Coerce unknown JSON into a full settings object; never throws. */
export function parseScreenerSettings(raw: unknown): ScreenerSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_SCREENER_SETTINGS };
  }
  const obj = raw as Record<string, unknown>;

  const defaultColumnTab =
    typeof obj.defaultColumnTab === "string" &&
    COLUMN_TAB_IDS.has(obj.defaultColumnTab)
      ? (obj.defaultColumnTab as ColumnPresetId)
      : DEFAULT_SCREENER_SETTINGS.defaultColumnTab;

  const pageSize = isPageSize(obj.pageSize)
    ? obj.pageSize
    : DEFAULT_SCREENER_SETTINGS.pageSize;

  const rowDensity =
    obj.rowDensity === "comfortable" || obj.rowDensity === "compact"
      ? obj.rowDensity
      : DEFAULT_SCREENER_SETTINGS.rowDensity;

  const autoCollapseSidebar =
    typeof obj.autoCollapseSidebar === "boolean"
      ? obj.autoCollapseSidebar
      : DEFAULT_SCREENER_SETTINGS.autoCollapseSidebar;

  let defaultWatchlistId: number | null =
    DEFAULT_SCREENER_SETTINGS.defaultWatchlistId;
  if (obj.defaultWatchlistId === null) {
    defaultWatchlistId = null;
  } else if (
    typeof obj.defaultWatchlistId === "number" &&
    Number.isFinite(obj.defaultWatchlistId)
  ) {
    defaultWatchlistId = Math.trunc(obj.defaultWatchlistId);
  }

  const detailDrawerWidth =
    typeof obj.detailDrawerWidth === "number"
      ? clampDetailDrawerWidth(obj.detailDrawerWidth)
      : DEFAULT_SCREENER_SETTINGS.detailDrawerWidth;

  const sectionCollapsed = parseSectionCollapsed(obj.sectionCollapsed);

  return {
    defaultColumnTab,
    defaultScreen: parseDefaultScreen(obj.defaultScreen),
    pageSize,
    rowDensity,
    autoCollapseSidebar,
    defaultWatchlistId,
    detailDrawerWidth,
    sectionCollapsed,
  };
}

function parseSectionCollapsed(raw: unknown): SectionCollapsedState {
  const base = { ...DEFAULT_SECTION_COLLAPSED };
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(base) as CollapsibleSectionId[]) {
    if (typeof obj[key] === "boolean") {
      base[key] = obj[key];
    }
  }
  return base;
}

export function loadScreenerSettings(): ScreenerSettings {
  if (typeof window === "undefined" || !window.localStorage) {
    return { ...DEFAULT_SCREENER_SETTINGS };
  }
  try {
    const raw = window.localStorage.getItem(SCREENER_SETTINGS_KEY);
    if (raw == null || raw === "") {
      return { ...DEFAULT_SCREENER_SETTINGS };
    }
    return parseScreenerSettings(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_SCREENER_SETTINGS };
  }
}

export function saveScreenerSettings(settings: ScreenerSettings): void {
  const next = parseScreenerSettings(settings);
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(SCREENER_SETTINGS_KEY, JSON.stringify(next));
    }
  } catch {
    // Quota / private mode — still notify in-memory subscribers.
  }
  emit(next);
}

export function updateScreenerSettings(
  patch: Partial<ScreenerSettings>,
): ScreenerSettings {
  const next = parseScreenerSettings({ ...loadScreenerSettings(), ...patch });
  saveScreenerSettings(next);
  return next;
}

export function resetScreenerSettings(): ScreenerSettings {
  const next = { ...DEFAULT_SCREENER_SETTINGS };
  saveScreenerSettings(next);
  return next;
}
