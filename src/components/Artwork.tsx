import { useEffect, useState } from 'react';
import { db } from '@/db/indexedDb';
import { objectUrlCache, placeholderArtworkDataUrl } from '@/lib/audio';

interface ArtworkProps {
  artworkBlobId?: string;
  title: string;
  artist: string;
  className?: string;
  rounded?: 'sm' | 'md' | 'lg';
}

const roundedMap = { sm: 'rounded', md: 'rounded-lg', lg: 'rounded-2xl' };

/** Resolves a track's artwork blob to an <img>, falling back to a deterministic gradient. */
export function Artwork({ artworkBlobId, title, artist, className = '', rounded = 'md' }: ArtworkProps) {
  const [src, setSrc] = useState<string>(() => placeholderArtworkDataUrl(title, artist));

  useEffect(() => {
    if (!artworkBlobId) {
      setSrc(placeholderArtworkDataUrl(title, artist));
      return;
    }

    let cancelled = false;
    let acquiredId: string | null = null;

    (async () => {
      const doc = await db.blobs.get(artworkBlobId);
      if (cancelled) return;
      if (!doc) {
        setSrc(placeholderArtworkDataUrl(title, artist));
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
  }, [artworkBlobId, title, artist]);

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      className={`${roundedMap[rounded]} bg-surface object-cover ${className}`}
    />
  );
}
