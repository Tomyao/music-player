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
  const [genre, setGenre] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<Track[] | null>(null);

  const genres = useMemo(() => {
    const set = new Set((tracks ?? []).map((t) => t.genre).filter(Boolean) as string[]);
    return ['all', ...Array.from(set).sort()];
  }, [tracks]);

  const filtered = useMemo(() => {
    if (!tracks) return [];
    const q = query.trim().toLowerCase();
    let result = tracks.filter((t) => {
      const matchesQuery =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q);
      const matchesGenre = genre === 'all' || t.genre === genre;
      return matchesQuery && matchesGenre;
    });

    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'duration' || sortKey === 'createdAt') cmp = a[sortKey] - b[sortKey];
      else cmp = a[sortKey].localeCompare(b[sortKey]);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [tracks, query, genre, sortKey, sortDir]);

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
        <p className="text-text-muted">Upload some MP3s to get started.</p>
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
          {genres.length > 1 && (
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              aria-label="Filter by genre"
              className="rounded-full border border-border bg-surface px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {genres.map((g) => (
                <option key={g} value={g}>
                  {g === 'all' ? 'All genres' : g}
                </option>
              ))}
            </select>
          )}
          {filtered.length > 0 && (
            <button
              onClick={() => playNow(filtered.map((t) => t.id))}
              className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-2 text-sm font-medium text-bg hover:bg-accent-hover"
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
          enqueue(ids);
          showToast(`Added ${ids.length} to queue`, 'success');
        }}
        onPlayNext={(ids) => {
          playNext(ids);
          showToast(`Playing next: ${ids.length} song${ids.length === 1 ? '' : 's'}`, 'success');
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
