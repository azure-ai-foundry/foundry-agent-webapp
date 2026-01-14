import { Suspense, memo } from 'react';
import { Spinner, Tooltip } from '@fluentui/react-components';
import { CopilotMessage } from '@fluentui-copilot/react-copilot-chat';
import { DocumentRegular, GlobeRegular, FolderRegular } from '@fluentui/react-icons';
import { Markdown } from '../core/Markdown';
import { AgentIcon } from '../core/AgentIcon';
import { UsageInfo } from './UsageInfo';
import { useFormatTimestamp } from '../../hooks/useFormatTimestamp';
import type { IChatItem, IAnnotation } from '../../types/chat';
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
  const hasAnnotations = message.annotations && message.annotations.length > 0;
  
  // Build citation elements matching Azure AI Foundry style
  const renderCitation = (annotation: IAnnotation, index: number) => {
    const getIcon = () => {
      switch (annotation.type) {
        case 'uri_citation':
          return <GlobeRegular className={styles.citationIcon} />;
        case 'file_path':
          return <FolderRegular className={styles.citationIcon} />;
        default:
          return <DocumentRegular className={styles.citationIcon} />;
      }
    };

    const citationNumber = index + 1;
    const tooltipContent = annotation.quote 
      ? `${annotation.label}\n\n"${annotation.quote.slice(0, 200)}${annotation.quote.length > 200 ? '...' : ''}"`
      : annotation.label;

    // Render citation button matching Azure AI Foundry style
    return (
      <Tooltip
        key={`${annotation.label}-${index}`}
        content={tooltipContent}
        relationship="description"
        withArrow
      >
        <span className={styles.citation}>
          <span className={styles.citationNumber}>{citationNumber}</span>
          <span className={styles.citationContent}>
            {getIcon()}
            <span className={styles.citationLabel}>{annotation.label}</span>
          </span>
        </span>
      </Tooltip>
    );
  };

  const uniqueAnnotations = hasAnnotations
    ? message.annotations!.reduce<IAnnotation[]>((acc, annotation) => {
        const key = `${annotation.label}-${annotation.url || annotation.fileId || ''}-${annotation.startIndex ?? ''}`;
        if (!acc.some(a => `${a.label}-${a.url || a.fileId || ''}-${a.startIndex ?? ''}` === key)) {
          acc.push(annotation);
        }
        return acc;
      }, [])
    : [];

  const citations = uniqueAnnotations.map((annotation, index) => 
    renderCitation(annotation, index)
  );
  
  return (
    <CopilotMessage
      id={`msg-${message.id}`}
      avatar={<AgentIcon logoUrl={agentLogo} />}
      name={agentName}
      loadingState="none"
      className={styles.copilotMessage}
      disclaimer={<span>AI-generated content may be incorrect</span>}
      footnote={
        <div className={styles.footnoteContainer}>
          {hasAnnotations && !isStreaming && (
            <div className={styles.citationList}>
              {citations}
            </div>
          )}
          <div className={styles.metadataRow}>
            {timestamp && <span className={styles.timestamp}>{timestamp}</span>}
            {message.more?.usage && (
              <UsageInfo 
                info={message.more.usage} 
                duration={message.duration} 
              />
            )}
          </div>
        </div>
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
  // Re-render only if streaming state or content/usage/annotations changes
  return (
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.isStreaming === next.isStreaming &&
    prev.agentLogo === next.agentLogo &&
    prev.message.more?.usage === next.message.more?.usage &&
    prev.message.annotations?.length === next.message.annotations?.length
  );
});
