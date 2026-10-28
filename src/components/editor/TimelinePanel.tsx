"use client";

import {
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  TimelineClipBlock,
  type TimelineTool,
} from "@/components/editor/TimelineClipBlock";
import { MEDIA_DRAG_MIME } from "@/lib/mediaDrag";
import { PX_PER_SEC, RULER_SECONDS } from "@/lib/timelineConstants";
import { usePlaybackStore } from "@/store/playbackStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

export function TimelinePanel() {
  const [tool, setTool] = useState<TimelineTool>("select");
  const [bladeGuideX, setBladeGuideX] = useState<number | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const active = useWorkspaceStore((s) => s.getActiveVersion());
  const assets = useWorkspaceStore((s) => s.workspace.assets);
  const unsavedPreview = useWorkspaceStore((s) => s.unsavedPreview);
  const mergeSession = useWorkspaceStore((s) => s.mergeSession);
  const onYourCut = useWorkspaceStore(
    (s) => s.workspace.activeVersionId === s.workspace.mainVersionId
  );
  const moveClip = useWorkspaceStore((s) => s.moveClip);
  const splitClip = useWorkspaceStore((s) => s.splitClip);
  const deleteClip = useWorkspaceStore((s) => s.deleteClip);
  const trimClip = useWorkspaceStore((s) => s.trimClip);
  const addAssetToTimeline = useWorkspaceStore((s) => s.addAssetToTimeline);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const seek = usePlaybackStore((s) => s.seek);
  const tracks = active?.timeline.tracks ?? [];
  const playheadX = currentTime * PX_PER_SEC;
  const laneHeight = 24 + tracks.length * 48;

  const reviewMarks = useMemo(() => {
    if (mergeSession) {
      return {
        diffs: mergeSession.diffOps,
        clashes: mergeSession.overlaps,
      };
    }
    if (!unsavedPreview || !onYourCut || unsavedPreview.diffOps.length === 0) {
      return null;
    }
    return {
      diffs: unsavedPreview.diffOps,
      clashes: [] as {
        start: number;
        end: number;
        id: string;
        trackId: string;
      }[],
    };
  }, [mergeSession, unsavedPreview, onYourCut]);

  const assetName = useMemo(() => {
    const map = new Map(assets.map((a) => [a.id, a.name]));
    return (assetId: string) => map.get(assetId) ?? "clip";
  }, [assets]);

  useEffect(() => {
    if (!selectedClipId || !active) return;
    const stillThere = active.timeline.tracks.some((t) =>
      t.clips.some((c) => c.id === selectedClipId)
    );
    if (!stillThere) setSelectedClipId(null);
  }, [active, selectedClipId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (tool !== "select" || !selectedClipId) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteClip(selectedClipId);
        setSelectedClipId(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tool, selectedClipId, deleteClip]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active: dragActive, delta, over } = event;
    const clipId = String(dragActive.id);
    const start = dragActive.data.current?.timelineStart as number | undefined;
    if (start == null) return;

    const nextStart = Math.max(0, start + delta.x / PX_PER_SEC);
    const overTrackId =
      over?.id != null ? String(over.id).replace(/^track:/, "") : undefined;

    moveClip(clipId, nextStart, overTrackId);
  }

  function handleBlade(clipId: string, timelineTime: number) {
    splitClip(clipId, timelineTime);
    setBladeGuideX(null);
  }

  function handleDeleteSelected() {
    if (!selectedClipId) return;
    deleteClip(selectedClipId);
    setSelectedClipId(null);
  }

  function handleMediaDrop(
    trackId: string,
    clientX: number,
    laneEl: HTMLElement
  ) {
    return (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const assetId =
        e.dataTransfer.getData(MEDIA_DRAG_MIME) ||
        e.dataTransfer.getData("text/plain");
      if (!assetId) return;
      const rect = laneEl.getBoundingClientRect();
      const x = clientX - rect.left;
      const timelineStart = Math.max(0, x / PX_PER_SEC);
      addAssetToTimeline(assetId, trackId, timelineStart);
    };
  }

  return (
    <section className="flex h-full flex-col border-t border-zinc-800 bg-zinc-950 [user-select:none]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-3 py-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            Timeline
          </h2>
          <div className="flex rounded-md border border-zinc-700 p-0.5 text-xs">
            <ToolButton
              active={tool === "select"}
              onClick={() => {
                setTool("select");
                setBladeGuideX(null);
              }}
              label="Select"
            />
            <ToolButton
              active={tool === "blade"}
              onClick={() => {
                setTool("blade");
                setSelectedClipId(null);
              }}
              label="Blade"
            />
          </div>
          <button
            type="button"
            disabled={!selectedClipId || tool !== "select"}
            onClick={handleDeleteSelected}
            className="rounded border border-rose-700/80 bg-rose-950/50 px-2 py-0.5 text-xs text-rose-200 hover:bg-rose-900/60 disabled:cursor-not-allowed disabled:opacity-30"
            title="Delete selected clip (Delete key)"
          >
            Delete
          </button>
        </div>
        <span className="text-xs text-zinc-500">
          {mergeSession
            ? "Conflict review · sky = diff · amber = clash"
            : reviewMarks
              ? "Unsaved · sky = what changed since Undo point"
              : tool === "blade"
              ? "Hover a clip — click to split"
              : selectedClipId
                ? "Drag edges to trim · Delete to remove"
                : "Drop media on a track · drag clips to move"}
        </span>
      </header>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div
          className="flex min-h-0 flex-1 overflow-auto"
          onClick={() => setSelectedClipId(null)}
        >
          <div className="sticky left-0 z-10 w-28 shrink-0 border-r border-zinc-800 bg-zinc-950">
            <div className="h-6 border-b border-zinc-800" />
            {tracks.map((track) => (
              <div
                key={track.id}
                className="flex h-12 items-center border-b border-zinc-800/80 px-2 text-xs text-zinc-400"
              >
                {track.name}
              </div>
            ))}
          </div>

          <div className="relative min-w-0 flex-1">
            <div
              className="relative h-6 cursor-pointer border-b border-zinc-800"
              style={{ width: RULER_SECONDS * PX_PER_SEC }}
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                seek(Math.max(0, x / PX_PER_SEC));
              }}
            >
              {Array.from({ length: RULER_SECONDS + 1 }, (_, i) =>
                i % 5 === 0 ? (
                  <span
                    key={i}
                    className="pointer-events-none absolute top-1 text-[10px] text-zinc-600"
                    style={{ left: i * PX_PER_SEC }}
                  >
                    {i}s
                  </span>
                ) : null
              )}
            </div>

            {tracks.map((track) => (
              <TrackLane
                key={track.id}
                trackId={track.id}
                onMediaDrop={handleMediaDrop}
                diffMarks={
                  reviewMarks
                    ? reviewMarks.diffs.filter((d) => d.trackId === track.id)
                    : []
                }
                clashMarks={
                  reviewMarks
                    ? reviewMarks.clashes.filter((c) => c.trackId === track.id)
                    : []
                }
              >
                {track.clips.length === 0 && (
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600">
                    Drop media here
                  </span>
                )}
                {track.clips.map((clip) => (
                  <TimelineClipBlock
                    key={clip.id}
                    clip={clip}
                    label={assetName(clip.assetId)}
                    tool={tool}
                    selected={clip.id === selectedClipId}
                    onSelect={setSelectedClipId}
                    onBladeClick={handleBlade}
                    onBladeHoverX={
                      tool === "blade" ? setBladeGuideX : undefined
                    }
                    onDelete={(id) => {
                      deleteClip(id);
                      setSelectedClipId(null);
                    }}
                    onTrim={(id, edge, delta) => trimClip(id, edge, delta)}
                  />
                ))}
              </TrackLane>
            ))}

            <div
              className="pointer-events-none absolute top-0 z-20 w-px bg-rose-500"
              style={{ left: playheadX, height: laneHeight }}
            >
              <div className="absolute -left-1 top-0 h-0 w-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-rose-500" />
            </div>

            {tool === "blade" && bladeGuideX != null && (
              <div
                className="pointer-events-none absolute top-0 z-30 w-0.5 bg-amber-300/90"
                style={{ left: bladeGuideX, height: laneHeight }}
              >
                <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 rounded bg-amber-300 px-1 text-[9px] font-medium text-zinc-950">
                  cut
                </div>
              </div>
            )}
          </div>
        </div>
      </DndContext>
    </section>
  );
}

