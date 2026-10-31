import { SubNav } from '@/components/nav-parts';
import { GROUP_PLACES } from '@/group/places';

/** The second row under Group for the admin, the way Admin has one: the group's five places. */
export function GroupNav() {
  return <SubNav label="Group" places={GROUP_PLACES} />;
}
