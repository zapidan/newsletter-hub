/**
 * Production-ready logging utility with user context and structured formatting
 *
 * Features:
 * - User ID inclusion in all logs
 * - Log level filtering based on environment
 * - Structured log format with metadata
 * - Performance monitoring
 * - Error tracking with stack traces
 * - Request/response logging
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  error?: Error;
  stack?: string;
}

class Logger {
  private static instance: Logger;
  private currentContext: LogContext = {};
  private logLevel: LogLevel;

  private constructor() {
    // Set log level based on environment
    this.logLevel = this.getEnvironmentLogLevel();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private getEnvironmentLogLevel(): LogLevel {
    const env = import.meta.env.MODE;
    const level = import.meta.env.VITE_LOG_LEVEL;

    if (level) {
      switch (level.toUpperCase()) {
        case 'DEBUG': return LogLevel.DEBUG;
        case 'INFO': return LogLevel.INFO;
        case 'WARN': return LogLevel.WARN;
        case 'ERROR': return LogLevel.ERROR;
      }
    }

    // Default levels by environment
    switch (env) {
      case 'development':
        return LogLevel.DEBUG;
      case 'staging':
        return LogLevel.INFO;
      case 'production':
        return LogLevel.WARN;
      default:
        return LogLevel.INFO;
    }
  }

  public setContext(context: Partial<LogContext>): void {
    this.currentContext = { ...this.currentContext, ...context };
  }

  public clearContext(): void {
    this.currentContext = {};
  }

  public setUserId(userId: string | null): void {
    if (userId) {
      this.currentContext.userId = userId;
    } else {
      delete this.currentContext.userId;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatMessage(level: LogLevel, message: string, context: LogContext): string {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];

    // Build prefix with user ID if available
    const userIdPrefix = context.userId ? `[user id] {${context.userId}}` : '[user id] {anonymous}';

    // Build component context
    const componentPrefix = context.component ? `[${context.component}]` : '';

    // Build action context
    const actionPrefix = context.action ? `[${context.action}]` : '';

    return `${timestamp} ${levelName} ${userIdPrefix} ${componentPrefix}${actionPrefix} ${message}`;
  }

  private createLogEntry(level: LogLevel, message: string, context: LogContext, error?: Error): LogEntry {
    const mergedContext = { ...this.currentContext, ...context };

    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: mergedContext,
      error,
      stack: error?.stack,
    };
  }

  private outputLog(entry: LogEntry): void {
    const formattedMessage = this.formatMessage(entry.level, entry.message, entry.context);

    // Add metadata if present
    const metadata = entry.context.metadata;
    const metadataStr = metadata ? ` | Metadata: ${JSON.stringify(metadata)}` : '';

    const fullMessage = formattedMessage + metadataStr;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(fullMessage);
        break;
      case LogLevel.INFO:
        console.info(fullMessage);
        break;
      case LogLevel.WARN:
        console.warn(fullMessage);
        if (entry.error) console.warn(entry.error);
        break;
      case LogLevel.ERROR:
        console.error(fullMessage);
        if (entry.error) console.error(entry.error);
        break;
    }

    // In production, you might want to send logs to an external service
    if (import.meta.env.MODE === 'production' && entry.level >= LogLevel.ERROR) {
      this.sendToExternalService(entry);
    }
  }

  private sendToExternalService(entry: LogEntry): void {
    // Placeholder for external logging service integration
    // This could be Sentry, LogRocket, DataDog, etc.
    try {
      // Example: Send to external service
      // await fetch('/api/logs', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(entry)
      // });
    } catch (error) {
      // Fallback to console if external service fails
      console.error('Failed to send log to external service:', error);
    }
  }

  public debug(message: string, context: LogContext = {}): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const entry = this.createLogEntry(LogLevel.DEBUG, message, context);
    this.outputLog(entry);
  }

  public info(message: string, context: LogContext = {}): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const entry = this.createLogEntry(LogLevel.INFO, message, context);
    this.outputLog(entry);
  }

  public warn(message: string, context: LogContext = {}, error?: Error): void {
    if (!this.shouldLog(LogLevel.WARN)) return;

    const entry = this.createLogEntry(LogLevel.WARN, message, context, error);
    this.outputLog(entry);
  }

  public error(message: string, context: LogContext = {}, error?: Error): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    const entry = this.createLogEntry(LogLevel.ERROR, message, context, error);
    this.outputLog(entry);
  }

  // Specialized logging methods for common use cases
  public auth(message: string, context: LogContext = {}): void {
    this.info(message, { ...context, component: 'Auth' });
  }

  public api(message: string, context: LogContext = {}): void {
    this.info(message, { ...context, component: 'API' });
  }

  public ui(message: string, context: LogContext = {}): void {
    this.debug(message, { ...context, component: 'UI' });
  }

  // Performance monitoring
  public startTimer(timerName: string): () => void {
    const start = performance.now();

    return () => {
      const duration = performance.now() - start;
      this.info(`${timerName} completed`, {
        component: 'Performance',
        metadata: { duration: `${duration.toFixed(2)}ms` }
      });
    };
  }

  // API request/response logging
  public logApiRequest(url: string, method: string, context: LogContext = {}): void {
    this.debug(`API Request: ${method} ${url}`, {
      ...context,
      component: 'API',
      action: 'request',
      metadata: { url, method }
    });
  }

  public logApiResponse(url: string, method: string, status: number, duration: number, context: LogContext = {}): void {
    const level = status >= 400 ? LogLevel.WARN : LogLevel.DEBUG;
    const message = `API Response: ${method} ${url} - ${status} (${duration.toFixed(2)}ms)`;

    if (level === LogLevel.WARN) {
      this.warn(message, {
        ...context,
        component: 'API',
        action: 'response',
        metadata: { url, method, status, duration }
      });
    } else {
      this.debug(message, {
        ...context,
        component: 'API',
        action: 'response',
        metadata: { url, method, status, duration }
      });
    }
  }

  // Error boundary logging
  public logComponentError(componentName: string, error: Error, context: LogContext = {}): void {
    this.error(`Component error in ${componentName}`, {
      ...context,
      component: componentName,
      action: 'render_error',
      metadata: { errorName: error.name, errorMessage: error.message }
    }, error);
  }

  // User action logging
  public logUserAction(action: string, context: LogContext = {}): void {
    this.info(`User action: ${action}`, {
      ...context,
      component: 'UserAction',
      action,
    });
  }

  // Navigation logging
  public logNavigation(from: string, to: string, context: LogContext = {}): void {
    this.debug(`Navigation: ${from} -> ${to}`, {
      ...context,
      component: 'Navigation',
      action: 'route_change',
      metadata: { from, to }
    });
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export types for use in other files
export type { LogContext, LogEntry };
