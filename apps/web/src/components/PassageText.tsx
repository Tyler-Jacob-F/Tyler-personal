import { type Passage, type Translation, translationInfo, type Verse } from '@the-keep/shared';
import { useFums } from '@/lib/fums';
import { cn } from '@/lib/utils';

/** A passage's verses as reading paragraphs, one per chapter; verse numbers are not shown. */
export function PassageParagraphs({ verses, className }: { verses: Verse[]; className?: string }) {
  const chapters: Verse[][] = [];
  for (const verse of verses) {
    const last = chapters[chapters.length - 1];
    if (last && last[0]!.chapter === verse.chapter) last.push(verse);
    else chapters.push([verse]);
  }
  return (
    <>
      {chapters.map((chapter) => (
        <p key={chapter[0]!.chapter} className={cn('reading', className)}>
          {chapter.map((v) => v.text).join(' ')}
        </p>
      ))}
    </>
  );
}

/**
 * The line under a reading its licence asks for: "ESV" linked to esv.org, Biblica's
 * copyright under the NIV, nothing under a public-domain text. When the passage came in
 * another translation than the one asked (the Douay-Rheims standing in for a book the
 * reader's translation lacks), the line says so first.
 */
export function PassageCredit({ passage, asked }: { passage: Passage; asked: Translation }) {
  useFums(passage.fums);
  const detour =
    passage.translation !== asked
      ? `From the ${translationInfo[passage.translation].name}; the ${translationInfo[asked].short} has no ${bookOf(passage.reference)}.`
      : null;
  if (!detour && !passage.attribution) return null;
  return (
    <p className="mt-2 text-[13px] text-muted">
      {detour}
      {detour && passage.attribution ? ' ' : ''}
      {passage.attribution &&
        (passage.attribution.url ? (
          <a
            href={passage.attribution.url}
            className="underline decoration-border-strong underline-offset-[3px]"
            rel="noreferrer"
          >
            {passage.attribution.text}
          </a>
        ) : (
          passage.attribution.text
        ))}
    </p>
  );
}

/** "Ecclesiasticus" out of "Ecclesiasticus 44:1-15". */
function bookOf(reference: string): string {
  return reference.replace(/\s+\d.*$/, '');
}
