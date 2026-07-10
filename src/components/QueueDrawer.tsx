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
import { useEffect } from 'react';
import { GripVertical, ListX, Music, X } from 'lucide-react';
import { usePlayer } from '@/hooks/usePlayer';
import { useTracksByIds } from '@/hooks/useIndexedDb';
import { Artwork } from '@/components/Artwork';
import { formatDuration } from '@/lib/audio';
import type { Track } from '@/types';

interface QueueRowProps {
  track: Track;
  index: number;
  isCurrent: boolean;
  onRemove: () => void;
}

function QueueRow({ track, index, isCurrent, onRemove }: QueueRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: track.id + '::' + index,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
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
      <Artwork
        artworkBlobId={track.artworkBlobId}
        album={track.album}
        artist={track.artist}
        className="h-9 w-9 shrink-0"
        rounded="sm"
      />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${isCurrent ? 'font-medium text-accent' : 'text-text'}`}>
          {track.title}
        </span>
        <span className="block truncate text-xs text-text-muted">{track.artist}</span>
      </span>
      <span className="text-xs tabular-nums text-text-muted">{formatDuration(track.duration)}</span>
      <button
        onClick={onRemove}
        aria-label={`Remove ${track.title} from queue`}
        className="rounded-full p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </li>
  );
}

/** Collapsible panel showing the play queue with drag-and-drop reordering. */
export function QueueDrawer() {
  const {
    queue,
    currentIndex,
    queueDrawerOpen,
    reorderQueue,
    removeFromQueue,
    clearQueue,
    toggleQueueDrawer,
  } = usePlayer();

  const tracks = useTracksByIds(queue);
  const trackById = new Map((tracks ?? []).map((t) => [t.id, t]));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!queueDrawerOpen) return;
    const onEscape = (e: KeyboardEvent) => e.key === 'Escape' && toggleQueueDrawer();
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [queueDrawerOpen, toggleQueueDrawer]);

  if (!queueDrawerOpen) return null;

  const items = queue.map((id, i) => id + '::' + i);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.indexOf(String(active.id));
    const to = items.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    reorderQueue(from, to);
  };

  const upcoming = queue.length - currentIndex - 1;

  return (
    <aside
      id="queue-drawer"
      aria-label="Playback queue"
      className="fixed bottom-[76px] right-0 top-14 z-30 flex w-full max-w-sm animate-slide-up flex-col border-l border-border bg-surface shadow-2xl sm:bottom-20"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-semibold">Queue</h2>
        <div className="flex items-center gap-1">
          {queue.length > 0 && (
            <button
              onClick={clearQueue}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-text-muted hover:bg-surface-hover hover:text-text"
            >
              <ListX className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </button>
          )}
          <button
            onClick={toggleQueueDrawer}
            aria-label="Close queue"
            className="rounded-full p-1.5 text-text-muted hover:bg-surface-hover hover:text-text"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {queue.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-text-muted">
            <Music className="h-8 w-8" aria-hidden="true" />
            <p className="text-sm">Your queue is empty. Add songs from your library.</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items} strategy={verticalListSortingStrategy}>
              <ul className="space-y-0.5">
                {queue.map((id, index) => {
                  const track = trackById.get(id);
                  if (!track) return null;
                  return (
                    <QueueRow
                      key={id + '::' + index}
                      track={track}
                      index={index}
                      isCurrent={index === currentIndex}
                      onRemove={() => removeFromQueue(index)}
                    />
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {upcoming > 0 && (
        <div className="border-t border-border px-4 py-2 text-center text-xs text-text-muted">
          {upcoming} track{upcoming === 1 ? '' : 's'} up next
        </div>
      )}
    </aside>
  );
}
