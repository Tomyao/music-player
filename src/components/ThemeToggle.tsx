import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

const icons = { light: Sun, dark: Moon };

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = icons[theme];

  return (
    <button
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      aria-label={`Theme: ${theme}. Click to change.`}
      title={`Theme: ${theme}`}
      className="rounded-full p-2 text-text-muted hover:bg-surface-hover hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
