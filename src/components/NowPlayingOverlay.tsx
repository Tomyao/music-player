import { useEffect } from 'react';
import { X } from 'lucide-react';
import { usePlayer } from '@/hooks/usePlayer';
import { NowPlayingContent } from '@/components/NowPlayingContent';

/**
 * Overlays the current page with the "poster" view when toggled from the
 * player bar's track info. Positioned below the player bar (lower z-index)
 * so tapping the track info again — or the close button — still reaches
 * through to close it. Renders above the queue drawer when it was opened
 * more recently, and below it otherwise (see `topOverlay`).
 */
export function NowPlayingOverlay() {
  const { currentTrack, nowPlayingOpen, topOverlay, toggleNowPlaying } = usePlayer();

  useEffect(() => {
    if (!nowPlayingOpen) return;
    const onEscape = (e: KeyboardEvent) => e.key === 'Escape' && toggleNowPlaying();
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [nowPlayingOpen, toggleNowPlaying]);

  if (!nowPlayingOpen || !currentTrack) return null;

  return (
    <div
      role="dialog"
      aria-label="Now playing"
      className={`fixed inset-x-0 bottom-16 top-14 flex animate-slide-up flex-col overflow-hidden bg-bg sm:bottom-20 ${
        topOverlay === 'nowPlaying' ? 'z-30' : 'z-20'
      }`}
    >
      <button
        onClick={toggleNowPlaying}
        aria-label="Close now playing"
        className="ml-auto mr-2 mt-2 shrink-0 rounded-full bg-surface p-2 text-text-muted shadow-md hover:bg-surface-hover hover:text-text"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
      <div className="min-h-0 flex-1">
        <NowPlayingContent track={currentTrack} />
      </div>
    </div>
  );
}
