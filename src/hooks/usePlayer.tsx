import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { db, getOrCreateSettings, updateSettings } from '@/db/indexedDb';
import { objectUrlCache } from '@/lib/audio';
import type { RepeatMode, Track } from '@/types';

interface PlayerContextValue {
  queue: string[];
  currentIndex: number;
  currentTrack: Track | undefined;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  repeat: RepeatMode;
  shuffle: boolean;
  queueDrawerOpen: boolean;
  error: string | null;

  /** Replaces the queue with `trackIds` and starts playback at `startIndex`. */
  playNow: (trackIds: string[], startIndex?: number) => void;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  seek: (seconds: number) => void;
  next: () => void;
  prev: () => void;
  setVolume: (v: number) => void;
  setRepeat: (mode: RepeatMode) => void;
  toggleShuffle: () => void;
  toggleQueueDrawer: () => void;

  /** Appends to the end of the queue. */
  enqueue: (trackIds: string[]) => void;
  /** Inserts right after the currently playing track. */
  playNext: (trackIds: string[]) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  /** Empties the queue entirely and stops playback, including the current track. */
  clearQueue: () => void;
  /** Purges every occurrence of `trackId` from the queue, e.g. after it's deleted from the library. */
  removeTrackFromQueue: (trackId: string) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

const POSITION_SAVE_INTERVAL_MS = 5000;

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (!audioRef.current && typeof window !== 'undefined') {
    audioRef.current = new Audio();
    audioRef.current.preload = 'metadata';
  }

