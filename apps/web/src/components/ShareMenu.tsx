import { useEffect, useId, useRef, useState } from 'react';
import { useDismiss } from '@/components/nav-hooks';
import { Button } from '@/components/ui/button';
import { focusRing } from '@/components/ui/styles';
import {
  canShare,
  canShareFiles,
  copyText,
  download,
  mailto,
  pdfFile,
  shareFile,
  shareText,
  type Shareable,
} from '@/lib/share';
import { cn } from '@/lib/utils';

const item = cn(
  'flex h-11 w-full items-center justify-between gap-3 rounded-md px-3 text-left text-[15px] hover:bg-surface',
  focusRing,
);

export interface PdfSource {
  /** "chili.pdf". */
  filename: string;
  /** Render the bytes; called when the person asks, not before. */
  make(): Promise<Uint8Array>;
  /** Start loading what `make` needs, called when the menu opens so the tap after it is quick. */
  warm?(): void;
}

/**
 * "Share" beside a document's Edit: a menu in the nav's idiom with the ways the document
 * can leave the site. "Send PDF…" opens the share sheet with the PDF attached, which is
 * what drops a file into Messages, Messenger or Mail; "Send as text…" shares the text
 * instead; both appear only where the browser has a sheet. Copy, Email and Download PDF
 * work everywhere. The whole control is hidden in print.
 */
export function ShareMenu({
  title,
  text,
  pdf,
  className,
}: Shareable & { pdf?: PdfSource; className?: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  useDismiss(root, open, () => setOpen(false));

  useEffect(() => {
    if (status !== 'Copied') return;
    const timer = setTimeout(() => setStatus(''), 2_000);
    return () => clearTimeout(timer);
  }, [status]);

  const close = () => setOpen(false);

  /** Make the PDF with a status line up while it renders; `then` gets the file. */
  const withPdf = async (then: (file: File) => Promise<unknown> | void) => {
    if (!pdf) return;
    close();
    setStatus('Making the PDF…');
    try {
      await then(pdfFile(await pdf.make(), pdf.filename));
      setStatus('');
    } catch {
      setStatus('The PDF could not be made.');
    }
  };

  return (
    <div ref={root} className={cn('relative flex items-center gap-2 print:hidden', className)}>
      <span role="status" className="text-sm text-muted">
        {status}
      </span>
      <Button
        type="button"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          if (!open) pdf?.warm?.();
          setOpen((v) => !v);
        }}
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
          {pdf && canShareFiles() && (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className={item}
                onClick={() => withPdf((file) => shareFile(file, title))}
              >
                Send PDF…
                <span className="text-[13px] text-muted">Messages, Messenger, Mail</span>
              </button>
            </li>
          )}
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
                Send as text…
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
                setStatus((await copyText(text)) ? 'Copied' : '');
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
          {pdf && (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className={item}
                onClick={() => withPdf(download)}
              >
                Download PDF
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
