"use client";

import { useMemo, useState } from "react";
import {
  NameVersionModal,
  type NameVersionMode,
} from "@/components/editor/NameVersionModal";
import { SavedTakeChoiceModal } from "@/components/editor/SavedTakeChoiceModal";
import { TakesFamilyTree } from "@/components/editor/TakesFamilyTree";
import { UndoConfirmModal } from "@/components/editor/UndoConfirmModal";
import { useWorkspaceStore } from "@/store/workspaceStore";

/**
 * Your cut or Copy & edit working copy → Save new / Update · AI only on Your cut
 */
export function VersionBar() {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const setActiveVersion = useWorkspaceStore((s) => s.setActiveVersion);
  const saveVersion = useWorkspaceStore((s) => s.saveVersion);
  const updateLastSave = useWorkspaceStore((s) => s.updateLastSave);
  const freezeWorkingCopy = useWorkspaceStore((s) => s.freezeWorkingCopy);
  const loadSaveOntoYourCut = useWorkspaceStore((s) => s.loadSaveOntoYourCut);
  const editFromFrozen = useWorkspaceStore((s) => s.editFromFrozen);
  const simulateAiEdit = useWorkspaceStore((s) => s.simulateAiEdit);
  const demoClash = useWorkspaceStore((s) => s.demoClash);
  const keepUnsaved = useWorkspaceStore((s) => s.keepUnsaved);
  const reviewOpen = useWorkspaceStore((s) => s.mergeSession != null);
  const statusMessage = useWorkspaceStore((s) => s.statusMessage);
  const clearStatusMessage = useWorkspaceStore((s) => s.clearStatusMessage);
  const unsavedPreview = useWorkspaceStore((s) => s.unsavedPreview);
  const [undoOpen, setUndoOpen] = useState(false);
  const [treeOpen, setTreeOpen] = useState(false);
  const [choiceTake, setChoiceTake] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [nameModal, setNameModal] = useState<{
    mode: NameVersionMode;
    defaultName: string;
    hint?: string;
    /** After Save new, run AI on your cut */
    afterSave?: "ai";
    /** Fork this locked take (Copy path) */
    fromVersionId?: string;
  } | null>(null);

  const activeId = workspace.activeVersionId;
  const mainId = workspace.mainVersionId;
  const active = workspace.versions.find((v) => v.id === activeId);
  const onYourCut = activeId === mainId;
  const viewingSaved = Boolean(active?.frozen);
  const onWorkingCopy = Boolean(active && !onYourCut && !active.frozen);
  const canSave = Boolean(active && !active.frozen);
  const hasUnsaved =
    Boolean(unsavedPreview && unsavedPreview.diffOps.length > 0) && onYourCut;

  const savedVersions = useMemo(
    () =>
      [...workspace.versions]
        .filter((v) => v.frozen)
        .sort((a, b) => b.createdAt - a.createdAt),
    [workspace.versions]
  );
  const lastSave = savedVersions[0];
  const savedCount = savedVersions.length;

  const parentSave = useMemo(() => {
    if (!active || onYourCut || active.frozen) return undefined;
    const parentId = active.parentVersionIds[0];
    if (!parentId) return undefined;
    return workspace.versions.find((v) => v.id === parentId && v.frozen);
  }, [active, onYourCut, workspace.versions]);

  /** Newest freeze created from this working copy (not the parent fork). */
  const childSave = useMemo(() => {
    if (!active || !onWorkingCopy) return undefined;
    return workspace.versions
      .filter((v) => v.frozen && v.parentVersionIds[0] === active.id)
      .sort((a, b) => b.createdAt - a.createdAt)[0];
  }, [active, onWorkingCopy, workspace.versions]);

  const updateTarget = onWorkingCopy ? childSave : lastSave;
  const canUpdateSave = canSave && Boolean(updateTarget);

  const hasClips = Boolean(
    active?.timeline.tracks.some((t) => t.clips.length > 0)
  );
  const mainHasV1Clip = useMemo(() => {
    const main = workspace.versions.find((v) => v.id === mainId);
    const v1 = main?.timeline.tracks.find((t) => t.id === "track_v1");
    return Boolean(v1 && v1.clips.length > 0);
  }, [workspace.versions, mainId]);

  const showSaveNudge =
    onYourCut && hasClips && savedCount === 0 && !hasUnsaved && !reviewOpen;

  function openSaveModal() {
    setNameModal({
      mode: "save",
      defaultName: `Version ${savedCount + 1}`,
      hint: onWorkingCopy
        ? `New locked take under “${active?.name ?? "this copy"}” — keeps this copy editable`
        : "Snapshot from your cut",
    });
  }

  function openCopyModal(fromId?: string, fromName?: string) {
    const id = fromId ?? (active?.frozen ? active.id : undefined);
    const takeName = fromName ?? (active?.frozen ? active.name : undefined);
    if (!id || !takeName) return;
    setNameModal({
      mode: "copy",
      defaultName: `${takeName} edit`,
      hint: `Fork from locked “${takeName}”`,
      fromVersionId: id,
    });
  }

  function handleTakesChange(nextId: string) {
    if (!nextId) return;
    const next = workspace.versions.find((v) => v.id === nextId);
    if (!next) return;
    // Locked save → always ask work-from / copy (even if already selected)
    if (next.frozen) {
      setChoiceTake({ id: next.id, name: next.name });
      return;
    }
    if (nextId === activeId) return;
    setActiveVersion(nextId);
  }

  function handleNameConfirm(name: string) {
    if (!nameModal) return;
    const mode = nameModal.mode;
    const after = nameModal.afterSave;
    const fromId = nameModal.fromVersionId;
    setNameModal(null);
    if (mode === "save") {
      saveVersion(name);
      if (after === "ai") simulateAiEdit();
    } else {
      editFromFrozen(name, fromId);
    }
  }

  function handleAi() {
    if (!onYourCut || viewingSaved) return;
    if (savedCount === 0 && hasClips) {
      setNameModal({
        mode: "save",
        defaultName: `Version ${savedCount + 1}`,
        hint: "Save = name take then AI. Cancel = AI now with no save.",
        afterSave: "ai",
      });
      return;
    }
    simulateAiEdit();
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-zinc-500">
        <span>
          <span className="text-zinc-300">1.</span> Edit your cut
        </span>
        <span>
          <span className="text-zinc-300">2.</span> Undo / Keep unsaved
        </span>
        <span>
          <span className="text-zinc-300">3.</span> Save when you want a snapshot
        </span>
        <span>
          <span className="text-amber-300/90">★</span> Show clash demo = you
          vs teammate
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTreeOpen(true)}
          className="rounded border border-zinc-600 px-2.5 py-1 text-xs text-zinc-200 hover:border-zinc-400 hover:bg-zinc-800"
          title="Parent → child map of Your cut and saves"
        >
          Takes tree
        </button>

        {!onYourCut && (
          <button
            type="button"
            onClick={() => setActiveVersion(mainId)}
            className="rounded border border-zinc-500 px-2.5 py-1 text-xs text-zinc-100 hover:bg-zinc-800"
          >
            Your cut
          </button>
        )}

        {onWorkingCopy && (
          <button
            type="button"
            onClick={() => freezeWorkingCopy()}
            className="rounded bg-emerald-500 px-2.5 py-1 text-xs font-medium text-zinc-950 hover:bg-emerald-400"
            title={`Lock “${active?.name ?? "this copy"}” with the current timeline`}
          >
            Save this take
          </button>
        )}

        <button
          type="button"
          disabled={!canSave}
          onClick={openSaveModal}
          className="rounded bg-sky-500 px-2.5 py-1 text-xs font-medium text-zinc-950 hover:bg-sky-400 disabled:opacity-40"
          title="Freeze a new Takes snapshot from this timeline"
        >
          Save new
        </button>

        <button
          type="button"
          disabled={!canUpdateSave}
          onClick={() => updateLastSave()}
          className="rounded border border-sky-500/60 px-2.5 py-1 text-xs text-sky-100 hover:bg-sky-500/15 disabled:opacity-40"
          title={
            updateTarget
              ? `Overwrite “${updateTarget.name}”`
              : onWorkingCopy
                ? "Save this take or Save new first"
                : "Save new once first"
          }
        >
          {onWorkingCopy ? "Update this take" : "Update last save"}
        </button>

        <button
          type="button"
          disabled={!onYourCut || viewingSaved || reviewOpen}
          onClick={handleAi}
          className="rounded bg-violet-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-400 disabled:opacity-40"
        >
          AI edit
        </button>

        <button
          type="button"
          disabled={
            !onYourCut || viewingSaved || reviewOpen || !mainHasV1Clip
          }
          onClick={() => demoClash()}
          className="rounded border border-amber-500/70 bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-100 hover:bg-amber-500/25 disabled:opacity-40"
          title="Opens a step-by-step: you vs teammate edited the same clip"
        >
          Show clash demo
        </button>

        {hasUnsaved && !reviewOpen && (
          <>
            <button
              type="button"
              onClick={() => setUndoOpen(true)}
              className="rounded border border-amber-500/70 px-2.5 py-1 text-xs text-amber-100 hover:bg-amber-500/15"
              title="See what will be undone, then confirm"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => keepUnsaved()}
              className="rounded border border-emerald-500/60 px-2.5 py-1 text-xs text-emerald-100 hover:bg-emerald-500/15"
            >
              Keep
            </button>
          </>
        )}

        {onYourCut && lastSave && !viewingSaved && (
          <button
            type="button"
            disabled={!lastSave}
            onClick={() =>
              setChoiceTake({ id: lastSave.id, name: lastSave.name })
            }
            className="rounded px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300"
            title="Open last Takes save — work from it or copy"
          >
            Open last save
          </button>
        )}
      </div>

      {showSaveNudge && (
        <p className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-100/95">
          Tip: edit freely → <strong>Undo / Keep</strong> for unsaved work.{" "}
          <strong>Save new</strong> only when you want a Takes snapshot.
        </p>
      )}
      {viewingSaved && (
        <p className="text-[11px] text-amber-200/90">
          Locked save — open <strong>Takes tree</strong> and click it to work
          from it or copy.
        </p>
      )}
      {onWorkingCopy && (
        <p className="text-[11px] text-amber-100/90">
          Editing “{active?.name}”
          {parentSave ? ` (from “${parentSave.name}”)` : ""}.{" "}
          <strong>Save this take</strong> = lock this copy ·{" "}
          <strong>Save new</strong> = another named child ·{" "}
          <strong>Update this take</strong>
          {childSave
            ? ` = refresh “${childSave.name}”`
            : " after Save new"}
          .
        </p>
      )}
      {hasUnsaved && (
        <p className="text-[11px] text-sky-200/90">
          Unsaved · <strong>Undo</strong> shows what you’ll revert ·{" "}
          <strong>Keep</strong> accepts · Save for Takes history
        </p>
      )}
      {onYourCut && !hasUnsaved && !showSaveNudge && (
        <p className="text-[11px] text-zinc-500">
          On your cut
          {lastSave ? ` · last save “${lastSave.name}”` : ""}.
        </p>
      )}

      {statusMessage && (
        <p className="flex items-start gap-2 text-[11px] text-emerald-400/90">
          <span className="min-w-0 flex-1">{statusMessage}</span>
          <button
            type="button"
            className="shrink-0 text-zinc-500 hover:text-zinc-300"
            onClick={() => clearStatusMessage()}
          >
            ✕
          </button>
        </p>
      )}

      <UndoConfirmModal open={undoOpen} onClose={() => setUndoOpen(false)} />
      <TakesFamilyTree
        open={treeOpen}
        versions={workspace.versions}
        mainId={mainId}
        activeId={activeId}
        onClose={() => setTreeOpen(false)}
        onSelect={handleTakesChange}
      />
      <SavedTakeChoiceModal
        open={choiceTake != null}
        takeName={choiceTake?.name ?? ""}
        onClose={() => setChoiceTake(null)}
        onWorkFromThere={() => {
          if (!choiceTake) return;
          const id = choiceTake.id;
          setChoiceTake(null);
          loadSaveOntoYourCut(id);
        }}
        onCopyNew={() => {
          if (!choiceTake) return;
          const { id, name } = choiceTake;
          setChoiceTake(null);
          openCopyModal(id, name);
        }}
      />
      <NameVersionModal
        open={nameModal != null}
        mode={nameModal?.mode ?? "save"}
        defaultName={nameModal?.defaultName ?? "Version 1"}
        hint={nameModal?.hint}
        onClose={() => {
          const after = nameModal?.afterSave;
          setNameModal(null);
          // Cancel on “save before AI” = AI without saving (old confirm Cancel)
          if (after === "ai") simulateAiEdit();
        }}
        onConfirm={handleNameConfirm}
      />
    </div>
  );
}
