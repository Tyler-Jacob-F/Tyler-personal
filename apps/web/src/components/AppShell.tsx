import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Top nav over a scrolling main: `h-screen flex-col` then `main overflow-y-auto`. */
export function AppShell() {
  const { state, signOut } = useAuth();
  return (
    <div className="flex h-screen flex-col">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-6 px-4">
          <Link to="/" className="text-sm font-semibold tracking-wider uppercase">
            The Keep
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <NavLink
              to="/recipes"
              className={({ isActive }) =>
                cn('text-muted-foreground hover:text-foreground', isActive && 'text-foreground')
              }
            >
              Recipes
            </NavLink>
            <NavLink
              to="/stack"
              className={({ isActive }) =>
                cn('text-muted-foreground hover:text-foreground', isActive && 'text-foreground')
              }
            >
              Stack
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
            {state.status === 'signedIn' && <span className="hidden md:inline">{state.email}</span>}
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
