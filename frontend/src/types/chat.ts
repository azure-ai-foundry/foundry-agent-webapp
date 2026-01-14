export interface IChatItem {
  id: string;
  role?: 'user' | 'assistant';
  content: string;
  duration?: number; // response time in ms
  attachments?: IFileAttachment[]; // File attachments
  annotations?: IAnnotation[]; // Citations/references from AI agent
  more?: {
    time?: string; // ISO timestamp
    usage?: IUsageInfo; // Usage info from backend
  };
}

export interface IUsageInfo {
  duration?: number;           // Response time in milliseconds
  promptTokens: number;        // Input token count
  completionTokens: number;    // Output token count
  totalTokens?: number;        // Total token count
}

export interface IFileAttachment {
  fileName: string;
  fileSizeBytes: number;
  dataUri?: string; // Base64 data URI for inline image preview
}

/**
 * Represents a citation/annotation from AI agent responses.
 * Supports all Azure AI Agent SDK annotation types:
 * - uri_citation: Bing, Azure AI Search, SharePoint
 * - file_citation: File search from vector stores
 * - file_path: Code interpreter generated files
 * - container_file_citation: Container file citations
 */
export interface IAnnotation {
  /** Type: "uri_citation", "file_citation", "file_path", or "container_file_citation" */
  type: 'uri_citation' | 'file_citation' | 'file_path' | 'container_file_citation';
  /** Display label (title or filename) */
  label: string;
  /** URL for URI citations */
  url?: string;
  /** File ID for file citations */
  fileId?: string;
  /** Placeholder text in the response to replace (e.g., "【4:0†source】") */
  textToReplace?: string;
  /** Start index in the text where the citation applies */
  startIndex?: number;
  /** End index in the text where the citation applies */
  endIndex?: number;
  /** Quote from the source document (for file citations) */
  quote?: string;
}

// Agent metadata types
export interface IAgentMetadata {
  id: string;
  object: string;
  createdAt: number;
  name: string;
  description?: string | null;
  model: string;
  instructions?: string | null;
  metadata?: Record<string, string> | null;
}
