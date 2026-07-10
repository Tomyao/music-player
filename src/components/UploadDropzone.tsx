import { useCallback, useRef, useState, type DragEvent } from 'react';
import { UploadCloud } from 'lucide-react';

interface UploadDropzoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

const SUPPORTED_EXTENSIONS = /\.(mp3|m4a)$/i;
const SUPPORTED_MIME_TYPES = new Set(['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/m4a']);

function isSupportedAudioFile(file: File): boolean {
  return SUPPORTED_MIME_TYPES.has(file.type) || SUPPORTED_EXTENSIONS.test(file.name);
}

export function UploadDropzone({ onFiles, disabled }: UploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      const files = Array.from(fileList).filter(isSupportedAudioFile);
      if (files.length) onFiles(files);
    },
    [onFiles],
  );

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      aria-label="Upload MP3 or M4A files: drag and drop or press Enter to browse"
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={onDrop}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        isDragOver ? 'border-accent bg-accent/5' : 'border-border bg-surface/50'
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-accent/60'}`}
    >
      <UploadCloud className="h-10 w-10 text-accent" aria-hidden="true" />
      <div>
        <p className="font-medium text-text">Drop MP3 or M4A files here, or click to browse</p>
        <p className="mt-1 text-sm text-text-muted">
          Metadata and album art are extracted automatically. Duplicate files are skipped.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        // Extension-only: mixing specific MIME types with extensions here
        // makes Windows' file picker fall back to a generic "Custom Files"
        // filter that can hide real files depending on how they're
        // registered. Plain extensions are what the OS reliably recognizes;
        // isSupportedAudioFile() below is the real gatekeeper anyway.
        accept=".mp3,.m4a"
        multiple
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
