import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { CloseIcon, KeepMark, MenuIcon } from '@/components/icons';
import { useSheetDismiss } from '@/components/nav-hooks';
import { PlaceLink, SheetRow } from '@/components/nav-parts';
import { Button } from '@/components/ui/button';
import { focusRing } from '@/components/ui/styles';
import { useGroup } from '@/group/context';
import { GROUP_PLACES } from '@/group/places';
import { cn } from '@/lib/utils';

/**
 * The group's own chrome (docs/design/group-home-*.png): the wordmark and the five places,
 * nothing of The Keep's. On the phone the places live in a sheet behind the menu button.
 * A signed-in co-lead gets a sign-out; a device simply closes the tab.
 */
export function GroupShell() {
  const { signOut } = useGroup();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOpen(false), [location.pathname]);
  const close = useCallback(() => setOpen(false), []);
  useSheetDismiss(open, close, menuButton);

  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 border-b border-border bg-bg">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-2 px-3 md:px-5">
          <Link
            to="/group"
            className={cn(
              'inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-1 font-serif text-xl font-medium whitespace-nowrap text-text-strong',
              focusRing,
            )}
          >
            <KeepMark size={20} />
            The Keep
          </Link>

          <nav aria-label="Group places" className="ml-auto hidden items-center gap-1 md:flex">
            {GROUP_PLACES.map((place) => (
              <PlaceLink key={place.to} place={place} pathname={location.pathname} />
            ))}
            {signOut && (
              <Button variant="ghost" size="sm" className="ml-2" onClick={signOut}>
                Sign out
              </Button>
            )}
          </nav>

          <Button
            ref={menuButton}
            variant="ghost"
            size="icon"
            aria-label={open ? 'Close menu' : 'Menu'}
            aria-expanded={open}
            aria-controls="group-sheet"
            className="ml-auto md:hidden"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </Button>
        </div>
      </header>

      {open && (
        <div
          id="group-sheet"
          role="dialog"
          aria-label="Menu"
          className="fixed inset-x-0 top-14 bottom-0 z-10 flex flex-col overflow-y-auto bg-bg md:hidden"
        >
          <nav aria-label="Group places" className="px-4 py-5">
            <ul className="divide-y divide-border border-y border-border">
              {GROUP_PLACES.map((place) => (
                <SheetRow key={place.to} place={place} pathname={location.pathname} />
              ))}
            </ul>
          </nav>
          {signOut && (
            <div className="mt-auto flex justify-end border-t border-border bg-surface px-4 py-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
              >
                Sign out
              </Button>
            </div>
          )}
        </div>
      )}

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
