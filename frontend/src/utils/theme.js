// Colour theme: an explicit choice wins, otherwise the operating system's setting.
export const THEME_KEY = 'welina_theme';

export function resolveTheme(stored, systemPrefersDark) {
  if (stored === 'light' || stored === 'dark') return stored;
  return systemPrefersDark ? 'dark' : 'light';
}
