import {
  type BriefFrontmatter,
  DEFAULT_TRANSLATION,
  type Translation,
  type Version,
} from '@the-keep/shared';
import { useState } from 'react';
import { useApi } from '@/api/context';
import { passageProblem, usePassageThrough } from '@/api/passages';
import { Markdown } from '@/components/Markdown';
import { PassageCredit, PassageParagraphs } from '@/components/PassageText';
import { TranslationSelect } from '@/components/TranslationSelect';
import { Button } from '@/components/ui/button';
import { dayHeading, when } from '@/lib/dates';
import { useTranslation } from '@/lib/translation';
import { cn } from '@/lib/utils';
import { morningParts, type OfficePart, officeParts, type ShapeRow } from '@/routes/home/morning';

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
 * a train; the fold comes back on the next visit, since the glance is the default. The
 * text of each reading is fetched from its reference in the translation the device has
 * chosen; what the writer put under the label is the fallback when a reading cannot be
 * fetched (a book no source carries), and the whole of a part that is not a reading.
 */
export function Morning({ date, brief, version, note }: MorningProps) {
  const heading = dayHeading(date);
  const parts = morningParts(brief);
  const office = parts.office ? officeParts(parts.office) : null;
  const [unfolded, setUnfolded] = useState(false);
  const [translation, setTranslation] = useTranslation(DEFAULT_TRANSLATION);
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
            {!office ? (
              <Markdown variant="reading" className="mt-5">
                {parts.office}
              </Markdown>
            ) : unfolded ? (
              <div className="mt-5">
                {office.preamble && <Markdown variant="reading">{office.preamble}</Markdown>}
                {office.parts.map((part, i) => (
                  <OfficeSection key={i} part={part} translation={translation} />
                ))}
              </div>
            ) : (
              <Rows
                rows={office.parts.map((p) => ({ label: p.label, text: p.reference }))}
                className="mt-4"
              />
            )}
          </div>
          {office && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={unfolded}
                aria-controls="office-body"
                onClick={() => setUnfolded((u) => !u)}
                className="-mb-2 -ml-3 text-muted"
              >
                {unfolded ? 'Just the readings' : 'Read it here'}
              </Button>
              {unfolded && office.parts.some((p) => p.reference) && (
                <TranslationSelect
                  value={translation}
                  onChange={setTranslation}
                  className="-mb-2"
                />
              )}
            </div>
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

/** One part of the unfolded Office: its label as an eyebrow, then the reading or the writer's text. */
function OfficeSection({ part, translation }: { part: OfficePart; translation: Translation }) {
  return (
    <section aria-label={part.label}>
      <h4 className="eyebrow mt-5 mb-1.5 first:mt-0">
        {part.reference ? `${part.label} · ${part.reference}` : part.label}
      </h4>
      {part.reference ? (
        <OfficeReading reference={part.reference} translation={translation} fallback={part.body} />
      ) : (
        part.body && <Markdown variant="reading">{part.body}</Markdown>
      )}
    </section>
  );
}

/** A reading fetched whole; the writer's text under the label when it cannot be. */
function OfficeReading({
  reference,
  translation,
  fallback,
}: {
  reference: string;
  translation: Translation;
  fallback: string;
}) {
  const api = useApi();
  const passage = usePassageThrough(api, '/api', reference, translation);
  if (passage.isPending) return <p className="reading text-muted italic">Finding the passage…</p>;
  if (passage.isError) {
    if (fallback) return <Markdown variant="reading">{fallback}</Markdown>;
    return <p className="reading text-muted italic">{passageProblem(passage.error, reference)}</p>;
  }
  return (
    <>
      <PassageParagraphs verses={passage.data.verses} className="mt-4 first:mt-0" />
      <PassageCredit passage={passage.data} asked={translation} />
    </>
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
