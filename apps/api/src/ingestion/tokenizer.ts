import { getEncoding } from 'js-tiktoken';

// Loaded once per process - building the encoding table isn't free.
const enc = getEncoding('cl100k_base');

export function countTokens(text: string): number {
  return enc.encode(text).length;
}

export interface TextChunk {
  text: string;
  index: number;
}

/**
 * Splits on token boundaries (not characters), so chunk size lines up with
 * what the embedding model and LLM context window actually see. Slides a
 * window of `chunkSize` tokens forward by `chunkSize - overlap` each step.
 */
export function chunkByTokens(text: string, chunkSize = 500, overlap = 50): TextChunk[] {
  const ids = enc.encode(text);
  if (ids.length === 0) return [];

  const chunks: TextChunk[] = [];
  const stride = chunkSize - overlap;
  let index = 0;

  for (let start = 0; start < ids.length; start += stride) {
    const window = ids.slice(start, start + chunkSize);
    const chunkText = enc.decode(window).trim();
    if (chunkText.length > 0) {
      chunks.push({ text: chunkText, index: index++ });
    }
    if (start + chunkSize >= ids.length) break;
  }

  return chunks;
}
