import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { AssistantMessage } from "./chat/AssistantMessage";
import { UserMessage } from "./chat/UserMessage";
import { StarterMessages } from "./chat/StarterMessages";
import { ChatInput } from "./chat/ChatInput";
import { Waves } from "./animations/Waves";
import { ErrorMessage } from "./core/ErrorMessage";
import type { IChatItem } from "../types/chat";
import type { AppState } from "../types/appState";
import type { AppError } from "../types/errors";
import type { ChatInterfaceRef } from "../App";
import styles from './ChatInterface.module.css';

interface ChatInterfaceProps {
  messages: IChatItem[];
  status: AppState['chat']['status'];
  error: AppError | null;
  streamingMessageId?: string;
  onSendMessage: (text: string, files?: File[]) => void;
  onClearError?: () => void;
  onOpenSettings?: () => void;
  onNewChat?: () => void;
  onCancelStream?: () => void;
  hasMessages?: boolean;
  disabled: boolean;
  agentName?: string;
  agentDescription?: string;
  agentLogo?: string;
}

export const ChatInterface = forwardRef<ChatInterfaceRef, ChatInterfaceProps>((props, ref) => {
  const { messages, status, error, streamingMessageId, onSendMessage, onClearError, onOpenSettings, onNewChat, onCancelStream, hasMessages, disabled, agentName, agentDescription, agentLogo } = props;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [liveRegionMessage, setLiveRegionMessage] = useState<string>('');
  
  const isStreaming = status === 'streaming';
  const isBusy = disabled || ['sending', 'streaming'].includes(status);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  useEffect(() => {
    // Scroll immediately on every message change for real-time streaming feel
    scrollToBottom();
  }, [messages]);

  // Announce streaming status changes to screen readers
  useEffect(() => {
    if (isStreaming) {
      setLiveRegionMessage('Assistant is responding');
    } else if (status === 'idle' && messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      setLiveRegionMessage('Response complete');
      // Clear the message after announcement
      const timer = setTimeout(() => setLiveRegionMessage(''), 1000);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, status, messages]);

  // Expose ref methods (no-op, controlled by parent now)
  useImperativeHandle(ref, () => ({
    clearChat: () => {}, // Parent controls via AppContext
    loadConversation: async () => {}, // Parent controls via AppContext
  }));

  const handleSendMessage = (messageText: string, files?: File[]) => {
    if (!messageText.trim() || disabled) return;
    onSendMessage(messageText, files);
  };

  const handleStarterPromptClick = (prompt: string) => {
    handleSendMessage(prompt);
  };

  return (
    <div className={styles.chatContainer}>
      {/* Live region for announcing streaming status to screen readers */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
      >
        {liveRegionMessage}
      </div>

      <div 
        className={styles.messagesContainer} 
        role="log" 
        aria-live="polite" 
        aria-label="Chat messages"
        aria-busy={isStreaming}
      >
        <div className={styles.messagesWrapper}>
          {messages.length === 0 ? (
            <StarterMessages 
              agentName={agentName}
              agentDescription={agentDescription}
              agentLogo={agentLogo}
              onPromptClick={handleStarterPromptClick}
            />
          ) : (
            <>
              <div aria-live="polite" aria-atomic="false" className="sr-only">
                {messages.length > 0 && messages[messages.length - 1].role === 'assistant' && 
                  `Assistant: ${messages[messages.length - 1].content.substring(0, 100)}`
                }
              </div>
              {messages.map((message) =>
                message.role === "user" ? (
                  <UserMessage key={message.id} message={message} />
                ) : (
                  <AssistantMessage 
                    key={message.id} 
                    message={message} 
                    isStreaming={isStreaming && message.id === streamingMessageId}
                    agentName={agentName}
                    agentLogo={agentLogo}
                  />
                )
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      <div className={styles.chatInputArea}>
        {error && (
          <div className={styles.errorWrapper}>
            <ErrorMessage
              message={typeof error.message === 'string' ? error.message : 
                      typeof error === 'string' ? error :
                      error.originalError?.message || 
                      'An unexpected error occurred. Please try again.'}
              recoverable={error.recoverable}
              onRetry={error.action?.handler}
              onDismiss={onClearError}
              customAction={error.action && error.action.label !== 'Retry' ? {
                label: error.action.label,
                handler: error.action.handler
              } : undefined}
            />
          </div>
        )}

        <Waves />
        <ChatInput
          onSubmit={handleSendMessage}
          disabled={isBusy}
          onOpenSettings={onOpenSettings}
          onNewChat={onNewChat}
          hasMessages={hasMessages}
          placeholder="Type your message here..."
          isStreaming={isStreaming}
          onCancelStream={isStreaming && onCancelStream ? onCancelStream : undefined}
        />
      </div>
    </div>
  );
});
