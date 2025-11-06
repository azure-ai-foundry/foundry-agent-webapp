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
  NETWORK: 'Connection lost. Please check your internet connection.',
  AUTH: 'Session expired. Please sign in again.',
  STREAM: 'Error receiving response. Please try again.',
  SERVER: 'Server error occurred. Please try again.',
  UNKNOWN: 'Something went wrong. Please try again.',
};

/**
 * Determine if an error is recoverable
 */
export function isRecoverableError(code: ErrorCode): boolean {
  // AUTH requires re-login, UNKNOWN may indicate critical failure
  // NETWORK, STREAM, and SERVER errors are typically recoverable with retry
  return code !== 'AUTH' && code !== 'UNKNOWN';
}
