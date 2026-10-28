"use client";

import {
  buildVersionTreeRows,
  versionKindTag,
} from "@/lib/versionTree";
import type { Version } from "@/types/timeline";

interface TakesFamilyTreeProps {
  open: boolean;
  versions: Version[];
  mainId: string;
  activeId: string;
  onClose: () => void;
  onSelect: (versionId: string) => void;
}

/** Popup parent→child Takes map. Click a take = same as old dropdown. */
export function TakesFamilyTree({
  open,
  versions,
  mainId,
  activeId,
  onClose,
  onSelect,
}: TakesFamilyTreeProps) {
  if (!open) return null;

  const rows = buildVersionTreeRows(versions, mainId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 shadow-xl"
        role="dialog"
        aria-labelledby="takes-tree-title"
      >
        <header className="shrink-0 border-b border-zinc-800 px-4 py-3">
          <h2
            id="takes-tree-title"
            className="text-sm font-semibold text-zinc-100"
          >
            Takes family
          </h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Click a take to open it. Locked saves ask work-from or copy.
          </p>
        </header>

        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          {rows.map(({ version, depth }) => {
            const active = version.id === activeId;
            const tag = versionKindTag(version, mainId);
            return (
              <li key={version.id} style={{ paddingLeft: depth * 14 }}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(version.id);
                    onClose();
                  }}
                  className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[12px] ${
                    active
                      ? "bg-sky-500/20 text-sky-100 ring-1 ring-sky-500/40"
                      : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50"
                  }`}
                >
                  {depth > 0 && (
                    <span className="shrink-0 text-zinc-600" aria-hidden>
                      └
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {version.name}
                  </span>
                  <span
                    className={`shrink-0 text-[9px] uppercase tracking-wide ${
                      tag === "your cut"
                        ? "text-sky-400/90"
                        : tag === "saved"
                          ? "text-emerald-400/80"
                          : "text-amber-400/80"
                    }`}
                  >
                    {tag}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <footer className="flex shrink-0 justify-end border-t border-zinc-800 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
