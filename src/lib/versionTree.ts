import type { Version } from "@/types/timeline";

export interface VersionTreeRow {
  version: Version;
  depth: number;
}

/**
 * Flatten versions into indented rows under Your cut (main).
 * Parent = first parentVersionIds entry. Orphans hang under main.
 */
export function buildVersionTreeRows(
  versions: Version[],
  mainId: string
): VersionTreeRow[] {
  const byParent = new Map<string, Version[]>();

  for (const v of versions) {
    if (v.id === mainId) continue;
    const rawParent = v.parentVersionIds[0];
    const parentId =
      rawParent && versions.some((x) => x.id === rawParent)
        ? rawParent
        : mainId;
    const list = byParent.get(parentId) ?? [];
    list.push(v);
    byParent.set(parentId, list);
  }

  for (const list of byParent.values()) {
    list.sort((a, b) => a.createdAt - b.createdAt);
  }

  const rows: VersionTreeRow[] = [];
  const main = versions.find((v) => v.id === mainId);
  if (main) {
    rows.push({ version: main, depth: 0 });
    walk(main.id, 1);
  }

  function walk(parentId: string, depth: number) {
    const kids = byParent.get(parentId) ?? [];
    for (const kid of kids) {
      rows.push({ version: kid, depth });
      walk(kid.id, depth + 1);
    }
  }

  return rows;
}

export function versionKindTag(
  version: Version,
  mainId: string
): "your cut" | "saved" | "copy" {
  if (version.id === mainId) return "your cut";
  if (version.frozen) return "saved";
  return "copy";
}
