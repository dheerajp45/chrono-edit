import { clipEnd, clipsEqual, rangesOverlap } from "@/lib/clipRange";
import { diffTimelines } from "@/lib/diffOps";
import { createId } from "@/lib/id";
import type { Timeline, TimelineClip, Track } from "@/types/timeline";

export interface Overlap {
  id: string;
  trackId: string;
  clipId: string;
  start: number;
  end: number;
  reason: string;
  ours: TimelineClip | null;
  theirs: TimelineClip | null;
}

export interface MergeResult {
  partial: Timeline;
  overlaps: Overlap[];
  /** Human hint for the Compare panel */
  strategy: "fast-forward-theirs" | "keep-ours" | "three-way";
}

function indexById(timeline: Timeline): Map<string, TimelineClip> {
  const map = new Map<string, TimelineClip>();
  for (const track of timeline.tracks) {
    for (const clip of track.clips) map.set(clip.id, { ...clip });
  }
  return map;
}

function emptyTracksLike(timeline: Timeline): Track[] {
  return timeline.tracks.map((t) => ({
    ...t,
    clips: [] as TimelineClip[],
  }));
}

/**
 * Three-way merge of timeline JSON.
 * base = fork snapshot, ours = Main, theirs = other Version.
 */
export function threeWayMerge(
  base: Timeline,
  ours: Timeline,
  theirs: Timeline
): MergeResult {
  const oursChanged = diffTimelines(base, ours).length > 0;
  const theirsChanged = diffTimelines(base, theirs).length > 0;

  // Common case: you only edited the draft — just take their cut
  if (!oursChanged && theirsChanged) {
    return {
      partial: structuredClone(theirs),
      overlaps: [],
      strategy: "fast-forward-theirs",
    };
  }

  // Draft unchanged — Main already has the work
  if (oursChanged && !theirsChanged) {
    return {
      partial: structuredClone(ours),
      overlaps: [],
      strategy: "keep-ours",
    };
  }

  // Both identical to base (or each other)
  if (!oursChanged && !theirsChanged) {
    return {
      partial: structuredClone(ours),
      overlaps: [],
      strategy: "keep-ours",
    };
  }

  // Both diverged → clip-level three-way
  const baseMap = indexById(base);
  const oursMap = indexById(ours);
  const theirsMap = indexById(theirs);

  const allIds = new Set<string>([
    ...baseMap.keys(),
    ...oursMap.keys(),
    ...theirsMap.keys(),
  ]);

  const kept: TimelineClip[] = [];
  const overlaps: Overlap[] = [];

  for (const id of allIds) {
    const b = baseMap.get(id) ?? null;
    const o = oursMap.get(id) ?? null;
    const t = theirsMap.get(id) ?? null;

    const oChanged = clipChanged(b, o);
    const tChanged = clipChanged(b, t);

    if (o && t && clipsEqual(o, t)) {
      kept.push({ ...o });
      continue;
    }

    if (oChanged && !tChanged) {
      if (o) kept.push({ ...o });
      continue;
    }

    if (tChanged && !oChanged) {
      if (t) kept.push({ ...t });
      continue;
    }

    if (!oChanged && !tChanged) {
      if (o) kept.push({ ...o });
      else if (t) kept.push({ ...t });
      else if (b) kept.push({ ...b });
      continue;
    }

    const trackId = o?.trackId ?? t?.trackId ?? b?.trackId ?? "track_v1";
    const start = Math.min(
      o?.timelineStart ?? t?.timelineStart ?? b?.timelineStart ?? 0,
      t?.timelineStart ?? o?.timelineStart ?? b?.timelineStart ?? 0
    );
    const end = Math.max(
      o ? clipEnd(o) : start,
      t ? clipEnd(t) : start,
      b ? clipEnd(b) : start
    );

    overlaps.push({
      id: createId("overlap"),
      trackId,
      clipId: id,
      start,
      end,
      reason: describeConflict(b, o, t),
      ours: o,
      theirs: t,
    });
  }

  const ordered =
    ours.tracks.length > 0
      ? emptyTracksLike(ours).map((tr) => ({
          ...tr,
          clips: kept.filter((c) => c.trackId === tr.id),
        }))
      : emptyTracksLike(theirs).map((tr) => ({
          ...tr,
          clips: kept.filter((c) => c.trackId === tr.id),
        }));

  return {
    partial: { tracks: ordered },
    overlaps,
    strategy: "three-way",
  };
}

function clipChanged(
  base: TimelineClip | null,
  side: TimelineClip | null
): boolean {
  if (!base && !side) return false;
  if (!base && side) return true;
  if (base && !side) return true;
  return !clipsEqual(base!, side!);
}

function describeConflict(
  _base: TimelineClip | null,
  ours: TimelineClip | null,
  theirs: TimelineClip | null
): string {
  if (ours && theirs) return "Both sides changed this clip differently (conflict)";
  if (!ours && theirs) return "You removed it · other cut kept or changed it";
  if (ours && !theirs) return "Other cut removed it · you kept or changed it";
  return "Both sides disagree here";
}

export function applyOverlapResolutions(
  partial: Timeline,
  overlaps: Overlap[],
  resolutions: Record<string, "ours" | "theirs">
): Timeline | null {
  const clips = partial.tracks.flatMap((t) => t.clips.map((c) => ({ ...c })));

  for (const overlap of overlaps) {
    const choice = resolutions[overlap.id];
    if (!choice) return null;
    const pick = choice === "ours" ? overlap.ours : overlap.theirs;
    if (pick) {
      const idx = clips.findIndex((c) => c.id === pick.id);
      if (idx >= 0) clips[idx] = { ...pick };
      else clips.push({ ...pick });
    }
  }

  return {
    tracks: partial.tracks.map((tr) => ({
      ...tr,
      clips: clips.filter((c) => c.trackId === tr.id),
    })),
  };
}

export function overlapRegionsCollide(a: Overlap, b: Overlap): boolean {
  return (
    a.trackId === b.trackId && rangesOverlap(a.start, a.end, b.start, b.end)
  );
}
