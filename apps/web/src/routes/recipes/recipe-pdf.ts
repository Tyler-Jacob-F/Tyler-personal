import type { Version } from '@the-keep/shared';
import { versionLine } from '@/lib/dates';
import { titleOf } from '@/lib/frontmatter';
import { paper, PdfFlow } from '@/lib/pdf';
import { plainText } from '@/lib/share';
import {
  recipeFacts,
  recipeOf,
  splitHeadnote,
  splitIngredient,
  withoutMethodHeading,
  withoutTitleHeading,
} from '@/routes/recipes/format';

/**
 * The method's markdown as blocks the PDF can set: a heading, a numbered step, a bullet,
 * or a paragraph. Inline marks come off through plainText; the structure is read first so
 * steps keep their hanging numbers on paper as they do on the screen.
 */
type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'step'; number: string; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'paragraph'; text: string };

export function methodBlocks(method: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length > 0) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };
  for (const raw of method.split('\n')) {
    const line = raw.trim();
    const heading = /^#{1,6}\s+(.*?)\s*#*$/.exec(line);
    const step = /^(\d+)[.)]\s+(.*)$/.exec(line);
    const bullet = /^[-*+]\s+(.*)$/.exec(line);
    if (line === '') flush();
    else if (heading) {
      flush();
      blocks.push({ kind: 'heading', text: heading[1]! });
    } else if (step) {
      flush();
      blocks.push({ kind: 'step', number: step[1]!, text: step[2]! });
    } else if (bullet) {
      flush();
      blocks.push({ kind: 'bullet', text: bullet[1]! });
    } else if (/^\s+\S/.test(raw) && blocks.at(-1)?.kind === 'step') {
      // An indented continuation belongs to the step above it.
      const last = blocks.at(-1) as Extract<Block, { kind: 'step' }>;
      last.text = `${last.text} ${line}`;
    } else paragraph.push(line);
  }
  flush();
  return blocks.map((block) => ({ ...block, text: plainText(block.text) }));
}

/**
 * The recipe as a PDF to attach: title, headnote, provenance, the facts line between
 * hairlines, ingredient groups with amounts in a muted column, the method with hanging
 * step numbers, and the version line at the foot. One column, US Letter, Times and
 * Helvetica from the PDF's own standard fonts.
 */
export async function recipePdf(version: Version): Promise<Uint8Array> {
  const title = titleOf(version.frontmatter);
  const r = recipeOf(version.frontmatter);
  const { headnote, method } = splitHeadnote(version.body);
  const flow = await PdfFlow.create();
  const { serif, serifItalic, serifBold, sans } = flow.fonts;

  flow.text(title, { font: serif, size: 26, leading: 30, color: paper.strong });
  if (headnote) {
    flow.space(8);
    flow.text(plainText(headnote), { font: serifItalic, size: 12, leading: 17 });
  }
  if (r?.provenance) {
    flow.space(6);
    flow.text(`Provenance · ${r.provenance}`, { font: sans, size: 9, color: paper.muted });
  }

  const facts = recipeFacts(r);
  if (facts.length > 0) {
    flow.space(14);
    flow.rule();
    flow.space(8);
    flow.facts(facts.map(([label, value]) => `${label} ${value}`));
    flow.space(2);
    flow.rule();
  }

  if (r) {
    flow.space(22);
    flow.eyebrow('Ingredients');
    flow.space(6);
    r.ingredients.forEach((group, g) => {
      if (g > 0) flow.space(8);
      if (group.heading) {
        flow.text(group.heading, { font: serifBold, size: 12, leading: 18, color: paper.strong });
        flow.space(2);
      }
      for (const line of group.items) {
        const { amount, item } = splitIngredient(line);
        flow.row(amount, item, 72, { font: serif, size: 11, leading: 15 });
      }
    });
  }

  const blocks = methodBlocks(withoutTitleHeading(withoutMethodHeading(method), title));
  if (blocks.length > 0) {
    flow.space(22);
    flow.eyebrow('Method');
    flow.space(6);
    const body = { font: serif, size: 11.5, leading: 16 };
    blocks.forEach((block, i) => {
      if (i > 0) flow.space(block.kind === 'heading' ? 12 : 6);
      if (block.kind === 'heading') {
        flow.text(block.text, { font: serifBold, size: 12, leading: 18, color: paper.strong });
      } else if (block.kind === 'step') {
        flow.row(block.number, block.text, 22, body, { font: sans, size: 9, color: paper.muted });
      } else if (block.kind === 'bullet') {
        flow.row('•', block.text, 14, body);
      } else {
        flow.text(block.text, body);
      }
    });
  }

  flow.space(24);
  flow.text(versionLine(version), { font: sans, size: 8, color: paper.muted });

  return flow.finish(title);
}
