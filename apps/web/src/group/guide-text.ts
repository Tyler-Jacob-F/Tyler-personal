import type { VoiceLine } from '@the-keep/shared';

/**
 * The guide form's grammar (docs/phases/04-group.md "The refresh"): a co-lead copies the
 * printed guide into a few textareas rather than building lists by hand. Responsive
 * prayers are paragraphs that start "Leader:" or "People:"; readings and questions are one
 * per line, with any numbering a paste brought along dropped.
 */

const voiceLine = /^(leader|people)\s*:\s*([\s\S]*)$/i;

/** Paragraphs to voice lines; the message of the first paragraph that names no voice. */
export function parseVoices(text: string): { lines: VoiceLine[] } | { error: string } {
  const lines: VoiceLine[] = [];
  for (const paragraph of text.split(/\n\s*\n/)) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    const match = voiceLine.exec(trimmed);
    if (!match) return { error: 'Start each paragraph with "Leader:" or "People:".' };
    const voice = match[1]!.toLowerCase() === 'leader' ? 'leader' : 'people';
    const body = match[2]!.replace(/[ \t]*\n[ \t]*/g, '\n').trim();
    if (!body) return { error: `"${match[1]}:" needs words after it.` };
    lines.push({ voice, text: body });
  }
  return { lines };
}

export function formatVoices(lines: VoiceLine[]): string {
  return lines
    .map((line) => `${line.voice === 'leader' ? 'Leader' : 'People'}: ${line.text}`)
    .join('\n\n');
}

/** One item per line, numbering stripped, blanks dropped. */
export function parseLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*(\d+[.)]|[-*•])\s*/, '').trim())
    .filter(Boolean);
}

export function formatLines(items: string[]): string {
  return items.join('\n');
}
