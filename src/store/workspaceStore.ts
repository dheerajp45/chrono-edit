"use client";

import { create } from "zustand";
import { createEmptyWorkspace } from "@/lib/createEmptyWorkspace";
import { diffTimelines, type DiffOp } from "@/lib/diffOps";
import { createId } from "@/lib/id";
import {
  applyOverlapResolutions,
  threeWayMerge,
  type Overlap,
} from "@/lib/mergeOps";
import { buildDemoClashPair } from "@/lib/demoClash";
import { applySimulatedAiEdits as runAiEdits } from "@/lib/simulateAiEdit";
import {
  moveClipInTimeline,
  nextStartOnTrack,
  removeClipFromTimeline,
  splitClipInTimeline,
  trimClipInTimeline,
} from "@/lib/timelineOps";
import type {
  MediaAsset,
  Timeline,
  TimelineClip,
  Version,
  Workspace,
} from "@/types/timeline";

export interface MergeSession {
  oursId: string;
  theirsId: string;
  oursName: string;
  theirsName: string;
  baseTimeline: Timeline;
  partial: Timeline;
  overlaps: Overlap[];
  resolutions: Record<string, "ours" | "theirs">;
  diffOps: DiffOp[];
  strategy: "fast-forward-theirs" | "keep-ours" | "three-way";
  /** Plain-language teaching copy (e.g. Demo clash) */
  story?: {
    yours: string[];
    other: string[];
    conflict: string;
    autoMerge: string;
  };
}

/**
 * Unsaved working batch on Your cut.
 * `before` = timeline when this batch started (not a Takes version).
 * Undo restores `before`; Keep clears without touching Takes.
 */
export interface UnsavedPreview {
  before: Timeline;
  diffOps: DiffOp[];
  notes: string[];
}

interface WorkspaceState {
  workspace: Workspace;
  /** Legacy three-way Review (optional later) */
  mergeSession: MergeSession | null;
  /** Unsaved human/AI edits on Your cut — Undo ≠ open a saved version */
  unsavedPreview: UnsavedPreview | null;
  statusMessage: string | null;

  getActiveVersion: () => Version | undefined;
  getMainVersion: () => Version | undefined;

  addAsset: (asset: Omit<MediaAsset, "id"> & { id?: string }) => string;
  setActiveVersion: (versionId: string) => void;
  renameWorkspace: (name: string) => void;
  setActiveTimeline: (timeline: Timeline) => void;
  updateActiveTimeline: (updater: (timeline: Timeline) => Timeline) => void;
  createVersionFromActive: (
    name: string,
    label?: string,
    options?: { switchTo?: boolean; frozen?: boolean }
  ) => string;
  addClipToActive: (clip: Omit<TimelineClip, "id"> & { id?: string }) => string;
  addAssetToTimeline: (
    assetId: string,
    trackId?: string,
    timelineStart?: number
  ) => string | null;
  moveClip: (clipId: string, timelineStart: number, trackId?: string) => void;
  splitClip: (clipId: string, atTimelineTime: number) => boolean;
  /** Trim left (start) or right (end) edge by delta seconds */
  trimClip: (
    clipId: string,
    edge: "start" | "end",
    deltaSeconds: number
  ) => boolean;
  /** Remove clip from active timeline (asset stays in Media) */
  deleteClip: (clipId: string) => boolean;

  /** Freeze a Takes snapshot from Your cut or a Copy & edit working copy */
  saveVersion: (name?: string) => string;
  /**
   * Your cut → overwrite newest Takes save.
   * Working copy → overwrite newest freeze created from this copy (not the parent).
   */
  updateLastSave: () => boolean;
  /** Lock the current Copy & edit take in place (present working → saved) */
  freezeWorkingCopy: () => boolean;
  restoreLastSave: () => boolean;
  /** Load any locked take onto Your cut (work from that point) */
  loadSaveOntoYourCut: (versionId: string) => boolean;
  /** Fork locked save into a named editable copy */
  editFromFrozen: (name?: string, fromVersionId?: string) => string;
  /** Apply AI on Your cut (no separate take) */
  simulateAiEdit: () => boolean;
  /** Undo unsaved working changes only (not jump to a Takes save) */
  undoUnsaved: () => boolean;
  /** Accept current Your cut as clean — clear unsaved buffer */
  keepUnsaved: () => void;
  /**
   * Simulate merge conflict: Your cut vs “Other edit” on the same clip + Review.
   * Not AI — for demo “how do you solve conflicts”.
   */
  demoClash: () => boolean;
  openCompareWith: (
    theirsId: string,
    story?: MergeSession["story"]
  ) => void;
  closeMergeSession: () => void;
  resolveOverlap: (overlapId: string, choice: "ours" | "theirs") => void;
  updateMainFromSession: () => string | null;
  clearStatusMessage: () => void;
}

