import { briefFrontmatterSchema } from '@the-keep/shared';
import { frontmatterOf } from '@/lib/frontmatter';

export const briefOf = frontmatterOf(briefFrontmatterSchema);
