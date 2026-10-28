"use client";

import { useMemo } from "react";
import { useWorkspaceStore } from "@/store/workspaceStore";

interface CompositionJsonPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Shows the composition document (timeline JSON) for the active take.
 * Interview proof: we version this, not the MP4.
 */
export function CompositionJsonPanel({
  open,
  onClose,
}: CompositionJsonPanelProps) {
  const active = useWorkspaceStore((s) => s.getActiveVersion());
  const assets = useWorkspaceStore((s) => s.workspace.assets);

  const doc = useMemo(() => {
    if (!active) return null;
    return {
      versionId: active.id,
      name: active.name,
      label: active.label,
      frozen: Boolean(active.frozen),
      parentVersionIds: active.parentVersionIds,
      timeline: active.timeline,
      assets: assets.map(({ id, name, type, duration }) => ({
        id,
        name,
        type,
        duration,
        // objectUrl omitted — ephemeral; not part of the durable composition
      })),
    };
  }, [active, assets]);

  const text = doc ? JSON.stringify(doc, null, 2) : "";

  if (!open) return null;

  function download() {
    if (!doc) return;
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(doc.name || "composition").replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/50">
      <button
        type="button"
        className="flex-1 cursor-default"
        aria-label="Close composition panel"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-lg flex-col border-l border-zinc-700 bg-zinc-950 shadow-xl">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Composition</h2>
            <p className="text-[11px] text-zinc-500">
              Timeline JSON for this take — what versions store
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={download}
              disabled={!doc}
              className="rounded bg-sky-500 px-2.5 py-1 text-xs font-medium text-zinc-950 hover:bg-sky-400 disabled:opacity-40"
            >
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
            >
              Close
            </button>
          </div>
        </header>
        <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
          {text || "No active take"}
        </pre>
      </aside>
    </div>
  );
}
