import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { useMe } from '@/api/me';
import { useAuth } from '@/auth/useAuth';
import {
  ChevronDownIcon,
  CloseIcon,
  KeepMark,
  MenuIcon,
  PlusIcon,
  SearchIcon,
} from '@/components/icons';
import {
  ADMIN_PLACE,
  ADMIN_PLACES,
  CREATABLE,
  currentCreatable,
  FOCUS_SEARCH_STATE,
  isActive,
  PLACES,
  SEARCH_PATH,
} from '@/components/nav';
import { useDismiss, useSheetDismiss } from '@/components/nav-hooks';
import { PlaceLink, SheetRow } from '@/components/nav-parts';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { focusRing } from '@/components/ui/styles';
import { cn } from '@/lib/utils';

/**
 * A top bar, 56px, not a sidebar (docs/DESIGN-VALUES.md "Nav"; docs/design/nav-*.png).
 * Wordmark with the mark, places, a search field-button with ⌘K, a type-aware New with a
 * split caret, the theme toggle and sign-out; Admin is a menu for the admin role, which the
 * shell learns once from /api/me. On the phone the bar collapses to the wordmark, search,
 * New and a menu button that opens a sheet with a search field at its top.
 */
export function AppShell() {
  const { state, signOut } = useAuth();
  const me = useMe();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  const isAdmin = me.data?.caller.kind === 'member' && me.data.caller.role === 'admin';
  const isColead = me.data?.caller.kind === 'member' && me.data.caller.role === 'colead';
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

  // The sheet closes when the page changes, on Escape, and hands focus back to the menu button.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOpen(false), [location.pathname, location.search]);
  const close = useCallback(() => setOpen(false), []);
  useSheetDismiss(open, close, menuButton);

  // A co-lead's whole site is the group slice (docs/phases/04-group.md "Out of scope":
  // no member sees Recipes, the morning page, Writing or Admin).
  if (isColead && !location.pathname.startsWith('/group')) return <Navigate to="/group" replace />;

  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 border-b border-border bg-bg">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-2 px-3 md:px-5">
          <Link
            to="/"
            className={cn(
              'mr-2 inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-1 font-serif text-xl font-medium whitespace-nowrap text-text-strong',
              focusRing,
            )}
          >
            <KeepMark size={20} />
            The Keep
          </Link>

          <nav aria-label="Places" className="hidden items-center gap-1 md:flex">
            {PLACES.map((place) => (
              <PlaceLink key={place.to} place={place} pathname={location.pathname} />
            ))}
            {isAdmin && <AdminMenu pathname={location.pathname} />}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Search"
              aria-keyshortcuts="Meta+K Control+K"
              className={cn(
                'hidden h-11 w-48 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-muted md:flex',
                'hover:border-border-strong hover:text-text',
                focusRing,
              )}
              onClick={openSearch}
            >
              <SearchIcon width="16" height="16" />
              <span className="grow text-left">Search</span>
              <kbd className="rounded-sm border border-border px-1 font-sans text-xs">⌘K</kbd>
            </button>
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
          isAdmin={isAdmin}
          email={state.status === 'signedIn' ? state.email : null}
          pathname={location.pathname}
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

/** Admin ⌄ on the desktop: the owner-only places with a hint each (docs/design/nav-dark-desktop.png). */
function AdminMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const active = isActive(ADMIN_PLACE, pathname);
  useDismiss(root, open, () => setOpen(false));
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'inline-flex h-11 items-center gap-1 rounded-md px-2 text-[15px] transition-colors',
          focusRing,
          active ? 'font-semibold text-text-strong' : 'text-muted hover:text-text',
        )}
        onClick={() => setOpen((v) => !v)}
      >
        Admin
        <ChevronDownIcon width="14" height="14" />
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          aria-label="Admin"
          className="absolute top-full left-0 z-20 mt-1 w-64 rounded-lg border border-border bg-surface-raised p-2 shadow-lg"
        >
          <p className="eyebrow px-2 pt-1 pb-2">Admin · owner only</p>
          {ADMIN_PLACES.map((place) => (
            <Link
              key={place.to}
              role="menuitem"
              to={place.to}
              onClick={() => setOpen(false)}
              className={cn(
                'flex h-11 items-center justify-between gap-3 rounded-md px-2 text-[15px] hover:bg-surface',
                focusRing,
              )}
            >
              {place.label}
              <span className="text-[13px] text-muted">{place.hint}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** "New recipe" with a caret that lists every type New can make. */
function NewSplit({ current }: { current: ReturnType<typeof currentCreatable> }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  useDismiss(root, open, () => setOpen(false));

  return (
    <div ref={root} className="relative flex items-center">
      <Button asChild size="sm" className="rounded-r-none border-r-0 px-3">
        <Link to={current.to} onClick={() => setOpen(false)}>
          <PlusIcon width="16" height="16" />
          New {current.label.toLowerCase()}
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
  isAdmin,
  email,
  pathname,
  onSearch,
  onSignOut,
}: {
  isAdmin: boolean;
  email: string | null;
  pathname: string;
  onSearch(q: string): void;
  onSignOut(): void;
}) {
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => field.current?.focus(), []);

  return (
    <div
      id="nav-sheet"
      role="dialog"
      aria-label="Menu"
      className="fixed inset-x-0 top-14 bottom-0 z-10 flex flex-col overflow-y-auto bg-bg md:hidden"
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
            placeholder="Search the Keep"
            enterKeyHint="search"
            className={cn(
              'h-12 w-full rounded-md border border-border bg-surface pr-3 pl-11 text-[17px] text-text placeholder:text-muted',
              'focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:outline-none',
            )}
          />
        </form>

        <nav aria-label="Places">
          <ul className="divide-y divide-border border-y border-border">
            {PLACES.map((place) => (
              <SheetRow key={place.to} place={place} pathname={pathname} />
            ))}
          </ul>
          {isAdmin && (
            <>
              <p className="eyebrow mt-6 mb-1">Admin · owner only</p>
              <ul className="divide-y divide-border border-b border-border">
                {ADMIN_PLACES.map((place) => (
                  <SheetRow key={place.to} place={place} pathname={pathname} serif={false} />
                ))}
              </ul>
            </>
          )}
        </nav>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3">
        <ThemeToggle variant="switch" />
        <span className="min-w-0 truncate text-[13px] text-muted">{email}</span>
        <Button variant="ghost" size="sm" onClick={onSignOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
