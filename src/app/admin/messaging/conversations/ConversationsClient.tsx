'use client';

import * as React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { MessageLog, WorkspaceEntity } from '@/lib/types';
import { useWorkspace } from '@/context/WorkspaceContext';
import ThreadList from './components/ThreadList';
import MessageThread from './components/MessageThread';
import EntityContextPanel from './components/EntityContextPanel';
import { MessageSquare, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import DOMPurify from 'isomorphic-dompurify';
import { PageContainerFluid } from '@/components/ui/page-container';

const READ_STATE_KEY = 'smartsapp:conversations:v1';
type ReadState = Record<string, string>; // { [entityId]: lastViewedAt ISO }

export interface ThreadGroup {
  entityId: string;
  entityName: string;
  messages: MessageLog[];
  lastMessage: MessageLog;
  lastMessageTimestamp: string;
  totalMessages: number;
  unreadCount: number;
}

export default function ConversationsClient() {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const [selectedEntityId, setSelectedEntityId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [readState, setReadState] = React.useState<ReadState>({});
  
  // Load initial read state
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(READ_STATE_KEY);
      if (stored) setReadState(JSON.parse(stored));
    } catch (e) {
      console.error('Error loading read state', e);
    }
  }, []);

  // Sync read state to localStorage
  const updateReadState = React.useCallback((entityId: string) => {
    setReadState(prev => {
      const next = { ...prev, [entityId]: new Date().toISOString() };
      localStorage.setItem(READ_STATE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // When selection changes, mark as read
  React.useEffect(() => {
    if (selectedEntityId) {
      updateReadState(selectedEntityId);
    }
  }, [selectedEntityId, updateReadState]);

  // Query last 1000 messages for the workspace
  const logsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'message_logs'),
      where('workspaceIds', 'array-contains', activeWorkspaceId),
      orderBy('sentAt', 'desc'),
      limit(1000) // Client-side aggregation limit
    );
  }, [firestore, activeWorkspaceId]);

  const { data: logs, isLoading } = useCollection<MessageLog>(logsQuery);

  // Group logs into threads
  const threads = React.useMemo(() => {
    if (!logs) return [];
    
    const grouped = new Map<string, MessageLog[]>();
    logs.forEach(log => {
      const key = log.entityId || log.recipient; // Fallback to recipient if no entity
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(log);
    });

    return Array.from(grouped.entries())
      .map(([key, messages]): ThreadGroup => {
        const sorted = messages.sort(
          (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
        );
        const lastViewedAt = readState[key];
        const unreadCount = lastViewedAt
          ? sorted.filter(m => new Date(m.sentAt) > new Date(lastViewedAt)).length
          : sorted.length;
          
        return {
          entityId: key,
          entityName: sorted[0].displayName || sorted[0].entityName || sorted[0].recipient,
          messages: sorted,
          lastMessage: sorted[0],
          lastMessageTimestamp: sorted[0].sentAt,
          totalMessages: sorted.length,
          unreadCount,
        };
      })
      .filter(thread => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          thread.entityName.toLowerCase().includes(q) ||
          thread.messages.some(m => m.subject?.toLowerCase().includes(q) || m.body.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime());
  }, [logs, readState, searchQuery]);

  const selectedThread = React.useMemo(() => 
    threads.find(t => t.entityId === selectedEntityId) || null
  , [threads, selectedEntityId]);

  if (isLoading) {
    return (
      <PageContainerFluid className="h-[calc(100vh-64px)] flex flex-col">
        <div className="flex flex-1 items-center justify-center rounded-[2rem] border bg-card shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
        </div>
      </PageContainerFluid>
    );
  }

  return (
    <PageContainerFluid className="h-[calc(100vh-64px)] flex flex-col">
      <div className="flex flex-1 overflow-hidden rounded-[2rem] border bg-card shadow-xl ring-1 ring-black/5">
      {/* Panel 1: Thread List */}
      <ThreadList 
        threads={threads}
        selectedEntityId={selectedEntityId}
        onSelect={setSelectedEntityId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Panel 2 & 3 wrapper */}
      <div className="flex flex-1 overflow-hidden relative">
        {selectedThread ? (
          <>
            {/* Panel 2: Message Thread */}
            <MessageThread thread={selectedThread} />
            
            {/* Panel 3: Entity Context Sidebar (only if we have an entity ID, not just a raw email/phone) */}
            {selectedThread.messages[0].entityId && (
              <EntityContextPanel entityId={selectedThread.entityId} />
            )}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center bg-muted/10">
            <div className="h-20 w-20 rounded-full bg-primary/5 border-4 border-primary/10 flex items-center justify-center mb-6 shadow-inner">
              <MessageSquare className="h-8 w-8 text-primary/40" />
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-foreground">No conversation selected</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              Choose a contact from the list on the left to view your communication history and timeline.
            </p>
          </div>
        )}
      </div>
      </div>
    </PageContainerFluid>
  );
}
