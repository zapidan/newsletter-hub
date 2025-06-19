import { logger } from "../utils/logger";

// Initialize logger
const log = logger;

// Email configuration with environment variable support
const emailConfig = {
  // Default username part for email aliases
  // Set to 'user' to use the email's username, or specify a custom value
  // Can be overridden by VITE_EMAIL_DEFAULT_USERNAME environment variable
  defaultUsername: import.meta.env.VITE_EMAIL_DEFAULT_USERNAME || "user",

  // Default domain for email aliases
  // Can be overridden by VITE_EMAIL_DEFAULT_DOMAIN environment variable
  defaultDomain:
    import.meta.env.VITE_EMAIL_DEFAULT_DOMAIN || "newsletterhub.com",
};

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
