"use client";

import { create } from "zustand";

/**
 * Playhead state — separate from workspace so timeline edits
 * don't mix with "where is the cursor right now".
 */
interface PlaybackState {
  /** Seconds on the timeline */
  currentTime: number;
  isPlaying: boolean;

  setCurrentTime: (t: number) => void;
  seek: (t: number) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  currentTime: 0,
  isPlaying: false,

  setCurrentTime: (t) => set({ currentTime: Math.max(0, t) }),

  seek: (t) => set({ currentTime: Math.max(0, t), isPlaying: false }),

  play: () => set({ isPlaying: true }),

  pause: () => set({ isPlaying: false }),

  toggle: () => {
    const { isPlaying } = get();
    set({ isPlaying: !isPlaying });
  },
}));
