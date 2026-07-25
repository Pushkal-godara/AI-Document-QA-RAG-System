'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DocumentDto } from '@rag/shared';
import { listDocuments, uploadDocument } from '../lib/api-client';

const STATUS_STYLES: Record<DocumentDto['status'], string> = {
  pending: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
  processing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  ready: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export function DocumentsPanel({ token }: { token: string }) {
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setDocuments(await listDocuments(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll while anything is still being ingested, so status flips to ready/failed live.
  useEffect(() => {
    const hasInFlight = documents.some((d) => d.status === 'pending' || d.status === 'processing');
    if (!hasInFlight) return;
    const timer = setInterval(refresh, 2000);
    return () => clearInterval(timer);
  }, [documents, refresh]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadDocument(token, file);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Documents</h2>
        <label className="cursor-pointer text-xs font-medium text-zinc-900 hover:underline dark:text-zinc-100">
          {uploading ? 'Uploading…' : '+ Upload'}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.pptx,.txt,.md"
            className="hidden"
            disabled={uploading}
            onChange={handleFileChange}
          />
        </label>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <ul className="space-y-1">
        {documents.length === 0 && <li className="text-xs text-zinc-500">No documents yet.</li>}
        {documents.map((doc) => (
          <li key={doc.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-zinc-700 dark:text-zinc-300" title={doc.filename}>
              {doc.filename}
            </span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 font-medium ${STATUS_STYLES[doc.status]}`}>
              {doc.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
