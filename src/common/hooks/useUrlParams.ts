import {
  orderDirectionValidator,
  positiveIntegerValidator,
  sanitizeUrlParam,
  sortFieldValidator,
  type Validator
} from '@common/utils/urlParamValidation';
import { useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

export type ParamValue = string | number | boolean | string[] | null | undefined;

export interface ParamConfig<T extends Record<string, ParamValue>> {
  [key: string]: {
    defaultValue?: T[keyof T];
    serialize?: (value: T[keyof T]) => string | null;
    deserialize?: (value: string) => T[keyof T];
    omitIfDefault?: boolean;
    validator?: Validator<any>;
    sanitize?: boolean;
  };
}

export interface UseUrlParamsOptions {
  replace?: boolean; // Use replace instead of push for navigation
  debounceMs?: number; // Debounce URL updates
}

export function useUrlParams<T extends Record<string, ParamValue>>(
  config: ParamConfig<T>,
  options: UseUrlParamsOptions = {}
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { replace = true } = options;

  // Track last params to prevent unnecessary updates
  const lastParamsRef = useRef<string>('');
  const paramsRef = useRef<T>({} as T);

  // Parse current URL parameters based on config
  const params = useMemo(() => {
    const result = {} as T;

    for (const [key, paramConfig] of Object.entries(config)) {
      let urlValue = searchParams.get(key);

      // Sanitize the URL value if sanitization is enabled
      if (urlValue && paramConfig.sanitize) {
        urlValue = sanitizeUrlParam(urlValue);
      }

      if (urlValue === null) {
        result[key as keyof T] = paramConfig.defaultValue as T[keyof T];
      } else if (paramConfig.validator) {
        // Use custom validator if provided
        const validationResult = paramConfig.validator(urlValue, paramConfig.defaultValue);
        result[key as keyof T] = validationResult.isValid && validationResult.value !== undefined
          ? validationResult.value
          : paramConfig.defaultValue as T[keyof T];
      } else if (paramConfig.deserialize) {
        result[key as keyof T] = paramConfig.deserialize(urlValue);
      } else {
        // Default deserialization logic
        result[key as keyof T] = deserializeValue(urlValue, paramConfig.defaultValue) as T[keyof T];
      }
    }

    return result;
  }, [searchParams, config]);

  // Update URL parameters
  const updateParams = useCallback(
    (updates: Partial<T> | ((current: T) => Partial<T>)) => {
      const currentParams = paramsRef.current;
      const newParams = typeof updates === 'function' ? updates(currentParams) : updates;

      // Create string representation to compare with last params
      const newParamsString = JSON.stringify(newParams);

      // Prevent unnecessary updates if params haven't changed
      if (lastParamsRef.current === newParamsString) {
        return;
      }

      lastParamsRef.current = newParamsString;

      setSearchParams(
        (prevParams) => {
          const newSearchParams = new URLSearchParams(prevParams);

          // Update each parameter
          for (const [key, value] of Object.entries(newParams)) {
            const paramConfig = config[key];
            if (!paramConfig) continue;

            const defaultValue = paramConfig.defaultValue;
            const omitIfDefault = paramConfig.omitIfDefault ?? true;

            // Check if we should omit this parameter
            if (
              omitIfDefault &&
              (value === defaultValue || value === null || value === undefined)
            ) {
              newSearchParams.delete(key);
            } else {
              // Serialize the value
              const serializedValue = paramConfig.serialize
                ? paramConfig.serialize(value as T[keyof T])
                : serializeValue(value);

              if (serializedValue !== null) {
                newSearchParams.set(key, serializedValue);
              } else {
                newSearchParams.delete(key);
              }
            }
          }

          return newSearchParams;
        },
        { replace }
      );
    },
    [config, setSearchParams, replace]
  );

  // Update a single parameter
  const updateParam = useCallback(
    <K extends keyof T>(key: K, value: T[K] | ((current: T[K]) => T[K])) => {
      const currentValue = paramsRef.current[key];
      const newValue =
        typeof value === 'function' ? (value as (current: T[K]) => T[K])(currentValue) : value;
      updateParams({ [key]: newValue } as Partial<T>);
    },
    [updateParams] // Remove params dependency
  );

  // Get a single parameter
  const getParam = useCallback(
    <K extends keyof T>(key: K): T[K] => {
      return paramsRef.current[key];
    },
    [] // Remove params dependency
  );

  // Reset all parameters to defaults
  const resetParams = useCallback(() => {
    const defaultParams = {} as Partial<T>;
    for (const [key, paramConfig] of Object.entries(config)) {
      defaultParams[key as keyof T] = paramConfig.defaultValue as T[keyof T];
    }
    updateParams(defaultParams);
  }, [config, updateParams]);

  // Clear all parameters
  const clearParams = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace });
  }, [setSearchParams, replace]);

  // Check if current params differ from defaults
  const hasNonDefaultParams = useMemo(() => {
    return Object.entries(config).some(([key, paramConfig]) => {
      const currentValue = params[key as keyof T];
      const defaultValue = paramConfig.defaultValue;
      return currentValue !== defaultValue;
    });
  }, [params, config]);

  return {
    params,
    updateParams,
    updateParam,
    getParam,
    resetParams,
    clearParams,
    hasNonDefaultParams,
    searchParams, // Raw search params for advanced use cases
  };
}

// Default serialization logic
function serializeValue(value: ParamValue): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(',') : null;
  }

  return String(value);
}

// Default deserialization logic
function deserializeValue(value: string, defaultValue: ParamValue): ParamValue {
  if (Array.isArray(defaultValue)) {
    return value ? value.split(',').filter(Boolean) : [];
  }

  if (typeof defaultValue === 'boolean') {
    return value === 'true';
  }

  if (typeof defaultValue === 'number') {
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
  }

  return value;
}

// Specialized hook for inbox filters
export function useInboxUrlParams() {
  return useUrlParams({
    filter: {
      defaultValue: 'all' as const,
      omitIfDefault: true,
    },
    source: {
      defaultValue: null as string | null,
      omitIfDefault: true,
      serialize: (value: string | null) => value || '',
      deserialize: (value: string) => value || null,
    },
    time: {
      defaultValue: 'all' as const,
      omitIfDefault: true,
    },
    tags: {
      defaultValue: [] as string[],
      omitIfDefault: true,
      serialize: (value: string[]) => value.join(','),
      deserialize: (value: string) => (value ? value.split(',').filter(Boolean) : []),
    },
    sort: {
      defaultValue: 'received_at' as const,
      omitIfDefault: true,
      validator: sortFieldValidator,
      sanitize: true,
    },
    order: {
      defaultValue: 'desc' as const,
      omitIfDefault: true,
      validator: orderDirectionValidator,
      sanitize: true,
    },
  });
}

// Hook for reading queue URL params
export function useReadingQueueUrlParams() {
  return useUrlParams({
    page: {
      defaultValue: 1,
      omitIfDefault: true,
      validator: positiveIntegerValidator,
      sanitize: true,
      deserialize: (value: string) => Math.max(1, parseInt(value, 10) || 1),
    },
    sort: {
      defaultValue: 'created_at' as const,
      omitIfDefault: true,
      validator: sortFieldValidator,
      sanitize: true,
    },
    order: {
      defaultValue: 'desc' as const,
      omitIfDefault: true,
      validator: orderDirectionValidator,
      sanitize: true,
    },
  });
}
