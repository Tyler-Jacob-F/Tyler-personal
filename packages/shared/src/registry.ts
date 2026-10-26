import type { z } from 'zod';
import { type DocumentType, documentTypeSchema, type Ring } from './document.js';
import type { FrontmatterBase } from './types/base.js';
import { recipeFrontmatterSchema } from './types/recipe.js';

export interface TypeDefinition {
  /** Frontmatter schema; the single source of truth for client, server and MCP. */
  schema: z.ZodType<FrontmatterBase>;
  /** Ring a new document of this type starts in (docs/DESIGN.md "Domain model"). */
  defaultRing: Ring;
}

const registry: Record<DocumentType, TypeDefinition> = {
  recipe: { schema: recipeFrontmatterSchema, defaultRing: 'me' },
};

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
