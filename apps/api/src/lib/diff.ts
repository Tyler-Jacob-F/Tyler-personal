import {
  type DiffResponse,
  type FrontmatterChange,
  type IngredientGroup,
  type IngredientGroupDiff,
  ingredientGroupSchema,
  type Version,
} from '@the-keep/shared';
import { createPatch, diffArrays } from 'diff';
import { z } from 'zod';

/**
 * Unified diff of the body plus a key-by-key diff of the frontmatter, both server-side.
 * Recipes also get their ingredients diffed line by line within each group, which is the
 * change a cook actually wants to read ("Worcestershire out, second poblano in").
 */
export function diffVersions(type: string, slug: string, from: Version, to: Version): DiffResponse {
  const ref = (v: Version) => ({
    number: v.number,
    summary: v.summary,
    author: v.author,
    createdAt: v.createdAt,
    authoredAt: v.authoredAt,
  });
  const ingredients =
    type === 'recipe' ? diffIngredients(from.frontmatter, to.frontmatter) : undefined;
  const skip = ingredients ? ['ingredients'] : [];
  return {
    from: ref(from),
    to: ref(to),
    body: createPatch(`${slug}.md`, from.body, to.body, `v${from.number}`, `v${to.number}`),
    frontmatter: diffFrontmatter(from.frontmatter, to.frontmatter, skip),
    ...(ingredients ? { ingredients } : {}),
  };
}

/**
 * Top-level keys only, which is what a recipe's frontmatter has. Values compare as
 * canonical JSON so key order inside a nested value does not read as a change.
 */
export function diffFrontmatter(
  from: Record<string, unknown>,
  to: Record<string, unknown>,
  skip: string[] = [],
): FrontmatterChange[] {
  const keys = [...new Set([...Object.keys(from), ...Object.keys(to)])]
    .filter((key) => !skip.includes(key))
    .sort();
  const changes: FrontmatterChange[] = [];
  for (const key of keys) {
    const inFrom = key in from && from[key] !== undefined;
    const inTo = key in to && to[key] !== undefined;
    if (inFrom && !inTo) changes.push({ key, change: 'removed', from: from[key] });
    else if (!inFrom && inTo) changes.push({ key, change: 'added', to: to[key] });
    else if (inFrom && inTo && canonical(from[key]) !== canonical(to[key])) {
      changes.push({ key, change: 'changed', from: from[key], to: to[key] });
    }
  }
  return changes;
}

const groupsSchema = z.preprocess(
  (value) =>
    Array.isArray(value) && value.every((item) => typeof item === 'string')
      ? [{ heading: null, items: value }]
      : value,
  z.array(ingredientGroupSchema),
);

function groupsOf(frontmatter: Record<string, unknown>): IngredientGroup[] {
  const parsed = groupsSchema.safeParse(frontmatter.ingredients);
  return parsed.success ? parsed.data : [];
}

/**
 * Groups pair up by heading (the unnamed group with the unnamed group); each pair is a
 * line diff. A group only one side has is wholly added or removed. Order follows `to`,
 * with removed groups where they stood in `from`.
 */
export function diffIngredients(
  from: Record<string, unknown>,
  to: Record<string, unknown>,
): IngredientGroupDiff[] {
  const a = groupsOf(from);
  const b = groupsOf(to);
  const key = (g: IngredientGroup) => (g.heading ?? '').trim().toLowerCase();
  const fromByKey = new Map(a.map((g) => [key(g), g]));
  const toKeys = new Set(b.map(key));

  const result: IngredientGroupDiff[] = [];
  const emit = (heading: string | null, before: string[], after: string[]) => {
    const lines = diffArrays(before, after).flatMap((part) =>
      part.value.map((text) => ({
        kind: part.added
          ? ('added' as const)
          : part.removed
            ? ('removed' as const)
            : ('same' as const),
        text,
      })),
    );
    const change =
      before.length === 0
        ? 'added'
        : after.length === 0
          ? 'removed'
          : lines.some((l) => l.kind !== 'same')
            ? 'changed'
            : 'same';
    result.push({ heading, change, lines });
  };

  // Removed groups first, in their original order, so a vanished section is not buried.
  for (const g of a) if (!toKeys.has(key(g))) emit(g.heading, g.items, []);
  for (const g of b) {
    const before = fromByKey.get(key(g));
    emit(g.heading, before?.items ?? [], g.items);
  }
  return result;
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([x], [y]) => x.localeCompare(y)),
        )
      : v,
  );
}
