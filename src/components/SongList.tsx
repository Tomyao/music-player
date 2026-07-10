import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ListEnd, ListPlus, Pause, Play, Trash2 } from 'lucide-react';
import { Artwork } from '@/components/Artwork';
import { AddToPlaylistMenu } from '@/components/AddToPlaylistMenu';
import { formatDuration } from '@/lib/audio';
import type { SortDir, SortKey, Track } from '@/types';

interface SongListProps {
  tracks: Track[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onPlay: (startIndex: number) => void;
  onEnqueue: (trackIds: string[]) => void;
  onPlayNext: (trackIds: string[]) => void;
  currentTrackId?: string;
  isPlaying?: boolean;
  onRemove?: (track: Track) => void;
  removeLabel?: string;
  sortKey?: SortKey;
  sortDir?: SortDir;
  onSort?: (key: SortKey) => void;
  emptyMessage?: string;
  /** Extra per-row control rendered before the overflow actions, e.g. a drag handle. */
  renderLeading?: (track: Track, index: number) => ReactNode;
}

const columns: Array<{ key: SortKey; label: string; className: string }> = [
  { key: 'title', label: 'Title', className: 'flex-1 min-w-0' },
  { key: 'album', label: 'Album', className: 'hidden w-48 md:block' },
  { key: 'duration', label: 'Time', className: 'w-16 text-right' },
];

export function SongList({
  tracks,
  selectedIds,
  onSelectionChange,
  onPlay,
  onEnqueue,
  onPlayNext,
  currentTrackId,
  isPlaying,
  onRemove,
  removeLabel = 'Remove',
  sortKey,
  sortDir,
  onSort,
  emptyMessage = 'No songs found.',
  renderLeading,
}: SongListProps) {
  const allSelected = tracks.length > 0 && tracks.every((t) => selectedIds.has(t.id));

  const toggleAll = () => {
    if (allSelected) onSelectionChange(new Set());
    else onSelectionChange(new Set(tracks.map((t) => t.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const selectedTrackIds = tracks.filter((t) => selectedIds.has(t.id)).map((t) => t.id);

  if (tracks.length === 0) {
    return <p className="py-12 text-center text-sm text-text-muted">{emptyMessage}</p>;
  }

  return (
    <div>
      {selectedIds.size > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3 py-2 text-sm">
          <span className="font-medium">{selectedIds.size} selected</span>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => onEnqueue(selectedTrackIds)}
              className="flex items-center gap-1 rounded-full px-2 py-1 hover:bg-surface-hover"
              title="Add to queue"
            >
              <ListPlus className="h-4 w-4" aria-hidden="true" /> Queue
            </button>
            <button
              onClick={() => onPlayNext(selectedTrackIds)}
              className="flex items-center gap-1 rounded-full px-2 py-1 hover:bg-surface-hover"
              title="Play next"
            >
              <ListEnd className="h-4 w-4" aria-hidden="true" /> Play next
            </button>
            <AddToPlaylistMenu trackIds={selectedTrackIds} />
            <button
              onClick={() => onSelectionChange(new Set())}
              className="rounded-full px-2 py-1 text-text-muted hover:bg-surface-hover"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div
        role="row"
        className="flex items-center gap-3 border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted"
      >
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          aria-label="Select all songs"
          className="h-4 w-4 accent-accent"
        />
        <span className="w-8 text-center">#</span>
        {columns.map((col) => (
          <button
            key={col.key}
            onClick={() => onSort?.(col.key)}
            className={`flex items-center gap-1 text-left hover:text-text ${col.className}`}
          >
            {col.label}
            {sortKey === col.key &&
              (sortDir === 'asc' ? (
                <ArrowUp className="h-3 w-3" aria-hidden="true" />
              ) : (
                <ArrowDown className="h-3 w-3" aria-hidden="true" />
              ))}
          </button>
        ))}
        <span className="w-20" aria-hidden="true" />
      </div>

      <ul role="list">
        {tracks.map((track, index) => {
          const isCurrent = track.id === currentTrackId;
          return (
            <li
              key={track.id}
              role="row"
              className={`group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface-hover ${
                isCurrent ? 'bg-accent/5' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(track.id)}
                onChange={() => toggleOne(track.id)}
                aria-label={`Select ${track.title}`}
                className="h-4 w-4 accent-accent"
              />

              {renderLeading?.(track, index)}

              <button
                onClick={() => onPlay(index)}
                className="flex w-8 items-center justify-center text-text-muted hover:text-text"
                aria-label={isCurrent && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
              >
                {isCurrent && isPlaying ? (
                  <Pause className="h-4 w-4 text-accent" aria-hidden="true" />
                ) : isCurrent ? (
                  <Play className="h-4 w-4 text-accent" aria-hidden="true" />
                ) : (
                  <span className="text-xs tabular-nums group-hover:hidden">{index + 1}</span>
                )}
                {!isCurrent && (
                  <Play className="hidden h-4 w-4 group-hover:block" aria-hidden="true" />
                )}
              </button>

              <button
                onClick={() => onPlay(index)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <Artwork
                  artworkBlobId={track.artworkBlobId}
                  title={track.title}
                  artist={track.artist}
                  className="h-10 w-10 shrink-0"
                  rounded="sm"
                />
                <span className="min-w-0">
                  <span
                    className={`block truncate text-sm font-medium ${isCurrent ? 'text-accent' : 'text-text'}`}
                  >
                    {track.title}
                  </span>
                  <span className="block truncate text-xs text-text-muted">{track.artist}</span>
                </span>
              </button>

              <span className="hidden w-48 truncate text-sm text-text-muted md:block">
                {track.album}
              </span>
              <span className="w-16 text-right text-sm tabular-nums text-text-muted">
                {formatDuration(track.duration)}
              </span>

              <span className="flex w-20 items-center justify-end gap-0.5 opacity-0 focus-within:opacity-100 group-hover:opacity-100">
                <button
                  onClick={() => onEnqueue([track.id])}
                  aria-label={`Add ${track.title} to queue`}
                  title="Add to queue"
                  className="rounded-full p-2 text-text-muted hover:bg-surface-hover hover:text-text"
                >
                  <ListPlus className="h-4 w-4" aria-hidden="true" />
                </button>
                <AddToPlaylistMenu trackIds={[track.id]} />
                {onRemove && (
                  <button
                    onClick={() => onRemove(track)}
                    aria-label={`${removeLabel} ${track.title}`}
                    title={removeLabel}
                    className="rounded-full p-2 text-text-muted hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
