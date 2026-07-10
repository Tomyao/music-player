export interface ParsedAudio {
  title: string;
  artist: string;
  album: string;
  duration: number;
  year?: number;
  genre?: string;
  trackNo?: number;
  artwork?: { data: Uint8Array; format: string };
}

/** Best-effort "Artist - Title" / "Artist_-_Title" filename parser, used as a fallback. */
function parseFileName(fileName: string): { title: string; artist: string } {
  const base = fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
  const parts = base.split(/\s*-\s*/);
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
  }
  return { artist: 'Unknown Artist', title: base.trim() || fileName };
}

/**
 * Extracts ID3 metadata (and embedded artwork) from an MP3 file in the browser.
 * Falls back to filename parsing when tags are missing or parsing throws
 * (e.g. corrupted headers) so an import never hard-fails on one bad file.
 */
export async function extractMetadata(file: File): Promise<ParsedAudio> {
  const fallback = parseFileName(file.name);

  try {
    // Dynamically imported: this library is large and only needed on the Upload page.
    const { parseBlob } = await import('music-metadata-browser');
    const metadata = await parseBlob(file, { duration: true, skipCovers: false });
    const { common, format } = metadata;

    const picture = common.picture?.[0];

    return {
      title: common.title?.trim() || fallback.title,
      artist: common.artist?.trim() || common.albumartist?.trim() || fallback.artist,
      album: common.album?.trim() || 'Unknown Album',
      duration: format.duration ?? 0,
      year: common.year,
      genre: common.genre?.[0],
      trackNo: common.track?.no ?? undefined,
      artwork: picture
        ? { data: picture.data, format: picture.format || 'image/jpeg' }
        : undefined,
    };
  } catch (err) {
    console.warn(`[id3] Failed to parse tags for "${file.name}", using filename fallback`, err);
    return {
      title: fallback.title,
      artist: fallback.artist,
      album: 'Unknown Album',
      duration: await estimateDurationFromMedia(file).catch(() => 0),
    };
  }
}

/** Last-resort duration probe via an <audio> element when tag parsing fails entirely. */
function estimateDurationFromMedia(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read audio metadata'));
    };
    audio.src = url;
  });
}
