"use client";

import { useRef } from "react";
import { MEDIA_DRAG_MIME } from "@/lib/mediaDrag";
import { mediaTypeFromFile, readMediaDuration } from "@/lib/mediaType";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { MediaAsset } from "@/types/timeline";

interface MediaBinProps {
  selectedAssetId: string | null;
  onSelectAsset: (id: string | null) => void;
}

export function MediaBin({ selectedAssetId, onSelectAsset }: MediaBinProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const assets = useWorkspaceStore((s) => s.workspace.assets);
  const addAsset = useWorkspaceStore((s) => s.addAsset);
  const addAssetToTimeline = useWorkspaceStore((s) => s.addAssetToTimeline);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;

    for (const file of Array.from(fileList)) {
      const type = mediaTypeFromFile(file);
      if (!type) continue;

      const objectUrl = URL.createObjectURL(file);
      const duration = await readMediaDuration(objectUrl, type);

      const id = addAsset({
        name: file.name,
        type,
        objectUrl,
        duration,
      });
      onSelectAsset(id);
    }

    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden border-r border-zinc-800 bg-zinc-950">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-3 py-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Media
        </h2>
        <button
          type="button"
          className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-900 hover:bg-white"
          onClick={() => inputRef.current?.click()}
        >
          Import
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="video/*,audio/*,image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </header>

      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2">
        {assets.length === 0 && (
          <li className="px-2 py-6 text-center text-xs leading-relaxed text-zinc-500">
            Import media, then <span className="text-zinc-300">drag</span> onto
            the timeline (or Add). That starts{" "}
            <span className="text-zinc-300">your cut</span>.
          </li>
        )}
        {assets.map((asset) => (
          <AssetRow
            key={asset.id}
            asset={asset}
            selected={asset.id === selectedAssetId}
            onSelect={() => onSelectAsset(asset.id)}
            onAddToTimeline={() => addAssetToTimeline(asset.id)}
          />
        ))}
      </ul>
    </section>
  );
}

function AssetRow({
  asset,
  selected,
  onSelect,
  onAddToTimeline,
}: {
  asset: MediaAsset;
  selected: boolean;
  onSelect: () => void;
  onAddToTimeline: () => void;
}) {
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(MEDIA_DRAG_MIME, asset.id);
        e.dataTransfer.setData("text/plain", asset.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      className={`shrink-0 cursor-grab rounded-md px-2 py-2 text-sm transition active:cursor-grabbing ${
        selected
          ? "bg-zinc-700 text-zinc-50"
          : "text-zinc-300 hover:bg-zinc-900"
      }`}
    >
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="truncate font-medium">{asset.name}</div>
        <div className="mt-0.5 text-xs text-zinc-500">
          {asset.type}
          {asset.duration != null ? ` · ${asset.duration.toFixed(1)}s` : ""}
          <span className="text-zinc-600"> · drag to timeline</span>
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAddToTimeline();
        }}
        className="mt-1.5 w-full rounded border border-zinc-600 px-2 py-1 text-[11px] text-zinc-300 hover:border-zinc-400 hover:text-zinc-100"
      >
        Add to timeline
      </button>
    </li>
  );
}
