import { useCallback, useMemo, useState } from 'react';
import { ArrowLeft, Book } from '../ui/Icons';
import { DOC_PAGES, pageById } from '../../data/docs/wikiPages';
import PageNav from './PageNav';
import MarkdownPage from './MarkdownPage';

// Documentation viewer: a modern, clean reference for the wiki and tech stack,
// rendered inside the platform so a clinician can read it beside their data.
// Navigation is kept in the URL as ?doc=<page-id> so a docs page stays
// shareable, while the workflow hash stays free for the analytics workflows.
export default function DocumentationSection({ onClose }) {
  const [pageId, setPageId] = useState(() => {
    if (typeof window === 'undefined') return 'start-here';
    const params = new URLSearchParams(window.location.search);
    return (params.get('doc') && pageById(params.get('doc')) ? params.get('doc') : 'start-here');
  });
  const [targetHeading, setTargetHeading] = useState(null);

  const page = useMemo(() => pageById(pageId), [pageId]);
  const content = page ? page.content : '';

  const navigate = useCallback(
    (id, heading) => {
      setPageId(id);
      setTargetHeading(heading);
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        params.set('doc', id);
        window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
      }
    },
    []
  );

  return (
    <section className="docs-section" aria-labelledby="docs-title">
      <div className="docs-header">
        <button className="docs-back" type="button" onClick={onClose}>
          <ArrowLeft size={17} aria-hidden="true" />
          <span>Back to workspace</span>
        </button>
        <div className="docs-brand">
          <Book size={20} aria-hidden="true" />
          <div>
            <h1 id="docs-title">{page ? page.title : 'Documentation'}</h1>
            <p className="docs-eyebrow">Welina platform wiki · browser-local reference</p>
          </div>
        </div>
      </div>
      <div className="docs-body">
        <PageNav pages={DOC_PAGES} currentPage={pageId} onSelect={(id) => navigate(id, null)} />
        <div className="docs-content-wrap">
          <MarkdownPage
            content={content}
            pageId={pageId}
            targetHeading={targetHeading}
            onNavigate={navigate}
          />
        </div>
      </div>
    </section>
  );
}
