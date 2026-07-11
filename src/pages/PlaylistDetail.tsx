import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, GripVertical, ListMusic, Loader2, Music2, Pause, Play, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { LOADING, usePlaylist, usePlaylistEntries, useTracks, type PlaylistEntry } from '@/hooks/useIndexedDb';
import { usePlayer } from '@/hooks/usePlayer';
import { useToast } from '@/hooks/useToast';
import { db, rescanPlaylist } from '@/db/indexedDb';
import { Artwork } from '@/components/Artwork';
import { SearchBar } from '@/components/SearchBar';
import { formatDuration } from '@/lib/audio';
import type { Track, TrackStub } from '@/types';

function TrackRow({
  track,
  isCurrent,
  isPlaying,
  onPlay,
  onRemove,
}: {
  track: Track;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: track.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group flex items-center gap-2 rounded-lg px-2 py-2 ${
        isDragging ? 'z-10 bg-surface-hover shadow-lg' : ''
      } ${isCurrent ? 'bg-accent/5' : 'hover:bg-surface-hover'}`}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${track.title}`}
        className="cursor-grab touch-none rounded p-1 text-text-muted active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      <button onClick={onPlay} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Artwork
          artworkBlobId={track.artworkBlobId}
          album={track.album}
          artist={track.artist}
          className="h-10 w-10 shrink-0"
          rounded="sm"
        />
        <span className="min-w-0">
          <span className={`block truncate text-sm font-medium ${isCurrent ? 'text-accent' : 'text-text'}`}>
            {track.title}
          </span>
          <span className="block truncate text-xs text-text-muted">{track.artist}</span>
        </span>
        {isCurrent && (isPlaying ? <Pause className="h-4 w-4 text-accent" aria-hidden="true" /> : <Play className="h-4 w-4 text-accent" aria-hidden="true" />)}
      </button>
      <span className="hidden text-sm text-text-muted sm:block">{formatDuration(track.duration)}</span>
      <button
        onClick={onRemove}
        aria-label={`Remove ${track.title} from playlist`}
        className="rounded-full p-2 text-text-muted opacity-0 hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  );
}

