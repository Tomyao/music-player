import { db } from '@/db/indexedDb';
import type { LibraryExport } from '@/types';

/** Converts an ArrayBuffer to base64 in chunks so large audio files don't blow the call stack. */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

/**
 * Exports the library as a JSON document. Metadata (tracks/playlists) is
 * always included; audio/artwork bytes are only embedded (base64) when
 * `includeBlobs` is set, since that can make the file very large.
 */
export async function exportLibrary(includeBlobs: boolean): Promise<LibraryExport> {
  const [tracks, playlists] = await Promise.all([
    db.tracks.toArray(),
    db.playlists.toArray(),
  ]);

  const payload: LibraryExport = {
    version: 1,
    exportedAt: Date.now(),
    tracks,
    playlists,
  };

  if (includeBlobs) {
    const blobIds = new Set<string>();
    for (const t of tracks) {
      blobIds.add(t.audioBlobId);
      if (t.artworkBlobId) blobIds.add(t.artworkBlobId);
    }
    const docs = await db.blobs.bulkGet([...blobIds]);
    payload.blobs = [];
    for (const doc of docs) {
      if (!doc) continue;
      const buffer = await doc.blob.arrayBuffer();
      payload.blobs.push({
        id: doc.id,
        type: doc.type,
        mimeType: doc.mimeType,
        base64: bufferToBase64(buffer),
      });
    }
  }

  return payload;
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
  tracksAdded: number;
  tracksSkipped: number;
  playlistsAdded: number;
}

/**
 * Imports a previously exported library. Tracks are matched/deduped by
 * `contentHash`; tracks whose audio blob wasn't included in the export are
 * kept as metadata-only rows if a matching hash isn't already present (they
 * simply won't be playable until the same file is re-uploaded).
 */
export async function importLibrary(data: LibraryExport): Promise<ImportResult> {
  if (data.version !== 1) {
    throw new Error('Unsupported backup file version.');
  }

  const blobMap = new Map(data.blobs?.map((b) => [b.id, b]) ?? []);
  const existingHashes = new Set((await db.tracks.toArray()).map((t) => t.contentHash));

  let tracksAdded = 0;
  let tracksSkipped = 0;
  let playlistsAdded = 0;

  await db.transaction('rw', db.tracks, db.blobs, db.playlists, async () => {
    for (const track of data.tracks) {
      if (existingHashes.has(track.contentHash)) {
        tracksSkipped += 1;
        continue;
      }

      const audioDoc = blobMap.get(track.audioBlobId);
      if (audioDoc) {
        await db.blobs.put({
          id: audioDoc.id,
          type: audioDoc.type,
          mimeType: audioDoc.mimeType,
          blob: base64ToBlob(audioDoc.base64, audioDoc.mimeType),
        });
      }

      if (track.artworkBlobId) {
        const artDoc = blobMap.get(track.artworkBlobId);
        if (artDoc) {
          await db.blobs.put({
            id: artDoc.id,
            type: artDoc.type,
            mimeType: artDoc.mimeType,
            blob: base64ToBlob(artDoc.base64, artDoc.mimeType),
          });
        }
      }

      await db.tracks.put(track);
      existingHashes.add(track.contentHash);
      tracksAdded += 1;
    }

    for (const playlist of data.playlists) {
      const existing = await db.playlists.get(playlist.id);
      if (existing) continue;
      await db.playlists.put(playlist);
      playlistsAdded += 1;
    }
  });

  return { tracksAdded, tracksSkipped, playlistsAdded };
}
