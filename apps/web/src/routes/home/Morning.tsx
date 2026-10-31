import type { BriefFrontmatter, Version } from '@the-keep/shared';
import { Markdown } from '@/components/Markdown';
import { dayHeading, when } from '@/lib/dates';
import { morningParts } from '@/routes/home/morning';

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
 */
export function Morning({ date, brief, version, note }: MorningProps) {
  const heading = dayHeading(date);
  const parts = morningParts(brief);
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
          <Markdown variant="reading" className="mt-5">
            {parts.office}
          </Markdown>
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
          <table className="mt-3 w-full border-collapse text-[15px]">
            <tbody>
              {parts.shape.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <th
                    scope="row"
                    className="w-20 py-2.5 pr-4 text-left align-baseline font-normal text-muted tabular-nums"
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
