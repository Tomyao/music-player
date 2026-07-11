import { db } from '@/db/indexedDb';
import type { PlaylistExport, TrackStub } from '@/types';

/** Exports all playlists (name + track id references) as a JSON document. */
export async function exportPlaylists(): Promise<PlaylistExport> {
  const playlists = await db.playlists.toArray();

  const trackIds = new Set<string>();
  for (const p of playlists) for (const id of p.trackIds) trackIds.add(id);
  const tracks = await db.tracks.bulkGet([...trackIds]);

  const trackMeta: Record<string, TrackStub> = {};
  for (const t of tracks) {
    if (!t) continue;
    trackMeta[t.id] = { title: t.title, artist: t.artist, album: t.album };
  }
  // Preserve any stub already recorded for tracks that are themselves missing locally.
  for (const p of playlists) {
    for (const [id, stub] of Object.entries(p.trackMeta ?? {})) {
      if (!trackMeta[id]) trackMeta[id] = stub;
    }
  }

  return {
    version: 1,
    exportedAt: Date.now(),
    playlists,
    trackMeta,
  };
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  playlistsAdded: number;
  playlistsSkipped: number;
}

/**
 * Imports a previously exported set of playlists. Playlists whose `id`
 * already exists locally are skipped. Track references not present in the
 * local library are kept (unplayable) with a cached title/artist/album so
 * they can still be displayed, sourced from the export's `trackMeta`.
 */
export async function importPlaylists(data: PlaylistExport): Promise<ImportResult> {
  if (data.version !== 1) {
    throw new Error('Unsupported backup file version.');
  }

  let playlistsAdded = 0;
  let playlistsSkipped = 0;

  await db.transaction('rw', db.playlists, db.tracks, async () => {
    for (const playlist of data.playlists) {
      const existing = await db.playlists.get(playlist.id);
      if (existing) {
        playlistsSkipped += 1;
        continue;
      }

      const localTracks = await db.tracks.bulkGet(playlist.trackIds);
      const trackMeta: Record<string, TrackStub> = {};
      playlist.trackIds.forEach((id, i) => {
        if (localTracks[i]) return;
        const stub = data.trackMeta?.[id];
        if (stub) trackMeta[id] = stub;
      });

      await db.playlists.put({ ...playlist, trackMeta });
      playlistsAdded += 1;
    }
  });

  return { playlistsAdded, playlistsSkipped };
}
