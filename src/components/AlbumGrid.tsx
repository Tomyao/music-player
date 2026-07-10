import { Artwork } from '@/components/Artwork';
import { formatDuration } from '@/lib/audio';

export interface AlbumGroup {
  key: string;
  album: string;
  artist: string;
  trackCount: number;
  totalDuration: number;
  artworkBlobId?: string;
}

interface AlbumGridProps {
  albums: AlbumGroup[];
  onSelect: (group: AlbumGroup) => void;
  emptyMessage?: string;
}

/** Grid of album covers, grouped from the track list. Click to drill into that album's songs. */
export function AlbumGrid({ albums, onSelect, emptyMessage = 'No albums found.' }: AlbumGridProps) {
  if (albums.length === 0) {
    return <p className="py-12 text-center text-sm text-text-muted">{emptyMessage}</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {albums.map((group) => (
        <button
          key={group.key}
          onClick={() => onSelect(group)}
          className="rounded-2xl border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Artwork
            album={group.album}
            artist={group.artist}
            artworkBlobId={group.artworkBlobId}
            rounded="lg"
            className="mb-3 aspect-square w-full"
          />
          <h3 className="truncate font-medium">{group.album}</h3>
          <p className="truncate text-sm text-text-muted">{group.artist}</p>
          <p className="text-xs text-text-muted">
            {group.trackCount} {group.trackCount === 1 ? 'song' : 'songs'} ·{' '}
            {formatDuration(group.totalDuration)}
          </p>
        </button>
      ))}
    </div>
  );
}
