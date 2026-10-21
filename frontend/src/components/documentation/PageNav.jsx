import { DOC_SECTIONS } from '../../data/docs/wikiPages';

// Left rail: every documentation page grouped by section, with the current page
// highlighted. Clicking a page navigates without leaving the documentation view.
export default function PageNav({ pages, currentPage, onSelect }) {
  return (
    <nav className="docs-nav" aria-label="Documentation sections">
      {DOC_SECTIONS.map((section) => {
        const sectionPages = [...pages]
          .filter((page) => page.section === section.id)
          .sort((a, b) => a.order - b.order);
        return (
          <div key={section.id} className="docs-nav-section">
            <h3 className="docs-nav-section-title">{section.label}</h3>
            <ul>
              {sectionPages.map((page) => (
                <li key={page.id}>
                  <a
                    href={`#${page.id}`}
                    className={`docs-nav-link${currentPage === page.id ? ' docs-nav-link--active' : ''}`}
                    onClick={(event) => {
                      event.preventDefault();
                      onSelect(page.id);
                    }}
                    aria-current={currentPage === page.id ? 'page' : undefined}
                  >
                    <span className="docs-nav-dot" aria-hidden="true" />
                    {page.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
