import { useEffect, useState } from 'react';
import { Sun, Moon } from './Icons';
import { THEME_KEY, resolveTheme } from '../../utils/theme';

function readStored() {
  try { return localStorage.getItem(THEME_KEY); } catch { return null; }
}

// Switches between the light and dark theme. The first paint is set by a script in index.html.
export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => (typeof document === 'undefined' ? 'light' : document.documentElement.dataset.theme
    || resolveTheme(readStored(), window.matchMedia?.('(prefers-color-scheme: dark)').matches)));

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* storage blocked: the choice lasts for this visit */ }
  }

  const label = theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme';
  return <button type="button" className="icon-button icon-button--bordered theme-toggle" onClick={toggle} aria-label={label} title={label}>
    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
  </button>;
}
