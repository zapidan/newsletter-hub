import { AuthError } from "@supabase/supabase-js";
import { logger } from "../utils/logger";

// Custom error types
export enum ErrorType {
  NETWORK = "NETWORK_ERROR",
  AUTH = "AUTH_ERROR",
  VALIDATION = "VALIDATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  RATE_LIMIT = "RATE_LIMIT",
  SERVER = "SERVER_ERROR",
  DATABASE = "DATABASE_ERROR",
  UNKNOWN = "UNKNOWN_ERROR",
}

export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

// Initialize logger
const log = logger;

// Base application error class
export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly code?: string;
  public readonly details?: any;
  public readonly hint?: string;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    code?: string,
    details?: any,
    hint?: string,
    context?: Record<string, any>,
  ) {
    super(message);
    this.name = "AppError";
    this.type = type;
    this.severity = severity;
    this.code = code;
    this.details = details;
    this.hint = hint;
    this.timestamp = new Date();
    this.context = context;

    // Ensure the stack trace points to where the error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  // Convert to plain object for logging/serialization
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      severity: this.severity,
      code: this.code,
      details: this.details,
      hint: this.hint,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack,
    };
  }
}

// Specific error classes
export class NetworkError extends AppError {
  constructor(message: string, code?: string, details?: any) {
    super(message, ErrorType.NETWORK, ErrorSeverity.MEDIUM, code, details);
    this.name = "NetworkError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string, code?: string, details?: any) {
    super(message, ErrorType.AUTH, ErrorSeverity.HIGH, code, details);
    this.name = "AuthenticationError";
  }
}

export class ValidationError extends AppError {
  public readonly field?: string;

  constructor(message: string, field?: string, code?: string, details?: any) {
    super(message, ErrorType.VALIDATION, ErrorSeverity.LOW, code, details);
    this.name = "ValidationError";
    this.field = field;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, ErrorType.NOT_FOUND, ErrorSeverity.LOW);
    this.name = "NotFoundError";
  }
}

export class PermissionError extends AppError {
  constructor(action: string, resource?: string) {
    const message = resource
      ? `Permission denied: cannot ${action} ${resource}`
      : `Permission denied: cannot ${action}`;
    super(message, ErrorType.PERMISSION_DENIED, ErrorSeverity.HIGH);
    this.name = "PermissionError";
  }
}

// Error transformation utilities
export const transformSupabaseError = (error: any): AppError => {
  if (!error) {
    return new AppError("Unknown error occurred");
  }

  // Handle PostgrestError (database errors)
  if (error.code) {
    switch (error.code) {
      case "PGRST116":
        return new NotFoundError("Resource");

      case "23505":
        return new ValidationError(
          "This record already exists",
          undefined,
          error.code,
          error.details,
        );

      case "23503":
        return new ValidationError(
          "Referenced record does not exist",
          undefined,
          error.code,
          error.details,
        );

      case "42501":
        return new PermissionError("perform this action");

      case "PGRST301":
        return new AppError(
          "Request timeout",
          ErrorType.NETWORK,
          ErrorSeverity.MEDIUM,
          error.code,
        );

      default:
        return new AppError(
          error.message || "Database error occurred",
          ErrorType.DATABASE,
          ErrorSeverity.MEDIUM,
          error.code,
          error.details,
          error.hint,
        );
    }
  }

  // Handle AuthError
  if (error instanceof AuthError || error.name === "AuthError") {
    return new AuthenticationError(
      error.message || "Authentication failed",
      error.status?.toString(),
      error,
    );
  }

  // Handle network errors
  if (
    error.name === "NetworkError" ||
    error.message?.includes("fetch") ||
    error.message?.includes("network") ||
    error.code === "NETWORK_ERROR"
  ) {
    return new NetworkError(
      "Network connection failed. Please check your internet connection.",
      error.code,
      error,
    );
  }

  // Handle rate limiting
  if (error.status === 429 || error.code === "RATE_LIMIT_EXCEEDED") {
    return new AppError(
      "Too many requests. Please try again later.",
      ErrorType.RATE_LIMIT,
      ErrorSeverity.MEDIUM,
      error.code,
    );
  }

  // Handle server errors
  if (error.status >= 500 || error.code?.startsWith("5")) {
    return new AppError(
      "Server error occurred. Please try again later.",
      ErrorType.SERVER,
      ErrorSeverity.HIGH,
      error.status?.toString() || error.code,
      error,
    );
  }

  // Generic error handling
  return new AppError(
    error.message || "An unexpected error occurred",
    ErrorType.UNKNOWN,
    ErrorSeverity.MEDIUM,
    error.code,
    error,
  );
};

