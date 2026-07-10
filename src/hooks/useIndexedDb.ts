import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/indexedDb';
import type { Playlist, Track } from '@/types';

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

/** Resolves a playlist's `trackIds` into full Track docs, preserving order and dropping any that were deleted. */
export function usePlaylistTracks(playlist: Playlist | undefined): Track[] | undefined {
  return useLiveQuery(async () => {
    if (!playlist) return undefined;
    const tracks = await db.tracks.bulkGet(playlist.trackIds);
    return tracks.filter((t): t is Track => Boolean(t));
  }, [playlist?.trackIds.join(',')]);
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
