import { Link } from 'react-router-dom';
import { Music2 } from 'lucide-react';
import { usePlayer } from '@/hooks/usePlayer';
import { Artwork } from '@/components/Artwork';

/**
 * Full-screen "poster" view of the current track. Deliberately has no
 * transport controls of its own — the persistent player bar already covers
 * play/pause, seek, shuffle, repeat, and the queue on every page.
 */
export default function NowPlayingPage() {
  const { currentTrack } = usePlayer();

  if (!currentTrack) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-24 text-center">
        <Music2 className="h-10 w-10 text-text-muted" aria-hidden="true" />
        <h1 className="text-xl font-semibold">Nothing playing</h1>
        <p className="text-text-muted">Pick a song from your library to get started.</p>
        <Link
          to="/library"
          className="mt-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-bg hover:bg-accent-hover"
        >
          Browse songs
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-8 pb-24">
      <Artwork
        artworkBlobId={currentTrack.artworkBlobId}
        album={currentTrack.album}
        artist={currentTrack.artist}
        rounded="lg"
        className="h-56 w-56 shadow-2xl sm:h-64 sm:w-64"
      />

      <div className="mt-6 text-center">
        <h1 className="text-2xl font-semibold">{currentTrack.title}</h1>
        <p className="mt-1 text-text-muted">{currentTrack.artist}</p>
        <p className="text-sm text-text-muted">{currentTrack.album}</p>
      </div>
    </div>
  );
}