// User-friendly error messages
export const getUserFriendlyMessage = (error: AppError): string => {
  switch (error.type) {
    case ErrorType.NETWORK:
      return "Connection problem. Please check your internet and try again.";

    case ErrorType.AUTH:
      return "Please sign in to continue.";

    case ErrorType.VALIDATION:
      return error.message; // Validation messages are usually user-friendly

    case ErrorType.NOT_FOUND:
      return "The requested item could not be found.";

    case ErrorType.PERMISSION_DENIED:
      return "You don't have permission to perform this action.";

    case ErrorType.RATE_LIMIT:
      return "You're doing that too quickly. Please slow down and try again.";

    case ErrorType.SERVER:
      return "Something went wrong on our end. Please try again in a moment.";

    case ErrorType.DATABASE:
      return "There was a problem saving your data. Please try again.";

    default:
      return "Something unexpected happened. Please try again.";
  }
};

// Error logging utilities
export interface ErrorLogEntry {
  error: AppError;
  userId?: string;
  userAgent?: string;
  url?: string;
  timestamp: Date;
  sessionId?: string;
  buildVersion?: string;
}

export const logError = (
  error: AppError,
  context?: {
    userId?: string;
    operation?: string;
    component?: string;
    source?: string;
    additionalData?: Record<string, any>;
  },
): void => {
  const logEntry: ErrorLogEntry = {
    error,
    userId: context?.userId,
    userAgent: navigator?.userAgent,
    url: window?.location?.href,
    timestamp: new Date(),
    sessionId: getSessionId(),
    buildVersion: import.meta.env.VITE_APP_VERSION,
  };

  // Structured error logging
  const logLevel =
    error.severity === ErrorSeverity.CRITICAL ||
    error.severity === ErrorSeverity.HIGH
      ? "error"
      : "warn";
  const logMethod = logLevel === "error" ? log.error : log.warn;

  logMethod(
    `${error.name}: ${error.message}`,
    {
      component: "ErrorHandler",
      action: "log_error",
      metadata: {
        errorType: error.type,
        errorCode: error.code,
        severity: error.severity,
        details: error.details,
        context: context,
        timestamp: error.timestamp,
        sessionId: getSessionId(),
        buildVersion: import.meta.env.VITE_APP_VERSION,
      },
    },
    error,
  );

  // Send to error reporting service in production
  if (
    import.meta.env.MODE === "production" &&
    error.severity !== ErrorSeverity.LOW
  ) {
    reportErrorToService(logEntry);
  }
};

// Error reporting to external service (implement based on your service)
const reportErrorToService = async (logEntry: ErrorLogEntry): Promise<void> => {
  try {
    // Example: Send to Sentry, LogRocket, or custom error service
    // await errorReportingService.captureException(logEntry);

    // For now, we'll just store it locally or send to a custom endpoint
    if (import.meta.env.VITE_ERROR_REPORTING_ENDPOINT) {
      await fetch(import.meta.env.VITE_ERROR_REPORTING_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(logEntry),
      });
    }
  } catch (reportingError) {
    log.error(
      "Failed to report error to external service",
      {
        component: "ErrorHandler",
        action: "report_error",
        metadata: {
          originalError: logEntry.error?.message,
          reportingEndpoint: import.meta.env.VITE_ERROR_REPORTING_ENDPOINT,
        },
      },
      reportingError instanceof Error
        ? reportingError
        : new Error(String(reportingError)),
    );
  }
};

