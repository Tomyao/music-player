import { useState } from 'react';
import { ListMusic, Plus } from 'lucide-react';
import { usePlaylists } from '@/hooks/useIndexedDb';
import { useToast } from '@/hooks/useToast';
import { db } from '@/db/indexedDb';
import { PlaylistCard } from '@/components/PlaylistCard';
import { BackupMenu } from '@/components/BackupMenu';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { Playlist } from '@/types';

export default function PlaylistsPage() {
  const playlists = usePlaylists();
  const { showToast } = useToast();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<Playlist | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Playlist | null>(null);

  const createPlaylist = async () => {
    const name = newName.trim();
    if (!name) return;
    const now = Date.now();
    await db.playlists.add({ id: crypto.randomUUID(), name, trackIds: [], createdAt: now, updatedAt: now });
    setNewName('');
    setCreating(false);
    showToast(`Created "${name}"`, 'success');
  };

  const submitRename = async () => {
    if (!renaming) return;
    const name = renameValue.trim();
    if (!name) return;
    await db.playlists.update(renaming.id, { name, updatedAt: Date.now() });
    setRenaming(null);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await db.playlists.delete(pendingDelete.id);
    showToast(`Deleted "${pendingDelete.name}"`, 'success');
    setPendingDelete(null);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-32">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Playlists</h1>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <BackupMenu />
          <button
            onClick={() => setCreating(true)}
            className="flex items-center justify-center gap-1.5 rounded-full bg-accent px-3 py-2 text-sm font-medium text-bg hover:bg-accent-hover sm:w-auto"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> New playlist
          </button>
        </div>
      </div>

      {creating && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createPlaylist();
          }}
          className="mb-6 flex items-center gap-2 rounded-xl border border-border bg-surface p-3"
        >
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Playlist name"
            aria-label="New playlist name"
            className="flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          />
          <button
            type="submit"
            className="rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-bg hover:bg-accent-hover"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setNewName('');
            }}
            className="rounded-full px-3 py-1.5 text-sm text-text-muted hover:bg-surface-hover"
          >
            Cancel
          </button>
        </form>
      )}

      {playlists && playlists.length === 0 && !creating ? (
        <div className="flex flex-col items-center gap-3 px-4 py-24 text-center">
          <ListMusic className="h-10 w-10 text-text-muted" aria-hidden="true" />
          <h2 className="text-xl font-semibold">No playlists yet</h2>
          <p className="text-text-muted">Create one to start organizing your songs.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {playlists?.map((playlist) => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              onRename={(p) => {
                setRenaming(p);
                setRenameValue(p.name);
              }}
              onDelete={setPendingDelete}
            />
          ))}
        </div>
      )}

      {renaming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitRename();
            }}
            className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-2xl"
          >
            <h2 className="text-lg font-semibold">Rename playlist</h2>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              aria-label="Playlist name"
              className="mt-3 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenaming(null)}
                className="rounded-full px-4 py-1.5 text-sm font-medium hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-bg hover:bg-accent-hover"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete playlist?"
          description={`"${pendingDelete.name}" will be deleted. Your songs stay in your library.`}
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
