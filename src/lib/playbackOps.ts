import type { Timeline, TimelineClip, Track } from "@/types/timeline";

export function clipDuration(clip: TimelineClip): number {
  return Math.max(0, clip.trimEnd - clip.trimStart);
}

/** Clip end time on the timeline (seconds). */
export function clipTimelineEnd(clip: TimelineClip): number {
  return clip.timelineStart + clipDuration(clip);
}

/** Longest end among all clips — used to stop playback. */
export function getTimelineDuration(timeline: Timeline): number {
  let max = 0;
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      max = Math.max(max, clipTimelineEnd(clip));
    }
  }
  return max;
}

/**
 * Which clip is under the playhead on a track?
 * First match if overlaps (v1: no stacking resolve).
 */
export function findClipAtTime(
  track: Track | undefined,
  time: number
): TimelineClip | null {
  if (!track) return null;
  for (const clip of track.clips) {
    const end = clipTimelineEnd(clip);
    if (time >= clip.timelineStart && time < end) {
      return clip;
    }
  }
  return null;
}

/**
 * Map timeline playhead → source media time inside the clip.
 * Example: clip starts at 2s, trimStart 5s, playhead 3s → source 6s.
 */
export function timelineToSourceTime(
  clip: TimelineClip,
  timelineTime: number
): number {
  const offset = timelineTime - clip.timelineStart;
  return clip.trimStart + offset;
}

export function getTrack(
  timeline: Timeline,
  trackId: string
): Track | undefined {
  return timeline.tracks.find((t) => t.id === trackId);
}
