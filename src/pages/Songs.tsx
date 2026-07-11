import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, LayoutGrid, List, Music2, Play } from 'lucide-react';
import { useTracks } from '@/hooks/useIndexedDb';
import { usePlayer } from '@/hooks/usePlayer';
import { useToast } from '@/hooks/useToast';
import { SearchBar } from '@/components/SearchBar';
import { SongList } from '@/components/SongList';
import { AlbumGrid, type AlbumGroup } from '@/components/AlbumGrid';
import { Artwork } from '@/components/Artwork';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { deleteTrackCascade } from '@/db/indexedDb';
import type { SortDir, SortKey, Track } from '@/types';

type ViewMode = 'songs' | 'albums';

export default function SongsPage() {
  const tracks = useTracks();
  const { playNow, enqueue, playNext, currentTrack, isPlaying, removeTracksFromQueue } = usePlayer();
  const { showToast } = useToast();

  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<Track[] | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('songs');
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumGroup | null>(null);

  const filtered = useMemo(() => {
    if (!tracks) return [];
    const q = query.trim().toLowerCase();
    let result = tracks.filter((t) => {
      if (!q) return true;
      // In Albums view, a title match would surface a whole album just
      // because one song on it happens to match — only match on what's
      // actually shown there (artist/album).
      return (
        (viewMode === 'songs' && t.title.toLowerCase().includes(q)) ||
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
  }, [tracks, query, sortKey, sortDir, viewMode]);

  const albums = useMemo(() => {
    const groups = new Map<string, AlbumGroup>();
    for (const t of filtered) {
      const key = `${t.artist}::${t.album}`;
      let group = groups.get(key);
      if (!group) {
        group = { key, album: t.album, artist: t.artist, trackCount: 0, totalDuration: 0 };
        groups.set(key, group);
      }
      group.trackCount += 1;
      group.totalDuration += t.duration;
      if (!group.artworkBlobId && t.artworkBlobId) group.artworkBlobId = t.artworkBlobId;
    }
    return Array.from(groups.values()).sort((a, b) => a.album.localeCompare(b.album));
  }, [filtered]);

  const albumTracks = useMemo(() => {
    if (!selectedAlbum) return [];
    return filtered
      .filter((t) => t.album === selectedAlbum.album && t.artist === selectedAlbum.artist)
      .sort((a, b) => {
        const aNo = a.trackNo ?? Infinity;
        const bNo = b.trackNo ?? Infinity;
        return aNo !== bNo ? aNo - bNo : a.title.localeCompare(b.title);
      });
  }, [filtered, selectedAlbum]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const changeView = (mode: ViewMode) => {
    setViewMode(mode);
    setSelectedAlbum(null);
    setSelectedIds(new Set());
  };

  const openAlbum = (group: AlbumGroup) => {
    setSelectedAlbum(group);
    setSelectedIds(new Set());
  };

  const handleEnqueue = (ids: string[]) => {
    const added = enqueue(ids);
    if (added === 0) {
      showToast('Already in queue');
    } else if (added < ids.length) {
      showToast(`Added ${added} to queue (${ids.length - added} already queued)`, 'success');
    } else {
      showToast(`Added ${added} to queue`, 'success');
    }
  };

  const handlePlayNext = (ids: string[]) => {
    const placed = playNext(ids);
    if (placed === 0) {
      showToast('Already playing');
    } else {
      showToast(`Playing next: ${placed} song${placed === 1 ? '' : 's'}`, 'success');
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete || pendingDelete.length === 0) return;
    for (const track of pendingDelete) {
      await deleteTrackCascade(track.id);
    }
    removeTracksFromQueue(pendingDelete.map((t) => t.id));
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
      {selectedAlbum ? (
        <>
          <button
            onClick={() => setSelectedAlbum(null)}
            className="mb-4 flex items-center gap-1 text-sm text-text-muted hover:text-text"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Albums
          </button>
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <Artwork
              album={selectedAlbum.album}
              artist={selectedAlbum.artist}
              artworkBlobId={selectedAlbum.artworkBlobId}
              rounded="lg"
              className="h-20 w-20 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-semibold">{selectedAlbum.album}</h1>
              <p className="truncate text-text-muted">
                {selectedAlbum.artist} · {albumTracks.length}{' '}
                {albumTracks.length === 1 ? 'song' : 'songs'}
              </p>
            </div>
            {albumTracks.length > 0 && (
              <button
                onClick={() => playNow(albumTracks.map((t) => t.id))}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-4 py-2 text-sm font-medium text-bg hover:bg-accent-hover"
              >
                <Play className="h-4 w-4" aria-hidden="true" /> Play
              </button>
            )}
          </div>

          <SongList
            tracks={albumTracks}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onPlay={(index) => {
              const track = albumTracks[index];
              if (track) playNow([track.id]);
            }}
            onEnqueue={handleEnqueue}
            onPlayNext={handlePlayNext}
            currentTrackId={currentTrack?.id}
            isPlaying={isPlaying}
            onRemoveSelected={setPendingDelete}
            sortKey="album"
            emptyMessage="No songs match your search."
          />
        </>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">Library</h1>
            <div className="flex items-center gap-2">
              <SearchBar
                value={query}
                onChange={setQuery}
                label="Search library"
                placeholder={viewMode === 'albums' ? 'Search artist, album…' : 'Search title, artist, album…'}
              />
              <div className="flex items-center rounded-full border border-border bg-surface p-0.5 text-sm">
                <button
                  onClick={() => changeView('songs')}
                  aria-pressed={viewMode === 'songs'}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium transition-colors ${
                    viewMode === 'songs'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-text-muted hover:text-text'
                  }`}
                >
                  <List className="h-4 w-4" aria-hidden="true" /> Songs
                </button>
                <button
                  onClick={() => changeView('albums')}
                  aria-pressed={viewMode === 'albums'}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium transition-colors ${
                    viewMode === 'albums'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-text-muted hover:text-text'
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden="true" /> Albums
                </button>
              </div>
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

          {viewMode === 'albums' ? (
            <AlbumGrid albums={albums} onSelect={openAlbum} emptyMessage="No albums match your search." />
          ) : (
            <SongList
              tracks={filtered}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onPlay={(index) => {
                const track = filtered[index];
                if (track) playNow([track.id]);
              }}
              onEnqueue={handleEnqueue}
              onPlayNext={handlePlayNext}
              currentTrackId={currentTrack?.id}
              isPlaying={isPlaying}
              onRemoveSelected={setPendingDelete}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              emptyMessage="No songs match your search."
            />
          )}
        </>
      )}

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
