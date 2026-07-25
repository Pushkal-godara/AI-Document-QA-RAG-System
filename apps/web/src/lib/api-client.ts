import type { DocumentDto, ChatMessageDto, MessageRating } from '@rag/shared';
import { API_URL } from './config';

async function authedFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  return res;
}

export async function listDocuments(token: string): Promise<DocumentDto[]> {
  const res = await authedFetch('/documents', token);
  return res.json();
}

export async function uploadDocument(token: string, file: File): Promise<DocumentDto> {
  const form = new FormData();
  form.append('file', file);
  const res = await authedFetch('/documents', token, { method: 'POST', body: form });
  return res.json();
}

export interface ConversationDto {
  id: string;
  title: string | null;
  createdAt: string;
}

export async function listConversations(token: string): Promise<ConversationDto[]> {
  const res = await authedFetch('/conversations', token);
  return res.json();
}

export async function getConversationMessages(token: string, conversationId: string): Promise<ChatMessageDto[]> {
  const res = await authedFetch(`/conversations/${conversationId}/messages`, token);
  return res.json();
}

export async function rateMessage(
  token: string,
  conversationId: string,
  messageId: string,
  rating: MessageRating,
): Promise<void> {
  await authedFetch(`/conversations/${conversationId}/messages/${messageId}/feedback`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating }),
  });
}
