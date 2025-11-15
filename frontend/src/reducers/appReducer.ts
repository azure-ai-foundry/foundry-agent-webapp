import type { AppState, AppAction } from '../types/appState';

/**
 * Main application state reducer.
 * Handles all state transitions for auth, chat, and UI coordination.
 * 
 * Design principles:
 * - Pure function - no side effects
 * - Immutable updates - always return new state objects
 * - Exhaustive action handling via discriminated unions
 * - Optimized updates - only modify what changed
 * 
 * @param state - Current application state
 * @param action - Action to process (discriminated union)
 * @returns New application state
 */
export const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    // === Authentication Actions ===
    case 'AUTH_INITIALIZED':
      return {
        ...state,
        auth: {
          status: 'authenticated',
          user: action.user,
          error: null,
        },
      };

    case 'AUTH_TOKEN_EXPIRED':
      return {
        ...state,
        auth: {
          ...state.auth,
          status: 'unauthenticated',
        },
      };

    // === Chat Message Actions ===
    case 'CHAT_SEND_MESSAGE':
      return {
        ...state,
        chat: {
          ...state.chat,
          status: 'sending',
          messages: [...state.chat.messages, action.message],
        },
      };

    case 'CHAT_ADD_ASSISTANT_MESSAGE':
      return {
        ...state,
        chat: {
          ...state.chat,
          messages: [
            ...state.chat.messages,
            {
              id: action.messageId,
              role: 'assistant' as const,
              content: '',
              more: {
                time: new Date().toISOString(),
              },
            },
          ],
        },
      };

    // === Chat Streaming Actions ===
    case 'CHAT_START_STREAM':
      return {
        ...state,
        chat: {
          ...state.chat,
          status: 'streaming',
          currentConversationId: action.conversationId || state.chat.currentConversationId,
          streamingMessageId: action.messageId,
          error: null,
        },
        ui: {
          ...state.ui,
          chatInputEnabled: false,
        },
      };

    case 'CHAT_STREAM_CHUNK': {
      // Performance optimization: only update the specific message being streamed
      const messageIndex = state.chat.messages.findIndex(
        msg => msg.id === action.messageId
      );
      
      if (messageIndex === -1) {
        // Message not found - return unchanged state
        return state;
      }
      
      // Create new array with updated message
      const updatedMessages = [...state.chat.messages];
      updatedMessages[messageIndex] = {
        ...updatedMessages[messageIndex],
        content: updatedMessages[messageIndex].content + action.content,
      };
      
      return {
        ...state,
        chat: {
          ...state.chat,
          messages: updatedMessages,
        },
      };
    }

    case 'CHAT_STREAM_COMPLETE': {
      // Update the completed message with usage info
      const updatedMessages = state.chat.messages.map(msg =>
        msg.id === state.chat.streamingMessageId
          ? {
              ...msg,
              more: {
                ...msg.more,
                usage: action.usage,
              },
              duration: action.usage.duration,
            }
          : msg
      );

      return {
        ...state,
        chat: {
          ...state.chat,
          status: 'idle',
          streamingMessageId: undefined,
          messages: updatedMessages,
        },
        ui: {
          ...state.ui,
          chatInputEnabled: true,
        },
      };
    }

    case 'CHAT_CANCEL_STREAM':
      return {
        ...state,
        chat: {
          ...state.chat,
          status: 'idle',
          streamingMessageId: undefined,
        },
        ui: {
          ...state.ui,
          chatInputEnabled: true,
        },
      };

    // === Chat Error Handling ===
    case 'CHAT_ERROR':
      return {
        ...state,
        chat: {
          ...state.chat,
          status: 'error',
          error: action.error,
          streamingMessageId: undefined,
        },
        ui: {
          ...state.ui,
          chatInputEnabled: action.error.recoverable,
        },
      };

    case 'CHAT_CLEAR_ERROR':
      return {
        ...state,
        chat: {
          ...state.chat,
          error: null,
          status: 'idle',
        },
        ui: {
          ...state.ui,
          chatInputEnabled: true,
        },
      };

    case 'CHAT_CLEAR':
      return {
        ...state,
        chat: {
          status: 'idle',
          messages: [],
          currentConversationId: null,
          error: null,
          streamingMessageId: undefined,
        },
        ui: {
          ...state.ui,
          chatInputEnabled: true,
        },
      };

    default:
      // TypeScript ensures all actions are handled (exhaustiveness check)
      return state;
  }
};
