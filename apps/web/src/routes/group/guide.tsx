import {
  DEFAULT_TRANSLATION,
  type GuideFrontmatter,
  type LiturgyFrontmatter,
  type Translation,
  type VoiceLine,
} from '@the-keep/shared';
import { type ReactNode, useState } from 'react';
import { Link } from 'react-router';
import { usePassage } from '@/api/group';
import { passageProblem } from '@/api/passages';
import { numberedItem, numberedList } from '@/components/Markdown';
import { PassageCredit } from '@/components/PassageText';
import { TranslationSelect } from '@/components/TranslationSelect';
import { quietLink } from '@/group/styles';
import type { Typed } from '@/group/format';
import { useTranslation } from '@/lib/translation';
import { cn } from '@/lib/utils';

/**
 * The week's guide as the leader reads it down the page (docs/design/group-home-*.png,
 * docs/phases/04-group.md "The refresh"): the title and the line for whoever leads, then
 * the evening in order under small-caps headings. What changes week to week comes from
 * the guide; what repeats, from the liturgy document. Responsive prayers use the morning
 * page's two-voice grid; readings resolve to text with the first three verses inline, in
 * the translation the reader picked (the liturgy's until they do), with the wheel beside
 * the select for the night someone wants to hear it in another voice.
 */

/** Verses shown before "Continue the reading". */
export const VERSES_INLINE = 3;

export function GuideBlock({
  guide,
  liturgy,
  table,
  heading = 'h3',
}: {
  guide: Typed<GuideFrontmatter>;
  liturgy: LiturgyFrontmatter | null;
  /** What follows the Table line: the way to the sheet, or who brought what. */
  table?: ReactNode;
  heading?: 'h1' | 'h3';
}) {
  const { frontmatter: g } = guide;
  const Heading = heading;
  const [translation, setTranslation] = useTranslation(liturgy?.translation ?? DEFAULT_TRANSLATION);
  return (
    <div>
      <Heading className="page-title mt-1">{g.title}</Heading>
      <p className="reading mt-3 text-muted italic">
        For whoever leads: read down the page. Bold lines are everyone’s.
      </p>

      {g.opening.length > 0 && (
        <Part label="Opening prayer">
          <Voices lines={g.opening} />
        </Part>
      )}

      {(liturgy || table) && (
        <Part label="Table">
          {liturgy && <p className="reading">{liturgy.table}</p>}
          {table}
        </Part>
      )}

      {liturgy && (
        <Part label="Before the reading">
          <Collect text={liturgy.beforeReading} />
        </Part>
      )}

      {g.readings.length > 0 && (
        <TranslationSelect value={translation} onChange={setTranslation} wheel className="mt-8" />
      )}
      {g.readings.map((reference) => (
        <Part key={reference} label={`Scripture · ${reference}`}>
          <Reading reference={reference} translation={translation} />
        </Part>
      ))}

      {(g.reflection || g.questions.length > 0) && (
        <Part label="Reflection">
          {g.reflection && <p className="reading text-text italic">{g.reflection}</p>}
          {g.questions.length > 0 && (
            <ol className={cn(numberedList, 'reading')} aria-label="Questions">
              {g.questions.map((question, index) => (
                <li key={index} className={numberedItem}>
                  {question}
                </li>
              ))}
            </ol>
          )}
        </Part>
      )}

      {(g.closing.length > 0 || liturgy) && (
        <Part label="Closing prayer">
          {g.closing.length > 0 && <Voices lines={g.closing} />}
          {liturgy && (
            <>
              <p className="reading mt-5 text-muted italic">{liturgy.songbook}</p>
              <div className="mt-5">
                <Voices lines={[{ voice: 'people', text: liturgy.lordsPrayer }]} />
              </div>
              <div className="mt-5">
                <Voices lines={[{ voice: 'leader', text: liturgy.closing }]} />
              </div>
            </>
          )}
        </Part>
      )}

      {g.source && (
        <p className="mt-10 border-t border-border pt-4 text-[15px] text-muted">
          {/^from\b/i.test(g.source) ? g.source : `From ${g.source}`}
        </p>
      )}
    </div>
  );
}

function Part({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mt-8" aria-label={label}>
      <h4 className="eyebrow mb-3">{label}</h4>
      {children}
    </section>
  );
}

/**
 * The two-voice grid: "Leader" and "People" as 13px muted labels in a 56px column, the
 * leader's words in `text`, the people's bold in `text-strong`. Line breaks within a line
 * are kept, which is how the Lord's Prayer keeps its shape.
 */
export function Voices({ lines }: { lines: VoiceLine[] }) {
  return (
    <dl className="grid grid-cols-[56px_1fr] gap-x-4 gap-y-4">
      {lines.map((line, index) => (
        <div key={index} className="contents">
          <dt className="pt-1 text-[13px] text-muted">
            {line.voice === 'leader' ? 'Leader' : 'People'}
          </dt>
          <dd
            className={cn(
              'reading whitespace-pre-line',
              line.voice === 'people' ? 'font-semibold text-text-strong' : 'text-text',
            )}
          >
            {line.voice === 'leader' ? <Amen text={line.text} /> : line.text}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A collect said by the leader alone; the people's Amen is theirs, so it reads bold. */
function Collect({ text }: { text: string }) {
  return (
    <p className="reading whitespace-pre-line">
      <Amen text={text} />
    </p>
  );
}

function Amen({ text }: { text: string }) {
  const match = /^([\s\S]*?)(\s*)(Amen\.?)$/.exec(text);
  if (!match) return text;
  return (
    <>
      {match[1]}
      {match[2]}
      <strong className="font-semibold text-text-strong">{match[3]}</strong>
    </>
  );
}

/** A reading: the first verses inline and the rest behind "Continue the reading · N verses". */
export function Reading({
  reference,
  translation,
}: {
  reference: string;
  translation: Translation;
}) {
  const passage = usePassage(reference, translation);
  const [open, setOpen] = useState(false);
  if (passage.isPending) return <p className="reading text-muted italic">Finding the passage…</p>;
  if (passage.isError)
    return <p className="reading text-muted italic">{passageProblem(passage.error, reference)}</p>;
  const verses = passage.data.verses;
  const shown = open ? verses : verses.slice(0, VERSES_INLINE);
  const rest = verses.length - VERSES_INLINE;
  return (
    <>
      <p className="reading">{shown.map((v) => v.text).join(' ')}</p>
      {rest > 0 && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(quietLink, 'mt-2 text-[15px] text-muted tabular-nums')}
        >
          Continue the reading · {rest} {rest === 1 ? 'verse' : 'verses'}
        </button>
      )}
      <PassageCredit passage={passage.data} asked={translation} />
    </>
  );
}

/** "The sheet is above", or wherever the sheet is from here. */
export function SheetLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <p className="mt-2 text-[15px] text-muted">
      <Link to={to} className={quietLink}>
        {children}
      </Link>
    </p>
  );
}
