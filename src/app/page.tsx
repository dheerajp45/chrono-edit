"use client";

import dynamic from "next/dynamic";

/**
 * Full editor is client-only: Zustand + blob URLs + <video> must not SSR.
 * Avoids hydration mismatches (and browser extensions that inject attrs on <video>).
 */
const EditorShell = dynamic(
  () =>
    import("@/components/editor/EditorShell").then((m) => m.EditorShell),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-500">
        Loading editor…
      </div>
    ),
  }
);

export default function HomePage() {
  return <EditorShell />;
}