function mapActiveVersion(
  workspace: Workspace,
  map: (version: Version) => Version
): Workspace {
  return {
    ...workspace,
    versions: workspace.versions.map((v) =>
      v.id === workspace.activeVersionId ? map(v) : v
    ),
  };
}

type GetState = () => WorkspaceState;

/** Block timeline edits while viewing a frozen saved version. */
function assertEditable(get: GetState): boolean {
  const active = get().getActiveVersion();
  if (active?.frozen) {
    useWorkspaceStore.setState({
      statusMessage:
        "This saved version is locked. Go to Your cut to keep editing, or Copy & edit.",
    });
    return false;
  }
  return true;
}

/** AI + clash demo stay on Your cut only. */
function assertOnYourCut(get: GetState): boolean {
  if (!assertEditable(get)) return false;
  const { workspace } = get();
  if (workspace.activeVersionId !== workspace.mainVersionId) {
    useWorkspaceStore.setState({
      statusMessage: "Go to Your cut first — AI and clash demo only run there",
    });
    return false;
  }
  return true;
}

/** Save new / Update — Your cut or any non-frozen working copy. */
function assertCanSave(get: GetState): boolean {
  return assertEditable(get);
}

/** Newest frozen take whose parent is this working copy. */
function newestFrozenChild(
  workspace: Workspace,
  parentId: string
): Version | undefined {
  return workspace.versions
    .filter((v) => v.frozen && v.parentVersionIds[0] === parentId)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
}

function mapMainVersion(
  workspace: Workspace,
  map: (version: Version) => Version
): Workspace {
  return {
    ...workspace,
    versions: workspace.versions.map((v) =>
      v.id === workspace.mainVersionId ? map(v) : v
    ),
  };
}

/** Start an unsaved batch if none — snapshot current Your cut only. */
function ensureUnsavedBaseline(get: GetState): void {
  if (get().unsavedPreview) return;
  const { workspace } = get();
  if (workspace.activeVersionId !== workspace.mainVersionId) return;
  const main = get().getMainVersion();
  if (!main) return;
  useWorkspaceStore.setState({
    unsavedPreview: {
      before: structuredClone(main.timeline),
      diffOps: [],
      notes: [],
    },
  });
}

/** Refresh diff after an edit; clear buffer if back to baseline. */
function syncUnsavedDiff(get: GetState, notes?: string[]): void {
  const preview = get().unsavedPreview;
  if (!preview) return;
  const main = get().getMainVersion();
  if (!main) return;
  const diffOps = diffTimelines(preview.before, main.timeline);
  if (diffOps.length === 0) {
    useWorkspaceStore.setState({
      unsavedPreview: null,
      statusMessage: null,
    });
    return;
  }
  useWorkspaceStore.setState({
    unsavedPreview: {
      before: preview.before,
      diffOps,
      notes: notes ?? preview.notes,
    },
  });
}

