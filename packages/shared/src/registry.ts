import type { z } from 'zod';
import { type DocumentType, documentTypeSchema, type Ring, tagsSchema } from './document.js';
import type { FrontmatterBase } from './types/base.js';
import { briefFrontmatterSchema } from './types/brief.js';
import { eventFrontmatterSchema } from './types/event.js';
import { questionsFrontmatterSchema } from './types/questions.js';
import { recipeTagsSchema, recipeTaxonomyGuide } from './types/recipe-taxonomy.js';
import { recipeFrontmatterSchema } from './types/recipe.js';
import { signupFrontmatterSchema } from './types/signup.js';

export interface TypeDefinition {
  /** Frontmatter schema; the single source of truth for client, server and MCP. */
  schema: z.ZodType<FrontmatterBase>;
  /** Tags the type accepts on its document envelope; the plain tag rules unless the type has a vocabulary. */
  tags: z.ZodType<string[], unknown>;
  /** Ring a new document of this type starts in (docs/DESIGN.md "Domain model"). */
  defaultRing: Ring;
  /** How to write this type's frontmatter and body, in a paragraph a model can follow. */
  guide: string;
}

const registry: Record<DocumentType, TypeDefinition> = {
  recipe: {
    schema: recipeFrontmatterSchema,
    tags: recipeTagsSchema,
    defaultRing: 'me',
    guide:
      'recipe: frontmatter is { title, ingredients, activeMinutes?, totalMinutes?, serves?, ' +
      'provenance?, proven? }. `ingredients` is a list of groups, each { heading, items }: ' +
      'heading is a string such as "Meats (3 lb total)" or null for an unnamed group, items are ' +
      'free-text lines such as "1½ Tbsp toasted cumin" with the amount kept in the text. ' +
      'activeMinutes is hands-on time, totalMinutes start to table, serves a whole number; ' +
      'leave them out unless the source states them and never invent a number. provenance is ' +
      'one line on where it came from ("Steve’s card, 2014"). proven is { count, last? } ' +
      'when this version has been cooked (last as YYYY-MM-DD); leave it out for an untested ' +
      'version. The body is the method in markdown, with any headnote or notes as prose. ' +
      recipeTaxonomyGuide(),
  },
  brief: {
    schema: briefFrontmatterSchema,
    tags: tagsSchema,
    defaultRing: 'me',
    guide:
      'brief: frontmatter is { date, sections, title? }. `date` is the day the brief is for ' +
      '(YYYY-MM-DD, local to Tyler in America/New_York); `sections` is a list of ' +
      '{ heading, body } with the body in markdown. The morning page reads four of them by ' +
      'heading: "The day" (one line: liturgical day and season, sunrise, weather), "Office" ' +
      '(the office inline with the readings, markdown with #### labels such as ' +
      '"Venite · Psalm 95"; name the office in the heading, "Office · Evening Prayer", when ' +
      'a later version of the day carries a later office), "The brief" (at most three short ' +
      'paragraphs), and "Today" (a ' +
      'list, one line each, "9:00 · Pancakes with the kids"; a day name or "Dinner" may stand ' +
      'where the time goes). Other sections fold into the brief. Title defaults to "Brief for ' +
      '<date>". The version body is an optional lead paragraph. One brief per day: ' +
      'list_documents with type brief first, and add a version to today’s if it already ' +
      'exists.',
  },
  questions: {
    schema: questionsFrontmatterSchema,
    tags: tagsSchema,
    defaultRing: 'group',
    guide:
      'questions: the small group’s weekly discussion questions. frontmatter is { weekOf, ' +
      'title? }: weekOf is the Thursday the questions are for (YYYY-MM-DD); title defaults to ' +
      '"Questions for <weekOf>". The body is the questions in markdown, a numbered list, with ' +
      'the passage or theme as a short lead. One document per week: list_documents with type ' +
      'questions first and add a version to that week’s if it already exists. Documents of ' +
      'this type start in the group ring, where every member reads them.',
  },
  signup: {
    schema: signupFrontmatterSchema,
    tags: tagsSchema,
    defaultRing: 'group',
    guide:
      'signup: a sheet of slots for a Thursday ("Dinner", "Dessert", "Drinks"). frontmatter ' +
      'is { title, date, slots, closesAt? }: date is the Thursday (YYYY-MM-DD); slots is a ' +
      'list of { label, capacity } with distinct labels and a whole-number capacity of 1 or ' +
      'more; closesAt is an ISO timestamp after which members can no longer take or release ' +
      'a slot. Claims are rows keyed by the slot’s label, not versions: renaming a slot ' +
      'orphans its claims, so add a slot rather than rename one. The body is optional notes ' +
      'in markdown. Written by the admin and co-leads only; no agent scope writes a signup.',
  },
  event: {
    schema: eventFrontmatterSchema,
    tags: tagsSchema,
    defaultRing: 'group',
    guide:
      'event: one meeting on the group’s calendar. frontmatter is { title, date, time?, ' +
      'place?, notes? }: date YYYY-MM-DD; time 24-hour HH:MM in Richmond’s own clock, left ' +
      'out for an all-day note; place one line ("Tyler’s"); notes one line ("bring a chair"). ' +
      'The body is optional longer markdown. The calendar is the list of upcoming events, ' +
      'so one document per meeting; list_documents with type event before creating one so a ' +
      'moved meeting gets a version, not a twin. Documents of this type start in the group ' +
      'ring.',
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

/** Validate a tag set against the type's vocabulary, returning it normalized. */
export function parseTags(type: string, tags: unknown): string[] {
  return schemaFor(type).tags.parse(tags);
}
