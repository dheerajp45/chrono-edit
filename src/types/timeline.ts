/**
 * ChronoEdit core model — Phase 1
 *
 * Time is in **seconds** (easier with HTML5 <video> in later phases).
 * We version the timeline JSON, not the media bytes.
 */

export type MediaType = "video" | "audio" | "image";

/** A local file reference. objectUrl dies on refresh — intentional for early demos. */
export interface MediaAsset {
  id: string;
  name: string;
  type: MediaType;
  objectUrl: string;
  /** Source length in seconds, when known */
  duration?: number;
}

/**
 * One edit decision on a track.
 * Split = two clips, same assetId, different trimStart/trimEnd.
 * Non-destructive editing
 */
export interface TimelineClip {
  id: string;
  assetId: string;
  trackId: string;
  /** Where this clip starts on the timeline (seconds) */
  timelineStart: number;
  /** In-point into the source media (seconds) */
  trimStart: number;
  /** Out-point into the source media (seconds) */
  trimEnd: number;
}

export type TrackType = "video" | "audio" | "text";

export interface Track {
  id: string;
  type: TrackType;
  name: string;
  clips: TimelineClip[];
}

/** The composition document — this is what Versions store. */
export interface Timeline {
  tracks: Track[];
  duration?: number;
}

/**
 * A named cut of the project (UI: "Your cut", "AI edit 1", "Version 1").
 * parentVersionIds: [] root | [one] linear history | [two] merge.
 */
export interface Version {
  id: string;
  name: string;
  timeline: Timeline;
  parentVersionIds: string[];
  createdAt: number;
  /** Optional note, e.g. "Simulate AI Edit" */
  label?: string;
  /**
   * Parent timeline frozen at fork time (for three-way merge).
   * Survives later edits to Main.
   */
  forkBaseTimeline?: Timeline;
  /**
   * Manual Save snapshots are frozen — opening them must not mutate.
   * Edit only on Main / Agent drafts / working copies.
   */
  frozen?: boolean;
}

/** One project: shared media + many versions. */
export interface Workspace {
  id: string;
  name: string;
  assets: MediaAsset[];
  versions: Version[];
  activeVersionId: string;
  mainVersionId: string;
}
