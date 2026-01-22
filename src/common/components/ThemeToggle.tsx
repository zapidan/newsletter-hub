import { applyTheme, getCurrentTheme, getStoredTheme, setStoredTheme, toggleTheme } from '@common/theme/theme';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

const ThemeToggle: React.FC = () => {
  const [mode, setMode] = useState<'light' | 'dark'>(getCurrentTheme());

  useEffect(() => {
    const stored = getStoredTheme();
    if (stored) {
      applyTheme(stored);
      setMode(stored);
    } else {
      setMode(getCurrentTheme());
    }
  }, []);

  const handleToggle = () => {
    const next = toggleTheme();
    setStoredTheme(next);
    setMode(next);
  };

  const isDark = mode === 'dark';

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label="Toggle theme"
      className="p-2 rounded-lg transition-colors text-slate-600 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/60"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
};

export default ThemeToggle;