/** Row for a playlist entry whose track isn't in the local library (e.g. after importing a backup). */
function MissingTrackRow({
  id,
  stub,
  onRemove,
}: {
  id: string;
  stub: TrackStub;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group flex items-center gap-2 rounded-lg px-2 py-2 opacity-60 ${
        isDragging ? 'z-10 bg-surface-hover shadow-lg' : 'hover:bg-surface-hover'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${stub.title}`}
        className="cursor-grab touch-none rounded p-1 text-text-muted active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-hover text-text-muted">
          <Music2 className="h-4 w-4" aria-hidden="true" />
        </div>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-text">{stub.title}</span>
          <span className="block truncate text-xs text-text-muted">
            {stub.artist}
            {stub.album ? ` — ${stub.album}` : ''}
          </span>
        </span>
      </div>
      <span className="hidden shrink-0 text-xs italic text-text-muted sm:block">Not in library</span>
      <button
        onClick={onRemove}
        aria-label={`Remove ${stub.title} from playlist`}
        className="rounded-full p-2 text-text-muted opacity-0 hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  );
}

export default function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const playlist = usePlaylist(id);
  const resolvedPlaylist = playlist === LOADING ? undefined : playlist;
  const entries = usePlaylistEntries(resolvedPlaylist);
  const allTracks = useTracks();
  const { playNow, currentTrack, isPlaying } = usePlayer();
  const { showToast } = useToast();

  const [query, setQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [rescanning, setRescanning] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const filtered = useMemo(() => {
    if (!entries) return [];
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => {
      const { title, artist } = e.status === 'available' ? e.track : e.stub;
      return title.toLowerCase().includes(q) || artist.toLowerCase().includes(q);
    });
  }, [entries, query]);

  const playableIds = useMemo(
    () => (entries ?? []).filter((e): e is Extract<PlaylistEntry, { status: 'available' }> => e.status === 'available').map((e) => e.track.id),
    [entries],
  );

  const hasMissing = (entries ?? []).some((e) => e.status === 'missing');

  const availableToAdd = useMemo(() => {
    if (!allTracks || !resolvedPlaylist) return [];
    const existing = new Set(resolvedPlaylist.trackIds);
    const q = pickerQuery.trim().toLowerCase();
    return allTracks.filter((t) => {
      if (existing.has(t.id)) return false;
      if (!q) return true;
      return t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q);
    });
  }, [allTracks, resolvedPlaylist, pickerQuery]);

  if (playlist === LOADING || entries === undefined) {
    return <div className="px-4 py-8 text-center text-text-muted">Loading…</div>;
  }
  if (!playlist) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-xl font-semibold">Playlist not found</h1>
        <Link to="/playlists" className="mt-3 inline-block text-accent hover:underline">
          Back to playlists
        </Link>
      </div>
    );
  }

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !playlist) return;
    const ids = [...playlist.trackIds];
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    db.playlists.update(playlist.id, { trackIds: ids, updatedAt: Date.now() });
  };

  const removeTrack = (trackId: string) => {
    if (!playlist) return;
    const { [trackId]: _removed, ...trackMeta } = playlist.trackMeta ?? {};
    db.playlists.update(playlist.id, {
      trackIds: playlist.trackIds.filter((id_) => id_ !== trackId),
      trackMeta,
      updatedAt: Date.now(),
    });
  };

  const addTracks = (ids: string[]) => {
    if (!playlist) return;
    db.playlists.update(playlist.id, {
      trackIds: [...playlist.trackIds, ...ids],
      updatedAt: Date.now(),
    });
    showToast(`Added ${ids.length} song${ids.length === 1 ? '' : 's'}`, 'success');
  };

  const handleRescan = async () => {
    if (!playlist) return;
    setRescanning(true);
    try {
      const { relinked } = await rescanPlaylist(playlist.id);
      showToast(
        relinked > 0
          ? `Relinked ${relinked} song${relinked === 1 ? '' : 's'}`
          : 'No matching songs found in your library',
        relinked > 0 ? 'success' : 'default',
      );
    } finally {
      setRescanning(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-32">
      <button
        onClick={() => navigate('/playlists')}
        className="mb-4 flex items-center gap-1 text-sm text-text-muted hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Playlists
      </button>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-surface">
          <ListMusic className="h-8 w-8 text-text-muted" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold">{playlist.name}</h1>
          <p className="text-text-muted">
            {playlist.trackIds.length} {playlist.trackIds.length === 1 ? 'song' : 'songs'}
          </p>
        </div>
        {playableIds.length > 0 && (
          <button
            onClick={() => playNow(playableIds)}
            className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-bg hover:bg-accent-hover"
          >
            <Play className="h-4 w-4" aria-hidden="true" /> Play
          </button>
        )}
        <button
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-surface-hover"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Add songs
        </button>
        {hasMissing && (
          <button
            onClick={handleRescan}
            disabled={rescanning}
            title="Re-check missing songs against your library"
            className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-surface-hover disabled:opacity-50"
          >
            {rescanning ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
            Rescan
          </button>
        )}
      </div>

      {entries.length > 0 && (
        <div className="mb-3">
          <SearchBar value={query} onChange={setQuery} label="Search in playlist" placeholder="Search this playlist…" />
        </div>
      )}

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-24 text-center">
          <ListMusic className="h-10 w-10 text-text-muted" aria-hidden="true" />
          <p className="text-text-muted">No songs yet. Add some from your library.</p>
        </div>
      ) : query ? (
        <ul className="space-y-0.5">
          {filtered.map((entry) =>
            entry.status === 'available' ? (
              <TrackRow
                key={entry.id}
                track={entry.track}
                isCurrent={entry.track.id === currentTrack?.id}
                isPlaying={isPlaying}
                onPlay={() => playNow([entry.track.id])}
                onRemove={() => removeTrack(entry.id)}
              />
            ) : (
              <MissingTrackRow key={entry.id} id={entry.id} stub={entry.stub} onRemove={() => removeTrack(entry.id)} />
            ),
          )}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-text-muted">No matches in this playlist.</p>
          )}
        </ul>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-0.5">
              {entries.map((entry) =>
                entry.status === 'available' ? (
                  <TrackRow
                    key={entry.id}
                    track={entry.track}
                    isCurrent={entry.track.id === currentTrack?.id}
                    isPlaying={isPlaying}
                    onPlay={() => playNow([entry.track.id])}
                    onRemove={() => removeTrack(entry.id)}
                  />
                ) : (
                  <MissingTrackRow key={entry.id} id={entry.id} stub={entry.stub} onRemove={() => removeTrack(entry.id)} />
                ),
              )}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-surface p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add songs to {playlist.name}</h2>
              <button
                onClick={() => setPickerOpen(false)}
                aria-label="Close"
                className="rounded-full p-1.5 text-text-muted hover:bg-surface-hover hover:text-text"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <SearchBar value={pickerQuery} onChange={setPickerQuery} label="Search library" placeholder="Search your library…" />
            <ul className="mt-3 flex-1 overflow-y-auto">
              {availableToAdd.length === 0 && (
                <p className="py-8 text-center text-sm text-text-muted">No songs to add.</p>
              )}
              {availableToAdd.map((track) => (
                <li key={track.id}>
                  <button
                    onClick={() => addTracks([track.id])}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-hover"
                  >
                    <Artwork artworkBlobId={track.artworkBlobId} album={track.album} artist={track.artist} className="h-9 w-9 shrink-0" rounded="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{track.title}</span>
                      <span className="block truncate text-xs text-text-muted">{track.artist}</span>
                    </span>
                    <Plus className="h-4 w-4 text-accent" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
