import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Music2, Play } from 'lucide-react';
import { useTracks } from '@/hooks/useIndexedDb';
import { usePlayer } from '@/hooks/usePlayer';
import { useToast } from '@/hooks/useToast';
import { SearchBar } from '@/components/SearchBar';
import { SongList } from '@/components/SongList';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { deleteTrackCascade } from '@/db/indexedDb';
import type { SortDir, SortKey, Track } from '@/types';

export default function SongsPage() {
  const tracks = useTracks();
  const { playNow, enqueue, playNext, currentTrack, isPlaying, removeTrackFromQueue } = usePlayer();
  const { showToast } = useToast();

  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<Track[] | null>(null);

  const filtered = useMemo(() => {
    if (!tracks) return [];
    const q = query.trim().toLowerCase();
    let result = tracks.filter((t) => {
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q)
      );
    });

    result = [...result].sort((a, b) => {
      if (sortKey === 'album') {
        const albumCmp = a.album.localeCompare(b.album);
        if (albumCmp !== 0) return sortDir === 'asc' ? albumCmp : -albumCmp;
        // Same album: always list tracks in their natural album order
        // (by track number), regardless of which way the albums themselves
        // are sorted — reversing a tracklist within an album isn't useful.
        const aNo = a.trackNo ?? Infinity;
        const bNo = b.trackNo ?? Infinity;
        return aNo !== bNo ? aNo - bNo : a.title.localeCompare(b.title);
      }

      let cmp = 0;
      if (sortKey === 'duration' || sortKey === 'createdAt') cmp = a[sortKey] - b[sortKey];
      else cmp = a[sortKey].localeCompare(b[sortKey]);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [tracks, query, sortKey, sortDir]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete || pendingDelete.length === 0) return;
    for (const track of pendingDelete) {
      await deleteTrackCascade(track.id);
      removeTrackFromQueue(track.id);
    }
    showToast(
      pendingDelete.length === 1
        ? `Removed "${pendingDelete[0].title}"`
        : `Removed ${pendingDelete.length} songs`,
      'success',
    );
    setSelectedIds(new Set());
    setPendingDelete(null);
  };

  if (tracks && tracks.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-4 py-24 text-center">
        <Music2 className="h-10 w-10 text-text-muted" aria-hidden="true" />
        <h1 className="text-xl font-semibold">Your library is empty</h1>
        <p className="text-text-muted">Upload some music to get started.</p>
        <Link
          to="/upload"
          className="mt-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-bg hover:bg-accent-hover"
        >
          Upload music
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-32">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">All Songs</h1>
        <div className="flex items-center gap-2">
          <SearchBar value={query} onChange={setQuery} label="Search songs" placeholder="Search title, artist, album…" />
          {filtered.length > 0 && (
            <button
              onClick={() => playNow(filtered.map((t) => t.id))}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-3 py-2 text-sm font-medium text-bg hover:bg-accent-hover"
            >
              <Play className="h-4 w-4" aria-hidden="true" /> Play all
            </button>
          )}
        </div>
      </div>

      <SongList
        tracks={filtered}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onPlay={(index) => {
          const track = filtered[index];
          if (track) playNow([track.id]);
        }}
        onEnqueue={(ids) => {
          const added = enqueue(ids);
          if (added === 0) {
            showToast(ids.length === 1 ? 'Already in queue' : 'Already all in queue');
          } else if (added < ids.length) {
            showToast(`Added ${added} to queue (${ids.length - added} already queued)`, 'success');
          } else {
            showToast(`Added ${added} to queue`, 'success');
          }
        }}
        onPlayNext={(ids) => {
          const placed = playNext(ids);
          if (placed === 0) {
            showToast('Already playing');
          } else {
            showToast(`Playing next: ${placed} song${placed === 1 ? '' : 's'}`, 'success');
          }
        }}
        currentTrackId={currentTrack?.id}
        isPlaying={isPlaying}
        onRemoveSelected={setPendingDelete}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        emptyMessage="No songs match your search."
      />

      {pendingDelete && pendingDelete.length > 0 && (
        <ConfirmDialog
          title={pendingDelete.length === 1 ? 'Remove song?' : `Remove ${pendingDelete.length} songs?`}
          description={
            pendingDelete.length === 1
              ? `"${pendingDelete[0].title}" will be deleted from your library and any playlists. This can't be undone.`
              : `These ${pendingDelete.length} songs will be deleted from your library and any playlists. This can't be undone.`
          }
          confirmLabel="Remove"
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
