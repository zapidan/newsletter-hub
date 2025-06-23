import { act, renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useUrlParams, ParamConfig } from '../useUrlParams';
import { useSearchParams } from 'react-router-dom';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useSearchParams: vi.fn(),
  };
});

const mockUseSearchParams = vi.mocked(useSearchParams);

interface TestParams {
  strParam?: string | null;
  numParam?: number | null;
  boolParam?: boolean | null;
  arrParam?: string[] | null;
  customParam?: { value: string } | null;
}

const defaultConfig: ParamConfig<TestParams> = {
  strParam: { defaultValue: 'defaultStr', omitIfDefault: true },
  numParam: { defaultValue: 42, omitIfDefault: true },
  boolParam: { defaultValue: false, omitIfDefault: true },
  arrParam: { defaultValue: ['a', 'b'], omitIfDefault: true },
  customParam: {
    defaultValue: { value: 'default' },
    serialize: (v) => (v ? v.value : null),
    deserialize: (s) => (s ? { value: s } : { value: 'default' }),
    omitIfDefault: true,
  },
};

describe('useUrlParams', () => {
  let mockSetSearchParams: vi.Mock<any, any>;
  let currentSearchParamsState: URLSearchParams;

  const setupHook = (initialSearchString = "", config: ParamConfig<TestParams> = defaultConfig, options = {}) => {
    currentSearchParamsState = new URLSearchParams(initialSearchString);

    mockSetSearchParams = vi.fn((updater) => {
      const newParams = typeof updater === 'function' ? updater(currentSearchParamsState) : new URLSearchParams(updater);
      currentSearchParamsState = new URLSearchParams(newParams.toString());
      // Update the mock for subsequent calls to useSearchParams if the hook were to re-render due to this
      // This is the key: subsequent calls to useSearchParams (e.g. after rerender) get the new state
      mockUseSearchParams.mockImplementation(() => [currentSearchParamsState, mockSetSearchParams]);
    });

    mockUseSearchParams.mockImplementation(() => [currentSearchParamsState, mockSetSearchParams]);

    return renderHook(({conf, opts}) => useUrlParams<TestParams>(conf, opts), {
      initialProps: { conf: config, opts: options }
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('params initialization', () => {
    it('should return default values when URL has no params', () => {
      const { result } = setupHook();
      expect(result.current.params.strParam).toBe('defaultStr');
      expect(result.current.params.numParam).toBe(42);
    });

    it('should parse values from URLSearchParams', () => {
      const { result } = setupHook("strParam=urlStr&numParam=123&boolParam=true&arrParam=x,y,z&customParam=urlCustom");
      expect(result.current.params.strParam).toBe('urlStr');
      expect(result.current.params.numParam).toBe(123);
    });
  });

  describe('updateParams and updateParam', () => {
    it('updateParams should update URLSearchParams and reflect in params after rerender', async () => {
      const { result, rerender } = setupHook();

      act(() => {
        result.current.updateParams({ strParam: 'newStr', numParam: 99 });
      });
      // After mockSetSearchParams runs, currentSearchParamsState is updated.
      // Rerender the hook so it picks up the new searchParams from the updated mock.
      rerender({conf: defaultConfig, opts: {}});

      await waitFor(() => {
        expect(result.current.params.strParam).toBe('newStr');
        expect(result.current.params.numParam).toBe(99);
      });
      expect(mockSetSearchParams).toHaveBeenCalledTimes(1);
      expect(currentSearchParamsState.get('strParam')).toBe('newStr');
      expect(currentSearchParamsState.get('numParam')).toBe('99');
    });

    it('updateParams should omit default values from URL', async () => {
      const { result, rerender } = setupHook("strParam=nonDefault");
      act(() => {
        result.current.updateParams({ strParam: 'defaultStr' });
      });
      rerender({conf: defaultConfig, opts: {}});
      await waitFor(() => expect(result.current.params.strParam).toBe('defaultStr'));
      expect(currentSearchParamsState.has('strParam')).toBe(false);
    });
  });

  describe('resetParams', () => {
    it('should reset all params to their defaults', async () => {
      const { result, rerender } = setupHook("strParam=nonDefault&numParam=100");
      act(() => {
        result.current.resetParams();
      });
      rerender({conf: defaultConfig, opts: {}});
      await waitFor(() => {
        expect(result.current.params.strParam).toBe('defaultStr');
        expect(result.current.params.numParam).toBe(42);
      });
      expect(currentSearchParamsState.has('strParam')).toBe(false);
      expect(currentSearchParamsState.has('numParam')).toBe(false);
    });
  });

  describe('clearParams', () => {
    it('should remove all configured params from URL', async () => {
      const { result, rerender } = setupHook("strParam=abc&numParam=1");
      act(() => {
        result.current.clearParams();
      });
      rerender({conf: defaultConfig, opts: {}});
      await waitFor(() => { // Params in hook will revert to defaults as URL is empty
        expect(result.current.params.strParam).toBe('defaultStr');
      });
      expect(currentSearchParamsState.toString()).toBe('');
    });
  });

  describe('hasNonDefaultParams', () => {
    it('should be false if all params are default', () => {
      const { result } = setupHook();
      expect(result.current.hasNonDefaultParams).toBe(false);
    });

    it('should be true if any param is non-default', () => {
      const { result } = setupHook("strParam=nonDefault");
      expect(result.current.hasNonDefaultParams).toBe(true);
    });

    it('should become false after resetParams', async () => {
      const { result, rerender } = setupHook("strParam=nonDefault");
      expect(result.current.hasNonDefaultParams).toBe(true);
      act(() => result.current.resetParams());
      rerender({conf: defaultConfig, opts: {}});
      await waitFor(() => expect(result.current.hasNonDefaultParams).toBe(false));
    });
  });
});
