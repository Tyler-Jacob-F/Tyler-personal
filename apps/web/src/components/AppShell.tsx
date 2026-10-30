import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useMe } from '@/api/me';
import { useAuth } from '@/auth/useAuth';
import { ChevronDownIcon, CloseIcon, MenuIcon, PlusIcon, SearchIcon } from '@/components/icons';
import {
  ADMIN_PLACE,
  CREATABLE,
  currentCreatable,
  FOCUS_SEARCH_STATE,
  isActive,
  PLACES,
  SEARCH_PATH,
} from '@/components/nav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { focusRing } from '@/components/ui/styles';
import { cn } from '@/lib/utils';

/**
 * A top bar, 56px, not a sidebar (docs/DESIGN-VALUES.md "Nav"). Wordmark, places, search,
 * a type-aware New, the theme toggle and sign-out; on the phone the bar collapses to the
 * wordmark, search, New and a menu button that opens a sheet with a search field at its
 * top. Admin appears for the admin role, which the shell learns once from /api/me.
 */
export function AppShell() {
  const { state, signOut } = useAuth();
  const me = useMe();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  const isAdmin = me.data?.caller.kind === 'member' && me.data.caller.role === 'admin';
  const places = isAdmin ? [...PLACES, ADMIN_PLACE] : PLACES;
  const creatable = currentCreatable(location.pathname);

  const openSearch = () => navigate(SEARCH_PATH, { state: FOCUS_SEARCH_STATE });

  // ⌘K / Ctrl+K from anywhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(false);
        openSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // The sheet closes when the page changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOpen(false), [location.pathname, location.search]);

  const placeClass = (active: boolean) =>
    cn(
      'inline-flex h-11 items-center rounded-md px-2 text-[15px] transition-colors',
      focusRing,
      active ? 'font-semibold text-text-strong' : 'text-muted hover:text-text',
    );

  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 border-b border-border bg-bg">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-2 px-3 md:px-5">
          <Link
            to="/"
            className={cn(
              'mr-2 rounded-md px-1 font-serif text-xl font-medium text-text-strong',
              focusRing,
            )}
          >
            The Keep
          </Link>

          <nav aria-label="Places" className="hidden items-center gap-1 md:flex">
            {places.map((place) => (
              <NavLink
                key={place.to}
                to={place.to}
                end={place.end}
                className={placeClass(isActive(place, location.pathname))}
                aria-current={isActive(place, location.pathname) ? 'page' : undefined}
              >
                {place.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search"
              title="Search (⌘K)"
              aria-keyshortcuts="Meta+K Control+K"
              className="hidden md:inline-flex"
              onClick={openSearch}
            >
              <SearchIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search"
              className="md:hidden"
              onClick={() => setOpen(true)}
            >
              <SearchIcon />
            </Button>

            <NewSplit current={creatable} />

            <ThemeToggle className="hidden md:inline-flex" />
            <Button variant="ghost" size="sm" className="hidden md:inline-flex" onClick={signOut}>
              Sign out
            </Button>

            <Button
              ref={menuButton}
              variant="ghost"
              size="icon"
              aria-label={open ? 'Close menu' : 'Menu'}
              aria-expanded={open}
              aria-controls="nav-sheet"
              className="md:hidden"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <CloseIcon /> : <MenuIcon />}
            </Button>
          </div>
        </div>
      </header>

      {open && (
        <Sheet
          places={places}
          email={state.status === 'signedIn' ? state.email : null}
          pathname={location.pathname}
          onClose={() => {
            setOpen(false);
            menuButton.current?.focus();
          }}
          onSearch={(q) => navigate(`${SEARCH_PATH}?q=${encodeURIComponent(q)}`)}
          onSignOut={signOut}
        />
      )}

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

/** "New recipe" on Recipes; the caret lists every type New can make. */
function NewSplit({ current }: { current: ReturnType<typeof currentCreatable> }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative flex items-center">
      <Button asChild size="sm" className="rounded-r-none border-r-0 px-3 md:pr-3">
        <Link to={current.to} onClick={() => setOpen(false)}>
          <PlusIcon width="16" height="16" />
          <span className="md:hidden" aria-hidden="true">
            New
          </span>
          <span className="hidden md:inline">New {current.label.toLowerCase()}</span>
        </Link>
      </Button>
      <Button
        size="icon"
        className="w-9 rounded-l-none"
        aria-label="New…"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDownIcon width="16" height="16" />
      </Button>
      {open && (
        <ul
          id={id}
          role="menu"
          aria-label="New"
          className="absolute top-full right-0 z-20 mt-1 min-w-40 rounded-lg border border-border bg-surface-raised p-1 shadow-lg"
        >
          {CREATABLE.map((c) => (
            <li key={c.type} role="none">
              <Link
                role="menuitem"
                to={c.to}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex h-11 items-center rounded-md px-3 text-[15px] hover:bg-surface',
                  focusRing,
                )}
              >
                New {c.label.toLowerCase()}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Sheet({
  places,
  email,
  pathname,
  onClose,
  onSearch,
  onSignOut,
}: {
  places: typeof PLACES;
  email: string | null;
  pathname: string;
  onClose(): void;
  onSearch(q: string): void;
  onSignOut(): void;
}) {
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    field.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      id="nav-sheet"
      role="dialog"
      aria-label="Menu"
      className="fixed inset-x-0 top-14 bottom-0 z-10 overflow-y-auto bg-bg md:hidden"
    >
      <div className="grid gap-6 px-4 py-5">
        <form
          role="search"
          className="relative"
          onSubmit={(event) => {
            event.preventDefault();
            onSearch(field.current?.value.trim() ?? '');
          }}
        >
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            ref={field}
            type="search"
            name="q"
            aria-label="Search"
            placeholder="Search recipes"
            enterKeyHint="search"
            className={cn(
              'h-12 w-full rounded-md border border-border bg-surface pr-3 pl-11 text-[17px] text-text placeholder:text-muted',
              'focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:outline-none',
            )}
          />
        </form>

        <nav aria-label="Places">
          <ul className="divide-y divide-border border-y border-border">
            {places.map((place) => {
              const active = isActive(place, pathname);
              return (
                <li key={place.to}>
                  <Link
                    to={place.to}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-13 items-center font-serif text-[19px]',
                      focusRing,
                      active ? 'font-medium text-text-strong' : 'text-text',
                    )}
                  >
                    {place.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center justify-between gap-3">
          <ThemeToggle />
          <span className="min-w-0 truncate text-sm text-muted">{email}</span>
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
