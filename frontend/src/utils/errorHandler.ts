import type { AppError, ErrorCode } from '../types/errors';
import { DETAILED_ERROR_MESSAGES, isRecoverableError } from '../types/errors';

/**
 * Get user-friendly error message with recovery hints.
 * Provides more detailed, actionable guidance than basic error messages.
 * 
 * @param code - Error code
 * @param includeHint - Whether to include recovery hint
 * @returns User-friendly error message
 */
export function getUserFriendlyMessage(code: ErrorCode, includeHint: boolean = true): string {
  const detailed = DETAILED_ERROR_MESSAGES[code];
  
  if (includeHint) {
    return `${detailed.description} ${detailed.hint}`;
  }
  
  return detailed.description;
}

/**
 * Convert various error types to structured AppError
 */
export function createAppError(
  error: unknown,
  code: ErrorCode = 'UNKNOWN',
  retryHandler?: () => void
): AppError {
  // Use user-friendly message instead of raw error message
  const friendlyMessage = getUserFriendlyMessage(code);
  
  const appError: AppError = {
    code,
    message: friendlyMessage,
    recoverable: isRecoverableError(code),
    originalError: error instanceof Error ? error : undefined,
  };

  // Add retry action for recoverable errors
  if (appError.recoverable && retryHandler) {
    appError.action = {
      label: 'Retry',
      handler: retryHandler,
    };
  }

  return appError;
}

/**
 * Determine error code from HTTP response
 */
export function getErrorCodeFromResponse(response: Response): ErrorCode {
  // Match Azure sample pattern: check status codes explicitly
  if (response.status === 401 || response.status === 403) {
    return 'AUTH';
  }
  if (response.status >= 500) {
    return 'SERVER'; // Server-side error
  }
  if (response.status >= 400) {
    return 'SERVER'; // Client error (bad request, etc.)
  }
  if (!response.ok) {
    return 'NETWORK'; // Other HTTP errors
  }
  return 'UNKNOWN';
}

/**
 * Parse error from fetch response, ensuring we always return a string
 */
export async function parseErrorFromResponse(response: Response): Promise<string> {
  try {
    const data = await response.json();
    
    // Check for RFC 7807 Problem Details format (title/detail)
    if (data.title || data.detail) {
      // Prefer detail over title for more specific information
      return data.detail || data.title;
    }
    
    // Extract error message, handling both string and object formats
    const errorData = data.error || data.message;
    
    // If errorData is an object with a message property, extract it
    if (errorData && typeof errorData === 'object' && 'message' in errorData) {
      return String(errorData.message);
    }
    
    // If errorData is a string, return it
    if (typeof errorData === 'string') {
      return errorData;
    }
    
    // Fallback to user-friendly message based on status code
    const errorCode = getErrorCodeFromResponse(response);
    return getUserFriendlyMessage(errorCode);
  } catch {
    // If JSON parsing fails, use user-friendly message
    const errorCode = getErrorCodeFromResponse(response);
    return getUserFriendlyMessage(errorCode);
  }
}

/**
 * Determine error code from error message/type
 */
export function getErrorCodeFromMessage(error: unknown): ErrorCode {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  
  if (message.includes('token') || message.includes('auth') || message.includes('unauthorized')) {
    return 'AUTH';
  }
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return 'NETWORK';
  }
  if (message.includes('stream')) {
    return 'STREAM';
  }
  
  return 'UNKNOWN';
}

/**
 * Check if error is due to token expiry
 */
export function isTokenExpiredError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes('token') && (message.includes('expired') || message.includes('invalid'));
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return true;
  }
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes('network') || message.includes('connection') || message.includes('fetch');
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry auth errors or non-network errors
      if (!isNetworkError(error)) {
        throw error;
      }
      
      // Don't wait after the last attempt
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