function TrackLane({
  trackId,
  children,
  onMediaDrop,
  diffMarks = [],
  clashMarks = [],
}: {
  trackId: string;
  children: ReactNode;
  onMediaDrop: (
    trackId: string,
    clientX: number,
    laneEl: HTMLElement
  ) => (e: DragEvent) => void;
  diffMarks?: { start: number; end: number; clipId: string }[];
  clashMarks?: { start: number; end: number; id: string }[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `track:${trackId}`,
    data: { trackId },
  });
  const [mediaOver, setMediaOver] = useState(false);

  return (
    <div
      ref={setNodeRef}
      className={`relative h-12 border-b border-zinc-800/80 ${
        isOver || mediaOver ? "bg-zinc-800/60" : "bg-zinc-900/40"
      }`}
      style={{ width: RULER_SECONDS * PX_PER_SEC }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setMediaOver(true);
      }}
      onDragLeave={() => setMediaOver(false)}
      onDrop={(e) => {
        setMediaOver(false);
        onMediaDrop(trackId, e.clientX, e.currentTarget)(e);
      }}
    >
      {diffMarks.map((m, i) => (
        <div
          key={`diff-${m.clipId}-${i}`}
          className="pointer-events-none absolute top-0 z-0 h-full bg-sky-400/25 ring-1 ring-inset ring-sky-400/50"
          style={{
            left: m.start * PX_PER_SEC,
            width: Math.max(4, (m.end - m.start) * PX_PER_SEC),
          }}
          title="Changed"
        />
      ))}
      {clashMarks.map((m) => (
        <div
          key={`clash-${m.id}`}
          className="pointer-events-none absolute top-0 z-[1] h-full bg-amber-400/35 ring-1 ring-inset ring-amber-300/80"
          style={{
            left: m.start * PX_PER_SEC,
            width: Math.max(6, (m.end - m.start) * PX_PER_SEC),
          }}
          title="Clash — both sides edited here"
        />
      ))}
      {children}
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-0.5 ${
        active
          ? "bg-zinc-100 text-zinc-900"
          : "text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}
