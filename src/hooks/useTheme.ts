import { useCallback, useEffect, useState } from 'react';
import { getOrCreateSettings, updateSettings } from '@/db/indexedDb';
import type { AppSettings } from '@/types';

type Theme = AppSettings['theme'];

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
}

/** Reads/writes the persisted theme preference and keeps <html> class in sync. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const settings = await getOrCreateSettings();
      if (cancelled) return;
      // Older versions supported a 'system' option; fall back to light for anyone with it stored.
      const theme: Theme = settings.theme === 'dark' ? 'dark' : 'light';
      setThemeState(theme);
      applyTheme(theme);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    void updateSettings({ theme: next });
  }, []);

  return { theme, setTheme };
}
