import { vi } from 'vitest';
import { createMockSupabaseClient } from './e2e/test-utils/mock-supabase';

// Initialize the mock Supabase client
const mockSupabase = createMockSupabaseClient();

// Make the mock Supabase client available globally for debugging
(global as any).__MOCK_SUPABASE__ = mockSupabase;

// Mock any global objects needed for testing
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0,
};

global.localStorage = localStorageMock as unknown as Storage;

// Mock the window.matchMedia function
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock the ResizeObserver
class ResizeObserverStub {
  observe() { }
  unobserve() { }
  disconnect() { }
}

window.ResizeObserver = window.ResizeObserver || ResizeObserverStub;

// Mock the IntersectionObserver
class IntersectionObserverStub {
  constructor() { }
  observe() { }
  unobserve() { }
  disconnect() { }
}

window.IntersectionObserver = window.IntersectionObserver || IntersectionObserverStub;

// Mock the scrollTo method
window.scrollTo = jest.fn();

// Mock the requestAnimationFrame and cancelAnimationFrame
const requestAnimationFrame = (callback: FrameRequestCallback): number => {
  return setTimeout(() => callback(performance.now()));
};

const cancelAnimationFrame = (id: number) => {
  clearTimeout(id);
};

window.requestAnimationFrame = window.requestAnimationFrame || requestAnimationFrame;
window.cancelAnimationFrame = window.cancelAnimationFrame || cancelAnimationFrame;

// Mock the performance API if not available
if (!window.performance) {
  (window as any).performance = {
    now: () => Date.now(),
  };
}

// Mock the URL.createObjectURL method
if (!window.URL.createObjectURL) {
  Object.defineProperty(window.URL, 'createObjectURL', {
    value: jest.fn(),
  });
}

// Mock the fetch API
const mockFetch = jest.fn();
window.fetch = mockFetch as unknown as typeof window.fetch;

// Mock the console methods to reduce noise in test output
const originalConsole = { ...console };
const consoleMock = Object.keys(console).reduce((acc, key) => {
  if (typeof (console as any)[key] === 'function') {
    (acc as any)[key] = jest.fn();
  } else {
    (acc as any)[key] = (console as any)[key];
  }
  return acc;
}, {} as Console);

global.console = {
  ...originalConsole,
  ...consoleMock,
  // Keep error and warn visible in test output
  error: (...args: any[]) => originalConsole.error(...args),
  warn: (...args: any[]) => originalConsole.warn(...args),
};

export { };

