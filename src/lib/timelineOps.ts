import { createId } from "@/lib/id";
import { MIN_CLIP_SECONDS } from "@/lib/timelineConstants";
import type { Timeline, TimelineClip } from "@/types/timeline";

function clipDuration(clip: TimelineClip): number {
  return Math.max(0, clip.trimEnd - clip.trimStart);
}

/** Move a clip in time and/or to another track. Pure JSON transform. */
export function moveClipInTimeline(
  timeline: Timeline,
  clipId: string,
  next: { timelineStart: number; trackId?: string }
): Timeline {
  const timelineStart = Math.max(0, next.timelineStart);

  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => {
      const without = track.clips.filter((c) => c.id !== clipId);
      const moving = track.clips.find((c) => c.id === clipId);

      // Clip leaves this track
      if (moving && next.trackId && next.trackId !== track.id) {
        return { ...track, clips: without };
      }

      // Clip stays / lands on this track
      if (moving && (!next.trackId || next.trackId === track.id)) {
        return {
          ...track,
          clips: track.clips.map((c) =>
            c.id === clipId ? { ...c, timelineStart } : c
          ),
        };
      }

      // Clip arrives from another track
      if (!moving && next.trackId === track.id) {
        const from = findClip(timeline, clipId);
        if (!from) return track;
        const arrived: TimelineClip = {
          ...from.clip,
          trackId: track.id,
          timelineStart,
        };
        return { ...track, clips: [...without, arrived] };
      }

      return track;
    }),
  };
}

function findClip(
  timeline: Timeline,
  clipId: string
): { trackId: string; clip: TimelineClip } | null {
  for (const track of timeline.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { trackId: track.id, clip };
  }
  return null;
}

/**
 * Split one clip into two at an absolute timeline time.
 * Same assetId; trims adjusted. Returns null if split point is invalid.
 */
export function splitClipInTimeline(
  timeline: Timeline,
  clipId: string,
  splitAtTimelineTime: number
): Timeline | null {
  const found = findClip(timeline, clipId);
  if (!found) return null;

  const { clip } = found;
  const dur = clipDuration(clip);
  const offset = splitAtTimelineTime - clip.timelineStart;

  if (offset < MIN_CLIP_SECONDS || offset > dur - MIN_CLIP_SECONDS) {
    return null;
  }

  const left: TimelineClip = {
    ...clip,
    trimEnd: clip.trimStart + offset,
  };

  const right: TimelineClip = {
    ...clip,
    id: createId("clip"),
    timelineStart: clip.timelineStart + offset,
    trimStart: clip.trimStart + offset,
    // trimEnd unchanged
  };

  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => {
      if (track.id !== found.trackId) return track;
      return {
        ...track,
        clips: track.clips.flatMap((c) =>
          c.id === clipId ? [left, right] : [c]
        ),
      };
    }),
  };
}

/** Remove a clip from the timeline (media asset stays in the library). */
export function removeClipFromTimeline(
  timeline: Timeline,
  clipId: string
): Timeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => ({
      ...track,
      clips: track.clips.filter((c) => c.id !== clipId),
    })),
  };
}

/** Next free timelineStart on a track (end of last clip). */
export function nextStartOnTrack(timeline: Timeline, trackId: string): number {
  const track = timeline.tracks.find((t) => t.id === trackId);
  if (!track || track.clips.length === 0) return 0;

  let end = 0;
  for (const c of track.clips) {
    end = Math.max(end, c.timelineStart + clipDuration(c));
  }
  return end;
}

/**
 * Trim a clip edge by delta seconds (positive = later / longer toward that edge).
 * Start edge moves timelineStart + trimStart together (non-destructive).
 */
export function trimClipInTimeline(
  timeline: Timeline,
  clipId: string,
  edge: "start" | "end",
  deltaSeconds: number,
  sourceDuration?: number
): Timeline | null {
  const found = findClip(timeline, clipId);
  if (!found) return null;

  const { clip } = found;
  let trimStart = clip.trimStart;
  let trimEnd = clip.trimEnd;
  let timelineStart = clip.timelineStart;

  if (edge === "start") {
    let nextTrimStart = trimStart + deltaSeconds;
    let nextTimelineStart = timelineStart + deltaSeconds;
    nextTrimStart = Math.max(0, nextTrimStart);
    nextTimelineStart = Math.max(0, timelineStart + (nextTrimStart - trimStart));
    if (trimEnd - nextTrimStart < MIN_CLIP_SECONDS) {
      nextTrimStart = trimEnd - MIN_CLIP_SECONDS;
      nextTimelineStart = timelineStart + (nextTrimStart - trimStart);
      if (nextTimelineStart < 0) return null;
    }
    trimStart = nextTrimStart;
    timelineStart = Math.max(0, nextTimelineStart);
  } else {
    let nextTrimEnd = trimEnd + deltaSeconds;
    const maxEnd =
      sourceDuration != null && sourceDuration > 0
        ? sourceDuration
        : Number.POSITIVE_INFINITY;
    nextTrimEnd = Math.min(maxEnd, nextTrimEnd);
    if (nextTrimEnd - trimStart < MIN_CLIP_SECONDS) {
      nextTrimEnd = trimStart + MIN_CLIP_SECONDS;
    }
    trimEnd = nextTrimEnd;
  }

  if (
    Math.abs(trimStart - clip.trimStart) < 0.0001 &&
    Math.abs(trimEnd - clip.trimEnd) < 0.0001 &&
    Math.abs(timelineStart - clip.timelineStart) < 0.0001
  ) {
    return null;
  }

  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => {
      if (track.id !== found.trackId) return track;
      return {
        ...track,
        clips: track.clips.map((c) =>
          c.id === clipId
            ? { ...c, trimStart, trimEnd, timelineStart }
            : c
        ),
      };
    }),
  };
}
