# ChronoEdit

Personal prototype for [Cardboard.ai Hard Problem #10 — Version Control](https://www.cardboard.ai/hard-problems).

Video today is often versioned as `final_v3_actual (1).mp4`. Git doesn’t map: editors don’t think in commits, and a conflict is a **region of time on a track**, not a few lines of text.

**ChronoEdit versions the edit decision list (timeline JSON), not rendered media** — so humans and an AI agent can save takes, fork from a save, work in parallel on the same project, and resolve overlaps in editor language.

> Scope of this demo: **#10 Version Control only**. Live multiplayer / CRDT (#02 Collaboration) is a different problem and is not claimed here.

We build the **state / version / merge engine**, not a full NLE (no effects, grading, or export encoding).

---

## Why this approach

| Idea | Why it matters for #10 |
|------|-------------------------|
| Timeline-as-JSON | Cheap to copy, diff, and merge; agents can propose the same ops as humans |
| Your cut + locked takes | Editors understand “save a version,” not git commits |
| Fork (Copy & edit) + Takes tree | Parallel work from any save without destroying history |
| Overlap = time × track | Conflicts match how editors think; resolve Keep yours / Keep theirs |
| AI edit in place | Agent is another producer of timeline ops on the working cut |

**Parallel** in #10 means separate cuts/drafts that later merge — not live cursors on one timeline.

---

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

1. Import a short local video into Media  
2. Drop it on **Video 1**  
3. Edit on **Your cut** → **Undo / Keep** for unsaved work → **Save new** for a locked take  

Media uses `URL.createObjectURL` (local only; gone on refresh — fine for a prototype).

---

## Demo flows (product words)

| Flow | What to click |
|------|----------------|
| Human saves | Edit → **Save new** (name modal) → locked take in history |
| Open a save | **Takes tree** → pick a take → **Work from there** or **Copy & create new version** |
| Working copy | **Save this take** (lock this copy) · **Save new** (new child) · **Update this take** (refresh a child save under *this* copy) |
| AI | **AI edit** on Your cut → **Undo** / **Keep** → Save if you want history |
| Parallel clash | **Show clash demo** — simulates two cuts diverging on the same clip, then the real overlap-resolve UI |

**Show clash demo** is an honest *simulation of setup* (one-click parallel divergence for the Loom). The merge path and resolve UX are real: auto-keep non-overlapping edits; pick when the same clip was moved two ways.

---

## Stack

- Next.js (App Router), React, TypeScript, Tailwind  
- Zustand for workspace / timeline / versions  
- `@dnd-kit` for timeline drag  
- Three-way merge + overlap resolve in `src/lib/mergeOps.ts`

Key folders:

```
src/types/timeline.ts      # Workspace, Version, Timeline, Clip
src/store/workspaceStore.ts
src/lib/diffOps.ts         # Semantic timeline diff
src/lib/mergeOps.ts        # Three-way merge + overlaps
src/components/editor/     # Shell, timeline, compare / clash UI
```

Deeper roadmap notes live in [`info.md`](./info.md).

---

## What’s in / out

**In (demo):** local media, move/trim/split, Your cut, named saves, fork/copy, Takes family tree, in-place AI sim, clash teaching + resolve, composition JSON panel.

**Out (on purpose):** Premiere-like effects, WebCodecs/FFmpeg, Postgres persistence, live multiplayer (#02), git vocabulary in the UI.

---

## One-liner

> A workspace where humans and an agent keep cuts of the same footage as timeline JSON, then compare and resolve time overlaps to update the main cut — no git required.
