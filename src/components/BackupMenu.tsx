import { useEffect, useRef, useState } from 'react';
import { Download, HardDriveDownload, Loader2, Upload } from 'lucide-react';
import { exportPlaylists, downloadJson, importPlaylists } from '@/lib/backup';
import { useToast } from '@/hooks/useToast';
import type { PlaylistExport } from '@/types';

/** Header control for exporting/importing playlists as a JSON backup file. */
export function BackupMenu() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleExport = async () => {
    setBusy(true);
    try {
      const data = await exportPlaylists();
      downloadJson(data, `musique-playlists-${new Date().toISOString().slice(0, 10)}.json`);
      showToast('Playlists backup downloaded', 'success');
    } catch (err) {
      console.error('[backup] export failed', err);
      showToast('Export failed', 'error');
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const handleImportFile = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as PlaylistExport;
      const result = await importPlaylists(data);
      showToast(
        `Imported ${result.playlistsAdded} playlist${result.playlistsAdded === 1 ? '' : 's'}` +
          (result.playlistsSkipped
            ? `, skipped ${result.playlistsSkipped} existing`
            : ''),
        'success',
      );
    } catch (err) {
      console.error('[backup] import failed', err);
      showToast('Import failed — is this a valid backup file?', 'error');
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Backup and restore playlists"
        className="flex w-full items-center justify-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-surface-hover sm:w-auto"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <HardDriveDownload className="h-4 w-4" aria-hidden="true" />
        )}
        Backup/Import
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1 w-64 animate-fade-in rounded-xl border border-border bg-surface p-2 shadow-xl"
        >
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Backup
          </p>
          <button
            role="menuitem"
            disabled={busy}
            onClick={handleExport}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-hover disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export playlists (.json)
          </button>
          <div className="my-1 border-t border-border" />
          <button
            role="menuitem"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-hover disabled:opacity-50"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Import playlists file…
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = '';
            }}
          />
        </div>
      )}
    </div>
  );
}
