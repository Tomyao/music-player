import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { usePlayer } from '@/hooks/usePlayer';
import { Artwork } from '@/components/Artwork';
import { formatDuration } from '@/lib/audio';
import type { Track } from '@/types';

/**
 * The "poster" view of the current track: artwork, title/artist/album, and
 * (mobile only) the seek bar and play/prev/next transport — moved off the
 * persistent player bar, which stays compact there and keeps only
 * shuffle/repeat. Desktop keeps those in the player bar and doesn't repeat
 * them here. Rendered inside `NowPlayingOverlay`.
 */
export function NowPlayingContent({ track }: { track: Track }) {
  const { currentTime, duration, isPlaying, isLoading, seek, togglePlay, next, prev } = usePlayer();

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

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
            value={currentTime}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Seek"
            style={{
              background: `linear-gradient(to right, rgb(var(--color-accent)) ${progressPct}%, rgb(var(--color-border)) ${progressPct}%)`,
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
    </div>
  );
}
