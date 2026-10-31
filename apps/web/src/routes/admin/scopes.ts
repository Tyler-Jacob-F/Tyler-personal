import type { AgentScope } from '@the-keep/shared';

/** What each scope lets a token do, in the words the Tokens screen shows. */
export const scopeDescriptions: Record<AgentScope, string> = {
  'read:documents': 'List and read documents in every ring',
  'write:recipes': 'Create recipes and save recipe versions',
  'write:briefs': 'Post the morning brief',
  'write:notes': 'Create notes and note versions',
  'read:reading': 'Read the reading feed',
  'write:events': 'Keep the group’s calendar: create events and move them',
  'write:questions': 'Post the group’s weekly questions',
};
