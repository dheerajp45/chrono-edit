"use client";

import { useWorkspaceStore } from "@/store/workspaceStore";

interface UndoConfirmModalProps {
  open: boolean;
  onClose: () => void;
}

/** Shown only when user clicks Undo — lists what will be reverted. */
export function UndoConfirmModal({ open, onClose }: UndoConfirmModalProps) {
  const preview = useWorkspaceStore((s) => s.unsavedPreview);
  const undoUnsaved = useWorkspaceStore((s) => s.undoUnsaved);

  if (!open || !preview || preview.diffOps.length === 0) return null;

  function confirmUndo() {
    undoUnsaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-lg border border-zinc-700 bg-zinc-950 shadow-xl"
        role="dialog"
        aria-labelledby="undo-title"
      >
        <header className="shrink-0 border-b border-zinc-800 px-4 py-3">
          <h2 id="undo-title" className="text-sm font-semibold text-zinc-100">
            Undo these changes?
          </h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Back to start of this unsaved batch on your cut — not a Takes save
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {preview.notes.length > 0 && (
            <p className="mb-2 text-[11px] text-sky-200/90">
              {preview.notes.join(" · ")}
            </p>
          )}
          <ul className="space-y-1.5">
            {preview.diffOps.map((op, i) => (
              <li
                key={`${op.clipId}-${i}`}
                className="rounded border border-zinc-800 bg-zinc-900/80 px-2 py-1.5 text-xs text-zinc-300"
              >
                {op.summary}
              </li>
            ))}
          </ul>
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-zinc-800 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmUndo}
            className="rounded bg-amber-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400"
          >
            Undo these
          </button>
        </footer>
      </div>
    </div>
  );
}
