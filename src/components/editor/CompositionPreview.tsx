"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  findClipAtTime,
  getTimelineDuration,
  getTrack,
  timelineToSourceTime,
} from "@/lib/playbackOps";
import { usePlaybackStore } from "@/store/playbackStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

/** Phase 4 scope: these two tracks drive the preview. */
const VIDEO_TRACK_ID = "track_v1";
const AUDIO_TRACK_ID = "track_a1";

/** While playing, allow more drift so we don't thrash seeks (looks "stuck"). */
const SEEK_EPSILON_PLAYING = 0.35;
/** When paused / scrubbing, stay tighter. */
const SEEK_EPSILON_PAUSED = 0.05;

/**
 * Composition monitor: playhead drives <video> + <audio> from timeline JSON.
 */
export function CompositionPreview() {
  const [mediaReady, setMediaReady] = useState(false);
  const [playHint, setPlayHint] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastAssetId = useRef<{ video: string | null; audio: string | null }>({
    video: null,
    audio: null,
  });

  const timeline = useWorkspaceStore((s) => s.getActiveVersion()?.timeline);
  const assets = useWorkspaceStore((s) => s.workspace.assets);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const setCurrentTime = usePlaybackStore((s) => s.setCurrentTime);
  const play = usePlaybackStore((s) => s.play);
  const pause = usePlaybackStore((s) => s.pause);

  const duration = timeline ? getTimelineDuration(timeline) : 0;

  useEffect(() => {
    setMediaReady(true);
  }, []);

  // --- rAF clock: advance playhead while playing ---
  useEffect(() => {
    if (!isPlaying) return;

    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const next = usePlaybackStore.getState().currentTime + dt;
      const dur = timeline ? getTimelineDuration(timeline) : 0;

      if (dur > 0 && next >= dur) {
        setCurrentTime(dur);
        pause();
        return;
      }
      setCurrentTime(next);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, timeline, setCurrentTime, pause]);

  // --- Sync HTML5 elements to playhead (1 video + 1 audio track) ---
  useEffect(() => {
    if (!timeline || !mediaReady) return;

    const videoTrack = getTrack(timeline, VIDEO_TRACK_ID);
    const audioTrack = getTrack(timeline, AUDIO_TRACK_ID);
    const vClip = findClipAtTime(videoTrack, currentTime);
    const aClip = findClipAtTime(audioTrack, currentTime);

    syncElement({
      el: videoRef.current,
      clip: vClip,
      kind: "video",
      currentTime,
      isPlaying,
      assets,
      lastAssetId,
    });

    syncElement({
      el: audioRef.current,
      clip: aClip,
      kind: "audio",
      currentTime,
      isPlaying,
      assets,
      lastAssetId,
    });
  }, [timeline, currentTime, isPlaying, assets, mediaReady]);

  const handlePlay = () => {
    setPlayHint(null);
    if (currentTime >= duration && duration > 0) setCurrentTime(0);
    play();

    // Unlock media inside the user gesture (browsers block unmuted autoplay otherwise).
    const kick = (el: HTMLMediaElement | null) => {
      if (!el || !el.src) return;
      void el.play().catch((err: unknown) => {
        const name = err instanceof Error ? err.name : "";
        if (name === "NotAllowedError") {
          setPlayHint("Click Play again — browser blocked audio/video start");
        }
      });
    };
    kick(videoRef.current);
    kick(audioRef.current);
  };

  return (
    <section className="flex h-full flex-col bg-black">
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-3 py-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Preview
        </h2>
        <span className="text-[10px] text-zinc-500">Your cut · live</span>
      </header>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
        {mediaReady ? (
          <>
            <video
              ref={videoRef}
              className="max-h-full max-w-full rounded"
              playsInline
              preload="auto"
              suppressHydrationWarning
            />
            <audio ref={audioRef} preload="auto" suppressHydrationWarning />
          </>
        ) : null}
        {!timeline || duration === 0 ? (
          <p className="pointer-events-none absolute text-sm text-zinc-500">
            Add clips to the timeline, then press Play
          </p>
        ) : null}
        {playHint ? (
          <p className="pointer-events-none absolute bottom-3 left-3 right-3 text-center text-xs text-amber-400">
            {playHint}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-zinc-800 bg-zinc-950 px-3 py-2">
        <button
          type="button"
          onClick={handlePlay}
          disabled={isPlaying || duration <= 0}
          className="rounded bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Play
        </button>
        <button
          type="button"
          onClick={pause}
          disabled={!isPlaying}
          className="rounded bg-amber-400 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Pause
        </button>
        <button
          type="button"
          onClick={() => {
            pause();
            setCurrentTime(0);
            setPlayHint(null);
          }}
          className="rounded border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-400"
        >
          Stop
        </button>
        <span className="ml-2 font-mono text-xs text-zinc-400">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </section>
  );
}

function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${m}:${rem.toFixed(1).padStart(4, "0")}`;
}

function syncElement({
  el,
  clip,
  kind,
  currentTime,
  isPlaying,
  assets,
  lastAssetId,
}: {
  el: HTMLVideoElement | HTMLAudioElement | null;
  clip: ReturnType<typeof findClipAtTime>;
  kind: "video" | "audio";
  currentTime: number;
  isPlaying: boolean;
  assets: { id: string; objectUrl: string }[];
  lastAssetId: MutableRefObject<{
    video: string | null;
    audio: string | null;
  }>;
}) {
  if (!el) return;

  if (!clip) {
    if (!el.paused) el.pause();
    return;
  }

  const asset = assets.find((a) => a.id === clip.assetId);
  if (!asset) {
    if (!el.paused) el.pause();
    return;
  }

  const sourceTime = timelineToSourceTime(clip, currentTime);
  const assetChanged = lastAssetId.current[kind] !== asset.id;

  if (assetChanged) {
    lastAssetId.current[kind] = asset.id;
    el.src = asset.objectUrl;
    el.load();

    const onMeta = () => {
      safeSeek(el, sourceTime);
      if (usePlaybackStore.getState().isPlaying) {
        void el.play().catch(() => {
          /* gesture / not ready — Play button will unlock */
        });
      }
    };
    el.addEventListener("loadedmetadata", onMeta, { once: true });
    return;
  }

  // Only seek when we have metadata and drift is large enough.
  if (el.readyState >= 1) {
    const epsilon = isPlaying ? SEEK_EPSILON_PLAYING : SEEK_EPSILON_PAUSED;
    if (Math.abs(el.currentTime - sourceTime) > epsilon) {
      safeSeek(el, sourceTime);
    }
  }

  if (isPlaying) {
    if (el.paused && el.readyState >= 2) {
      void el.play().catch(() => {
        /* Play button handles unlock */
      });
    }
  } else if (!el.paused) {
    el.pause();
  }
}

function safeSeek(el: HTMLMediaElement, time: number) {
  try {
    el.currentTime = Math.max(0, time);
  } catch {
    // Not seekable yet
  }
}
