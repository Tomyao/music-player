import {
  ListVideo,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '@/hooks/usePlayer';
import { Artwork } from '@/components/Artwork';
import { Marquee } from '@/components/Marquee';
import { formatDuration, seekFillPosition } from '@/lib/audio';

function VolumeIcon({ volume }: { volume: number }) {
  if (volume === 0) return <VolumeX className="h-5 w-5" aria-hidden="true" />;
  if (volume < 0.5) return <Volume1 className="h-5 w-5" aria-hidden="true" />;
  return <Volume2 className="h-5 w-5" aria-hidden="true" />;
}

/** Persistent transport bar, always visible; shows a placeholder when nothing is loaded. */
export function PlayerBar() {
  const {
    currentTrack,
    queue,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    repeat,
    shuffle,
    queueDrawerOpen,
    nowPlayingOpen,
    error,
    togglePlay,
    seek,
    next,
    prev,
    setVolume,
    setRepeat,
    toggleShuffle,
    toggleQueueDrawer,
    toggleNowPlaying,
  } = usePlayer();

  const lastVolumeRef = useRef(volume || 1);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const volumeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!volumeOpen) return;
    const onClick = (e: MouseEvent) => {
      if (volumeRef.current && !volumeRef.current.contains(e.target as Node)) setVolumeOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => e.key === 'Escape' && setVolumeOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, [volumeOpen]);

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const hasQueue = queue.length > 0;
  // Shuffle/prev/next/repeat/seek only make sense once a track is actually
  // loaded; Play itself stays enabled when the queue has tracks queued up
  // but nothing has been started yet, so it can kick off playback.
  const disabled = !currentTrack;
  const playDisabled = (!currentTrack && !hasQueue) || isLoading;

  const cycleRepeat = () => {
    const order: Array<typeof repeat> = ['off', 'all', 'one'];
    setRepeat(order[(order.indexOf(repeat) + 1) % order.length]);
  };

  const toggleMute = () => {
    if (volume > 0) {
      lastVolumeRef.current = volume;
      setVolume(0);
    } else {
      setVolume(lastVolumeRef.current || 1);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur">
      {error && (
        <p role="alert" className="bg-danger/10 px-4 py-1 text-center text-xs text-danger">
          {error}
        </p>
      )}

      <div className="mx-auto flex max-w-6xl items-center gap-4 px-3 py-2 sm:py-3">
        {currentTrack ? (
          <button
            onClick={toggleNowPlaying}
            aria-pressed={nowPlayingOpen}
            aria-label="Toggle now playing"
            className="flex min-w-0 flex-1 select-none items-center gap-3 text-left sm:flex-none sm:w-64"
          >
            <Artwork
              artworkBlobId={currentTrack.artworkBlobId}
              album={currentTrack.album}
              artist={currentTrack.artist}
              className="h-12 w-12 shrink-0"
              rounded="sm"
            />
            <div className="min-w-0">
              <Marquee text={currentTrack.title} className="text-sm font-medium" />
              <Marquee text={currentTrack.artist} className="text-xs text-text-muted" />
            </div>
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:flex-none sm:w-64">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-surface-hover text-text-muted">
              <Music2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <Marquee text="Nothing playing" className="text-sm font-medium text-text-muted" />
              <Marquee
                text={hasQueue ? 'Press play to start queue' : 'Pick a song to get started'}
                className="text-xs text-text-muted"
              />
            </div>
          </div>
        )}

        <div className="hidden flex-1 flex-col items-center gap-1 sm:flex">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleShuffle}
              aria-pressed={shuffle}
              aria-label="Toggle shuffle"
              title="Shuffle"
              className={`rounded-full p-2.5 hover:bg-surface-hover ${shuffle ? 'text-accent' : 'text-text-muted'}`}
            >
              <Shuffle className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              onClick={prev}
              disabled={disabled}
              aria-label="Previous track"
              className="rounded-full p-2.5 text-text hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-40"
            >
              <SkipBack className="h-6 w-6" aria-hidden="true" />
            </button>
            <button
              onClick={togglePlay}
              disabled={playDisabled}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-text text-bg hover:scale-105 disabled:pointer-events-none disabled:opacity-40"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Play className="h-5 w-5 translate-x-0.5" aria-hidden="true" />
              )}
            </button>
            <button
              onClick={next}
              disabled={disabled}
              aria-label="Next track"
              className="rounded-full p-2.5 text-text hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-40"
            >
              <SkipForward className="h-6 w-6" aria-hidden="true" />
            </button>
            <button
              onClick={cycleRepeat}
              aria-pressed={repeat !== 'off'}
              aria-label={`Repeat: ${repeat}`}
              title={`Repeat: ${repeat}`}
              className={`rounded-full p-2.5 hover:bg-surface-hover ${repeat !== 'off' ? 'text-accent' : 'text-text-muted'}`}
            >
              {repeat === 'one' ? (
                <Repeat1 className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Repeat className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>

          <div className="flex w-full max-w-md items-center gap-2">
            <span className="w-9 text-right text-[11px] tabular-nums text-text-muted">
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
              disabled={disabled}
              style={{
                background: `linear-gradient(to right, rgb(var(--color-accent)) ${seekFillPosition(progressPct)}, rgb(var(--color-border)) ${seekFillPosition(progressPct)})`,
              }}
              className="h-1 flex-1 appearance-none rounded-full accent-accent disabled:opacity-40"
            />
            <span className="w-9 text-[11px] tabular-nums text-text-muted">
              {formatDuration(duration)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:w-64 sm:justify-end">
          <button
            onClick={toggleShuffle}
            aria-pressed={shuffle}
            aria-label="Toggle shuffle"
            className={`rounded-full p-2.5 hover:bg-surface-hover sm:hidden ${shuffle ? 'text-accent' : 'text-text-muted'}`}
          >
            <Shuffle className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            onClick={cycleRepeat}
            aria-pressed={repeat !== 'off'}
            aria-label={`Repeat: ${repeat}`}
            className={`rounded-full p-2.5 hover:bg-surface-hover sm:hidden ${repeat !== 'off' ? 'text-accent' : 'text-text-muted'}`}
          >
            {repeat === 'one' ? (
              <Repeat1 className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Repeat className="h-5 w-5" aria-hidden="true" />
            )}
          </button>

          <div className="relative" ref={volumeRef}>
            <button
              onClick={() => setVolumeOpen((o) => !o)}
              aria-label="Volume"
              aria-haspopup="true"
              aria-expanded={volumeOpen}
              className="rounded-full p-2.5 text-text-muted hover:bg-surface-hover hover:text-text"
            >
              <VolumeIcon volume={volume} />
            </button>
            {volumeOpen && (
              <div
                role="group"
                aria-label="Volume control"
                className="absolute bottom-full right-0 mb-2 flex animate-fade-in items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 shadow-xl"
              >
                <button
                  onClick={toggleMute}
                  aria-label={volume === 0 ? 'Unmute' : 'Mute'}
                  className="text-text-muted hover:text-text"
                >
                  <VolumeIcon volume={volume} />
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  aria-label="Volume"
                  autoFocus
                  className="h-1 w-24 accent-accent"
                />
              </div>
            )}
          </div>

          <button
            onClick={toggleQueueDrawer}
            aria-pressed={queueDrawerOpen}
            aria-expanded={queueDrawerOpen}
            aria-controls="queue-drawer"
            aria-label={queueDrawerOpen ? 'Hide queue' : 'Show queue'}
            title="Queue"
            className={`rounded-full p-2.5 hover:bg-surface-hover ${queueDrawerOpen ? 'text-accent' : 'text-text-muted'}`}
          >
            <ListVideo className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
