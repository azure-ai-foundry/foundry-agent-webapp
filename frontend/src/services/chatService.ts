import type { Dispatch } from 'react';
import type { AppAction } from '../types/appState';
import type { IChatItem } from '../types/chat';
import type { AppError } from '../types/errors';
import {
  createAppError,
  getErrorCodeFromMessage,
  parseErrorFromResponse,
  getErrorCodeFromResponse,
  isTokenExpiredError,
  retryWithBackoff,
} from '../utils/errorHandler';
import {
  convertFilesToDataUris,
  createAttachmentMetadata,
} from '../utils/fileAttachments';
import { parseSseLine, splitSseBuffer } from '../utils/sseParser';

/**
 * ChatService handles all chat-related API operations.
 * Dispatches AppContext actions for state management.
 * 
 * @example
 * ```typescript
 * const chatService = new ChatService(
 *   '/api',
 *   getAccessToken,
 *   dispatch
 * );
 * 
 * // Send a message with images
 * await chatService.sendMessage(
 *   'Analyze this image',
 *   currentThreadId,
 *   [imageFile]
 * );
 * ```
 */
export class ChatService {
  private apiUrl: string;
  private getAccessToken: () => Promise<string | null>;
  private dispatch: Dispatch<AppAction>;
  private currentStreamAbort?: AbortController;
  // Flag indicating an intentional user cancellation of the active stream.
  private streamCancelled = false;

  constructor(
    apiUrl: string,
    getAccessToken: () => Promise<string | null>,
    dispatch: Dispatch<AppAction>
  ) {
    this.apiUrl = apiUrl;
    this.getAccessToken = getAccessToken;
    this.dispatch = dispatch;
  }

  /**
   * Acquire authentication token using MSAL.
   * Attempts silent acquisition first, falls back to popup if needed.
   * 
   * @returns Access token string
   * @throws {Error} If token acquisition fails
   */
  private async ensureAuthToken(): Promise<string> {
    const token = await this.getAccessToken();
    if (!token) {
      throw createAppError(new Error('Failed to acquire access token'), 'AUTH');
    }
    return token;
  }

  /**
   * Prepare message payload with optional file attachments.
   * Converts files to data URIs and creates attachment metadata.
   * 
   * @param text - Message text content
   * @param files - Optional array of image files
   * @returns Payload with content, data URIs, and attachment metadata
   */
  private async prepareMessagePayload(
    text: string,
    files?: File[]
  ): Promise<{
    content: string;
    imageDataUris: string[];
    attachments: IChatItem['attachments'];
  }> {
    let imageDataUris: string[] = [];
    let attachments: IChatItem['attachments'] = undefined;

    if (files && files.length > 0) {
      try {
        const results = await convertFilesToDataUris(files);
        imageDataUris = results.map((r) => r.dataUri);
        attachments = createAttachmentMetadata(results);
      } catch (error) {
        const appError = createAppError(error);
        this.dispatch({ type: 'CHAT_ERROR', error: appError });
        throw appError;
      }
    }

    return { content: text, imageDataUris, attachments };
  }

  /**
   * Construct request body for chat API.
   * 
   * @param message - User message text
   * @param conversationId - Current conversation ID (null for new conversations)
   * @param imageDataUris - Array of base64 data URIs for images
   * @returns Request body object
   */
  private constructRequestBody(
    message: string,
    conversationId: string | null,
    imageDataUris: string[]
  ): Record<string, any> {
    return {
      message,
      conversationId,
      imageDataUris: imageDataUris.length > 0 ? imageDataUris : undefined,
    };
  }

