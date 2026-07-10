import Dexie, { type Table } from 'dexie';
import type { AppSettings, BlobDoc, Playlist, Track } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

/**
 * IndexedDB schema, versioned via Dexie.
 *
 *   tracks     id -> Track metadata (searchable/sortable fields indexed)
 *   blobs      id -> raw audio/artwork bytes (never indexed by content, just fetched by id)
 *   playlists  id -> Playlist { trackIds order = playback order }
 *   app        id -> singleton AppSettings ('settings' row)
 *
 * Bump `version()` and add a `.upgrade()` block whenever the schema changes;
 * Dexie runs migrations in order the first time a client opens the new version.
 */
class MusicDb extends Dexie {
  tracks!: Table<Track, string>;
  blobs!: Table<BlobDoc, string>;
  playlists!: Table<Playlist, string>;
  app!: Table<AppSettings, string>;

  constructor() {
    super('waveform-music-db');

    this.version(1).stores({
      tracks: 'id, title, artist, album, contentHash, createdAt',
      blobs: 'id, type',
      playlists: 'id, name, createdAt',
      app: 'id',
    });
  }
}

export const db = new MusicDb();

/** Ensures the singleton settings row exists; returns it either way. */
export async function getOrCreateSettings(): Promise<AppSettings> {
  const existing = await db.app.get('settings');
  if (existing) return existing;
  await db.app.put(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  const current = await getOrCreateSettings();
  await db.app.put({ ...current, ...patch, id: 'settings' });
}

/** Deletes a track, its audio/artwork blobs, and removes it from every playlist. */
export async function deleteTrackCascade(trackId: string): Promise<void> {
  await db.transaction('rw', db.tracks, db.blobs, db.playlists, async () => {
    const track = await db.tracks.get(trackId);
    if (!track) return;

    const blobIds = [track.audioBlobId, track.artworkBlobId].filter(
      (id): id is string => Boolean(id),
    );
    if (blobIds.length) await db.blobs.bulkDelete(blobIds);
    await db.tracks.delete(trackId);

    const playlists = await db.playlists.toArray();
    await Promise.all(
      playlists
        .filter((p) => p.trackIds.includes(trackId))
        .map((p) =>
          db.playlists.update(p.id, {
            trackIds: p.trackIds.filter((id) => id !== trackId),
            updatedAt: Date.now(),
          }),
        ),
    );
  });
}

/** Estimates current storage usage/quota, when the browser supports it. */
export async function getStorageEstimate(): Promise<{
  usage: number;
  quota: number;
} | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}
