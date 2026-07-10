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

/** MIME types the underlying parser recognizes for our two supported extensions. */
const RECOGNIZED_MIME_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
};

function mimeTypeFor(file: File): string {
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  return RECOGNIZED_MIME_TYPES[ext] || file.type;
}

// music-metadata's tag scanner references the bare `Buffer` global directly
// (e.g. its legacy ID3v1-trailer check) rather than importing a polyfill —
// fine in Node, where Buffer is always present, but it throws
// "Buffer is not defined" in a real browser, silently discarding whatever
// had already been parsed. Vite doesn't shim Node globals automatically, so
// it's polyfilled by hand here, lazily, only when actually needed.
async function ensureBufferPolyfill(): Promise<void> {
  if (typeof globalThis.Buffer !== 'undefined') return;
  const { Buffer } = await import('buffer');
  (globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;
}

/**
 * Extracts tag metadata (and embedded artwork) from an audio file in the
 * browser — ID3 for MP3, iTunes-style atoms for M4A. Falls back to filename
 * parsing when tags are missing or parsing throws (e.g. corrupted headers)
 * so an import never hard-fails on one bad file.
 */
export async function extractMetadata(file: File): Promise<ParsedAudio> {
  const fallback = parseFileName(file.name);

  try {
    // Dynamically imported: this library is large and only needed on the Upload page.
    const [{ parseBuffer }] = await Promise.all([
      import('music-metadata-browser'),
      ensureBufferPolyfill(),
    ]);

    // Deliberately not parseBlob(): it parses from a ReadableStream via
    // Blob.stream(), and that streaming path silently returns empty tags for
    // real-world M4A files in an actual browser (confirmed — the exact same
    // file parses correctly through parseBuffer, and through parseBlob in a
    // Node repro using Node's own stream/Blob polyfills, so the bug is
    // specific to how Chromium's real Blob.stream() interacts with this
    // deprecated package's stream-to-tokenizer adapter). Reading the whole
    // file into memory and using parseBuffer sidesteps that path entirely —
    // fine here since we already hold the full file for IndexedDB storage.
    const buffer = new Uint8Array(await file.arrayBuffer());
    const metadata = await parseBuffer(
      buffer,
      { mimeType: mimeTypeFor(file), size: buffer.length },
      { duration: true, skipCovers: false },
    );
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
