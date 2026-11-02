import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib';

/**
 * A page flow over pdf-lib: US Letter, one column, a cursor that moves down and turns the
 * page when it runs out. The standard fonts (Times for the reading measure, Helvetica for
 * labels) need no file and no embedding, so the chunk stays small and the PDF stays under
 * 20 KB; Literata on paper is a later question. The colors are the paper palette of
 * index.css (`--text`, `--muted`, `--border`) as fractions, because a PDF has no CSS.
 */
export const paper = {
  text: rgb(0x22 / 255, 0x1d / 255, 0x18 / 255),
  strong: rgb(0x17 / 255, 0x13 / 255, 0x10 / 255),
  muted: rgb(0x6b / 255, 0x61 / 255, 0x56 / 255),
  border: rgb(0xc9 / 255, 0xbe / 255, 0xae / 255),
};

export interface Fonts {
  serif: PDFFont;
  serifItalic: PDFFont;
  serifBold: PDFFont;
  sans: PDFFont;
  sansBold: PDFFont;
}

export interface TextStyle {
  font: PDFFont;
  size: number;
  /** Line height in points; defaults to 1.4 × size. */
  leading?: number;
  color?: ReturnType<typeof rgb>;
  /** Left inset from the margin, in points. */
  indent?: number;
  /** Width of the measure from the indent, in points; defaults to the rest of the column. */
  width?: number;
}

const LETTER: [number, number] = [612, 792];
const MARGIN = 54;

/** Characters the standard fonts cannot encode, replaced with what a mail body would say. */
const SUBSTITUTIONS: Array<[RegExp, string]> = [
  [/⅓/g, '1/3'],
  [/⅔/g, '2/3'],
  [/⅛/g, '1/8'],
  [/⅜/g, '3/8'],
  [/⅝/g, '5/8'],
  [/⅞/g, '7/8'],
  [/[\u2010-\u2012]/g, '-'],
  [/\u2212/g, '-'],
  [/\u00a0/g, ' '],
  [/\u2009|\u202f/g, ' '],
];

/** The text as the standard fonts can set it: known fractions spelled out, anything else outside WinAnsi dropped. */
export function encodable(text: string, font: PDFFont): string {
  let out = text;
  for (const [pattern, replacement] of SUBSTITUTIONS) out = out.replace(pattern, replacement);
  return Array.from(out)
    .filter((char) => {
      try {
        font.encodeText(char);
        return true;
      } catch {
        return false;
      }
    })
    .join('');
}

export class PdfFlow {
  private page!: PDFPage;
  private y = 0;
  private readonly pages: PDFPage[] = [];

  readonly doc: PDFDocument;
  readonly fonts: Fonts;

  private constructor(doc: PDFDocument, fonts: Fonts) {
    this.doc = doc;
    this.fonts = fonts;
    this.newPage();
  }

  static async create(): Promise<PdfFlow> {
    const doc = await PDFDocument.create();
    const [serif, serifItalic, serifBold, sans, sansBold] = await Promise.all([
      doc.embedFont(StandardFonts.TimesRoman),
      doc.embedFont(StandardFonts.TimesRomanItalic),
      doc.embedFont(StandardFonts.TimesRomanBold),
      doc.embedFont(StandardFonts.Helvetica),
      doc.embedFont(StandardFonts.HelveticaBold),
    ]);
    return new PdfFlow(doc, { serif, serifItalic, serifBold, sans, sansBold });
  }

  get columnWidth(): number {
    return LETTER[0] - MARGIN * 2;
  }

  private newPage() {
    this.page = this.doc.addPage(LETTER);
    this.pages.push(this.page);
    this.y = LETTER[1] - MARGIN;
  }

  /** Make room for `height` points, turning the page when the column is spent. */
  private need(height: number) {
    if (this.y - height < MARGIN) this.newPage();
  }

