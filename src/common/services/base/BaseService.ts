// Logger will be initialized in subclasses as needed

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryCondition?: (error: Error) => boolean;
}

export interface ServiceOptions {
  retryOptions?: RetryOptions;
  timeout?: number;
}

export class ServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public originalError?: Error,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export class NetworkError extends ServiceError {
  constructor(message: string, originalError?: Error) {
    super(message, "NETWORK_ERROR", undefined, originalError);
    this.name = "NetworkError";
  }
}

export class ValidationError extends ServiceError {
  constructor(message: string, originalError?: Error) {
    super(message, "VALIDATION_ERROR", 400, originalError);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends ServiceError {
  constructor(message: string, originalError?: Error) {
    super(message, "NOT_FOUND", 404, originalError);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends ServiceError {
  constructor(message: string, originalError?: Error) {
    super(message, "UNAUTHORIZED", 401, originalError);
    this.name = "UnauthorizedError";
  }
}

export abstract class BaseService {
  protected defaultRetryOptions: RetryOptions = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryCondition: (error: Error) => {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        return false;
      }

      // Retry on network errors, timeout errors, or server errors (5xx)
      return !!(
        error instanceof NetworkError ||
        (error as Error & { code?: string }).code === "NETWORK_ERROR" ||
        (error as Error & { code?: string }).code === "TIMEOUT" ||
        ((error as Error & { statusCode?: number }).statusCode &&
          (error as Error & { statusCode?: number }).statusCode! >= 500)
      );
    },
  };

  constructor(protected options: ServiceOptions = {}) {
    this.options = {
      retryOptions: { ...this.defaultRetryOptions, ...options.retryOptions },
      timeout: options.timeout || 30000,
    };
  }

  protected async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    customRetryOptions?: RetryOptions,
  ): Promise<T> {
    const retryOptions = {
      ...this.defaultRetryOptions,
      ...this.options.retryOptions,
      ...customRetryOptions,
    };

    let lastError: Error;
    let attempt = 0;

    while (attempt <= (retryOptions.maxRetries || 3)) {
      try {
        const result = await this.withTimeout(
          operation(),
          this.options.timeout,
        );
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        const shouldRetry =
          attempt <= (retryOptions.maxRetries || 3) &&
          (retryOptions.retryCondition?.(lastError) ?? true);

        if (!shouldRetry) {
          throw this.normalizeError(lastError, operationName);
        }

        const delay = Math.min(
          (retryOptions.baseDelay || 1000) *
          Math.pow(retryOptions.backoffMultiplier || 2, attempt - 1),
          retryOptions.maxDelay || 30000,
        );

        await this.delay(delay);
      }
    }

    throw this.normalizeError(lastError!, operationName);
  }

  protected async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs?: number,
  ): Promise<T> {
    const timeout = timeoutMs || this.options.timeout || 30000;

    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new ServiceError("Operation timed out", "TIMEOUT")),
          timeout,
        ),
      ),
    ]);
  }

  protected normalizeError(error: Error, operationName: string): ServiceError {
    if (error instanceof ServiceError) {
      return error;
    }

    // Handle common error patterns
    if (error.message?.includes("fetch")) {
      return new NetworkError(
        `Network error during ${operationName}: ${error.message}`,
        error,
      );
    }

    if (error.message?.includes("timeout")) {
      return new ServiceError(
        `Timeout during ${operationName}: ${error.message}`,
        "TIMEOUT",
        undefined,
        error,
      );
    }

    if (error.message?.includes("unauthorized")) {
      return new UnauthorizedError(
        `Unauthorized during ${operationName}: ${error.message}`,
        error,
      );
    }

    if (error.message?.includes("not found")) {
      return new NotFoundError(
        `Resource not found during ${operationName}: ${error.message}`,
        error,
      );
    }

    // Default to generic service error
    return new ServiceError(
      `Error during ${operationName}: ${error.message}`,
      "GENERIC_ERROR",
      undefined,
      error,
    );
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected validateRequired<T>(
    value: T | null | undefined,
    fieldName: string,
  ): T {
    if (value === null || value === undefined) {
      throw new ValidationError(`${fieldName} is required`);
    }
    return value;
  }

  protected validateString(
    value: string | null | undefined,
    fieldName: string,
    options: { minLength?: number; maxLength?: number; pattern?: RegExp } = {},
  ): string {
    const validatedValue = this.validateRequired(value, fieldName);

    if (typeof validatedValue !== "string") {
      throw new ValidationError(`${fieldName} must be a string`);
    }

    if (options.minLength && validatedValue.length < options.minLength) {
      throw new ValidationError(
        `${fieldName} must be at least ${options.minLength} characters long`,
      );
    }

    if (options.maxLength && validatedValue.length > options.maxLength) {
      throw new ValidationError(
        `${fieldName} must be at most ${options.maxLength} characters long`,
      );
    }

    if (options.pattern && !options.pattern.test(validatedValue)) {
      throw new ValidationError(
        `${fieldName} does not match the required pattern`,
      );
    }

    return validatedValue;
  }

  protected validateArray<T>(
    value: T[] | null | undefined,
    fieldName: string,
    options: { minLength?: number; maxLength?: number } = {},
  ): T[] {
    const validatedValue = this.validateRequired(value, fieldName);

    if (!Array.isArray(validatedValue)) {
      throw new ValidationError(`${fieldName} must be an array`);
    }

    if (options.minLength && validatedValue.length < options.minLength) {
      throw new ValidationError(
        `${fieldName} must have at least ${options.minLength} items`,
      );
    }

    if (options.maxLength && validatedValue.length > options.maxLength) {
      throw new ValidationError(
        `${fieldName} must have at most ${options.maxLength} items`,
      );
    }

    return validatedValue;
  }

  protected createBatchProcessor<T, R>(
    batchSize: number = 50,
    processor: (batch: T[]) => Promise<R[]>,
  ) {
    return async (items: T[]): Promise<R[]> => {
      const results: R[] = [];

      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await this.withRetry(
          () => processor(batch),
          `batch-process-${i / batchSize + 1}`,
        );
        results.push(...batchResults);
      }

      return results;
    };
  }

  protected async executeWithLogging<T>(
    operation: () => Promise<T>,
    _operationName: string,
    _metadata?: Record<string, unknown>,
  ): Promise<T> {
    // Subclasses should implement their own logging
    return await operation();
  }
}
