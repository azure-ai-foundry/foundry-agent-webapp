import type { IAnnotation } from '../types/chat';

/**
 * Represents a citation with its assigned display index and reference count.
 */
export interface IndexedCitation {
  index: number;
  annotation: IAnnotation;
  /** Number of times this citation was referenced in the content */
  count: number;
}

/**
 * Result of parsing message content for citations.
 */
export interface ParsedContent {
  /** Deduplicated citations with assigned indices and reference counts */
  citations: IndexedCitation[];
  /** Processed text with placeholders replaced by [N] markers */
  processedText: string;
}

/**
 * Regex patterns for citation placeholders from Azure AI Agent responses.
 * 
 * Assistants/Responses API uses: 【4:0†source】 or 【4:0†filename.pdf】
 * Azure OpenAI On Your Data uses: [doc1], [doc2], etc.
 */
const CITATION_PATTERNS = {
  // Matches 【...†...】 format from Assistants API
  // Examples: 【4:0†source】, 【13†myfile.pdf】, 【0:1†source】
  assistants: /【(\d+(?::\d+)?)[†]([^】]+)】/g,
  
  // Matches [docN] format from Azure OpenAI On Your Data
  onYourData: /\[doc(\d+)\]/g,
};

/**
 * Creates a unique key for an annotation to detect duplicates.
 */
function getAnnotationKey(annotation: IAnnotation): string {
  return `${annotation.type}:${annotation.label}:${annotation.url || annotation.fileId || ''}`;
}

/**
 * Parses message content and extracts citation references.
 * Replaces placeholder text with numbered markers and maps to annotations.
 * 
 * @param content - Raw message content with citation placeholders
 * @param annotations - Annotations from the message
 * @returns Parsed content with segments, citations, and processed text
 */
export function parseContentWithCitations(
  content: string,
  annotations: IAnnotation[] = []
): ParsedContent {
  if (!content || annotations.length === 0) {
    return {
      citations: [],
      processedText: content || '',
    };
  }

  // Build a map of textToReplace -> annotation for quick lookup
  const annotationByPlaceholder = new Map<string, IAnnotation>();
  annotations.forEach(annotation => {
    if (annotation.textToReplace) {
      annotationByPlaceholder.set(annotation.textToReplace, annotation);
    }
  });

  // Track unique citations and their assigned indices
  const citationMap = new Map<string, IndexedCitation>();
  let processedText = content;
  let citationIndex = 0;

  // Helper to get or create citation index for an annotation (also increments count)
  const getOrCreateCitationIndex = (annotation: IAnnotation): number => {
    const key = getAnnotationKey(annotation);
    if (citationMap.has(key)) {
      const existing = citationMap.get(key)!;
      existing.count++;
      return existing.index;
    }
    citationIndex++;
    citationMap.set(key, { index: citationIndex, annotation, count: 1 });
    return citationIndex;
  };

  // First pass: Replace all known textToReplace placeholders
  annotationByPlaceholder.forEach((annotation, placeholder) => {
    const idx = getOrCreateCitationIndex(annotation);
    processedText = processedText.replaceAll(placeholder, `[${idx}]`);
  });

  // Second pass: Handle any remaining 【...†...】 patterns not in textToReplace
  // This catches cases where the annotation doesn't have textToReplace set
  processedText = processedText.replace(CITATION_PATTERNS.assistants, (match, _id, label) => {
    // Try to find matching annotation by label or position
    const matchingAnnotation = annotations.find(a => 
      a.label === label || 
      a.textToReplace === match ||
      (a.startIndex !== undefined && content.indexOf(match) >= a.startIndex)
    );
    
    if (matchingAnnotation) {
      const idx = getOrCreateCitationIndex(matchingAnnotation);
      return `[${idx}]`;
    }
    
    // If no matching annotation, create a placeholder citation
    citationIndex++;
    const placeholderAnnotation: IAnnotation = {
      type: 'file_citation',
      label: label,
    };
    citationMap.set(`placeholder:${citationIndex}`, { 
      index: citationIndex, 
      annotation: placeholderAnnotation,
      count: 1,
    });
    return `[${citationIndex}]`;
  });

  // Convert citation map to sorted array
  const citations = Array.from(citationMap.values()).sort((a, b) => a.index - b.index);

  return {
    citations,
    processedText,
  };
}
