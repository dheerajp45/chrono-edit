import { moveClipInTimeline, trimClipInTimeline } from "@/lib/timelineOps";
import type { Timeline } from "@/types/timeline";

/**
 * Fake “you + teammate” diverge for the conflict demo.
 * Ultra-plain story for non-git people.
 */
export function buildDemoClashPair(base: Timeline): {
  ours: Timeline;
  theirs: Timeline;
  notes: string[];
  story: {
    yours: string[];
    other: string[];
    conflict: string;
    autoMerge: string;
  };
} | null {
  const v1 = base.tracks.find((t) => t.id === "track_v1");
  const first = v1?.clips[0];
  if (!first) return null;

  const notes: string[] = [];
  const yoursLines: string[] = [];
  const otherLines: string[] = [];
  let autoMerge =
    "No extra teammate-only edit this time — only the shared move conflicts.";

  const yours = moveClipInTimeline(base, first.id, {
    timelineStart: first.timelineStart + 0.8,
  });
  yoursLines.push(
    "You dragged the first clip a bit to the right (+0.8s on the timeline)."
  );
  notes.push("You: +0.8s");

  let theirs = structuredClone(base);
  const dur = first.trimEnd - first.trimStart;
  if (dur > 1.5) {
    const trimmed = trimClipInTimeline(theirs, first.id, "end", -1.0);
    if (trimmed) {
      theirs = trimmed;
      otherLines.push(
        "They also trimmed 1s off the end of that clip (only they did this — no clash)."
      );
      autoMerge =
        "Their trim is fine on its own — it can auto-apply. You only decide who wins the drag.";
      notes.push("Teammate: trim −1s");
    }
  }
  theirs = moveClipInTimeline(theirs, first.id, {
    timelineStart: Math.max(0, first.timelineStart + 2.0),
  });
  otherLines.push(
    "They dragged that SAME clip much farther right (+2.0s)."
  );
  notes.push("Teammate: +2.0s");

  return {
    ours: yours,
    theirs,
    notes,
    story: {
      yours: yoursLines,
      other: otherLines,
      conflict:
        "Same clip, two different places on the timeline. One clip cannot sit in two spots — pick which move wins.",
      autoMerge,
    },
  };
}
