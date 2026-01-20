import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./mocks/server.js";

// Mock global objects
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
} as Storage;
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
} as Storage;
global.sessionStorage = sessionStorageMock;

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn();

// Mock crypto for UUID generation
Object.defineProperty(global, "crypto", {
  value: {
    randomUUID: () => "test-uuid-123",
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
  },
});

// Mock environment variables
vi.mock("@common/config/env", () => ({
  env: {
    VITE_SUPABASE_URL: "http://localhost:54321",
    VITE_SUPABASE_ANON_KEY: "test-anon-key",
    VITE_LOG_LEVEL: "DEBUG",
    NODE_ENV: "test",
    DEV: true,
  },
}));

// Mock React Router
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({
      pathname: "/test",
      search: "",
      hash: "",
      state: null,
    }),
    useParams: () => ({}),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

// Mock Supabase client
vi.mock("@common/config/supabase", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn(),
    }),
  },
}));

// Mock logger
const loggerMock = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  auth: vi.fn(),
  api: vi.fn(),
  ui: vi.fn(),
  logUserAction: vi.fn(),
  logComponentError: vi.fn(),
  logApiRequest: vi.fn(),
  logApiResponse: vi.fn(),
  logNavigation: vi.fn(),
  startTimer: vi.fn(() => ({ stop: vi.fn() })),
  setUserId: vi.fn(),
  setContext: vi.fn(),
  clearContext: vi.fn(),
};

vi.mock("@common/utils/logger", () => {
  const mockFn = vi.fn();
  return {
    logger: loggerMock,
    useLogger: () => ({
      debug: mockFn,
      info: mockFn,
      warn: mockFn,
      error: mockFn,
      auth: mockFn,
      api: mockFn,
      ui: mockFn,
      logUserAction: mockFn,
      logComponentError: mockFn,
      startTimer: () => ({ stop: mockFn }),
    }),
    useLoggerStatic: () => ({
      debug: mockFn,
      info: mockFn,
      warn: mockFn,
      error: mockFn,
      auth: mockFn,
      api: mockFn,
      ui: mockFn,
      logUserAction: mockFn,
      logApiRequest: mockFn,
      logApiResponse: mockFn,
      logNavigation: mockFn,
      startTimer: () => ({ stop: mockFn }),
      setContext: mockFn,
      clearContext: mockFn,
    }),
    LogLevel: {
      DEBUG: "DEBUG",
      INFO: "INFO",
      WARN: "WARN",
      ERROR: "ERROR",
    },
    ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
    withErrorBoundary: <P extends object>(
      component: React.ComponentType<P>
    ) => component,
    default: loggerMock,
  };
});

// Mock useLogger from the specific path used by NewsletterActions
vi.mock("@common/utils/logger/useLogger", () => {
  const mockFn = vi.fn();
  return {
    useLogger: () => ({
      debug: mockFn,
      info: mockFn,
      warn: mockFn,
      error: mockFn,
      auth: mockFn,
      api: mockFn,
      ui: mockFn,
      logUserAction: mockFn,
      logComponentError: mockFn,
      startTimer: () => ({ stop: mockFn }),
    }),
    useLoggerStatic: () => ({
      debug: mockFn,
      info: mockFn,
      warn: mockFn,
      error: mockFn,
      auth: mockFn,
      api: mockFn,
      ui: mockFn,
      logUserAction: mockFn,
      logApiRequest: mockFn,
      logApiResponse: mockFn,
      logNavigation: mockFn,
      startTimer: () => ({ stop: mockFn }),
      setContext: mockFn,
      clearContext: mockFn,
    }),
  };
});

// Mock toast notifications
vi.mock("react-hot-toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
  Toaster: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: "div",
    button: "button",
    span: "span",
    p: "p",
    h1: "h1",
    h2: "h2",
    h3: "h3",
    ul: "ul",
    li: "li",
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

// Establish API mocking before all tests
beforeAll(() => {
  server.listen({
    onUnhandledRequest: "warn",
  });
});

// Clean up after each test case
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.clearAllMocks();
  localStorageMock.clear();
  sessionStorageMock.clear();
});

// Clean up after all tests are done
afterAll(() => {
  server.close();
});

// Increase timeout for async operations
vi.setConfig({
  testTimeout: 10000,
});
