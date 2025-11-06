import { useState, useRef, useEffect } from 'react';
import {
  ChatInput as ChatInputFluent,
  ImperativeControlPlugin,
  type ImperativeControlPluginRef,
} from '@fluentui-copilot/react-copilot';
import { Button } from '@fluentui/react-components';
import { Attach24Regular, Dismiss24Regular, Settings24Regular, ChatAdd24Regular, Stop24Regular } from '@fluentui/react-icons';
import styles from './ChatInput.module.css';

interface ChatInputProps {
  onSubmit: (value: string, files?: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
  onOpenSettings?: () => void;
  onNewChat?: () => void;
  hasMessages?: boolean;
  isStreaming?: boolean;
  onCancelStream?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSubmit,
  disabled = false,
  placeholder = "Type your message...",
  onOpenSettings,
  onNewChat,
  hasMessages = false,
  isStreaming = false,
  onCancelStream,
}) => {
  const [inputText, setInputText] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const controlRef = useRef<ImperativeControlPluginRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);

  // Auto-focus on mount for immediate typing
  useEffect(() => {
    const focusInput = () => {
      // Find the contenteditable div inside ChatInputFluent
      const editableDiv = inputContainerRef.current?.querySelector('[contenteditable="true"]') as HTMLElement;
      if (editableDiv && !disabled) {
        editableDiv.focus();
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(focusInput, 100);
    return () => clearTimeout(timer);
  }, []); // Only on mount

  // Restore focus after message is sent (when status changes from disabled back to enabled)
  useEffect(() => {
    if (!disabled && !isStreaming) {
      const focusInput = () => {
        const editableDiv = inputContainerRef.current?.querySelector('[contenteditable="true"]') as HTMLElement;
        if (editableDiv) {
          editableDiv.focus();
        }
      };
      
      // Small delay to allow state to settle
      const timer = setTimeout(focusInput, 50);
      return () => clearTimeout(timer);
    }
  }, [disabled, isStreaming]);

  const handleSubmit = () => {
    if (inputText && inputText.trim() !== "") {
      onSubmit(inputText.trim(), selectedFiles.length > 0 ? selectedFiles : undefined);
      setInputText("");
      setSelectedFiles([]);
      controlRef.current?.setInputText("");
    }
  };

  const handleCancelStream = () => {
    onCancelStream?.();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    // Validate that all files are images
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length !== files.length) {
      console.warn('Only image files are allowed');
    }
    if (imageFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...imageFiles]);
    }
    // Reset input value so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handlePaste = async (event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        // Only accept image files
        if (file && file.type.startsWith('image/')) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      event.preventDefault();
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Escape to cancel streaming
    if (event.key === 'Escape' && isStreaming) {
      event.preventDefault();
      handleCancelStream();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className={styles.chatInputContainer} onPaste={handlePaste} onKeyDown={handleKeyDown} ref={inputContainerRef}>
      {selectedFiles.length > 0 && (
        <div className={styles.attachmentsPreview}>
          {selectedFiles.map((file, index) => (
            <div key={index} className={styles.attachmentItem}>
              <span className={styles.attachmentName}>{file.name}</span>
              <span className={styles.attachmentSize}>({formatFileSize(file.size)})</span>
              <Button
                appearance="subtle"
                size="small"
                icon={<Dismiss24Regular />}
                onClick={() => handleRemoveFile(index)}
                disabled={disabled}
                aria-label={`Remove ${file.name}`}
              />
            </div>
          ))}
        </div>
      )}
      <div className={styles.inputWrapper}>
        <ChatInputFluent
          aria-label="Chat Input"
          charactersRemainingMessage={() => ``}
          disabled={disabled || isStreaming}
          history={true}
          onChange={(_, data) => setInputText(data.value)}
          onSubmit={handleSubmit}
          placeholderValue={placeholder}
        >
          <ImperativeControlPlugin ref={controlRef} />
        </ChatInputFluent>
        <div className={styles.buttonRow}>
          <div className={styles.actionButtons}>
            {onOpenSettings && (
              <Button
                appearance="subtle"
                icon={<Settings24Regular />}
                onClick={onOpenSettings}
                disabled={disabled}
                aria-label="Settings"
              />
            )}
            {onNewChat && (
              <Button
                appearance="subtle"
                icon={<ChatAdd24Regular />}
                onClick={onNewChat}
                disabled={disabled || !hasMessages}
                aria-label="New chat"
              />
            )}
            <Button
              appearance="subtle"
              icon={<Attach24Regular />}
              onClick={handleAttachClick}
              disabled={disabled}
              aria-label="Attach files"
            />
            <Button
              appearance="subtle"
              icon={<Stop24Regular />}
              onClick={handleCancelStream}
              disabled={!isStreaming}
              aria-label="Cancel response"
              className={styles.cancelButton}
            />
          </div>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileSelect}
        accept="image/*"
      />
    </div>
  );
};
