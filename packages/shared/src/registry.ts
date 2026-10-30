import type { z } from 'zod';
import { type DocumentType, documentTypeSchema, type Ring } from './document.js';
import type { FrontmatterBase } from './types/base.js';
import { briefFrontmatterSchema } from './types/brief.js';
import { recipeFrontmatterSchema } from './types/recipe.js';

export interface TypeDefinition {
  /** Frontmatter schema; the single source of truth for client, server and MCP. */
  schema: z.ZodType<FrontmatterBase>;
  /** Ring a new document of this type starts in (docs/DESIGN.md "Domain model"). */
  defaultRing: Ring;
  /** How to write this type's frontmatter and body, in a paragraph a model can follow. */
  guide: string;
}

const registry: Record<DocumentType, TypeDefinition> = {
  recipe: {
    schema: recipeFrontmatterSchema,
    defaultRing: 'me',
    guide:
      'recipe: frontmatter is { title, ingredients, servings?, prepMinutes?, cookMinutes? }. ' +
      '`ingredients` is a list of groups, each { heading, items }: heading is a string such as ' +
      '"Meats (3 lb total)" or null for an unnamed group, items are free-text lines such as ' +
      '"1½ Tbsp toasted cumin" with the amount kept in the text. Leave servings and the minutes ' +
      'out unless the source states them; never invent a number. The body is the method in ' +
      'markdown, with any notes as prose.',
  },
  brief: {
    schema: briefFrontmatterSchema,
    defaultRing: 'me',
    guide:
      'brief: frontmatter is { date, sections, title? }. `date` is the day the brief is for ' +
      '(YYYY-MM-DD, local to Tyler in America/New_York); `sections` is a list of ' +
      '{ heading, body } with the body in markdown, one section per theme such as "Today", ' +
      '"Waiting on you", "Reading"; title defaults to "Brief for <date>". The version body ' +
      'is an optional lead paragraph. One brief per day: list_documents with type brief ' +
      'first, and add a version to today\u2019s if it already exists.',
  },
};

/** Every type's guide, for tool descriptions. */
export function typeGuides(): string {
  return Object.values(registry)
    .map((definition) => definition.guide)
    .join('\n');
}

/** Look a type up. Throws on an unknown type so a typo never reaches the database. */
export function schemaFor(type: string): TypeDefinition {
  return registry[documentTypeSchema.parse(type)];
}

export function isDocumentType(type: string): type is DocumentType {
  return documentTypeSchema.safeParse(type).success;
}

/**
 * Validate frontmatter against its type's schema. Returns the parsed (trimmed, defaulted)
 * value so what is stored is exactly what the schema allows.
 */
export function parseFrontmatter(type: string, frontmatter: unknown): FrontmatterBase {
  return schemaFor(type).schema.parse(frontmatter);
}
