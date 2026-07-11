/** A parsed, playable track and its metadata. Audio/artwork bytes live separately in `blobs`. */
export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  /** Duration in seconds. */
  duration: number;
  year?: number;
  genre?: string;
  trackNo?: number;
  /** FK into `blobs` for the embedded/generated cover art, if any. */
  artworkBlobId?: string;
  /** FK into `blobs` for the source audio file. */
  audioBlobId: string;
  /** SHA-256 of the audio bytes, used to dedupe re-imports. */
  contentHash: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: number;
  updatedAt: number;
}

export type BlobKind = 'audio' | 'artwork';

export interface BlobDoc {
  id: string;
  type: BlobKind;
  blob: Blob;
  mimeType: string;
}

/** Minimal display info for a track a playlist references that isn't in the local library. */
export interface TrackStub {
  title: string;
  artist: string;
  album: string;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  /** Display info for entries in `trackIds` not present locally (e.g. after importing a playlist backup). */
  trackMeta?: Record<string, TrackStub>;
  createdAt: number;
  updatedAt: number;
}

export type RepeatMode = 'off' | 'all' | 'one';

/** Singleton settings/session doc, keyed by a fixed id. */
export interface AppSettings {
  id: 'settings';
  theme: 'light' | 'dark';
  repeat: RepeatMode;
  shuffle: boolean;
  volume: number;
  lastQueue: string[];
  lastQueueIndex: number;
  lastPositionSec: number;
  queueDrawerOpen: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'settings',
  theme: 'light',
  repeat: 'off',
  shuffle: false,
  volume: 1,
  lastQueue: [],
  lastQueueIndex: -1,
  lastPositionSec: 0,
  queueDrawerOpen: false,
};

/** Shape written by Export and read by Import. */
export interface PlaylistExport {
  version: 1;
  exportedAt: number;
  playlists: Playlist[];
  /** Display info (title/artist/album) for every track referenced by `playlists`, keyed by track id. */
  trackMeta: Record<string, TrackStub>;
}

export type SortKey = 'title' | 'artist' | 'album' | 'duration' | 'createdAt';
export type SortDir = 'asc' | 'desc';

export interface ToastMessage {
  id: string;
  text: string;
  variant?: 'default' | 'success' | 'error';
}
