// Slug used for documentation headings and page ids. It mirrors the dot-removed
// convention the wiki (docs/wiki/Home.md) already uses for its internal links,
// so "6.3 Visual analysis" becomes "63-visual-analysis" and those links resolve
// inside the docs viewer.
export default function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
