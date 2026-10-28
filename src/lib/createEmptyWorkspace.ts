import { createId } from "@/lib/id";
import type { Timeline, Version, Workspace } from "@/types/timeline";

/** Default tracks for v1 demos: two video + one audio. */
export function createEmptyTimeline(): Timeline {
  return {
    tracks: [
      { id: "track_v1", type: "video", name: "Video 1", clips: [] },
      { id: "track_v2", type: "video", name: "Video 2", clips: [] },
      { id: "track_a1", type: "audio", name: "Audio 1", clips: [] },
    ],
  };
}

export function createEmptyWorkspace(name = "Untitled workspace"): Workspace {
  const mainId = createId("ver");
  const main: Version = {
    id: mainId,
    name: "Your cut",
    timeline: createEmptyTimeline(),
    parentVersionIds: [],
    createdAt: Date.now(),
    label: "Working cut",
  };

  return {
    id: createId("ws"),
    name,
    assets: [],
    versions: [main],
    activeVersionId: mainId,
    mainVersionId: mainId,
  };
}
