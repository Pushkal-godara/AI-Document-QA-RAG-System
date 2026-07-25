// Shared TypeScript shapes used by both apps/api and apps/web,
// so a "Document" (for example) means the same thing on both sides.

export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface DocumentDto {
  id: string;
  tenantId: string;
  filename: string;
  status: DocumentStatus;
  createdAt: string;
}

export interface ChunkCitationDto {
  chunkId: string;
  documentId: string;
  documentFilename: string;
  page?: number;
  snippet: string;
}

export type MessageRating = 'up' | 'down';

export interface ChatMessageDto {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: ChunkCitationDto[];
  rating?: MessageRating | null;
  createdAt: string;
}
