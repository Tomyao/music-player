import { NavLink } from 'react-router-dom';
import { ListMusic, Music2, Upload } from 'lucide-react';
import { BackupMenu } from '@/components/BackupMenu';
import { ThemeToggle } from '@/components/ThemeToggle';

const links = [
  { to: '/library', label: 'Library', icon: Music2 },
  { to: '/playlists', label: 'Playlists', icon: ListMusic },
  { to: '/upload', label: 'Upload', icon: Upload },
];

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <NavLink
          to="/library"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-emerald-400 to-sky-500 text-bg">
            <Music2 className="h-4 w-4" aria-hidden="true" />
          </span>
          Musique
        </NavLink>

        <nav aria-label="Main" className="flex gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  isActive
                    ? 'bg-surface text-text'
                    : 'text-text-muted hover:bg-surface hover:text-text'
                }`
              }
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <BackupMenu />
        </div>
      </div>
    </header>
  );
}
