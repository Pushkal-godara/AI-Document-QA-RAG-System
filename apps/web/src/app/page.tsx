'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { DocumentsPanel } from '../components/DocumentsPanel';
import { ConversationsPanel } from '../components/ConversationsPanel';
import { ChatPanel } from '../components/ChatPanel';

export default function HomePage() {
  const { token, user, tenant, isLoading, logout } = useAuth();
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [conversationsRefreshKey, setConversationsRefreshKey] = useState(0);
  // Bumped only on an explicit user switch (new chat / pick a past
  // conversation) so ChatPanel remounts then. NOT bumped when the backend
  // assigns a conversationId mid-stream for a brand-new chat - that would
  // remount (and lose) the in-progress streaming answer.
  const [chatKey, setChatKey] = useState(0);

  useEffect(() => {
    if (!isLoading && !token) router.push('/login');
  }, [isLoading, token, router]);

  function selectConversation(id: string | undefined) {
    setConversationId(id);
    setChatKey((k) => k + 1);
  }

  if (isLoading || !token || !user || !tenant) {
    return <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">Loading…</div>;
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="flex w-72 shrink-0 flex-col gap-6 overflow-y-auto border-r border-zinc-200 p-4 dark:border-zinc-800">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{tenant.name}</p>
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500">{user.email}</p>
            <button onClick={logout} className="text-xs text-zinc-500 hover:underline">
              Sign out
            </button>
          </div>
        </div>

        <DocumentsPanel token={token} />

        <ConversationsPanel
          token={token}
          selectedId={conversationId}
          refreshKey={conversationsRefreshKey}
          onSelect={selectConversation}
        />
      </aside>

      <main className="flex flex-1 flex-col">
        <ChatPanel
          key={chatKey}
          token={token}
          conversationId={conversationId}
          onConversationCreated={(id) => {
            setConversationId(id);
            setConversationsRefreshKey((k) => k + 1);
          }}
        />
      </main>
    </div>
  );
}
