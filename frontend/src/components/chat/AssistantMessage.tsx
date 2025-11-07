import { Suspense, memo } from 'react';
import { Spinner } from '@fluentui/react-components';
import { CopilotMessage } from '@fluentui-copilot/react-copilot-chat';
import { Markdown } from '../core/Markdown';
import { AgentIcon } from '../core/AgentIcon';
import { UsageInfo } from './UsageInfo';
import { useFormatTimestamp } from '../../hooks/useFormatTimestamp';
import type { IChatItem } from '../../types/chat';
import styles from './AssistantMessage.module.css';

interface AssistantMessageProps {
  message: IChatItem;
  agentName?: string;
  agentLogo?: string;
  isStreaming?: boolean;
}

function AssistantMessageComponent({ 
  message, 
  agentName = 'AI Assistant',
  agentLogo,
  isStreaming = false,
}: AssistantMessageProps) {
  const formatTimestamp = useFormatTimestamp();
  const timestamp = message.more?.time ? formatTimestamp(new Date(message.more.time)) : '';
  
  // Show custom loading indicator when streaming with no content
  const showLoadingDots = isStreaming && !message.content;
  
  return (
    <CopilotMessage
      id={`msg-${message.id}`}
      avatar={<AgentIcon logoUrl={agentLogo} />}
      name={agentName}
      loadingState="none"
      className={styles.copilotMessage}
      disclaimer={<span>AI-generated content may be incorrect</span>}
      footnote={
        <>
          {timestamp && <span className={styles.timestamp}>{timestamp}</span>}
          {message.more?.usage && (
            <UsageInfo 
              info={message.more.usage} 
              duration={message.duration} 
            />
          )}
        </>
      }
    >
      {showLoadingDots ? (
        <div className={styles.loadingDots}>
          <span></span>
          <span></span>
          <span></span>
        </div>
      ) : (
        <Suspense fallback={<Spinner size="small" />}>
          <Markdown content={message.content} />
        </Suspense>
      )}
    </CopilotMessage>
  );
}

export const AssistantMessage = memo(AssistantMessageComponent, (prev, next) => {
  // Re-render only if streaming state or content/usage changes
  return (
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.isStreaming === next.isStreaming &&
    prev.agentLogo === next.agentLogo &&
    prev.message.more?.usage === next.message.more?.usage
  );
});
