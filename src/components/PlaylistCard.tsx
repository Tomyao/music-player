import { useNavigate } from 'react-router-dom';
import { ListMusic, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTracksByIds } from '@/hooks/useIndexedDb';
import { Artwork } from '@/components/Artwork';
import type { Playlist } from '@/types';

interface PlaylistCardProps {
  playlist: Playlist;
  onRename: (playlist: Playlist) => void;
  onDelete: (playlist: Playlist) => void;
}

export function PlaylistCard({ playlist, onRename, onDelete }: PlaylistCardProps) {
  const navigate = useNavigate();
  const previewTracks = useTracksByIds(playlist.trackIds.slice(0, 4));
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  return (
    <div className="group relative rounded-2xl border border-border bg-surface p-4 transition-colors hover:bg-surface-hover">
      <button
        onClick={() => navigate(`/playlists/${playlist.id}`)}
        className="block w-full select-none text-left focus-visible:outline-none"
      >
        <div className="mb-3 grid aspect-square grid-cols-2 gap-0.5 overflow-hidden rounded-xl bg-bg">
          {previewTracks && previewTracks.length > 0 ? (
            previewTracks
              .concat(Array(4).fill(undefined))
              .slice(0, 4)
              .map((t, i) =>
                t ? (
                  <Artwork
                    key={t.id}
                    artworkBlobId={t.artworkBlobId}
                    album={t.album}
                    artist={t.artist}
                    rounded="sm"
                    className="h-full w-full"
                  />
                ) : (
                  <div key={i} className="bg-bg" />
                ),
              )
          ) : (
            <div className="col-span-2 flex items-center justify-center">
              <ListMusic className="h-10 w-10 text-text-muted" aria-hidden="true" />
            </div>
          )}
        </div>
        <h3 className="truncate font-medium focus-visible:outline-2 focus-visible:outline-accent">
          {playlist.name}
        </h3>
        <p className="text-sm text-text-muted">
          {playlist.trackIds.length} {playlist.trackIds.length === 1 ? 'song' : 'songs'}
        </p>
      </button>

      <div className="absolute right-3 top-3" ref={ref}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={`More options for ${playlist.name}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="rounded-full bg-bg/80 p-1.5 text-text-muted backdrop-blur transition-opacity hover:text-text focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent sm:opacity-0 sm:group-hover:opacity-100"
        >
          <MoreVertical className="h-4 w-4" aria-hidden="true" />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 z-20 mt-1 w-40 animate-fade-in rounded-xl border border-border bg-surface p-1 shadow-xl"
          >
            <button
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onRename(playlist);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-hover"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" /> Rename
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onDelete(playlist);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-danger hover:bg-danger/10"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
