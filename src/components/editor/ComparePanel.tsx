"use client";

import { useWorkspaceStore } from "@/store/workspaceStore";

/**
 * Conflict UI as a full teaching card — readable without timeline marks.
 * Demo clash always passes `story`.
 */
export function ComparePanel() {
  const session = useWorkspaceStore((s) => s.mergeSession);
  const resolveOverlap = useWorkspaceStore((s) => s.resolveOverlap);
  const updateMainFromSession = useWorkspaceStore(
    (s) => s.updateMainFromSession
  );
  const closeMergeSession = useWorkspaceStore((s) => s.closeMergeSession);

  if (!session) return null;

  const unresolved = session.overlaps.filter((o) => !session.resolutions[o.id]);
  const ready = unresolved.length === 0;
  const story = session.story;
  const firstClash = session.overlaps[0];
  const choice = firstClash
    ? session.resolutions[firstClash.id]
    : undefined;

  // Demo / teaching layout — big modal, numbered steps
  if (story) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-zinc-600 bg-zinc-950 shadow-2xl">
          <header className="shrink-0 border-b border-zinc-800 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">
              Clash demo · two editors, one timeline
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-zinc-50">
              You and a teammate both changed the same clip
            </h2>
            <p className="mt-1 text-[12px] leading-snug text-zinc-400">
              Like CapCut / Premiere — not git. Read steps 1–3, then pick which
              move stays in the final cut.
            </p>
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 text-[13px] leading-snug">
            <section className="rounded-lg border border-sky-500/40 bg-sky-500/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-sky-300">
                Step 1 · What you did
              </p>
              <ul className="mt-1.5 list-inside list-disc text-zinc-100">
                {story.yours.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>

            <section className="rounded-lg border border-violet-500/40 bg-violet-500/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-violet-300">
                Step 2 · What your teammate did
              </p>
              <ul className="mt-1.5 list-inside list-disc text-zinc-100">
                {story.other.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>

            <section className="rounded-lg border-2 border-amber-400 bg-amber-500/15 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-300">
                Step 3 · The clash
              </p>
              <p className="mt-1.5 text-zinc-50">{story.conflict}</p>
              <p className="mt-2 text-[12px] text-zinc-400">{story.autoMerge}</p>
            </section>

            {firstClash && (
              <section className="rounded-lg border border-zinc-600 bg-zinc-900 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                  Step 4 · What should the final cut use?
                </p>
                <p className="mt-1 text-[12px] text-zinc-500">
                  Click one. Then finish with the green button.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => resolveOverlap(firstClash.id, "ours")}
                    className={`flex-1 rounded-lg px-3 py-3 text-left text-sm font-medium ${
                      choice === "ours"
                        ? "bg-sky-500 text-zinc-950 ring-2 ring-white"
                        : "border border-sky-500/60 bg-sky-500/10 text-sky-50 hover:bg-sky-500/20"
                    }`}
                  >
                    <span className="block text-[10px] font-bold uppercase opacity-80">
                      Option A
                    </span>
                    Keep your drag
                    <span className="mt-0.5 block text-[11px] font-normal opacity-80">
                      Clip stays where you put it (+0.8s)
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => resolveOverlap(firstClash.id, "theirs")}
                    className={`flex-1 rounded-lg px-3 py-3 text-left text-sm font-medium ${
                      choice === "theirs"
                        ? "bg-violet-500 text-white ring-2 ring-white"
                        : "border border-violet-500/60 bg-violet-500/10 text-violet-50 hover:bg-violet-500/20"
                    }`}
                  >
                    <span className="block text-[10px] font-bold uppercase opacity-80">
                      Option B
                    </span>
                    Keep their drag
                    <span className="mt-0.5 block text-[11px] font-normal opacity-80">
                      Clip jumps to their spot (+2.0s)
                    </span>
                  </button>
                </div>
              </section>
            )}

            {ready && (
              <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-[12px] text-emerald-200">
                Choice saved. Hit <strong>Finish — update your cut</strong> to
                write the merged timeline.
              </p>
            )}
          </div>

          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-zinc-800 px-4 py-3">
            <button
              type="button"
              onClick={() => closeMergeSession()}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Cancel demo
            </button>
            <button
              type="button"
              disabled={!ready}
              onClick={() => updateMainFromSession()}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Finish — update your cut
            </button>
          </footer>
        </div>
      </div>
    );
  }

  // Generic merge (no teaching story) — compact bottom sheet
  return (
    <div className="flex max-h-[40%] min-h-[140px] flex-col border-t-2 border-amber-500/50 bg-zinc-900">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">
            Resolve conflicts
          </h2>
          <p className="text-[11px] text-zinc-400">
            {session.theirsName} ↔ your cut
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!ready}
            onClick={() => updateMainFromSession()}
            className="rounded bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 disabled:opacity-40"
          >
            Make this your cut
          </button>
          <button
            type="button"
            onClick={() => closeMergeSession()}
            className="rounded px-2 py-1 text-xs text-zinc-400"
          >
            Not now
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {session.overlaps.map((o) => (
          <div
            key={o.id}
            className="mb-2 rounded border border-amber-500/40 p-2"
          >
            <p className="text-xs text-amber-100">{o.reason}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => resolveOverlap(o.id, "ours")}
                className="rounded border border-zinc-600 px-2 py-1 text-[11px]"
              >
                Keep yours
              </button>
              <button
                type="button"
                onClick={() => resolveOverlap(o.id, "theirs")}
                className="rounded border border-zinc-600 px-2 py-1 text-[11px]"
              >
                Use other
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
