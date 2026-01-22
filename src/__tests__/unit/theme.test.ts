import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, getCurrentTheme, toggleTheme } from '../../common/theme/theme';

const getRoot = () => document.documentElement;

describe('theme utils', () => {
  const originalDispatch = window.dispatchEvent;
  let dispatchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset dark class before each
    getRoot().classList.remove('dark');
    dispatchSpy = vi.fn();
    // @ts-expect-error overriding for test
    window.dispatchEvent = dispatchSpy;
  });

  afterEach(() => {
    // @ts-expect-error restore
    window.dispatchEvent = originalDispatch;
    getRoot().classList.remove('dark');
    localStorage.removeItem('theme');
  });

  it('applyTheme("dark") adds html.dark and dispatches nh-theme-change', () => {
    applyTheme('dark');
    expect(getRoot().classList.contains('dark')).toBe(true);
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const evt = dispatchSpy.mock.calls[0]?.[0];
    expect(evt?.type).toBe('nh-theme-change');
  });

  it('applyTheme("light") removes html.dark and dispatches', () => {
    getRoot().classList.add('dark');
    applyTheme('light');
    expect(getRoot().classList.contains('dark')).toBe(false);
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
  });

  it('getCurrentTheme returns current mode', () => {
    expect(getCurrentTheme()).toBe('light');
    getRoot().classList.add('dark');
    expect(getCurrentTheme()).toBe('dark');
  });

  it('toggleTheme flips the theme and dispatches', () => {
    // starts light
    const next = toggleTheme();
    expect(next).toBe('dark');
    expect(getRoot().classList.contains('dark')).toBe(true);
    // second toggle
    const back = toggleTheme();
    expect(back).toBe('light');
    expect(getRoot().classList.contains('dark')).toBe(false);
  });
});
