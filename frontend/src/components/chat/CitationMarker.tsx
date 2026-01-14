import { memo } from 'react';
import { Tooltip } from '@fluentui/react-components';
import type { IAnnotation } from '../../types/chat';
import styles from './CitationMarker.module.css';

interface CitationMarkerProps {
  /** 1-based citation index */
  index: number;
  /** The annotation data */
  annotation?: IAnnotation;
  /** Callback when marker is clicked */
  onClick: (index: number, annotation?: IAnnotation) => void;
}

/**
 * Inline citation marker rendered as a superscript badge.
 * Clicking invokes the onClick handler to scroll/navigate to the citation.
 */
function CitationMarkerComponent({ 
  index, 
  annotation,
  onClick 
}: CitationMarkerProps) {
  const tooltipContent = annotation?.label || `Citation ${index}`;
  
  const handleClick = () => {
    onClick(index, annotation);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <Tooltip content={tooltipContent} relationship="label" withArrow>
      <sup
        className={styles.citationMarker}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`Citation ${index}: ${tooltipContent}`}
      >
        {index}
      </sup>
    </Tooltip>
  );
}

export const CitationMarker = memo(CitationMarkerComponent);
