import type { Place } from '@/components/nav';

/** The group's own places (docs/design/group-home-dark-desktop.png): Home, Questions, Sign-up, Calendar, Members. */
export const GROUP_PLACES: Place[] = [
  { label: 'Home', to: '/group', matches: ['/group'], end: true },
  { label: 'Questions', to: '/group/questions', matches: ['/group/questions'] },
  { label: 'Sign-up', to: '/group/signups', matches: ['/group/signups'] },
  { label: 'Calendar', to: '/group/calendar', matches: ['/group/calendar'] },
  { label: 'Members', to: '/group/members', matches: ['/group/members', '/group/claim'] },
];
