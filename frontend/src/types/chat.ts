export interface IChatItem {
  id: string;
  role?: 'user' | 'assistant';
  content: string;
  duration?: number; // response time in ms
  attachments?: IFileAttachment[]; // File attachments
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
