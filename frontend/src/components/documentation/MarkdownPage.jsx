import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Marked } from 'marked';
import { List } from '../ui/Icons';
import slugify from '../../utils/slug';
import { pageById, ownerOf } from '../../data/docs/wikiPages';

// Renders one documentation page from markdown, with the wiki's own cross-links
// working inside the viewer: a link to another page's heading opens that page,
// and links to headings on the current page scroll in place.
export default function MarkdownPage({ content, pageId, targetHeading, onNavigate }) {
  const contentRef = useRef(null);

  // "On this page" table of contents from H2 headings.
  const toc = useMemo(() => {
    const entries = [];
    const re = /^##\s+(.+?)\s*$/gm;
    let m;
    while ((m = re.exec(content)) !== null) {
      entries.push({ slug: slugify(m[1]), text: m[1].trim() });
    }
    return entries;
  }, [content]);

  // marked renders the page; heading ids use the wiki's dot-removed slug
  // convention so internal links resolve, and external links open in a new tab.
  const html = useMemo(() => {
    const marked = new Marked();
    let out = marked.parse(content);
    out = out.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_, depth, inner) => {
      const plain = inner.replace(/<[^>]+>/g, '').trim();
      return `<h${depth} id="${slugify(plain)}">${inner}</h${depth}>`;
    });
    out = out.replace(/<a href="(https?:\/\/[^"]+)">/g, '<a href="$1" target="_blank" rel="noreferrer">');
    return out;
  }, [content]);

  const handleClick = useCallback(
    (event) => {
      const link = event.target.closest('a');
      if (!link) return;
      const href = link.getAttribute('href') || '';
      if (!href) return;

      // Internal page / heading reference (#slug)
      if (href.startsWith('#')) {
        const slug = href.slice(1);
        const targetPage = pageById(slug);
        if (targetPage) {
          event.preventDefault();
          onNavigate(targetPage.id, null);
          return;
        }
        const owner = ownerOf(slug);
        if (owner && owner !== pageId) {
          event.preventDefault();
          onNavigate(owner, slug);
          return;
        }
        // Same-page heading: let the browser scroll to it.
        return;
      }

      // Relative doc references (e.g. TECH_STACK.md) -> the tech stack page.
      if (href.endsWith('.md') || href.includes('.md')) {
        event.preventDefault();
        if (href.includes('TECH_STACK.md')) onNavigate('tech-stack', null);
        else window.open(href, '_blank');
        return;
      }
    },
    [pageId, onNavigate]
  );

  useEffect(() => {
    if (!targetHeading) return;
    const el = document.getElementById(targetHeading);
    if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [targetHeading]);

  return (
    <section className="docs-page" aria-label={`Documentation: ${pageId}`}>
      <nav className="docs-toc" aria-label="On this page">
        <h3 className="docs-toc-title"><List size={15} aria-hidden="true" /> On this page</h3>
        <ul>
          {toc.map((entry) => (
            <li key={entry.slug}>
              <a href={`#${entry.slug}`}>{entry.text}</a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="docs-content" ref={contentRef} onClick={handleClick} dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}
