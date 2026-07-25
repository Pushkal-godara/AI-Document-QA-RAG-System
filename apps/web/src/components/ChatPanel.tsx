'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { ChunkCitationDto } from '@rag/shared';
import { API_URL } from '../lib/config';
import { getConversationMessages } from '../lib/api-client';

interface ChatPanelProps {
  token: string;
  conversationId?: string;
  onConversationCreated: (id: string) => void;
}

function rowsToUIMessages(rows: Array<{ id: string; role: string; content: string }>): UIMessage[] {
  return rows.map((r) => ({
    id: r.id,
    role: r.role as 'user' | 'assistant',
    parts: [{ type: 'text', text: r.content }],
  }));
}

/** Keyed by conversationId (or 'new') from the parent so switching chats remounts fresh. */
export function ChatPanel({ token, conversationId, onConversationCreated }: ChatPanelProps) {
  const conversationIdRef = useRef<string | undefined>(conversationId);
  const [citations, setCitations] = useState<Record<string, ChunkCitationDto[]>>({});
  const [input, setInput] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(Boolean(conversationId));

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${API_URL}/query`,
        headers: () => ({ Authorization: `Bearer ${token}` }),
        body: () => ({ conversationId: conversationIdRef.current }),
        // The backend assigns/creates the conversation id and returns it as a
        // response header (see apps/api query.service.ts) - capture it here
        // since the SSE body itself never carries it.
        fetch: async (input, init) => {
          const res = await fetch(input, init);
          const newId = res.headers.get('X-Conversation-Id');
          if (newId && newId !== conversationIdRef.current) {
            conversationIdRef.current = newId;
            onConversationCreated(newId);
          }
          return res;
        },
      }),
    [token, onConversationCreated],
  );

  const { messages, sendMessage, setMessages, status } = useChat({
    id: conversationId ?? 'new',
    transport,
    onFinish: async () => {
      if (conversationIdRef.current) await syncFromServer(conversationIdRef.current);
    },
  });

  async function syncFromServer(id: string) {
    // Citations are only known once a message is persisted server-side, not
    // mid-stream - re-fetch the full transcript so the UI matches exactly
    // what's stored (including citations) rather than trying to merge two
    // representations of the same conversation.
    const rows = await getConversationMessages(token, id);
    setMessages(rowsToUIMessages(rows));
    const map: Record<string, ChunkCitationDto[]> = {};
    for (const r of rows) if (r.citations?.length) map[r.id] = r.citations;
    setCitations(map);
  }

  useEffect(() => {
    if (conversationId) {
      syncFromServer(conversationId).finally(() => setLoadingHistory(false));
    }
    // Runs once per mount - the parent remounts this component (via key) on conversation change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    sendMessage({ text });
    setInput('');
  }

  const isStreaming = status === 'streaming' || status === 'submitted';

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {loadingHistory && <p className="text-sm text-zinc-500">Loading conversation…</p>}
        {!loadingHistory && messages.length === 0 && (
          <p className="text-sm text-zinc-500">Ask a question about your tenant&apos;s documents.</p>
        )}
        {messages.map((message) => {
          const text = message.parts
            .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
            .map((p) => p.text)
            .join('');
          const isUser = message.role === 'user';
          const messageCitations = citations[message.id];
          return (
            <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                  isUser
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black'
                    : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                }`}
              >
                {text}
                {messageCitations && messageCitations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1 border-t border-black/10 pt-2 dark:border-white/10">
                    {messageCitations.map((c, i) => (
                      <span
                        key={c.chunkId}
                        title={c.snippet}
                        className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-zinc-600 dark:bg-white/10 dark:text-zinc-300"
                      >
                        [{i + 1}] {c.documentFilename}
                        {c.page ? ` · p.${c.page}` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {isStreaming && messages[messages.length - 1]?.role === 'user' && (
          <p className="text-sm text-zinc-500">Thinking…</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-zinc-200 p-4 dark:border-zinc-800">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          className="flex-1 rounded-full border border-zinc-300 bg-transparent px-4 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
          disabled={isStreaming}
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-black"
        >
          Send
        </button>
      </form>
    </div>
  );
}
