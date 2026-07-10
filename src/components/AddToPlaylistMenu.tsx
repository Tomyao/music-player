import { useEffect, useRef, useState } from 'react';
import { ListPlus, Plus } from 'lucide-react';
import { db } from '@/db/indexedDb';
import { usePlaylists } from '@/hooks/useIndexedDb';
import { useToast } from '@/hooks/useToast';

interface AddToPlaylistMenuProps {
  trackIds: string[];
  align?: 'left' | 'right';
  triggerClassName?: string;
}

/** Popover for adding one or more tracks to an existing or brand-new playlist. */
export function AddToPlaylistMenu({ trackIds, align = 'right', triggerClassName = '' }: AddToPlaylistMenuProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const playlists = usePlaylists();
  const { showToast } = useToast();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const addToPlaylist = async (playlistId: string, name: string) => {
    const playlist = await db.playlists.get(playlistId);
    if (!playlist) return;
    const toAdd = trackIds.filter((id) => !playlist.trackIds.includes(id));
    await db.playlists.update(playlistId, {
      trackIds: [...playlist.trackIds, ...toAdd],
      updatedAt: Date.now(),
    });
    showToast(
      toAdd.length
        ? `Added ${toAdd.length} track${toAdd.length === 1 ? '' : 's'} to "${name}"`
        : `Already in "${name}"`,
      'success',
    );
    setOpen(false);
  };

  const createAndAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    const now = Date.now();
    const id = crypto.randomUUID();
    await db.playlists.add({ id, name, trackIds: [...trackIds], createdAt: now, updatedAt: now });
    showToast(`Created "${name}" with ${trackIds.length} track${trackIds.length === 1 ? '' : 's'}`, 'success');
    setNewName('');
    setCreating(false);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Add to playlist"
        title="Add to playlist"
        className={`rounded-full p-2 text-text-muted hover:bg-surface-hover hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${triggerClassName}`}
      >
        <ListPlus className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute z-40 mt-1 w-64 animate-fade-in rounded-xl border border-border bg-surface p-2 shadow-xl ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Add to playlist
          </p>
          <div className="max-h-48 overflow-y-auto">
            {playlists?.length ? (
              playlists.map((p) => (
                <button
                  key={p.id}
                  role="menuitem"
                  onClick={() => addToPlaylist(p.id, p.name)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <span className="truncate">{p.name}</span>
                  <span className="text-xs text-text-muted">{p.trackIds.length}</span>
                </button>
              ))
            ) : (
              <p className="px-2 py-2 text-sm text-text-muted">No playlists yet</p>
            )}
          </div>

          <div className="mt-1 border-t border-border pt-1">
            {creating ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createAndAdd();
                }}
                className="flex items-center gap-1 px-1 py-1"
              >
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Playlist name"
                  aria-label="New playlist name"
                  className="w-full rounded-lg border border-border bg-bg px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-accent px-2 py-1 text-sm font-medium text-bg hover:bg-accent-hover"
                >
                  Add
                </button>
              </form>
            ) : (
              <button
                role="menuitem"
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-accent hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                New playlist
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
