import { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { logger, LogContext } from './Logger';

/**
 * Hook to automatically track user context for logging
 * Sets up user ID and session context when user authentication changes
 */
export const useLogger = (componentName?: string) => {
  const { user, session } = useAuth();

  useEffect(() => {
    // Update logger context when user changes
    if (user) {
      logger.setUserId(user.id);
      logger.setContext({
        sessionId: session?.access_token ? session.access_token.substring(0, 8) + '...' : undefined,
      });
    } else {
      logger.setUserId(null);
      logger.setContext({
        sessionId: undefined,
      });
    }
  }, [user, session]);

  // Create component-specific logging methods
  const createLoggerMethods = (component?: string) => ({
    debug: (message: string, context: LogContext = {}) => {
      logger.debug(message, { ...context, component: component || context.component });
    },
    info: (message: string, context: LogContext = {}) => {
      logger.info(message, { ...context, component: component || context.component });
    },
    warn: (message: string, context: LogContext = {}, error?: Error) => {
      logger.warn(message, { ...context, component: component || context.component }, error);
    },
    error: (message: string, context: LogContext = {}, error?: Error) => {
      logger.error(message, { ...context, component: component || context.component }, error);
    },
    auth: (message: string, context: LogContext = {}) => {
      logger.auth(message, { ...context, component: component || context.component });
    },
    api: (message: string, context: LogContext = {}) => {
      logger.api(message, { ...context, component: component || context.component });
    },
    ui: (message: string, context: LogContext = {}) => {
      logger.ui(message, { ...context, component: component || context.component });
    },
    logUserAction: (action: string, context: LogContext = {}) => {
      logger.logUserAction(action, { ...context, component: component || context.component });
    },
    logComponentError: (error: Error, context: LogContext = {}) => {
      logger.logComponentError(component || 'Unknown', error, context);
    },
    startTimer: (timerName: string) => {
      return logger.startTimer(`${component ? `[${component}] ` : ''}${timerName}`);
    },
  });

  return createLoggerMethods(componentName);
};

/**
 * Standalone logger methods for use outside of React components
 */
export const useLoggerStatic = () => {
  return {
    debug: logger.debug.bind(logger),
    info: logger.info.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger),
    auth: logger.auth.bind(logger),
    api: logger.api.bind(logger),
    ui: logger.ui.bind(logger),
    logUserAction: logger.logUserAction.bind(logger),
    logApiRequest: logger.logApiRequest.bind(logger),
    logApiResponse: logger.logApiResponse.bind(logger),
    logNavigation: logger.logNavigation.bind(logger),
    startTimer: logger.startTimer.bind(logger),
    setContext: logger.setContext.bind(logger),
    clearContext: logger.clearContext.bind(logger),
  };
};