  /**
   * Initiate streaming fetch request to chat API.
   * Validates response and throws typed errors on failure.
   * 
   * @param url - API endpoint URL
   * @param token - Access token
   * @param body - Request body
   * @param signal - Abort signal for cancellation
   * @returns Response object
   * @throws {AppError} If request fails or response is not OK
   */
  private async initiateStream(
    url: string,
    token: string,
    body: Record<string, any>,
    signal: AbortSignal
  ): Promise<Response> {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    console.log(`[ChatService] Response status: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      console.error(`[ChatService] Response not OK: ${res.status} ${res.statusText}`);
      const errorMessage = await parseErrorFromResponse(res);
      const errorCode = getErrorCodeFromResponse(res);
      throw createAppError(new Error(errorMessage), errorCode);
    }

    return res;
  }

  /**
   * Send a message and stream the response from the Azure AI Agent.
   * Orchestrates authentication, file conversion, optimistic UI updates, and streaming.
   * 
   * @param messageText - The user's message text
   * @param currentConversationId - Current conversation ID (null for new conversations)
   * @param files - Optional array of image files to attach
   * @throws {Error} If authentication fails or API request fails
   * 
   * @remarks
   * Token acquisition: Attempts acquireTokenSilent first, falls back to acquireTokenPopup.
   * Retries failed requests up to 3 times with exponential backoff.
   */
  async sendMessage(
    messageText: string,
    currentConversationId: string | null,
    files?: File[]
  ): Promise<void> {
    if (this.currentStreamAbort) {
      this.streamCancelled = true;
      this.currentStreamAbort.abort();
      this.dispatch({ type: 'CHAT_CANCEL_STREAM' });
    }

    try {
      const token = await this.ensureAuthToken();
      const { content, imageDataUris, attachments } = await this.prepareMessagePayload(
        messageText,
        files
      );

      const userMessage: IChatItem = {
        id: Date.now().toString(),
        role: 'user',
        content,
        attachments,
        more: {
          time: new Date().toISOString(),
        },
      };

      this.dispatch({ type: 'CHAT_SEND_MESSAGE', message: userMessage });

      const assistantMessageId = (Date.now() + 1).toString();
      this.dispatch({ type: 'CHAT_ADD_ASSISTANT_MESSAGE', messageId: assistantMessageId });
      this.dispatch({
        type: 'CHAT_START_STREAM',
        conversationId: currentConversationId || undefined,
        messageId: assistantMessageId,
      });

      this.currentStreamAbort = new AbortController();
      this.streamCancelled = false;

      const requestBody = this.constructRequestBody(
        messageText,
        currentConversationId,
        imageDataUris
      );

      const response = await retryWithBackoff(
        async () =>
          this.initiateStream(
            `${this.apiUrl}/chat/stream`,
            token,
            requestBody,
            this.currentStreamAbort!.signal
          ),
        3,
        1000
      );

      await this.processStream(response, assistantMessageId, currentConversationId);
      this.currentStreamAbort = undefined;
      this.streamCancelled = false;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      if (isTokenExpiredError(error)) {
        this.dispatch({ type: 'AUTH_TOKEN_EXPIRED' });
      }

      const isAppError =
        error &&
        typeof error === 'object' &&
        'code' in error &&
        'message' in error &&
        'recoverable' in error;

      const appError: AppError = isAppError
        ? (error as AppError)
        : createAppError(
            error,
            getErrorCodeFromMessage(error),
            () => this.sendMessage(messageText, currentConversationId, files)
          );

      this.dispatch({ type: 'CHAT_ERROR', error: appError });
      throw error;
    }
  }

  /**
   * Process Server-Sent Events stream from the API.
   * Implements duplicate chunk suppression to prevent UI flicker.
   * 
   * @param response - Fetch Response object with SSE stream
   * @param messageId - ID of the assistant message being streamed
   * @param currentConversationId - Current conversation ID (null for new conversations)
   * @throws {Error} If stream is not readable or parsing fails
   */
  private async processStream(
    response: Response,
    messageId: string,
    currentConversationId: string | null
  ): Promise<void> {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      const error = createAppError(
        new Error(`Response body is not readable for message ${messageId}`),
        'STREAM'
      );
      this.dispatch({ type: 'CHAT_ERROR', error });
      throw error;
    }

    let newConversationId = currentConversationId;
    let lastChunkContent: string | undefined;
    let buffer = '';

    try {
      while (true) {
        if (this.streamCancelled) {
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const [lines, remaining] = splitSseBuffer(buffer);
        buffer = remaining;

        for (const line of lines) {
          const event = parseSseLine(line);
          if (!event) continue;

          if (event.data?.error) {
            console.error('[ChatService] SSE error event received:', event.data.error);
            const error = createAppError(
              new Error(event.data.error.message || event.data.error || 'Stream error occurred'),
              'STREAM'
            );
            this.dispatch({ type: 'CHAT_ERROR', error });
            throw error;
          }

          switch (event.type) {
            case 'conversationId':
              if (!newConversationId) {
                newConversationId = event.data.conversationId;
                this.dispatch({
                  type: 'CHAT_START_STREAM',
                  conversationId: event.data.conversationId,
                  messageId,
                });
              }
              break;

            case 'chunk':
              if (event.data.content !== lastChunkContent) {
                this.dispatch({
                  type: 'CHAT_STREAM_CHUNK',
                  messageId,
                  content: event.data.content,
                });
                lastChunkContent = event.data.content;
              }
              break;

            case 'usage':
              this.dispatch({
                type: 'CHAT_STREAM_COMPLETE',
                usage: {
                  promptTokens: event.data.promptTokens,
                  completionTokens: event.data.completionTokens,
                  totalTokens: event.data.totalTokens,
                  duration: event.data.duration,
                },
              });
              break;

            case 'done':
              return;

            case 'error':
              const error = createAppError(
                new Error(`Stream error for message ${messageId}: ${event.data.message}`),
                'STREAM'
              );
              this.dispatch({ type: 'CHAT_ERROR', error });
              throw error;
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError' && this.streamCancelled) {
        console.log('[ChatService] Stream intentionally cancelled by user');
        return;
      }

      console.error('[ChatService] Stream processing error:', error, {
        conversationId: currentConversationId,
        messageId,
      });

      const appError =
        error instanceof Error && 'code' in error
          ? error
          : createAppError(
              new Error(
                `Stream processing failed: ${error instanceof Error ? error.message : String(error)} (Conversation: ${currentConversationId}, Message: ${messageId})`
              ),
              'STREAM'
            );
      this.dispatch({ type: 'CHAT_ERROR', error: appError as AppError });
      throw error;
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // Reader may already be released
      }
    }
  }

  /**
   * Clear chat history and reset to empty state.
   * Dispatches CHAT_CLEAR action to remove all messages and conversation ID.
   */
  clearChat(): void {
    this.dispatch({ type: 'CHAT_CLEAR' });
  }

  /**
   * Clear current error state without affecting chat history.
   * Dispatches CHAT_CLEAR_ERROR action.
   */
  clearError(): void {
    this.dispatch({ type: 'CHAT_CLEAR_ERROR' });
  }

  /**
   * Cancel the current streaming response if any is active.
   * Abort controller is not cleared immediately to allow processStream
   * to observe the cancellation flag and exit gracefully.
   */
  cancelStream(): void {
    if (this.currentStreamAbort) {
      this.streamCancelled = true;
      this.currentStreamAbort.abort();
      console.log('[ChatService] Stream cancellation requested');
      this.dispatch({ type: 'CHAT_CANCEL_STREAM' });
    }
  }
}
