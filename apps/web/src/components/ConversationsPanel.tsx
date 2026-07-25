'use client';

import { useEffect, useState } from 'react';
import { listConversations, type ConversationDto } from '../lib/api-client';

interface ConversationsPanelProps {
  token: string;
  selectedId?: string;
  refreshKey: number;
  onSelect: (id: string | undefined) => void;
}

export function ConversationsPanel({ token, selectedId, refreshKey, onSelect }: ConversationsPanelProps) {
  const [conversations, setConversations] = useState<ConversationDto[]>([]);

  useEffect(() => {
    listConversations(token).then(setConversations).catch(() => {});
  }, [token, refreshKey]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Conversations</h2>
        <button
          onClick={() => onSelect(undefined)}
          className="text-xs font-medium text-zinc-900 hover:underline dark:text-zinc-100"
        >
          + New chat
        </button>
      </div>
      <ul className="space-y-1">
        {conversations.length === 0 && <li className="text-xs text-zinc-500">No conversations yet.</li>}
        {conversations.map((c) => (
          <li key={c.id}>
            <button
              onClick={() => onSelect(c.id)}
              className={`w-full truncate rounded-lg px-2 py-1.5 text-left text-xs ${
                c.id === selectedId
                  ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
              title={c.title ?? undefined}
            >
              {c.title || 'Untitled conversation'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
