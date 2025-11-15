import type { AccountInfo } from '@azure/msal-browser';
import type { IChatItem, IUsageInfo } from './chat';
import type { AppError } from './errors';

// Re-export types for convenience
export type { IChatItem, IUsageInfo };

/**
 * Central application state structure
 * All application state flows through this single source of truth
 */
export interface AppState {
  // Authentication state
  auth: {
    status: 'initializing' | 'authenticated' | 'unauthenticated' | 'error';
    user: AccountInfo | null;
    error: string | null;
  };
  
  // Chat operations state
  chat: {
    status: 'idle' | 'sending' | 'streaming' | 'error';
    messages: IChatItem[];
    currentConversationId: string | null;
    error: AppError | null; // Enhanced error object
    streamingMessageId?: string; // Which message is actively streaming
  };
  
  // UI coordination state
  ui: {
    chatInputEnabled: boolean; // Disable during streaming/errors
  };
}

/**
 * All possible actions that can modify application state
 * Use discriminated unions for type safety
 */
export type AppAction = 
  // Auth actions
  | { type: 'AUTH_INITIALIZED'; user: AccountInfo }
  | { type: 'AUTH_TOKEN_EXPIRED' }
  
  // Chat actions
  | { type: 'CHAT_SEND_MESSAGE'; message: IChatItem }
  | { type: 'CHAT_START_STREAM'; conversationId?: string; messageId: string }
  | { type: 'CHAT_STREAM_CHUNK'; messageId: string; content: string }
  | { type: 'CHAT_STREAM_COMPLETE'; usage: IUsageInfo }
  | { type: 'CHAT_CANCEL_STREAM' }
  | { type: 'CHAT_ERROR'; error: AppError } // Enhanced error object
  | { type: 'CHAT_CLEAR_ERROR' } // Clear error state
  | { type: 'CHAT_CLEAR' }
  | { type: 'CHAT_ADD_ASSISTANT_MESSAGE'; messageId: string };

/**
 * Initial state for the application
 */
export const initialAppState: AppState = {
  auth: {
    status: 'initializing',
    user: null,
    error: null,
  },
  chat: {
    status: 'idle',
    messages: [],
    currentConversationId: null,
    error: null,
    streamingMessageId: undefined,
  },
  ui: {
    chatInputEnabled: true,
  },
};
