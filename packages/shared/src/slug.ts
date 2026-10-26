/**
 * Kebab-case of a title. Collision suffixes (`chili-2`) are the data layer's job, since
 * only it can see what exists.
 */
export function slugify(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return slug || 'untitled';
}
