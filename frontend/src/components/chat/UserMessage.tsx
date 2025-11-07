import { Suspense, memo } from 'react';
import { Spinner, Badge } from '@fluentui/react-components';
import { Attach24Regular, ImageRegular } from '@fluentui/react-icons';
import { UserMessage as CopilotUserMessage } from '@fluentui-copilot/react-copilot-chat';
import { Markdown } from '../core/Markdown';
import { useFormatTimestamp } from '../../hooks/useFormatTimestamp';
import type { IChatItem } from '../../types/chat';
import styles from './UserMessage.module.css';

interface UserMessageProps {
  message: IChatItem;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function UserMessageComponent({ message }: UserMessageProps) {
  const formatTimestamp = useFormatTimestamp();
  const timestamp = message.more?.time ? formatTimestamp(new Date(message.more.time)) : '';

  return (
    <CopilotUserMessage
      className={styles.userMessage}
      timestamp={timestamp}
    >
      <Suspense fallback={<Spinner size="small" />}>
        <Markdown content={message.content} />
        {message.attachments && message.attachments.length > 0 && (
          <div className={styles.attachments}>
            {message.attachments.map((attachment, index) => {
              // Show thumbnail preview for images with dataUri
              if (attachment.dataUri && attachment.fileName.match(/\.(png|jpe?g|gif|webp)$/i)) {
                return (
                  <div key={index} className={styles.thumbnailItem}>
                    {attachment.dataUri ? (
                      <img 
                        src={attachment.dataUri} 
                        alt={attachment.fileName}
                        className={styles.thumbnail}
                      />
                    ) : (
                      <div className={styles.placeholderIcon}>
                        <ImageRegular fontSize={32} />
                      </div>
                    )}
                    <Badge 
                      appearance="filled" 
                      size="small"
                      className={styles.sizeBadge}
                    >
                      {formatFileSize(attachment.fileSizeBytes)}
                    </Badge>
                  </div>
                );
              }
              
              // Fall back to list view for non-images or attachments without dataUri
              return (
                <div key={index} className={styles.attachmentItem}>
                  <Attach24Regular className={styles.attachmentIcon} />
                  <div className={styles.attachmentInfo}>
                    <span className={styles.attachmentName}>{attachment.fileName}</span>
                    <span className={styles.attachmentSize}>
                      {formatFileSize(attachment.fileSizeBytes)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Suspense>
    </CopilotUserMessage>
  );
}

export const UserMessage = memo(UserMessageComponent, (prev, next) => {
  // Re-render only if message content or attachments change
  return (
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.attachments?.length === next.message.attachments?.length
  );
});