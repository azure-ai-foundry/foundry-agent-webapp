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
   * Convert files to base64 data URIs for inline image transmission.
   * Validates file types (images only) and size limits (20MB max).
   * 
   * @param files - Array of File objects to convert
   * @returns Array of data URIs (e.g., "data:image/png;base64,...")
   * @throws {Error} If file is not an image or exceeds size limit
   * 
   * @example
   * ```typescript
   * const dataUris = await chatService.convertFilesToDataUris([imageFile]);
   * // dataUris[0] = "data:image/png;base64,iVBORw0KGgo..."
   * ```
   */
  async convertFilesToDataUris(files: File[]): Promise<string[]> {
    const dataUris: string[] = [];

    for (const file of files) {
      // Validate it's an image
      if (!file.type.startsWith('image/')) {
        const error = createAppError(
          new Error(`File "${file.name}" is not an image`),
        );
        this.dispatch({ type: 'CHAT_ERROR', error });
        throw error;
      }

      // Check file size (20MB limit)
      const MAX_FILE_SIZE = 20 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        const error = createAppError(
          new Error(`Image "${file.name}" exceeds 20MB limit`),
        );
        this.dispatch({ type: 'CHAT_ERROR', error });
        throw error;
      }

      // Read file as base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result); // Already in data URI format (data:image/png;base64,...)
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      dataUris.push(base64);
    }

    return dataUris;
  }

  /**
   * Send a message and stream the response from the Azure AI Agent.
   * Handles automatic cancellation of in-flight streams, file conversion,
   * and dispatches state actions throughout the process.
   * 
   * @param messageText - The user's message text
   * @param currentThreadId - Current thread ID (null for new threads)
   * @param files - Optional array of image files to attach
   * @throws {Error} If authentication fails or API request fails
   * 
   * @remarks
   * - Automatically cancels any existing stream before starting new one
   * - Converts images to base64 data URIs (no upload needed)
   * - Dispatches CHAT_SEND_MESSAGE, CHAT_START_STREAM, CHAT_STREAM_CHUNK, etc.
   * - Retries failed requests up to 3 times with exponential backoff
   * 
   * @example
   * ```typescript
   * await chatService.sendMessage(
   *   'Hello, how can you help?',
   *   threadId,
   *   [imageFile] // optional
   * );
   * ```
   */
  async sendMessage(
    messageText: string,
    currentThreadId: string | null,
    files?: File[]
  ): Promise<void> {
    // Cancel any inflight stream before starting a new one
    if (this.currentStreamAbort) {
      this.streamCancelled = true;
      this.currentStreamAbort.abort();
      // Allow processStream for prior request to observe streamCancelled and exit gracefully.
      this.dispatch({ type: 'CHAT_CANCEL_STREAM' });
    }
    try {
      const token = await this.getAccessToken();
      if (!token) {
        const error = createAppError(new Error('Failed to acquire access token'), 'AUTH');
        this.dispatch({ type: 'CHAT_ERROR', error });
        throw error;
      }

      // Convert images to base64 data URIs (no upload needed!)
      let imageDataUris: string[] = [];
      let uploadedAttachments: IChatItem['attachments'] = [];

      if (files && files.length > 0) {
        // Convert files to base64 data URIs for inline transmission
        imageDataUris = await this.convertFilesToDataUris(files);
        
        // Create attachment metadata for UI display (file name and size)
        uploadedAttachments = files.map((file, index) => ({
          fileName: file.name,
          fileSizeBytes: file.size,
          // Store data URI for preview if needed
          dataUri: imageDataUris[index],
        }));
      }

      // Create user message
      const userMessage: IChatItem = {
        id: Date.now().toString(),
        role: 'user',
        content: messageText,
        attachments: uploadedAttachments && uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
        more: {
          time: new Date().toISOString(),
        },
      };

      // Dispatch user message
      this.dispatch({ type: 'CHAT_SEND_MESSAGE', message: userMessage });

      // Create assistant message placeholder and start streaming state immediately
      const assistantMessageId = (Date.now() + 1).toString();
      this.dispatch({ type: 'CHAT_ADD_ASSISTANT_MESSAGE', messageId: assistantMessageId });
      
      // Set streaming state immediately (before fetch) so loading dots appear right away
      this.dispatch({ 
        type: 'CHAT_START_STREAM', 
        threadId: currentThreadId || undefined,
        messageId: assistantMessageId 
      });

      // Start streaming with retry
      this.currentStreamAbort = new AbortController();
      this.streamCancelled = false; // Reset cancellation flag for new stream
      const response = await retryWithBackoff(
        async () => {
          const res = await fetch(`${this.apiUrl}/chat/stream`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              message: messageText,
              threadId: currentThreadId,
              // Send images as base64 data URIs instead of file IDs
              imageDataUris: imageDataUris.length > 0 ? imageDataUris : undefined,
            }),
            signal: this.currentStreamAbort?.signal,
          });

          // Match Azure sample pattern: explicit response.ok check with status logging
          console.log(`[ChatService] Response status: ${res.status} ${res.statusText}`);
          
          if (!res.ok) {
            console.error(`[ChatService] Response not OK: ${res.status} ${res.statusText}`);
            const errorMessage = await parseErrorFromResponse(res);
            const errorCode = getErrorCodeFromResponse(res);
            throw createAppError(new Error(errorMessage), errorCode);
          }

          return res;
        },
        3,
        1000
      );

      // Process SSE stream
      await this.processStream(response, assistantMessageId, currentThreadId);
      this.currentStreamAbort = undefined;
      this.streamCancelled = false;

    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        // Suppress treating an intentional abort as an error. The reducer already transitioned
        // state to idle via CHAT_CANCEL_STREAM.
        return;
      }
      // Check if token expired
      if (isTokenExpiredError(error)) {
        this.dispatch({ type: 'AUTH_TOKEN_EXPIRED' });
      }

      // Check if error is already a properly formatted AppError
      const isAppError = error && typeof error === 'object' && 'code' in error && 'message' in error && 'recoverable' in error;
      
      const appError: AppError = isAppError
        ? (error as AppError)
        : createAppError(
            error,
            getErrorCodeFromMessage(error),
            // Retry the same message send (no thread creation callback in simplified model)
            () => this.sendMessage(messageText, currentThreadId, files)
          );
      
      this.dispatch({ type: 'CHAT_ERROR', error: appError });
      throw error;
    }
  }

  /**
   * Process Server-Sent Events stream from the API.
   * Handles SSE line parsing, chunk accumulation, and state dispatching.
   * 
   * @param response - Fetch Response object with SSE stream
   * @param messageId - ID of the assistant message being streamed
   * @param currentThreadId - Current thread ID (null for new threads)
   * @throws {Error} If stream is not readable or parsing fails
   * 
   * @remarks
   * Uses regex line splitting from official Azure sample for robust parsing.
   * Implements duplicate chunk suppression to prevent UI flicker.
   */
  private async processStream(
    response: Response,
    messageId: string,
    currentThreadId: string | null
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

    let newThreadId = currentThreadId;
    let lastChunk: string | undefined; // guard against accidental duplicate consecutive chunks
    let buffer = ''; // Accumulate partial SSE data

    try {
      while (true) {
        // If user cancelled, exit early without reading further buffered data.
        if (this.streamCancelled) {
          break;
        }
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Robust line splitting with regex (from official Azure sample)
        const lines = buffer.split(/\r?\n/);
        
        // Keep last incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data: ')) {
            continue;
          }

          try {
            const jsonString = trimmedLine.substring(6).trim();
            if (!jsonString) continue;

            let data: any;
            try {
              data = JSON.parse(jsonString);
            } catch (parseError) {
              console.warn('[ChatService] Malformed JSON in SSE event:', jsonString, parseError);
              continue;
            }

            // Match Azure sample: check for error field in SSE data
            if (data.error) {
              console.error('[ChatService] SSE error event received:', data.error);
              const error = createAppError(
                new Error(data.error.message || data.error || 'Stream error occurred'),
                'STREAM'
              );
              this.dispatch({ type: 'CHAT_ERROR', error });
              throw error;
            }

            if (data.type === 'threadId') {
              // Update thread id for subsequent messages; no thread list maintained client-side
              if (!newThreadId) {
                newThreadId = data.threadId;
                this.dispatch({ 
                  type: 'CHAT_START_STREAM', 
                  threadId: data.threadId,
                  messageId 
                });
              }
            } else if (data.type === 'chunk') {
              // Simple duplicate suppression: skip if identical to immediately previous chunk.
              if (data.content !== lastChunk) {
                this.dispatch({ 
                  type: 'CHAT_STREAM_CHUNK', 
                  messageId, 
                  content: data.content 
                });
                lastChunk = data.content;
              }
            } else if (data.type === 'usage') {
              this.dispatch({ 
                type: 'CHAT_STREAM_COMPLETE', 
                usage: {
                  promptTokens: data.promptTokens,
                  completionTokens: data.completionTokens,
                  totalTokens: data.totalTokens,
                  duration: data.duration,
                }
              });
            } else if (data.type === 'done') {
              // Completed normally
              break;
            } else if (data.type === 'error') {
              const error = createAppError(
                new Error(`Stream error for message ${messageId}: ${data.message}`),
                'STREAM'
              );
              this.dispatch({ type: 'CHAT_ERROR', error });
              throw error;
            }
          } catch (parseError) {
            console.error('[ChatService] Failed to parse SSE line:', line, parseError);
          }
        }
      }
    } catch (error) {
      // Suppress AbortError if intentionally cancelled
      if (error instanceof DOMException && error.name === 'AbortError' && this.streamCancelled) {
        console.log('[ChatService] Stream intentionally cancelled by user');
        return;
      }
      console.error('[ChatService] Stream processing error:', error, {
        threadId: currentThreadId,
        messageId
      });
      const appError = error instanceof Error && 'code' in error
        ? error
        : createAppError(
            new Error(
              `Stream processing failed: ${error instanceof Error ? error.message : String(error)} (Thread: ${currentThreadId}, Message: ${messageId})`
            ),
            'STREAM'
          );
      this.dispatch({ type: 'CHAT_ERROR', error: appError as any });
      throw error;
    } finally {
      // Ensure reader is always released
      try {
        reader.releaseLock();
      } catch {
        // Reader may already be released
      }
    }
  }

  // Thread loading removed for simplified single-conversation UI

  /**
   * Clear chat history and reset to empty state.
   * Dispatches CHAT_CLEAR action to remove all messages and thread ID.
   * 
   * @example
   * ```typescript
   * chatService.clearChat(); // Start fresh conversation
   * ```
   */
  clearChat(): void {
    this.dispatch({ type: 'CHAT_CLEAR' });
  }

  /**
   * Clear current error state without affecting chat history.
   * Dispatches CHAT_CLEAR_ERROR action.
   * 
   * @example
   * ```typescript
   * chatService.clearError(); // Dismiss error banner
   * ```
   */
  clearError(): void {
    this.dispatch({ type: 'CHAT_CLEAR_ERROR' });
  }

  /**
   * Cancel the current streaming response if any is active.
   * Aborts the fetch request and dispatches CHAT_CANCEL_STREAM.
   * 
   * @remarks
   * Abort controller is not cleared immediately to allow processStream
   * to observe the cancellation flag and exit gracefully.
   * 
   * @example
   * ```typescript
   * chatService.cancelStream(); // Stop streaming response
   * ```
   */
  cancelStream(): void {
    if (this.currentStreamAbort) {
      this.streamCancelled = true;
      this.currentStreamAbort.abort();
      console.log('[ChatService] Stream cancellation requested');
      // Do not clear abort immediately; processStream may still be mid-loop and needs the flag.
      this.dispatch({ type: 'CHAT_CANCEL_STREAM' });
    }
  }
}
