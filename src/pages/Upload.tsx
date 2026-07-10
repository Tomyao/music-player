import { useState } from 'react';
import { CheckCircle2, Loader2, XCircle, Sparkles, CopyX } from 'lucide-react';
import { UploadDropzone } from '@/components/UploadDropzone';
import { db } from '@/db/indexedDb';
import { extractMetadata } from '@/lib/id3';
import { hashFile } from '@/lib/hash';
import { isSeedEnabled, seedDemoLibrary } from '@/lib/seed';
import { useToast } from '@/hooks/useToast';
import type { Track } from '@/types';

type FileStatus = 'pending' | 'parsing' | 'done' | 'duplicate' | 'error';

interface UploadItem {
  id: string;
  fileName: string;
  status: FileStatus;
  message?: string;
}

export default function UploadPage() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const { showToast } = useToast();

  const updateItem = (id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const handleFiles = async (files: File[]) => {
    setIsImporting(true);
    const newItems: UploadItem[] = files.map((f) => ({
      id: crypto.randomUUID(),
      fileName: f.name,
      status: 'pending',
    }));
    setItems((prev) => [...newItems, ...prev]);

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const itemId = newItems[i].id;
      updateItem(itemId, { status: 'parsing' });

      try {
        const contentHash = await hashFile(file);
        const existing = await db.tracks.where('contentHash').equals(contentHash).first();
        if (existing) {
          updateItem(itemId, { status: 'duplicate', message: 'Already in your library' });
          skipped += 1;
          continue;
        }

        const meta = await extractMetadata(file);

        const audioBlobId = crypto.randomUUID();
        await db.blobs.put({ id: audioBlobId, type: 'audio', blob: file, mimeType: file.type || 'audio/mpeg' });

        let artworkBlobId: string | undefined;
        if (meta.artwork) {
          artworkBlobId = crypto.randomUUID();
          await db.blobs.put({
            id: artworkBlobId,
            type: 'artwork',
            blob: new Blob([meta.artwork.data as BlobPart], { type: meta.artwork.format }),
            mimeType: meta.artwork.format,
          });
        }

        const now = Date.now();
        const track: Track = {
          id: crypto.randomUUID(),
          title: meta.title,
          artist: meta.artist,
          album: meta.album,
          duration: meta.duration,
          year: meta.year,
          genre: meta.genre,
          trackNo: meta.trackNo,
          artworkBlobId,
          audioBlobId,
          contentHash,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'audio/mpeg',
          createdAt: now,
          updatedAt: now,
        };

        await db.tracks.add(track);
        updateItem(itemId, { status: 'done' });
        imported += 1;
      } catch (err) {
        console.error('[upload] failed to import', file.name, err);
        const message =
          err instanceof DOMException && err.name === 'QuotaExceededError'
            ? 'Storage quota exceeded'
            : 'Could not import this file';
        updateItem(itemId, { status: 'error', message });
        failed += 1;
      }
    }

    setIsImporting(false);
    if (imported) showToast(`Imported ${imported} song${imported === 1 ? '' : 's'}`, 'success');
    if (skipped) showToast(`Skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}`);
    if (failed) showToast(`${failed} file${failed === 1 ? '' : 's'} failed to import`, 'error');
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const count = await seedDemoLibrary();
      showToast(count ? `Added ${count} demo tracks` : 'Demo tracks already loaded');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Upload music</h1>
      <p className="mt-1 text-text-muted">
        Drop in MP3 files to add them to your local library. Everything stays on this device.
      </p>

      <div className="mt-6">
        <UploadDropzone onFiles={handleFiles} disabled={isImporting} />
      </div>

      {isSeedEnabled() && (
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="mt-4 flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-text-muted hover:bg-surface-hover hover:text-text disabled:opacity-50"
        >
          {seeding ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Load demo tracks
        </button>
      )}

      {items.length > 0 && (
        <ul className="mt-8 space-y-1" aria-label="Import progress">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            >
              <StatusIcon status={item.status} />
              <span className="min-w-0 flex-1 truncate">{item.fileName}</span>
              {item.message && <span className="text-xs text-text-muted">{item.message}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: FileStatus }) {
  switch (status) {
    case 'done':
      return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-label="Imported" />;
    case 'duplicate':
      return <CopyX className="h-4 w-4 shrink-0 text-text-muted" aria-label="Duplicate" />;
    case 'error':
      return <XCircle className="h-4 w-4 shrink-0 text-danger" aria-label="Failed" />;
    default:
      return (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" aria-label="Importing" />
      );
  }
}
