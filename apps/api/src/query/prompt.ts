import type { ModelMessage } from 'ai';
import type { RetrievedChunk } from './retrieval';

const SYSTEM_PROMPT = `You are a helpful assistant answering questions using only the provided context.
- Answer using ONLY the information in the numbered context blocks below.
- Cite every claim with the matching bracketed number, e.g. [1] or [2][3].
- If the context does not contain the answer, say you don't know - do not guess or use outside knowledge.`;

export function buildContextBlock(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => {
      const location = c.page ? `, page ${c.page}` : '';
      return `[${i + 1}] (source: ${c.documentFilename}${location})\n${c.content}`;
    })
    .join('\n\n');
}

export function buildPromptMessages(
  question: string,
  chunks: RetrievedChunk[],
  history: ModelMessage[],
): ModelMessage[] {
  const context = chunks.length > 0 ? buildContextBlock(chunks) : '(no relevant documents found for this tenant)';
  return [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\nContext:\n${context}` },
    ...history,
    { role: 'user', content: question },
  ];
}
