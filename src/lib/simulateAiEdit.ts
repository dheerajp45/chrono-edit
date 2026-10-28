import { createId } from "@/lib/id";
import { MIN_CLIP_SECONDS } from "@/lib/timelineConstants";
import { moveClipInTimeline, splitClipInTimeline } from "@/lib/timelineOps";
import type { Timeline } from "@/types/timeline";

/**
 * Programmatic "agent" edits on a timeline copy.
 * Prefers: split first V1 clip · else nudge it · else no-op.
 */
export function applySimulatedAiEdits(timeline: Timeline): {
  timeline: Timeline;
  notes: string[];
} {
  const notes: string[] = [];
  let next = structuredClone(timeline);
  const v1 = next.tracks.find((t) => t.id === "track_v1");
  const first = v1?.clips[0];

  if (!first) {
    notes.push("No clips on Video 1 — created empty Agent draft only");
    return { timeline: next, notes };
  }

  const dur = first.trimEnd - first.trimStart;
  if (dur >= MIN_CLIP_SECONDS * 4) {
    const mid = first.timelineStart + dur / 2;
    const split = splitClipInTimeline(next, first.id, mid);
    if (split) {
      next = split;
      notes.push(`Split first Video 1 clip at ${mid.toFixed(1)}s`);
      // Nudge the right piece slightly so Main vs Agent clearly differ in time
      const right = next.tracks
        .find((t) => t.id === "track_v1")
        ?.clips.find(
          (c) => c.id !== first.id && c.assetId === first.assetId
        );
      if (right) {
        next = moveClipInTimeline(next, right.id, {
          timelineStart: right.timelineStart + 0.5,
        });
        notes.push("Nudged second piece +0.5s (agent pacing)");
      }
      return { timeline: next, notes };
    }
  }

  next = moveClipInTimeline(next, first.id, {
    timelineStart: first.timelineStart + 1,
  });
  notes.push("Moved first Video 1 clip +1s");

  // Ensure we always stamp something unique if move was no-op-ish
  if (notes.length === 0) {
    notes.push(`Touched timeline (${createId("ai")})`);
  }

  return { timeline: next, notes };
}
