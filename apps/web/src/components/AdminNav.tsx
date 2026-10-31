import { ADMIN_PLACES } from '@/components/nav';
import { SubNav } from '@/components/nav-parts';

/** The second row under Admin: Tokens, Activity, and the Stack page that explains the rest. */
export function AdminNav() {
  return <SubNav label="Admin" places={ADMIN_PLACES} />;
}