function clearUnsaved(): Partial<WorkspaceState> {
  return { unsavedPreview: null };
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspace: createEmptyWorkspace("Summer campaign"),
  mergeSession: null,
  unsavedPreview: null,
  statusMessage: null,

  clearStatusMessage: () => set({ statusMessage: null }),

  getActiveVersion: () => {
    const { workspace } = get();
    return workspace.versions.find((v) => v.id === workspace.activeVersionId);
  },

  getMainVersion: () => {
    const { workspace } = get();
    return workspace.versions.find((v) => v.id === workspace.mainVersionId);
  },

  addAsset: (assetInput) => {
    const id = assetInput.id ?? createId("asset");
    const asset: MediaAsset = { ...assetInput, id };
    set((state) => ({
      workspace: {
        ...state.workspace,
        assets: [...state.workspace.assets, asset],
      },
    }));
    return id;
  },

  setActiveVersion: (versionId) => {
    const { workspace } = get();
    const exists = workspace.versions.some((v) => v.id === versionId);
    if (!exists) return;
    if (versionId === workspace.activeVersionId) return;
    const target = workspace.versions.find((v) => v.id === versionId);
    const isMain = versionId === workspace.mainVersionId;
    set({
      workspace: { ...workspace, activeVersionId: versionId },
      mergeSession: null,
      // Leaving Your cut hides unsaved UI but keeps buffer if you return
      statusMessage: isMain
        ? "Back on your cut — edit freely"
        : target?.frozen
          ? `Looking at saved “${target.name}” · locked · Your cut anytime`
          : `Opened “${target?.name ?? "take"}”`,
    });
  },

  renameWorkspace: (name) => {
    set((state) => ({
      workspace: { ...state.workspace, name },
    }));
  },

  setActiveTimeline: (timeline) => {
    if (!assertEditable(get)) return;
    const onCut =
      get().workspace.activeVersionId === get().workspace.mainVersionId;
    if (onCut) ensureUnsavedBaseline(get);
    set((state) => ({
      workspace: mapActiveVersion(state.workspace, (v) => ({
        ...v,
        timeline,
      })),
    }));
    if (onCut) syncUnsavedDiff(get);
  },

  updateActiveTimeline: (updater) => {
    if (!assertEditable(get)) return;
    const onCut =
      get().workspace.activeVersionId === get().workspace.mainVersionId;
    if (onCut) ensureUnsavedBaseline(get);
    set((state) => ({
      workspace: mapActiveVersion(state.workspace, (v) => ({
        ...v,
        timeline: updater(v.timeline),
      })),
    }));
    if (onCut) syncUnsavedDiff(get);
  },

  createVersionFromActive: (name, label, options) => {
    const switchTo = options?.switchTo !== false;
    const frozen = options?.frozen === true;
    const { workspace } = get();
    const active = workspace.versions.find(
      (v) => v.id === workspace.activeVersionId
    );
    if (!active) return "";

    const id = createId("ver");
    const forkBaseTimeline = structuredClone(active.timeline);
    const timeline = structuredClone(active.timeline);
    const next: Version = {
      id,
      name,
      timeline,
      parentVersionIds: [active.id],
      createdAt: Date.now(),
      label,
      forkBaseTimeline,
      frozen,
    };

    set({
      workspace: {
        ...workspace,
        versions: [...workspace.versions, next],
        activeVersionId: switchTo ? id : workspace.activeVersionId,
      },
    });
    return id;
  },

  addClipToActive: (clipInput) => {
    if (!assertEditable(get)) return "";
    const id = clipInput.id ?? createId("clip");
    const clip: TimelineClip = { ...clipInput, id };

    get().updateActiveTimeline((timeline) => ({
      ...timeline,
      tracks: timeline.tracks.map((track) =>
        track.id === clip.trackId
          ? { ...track, clips: [...track.clips, clip] }
          : track
      ),
    }));

    return id;
  },

  addAssetToTimeline: (assetId, trackId, timelineStart) => {
    if (!assertEditable(get)) return null;
    const { workspace } = get();
    const asset = workspace.assets.find((a) => a.id === assetId);
    const active = get().getActiveVersion();
    if (!asset || !active) return null;

    const resolvedTrackId =
      trackId ?? (asset.type === "audio" ? "track_a1" : "track_v1");

    const trackExists = active.timeline.tracks.some(
      (t) => t.id === resolvedTrackId
    );
    if (!trackExists) return null;

    const duration =
      asset.duration && asset.duration > 0
        ? asset.duration
        : asset.type === "image"
          ? 3
          : 5;

    const start =
      timelineStart != null && Number.isFinite(timelineStart)
        ? Math.max(0, timelineStart)
        : nextStartOnTrack(active.timeline, resolvedTrackId);

    return get().addClipToActive({
      assetId: asset.id,
      trackId: resolvedTrackId,
      timelineStart: start,
      trimStart: 0,
      trimEnd: duration,
    });
  },

  moveClip: (clipId, timelineStart, trackId) => {
    if (!assertEditable(get)) return;
    get().updateActiveTimeline((timeline) =>
      moveClipInTimeline(timeline, clipId, { timelineStart, trackId })
    );
  },

  splitClip: (clipId, atTimelineTime) => {
    if (!assertEditable(get)) return false;
    const active = get().getActiveVersion();
    if (!active) return false;
    const next = splitClipInTimeline(active.timeline, clipId, atTimelineTime);
    if (!next) return false;
    get().setActiveTimeline(next);
    return true;
  },

  trimClip: (clipId, edge, deltaSeconds) => {
    if (!assertEditable(get)) return false;
    const active = get().getActiveVersion();
    if (!active) return false;
    const clip = active.timeline.tracks
      .flatMap((t) => t.clips)
      .find((c) => c.id === clipId);
    const asset = clip
      ? get().workspace.assets.find((a) => a.id === clip.assetId)
      : undefined;
    const next = trimClipInTimeline(
      active.timeline,
      clipId,
      edge,
      deltaSeconds,
      asset?.duration
    );
    if (!next) return false;
    get().setActiveTimeline(next);
    return true;
  },

  deleteClip: (clipId) => {
    if (!assertEditable(get)) return false;
    const active = get().getActiveVersion();
    if (!active) return false;
    const exists = active.timeline.tracks.some((t) =>
      t.clips.some((c) => c.id === clipId)
    );
    if (!exists) return false;
    get().setActiveTimeline(removeClipFromTimeline(active.timeline, clipId));
    set({ statusMessage: "Clip removed from timeline (still in Media)" });
    return true;
  },

  saveVersion: (name) => {
    if (!assertCanSave(get)) return "";
    const { workspace } = get();
    const onCut = workspace.activeVersionId === workspace.mainVersionId;
    const n =
      workspace.versions.filter((v) => v.frozen || v.label === "Manual save")
        .length + 1;
    const id = get().createVersionFromActive(
      name?.trim() || `Version ${n}`,
      "Manual save · frozen",
      { switchTo: false, frozen: true }
    );
    if (id) {
      const label = name?.trim() || `Version ${n}`;
      set({
        ...(onCut ? clearUnsaved() : {}),
        statusMessage: onCut
          ? `New save “${label}” · still on your cut · Update last save next time`
          : `New save “${label}” · still on this copy · Update this save overwrites the take you forked`,
      });
    }
    return id;
  },

  updateLastSave: () => {
    if (!assertCanSave(get)) return false;
    const { workspace } = get();
    const active = get().getActiveVersion();
    if (!active) return false;

    const onCut = active.id === workspace.mainVersionId;
    let target: Version | undefined;

    if (onCut) {
      const frozen = workspace.versions
        .filter((v) => v.frozen)
        .sort((a, b) => b.createdAt - a.createdAt);
      target = frozen[0];
      if (!target) {
        set({
          statusMessage: "No saved version yet — use Save new first",
        });
        return false;
      }
    } else {
      // Update a freeze made FROM this working copy — never the parent you forked
      target = newestFrozenChild(workspace, active.id);
      if (!target) {
        set({
          statusMessage:
            "No save under this copy yet — use Save this take, or Save new",
        });
        return false;
      }
    }

    const timeline = structuredClone(active.timeline);
    set({
      workspace: {
        ...workspace,
        versions: workspace.versions.map((v) =>
          v.id === target!.id
            ? {
                ...v,
                timeline,
                createdAt: Date.now(),
                label: onCut
                  ? "Updated from your cut"
                  : `Updated from working “${active.name}”`,
              }
            : v
        ),
      },
      ...(onCut ? clearUnsaved() : {}),
      statusMessage: onCut
        ? `Updated “${target.name}” · no new take created`
        : `Updated “${target.name}” · your working copy stays editable`,
    });
    return true;
  },

  freezeWorkingCopy: () => {
    if (!assertCanSave(get)) return false;
    const { workspace } = get();
    const active = get().getActiveVersion();
    if (!active) return false;
    if (active.id === workspace.mainVersionId) {
      set({
        statusMessage: "On your cut — use Save new to freeze a Takes snapshot",
      });
      return false;
    }
    if (active.frozen) {
      set({ statusMessage: "This take is already locked" });
      return false;
    }

    set({
      workspace: {
        ...workspace,
        versions: workspace.versions.map((v) =>
          v.id === active.id
            ? {
                ...v,
                frozen: true,
                createdAt: Date.now(),
                label: "Saved working copy · locked",
              }
            : v
        ),
      },
      statusMessage: `“${active.name}” locked · open Takes tree to work from it or copy again`,
    });
    return true;
  },

  restoreLastSave: () => {
    const { workspace } = get();
    const frozen = workspace.versions
      .filter((v) => v.frozen)
      .sort((a, b) => b.createdAt - a.createdAt);
    const last = frozen[0];
    if (!last) {
      set({ statusMessage: "No saved version to restore yet" });
      return false;
    }
    return get().loadSaveOntoYourCut(last.id);
  },

  loadSaveOntoYourCut: (versionId) => {
    const { workspace } = get();
    const mainId = workspace.mainVersionId;
    const source = workspace.versions.find((v) => v.id === versionId);
    if (!source?.frozen) {
      set({ statusMessage: "Pick a locked Takes save to work from" });
      return false;
    }

    const timeline = structuredClone(source.timeline);
    set({
      workspace: {
        ...workspace,
        versions: workspace.versions.map((v) =>
          v.id === mainId ? { ...v, timeline } : v
        ),
        activeVersionId: mainId,
      },
      mergeSession: null,
      ...clearUnsaved(),
      statusMessage: `Your cut now starts from “${source.name}”`,
    });
    return true;
  },

  editFromFrozen: (name, fromVersionId) => {
    const { workspace } = get();
    const source = fromVersionId
      ? workspace.versions.find((v) => v.id === fromVersionId)
      : get().getActiveVersion();
    if (!source?.frozen) {
      set({ statusMessage: "This take is already editable" });
      return "";
    }

    const label = name?.trim() || `From ${source.name}`;
    const id = createId("ver");
    const timeline = structuredClone(source.timeline);
    const next: Version = {
      id,
      name: label,
      timeline,
      parentVersionIds: [source.id],
      createdAt: Date.now(),
      label: `Copy & edit · from “${source.name}”`,
      forkBaseTimeline: structuredClone(source.timeline),
      frozen: false,
    };

    set({
      workspace: {
        ...workspace,
        versions: [...workspace.versions, next],
        activeVersionId: id,
      },
      mergeSession: null,
      statusMessage: `“${label}” ready to edit · “${source.name}” stays locked`,
    });
    return id;
  },

  simulateAiEdit: () => {
    if (!assertOnYourCut(get)) return false;
    const main = get().getMainVersion();
    if (!main) return false;
    ensureUnsavedBaseline(get);
    const { timeline, notes } = runAiEdits(main.timeline);
    set({
      workspace: mapMainVersion(get().workspace, (v) => ({
        ...v,
        timeline,
        label: notes.length ? `AI · ${notes.join("; ")}` : v.label,
      })),
      mergeSession: null,
    });
    syncUnsavedDiff(get, notes);
    const ops = get().unsavedPreview?.diffOps.length ?? 0;
    set({
      statusMessage:
        ops > 0
          ? `AI changed your cut · Undo or Keep · then Save if you want`
          : "AI ran but nothing visible changed",
    });
    return ops > 0;
  },

  undoUnsaved: () => {
    const preview = get().unsavedPreview;
    if (!preview) {
      set({ statusMessage: "Nothing unsaved to undo" });
      return false;
    }
    if (!assertOnYourCut(get)) return false;
    set({
      workspace: mapMainVersion(get().workspace, (v) => ({
        ...v,
        timeline: structuredClone(preview.before),
        label: "Your cut",
      })),
      ...clearUnsaved(),
      statusMessage:
        "Undid unsaved work on your cut (did not open a Takes save)",
    });
    return true;
  },

  keepUnsaved: () => {
    if (!get().unsavedPreview) return;
    set({
      ...clearUnsaved(),
      statusMessage:
        "Kept current cut · Save new / Update last save when you want a Takes snapshot",
    });
  },

  demoClash: () => {
    if (!assertOnYourCut(get)) return false;
    const { workspace } = get();
    const mainId = workspace.mainVersionId;
    const main = workspace.versions.find((v) => v.id === mainId);
    if (!main) return false;

    const base = structuredClone(main.timeline);
    const pair = buildDemoClashPair(base);
    if (!pair) {
      set({
        statusMessage:
          "Add a clip on Video 1 first, then try Show clash demo",
      });
      return false;
    }

    const n =
      workspace.versions.filter((v) => v.name.startsWith("Other edit"))
        .length + 1;
    const otherId = createId("ver");
    const other: Version = {
      id: otherId,
      name: `Other edit ${n}`,
      timeline: pair.theirs,
      parentVersionIds: [mainId],
      createdAt: Date.now(),
      label: `Teammate cut · ${pair.notes.join("; ")}`,
      forkBaseTimeline: base,
      frozen: false,
    };

    set({
      workspace: {
        ...workspace,
        versions: [
          ...workspace.versions.map((v) =>
            v.id === mainId
              ? {
                  ...v,
                  timeline: pair.ours,
                  label: pair.notes[0] ?? "Your move · +0.8s",
                }
              : v
          ),
          other,
        ],
        activeVersionId: mainId,
      },
      ...clearUnsaved(),
      statusMessage:
        "Clash demo open — read the steps, then pick your move or theirs",
    });

    get().openCompareWith(otherId, pair.story);
    return true;
  },

  openCompareWith: (theirsId, story) => {
    const { workspace } = get();
    const ours = workspace.versions.find(
      (v) => v.id === workspace.mainVersionId
    );
    const theirs = workspace.versions.find((v) => v.id === theirsId);
    if (!ours || !theirs) {
      set({ statusMessage: "Review failed — take not found" });
      return;
    }
    if (ours.id === theirs.id) {
      set({
        statusMessage:
          "Already on your cut — open another take to compare first",
      });
      return;
    }

    const baseTimeline =
      theirs.forkBaseTimeline ??
      structuredClone(
        workspace.versions.find((v) => v.id === theirs.parentVersionIds[0])
          ?.timeline ?? ours.timeline
      );

    const { partial, overlaps, strategy } = threeWayMerge(
      baseTimeline,
      ours.timeline,
      theirs.timeline
    );

    const diffOps = diffTimelines(ours.timeline, theirs.timeline);

    set({
      mergeSession: {
        oursId: ours.id,
        theirsId: theirs.id,
        oursName: ours.name,
        theirsName: theirs.name,
        baseTimeline,
        partial,
        overlaps,
        resolutions: {},
        diffOps,
        strategy,
        story,
      },
      statusMessage:
        strategy === "fast-forward-theirs"
          ? "Ready — your cut didn’t change · Make this your cut"
          : strategy === "keep-ours"
            ? "Ready — other cut matches the start · your cut already has it"
            : `Conflict review · ${overlaps.length} clash(es) — read the text, then pick`,
    });
  },

  closeMergeSession: () => set({ mergeSession: null }),

  resolveOverlap: (overlapId, choice) => {
    set((state) => {
      if (!state.mergeSession) return state;
      return {
        mergeSession: {
          ...state.mergeSession,
          resolutions: {
            ...state.mergeSession.resolutions,
            [overlapId]: choice,
          },
        },
      };
    });
  },

  updateMainFromSession: () => {
    const session = get().mergeSession;
    const { workspace } = get();
    if (!session) {
      set({
        statusMessage: "Nothing to accept — hit Review on an AI edit first",
      });
      return null;
    }

    for (const o of session.overlaps) {
      if (!session.resolutions[o.id]) {
        set({
          statusMessage: "Pick Keep yours or Use other on every clash first",
        });
        return null;
      }
    }

    let timeline: Timeline;
    if (session.overlaps.length === 0) {
      timeline = structuredClone(session.partial);
    } else {
      const merged = applyOverlapResolutions(
        session.partial,
        session.overlaps,
        session.resolutions
      );
      if (!merged) {
        set({ statusMessage: "Couldn’t finish — unresolved clashes" });
        return null;
      }
      timeline = merged;
    }

    const clipCount = timeline.tracks.reduce(
      (n, t) => n + t.clips.length,
      0
    );

    const id = createId("ver");
    const next: Version = {
      id,
      name: "Your cut",
      timeline,
      parentVersionIds: [session.oursId, session.theirsId],
      createdAt: Date.now(),
      label: `Accepted from ${session.theirsName}`,
    };

    // Rename previous working cut so Takes stays clear
    const versions = workspace.versions.map((v) =>
      v.id === session.oursId &&
      (v.name === "Your cut" || v.name === "Main")
        ? { ...v, name: "Your cut (earlier)" }
        : v
    );

    set({
      workspace: {
        ...workspace,
        versions: [...versions, next],
        mainVersionId: id,
        activeVersionId: id,
      },
      mergeSession: null,
      statusMessage: `This is your cut now · ${clipCount} clip(s) on the timeline`,
    });
    return id;
  },
}));
