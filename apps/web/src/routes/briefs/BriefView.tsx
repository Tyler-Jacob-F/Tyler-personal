import type { DocumentWithVersion } from '@the-keep/shared';
import { Markdown } from '@/components/Markdown';
import { briefDay, briefOf } from '@/routes/briefs/brief';
import { when } from '@/routes/recipes/format';

/** A brief as the home screen and the brief page both show it. */
export function BriefView({ item, kicker }: { item: DocumentWithVersion; kicker: string }) {
  const { version } = item;
  const brief = briefOf(version.frontmatter);
  if (!brief) return null;
  return (
    <article className="grid gap-5 rounded-lg border border-border p-5">
      <div>
        <p className="eyebrow">{kicker}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">{briefDay(brief.date)}</h2>
        <p className="mt-1 text-xs text-muted">
          {brief.title} · v{version.number} · {version.author.name} · {when(version.createdAt)}
        </p>
      </div>
      {version.body.trim() && <Markdown>{version.body}</Markdown>}
      <div className="grid gap-4 md:grid-cols-2">
        {brief.sections.map((section) => (
          <section key={section.heading} className="min-w-0">
            <h3 className="eyebrow">{section.heading}</h3>
            <div className="mt-1">
              <Markdown>{section.body}</Markdown>
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
