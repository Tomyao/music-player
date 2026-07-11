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

function shuffleArray<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Filters `trackIds` down to ones not already in `queue`, also collapsing duplicates within `trackIds` itself. */
function dedupeAgainstQueue(queue: string[], trackIds: string[]): string[] {
  const seen = new Set(queue);
  const toAdd: string[] = [];
  for (const id of trackIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    toAdd.push(id);
  }
  return toAdd;
}

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
  /** Shuffles the not-yet-played queue in place (visible in the Queue panel); reverts it on toggling off. */
  toggleShuffle: () => void;
  toggleQueueDrawer: () => void;

  /**
   * Appends to the queue; scattered at random positions among the not-yet-played
   * tracks when shuffle is on. Tracks already in the queue are skipped (no
   * duplicates); returns how many were actually added.
   */
  enqueue: (trackIds: string[]) => number;
  /**
   * Inserts right after the currently playing track. Tracks already
   * elsewhere in the queue are moved rather than duplicated; the currently
   * playing track itself is left alone. Returns how many were placed.
   */
  playNext: (trackIds: string[]) => number;
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
  // Remembers the not-yet-played tail's order from just before shuffle was
  // turned on, so turning it off can restore it. Cleared once restored.
  const preShuffleTailRef = useRef<string[] | null>(null);
  const loadedBlobIdRef = useRef<string | null>(null);
  const rafRef = useRef<number>();
  const restoredPositionRef = useRef<number | null>(null);
  const settingsLoadedRef = useRef(false);
  // `audio.currentTime` can transiently still report the *previous*
  // resource's position for a moment after `audio.src` is reassigned, until
  // the browser actually finishes loading the new one — reading it during
  // that window paired it with the new track's duration and briefly clamped
  // the seek bar to the end. Only trust reads once 'loadedmetadata' has
  // fired for the current resource.
  const audioReadyRef = useRef(false);

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
  // Keyed on the track id itself (not `queue`/`currentIndex`) so that queue
  // edits which don't move the currently-playing track — reordering,
  // enqueueing, "Play next" relocating other songs — don't reset audio.src
  // and restart playback of whatever's already playing.
  const currentTrackId = queue[currentIndex];
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const trackId = currentTrackId;

    audioReadyRef.current = false;

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
    // Reset immediately, not just when the new track's metadata arrives —
    // otherwise the seek bar briefly pairs the previous track's leftover
    // currentTime with the new (often shorter) track's duration, which can
    // clamp the thumb to the far end for a frame before it corrects to 0.
    setCurrentTime(0);

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
      else audio.currentTime = 0;

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
  }, [currentTrackId]);

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
      if (audioReadyRef.current) setCurrentTime(audio.currentTime);
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

      // Shuffle reorders the queue itself (see toggleShuffle) rather than
      // picking a random index each time, so the Queue panel always shows
      // the real upcoming order — advancing is just "next slot" either way.
      let nextIndex = currentIndex + 1;
      let reshuffled: string[] | null = null;
      if (nextIndex >= queue.length) {
        if (repeat === 'all') {
          nextIndex = 0;
          if (shuffle && queue.length > 1) {
            // Starting a new lap: re-shuffle so it doesn't replay in the same
            // order every time, and avoid immediately repeating the track
            // that just finished. Only remember this as "the original order"
            // if nothing was captured yet (e.g. session restored mid-shuffle)
            // — otherwise this would clobber the true pre-shuffle order with
            // an already-shuffled one, and turning shuffle off later would
            // "revert" to the wrong order.
            if (!preShuffleTailRef.current) preShuffleTailRef.current = queue;
            reshuffled = shuffleArray(queue);
            if (reshuffled[0] === queue[currentIndex]) {
              const swapWith = 1 + Math.floor(Math.random() * (reshuffled.length - 1));
              [reshuffled[0], reshuffled[swapWith]] = [reshuffled[swapWith], reshuffled[0]];
            }
          }
        } else if (fromEnded) {
          // The track finished naturally and there's nowhere to go with no
          // repeat — let it actually stop. currentTrackId won't change here,
          // so the "load track" effect won't rerun to pause <audio> for us.
          audioRef.current?.pause();
          setIsPlaying(false);
          return;
        } else {
          // Manual "next" click on the last track with no repeat: nothing
          // to advance to, so leave playback exactly as it was rather than
          // pausing (or "unpausing") whatever's currently happening.
          return;
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
      if (reshuffled) setQueue(reshuffled);
      setCurrentIndex(nextIndex);
    },
    [repeat, queue, currentIndex, shuffle],
  );

  // ---- native <audio> event wiring ----
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => advance(true);
    const onLoadedMeta = () => {
      audioReadyRef.current = true;
      setDuration(audio.duration || 0);
    };
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
  const playNow = useCallback(
    (trackIds: string[], startIndex?: number) => {
      historyRef.current = [];
      preShuffleTailRef.current = null;

      let finalQueue: string[];
      let finalIndex: number;

      if (shuffle && startIndex === undefined) {
        // "Play all" / "play this playlist": no specific track was
        // requested, so shuffle the whole list — including which track
        // starts — rather than always starting on the first item in list
        // order. The original order is remembered so turning shuffle off
        // can restore it.
        preShuffleTailRef.current = trackIds;
        finalQueue = shuffleArray(trackIds);
        finalIndex = 0;
      } else {
        const resolvedStart = startIndex ?? 0;
        if (shuffle) {
          // A specific track was requested (e.g. jumping to one in the Up
          // Next list) — keep it in place and only shuffle what follows.
          const played = trackIds.slice(0, resolvedStart + 1);
          const tail = trackIds.slice(resolvedStart + 1);
          preShuffleTailRef.current = tail;
          finalQueue = [...played, ...shuffleArray(tail)];
        } else {
          finalQueue = trackIds;
        }
        finalIndex = resolvedStart;
      }

      setQueue(finalQueue);
      setCurrentIndex(finalIndex);
      setIsPlaying(true);

      // The "load track" effect only calls audio.play() when the current
      // track id actually changes (it's keyed on that id). If the track
      // we're starting on is already the one loaded — e.g. it was paused
      // and this "Play all" happens to land back on it — that effect won't
      // rerun, so nothing would ever tell <audio> to actually play, leaving
      // isPlaying stuck at true with the element still paused. Kick it off
      // directly here, restarting from the top like a fresh play should.
      const startingTrackId = finalQueue[finalIndex];
      if (startingTrackId && startingTrackId === currentTrack?.id) {
        const audio = audioRef.current;
        if (audio) {
          audio.currentTime = 0;
          setCurrentTime(0);
          audio.play().catch(() => setIsPlaying(false));
        }
      }
    },
    [shuffle, currentTrack],
  );

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
      // Also covers a track that just ended naturally (repeat off): it sits
      // paused with currentTime at/near its duration, so "prev" here should
      // restart and actually play it, not just silently rewind a paused
      // element back to 0.
      audio.currentTime = 0;
      setCurrentTime(0);
      audio.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
      return;
    }

    const prevIndex = historyRef.current.pop();
    const targetIndex = prevIndex ?? Math.max(0, currentIndex - 1);

    if (targetIndex === currentIndex) {
      // No history and already at the first track — restart it instead of
      // doing nothing. currentTrackId won't change here, so the "load
      // track" effect won't rerun to call audio.play() for us; without
      // this, isPlaying(true) would show a Pause icon over audio that
      // never actually started.
      if (audio) {
        audio.currentTime = 0;
        setCurrentTime(0);
        audio.play().catch(() => setIsPlaying(false));
      }
      setIsPlaying(true);
      return;
    }

    setCurrentIndex(targetIndex);
    setIsPlaying(true);
  }, [currentIndex]);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
  }, []);

  const setRepeat = useCallback((mode: RepeatMode) => setRepeatState(mode), []);

  const toggleShuffleFn = useCallback(() => {
    const turningOn = !shuffle;
    setShuffle(turningOn);

    const played = queue.slice(0, currentIndex + 1);
    const tail = queue.slice(currentIndex + 1);
    if (tail.length === 0) return;

    if (turningOn) {
      preShuffleTailRef.current = tail;
      setQueue([...played, ...shuffleArray(tail)]);
    } else {
      const original = preShuffleTailRef.current ?? [];
      preShuffleTailRef.current = null;
      // Restore tracks that were part of the pre-shuffle tail to their
      // original order; anything queued after shuffling had no "original"
      // position, so it's kept, appended at the end.
      const pool = [...tail];
      const restored: string[] = [];
      for (const id of original) {
        const idx = pool.indexOf(id);
        if (idx !== -1) {
          restored.push(id);
          pool.splice(idx, 1);
        }
      }
      setQueue([...played, ...restored, ...pool]);
    }
  }, [shuffle, queue, currentIndex]);

  const toggleQueueDrawer = useCallback(() => setQueueDrawerOpen((o) => !o), []);

  const enqueue = useCallback(
    (trackIds: string[]) => {
      const toAdd = dedupeAgainstQueue(queue, trackIds);
      if (toAdd.length === 0) return 0;

      if (!shuffle) {
        setQueue([...queue, ...toAdd]);
      } else {
        // Scatter new tracks randomly among the not-yet-played tail instead
        // of always tacking them onto the end, matching shuffled playback.
        const result = [...queue];
        for (const id of toAdd) {
          const minIndex = currentIndex + 1;
          const insertAt = minIndex + Math.floor(Math.random() * (result.length - minIndex + 1));
          result.splice(insertAt, 0, id);
        }
        setQueue(result);
      }
      return toAdd.length;
    },
    [queue, shuffle, currentIndex],
  );

  const playNextFn = useCallback(
    (trackIds: string[]) => {
      const currentId = currentIndex >= 0 ? queue[currentIndex] : undefined;

      // De-dupe the incoming list itself, and drop the currently-playing
      // track — it can't also be "next".
      const seen = new Set<string>();
      const targets: string[] = [];
      for (const id of trackIds) {
        if (id === currentId || seen.has(id)) continue;
        seen.add(id);
        targets.push(id);
      }
      if (targets.length === 0) return 0;

      // Pull any of the targets out of wherever they already sit in the
      // queue — including before the current track — so "Play next" moves
      // them rather than leaving a stale duplicate behind. Track how many
      // were removed from ahead of currentIndex so it still points at the
      // same actual track once they're gone.
      const targetSet = new Set(targets);
      let removedBeforeCurrent = 0;
      const remaining: string[] = [];
      queue.forEach((id, i) => {
        if (targetSet.has(id)) {
          if (i < currentIndex) removedBeforeCurrent += 1;
          return;
        }
        remaining.push(id);
      });

      const newCurrentIndex = currentIndex - removedBeforeCurrent;
      const insertAt = newCurrentIndex + 1;
      setQueue([...remaining.slice(0, insertAt), ...targets, ...remaining.slice(insertAt)]);
      if (newCurrentIndex !== currentIndex) setCurrentIndex(newCurrentIndex);
      return targets.length;
    },
    [queue, currentIndex],
  );

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
