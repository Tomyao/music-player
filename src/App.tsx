import { Navigate, Route, Routes } from 'react-router-dom';
import { TopBar } from '@/components/TopBar';
import { PlayerBar } from '@/components/PlayerBar';
import { QueueDrawer } from '@/components/QueueDrawer';
import { Toasts } from '@/components/Toasts';
import { usePlayer } from '@/hooks/usePlayer';
import UploadPage from '@/pages/Upload';
import SongsPage from '@/pages/Songs';
import PlaylistsPage from '@/pages/Playlists';
import PlaylistDetailPage from '@/pages/PlaylistDetail';
import NowPlayingPage from '@/pages/NowPlaying';

export default function App() {
  const { queueDrawerOpen } = usePlayer();

  return (
    <div className="min-h-screen bg-bg text-text">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-bg"
      >
        Skip to main content
      </a>

      <TopBar />

      {/* On large screens the queue is a side panel, so push content over instead of
          letting it sit underneath (which would silently block clicks there). On
          small screens the drawer is a full-width sheet, so no reflow is needed. */}
      <main id="main-content" className={queueDrawerOpen ? 'lg:pr-96' : ''}>
        <Routes>
          <Route path="/" element={<Navigate to="/songs" replace />} />
          <Route path="/songs" element={<SongsPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/playlists" element={<PlaylistsPage />} />
          <Route path="/playlists/:id" element={<PlaylistDetailPage />} />
          <Route path="/now-playing" element={<NowPlayingPage />} />
          <Route path="*" element={<Navigate to="/songs" replace />} />
        </Routes>
      </main>

      <QueueDrawer />
      <PlayerBar />
      <Toasts />
    </div>
  );
}
