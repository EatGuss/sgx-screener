import { useEffect, useState } from "react";
import {
  loadScreenerSettings,
  resetScreenerSettings,
  subscribeScreenerSettings,
  updateScreenerSettings,
  type ScreenerSettings,
} from "@/lib/screener/settings";

export function useScreenerSettings(): {
  settings: ScreenerSettings;
  update: (patch: Partial<ScreenerSettings>) => void;
  reset: () => void;
} {
  const [settings, setSettings] = useState<ScreenerSettings>(() =>
    loadScreenerSettings(),
  );

  useEffect(() => {
    return subscribeScreenerSettings(setSettings);
  }, []);

  return {
    settings,
    update: (patch) => {
      setSettings(updateScreenerSettings(patch));
    },
    reset: () => {
      setSettings(resetScreenerSettings());
    },
  };
}
