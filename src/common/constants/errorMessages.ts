// Error codes for different failure scenarios
export const ERROR_CODES = {
  // Authentication errors
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_USER: 'INVALID_USER',

  // Newsletter errors
  NEWSLETTER_NOT_FOUND: 'NEWSLETTER_NOT_FOUND',
  NEWSLETTER_ACCESS_DENIED: 'NEWSLETTER_ACCESS_DENIED',
  NEWSLETTER_UPDATE_FAILED: 'NEWSLETTER_UPDATE_FAILED',
  NEWSLETTER_DELETE_FAILED: 'NEWSLETTER_DELETE_FAILED',

  // Tag errors
  TAG_UPDATE_FAILED: 'TAG_UPDATE_FAILED',
  TAG_NOT_FOUND: 'TAG_NOT_FOUND',
  TAG_CREATE_FAILED: 'TAG_CREATE_FAILED',
  TAG_DELETE_FAILED: 'TAG_DELETE_FAILED',
  INVALID_TAG_IDS: 'INVALID_TAG_IDS',

  // Validation errors
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',

  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
} as const;

// User-friendly error messages
export const ERROR_MESSAGES = {
  // Authentication
  [ERROR_CODES.AUTH_REQUIRED]: 'Please log in to continue',
  [ERROR_CODES.INVALID_USER]: 'Invalid user session. Please log in again',

  // Newsletter operations
  [ERROR_CODES.NEWSLETTER_NOT_FOUND]: 'Newsletter not found or has been deleted',
  [ERROR_CODES.NEWSLETTER_ACCESS_DENIED]: 'You do not have permission to access this newsletter',
  [ERROR_CODES.NEWSLETTER_UPDATE_FAILED]: 'Failed to update newsletter. Please try again',
  [ERROR_CODES.NEWSLETTER_DELETE_FAILED]: 'Failed to delete newsletter. Please try again',

  // Tag operations
  [ERROR_CODES.TAG_UPDATE_FAILED]: 'Failed to update tags. Please try again',
  [ERROR_CODES.TAG_NOT_FOUND]: 'Tag not found or has been deleted',
  [ERROR_CODES.TAG_CREATE_FAILED]: 'Failed to create tag. Please try again',
  [ERROR_CODES.TAG_DELETE_FAILED]: 'Failed to delete tag. Please try again',
  [ERROR_CODES.INVALID_TAG_IDS]: 'Invalid tag selection. Please refresh and try again',

  // Validation
  [ERROR_CODES.MISSING_REQUIRED_FIELD]: 'Required field is missing',
  [ERROR_CODES.INVALID_FORMAT]: 'Invalid format provided',

  // Network
  [ERROR_CODES.NETWORK_ERROR]: 'Network connection error. Please check your internet connection',
  [ERROR_CODES.SERVER_ERROR]: 'Server error occurred. Please try again later',
  [ERROR_CODES.TIMEOUT_ERROR]: 'Request timed out. Please try again',
} as const;

// Generic error messages for common scenarios
export const GENERIC_ERROR_MESSAGES = {
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again',
  OPERATION_FAILED: 'Operation failed. Please try again',
  LOADING_FAILED: 'Failed to load data. Please refresh the page',
  SAVE_FAILED: 'Failed to save changes. Please try again',
  CONNECTION_ERROR: 'Connection error. Please check your internet connection and try again',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  NEWSLETTER_UPDATED: 'Newsletter updated successfully',
  NEWSLETTER_DELETED: 'Newsletter deleted successfully',
  NEWSLETTER_ARCHIVED: 'Newsletter archived successfully',
  NEWSLETTER_UNARCHIVED: 'Newsletter unarchived successfully',
  TAGS_UPDATED: 'Tags updated successfully',
  TAG_CREATED: 'Tag created successfully',
  TAG_DELETED: 'Tag deleted successfully',
  BULK_OPERATION_COMPLETED: 'Bulk operation completed successfully',
} as const;

// Helper function to get error message by code
export const getErrorMessage = (
  code: keyof typeof ERROR_CODES | string,
  fallback: string = GENERIC_ERROR_MESSAGES.UNKNOWN_ERROR
): string => {
  return ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES] || fallback;
};

// Helper function to create error with code
export const createErrorWithCode = (
  code: keyof typeof ERROR_CODES,
  customMessage?: string
): Error & { code: string } => {
  const error = new Error(customMessage || getErrorMessage(code)) as Error & { code: string };
  error.code = code;
  return error;
};

// Type for error with code
export type ErrorWithCode = Error & { code: string };

// Helper function to check if error has specific code
export const hasErrorCode = (error: unknown, code: keyof typeof ERROR_CODES): boolean => {
  return error instanceof Error && 'code' in error && error.code === code;
};
