"use client";

interface SavedTakeChoiceModalProps {
  open: boolean;
  takeName: string;
  onClose: () => void;
  /** Load this save onto Your cut and keep editing there */
  onWorkFromThere: () => void;
  /** Name a new editable copy forked from this save */
  onCopyNew: () => void;
}

/** Ask how to open a locked Takes save — no Chrome confirm. */
export function SavedTakeChoiceModal({
  open,
  takeName,
  onClose,
  onWorkFromThere,
  onCopyNew,
}: SavedTakeChoiceModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className="w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-950 shadow-xl"
        role="dialog"
        aria-labelledby="saved-take-title"
      >
        <header className="border-b border-zinc-800 px-4 py-3">
          <h2
            id="saved-take-title"
            className="text-sm font-semibold text-zinc-100"
          >
            Open “{takeName}”?
          </h2>
          <p className="mt-1 text-[12px] leading-snug text-zinc-400">
            This take is locked. How do you want to continue?
          </p>
        </header>

        <div className="flex flex-col gap-2 px-4 py-3">
          <button
            type="button"
            onClick={onWorkFromThere}
            className="rounded-lg border border-sky-500/50 bg-sky-500/10 px-3 py-3 text-left hover:bg-sky-500/20"
          >
            <span className="block text-sm font-medium text-sky-100">
              Work from there
            </span>
            <span className="mt-0.5 block text-[11px] text-zinc-400">
              Load this save onto Your cut. Keep editing the main cut from this
              point.
            </span>
          </button>
          <button
            type="button"
            onClick={onCopyNew}
            className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-3 text-left hover:bg-amber-500/20"
          >
            <span className="block text-sm font-medium text-amber-100">
              Copy & create new version
            </span>
            <span className="mt-0.5 block text-[11px] text-zinc-400">
              Keep the locked take. Name a new editable copy from this point.
            </span>
          </button>
        </div>

        <footer className="flex justify-end border-t border-zinc-800 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
}
