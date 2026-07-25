import { OfficeConverter, type SupportedFileType } from 'officeparser';

const MIME_TO_FILETYPE: Record<string, SupportedFileType> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/markdown': 'md',
};

export const SUPPORTED_MIME_TYPES = ['text/plain', ...Object.keys(MIME_TO_FILETYPE)];

/**
 * officeparser's native chunk generator (fixed-size / document-structure
 * strategies) dropped body text in testing against v7.4.0 - only headings
 * came through. Extracting plain text via its AST and chunking ourselves
 * (see tokenizer.ts) is more code but actually reliable. Revisit if a
 * patched version fixes native chunking - it would also give us page/slide
 * numbers per chunk for richer citations, which this approach doesn't.
 */
export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'text/plain') {
    return buffer.toString('utf-8');
  }

  const fileType = MIME_TO_FILETYPE[mimeType];
  if (!fileType) {
    throw new Error(`Unsupported mime type for parsing: ${mimeType}`);
  }

  const { value: text } = await OfficeConverter.convert(buffer, 'text', {
    parseConfig: { fileType },
  });
  return text;
}