  const [queue, setQueue] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [currentTrack, setCurrentTrack] = useState<Track | undefined>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [repeat, setRepeatState] = useState<RepeatMode>('off');
  const [shuffle, setShuffle] = useState(false);
  const [queueDrawerOpen, setQueueDrawerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const historyRef = useRef<number[]>([]);
  const loadedBlobIdRef = useRef<string | null>(null);
  const rafRef = useRef<number>();
  const restoredPositionRef = useRef<number | null>(null);
  const settingsLoadedRef = useRef(false);

  // ---- restore last session on mount ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const settings = await getOrCreateSettings();
      if (cancelled) return;
      setQueue(settings.lastQueue);
      setCurrentIndex(settings.lastQueueIndex);
      setVolumeState(settings.volume);
      setRepeatState(settings.repeat);
      setShuffle(settings.shuffle);
      setQueueDrawerOpen(settings.queueDrawerOpen);
      restoredPositionRef.current = settings.lastPositionSec;
      settingsLoadedRef.current = true;
      if (audioRef.current) audioRef.current.volume = settings.volume;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- load whichever track `currentIndex` points to ----
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const trackId = queue[currentIndex];

    if (!trackId) {
      audio.pause();
      audio.removeAttribute('src');
      setCurrentTrack(undefined);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      const track = await db.tracks.get(trackId);
      if (cancelled) return;
      if (!track) {
        setError('This track is no longer in your library.');
        setIsLoading(false);
        return;
      }
      setCurrentTrack(track);

      const audioDoc = await db.blobs.get(track.audioBlobId);
      if (cancelled) return;
      if (!audioDoc) {
        setError('Audio data for this track is missing.');
        setIsLoading(false);
        return;
      }

      if (loadedBlobIdRef.current) objectUrlCache.release(loadedBlobIdRef.current);
      const url = objectUrlCache.acquire(audioDoc.id, audioDoc.blob);
      loadedBlobIdRef.current = audioDoc.id;

      audio.src = url;
      const resumeAt = restoredPositionRef.current;
      restoredPositionRef.current = null;
      if (resumeAt && resumeAt > 0) audio.currentTime = resumeAt;

      setDuration(track.duration);
      setIsLoading(false);
      updateMediaSession(track);

      if (isPlaying) {
        audio.play().catch(() => setIsPlaying(false));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();

    return () => {
      cancelled = true;
    };
    // isPlaying intentionally excluded: this effect only reacts to track changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, currentIndex]);

  useEffect(() => {
    return () => {
      if (loadedBlobIdRef.current) objectUrlCache.release(loadedBlobIdRef.current);
    };
  }, []);

  // ---- smooth scrubbing via rAF while playing ----
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isPlaying) return;

    const tick = () => {
      setCurrentTime(audio.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  // NOTE: deliberately does not use the `setState(prev => ...)` functional form
  // for anything with a side effect (ref mutation, audio.play(), etc). React 18
  // Strict Mode double-invokes functional updaters in dev to catch impurity —
  // an earlier version nested setCurrentIndex (and side effects) inside a
  // setQueue updater here, which under that double-invoke skipped a track
  // every time playback advanced. Reading `queue`/`currentIndex` from the
  // closure and calling setCurrentIndex with a plain value avoids that.
  const advance = useCallback(
    (fromEnded: boolean) => {
      if (queue.length === 0) return;

      if (fromEnded && repeat === 'one') {
        const audio = audioRef.current;
        if (audio) {
          audio.currentTime = 0;
          audio.play().catch(() => setIsPlaying(false));
        }
        return;
      }

      let nextIndex: number;
      if (shuffle && queue.length > 1) {
        do {
          nextIndex = Math.floor(Math.random() * queue.length);
        } while (nextIndex === currentIndex);
      } else {
        nextIndex = currentIndex + 1;
        if (nextIndex >= queue.length) {
          if (repeat === 'all') {
            nextIndex = 0;
          } else {
            setIsPlaying(false);
            return; // reached the end with no repeat; stay on the last track
          }
        }
      }

      // The <audio> element fires a native `pause` event immediately before
      // `ended` when a track finishes naturally, which sets isPlaying(false)
      // just ahead of this call (React 18 batches both into the same render).
      // Without correcting it here, the next track's load effect would read
      // that stale `isPlaying` and never call audio.play(). Manual next()
      // (fromEnded=false) has no such race, so it's left alone — skipping
      // to the next track while paused should stay paused.
      if (fromEnded) setIsPlaying(true);

      historyRef.current.push(currentIndex);
      setCurrentIndex(nextIndex);
    },
    [repeat, shuffle, queue, currentIndex],
  );

  // ---- native <audio> event wiring ----
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => advance(true);
    const onLoadedMeta = () => setDuration(audio.duration || 0);
    const onError = () => {
      setError('Playback failed — the file may be corrupted.');
      setIsLoading(false);
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadedmetadata', onLoadedMeta);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadedmetadata', onLoadedMeta);
      audio.removeEventListener('error', onError);
    };
  }, [advance]);

  // ---- persist session (debounced-ish via interval + key events) ----
  const persist = useCallback(() => {
    if (!settingsLoadedRef.current) return;
    void updateSettings({
      lastQueue: queue,
      lastQueueIndex: currentIndex,
      lastPositionSec: audioRef.current?.currentTime ?? 0,
      repeat,
      shuffle,
      volume,
      queueDrawerOpen,
    });
  }, [queue, currentIndex, repeat, shuffle, volume, queueDrawerOpen]);

  useEffect(() => {
    persist();
  }, [queue, currentIndex, repeat, shuffle, volume, queueDrawerOpen, persist]);

  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(persist, POSITION_SAVE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isPlaying, persist]);

