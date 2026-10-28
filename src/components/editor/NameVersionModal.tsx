"use client";

import { useEffect, useRef, useState } from "react";

export type NameVersionMode = "save" | "copy";

interface NameVersionModalProps {
  open: boolean;
  mode: NameVersionMode;
  defaultName: string;
  /** Extra context under the title (e.g. parent save name) */
  hint?: string;
  onClose: () => void;
  onConfirm: (name: string) => void;
}

/** In-app name dialog — no browser prompt. */
export function NameVersionModal({
  open,
  mode,
  defaultName,
  hint,
  onClose,
  onConfirm,
}: NameVersionModalProps) {
  const [name, setName] = useState(defaultName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(defaultName);
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open, defaultName]);

  if (!open) return null;

  const title =
    mode === "copy" ? "Name this new take" : "Name this save";
  const subtitle =
    mode === "copy"
      ? "Starts an editable copy from the locked save. Name the new point."
      : "Freezes a Takes snapshot from the timeline you’re on.";
  const confirmLabel = mode === "copy" ? "Create & edit" : "Save";

  function submit() {
    const trimmed = name.trim() || defaultName;
    onConfirm(trimmed);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className="w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-950 shadow-xl"
        role="dialog"
        aria-labelledby="name-version-title"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter") submit();
        }}
      >
        <header className="border-b border-zinc-800 px-4 py-3">
          <h2
            id="name-version-title"
            className="text-sm font-semibold text-zinc-100"
          >
            {title}
          </h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">{subtitle}</p>
          {hint && (
            <p className="mt-1 text-[11px] text-amber-200/80">{hint}</p>
          )}
        </header>

        <div className="px-4 py-3">
          <label className="block text-[11px] text-zinc-400" htmlFor="version-name">
            Name
          </label>
          <input
            id="version-name"
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500"
            autoComplete="off"
          />
        </div>

        <footer className="flex justify-end gap-2 border-t border-zinc-800 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded bg-sky-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-sky-400"
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
