import { Navigate, Route, Routes } from 'react-router-dom';
import { TopBar } from '@/components/TopBar';
import { PlayerBar } from '@/components/PlayerBar';
import { QueueDrawer } from '@/components/QueueDrawer';
import { NowPlayingOverlay } from '@/components/NowPlayingOverlay';
import { Toasts } from '@/components/Toasts';
import UploadPage from '@/pages/Upload';
import SongsPage from '@/pages/Songs';
import PlaylistsPage from '@/pages/Playlists';
import PlaylistDetailPage from '@/pages/PlaylistDetail';

export default function App() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-bg"
      >
        Skip to main content
      </a>

      <TopBar />

      <main id="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/library" replace />} />
          <Route path="/library" element={<SongsPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/playlists" element={<PlaylistsPage />} />
          <Route path="/playlists/:id" element={<PlaylistDetailPage />} />
          <Route path="*" element={<Navigate to="/library" replace />} />
        </Routes>
      </main>

      <QueueDrawer />
      <NowPlayingOverlay />
      <PlayerBar />
      <Toasts />
    </div>
  );
}
