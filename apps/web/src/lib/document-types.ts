import type { DocumentType } from '@the-keep/shared';

/**
 * What the web app knows about each document type beyond its schema: the word for it,
 * where one lives, and where a new one is made (null when people make them elsewhere).
 * One map, total over the registry, so a new type cannot link to the wrong screen.
 */
export interface TypeInfo {
  label: string;
  path(id: string): string;
  newPath: string | null;
}

export const documentTypeInfo: Record<DocumentType, TypeInfo> = {
  recipe: { label: 'Recipe', path: (id) => `/recipes/${id}`, newPath: '/recipes/new' },
  brief: { label: 'Brief', path: (id) => `/briefs/${id}`, newPath: null },
  questions: {
    label: 'Questions',
    path: (id) => `/group/questions/${id}`,
    newPath: '/group/questions/new',
  },
  signup: { label: 'Sign-up', path: (id) => `/group/signups/${id}`, newPath: '/group/signups/new' },
  event: { label: 'Event', path: () => '/group/calendar', newPath: '/group/calendar/new' },
};

function isKnown(type: string): type is DocumentType {
  return type in documentTypeInfo;
}

export function typeLabel(type: string): string {
  return isKnown(type) ? documentTypeInfo[type].label : type;
}

/** Where a document of a type is read. An unknown type (an older client) goes nowhere useful but somewhere. */
export function pathFor(type: string, id: string): string {
  return isKnown(type) ? documentTypeInfo[type].path(id) : `/`;
}
