import { clipDuration, clipsEqual } from "@/lib/clipRange";
import type { Timeline, TimelineClip } from "@/types/timeline";

export type DiffOpKind =
  | "add"
  | "remove"
  | "move"
  | "trim"
  | "replace"
  | "track";

export interface DiffOp {
  kind: DiffOpKind;
  trackId: string;
  clipId: string;
  /** Plain English for Compare UI */
  summary: string;
  /** Rough region on timeline for highlighting */
  start: number;
  end: number;
}

function indexClips(timeline: Timeline): Map<string, TimelineClip> {
  const map = new Map<string, TimelineClip>();
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      map.set(clip.id, clip);
    }
  }
  return map;
}

/** What changed going from `from` → `to` (semantic clip ops). */
export function diffTimelines(from: Timeline, to: Timeline): DiffOp[] {
  const a = indexClips(from);
  const b = indexClips(to);
  const ops: DiffOp[] = [];

  for (const [id, clipB] of b) {
    const clipA = a.get(id);
    if (!clipA) {
      ops.push({
        kind: "add",
        trackId: clipB.trackId,
        clipId: id,
        summary: `Added clip on ${clipB.trackId} at ${clipB.timelineStart.toFixed(1)}s`,
        start: clipB.timelineStart,
        end: clipB.timelineStart + clipDuration(clipB),
      });
      continue;
    }
    if (clipsEqual(clipA, clipB)) continue;

    if (clipA.assetId !== clipB.assetId) {
      ops.push({
        kind: "replace",
        trackId: clipB.trackId,
        clipId: id,
        summary: `Replaced media on clip ${id.slice(0, 8)}…`,
        start: clipB.timelineStart,
        end: clipB.timelineStart + clipDuration(clipB),
      });
    }
    if (clipA.trackId !== clipB.trackId) {
      ops.push({
        kind: "track",
        trackId: clipB.trackId,
        clipId: id,
        summary: `Moved clip to ${clipB.trackId}`,
        start: clipB.timelineStart,
        end: clipB.timelineStart + clipDuration(clipB),
      });
    }
    if (Math.abs(clipA.timelineStart - clipB.timelineStart) >= 0.001) {
      ops.push({
        kind: "move",
        trackId: clipB.trackId,
        clipId: id,
        summary: `Moved clip ${clipA.timelineStart.toFixed(1)}s → ${clipB.timelineStart.toFixed(1)}s`,
        start: Math.min(clipA.timelineStart, clipB.timelineStart),
        end: Math.max(
          clipA.timelineStart + clipDuration(clipA),
          clipB.timelineStart + clipDuration(clipB)
        ),
      });
    }
    if (
      Math.abs(clipA.trimStart - clipB.trimStart) >= 0.001 ||
      Math.abs(clipA.trimEnd - clipB.trimEnd) >= 0.001
    ) {
      ops.push({
        kind: "trim",
        trackId: clipB.trackId,
        clipId: id,
        summary: `Trimmed clip (${clipDuration(clipA).toFixed(1)}s → ${clipDuration(clipB).toFixed(1)}s)`,
        start: clipB.timelineStart,
        end: clipB.timelineStart + clipDuration(clipB),
      });
    }
  }

  for (const [id, clipA] of a) {
    if (b.has(id)) continue;
    ops.push({
      kind: "remove",
      trackId: clipA.trackId,
      clipId: id,
      summary: `Removed clip from ${clipA.trackId} at ${clipA.timelineStart.toFixed(1)}s`,
      start: clipA.timelineStart,
      end: clipA.timelineStart + clipDuration(clipA),
    });
  }

  return ops;
}
