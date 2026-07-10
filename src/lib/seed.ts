import { db } from '@/db/indexedDb';
import type { Track } from '@/types';

/** Set VITE_ENABLE_DEMO_SEED=true (or run on localhost) to expose the "Load demo tracks" action. */
export function isSeedEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_DEMO_SEED === 'true' || import.meta.env.DEV;
}

/** Builds a tiny synthetic WAV blob (a short sine tone) so demo tracks are actually playable. */
function generateToneWav(seconds: number, frequency: number): Blob {
  const sampleRate = 8000;
  const numSamples = Math.floor(seconds * sampleRate);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.min(1, (seconds - t) * 4, t * 20); // quick fade in/out, avoids clicks
    const sample = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.2;
    view.setInt16(44 + i * 2, sample * 32767, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

const DEMO_META: Array<Pick<Track, 'title' | 'artist' | 'album' | 'genre' | 'year'> & {
  duration: number;
  freq: number;
}> = [
  { title: 'Midnight Drive', artist: 'Neon Static', album: 'Afterglow', genre: 'Synthwave', year: 2023, duration: 6, freq: 220 },
  { title: 'Paper Boats', artist: 'Lowlight', album: 'Paper Boats', genre: 'Indie Folk', year: 2021, duration: 5, freq: 294 },
  { title: 'Glass Cities', artist: 'Neon Static', album: 'Afterglow', genre: 'Synthwave', year: 2023, duration: 7, freq: 330 },
  { title: 'Slow Bloom', artist: 'Marigold', album: 'Slow Bloom EP', genre: 'Lo-fi', year: 2022, duration: 5, freq: 262 },
  { title: 'Coastline', artist: 'Lowlight', album: 'Paper Boats', genre: 'Indie Folk', year: 2021, duration: 6, freq: 349 },
  { title: 'Static Bloom', artist: 'Marigold', album: 'Slow Bloom EP', genre: 'Lo-fi', year: 2022, duration: 4, freq: 196 },
];

/** Inserts a handful of playable demo tracks (and one demo playlist) for quick UI testing. Idempotent. */
export async function seedDemoLibrary(): Promise<number> {
  const already = await db.tracks.where('title').equals('Midnight Drive').count();
  if (already > 0) return 0;

  const now = Date.now();
  const tracks: Track[] = [];

  for (const meta of DEMO_META) {
    const audioId = crypto.randomUUID();
    const blob = generateToneWav(meta.duration, meta.freq);
    await db.blobs.put({ id: audioId, type: 'audio', blob, mimeType: 'audio/wav' });

    const track: Track = {
      id: crypto.randomUUID(),
      title: meta.title,
      artist: meta.artist,
      album: meta.album,
      duration: meta.duration,
      genre: meta.genre,
      year: meta.year,
      audioBlobId: audioId,
      contentHash: `demo-${audioId}`,
      fileName: `${meta.title}.wav`,
      fileSize: blob.size,
      mimeType: 'audio/wav',
      createdAt: now,
      updatedAt: now,
    };
    tracks.push(track);
  }

  await db.tracks.bulkAdd(tracks);

  await db.playlists.add({
    id: crypto.randomUUID(),
    name: 'Demo Mix',
    trackIds: tracks.slice(0, 4).map((t) => t.id),
    createdAt: now,
    updatedAt: now,
  });

  return tracks.length;
}
