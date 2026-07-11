import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/indexedDb';
import type { Playlist, Track, TrackStub } from '@/types';

/** Sentinel distinguishing "still loading" from "query resolved to undefined" (e.g. not found). */
export const LOADING = Symbol('loading');
export type Loading = typeof LOADING;

/** Live-updating list of every track in the library, newest import first. */
export function useTracks(): Track[] | undefined {
  return useLiveQuery(() => db.tracks.orderBy('createdAt').reverse().toArray(), []);
}

/** Live-updating list of every playlist, alphabetical by name. */
export function usePlaylists(): Playlist[] | undefined {
  return useLiveQuery(
    () => db.playlists.toArray().then((all) => all.sort((a, b) => a.name.localeCompare(b.name))),
    [],
  );
}

export function usePlaylist(id: string | undefined): Playlist | undefined | Loading {
  return useLiveQuery(() => (id ? db.playlists.get(id) : undefined), [id], LOADING);
}

export type PlaylistEntry =
  | { status: 'available'; id: string; track: Track }
  | { status: 'missing'; id: string; stub: TrackStub };

/**
 * Resolves a playlist's `trackIds` into full entries, preserving order. Ids
 * that aren't in the local library fall back to the cached `trackMeta` stub
 * (e.g. from an imported backup) so they can still be shown; ids with
 * neither a track nor a stub are dropped.
 */
export function usePlaylistEntries(playlist: Playlist | undefined): PlaylistEntry[] | undefined {
  return useLiveQuery(async () => {
    if (!playlist) return undefined;
    const tracks = await db.tracks.bulkGet(playlist.trackIds);
    const entries: PlaylistEntry[] = [];
    playlist.trackIds.forEach((id, i) => {
      const track = tracks[i];
      if (track) {
        entries.push({ status: 'available', id, track });
        return;
      }
      const stub = playlist.trackMeta?.[id];
      if (stub) entries.push({ status: 'missing', id, stub });
    });
    return entries;
  }, [playlist?.trackIds.join(','), playlist?.trackMeta]);
}

export function useTrack(id: string | undefined): Track | undefined {
  return useLiveQuery(() => (id ? db.tracks.get(id) : undefined), [id]);
}

export function useTracksByIds(ids: string[]): Track[] | undefined {
  const key = ids.join(',');
  return useLiveQuery(async () => {
    const tracks = await db.tracks.bulkGet(ids);
    return tracks.filter((t): t is Track => Boolean(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
