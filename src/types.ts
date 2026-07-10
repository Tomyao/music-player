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

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
}

export type RepeatMode = 'off' | 'all' | 'one';

/** Singleton settings/session doc, keyed by a fixed id. */
export interface AppSettings {
  id: 'settings';
  theme: 'light' | 'dark' | 'system';
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
  theme: 'system',
  repeat: 'off',
  shuffle: false,
  volume: 1,
  lastQueue: [],
  lastQueueIndex: -1,
  lastPositionSec: 0,
  queueDrawerOpen: false,
};

/** Shape written by Export and read by Import; audio/artwork blobs are optional. */
export interface LibraryExport {
  version: 1;
  exportedAt: number;
  tracks: Track[];
  playlists: Playlist[];
  /** Present only when the user chose "include audio" on export. */
  blobs?: Array<{ id: string; type: BlobKind; mimeType: string; base64: string }>;
}

export type SortKey = 'title' | 'artist' | 'album' | 'duration' | 'createdAt';
export type SortDir = 'asc' | 'desc';

export interface ToastMessage {
  id: string;
  text: string;
  variant?: 'default' | 'success' | 'error';
}
