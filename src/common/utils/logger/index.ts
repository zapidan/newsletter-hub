/**
 * Logger module exports
 *
 * Provides centralized logging with user context, structured formatting,
 * and production-ready features like log levels and performance monitoring.
 */

export { logger, LogLevel } from "./Logger";
export type { LogContext, LogEntry } from "./Logger";
export { useLogger, useLoggerStatic } from "./useLogger";
export { ErrorBoundary, withErrorBoundary } from "./ErrorBoundary";

// Re-export the singleton logger instance as default
export { logger as default } from "./Logger";
