/**
 * Error types and interfaces for structured error handling
 */

export type ErrorCode = 
  | 'NETWORK'      // Connection/fetch failures, 5xx errors
  | 'AUTH'         // 401/403 authentication errors
  | 'STREAM'       // SSE streaming errors
  | 'SERVER'       // 400/500 server response errors
  | 'UNKNOWN';     // Unclassified errors

export interface AppError {
  code: ErrorCode;
  message: string;
  recoverable: boolean;
  action?: {
    label: string;
    handler: () => void;
  };
  originalError?: Error;
}

/**
 * Error messages for different error codes
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  NETWORK: 'Unable to connect to the server. Please check your internet connection and try again.',
  AUTH: 'Your session has expired. Please sign in again to continue.',
  STREAM: 'The response was interrupted. Click Retry to continue your conversation.',
  SERVER: 'The server encountered an error. This has been logged and our team will investigate.',
  UNKNOWN: 'An unexpected error occurred. Please try again or contact support if the issue persists.',
};

/**
 * Detailed user-friendly messages with recovery hints
 */
export const DETAILED_ERROR_MESSAGES: Record<ErrorCode, { title: string; description: string; hint: string }> = {
  NETWORK: {
    title: 'Connection Lost',
    description: 'Unable to reach the server.',
    hint: 'Check your internet connection and try again.'
  },
  AUTH: {
    title: 'Session Expired',
    description: 'Your authentication session has timed out.',
    hint: 'Click "Sign in again" below to continue.'
  },
  STREAM: {
    title: 'Response Interrupted',
    description: 'The AI response was interrupted unexpectedly.',
    hint: 'Click "Retry" to resend your message.'
  },
  SERVER: {
    title: 'Server Error',
    description: 'The server encountered an unexpected error.',
    hint: 'Please try again in a few moments.'
  },
  UNKNOWN: {
    title: 'Unexpected Error',
    description: 'Something went wrong.',
    hint: 'Try refreshing the page or contact support if this continues.'
  }
};

/**
 * Determine if an error is recoverable
 */
export function isRecoverableError(code: ErrorCode): boolean {
  // AUTH requires re-login, UNKNOWN may indicate critical failure
  // NETWORK, STREAM, and SERVER errors are typically recoverable with retry
  return code !== 'AUTH' && code !== 'UNKNOWN';
}
