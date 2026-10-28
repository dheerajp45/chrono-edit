import type { TimelineClip } from "@/types/timeline";

export function clipDuration(clip: TimelineClip): number {
  return Math.max(0, clip.trimEnd - clip.trimStart);
}

export function clipEnd(clip: TimelineClip): number {
  return clip.timelineStart + clipDuration(clip);
}

export function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function clipsEqual(a: TimelineClip, b: TimelineClip): boolean {
  return (
    a.assetId === b.assetId &&
    a.trackId === b.trackId &&
    approx(a.timelineStart, b.timelineStart) &&
    approx(a.trimStart, b.trimStart) &&
    approx(a.trimEnd, b.trimEnd)
  );
}

function approx(a: number, b: number, eps = 0.001): boolean {
  return Math.abs(a - b) < eps;
}
