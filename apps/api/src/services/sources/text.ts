import type { Verse } from '@the-keep/shared';

/** One line of text per verse, inner whitespace collapsed. */
export function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Verses out of running text with bracketed numbers, "[15] Wherefore I also… [16] Cease
 * not…", as Crossway's text endpoint and API.Bible's text content both write them. The
 * chapter is the span's first; it turns over when a verse number falls back to a smaller
 * one, since a chapter's verses only climb. Text before the first number (a heading the
 * source let through) is dropped.
 */
export function versesFromMarked(text: string, firstChapter: number): Verse[] {
  const verses: Verse[] = [];
  let chapter = firstChapter;
  let previous = 0;
  const marked = /\[(\d+)\]\s*([^[]*)/g;
  for (const match of text.matchAll(marked)) {
    const verse = Number(match[1]);
    if (verse < previous) chapter += 1;
    previous = verse;
    const body = tidy(match[2] ?? '');
    if (body) verses.push({ chapter, verse, text: body });
  }
  return verses;
}
