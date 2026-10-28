# ChronoEdit — Agentic Video Timeline & Version Control Engine

> Personal project + targeted solution for [Cardboard.ai Hard Problem #10](https://www.cardboard.ai/hard-problems) (Version Control), with a thin slice of #02 (Collaboration).  
> We build the **state / version / merge engine**, not a full NLE.

---

## 0. About me (learning while building)

I am **learning by building** this project. Goals:

- Understand real architecture for timeline state, versioning, diff/merge, and (later) CRDTs — not just copy-paste an app
- Be able to **explain every phase in interviews** (why JSON timelines, why overlaps ≠ git line conflicts, why CRDT ≠ version control)
- Ship a credible demo that maps to Cardboard’s hard problems, as a personal portfolio piece

**How agents should work with me:**

1. One phase at a time — teach as we go  
2. End of phase → short architecture recap in plain language → ask before next phase  
3. Prefer small files and clear names so I can read and re-explain the code  
4. Call out tradeoffs when we skip something (Postgres, WebCodecs, full multiplayer)

Rules that enforce this live in `.cursor/rules/chronoedit.mdc` (always on) and `.cursor/rules/timeline-model.mdc` (when editing TS/TSX).

---

## 1. Why this exists

**Cardboard** = browser-based agentic video editor. Editors + an AI agent work in a **workspace**. Today video “versioning” is often `final_v3_actual (1).mp4`. Git does not translate: editors don’t think in commits; a conflict is a region of time on a track, not a few lines of text.

**ChronoEdit proves:**

1. Timeline is a JSON document (edit decisions), media is referenced by id/hash.  
2. Multiple **Versions** in one **Workspace** (human editors + agent drafts).  
3. **Compare** shows a timeline diff humans understand.  
4. **Overlaps** are resolved in a player/timeline UI without git literacy.  
5. (Later) Live multiplayer on one version via CRDT — without erasing the VCS story.

### Non-goals (v1)

- Effects, grading, motion graphics, captions AI, export encoding  
- WebCodecs / FFmpeg / proxy generation  
- Full asset sync across devices (Cardboard #02 deep infra)  
- Teaching users git concepts in the UI  

### Demo pitch (one line)

> A workspace where multiple editors and an agent each keep a cut of the same footage, then Compare and resolve Overlaps to update the main cut — no git required.

---

## 2. Tech stack

| Layer | Choice | Notes |
|-------|--------|--------|
| App | Next.js (App Router), React, TypeScript | |
| UI | Tailwind, Lucide | Dark, minimal |
| Client state | Zustand | Timeline + versions |
| DnD | `@dnd-kit/core` | Do not use react-beautiful-dnd |
| Media | `URL.createObjectURL` + `<video>` / `<audio>` | Local only; no upload required for demo |
| Persistence (early) | Memory + optional JSON download | Enough for Phases 1–5 |
| Persistence (later) | Prisma + Postgres event/snapshot log | Only when we start that phase |
| Live collab (Phase 6) | Yjs (+ y-zustand or y-protocols) | Sync **one** active version — not a replacement for merge |

---

## 3. Core concepts (learn these)

| Concept | Meaning |
|---------|---------|
| Workspace | One project: shared media bin + many versions |
| MediaAsset | File reference (`objectUrl`); not versioned as bytes in v1 |
| Timeline | Tracks → clips (JSON). This is what we version |
| Version | UI: **Your cut** + human **saves** only (demo: no separate AI take) |
| Snapshot / base | Frozen save JSON; also in-memory before-AI for Undo |
| Diff | Clip ops + timeline marks after AI (vs before-AI snapshot) |
| AI (demo UX) | Edits **Your cut** in place → Undo AI or Save |
| Overlap / Clash | Engine still exists for later multi-cut product; not primary demo UI |

**Do not call the timeline an “AST” in interviews** — say **timeline document** or **composition JSON**.

**Two collaboration modes (do not conflate):**

- **Version control (#10):** diverge → compare → resolve overlaps → merge.  
- **Live sync (#02):** multiple cursors on one version; CRDT merges ops. Different problem.

---

## 4. Target data model (Phase 1 should match this spirit)

```ts
type MediaType = "video" | "audio" | "image";

interface MediaAsset {
  id: string;
  name: string;
  type: MediaType;
  objectUrl: string;      // createObjectURL — gone on refresh (OK for demo)
  duration?: number;      // seconds, from metadata when available
}

interface TimelineClip {
  id: string;
  assetId: string;
  trackId: string;
  timelineStart: number;  // seconds on the timeline
  trimStart: number;      // seconds into the source
  trimEnd: number;        // seconds into the source
}

interface Track {
  id: string;
  type: "video" | "audio" | "text";
  name: string;
  clips: TimelineClip[];
}

interface Timeline {
  tracks: Track[];        // v1: 2 video + 1 audio is enough
  duration?: number;
}

interface Version {
  id: string;
  name: string;           // UI label
  timeline: Timeline;
  parentVersionIds: string[]; // 0 = root; 1 = linear; 2 = merge
  createdAt: number;
  label?: string;         // "Simulate AI Edit", "Priya save", etc.
}

interface Workspace {
  id: string;
  name: string;
  assets: MediaAsset[];
  versions: Version[];
  activeVersionId: string;
  mainVersionId: string;
}
```

**Split tool:** one clip → two clips, same `assetId`, trims adjusted; no new media file.  
**Time unit:** seconds in v1 (easier with HTML5). Note in code comments.

---

## 5. Rules of engagement (for every agent)

1. **One phase at a time.** No full-app generation.  
2. End of phase → **explain architecture** (interview style) → **ask permission** for next phase.  
3. Keep files small and separated (types / store / ui / merge).  
4. UI: dark, minimal, product words (Version / Compare / Overlap).  
5. I am **learning** — explain why, not only what.  
6. `info.md` + `.cursor/rules/` are source of truth; update them when design changes.

---

## 6. Roadmap

### Phase 1 — Types + Zustand store
- Implement types above (can simplify field names slightly but keep concepts).  
- Zustand store: workspace, assets, versions, activeVersionId; actions: addAsset, setActiveVersion, updateActiveTimeline helpers.  
- **Stop.** Explain store shape and why timeline ≠ media file. Wait.

### Phase 2 — Shell UI + local media
- 3 panes: Media Bin | Preview | Timeline (3 tracks visual).  
- File input → `createObjectURL` → `MediaAsset` in store.  
- **Stop.** Explain object URLs and refresh limitation. Wait.

### Phase 3 — Timeline engine (JSON ops)
- Render clips; drag to change `timelineStart`.  
- Blade/split: split clip JSON as specified.  
- **Stop.** Explain move/split as pure state transforms. Wait.

### Phase 4 — Playhead sync (scoped)
- Scope v1: **1 video track + 1 audio track** driving preview.  
- Playhead ↔ `requestAnimationFrame` ↔ `<video>.currentTime` for active clip.  
- **Stop.** Explain sync loop. Wait.

### Phase 5 — Version control + agent simulation (CORE PITCH)
Must include all of:
1. Version switcher (not “git branch” labeling).  
2. **Simulate AI Edit:** fork active timeline → new Version → programmatic edits (split/move/trim).  
3. **Compare view:** diff ops list + highlight changed regions (even if simple).  
4. **Three-way merge:** common base + ours + theirs.  
5. Auto-merge non-overlapping changes; **Overlap** cards: Keep yours / Keep theirs (split optional).  
6. **Update main** writes a new Version with two parents (merge).  

**Stop.** Explain merge vs “replace whole timeline.” Wait.

### Phase 5b (optional) — Workspace multi-editor simulation
- Fake editors (Priya / Sam) as version authors; version list shows who/what.  
- Still one browser; no real auth.

### Phase 6 — Yjs (optional boss level)
- Collaborate on **one** active version’s timeline.  
- Explicitly document: CRDT ≠ semantic video merge; Overlap UI remains for version combine.  
- **Stop.** Explain the boundary. Wait.

### Later (only if needed)
- Prisma snapshot/event log, shareable workspace id, export timeline JSON.

---

## 7. Success criteria for the portfolio demo

- [x] Upload local video; scrub/play via timeline JSON.  
- [x] Move + split clips without touching media bytes.  
- [x] Create agent draft version without destroying Main.  
- [x] Compare shows what changed in human language / marks.  
- [x] Overlap can be resolved without taking the entire other version blindly.  
- [ ] I can explain Version vs live CRDT in under 60 seconds. (Phase 6 optional)

---

## 8. Current phase

**Phase 5 complete.** Optional next: Phase 5b (multi-editor sim) or Phase 6 (Yjs).

When starting work, agent must: read this file + `.cursor/rules/chronoedit.mdc`, implement **one phase only**, explain in learning/interview style, then wait for my go-ahead.

### Phase log
| Phase | Status | Date |
|-------|--------|------|
| 1 Types + Zustand | Done | 2026-10-24 |
| 2 UI + media | Done | 2026-10-25 |
| 3 Move + split | Done | 2026-10-25 |
| 4 Playhead sync | Done | 2026-10-26 |
| 5 Version control + merge | Done | 2026-10-26 |
| 5b Multi-editor sim | Optional | |
| 6 Yjs | Optional | |
```