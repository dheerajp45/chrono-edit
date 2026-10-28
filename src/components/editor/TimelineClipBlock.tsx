"use client";

import {
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { PX_PER_SEC } from "@/lib/timelineConstants";
import type { TimelineClip } from "@/types/timeline";

export type TimelineTool = "select" | "blade";

interface TimelineClipBlockProps {
  clip: TimelineClip;
  label: string;
  tool: TimelineTool;
  selected: boolean;
  onSelect: (clipId: string) => void;
  onBladeClick: (clipId: string, timelineTime: number) => void;
  onBladeHoverX?: (xPx: number | null) => void;
  onDelete: (clipId: string) => void;
  onTrim: (clipId: string, edge: "start" | "end", deltaSeconds: number) => void;
}

export function TimelineClipBlock({
  clip,
  label,
  tool,
  selected,
  onSelect,
  onBladeClick,
  onBladeHoverX,
  onDelete,
  onTrim,
}: TimelineClipBlockProps) {
  const [bladeXInClip, setBladeXInClip] = useState<number | null>(null);
  const trimming = useRef(false);
  const duration = Math.max(0.05, clip.trimEnd - clip.trimStart);
  const width = Math.max(8, duration * PX_PER_SEC);
  const left = clip.timelineStart * PX_PER_SEC;

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: clip.id,
      data: { trackId: clip.trackId, timelineStart: clip.timelineStart },
      disabled: tool === "blade" || trimming.current,
    });

  const style: CSSProperties = {
    left,
    width,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.85 : 1,
    zIndex: isDragging ? 20 : selected ? 15 : 1,
    cursor: tool === "blade" ? "cell" : isDragging ? "grabbing" : "grab",
  };

  function handleClick(e: MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (tool === "blade") {
      const rect = e.currentTarget.getBoundingClientRect();
      const xInClip = e.clientX - rect.left;
      const offsetSec = xInClip / PX_PER_SEC;
      onBladeClick(clip.id, clip.timelineStart + offsetSec);
      return;
    }
    onSelect(clip.id);
  }

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    if (tool !== "blade") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xInClip = e.clientX - rect.left;
    setBladeXInClip(xInClip);
    onBladeHoverX?.(left + xInClip);
  }

  function handleMouseLeave() {
    setBladeXInClip(null);
    onBladeHoverX?.(null);
  }

  function startTrim(
    e: ReactPointerEvent<HTMLButtonElement>,
    edge: "start" | "end"
  ) {
    e.stopPropagation();
    e.preventDefault();
    onSelect(clip.id);
    trimming.current = true;

    const startX = e.clientX;
    const pointerId = e.pointerId;
    const target = e.currentTarget;
    target.setPointerCapture(pointerId);

    let lastX = startX;

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - lastX;
      lastX = ev.clientX;
      const deltaSec = dx / PX_PER_SEC;
      if (Math.abs(deltaSec) < 0.001) return;
      onTrim(clip.id, edge, deltaSec);
    }

    function onUp() {
      trimming.current = false;
      target.releasePointerCapture(pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`absolute top-1.5 h-9 select-none truncate rounded text-[10px] leading-9 text-sky-50 shadow-sm ${
        selected
          ? "bg-sky-500 ring-2 ring-white/80"
          : "bg-sky-700/90 ring-1 ring-sky-500/40"
      }`}
      title={
        tool === "blade"
          ? "Click to split here"
          : `${label} · ${duration.toFixed(1)}s · drag edges to trim`
      }
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      {...(tool === "select" ? { ...listeners, ...attributes } : {})}
    >
      <span className="pointer-events-none px-2 pr-5">{label}</span>

      {selected && tool === "select" && (
        <>
          <button
            type="button"
            className="absolute left-0 top-0 z-10 h-full w-1.5 cursor-ew-resize rounded-l bg-white/80 hover:bg-white"
            title="Trim start"
            onPointerDown={(e) => startTrim(e, "start")}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-ew-resize rounded-r bg-white/80 hover:bg-white"
            title="Trim end"
            onPointerDown={(e) => startTrim(e, "end")}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="absolute right-2 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded bg-rose-600 text-[11px] font-bold leading-none text-white hover:bg-rose-500"
            title="Delete clip from timeline"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(clip.id);
            }}
          >
            ×
          </button>
        </>
      )}

      {tool === "blade" && bladeXInClip != null && (
        <div
          className="pointer-events-none absolute top-0 z-10 h-full w-0.5 bg-amber-300 shadow-[0_0_6px_rgba(252,211,77,0.9)]"
          style={{ left: bladeXInClip }}
        />
      )}
    </div>
  );
}
