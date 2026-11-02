import { useEffect, useId, useRef, useState } from 'react';
import { useDismiss } from '@/components/nav-hooks';
import { Button } from '@/components/ui/button';
import { focusRing } from '@/components/ui/styles';
import { canShare, copyText, mailto, shareText, type Shareable } from '@/lib/share';
import { cn } from '@/lib/utils';

const item = cn(
  'flex h-11 w-full items-center justify-between gap-3 rounded-md px-3 text-left text-[15px] hover:bg-surface',
  focusRing,
);

/**
 * "Share" beside a document's Edit: a menu in the nav's idiom with the ways the text can
 * leave the site. "Send…" opens the phone's share sheet (Messages, Mail, WhatsApp) and only
 * appears where the browser has one; Copy and Email work everywhere; Print is how a browser
 * saves a PDF. The whole control is hidden in print, so a saved PDF never shows it.
 */
export function ShareMenu({ title, text, className }: Shareable & { className?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  useDismiss(root, open, () => setOpen(false));

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2_000);
    return () => clearTimeout(timer);
  }, [copied]);

  const close = () => setOpen(false);

  return (
    <div ref={root} className={cn('relative flex items-center gap-2 print:hidden', className)}>
      <span role="status" className="text-sm text-muted">
        {copied ? 'Copied' : ''}
      </span>
      <Button
        type="button"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        Share
      </Button>
      {open && (
        <ul
          id={id}
          role="menu"
          aria-label="Share"
          className="absolute top-full right-0 z-20 mt-1 w-64 rounded-lg border border-border bg-surface-raised p-1 shadow-lg"
        >
          {canShare() && (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className={item}
                onClick={() => {
                  close();
                  void shareText({ title, text });
                }}
              >
                Send…
                <span className="text-[13px] text-muted">Messages, Mail, more</span>
              </button>
            </li>
          )}
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={async () => {
                close();
                setCopied(await copyText(text));
              }}
            >
              Copy as text
            </button>
          </li>
          <li role="none">
            <a role="menuitem" href={mailto(title, text)} className={item} onClick={close}>
              Email
              <span className="text-[13px] text-muted">opens your mail app</span>
            </a>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => {
                close();
                window.print();
              }}
            >
              Print or save as PDF
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
