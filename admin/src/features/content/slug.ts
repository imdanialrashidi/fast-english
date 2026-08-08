// admin/src/features/content/slug.ts
// English-title slug suggestion (client mirror of the server rule).
// The server validates the final value; this is only a convenience.

export function slugify(title: string): string {
  const s = String(title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s.slice(0, 120);
}
