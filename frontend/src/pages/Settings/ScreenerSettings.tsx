import { useEffect, useState } from "react";
import { Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useScreenerSettings } from "@/hooks/useScreenerSettings";
import { getScreenerApi } from "@/lib/screener/api";
import { COLUMN_PRESETS } from "@/lib/screener/column-presets";
import {
  PAGE_SIZE_OPTIONS,
  type DefaultScreenPreference,
  type ScreenerPageSize,
  type ScreenerRowDensity,
} from "@/lib/screener/settings";
import {
  EnabledSwitch,
  SettingsField,
  SettingsSection,
} from "./SettingsPrimitives";

type PresetOption = { id: string; name: string };
type SavedOption = { id: number; name: string };

function defaultScreenSelectValue(pref: DefaultScreenPreference): string {
  if (pref.type === "none") return "none";
  if (pref.type === "preset") return `preset:${pref.presetId}`;
  return `saved:${pref.screenId}`;
}

function parseDefaultScreenSelect(value: string): DefaultScreenPreference {
  if (value === "none") return { type: "none" };
  if (value.startsWith("preset:")) {
    return { type: "preset", presetId: value.slice("preset:".length) };
  }
  if (value.startsWith("saved:")) {
    const id = Number(value.slice("saved:".length));
    if (Number.isFinite(id)) return { type: "saved", screenId: id };
  }
  return { type: "none" };
}

export default function ScreenerSettings() {
  const { signedIn, loading: authLoading } = useAuth();
  const { settings, update, reset } = useScreenerSettings();
  const [presets, setPresets] = useState<PresetOption[]>([]);
  const [saved, setSaved] = useState<SavedOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingOptions(true);
      try {
        const presetsRes = await getScreenerApi().getPresets();
        if (cancelled) return;
        setPresets(
          presetsRes.presets.map((p) => ({ id: p.id, name: p.name })),
        );

        if (signedIn) {
          const screensRes = await getScreenerApi()
            .listScreens()
            .catch(() => ({ screens: [] }));
          if (cancelled) return;
          setSaved(
            screensRes.screens.map((s) => ({ id: s.id, name: s.name })),
          );
        } else {
          setSaved([]);
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    }

    if (!authLoading) void load();
    return () => {
      cancelled = true;
    };
  }, [signedIn, authLoading]);

  // If a saved/preset default disappears, fall back to none in the select display.
  const screenValue = (() => {
    const pref = settings.defaultScreen;
    if (pref.type === "preset") {
      const ok = presets.some((p) => p.id === pref.presetId);
      return ok ? defaultScreenSelectValue(pref) : "none";
    }
    if (pref.type === "saved") {
      const ok = saved.some((s) => s.id === pref.screenId);
      return ok ? defaultScreenSelectValue(pref) : "none";
    }
    return "none";
  })();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Filter className="w-6 h-6" />
          Screener
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Defaults for the stock screener on this device. Changes apply
          immediately. Per-user cloud sync is planned later.
        </p>
      </div>

      <SettingsSection
        title="Builder defaults"
        description="Used when you open the builder. A shared link always wins over these."
      >
        <SettingsField
          label="Default column tab"
          description="Which column set the builder opens with (Overview, Valuation, and so on)."
        >
          <Select
            value={settings.defaultColumnTab}
            onValueChange={(v) =>
              update({
                defaultColumnTab: v as typeof settings.defaultColumnTab,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLUMN_PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsField>

        <SettingsField
          label="Default screen"
          description="The screen loaded when you open the builder (a shared ?spec= link always takes priority)."
        >
          {loadingOptions ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <Select
              value={screenValue}
              onValueChange={(v) =>
                update({ defaultScreen: parseDefaultScreenSelect(v) })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (empty builder)</SelectItem>
                {presets.map((p) => (
                  <SelectItem key={p.id} value={`preset:${p.id}`}>
                    Preset: {p.name}
                  </SelectItem>
                ))}
                {signedIn &&
                  saved.map((s) => (
                    <SelectItem key={s.id} value={`saved:${s.id}`}>
                      Saved: {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
          {!signedIn && !authLoading && (
            <p className="text-xs text-muted-foreground">
              Log in to pick a saved screen as the default.
            </p>
          )}
        </SettingsField>
      </SettingsSection>

      <SettingsSection
        title="Results"
        description="How the results table looks and pages."
      >
        <SettingsField
          label="Rows per page"
          description="How many stocks load in each page of results."
        >
          <Select
            value={String(settings.pageSize)}
            onValueChange={(v) =>
              update({ pageSize: Number(v) as ScreenerPageSize })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsField>

        <SettingsField
          label="Row density"
          description="Comfortable is roomier; compact tightens the ticker and name columns."
        >
          <Select
            value={settings.rowDensity}
            onValueChange={(v) =>
              update({ rowDensity: v as ScreenerRowDensity })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="comfortable">Comfortable</SelectItem>
              <SelectItem value="compact">Compact</SelectItem>
            </SelectContent>
          </Select>
        </SettingsField>
      </SettingsSection>

      <SettingsSection
        title="Layout"
        description="Sidebar behavior on screener pages."
      >
        <EnabledSwitch
          checked={settings.autoCollapseSidebar}
          onCheckedChange={(v) => update({ autoCollapseSidebar: v })}
          label="Auto-collapse sidebar on screener pages"
          description="When on, opening the screener hides the app sidebar so results have more room."
        />

      </SettingsSection>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (
              window.confirm(
                "Reset all screener settings on this device to defaults?",
              )
            ) {
              reset();
            }
          }}
        >
          <RotateCcw className="w-4 h-4" />
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}
