import { afterEach, describe, expect, test } from "vitest";
import {
  DEFAULT_SCREENER_SETTINGS,
  SCREENER_SETTINGS_KEY,
  loadScreenerSettings,
  parseScreenerSettings,
  resetScreenerSettings,
  saveScreenerSettings,
} from "@/lib/screener/settings";

afterEach(() => {
  window.localStorage.removeItem(SCREENER_SETTINGS_KEY);
});

describe("parseScreenerSettings", () => {
  test("returns defaults for null / non-objects", () => {
    expect(parseScreenerSettings(null)).toEqual(DEFAULT_SCREENER_SETTINGS);
    expect(parseScreenerSettings("bad")).toEqual(DEFAULT_SCREENER_SETTINGS);
  });

  test("corrupt fields fall back individually", () => {
    const parsed = parseScreenerSettings({
      defaultColumnTab: "not-a-tab",
      pageSize: 999,
      rowDensity: "huge",
      autoCollapseSidebar: "yes",
      defaultWatchlistId: "x",
      defaultScreen: { type: "preset" },
    });
    expect(parsed.defaultColumnTab).toBe("overview");
    expect(parsed.pageSize).toBe(50);
    expect(parsed.rowDensity).toBe("comfortable");
    expect(parsed.autoCollapseSidebar).toBe(true);
    expect(parsed.defaultWatchlistId).toBeNull();
    expect(parsed.defaultScreen).toEqual({ type: "none" });
  });

  test("accepts valid values", () => {
    const parsed = parseScreenerSettings({
      defaultColumnTab: "dividends",
      pageSize: 25,
      rowDensity: "compact",
      autoCollapseSidebar: false,
      defaultWatchlistId: 3,
      defaultScreen: { type: "saved", screenId: 12 },
      detailDrawerWidth: 600,
      sectionCollapsed: { homePresets: true },
    });
    expect(parsed.defaultColumnTab).toBe("dividends");
    expect(parsed.pageSize).toBe(25);
    expect(parsed.rowDensity).toBe("compact");
    expect(parsed.autoCollapseSidebar).toBe(false);
    expect(parsed.defaultWatchlistId).toBe(3);
    expect(parsed.defaultScreen).toEqual({ type: "saved", screenId: 12 });
    expect(parsed.detailDrawerWidth).toBe(600);
    expect(parsed.sectionCollapsed.homePresets).toBe(true);
    expect(parsed.sectionCollapsed.homeSaved).toBe(false);
  });

  test("clamps detail drawer width and ignores bad section flags", () => {
    const parsed = parseScreenerSettings({
      detailDrawerWidth: 9999,
      sectionCollapsed: { homePresets: "yes", openSaved: true },
    });
    expect(parsed.detailDrawerWidth).toBe(720);
    expect(parsed.sectionCollapsed.openSaved).toBe(true);
    expect(parsed.sectionCollapsed.homePresets).toBe(false);
  });
});

describe("loadScreenerSettings", () => {
  test("corrupt localStorage JSON falls back to defaults without throwing", () => {
    window.localStorage.setItem(SCREENER_SETTINGS_KEY, "{not-json");
    expect(loadScreenerSettings()).toEqual(DEFAULT_SCREENER_SETTINGS);
  });

  test("round-trips through save", () => {
    saveScreenerSettings({
      ...DEFAULT_SCREENER_SETTINGS,
      pageSize: 100,
      defaultColumnTab: "growth",
    });
    expect(loadScreenerSettings().pageSize).toBe(100);
    expect(loadScreenerSettings().defaultColumnTab).toBe("growth");
  });

  test("reset restores defaults", () => {
    saveScreenerSettings({
      ...DEFAULT_SCREENER_SETTINGS,
      autoCollapseSidebar: false,
    });
    expect(resetScreenerSettings()).toEqual(DEFAULT_SCREENER_SETTINGS);
    expect(loadScreenerSettings()).toEqual(DEFAULT_SCREENER_SETTINGS);
  });
});
