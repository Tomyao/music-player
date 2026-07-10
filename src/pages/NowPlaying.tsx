import { Link } from 'react-router-dom';
import {
  ListMusic,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { usePlayer } from '@/hooks/usePlayer';
import { useTracksByIds } from '@/hooks/useIndexedDb';
import { Artwork } from '@/components/Artwork';
import { formatDuration } from '@/lib/audio';

export default function NowPlayingPage() {
  const {
    currentTrack,
    queue,
    currentIndex,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    repeat,
    shuffle,
    togglePlay,
    seek,
    next,
    prev,
    setRepeat,
    toggleShuffle,
    toggleQueueDrawer,
    playNow,
  } = usePlayer();

  const upNextIds = queue.slice(currentIndex + 1, currentIndex + 6);
  const upNext = useTracksByIds(upNextIds);

  const cycleRepeat = () => {
    const order: Array<typeof repeat> = ['off', 'all', 'one'];
    setRepeat(order[(order.indexOf(repeat) + 1) % order.length]);
  };

  if (!currentTrack) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-24 text-center">
        <Music2 className="h-10 w-10 text-text-muted" aria-hidden="true" />
        <h1 className="text-xl font-semibold">Nothing playing</h1>
        <p className="text-text-muted">Pick a song from your library to get started.</p>
        <Link
          to="/songs"
          className="mt-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-bg hover:bg-accent-hover"
        >
          Browse songs
        </Link>
      </div>
    );
  }

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-40">
      <div className="flex flex-col items-center">
        <Artwork
          artworkBlobId={currentTrack.artworkBlobId}
          title={currentTrack.title}
          artist={currentTrack.artist}
          rounded="lg"
          className="h-72 w-72 shadow-2xl sm:h-80 sm:w-80"
        />

        <div className="mt-6 text-center">
          <h1 className="text-2xl font-semibold">{currentTrack.title}</h1>
          <p className="mt-1 text-text-muted">{currentTrack.artist}</p>
          <p className="text-sm text-text-muted">{currentTrack.album}</p>
        </div>

        <div className="mt-6 w-full max-w-md">
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
            className="h-1.5 w-full appearance-none rounded-full accent-accent"
          />
          <div className="mt-1 flex justify-between text-xs tabular-nums text-text-muted">
            <span>{formatDuration(currentTime)}</span>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-6">
          <button
            onClick={toggleShuffle}
            aria-pressed={shuffle}
            aria-label="Toggle shuffle"
            className={`rounded-full p-2 hover:bg-surface-hover ${shuffle ? 'text-accent' : 'text-text-muted'}`}
          >
            <Shuffle className="h-5 w-5" aria-hidden="true" />
          </button>
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
            className="flex h-14 w-14 items-center justify-center rounded-full bg-text text-bg hover:scale-105 disabled:opacity-50"
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
          <button
            onClick={cycleRepeat}
            aria-pressed={repeat !== 'off'}
            aria-label={`Repeat: ${repeat}`}
            className={`rounded-full p-2 hover:bg-surface-hover ${repeat !== 'off' ? 'text-accent' : 'text-text-muted'}`}
          >
            {repeat === 'one' ? (
              <Repeat1 className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Repeat className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <div className="mt-12">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Up next</h2>
          <button
            onClick={toggleQueueDrawer}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-text-muted hover:bg-surface-hover hover:text-text"
          >
            <ListMusic className="h-4 w-4" aria-hidden="true" />
            Full queue
          </button>
        </div>

        {upNext && upNext.length > 0 ? (
          <ul className="space-y-0.5">
            {upNext.map((track, i) => (
              <li key={track.id + i}>
                <button
                  onClick={() => playNow(queue, currentIndex + 1 + i)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-hover"
                >
                  <Artwork
                    artworkBlobId={track.artworkBlobId}
                    title={track.title}
                    artist={track.artist}
                    className="h-10 w-10 shrink-0"
                    rounded="sm"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{track.title}</span>
                    <span className="block truncate text-xs text-text-muted">{track.artist}</span>
                  </span>
                  <span className="text-xs tabular-nums text-text-muted">
                    {formatDuration(track.duration)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-text-muted">
            Nothing queued after this. Add more songs from your library.
          </p>
        )}
      </div>
    </div>
  );
}
