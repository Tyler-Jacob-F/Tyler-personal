import type { DiffResponse, FrontmatterChange, Version } from '@the-keep/shared';
import { createPatch } from 'diff';

/** Unified diff of the body plus a key-by-key diff of the frontmatter, both server-side. */
export function diffVersions(slug: string, from: Version, to: Version): DiffResponse {
  const ref = (v: Version) => ({
    number: v.number,
    summary: v.summary,
    author: v.author,
    createdAt: v.createdAt,
  });
  return {
    from: ref(from),
    to: ref(to),
    body: createPatch(`${slug}.md`, from.body, to.body, `v${from.number}`, `v${to.number}`),
    frontmatter: diffFrontmatter(from.frontmatter, to.frontmatter),
  };
}

/**
 * Top-level keys only, which is what a recipe's frontmatter has. Values compare as
 * canonical JSON so key order inside a nested value does not read as a change.
 */
export function diffFrontmatter(
  from: Record<string, unknown>,
  to: Record<string, unknown>,
): FrontmatterChange[] {
  const keys = [...new Set([...Object.keys(from), ...Object.keys(to)])].sort();
  const changes: FrontmatterChange[] = [];
  for (const key of keys) {
    const inFrom = key in from;
    const inTo = key in to;
    if (inFrom && !inTo) changes.push({ key, change: 'removed', from: from[key] });
    else if (!inFrom && inTo) changes.push({ key, change: 'added', to: to[key] });
    else if (canonical(from[key]) !== canonical(to[key])) {
      changes.push({ key, change: 'changed', from: from[key], to: to[key] });
    }
  }
  return changes;
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
}
