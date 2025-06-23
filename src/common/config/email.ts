import { logger } from "../utils/logger";

// Initialize logger
const log = logger;

// Email configuration with environment variable support
const emailConfig = {
  // Default domain for email aliases
  // Can be overridden by VITE_EMAIL_DEFAULT_DOMAIN environment variable
  defaultDomain: 'newsletterhub.com',
};

// Only try to access import.meta.env in browser environment
if (typeof import.meta !== 'undefined' && import.meta.env) {
  emailConfig.defaultDomain = import.meta.env.VITE_EMAIL_DEFAULT_DOMAIN || emailConfig.defaultDomain;
}

// Fallback to process.env for test environment
if (process.env.VITE_EMAIL_DEFAULT_DOMAIN) {
  emailConfig.defaultDomain = process.env.VITE_EMAIL_DEFAULT_DOMAIN;
}

// Validate configuration
if (!emailConfig.defaultDomain.includes(".")) {
  log.warn("Invalid default email domain. Using fallback domain.", {
    component: "EmailConfig",
    action: "validate_domain",
    metadata: {
      invalidDomain: emailConfig.defaultDomain,
      fallbackDomain: "newsletterhub.com",
    },
  });
  emailConfig.defaultDomain = "newsletterhub.com";
}

// Freeze config after validation
Object.freeze(emailConfig);

export default emailConfig;
