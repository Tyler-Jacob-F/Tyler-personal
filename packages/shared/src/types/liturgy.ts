import { z } from 'zod';
import { frontmatterBaseSchema } from './base.js';

/**
 * Translations the passage service can serve: the public-domain texts bible-api.com
 * carries, by its codes. The group reads the one the liturgy names.
 */
export const translations = ['kjv', 'web', 'webbe', 'asv', 'bbe', 'darby', 'dra', 'ylt'] as const;
export const translationSchema = z.enum(translations);
export type Translation = z.infer<typeof translationSchema>;

export const translationNames: Record<Translation, string> = {
  kjv: 'King James Version',
  web: 'World English Bible',
  webbe: 'World English Bible, British Edition',
  asv: 'American Standard Version',
  bbe: 'Bible in Basic English',
  darby: 'Darby Translation',
  dra: 'Douay-Rheims',
  ylt: 'Young’s Literal Translation',
};

/**
 * The group's settings (docs/phases/04-group.md "The refresh"): the fixed liturgy that
 * repeats every week, stored once as one versioned document so a new week's guide is
 * entered without re-typing it, and the translation the readings are served in. The page
 * assembles the evening from the week's guide and this: Opening (guide), Table, Before the
 * reading, Scripture (guide), Reflection (guide), Closing (the guide's lines, then the
 * songbook line, the Lord's Prayer as People, the final collect). One document; a change
 * is a new version. Written by the admin and co-leads; no agent scope writes it.
 */
export const liturgyFrontmatterSchema = frontmatterBaseSchema
  .partial({ title: true })
  .extend({
    translation: translationSchema.default('kjv'),
    /** The line under "Table". */
    table: z.string().trim().min(1).max(500),
    /** The collect before the reading. */
    beforeReading: z.string().trim().min(1).max(2000),
    /** The italic line after the closing collect: singing and prayers for each other. */
    songbook: z.string().trim().min(1).max(500),
    /** Said by the people; line breaks kept. */
    lordsPrayer: z.string().trim().min(1).max(2000),
    /** The final collect, said by the leader. */
    closing: z.string().trim().min(1).max(2000),
  })
  .transform((l) => ({ ...l, title: l.title ?? 'The fixed liturgy' }));
export type LiturgyFrontmatter = z.infer<typeof liturgyFrontmatterSchema>;

/**
 * What the form offers the first time, before the group has saved its own: Redeemer's
 * guide as the group has used it (Fall 2026), so Tyler saves it once and edits it never.
 * Data, not a migration: nothing is stored until a person clicks Save.
 */
export const DEFAULT_LITURGY: LiturgyFrontmatter = {
  title: 'The fixed liturgy',
  translation: 'kjv',
  table: 'Enjoy each other’s company with food and drink.',
  beforeReading:
    'Blessed Lord, who caused all Holy Scriptures to be written for our learning: Grant us so to hear them, read, mark, learn, and inwardly digest them, that by patience and the comfort of your Holy Word we may embrace and ever hold fast the blessed hope of everlasting life, which you have given us in our Savior Jesus Christ; who lives and reigns with you and the Holy Spirit, one God, for ever and ever. Amen.',
  songbook:
    'You may sing together from the Parish Songbook. Prayers may be offered for each other and our neighbors.',
  lordsPrayer: [
    'Our Father, who art in heaven, hallowed be thy Name.',
    'Thy kingdom come, thy will be done, on earth as it is in heaven.',
    'Give us this day our daily bread.',
    'And forgive us our trespasses, as we forgive those who trespass against us.',
    'And lead us not into temptation, but deliver us from evil.',
    'For thine is the kingdom, and the power, and the glory, forever and ever. Amen.',
  ].join('\n'),
  closing:
    'Lord Jesus Christ, you stretched out your arms of love on the hard wood of the Cross that everyone might come within the reach of your saving embrace: So clothe us in your Spirit that we, reaching forth our hands in love, may bring those who do not know you to the knowledge and love of you; for the honor of your Name. Amen.',
};
