/**
 * The nav of docs/DESIGN-VALUES.md: places, not verbs. Admin is appended for the admin
 * role. Writing and Group lead to a one-line "not yet" page until their phases.
 */
export interface Place {
  label: string;
  to: string;
  /** A few words at the right of the row in the sheet and the Admin menu. */
  hint?: string;
  /** Path prefixes that light this place; `end` marks an exact match. */
  matches: string[];
  end?: boolean;
}

export const PLACES: Place[] = [
  { label: 'Home', to: '/', matches: ['/', '/briefs'], end: true },
  { label: 'Recipes', to: '/recipes', matches: ['/recipes'] },
  { label: 'Writing', to: '/writing', matches: ['/writing'] },
  { label: 'Group', to: '/group', matches: ['/group'] },
];

export const ADMIN_PLACE: Place = {
  label: 'Admin',
  to: '/admin/tokens',
  matches: ['/admin', '/stack'],
};

/** The admin's own places, shown as a second row on those screens. */
export const ADMIN_PLACES: Place[] = [
  { label: 'Tokens', to: '/admin/tokens', matches: ['/admin/tokens'], hint: 'agents, scopes' },
  {
    label: 'Activity',
    to: '/admin/activity',
    matches: ['/admin/activity'],
    hint: 'agents, versions',
  },
  { label: 'Stack', to: '/stack', matches: ['/stack'], hint: 'how it is built' },
];

export function isActive(place: Place, pathname: string): boolean {
  return place.matches.some((prefix) =>
    prefix === '/'
      ? pathname === '/'
      : pathname === prefix || pathname.startsWith(`${prefix}/`) || (!place.end && false),
  );
}

/** What "New" can make, with the type the current path implies first. */
export interface Creatable {
  type: string;
  label: string;
  to: string;
  /** The path prefix that makes this the current type. */
  within: string;
}

export const CREATABLE: Creatable[] = [
  { type: 'recipe', label: 'Recipe', to: '/recipes/new', within: '/recipes' },
];

export function currentCreatable(pathname: string): Creatable {
  return (
    CREATABLE.find((c) => pathname === c.within || pathname.startsWith(`${c.within}/`)) ??
    CREATABLE[0]!
  );
}

/** Where the search entry goes: the Recipes search field, until a search screen exists. */
export const SEARCH_PATH = '/recipes';
export const FOCUS_SEARCH_STATE = { focusSearch: true } as const;
