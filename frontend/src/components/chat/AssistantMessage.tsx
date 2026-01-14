import { Suspense, memo, useMemo, useCallback } from 'react';
import { Spinner, Tooltip } from '@fluentui/react-components';
import { CopilotMessage } from '@fluentui-copilot/react-copilot-chat';
import { DocumentRegular, GlobeRegular, FolderRegular, OpenRegular } from '@fluentui/react-icons';
import { Markdown } from '../core/Markdown';
import { AgentIcon } from '../core/AgentIcon';
import { UsageInfo } from './UsageInfo';
import { useFormatTimestamp } from '../../hooks/useFormatTimestamp';
import { parseContentWithCitations } from '../../utils/citationParser';
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
  
  // Parse content with citations for consistent numbering between inline and footnotes
  const parsedContent = useMemo(() => {
    if (!hasAnnotations) return null;
    return parseContentWithCitations(message.content, message.annotations);
  }, [message.content, message.annotations, hasAnnotations]);

  // Get unique annotations with consistent indices
  // If the parser found citations (inline placeholders), use those
  // Otherwise, fall back to displaying all annotations as footnotes
  const indexedCitations = useMemo(() => {
    if (parsedContent?.citations && parsedContent.citations.length > 0) {
      return parsedContent.citations;
    }
    // No inline placeholders found - display all annotations as numbered footnotes
    // Deduplicate by label+type for fallback case
    if (message.annotations && message.annotations.length > 0) {
      const seen = new Map<string, { index: number; annotation: IAnnotation; count: number }>();
      message.annotations.forEach((annotation) => {
        const key = `${annotation.type}:${annotation.label}:${annotation.url || annotation.fileId || ''}`;
        if (seen.has(key)) {
          seen.get(key)!.count++;
        } else {
          seen.set(key, { index: seen.size + 1, annotation, count: 1 });
        }
      });
      return Array.from(seen.values());
    }
    return [];
  }, [parsedContent, message.annotations]);
  
  // Handle citation click - scroll to footnote or open URL
  const handleCitationClick = useCallback((index: number, annotation?: IAnnotation) => {
    if (annotation?.type === 'uri_citation' && annotation.url) {
      window.open(annotation.url, '_blank', 'noopener,noreferrer');
    } else {
      // Scroll to citation in footnotes
      const citationElement = document.getElementById(`citation-${message.id}-${index}`);
      if (citationElement) {
        citationElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        citationElement.classList.add(styles.citationHighlight);
        setTimeout(() => {
          citationElement.classList.remove(styles.citationHighlight);
        }, 2000);
      }
    }
  }, [message.id]);
  
  // Build citation elements matching Azure AI Foundry style
  const renderCitation = (annotation: IAnnotation, index: number, count: number = 1) => {
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

    const citationNumber = index;
    const tooltipContent = annotation.quote 
      ? `${annotation.label}${count > 1 ? ` (referenced ${count} times)` : ''}\n\n"${annotation.quote.slice(0, 200)}${annotation.quote.length > 200 ? '...' : ''}"`
      : `${annotation.label}${count > 1 ? ` (referenced ${count} times)` : ''}`;

    const isClickable = annotation.type === 'uri_citation' && annotation.url;

    const handleClick = () => {
      if (isClickable) {
        window.open(annotation.url, '_blank', 'noopener,noreferrer');
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        handleClick();
      }
    };

    // Render citation button matching Azure AI Foundry style
    return (
      <Tooltip
        key={`${annotation.label}-${index}`}
        content={tooltipContent}
        relationship="description"
        withArrow
      >
        <span 
          id={`citation-${message.id}-${citationNumber}`}
          className={`${styles.citation} ${isClickable ? styles.citationClickable : ''}`}
          onClick={isClickable ? handleClick : undefined}
          onKeyDown={isClickable ? handleKeyDown : undefined}
          role={isClickable ? 'link' : undefined}
          tabIndex={isClickable ? 0 : undefined}
        >
          <span className={styles.citationNumber}>{citationNumber}</span>
          <span className={styles.citationContent}>
            {getIcon()}
            <span className={styles.citationLabel}>{annotation.label}</span>
            {count > 1 && <span className={styles.citationCount}>×{count}</span>}
            {isClickable && <OpenRegular className={styles.citationExternalIcon} />}
          </span>
        </span>
      </Tooltip>
    );
  };

  const citations = indexedCitations.map(({ index, annotation, count }) => 
    renderCitation(annotation, index, count)
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
          <Markdown 
            content={message.content} 
            annotations={message.annotations}
            onCitationClick={handleCitationClick}
          />
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
