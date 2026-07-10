/** Formats seconds as "m:ss", or "h:mm:ss" once it crosses an hour. */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Reference-counted object-URL cache keyed by blob id, so multiple components
 * (PlayerBar, NowPlaying, a list thumbnail) can share one URL per blob instead
 * of leaking a new one each render. Call `release` in a cleanup effect.
 */
class ObjectUrlCache {
  private urls = new Map<string, { url: string; refs: number }>();

  acquire(id: string, blob: Blob): string {
    const existing = this.urls.get(id);
    if (existing) {
      existing.refs += 1;
      return existing.url;
    }
    const url = URL.createObjectURL(blob);
    this.urls.set(id, { url, refs: 1 });
    return url;
  }

  release(id: string): void {
    const existing = this.urls.get(id);
    if (!existing) return;
    existing.refs -= 1;
    if (existing.refs <= 0) {
      URL.revokeObjectURL(existing.url);
      this.urls.delete(id);
    }
  }
}

export const objectUrlCache = new ObjectUrlCache();

/** Cheap string hash (djb2) for deriving deterministic colors/placeholders. */
function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return hash >>> 0;
}

function initialsFor(title: string, artist: string): string {
  const source = artist !== 'Unknown Artist' ? artist : title;
  const words = source.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Deterministic gradient placeholder cover, used whenever a track has no
 * embedded artwork. Same title/artist always produces the same art, so the
 * UI stays stable across renders and sessions without storing anything.
 */
export function placeholderArtworkDataUrl(title: string, artist: string): string {
  const seed = hashString(`${artist}::${title}`);
  const hueA = seed % 360;
  const hueB = (hueA + 55 + (seed % 40)) % 360;
  const initials = initialsFor(title, artist);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="hsl(${hueA} 70% 45%)" />
          <stop offset="100%" stop-color="hsl(${hueB} 70% 35%)" />
        </linearGradient>
      </defs>
      <rect width="200" height="200" fill="url(#g)" />
      <text x="100" y="115" font-family="system-ui, sans-serif" font-size="72"
        font-weight="600" fill="rgba(255,255,255,0.92)" text-anchor="middle">${initials}</text>
    </svg>`.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