// Session ID utilities
let sessionId: string | null = null;

const getSessionId = (): string => {
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  return sessionId;
};

// Retry utilities
export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryCondition?: (error: AppError) => boolean;
}

export const withRetry = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> => {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    retryCondition = (error: AppError) =>
      error.type === ErrorType.NETWORK ||
      error.type === ErrorType.SERVER ||
      error.code === "PGRST301", // timeout
  } = options;

  let lastError: AppError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const appError =
        error instanceof AppError ? error : transformSupabaseError(error);
      lastError = appError;

      // Don't retry if this is the last attempt or if retry condition is not met
      if (attempt === maxAttempts || !retryCondition(appError)) {
        throw appError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelay * Math.pow(backoffFactor, attempt - 1),
        maxDelay,
      );

      console.warn(
        `Operation failed (attempt ${attempt}/${maxAttempts}). Retrying in ${delay}ms...`,
        appError.message,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
};

// Error boundary helpers for React
export const handleAsyncError = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  return transformSupabaseError(error);
};

// Validation helpers
export const createValidationError = (
  field: string,
  message: string,
  value?: any,
): ValidationError => {
  return new ValidationError(message, field, "VALIDATION_FAILED", {
    field,
    value,
  });
};

export const validateRequired = (value: any, fieldName: string): void => {
  if (value === null || value === undefined || value === "") {
    throw createValidationError(fieldName, `${fieldName} is required`);
  }
};

export const validateEmail = (email: string, fieldName = "email"): void => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw createValidationError(fieldName, "Invalid email format");
  }
};

export const validateMinLength = (
  value: string,
  minLength: number,
  fieldName: string,
): void => {
  if (value.length < minLength) {
    throw createValidationError(
      fieldName,
      `${fieldName} must be at least ${minLength} characters long`,
    );
  }
};

// Export error handling hook for React components
export const useErrorHandler = () => {
  return {
    handleError: (error: unknown, context?: Record<string, any>) => {
      const appError = handleAsyncError(error);
      logError(appError, context);
      return appError;
    },

    getUserMessage: (error: unknown): string => {
      const appError = handleAsyncError(error);
      return getUserFriendlyMessage(appError);
    },

    transformError: transformSupabaseError,

    createValidationError,
    validateRequired,
    validateEmail,
    validateMinLength,
  };
};

// Global error handler
export const setupGlobalErrorHandling = (): void => {
  // Handle unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    const error = transformSupabaseError(event.reason);
    logError(error, { source: "unhandledRejection" });

    // Prevent the default browser behavior
    event.preventDefault();
  });

  // Handle uncaught errors
  window.addEventListener("error", (event) => {
    const error = new AppError(
      event.message || "Uncaught error",
      ErrorType.UNKNOWN,
      ErrorSeverity.HIGH,
      undefined,
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    );

    logError(error, { source: "uncaughtError" });
  });
};

// Development helpers
export const simulateError = (type: ErrorType, message?: string): AppError => {
  if (import.meta.env.MODE !== "development") {
    throw new Error("simulateError is only available in development mode");
  }

  const defaultMessages = {
    [ErrorType.NETWORK]: "Simulated network error",
    [ErrorType.AUTH]: "Simulated authentication error",
    [ErrorType.VALIDATION]: "Simulated validation error",
    [ErrorType.NOT_FOUND]: "Simulated not found error",
    [ErrorType.PERMISSION_DENIED]: "Simulated permission error",
    [ErrorType.RATE_LIMIT]: "Simulated rate limit error",
    [ErrorType.SERVER]: "Simulated server error",
    [ErrorType.DATABASE]: "Simulated database error",
    [ErrorType.UNKNOWN]: "Simulated unknown error",
  };

  return new AppError(
    message || defaultMessages[type],
    type,
    ErrorSeverity.MEDIUM,
    "SIMULATED_ERROR",
  );
};
