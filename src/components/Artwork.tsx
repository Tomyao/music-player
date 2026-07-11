import { useEffect, useState } from 'react';
import { db } from '@/db/indexedDb';
import { objectUrlCache, placeholderArtworkDataUrl } from '@/lib/audio';

interface ArtworkProps {
  artworkBlobId?: string;
  album: string;
  artist: string;
  className?: string;
  rounded?: 'sm' | 'md' | 'lg';
}

const roundedMap = { sm: 'rounded', md: 'rounded-lg', lg: 'rounded-2xl' };

/** Resolves a track's artwork blob to an <img>, falling back to a deterministic gradient. */
export function Artwork({ artworkBlobId, album, artist, className = '', rounded = 'md' }: ArtworkProps) {
  const [src, setSrc] = useState<string>(() => placeholderArtworkDataUrl(album, artist));

  useEffect(() => {
    if (!artworkBlobId) {
      setSrc(placeholderArtworkDataUrl(album, artist));
      return;
    }

    let cancelled = false;
    let acquiredId: string | null = null;

    (async () => {
      const doc = await db.blobs.get(artworkBlobId);
      if (cancelled) return;
      if (!doc) {
        setSrc(placeholderArtworkDataUrl(album, artist));
        return;
      }
      const url = objectUrlCache.acquire(doc.id, doc.blob);
      acquiredId = doc.id;
      setSrc(url);
    })();

    return () => {
      cancelled = true;
      if (acquiredId) objectUrlCache.release(acquiredId);
    };
  }, [artworkBlobId, album, artist]);

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      draggable={false}
      className={`${roundedMap[rounded]} bg-surface object-cover select-none [-webkit-touch-callout:none] ${className}`}
    />
  );
}
