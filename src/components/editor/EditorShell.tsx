"use client";

import { useState } from "react";
import { ComparePanel } from "@/components/editor/ComparePanel";
import { CompositionJsonPanel } from "@/components/editor/CompositionJsonPanel";
import { CompositionPreview } from "@/components/editor/CompositionPreview";
import { MediaBin } from "@/components/editor/MediaBin";
import { TimelinePanel } from "@/components/editor/TimelinePanel";
import { VersionBar } from "@/components/editor/VersionBar";
import { useWorkspaceStore } from "@/store/workspaceStore";

export function EditorShell() {
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [showComposition, setShowComposition] = useState(false);
  const workspaceName = useWorkspaceStore((s) => s.workspace.name);
  const mergeSession = useWorkspaceStore((s) => s.mergeSession);
  /** Bottom sheet only — story demo is a full-screen modal */
  const sheetOpen = mergeSession != null && mergeSession.story == null;

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex shrink-0 flex-col gap-2 border-b border-zinc-800 px-4 py-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex shrink-0 items-start gap-3 pt-0.5">
          <div>
            <h1 className="text-sm font-semibold tracking-tight">ChronoEdit</h1>
            <p className="text-[11px] text-zinc-500">
              {workspaceName} · Undo / Keep · Show clash demo = you vs teammate
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowComposition(true)}
            className="mt-0.5 rounded border border-zinc-600 px-2 py-1 text-[11px] text-zinc-300 hover:border-zinc-400 hover:text-zinc-100"
          >
            Composition
          </button>
        </div>
        <VersionBar />
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[240px_1fr] overflow-hidden">
        <div className="min-h-0 min-w-0 overflow-hidden">
          <MediaBin
            selectedAssetId={selectedAssetId}
            onSelectAsset={setSelectedAssetId}
          />
        </div>
        <div className="min-h-0 min-w-0 overflow-hidden">
          <CompositionPreview />
        </div>
      </div>

      <div
        className={`shrink-0 overflow-hidden ${sheetOpen ? "h-[160px]" : "h-[220px]"}`}
      >
        <TimelinePanel />
      </div>

      <ComparePanel />
      <CompositionJsonPanel
        open={showComposition}
        onClose={() => setShowComposition(false)}
      />
    </div>
  );
}
