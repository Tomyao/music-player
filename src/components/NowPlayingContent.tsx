import { ChevronRight, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { usePlayer } from '@/hooks/usePlayer';
import { useTracksByIds } from '@/hooks/useIndexedDb';
import { Artwork } from '@/components/Artwork';
import { formatDuration, seekFillPosition } from '@/lib/audio';
import type { Track } from '@/types';

const UP_NEXT_PREVIEW_COUNT = 1;

/**
 * The "poster" view of the current track: artwork, title/artist/album, and
 * (mobile only) the seek bar and play/prev/next transport — moved off the
 * persistent player bar, which stays compact there and keeps only
 * shuffle/repeat. Desktop keeps those in the player bar and doesn't repeat
 * them here. Rendered inside `NowPlayingOverlay`.
 */
export function NowPlayingContent({ track }: { track: Track }) {
  const {
    queue,
    currentIndex,
    currentTime,
    duration,
    isPlaying,
    isLoading,
    seek,
    togglePlay,
    next,
    prev,
    toggleQueueDrawer,
  } = usePlayer();

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const upNextIds = queue.slice(currentIndex + 1, currentIndex + 1 + UP_NEXT_PREVIEW_COUNT);
  const upNextTracks = useTracksByIds(upNextIds);

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-2xl flex-col items-center justify-start gap-4 overflow-hidden px-4 py-3">
      <Artwork
        artworkBlobId={track.artworkBlobId}
        album={track.album}
        artist={track.artist}
        rounded="lg"
        className="aspect-square h-[min(36vh,14rem)] w-[min(36vh,14rem)] shrink-0 shadow-2xl"
      />

      <div className="shrink-0 text-center">
        <h1 className="text-2xl font-semibold">{track.title}</h1>
        <p className="mt-1 text-text-muted">{track.artist}</p>
        <p className="text-sm text-text-muted">{track.album}</p>
      </div>

      <div className="w-full max-w-sm shrink-0 sm:hidden">
        <div className="flex items-center gap-2">
          <span className="w-9 text-right text-xs tabular-nums text-text-muted">
            {formatDuration(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step="any"
            value={currentTime}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Seek"
            style={{
              background: `linear-gradient(to right, rgb(var(--color-accent)) ${seekFillPosition(progressPct)}, rgb(var(--color-border)) ${seekFillPosition(progressPct)})`,
            }}
            className="h-1 flex-1 appearance-none rounded-full accent-accent"
          />
          <span className="w-9 text-xs tabular-nums text-text-muted">{formatDuration(duration)}</span>
        </div>

        <div className="mt-6 flex items-center justify-center gap-6">
          <button
            onClick={prev}
            aria-label="Previous track"
            className="rounded-full p-2 text-text hover:bg-surface-hover"
          >
            <SkipBack className="h-6 w-6" aria-hidden="true" />
          </button>
          <button
            onClick={togglePlay}
            disabled={isLoading}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-text text-bg hover:scale-105 disabled:pointer-events-none disabled:opacity-40"
          >
            {isPlaying ? (
              <Pause className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Play className="h-6 w-6 translate-x-0.5" aria-hidden="true" />
            )}
          </button>
          <button
            onClick={next}
            aria-label="Next track"
            className="rounded-full p-2 text-text hover:bg-surface-hover"
          >
            <SkipForward className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
      </div>

      {upNextTracks && upNextTracks.length > 0 && (
        <div className="w-full max-w-sm shrink-0">
          <button
            onClick={toggleQueueDrawer}
            className="mb-1.5 flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-text-muted hover:text-text"
          >
            Up next
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <ul>
            {upNextTracks.map((t) => (
              <li key={t.id} className="flex items-center gap-2 py-1">
                <Artwork
                  artworkBlobId={t.artworkBlobId}
                  album={t.album}
                  artist={t.artist}
                  className="h-8 w-8 shrink-0"
                  rounded="sm"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{t.title}</span>
                  <span className="block truncate text-xs text-text-muted">{t.artist}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