  useEffect(() => {
    const onUnload = () => persist();
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [persist]);

  // ---- Media Session API ----
  function updateMediaSession(track: Track) {
    if (!('mediaSession' in navigator)) return;
    (async () => {
      let artwork: MediaImage[] = [];
      if (track.artworkBlobId) {
        const doc = await db.blobs.get(track.artworkBlobId);
        if (doc) {
          const url = objectUrlCache.acquire(`ms-${doc.id}`, doc.blob);
          artwork = [{ src: url, sizes: '512x512', type: doc.mimeType }];
        }
      }
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album,
        artwork,
      });
    })();
  }

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const audio = audioRef.current;
    if (!audio) return;

    navigator.mediaSession.setActionHandler('play', () => resume());
    navigator.mediaSession.setActionHandler('pause', () => pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => prev());
    navigator.mediaSession.setActionHandler('nexttrack', () => next());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) seek(details.seekTime);
    });
    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
      navigator.mediaSession.setActionHandler('seekto', null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, currentIndex, repeat, shuffle]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  // ---- public actions ----
  const playNow = useCallback((trackIds: string[], startIndex = 0) => {
    historyRef.current = [];
    setQueue(trackIds);
    setCurrentIndex(startIndex);
    setIsPlaying(true);
  }, []);

  const resume = useCallback(() => {
    audioRef.current?.play().catch(() => setIsPlaying(false));
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
      return;
    }
    // Queue has tracks (e.g. from "Add to queue") but nothing has been
    // started yet — jump to the first track instead of trying to resume
    // an <audio> element that was never given a src.
    if (currentIndex < 0 && queue.length > 0) {
      setCurrentIndex(0);
      setIsPlaying(true);
      return;
    }
    resume();
  }, [isPlaying, pause, resume, currentIndex, queue]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setCurrentTime(seconds);
  }, []);

  const next = useCallback(() => advance(false), [advance]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const prevIndex = historyRef.current.pop();
    setCurrentIndex((idx) => {
      if (prevIndex != null) return prevIndex;
      return Math.max(0, idx - 1);
    });
    setIsPlaying(true);
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
  }, []);

  const setRepeat = useCallback((mode: RepeatMode) => setRepeatState(mode), []);
  const toggleShuffleFn = useCallback(() => setShuffle((s) => !s), []);
  const toggleQueueDrawer = useCallback(() => setQueueDrawerOpen((o) => !o), []);

  const enqueue = useCallback((trackIds: string[]) => {
    setQueue((q) => [...q, ...trackIds]);
  }, []);

  const playNextFn = useCallback((trackIds: string[]) => {
    setQueue((q) => {
      if (q.length === 0) return trackIds;
      const insertAt = currentIndex + 1;
      return [...q.slice(0, insertAt), ...trackIds, ...q.slice(insertAt)];
    });
  }, [currentIndex]);

  const removeFromQueue = useCallback(
    (index: number) => {
      setQueue((q) => q.filter((_, i) => i !== index));
      setCurrentIndex((idx) => {
        if (index === idx) return idx; // current track effect handles reload via queue change
        if (index < idx) return idx - 1;
        return idx;
      });
    },
    [],
  );

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue((q) => {
      const copy = [...q];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
    setCurrentIndex((idx) => {
      if (fromIndex === idx) return toIndex;
      if (fromIndex < idx && toIndex >= idx) return idx - 1;
      if (fromIndex > idx && toIndex <= idx) return idx + 1;
      return idx;
    });
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setCurrentIndex(-1);
    historyRef.current = [];
  }, []);

  const removeTrackFromQueue = useCallback(
    (trackId: string) => {
      if (!queue.includes(trackId)) return; // no-op: don't touch state / reload whatever's playing
      const currentId = queue[currentIndex];
      const filtered = queue.filter((id) => id !== trackId);

      let newIndex: number;
      if (filtered.length === 0) {
        newIndex = -1;
      } else if (currentId === trackId) {
        newIndex = Math.min(currentIndex, filtered.length - 1);
      } else {
        const idx = filtered.indexOf(currentId);
        newIndex = idx === -1 ? Math.min(currentIndex, filtered.length - 1) : idx;
      }

      // indices in the back/forward history no longer line up after a removal
      historyRef.current = [];
      setQueue(filtered);
      setCurrentIndex(newIndex);
    },
    [queue, currentIndex],
  );

  const value = useMemo<PlayerContextValue>(
    () => ({
      queue,
      currentIndex,
      currentTrack,
      isPlaying,
      isLoading,
      currentTime,
      duration,
      volume,
      repeat,
      shuffle,
      queueDrawerOpen,
      error,
      playNow,
      togglePlay,
      pause,
      resume,
      seek,
      next,
      prev,
      setVolume,
      setRepeat,
      toggleShuffle: toggleShuffleFn,
      toggleQueueDrawer,
      enqueue,
      playNext: playNextFn,
      removeFromQueue,
      reorderQueue,
      clearQueue,
      removeTrackFromQueue,
    }),
    [
      queue,
      currentIndex,
      currentTrack,
      isPlaying,
      isLoading,
      currentTime,
      duration,
      volume,
      repeat,
      shuffle,
      queueDrawerOpen,
      error,
      playNow,
      togglePlay,
      pause,
      resume,
      seek,
      next,
      prev,
      setVolume,
      setRepeat,
      toggleShuffleFn,
      toggleQueueDrawer,
      enqueue,
      playNextFn,
      removeFromQueue,
      reorderQueue,
      clearQueue,
      removeTrackFromQueue,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within a PlayerProvider');
  return ctx;
}