  /** Move down `points`, never past the top of a new page. */
  space(points: number) {
    this.y -= points;
    if (this.y < MARGIN) this.newPage();
  }

  /** A hairline across the column. */
  rule() {
    this.need(1);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: LETTER[0] - MARGIN, y: this.y },
      thickness: 0.5,
      color: paper.border,
    });
  }

  /** Break the text into lines that fit the measure. */
  wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const lines: string[] = [];
    for (const paragraph of encodable(text, font).split('\n')) {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        lines.push('');
        continue;
      }
      let line = '';
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= width || !line) line = candidate;
        else {
          lines.push(line);
          line = word;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  /** Set a run of text in the flow, wrapped, page-breaking between lines. Returns the lines set. */
  text(text: string, style: TextStyle): number {
    const leading = style.leading ?? style.size * 1.4;
    const indent = style.indent ?? 0;
    const width = style.width ?? this.columnWidth - indent;
    const lines = this.wrap(text, style.font, style.size, width);
    for (const line of lines) {
      this.need(leading);
      this.page.drawText(line, {
        x: MARGIN + indent,
        y: this.y - style.size,
        size: style.size,
        font: style.font,
        color: style.color ?? paper.text,
      });
      this.y -= leading;
    }
    return lines.length;
  }

  /**
   * A row with a label in a left column and text that wraps beside it: an ingredient's
   * amount and item, a step's number and instruction. The row never splits across pages.
   */
  row(label: string, text: string, labelWidth: number, style: TextStyle, labelStyle?: TextStyle) {
    const leading = style.leading ?? style.size * 1.4;
    const indent = style.indent ?? 0;
    const lines = this.wrap(text, style.font, style.size, this.columnWidth - indent - labelWidth);
    this.need(leading * lines.length);
    const ls = labelStyle ?? { ...style, color: paper.muted };
    this.page.drawText(encodable(label, ls.font), {
      x: MARGIN + indent,
      y: this.y - style.size,
      size: ls.size,
      font: ls.font,
      color: ls.color ?? paper.muted,
    });
    for (const line of lines) {
      this.page.drawText(line, {
        x: MARGIN + indent + labelWidth,
        y: this.y - style.size,
        size: style.size,
        font: style.font,
        color: style.color ?? paper.text,
      });
      this.y -= leading;
    }
  }

  /** Small sans labels in a line, separated by middots, in muted. */
  facts(items: string[], size = 10) {
    this.text(items.join(' · '), { font: this.fonts.sans, size, color: paper.muted });
  }

  /** An eyebrow: Helvetica Bold, small, uppercase, letterspaced by hand, muted. */
  eyebrow(label: string) {
    const size = 8;
    const spacing = 1.2;
    this.need(size * 1.4);
    let x = MARGIN;
    for (const char of encodable(label.toUpperCase(), this.fonts.sansBold)) {
      this.page.drawText(char, {
        x,
        y: this.y - size,
        size,
        font: this.fonts.sansBold,
        color: paper.muted,
      });
      x += this.fonts.sansBold.widthOfTextAtSize(char, size) + spacing;
    }
    this.y -= size * 1.4;
  }

  /** "Title · 2 of 3" at the foot of every page, only when there is more than one. */
  private footers(title: string) {
    if (this.pages.length < 2) return;
    const size = 8;
    this.pages.forEach((page, i) => {
      const label = encodable(`${title} · ${i + 1} of ${this.pages.length}`, this.fonts.sans);
      const width = this.fonts.sans.widthOfTextAtSize(label, size);
      page.drawText(label, {
        x: (LETTER[0] - width) / 2,
        y: MARGIN / 2,
        size,
        font: this.fonts.sans,
        color: paper.muted,
      });
    });
  }

  async finish(title: string): Promise<Uint8Array> {
    this.footers(title);
    this.doc.setTitle(title);
    this.doc.setProducer('The Keep');
    this.doc.setCreator('The Keep');
    return this.doc.save();
  }
}
