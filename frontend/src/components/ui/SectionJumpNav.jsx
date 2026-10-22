export default function SectionJumpNav({ label, items = [] }) {
  if (!items.length) return null;
  function jumpTo(event, id) {
    // Keep App's workflow hash stable (#overview, #reports, etc.) while still
    // giving keyboard and screen-reader users a focusable in-page destination.
    if (event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const focusDestination = remaining => {
      const target = document.getElementById(id);
      if (target) {
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: 'start' });
      } else if (remaining > 0) {
        // Some destinations live inside lazy-loaded analytics sections.
        requestAnimationFrame(() => focusDestination(remaining - 1));
      }
    };
    focusDestination(120);
  }
  return <nav className="section-jump-nav" aria-label={label}>
    <span className="section-jump-nav__label">On this page</span>
    <ul>
      {items.map(item => <li key={item.id}>
        <a href={`#${item.id}`} onClick={event => jumpTo(event, item.id)}>{item.label}</a>
      </li>)}
    </ul>
  </nav>;
}
