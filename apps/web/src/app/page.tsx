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

  useEffect(() => {
    if (!isLoading && !token) router.push('/login');
  }, [isLoading, token, router]);

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
          onSelect={setConversationId}
        />
      </aside>

      <main className="flex flex-1 flex-col">
        <ChatPanel
          key={conversationId ?? 'new'}
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
