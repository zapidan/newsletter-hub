export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'theme';

export function getStoredTheme(): ThemeMode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
    return null;
  } catch {
    return null;
  }
}

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  try {
    window.dispatchEvent(new CustomEvent('nh-theme-change', { detail: { mode } }));
  } catch {
    // no-op
  }
}

export function setStoredTheme(mode: ThemeMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // no-op
  }
}

export function getCurrentTheme(): ThemeMode {
  const root = document.documentElement;
  return root.classList.contains('dark') ? 'dark' : 'light';
}

export function toggleTheme(): ThemeMode {
  const next: ThemeMode = getCurrentTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  setStoredTheme(next);
  return next;
}
