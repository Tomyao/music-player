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

/**
 * Deletes a track and its audio/artwork blobs. Playlists keep the track's
 * `id` in `trackIds` (rather than dropping the reference) but cache its
 * title/artist/album in `trackMeta` so it still shows up, unplayable, until
 * a matching track is re-uploaded.
 */
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
            trackMeta: {
              ...p.trackMeta,
              [trackId]: { title: track.title, artist: track.artist, album: track.album },
            },
            updatedAt: Date.now(),
          }),
        ),
    );
  });
}

export interface RescanResult {
  relinked: number;
}

/**
 * Re-resolves a playlist's missing track references against the current
 * library. Entries cached in `trackMeta` (dropped tracks or ones that
 * weren't present at import time) are matched against local tracks by
 * title/artist/album (not audio content, so the same song re-added in a
 * different file format or rip still matches) and swapped in place so the
 * playlist points at the real track again.
 */
export async function rescanPlaylist(playlistId: string): Promise<RescanResult> {
  return db.transaction('rw', db.tracks, db.playlists, async () => {
    const playlist = await db.playlists.get(playlistId);
    const missingEntries = Object.entries(playlist?.trackMeta ?? {});
    if (!playlist || missingEntries.length === 0) return { relinked: 0 };

    const nameKey = (title: string, artist: string, album: string) =>
      `${title} ${artist} ${album}`.trim().toLowerCase();

    const allTracks = await db.tracks.toArray();
    const byName = new Map(allTracks.map((t) => [nameKey(t.title, t.artist, t.album), t]));

    const trackIds = [...playlist.trackIds];
    const trackMeta = { ...playlist.trackMeta };
    let relinked = 0;

    for (const [id, stub] of missingEntries) {
      const match = byName.get(nameKey(stub.title, stub.artist, stub.album));
      if (!match) continue;

      const idx = trackIds.indexOf(id);
      if (idx === -1) continue;
      trackIds[idx] = match.id;
      delete trackMeta[id];
      relinked += 1;
    }

    if (relinked > 0) {
      await db.playlists.update(playlistId, { trackIds, trackMeta, updatedAt: Date.now() });
    }

    return { relinked };
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
