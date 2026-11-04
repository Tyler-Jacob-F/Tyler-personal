import type { BriefFrontmatter, Version } from '@the-keep/shared';
import { useState } from 'react';
import { Markdown } from '@/components/Markdown';
import { Button } from '@/components/ui/button';
import { dayHeading, when } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { morningParts, officeOutline, type ShapeRow } from '@/routes/home/morning';

export interface MorningProps {
  /** The calendar date the page is for. */
  date: string;
  brief: BriefFrontmatter | null;
  version?: Version;
  /** When the brief shown is not today's: one quiet line says whose morning it was. */
  note?: string | null;
}

/**
 * A page, not a dashboard (docs/DESIGN-VALUES.md "The morning page"): one column, the
 * reading measure, read top to bottom. The day; the Office, the only accented element; the
 * brief, at most three items; the day's shape. Never counts, badges, an inbox, streaks,
 * progress, red, a greeting, or urgency.
 *
 * The Office opens folded: its parts and their references, enough to glance at and open the
 * book on the shelf. "Read it here" unfolds the text for a morning at a desk or a phone on
 * a train; the fold comes back on the next visit, since the glance is the default.
 */
export function Morning({ date, brief, version, note }: MorningProps) {
  const heading = dayHeading(date);
  const parts = morningParts(brief);
  const outline = parts.office ? officeOutline(parts.office) : null;
  const [unfolded, setUnfolded] = useState(false);
  const showText = unfolded || !outline;
  return (
    <article className="mx-auto grid max-w-[42rem] gap-10" aria-label="Morning">
      <header>
        <p className="eyebrow">{heading.weekday}</p>
        <h1 className="page-title mt-1">{heading.date}</h1>
        {parts.day && <p className="mt-2 text-[15px] leading-relaxed text-muted">{parts.day}</p>}
        {note && <p className="mt-2 text-[15px] text-muted italic">{note}</p>}
      </header>

      {!brief && <p className="reading text-muted italic">No brief this morning.</p>}

      {parts.office && (
        <section
          aria-labelledby="office-heading"
          className="rounded-lg border border-border bg-surface px-5 py-6 sm:px-7 sm:py-7"
        >
          <h2 id="office-heading" className="eyebrow text-accent">
            {parts.officeTitle}
          </h2>
          <div id="office-body">
            {showText ? (
              <Markdown variant="reading" className="mt-5">
                {parts.office}
              </Markdown>
            ) : (
              <Rows rows={outline!} className="mt-4" />
            )}
          </div>
          {outline && (
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={unfolded}
              aria-controls="office-body"
              onClick={() => setUnfolded((u) => !u)}
              className="-mb-2 -ml-3 mt-4 text-muted"
            >
              {unfolded ? 'Just the readings' : 'Read it here'}
            </Button>
          )}
        </section>
      )}

      {parts.items.length > 0 && (
        <section aria-labelledby="brief-heading">
          <h2 id="brief-heading" className="eyebrow">
            The brief
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {parts.items.map((item, i) => (
              <li key={i} className="py-4 first:pt-0 last:pb-0">
                <Markdown variant="reading">{item}</Markdown>
              </li>
            ))}
          </ul>
        </section>
      )}

      {parts.shape.length > 0 && (
        <section aria-labelledby="shape-heading">
          <h2 id="shape-heading" className="eyebrow">
            Today
          </h2>
          <Rows rows={parts.shape} className="mt-3" />
        </section>
      )}

      {version && (
        <footer className="text-[13px] text-muted">
          {brief?.title} · v{version.number} · {version.author.name} · {when(version.createdAt)}
          {version.body.trim() ? ` · ${version.body.trim()}` : ''}
        </footer>
      )}
    </article>
  );
}

/** Label and line, as the day's shape and the folded Office are both laid out. */
function Rows({ rows, className }: { rows: ShapeRow[]; className?: string }) {
  return (
    <table className={cn('w-full border-collapse text-[15px]', className)}>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-border last:border-0">
            <th
              scope="row"
              className="w-px py-2.5 pr-4 text-left align-baseline font-normal whitespace-nowrap text-muted tabular-nums"
            >
              {row.label}
            </th>
            <td className="py-2.5 align-baseline leading-relaxed">
              <Markdown variant="inline">{row.text}</Markdown>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
