import { useCallback, useEffect, useState } from 'react';
import { getOrCreateSettings, updateSettings } from '@/db/indexedDb';
import type { AppSettings } from '@/types';

type Theme = AppSettings['theme'];

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  if (theme !== 'system') root.classList.add(theme);
}

/** Reads/writes the persisted theme preference and keeps <html> class in sync. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('system');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const settings = await getOrCreateSettings();
      if (cancelled) return;
      setThemeState(settings.theme);
      applyTheme(settings.theme);
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
