'use client';

/**
 * SmartSapp Messaging Hub — Conversations & Inbox Client
 *
 * Implements a responsive 3-pane unified communications center with:
 * - Multi-tier identity resolution (contact name, institution, email, phone)
 * - Fixed-width, clamped contact items with zero horizontal scrolling
 * - Collapsible / expandable left contacts panel and right properties panel
 * - Stale-while-revalidate lazy loading of message logs up to scale ceiling (5,000)
 * - Mobile responsive navigation with tactile back-to-inbox switcher
 *
 * In accordance with Rules 1-57 of docs/agents_mcp/agents_mcp_rules.md.
 * In accordance with theme.md Sections 4 & 8.
 */

import * as React from 'react';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { MessageLog } from '@/lib/types';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTenant } from '@/context/TenantContext';
import type { WorkspaceMessagingSettings } from '@/lib/types/messaging-settings';
import { DEFAULT_MESSAGING_SETTINGS } from '@/lib/types/messaging-settings';
import ThreadList from './components/ThreadList';
import MessageThread from './components/MessageThread';
import EntityContextPanel from './components/EntityContextPanel';
import { MessageSquare, Loader2 } from 'lucide-react';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useMediaQuery } from '@/hooks/use-media-query';
import { extractThreadIdentity } from './utils/thread-identity';
import { isThreadForUser, type UserContextIdentity } from './utils/user-thread-filter';
import { cn } from '@/lib/utils';

export interface ThreadGroup {
  entityId: string;
  realEntityId: string | null;
  entityName: string;
  contactName: string;
  institutionName: string;
  email: string | null;
  phone: string | null;
  messages: MessageLog[];
  lastMessage: MessageLog;
  lastMessageTimestamp: string;
  totalMessages: number;
  unreadCount: number;
}

type ReadState = Record<string, string>; // { [entityId]: lastViewedAt ISO }

const MAX_BATCH_LIMIT = 5000;

export default function ConversationsClient() {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useUser();
  const { isSuperAdmin, isWorkspaceAdmin, currentUserProfile } = useTenant();
  const [selectedEntityId, setSelectedEntityId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [readState, setReadState] = React.useState<ReadState>({});

  // Workspace messaging settings doc query
  const settingsDocRef = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return doc(firestore, 'workspaces', activeWorkspaceId, 'messaging_settings', 'current');
  }, [firestore, activeWorkspaceId]);

  const { data: messagingSettingsDoc } = useDoc<WorkspaceMessagingSettings>(settingsDocRef);
  const messagingSettings = messagingSettingsDoc || DEFAULT_MESSAGING_SETTINGS;

  // Administrative override: super admins and workspace admins always have visibility permissions
  const isAdmin = Boolean(isSuperAdmin || isWorkspaceAdmin);
  const canViewAllMessages = Boolean(
    isAdmin || messagingSettings.allowViewingAllMessages !== false
  );

  const [scopeFilter, setScopeFilter] = React.useState<'all' | 'mine'>('all');

  // Auto-switch to 'mine' if permission is restricted for non-admins
  React.useEffect(() => {
    if (!canViewAllMessages && scopeFilter !== 'mine') {
      setScopeFilter('mine');
    }
  }, [canViewAllMessages, scopeFilter]);

  // Construct identity context for thread matching
  const userContext: UserContextIdentity = React.useMemo(() => {
    return {
      uid: user?.uid,
      email: user?.email || currentUserProfile?.email,
      displayName: user?.displayName || currentUserProfile?.displayName || currentUserProfile?.name,
    };
  }, [user?.uid, user?.email, user?.displayName, currentUserProfile?.email, currentUserProfile?.displayName, currentUserProfile?.name]);

  // Collapsible panels state (default false, post-mount synced with localStorage)
  const [isThreadListCollapsed, setIsThreadListCollapsed] = React.useState(false);
  const [isPropertiesCollapsed, setIsPropertiesCollapsed] = React.useState(false);

  // Mobile details slide-over sheet state (for screens < 1024px)
  const [isMobileDetailsOpen, setIsMobileDetailsOpen] = React.useState(false);
  const isLargeScreen = useMediaQuery('(min-width: 1024px)');

  // Progressive batching limit (starts at 1,000, increments up to 5,000)
  const [batchLimit, setBatchLimit] = React.useState(1000);

  const storageKey = `smartsapp:conversations:v1:${activeWorkspaceId || 'global'}`;
  const listCollapsedKey = `smartsapp:conversations:threadListCollapsed:${activeWorkspaceId || 'global'}`;
  const propsCollapsedKey = `smartsapp:conversations:propertiesCollapsed:${activeWorkspaceId || 'global'}`;

  // Client-side hydration-safe loading of stored state
  React.useEffect(() => {
    try {
      const storedRead = localStorage.getItem(storageKey);
      if (storedRead) setReadState(JSON.parse(storedRead));

      const storedList = localStorage.getItem(listCollapsedKey);
      if (storedList !== null) setIsThreadListCollapsed(storedList === 'true');

      const storedProps = localStorage.getItem(propsCollapsedKey);
      if (storedProps !== null) setIsPropertiesCollapsed(storedProps === 'true');
    } catch (e) {
      console.error('Error loading conversations stored state', e);
    }
  }, [storageKey, listCollapsedKey, propsCollapsedKey]);

  // Sync read state
  const updateReadState = React.useCallback(
    (entityId: string) => {
      setReadState((prev) => {
        const next = { ...prev, [entityId]: new Date().toISOString() };
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [storageKey]
  );

  // Sync panel collapsed states
  const toggleThreadList = React.useCallback(() => {
    setIsThreadListCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(listCollapsedKey, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, [listCollapsedKey]);

  const toggleProperties = React.useCallback(() => {
    setIsPropertiesCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(propsCollapsedKey, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, [propsCollapsedKey]);

  // Responsive details toggle handler (opens mobile sheet on < 1024px, collapses/expands panel on >= 1024px)
  const handleToggleProperties = React.useCallback(() => {
    if (isLargeScreen) {
      toggleProperties();
    } else {
      setIsMobileDetailsOpen((prev) => !prev);
    }
  }, [isLargeScreen, toggleProperties]);

  // Thread selection handler (clears mobile details sheet on selection change)
  const handleSelectThread = React.useCallback((entityId: string | null) => {
    setSelectedEntityId(entityId);
    setIsMobileDetailsOpen(false);
  }, []);

  // When selection changes, mark thread as read
  React.useEffect(() => {
    if (selectedEntityId) {
      updateReadState(selectedEntityId);
    }
  }, [selectedEntityId, updateReadState]);

  // Firestore logs query with stable memoization & batchLimit pagination
  const logsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'message_logs'),
      where('workspaceIds', 'array-contains', activeWorkspaceId),
      orderBy('sentAt', 'desc'),
      limit(batchLimit)
    );
  }, [firestore, activeWorkspaceId, batchLimit]);

  const { data: logs, isLoading } = useCollection<MessageLog>(logsQuery);

  // Stale-While-Revalidate loading states to prevent full-page unmount during pagination
  const isInitialLoading = isLoading && !logs;
  const isLoadingMore = isLoading && Boolean(logs);

  const hasMore = Boolean(logs && logs.length >= batchLimit && batchLimit < MAX_BATCH_LIMIT);
  const isCapped = Boolean(batchLimit >= MAX_BATCH_LIMIT);

  const loadMore = React.useCallback(() => {
    setBatchLimit((prev) => Math.min(prev + 1000, MAX_BATCH_LIMIT));
  }, []);

  // Group logs into enriched threads with multi-tier identity resolution
  const threads = React.useMemo(() => {
    if (!logs) return [];

    const grouped = new Map<string, MessageLog[]>();
    logs.forEach((log) => {
      const key = log.entityId || log.recipient;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(log);
    });

    return Array.from(grouped.entries())
      .map(([key, messages]): ThreadGroup => {
        const sorted = messages.sort(
          (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
        );

        const identity = extractThreadIdentity(sorted);
        const lastViewedAt = readState[key];
        const unreadCount = lastViewedAt
          ? sorted.filter((m) => new Date(m.sentAt) > new Date(lastViewedAt)).length
          : sorted.length;

        const entityHeadline =
          identity.contactName && identity.institutionName
            ? `${identity.contactName} · ${identity.institutionName}`
            : identity.contactName || identity.institutionName || key;

        return {
          entityId: key,
          realEntityId: identity.realEntityId,
          entityName: entityHeadline,
          contactName: identity.contactName,
          institutionName: identity.institutionName,
          email: identity.email,
          phone: identity.phone,
          messages: sorted,
          lastMessage: sorted[0],
          lastMessageTimestamp: sorted[0].sentAt,
          totalMessages: sorted.length,
          unreadCount,
        };
      })
      .filter((thread) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          thread.contactName.toLowerCase().includes(q) ||
          thread.institutionName.toLowerCase().includes(q) ||
          thread.entityName.toLowerCase().includes(q) ||
          (thread.email && thread.email.toLowerCase().includes(q)) ||
          (thread.phone && thread.phone.toLowerCase().includes(q)) ||
          thread.messages.some(
            (m) =>
              m.subject?.toLowerCase().includes(q) ||
              m.body.toLowerCase().includes(q)
          )
        );
      })
      .sort(
        (a, b) =>
          new Date(b.lastMessageTimestamp).getTime() -
          new Date(a.lastMessageTimestamp).getTime()
      );
  }, [logs, readState, searchQuery]);

  const selectedThread = React.useMemo(
    () => threads.find((t) => t.entityId === selectedEntityId) || null,
    [threads, selectedEntityId]
  );

  // Effective scope: locked to 'mine' if non-admin and setting is disabled
  const effectiveScope = canViewAllMessages ? scopeFilter : 'mine';

  const totalAllCount = threads.length;
  const totalMineCount = React.useMemo(() => {
    return threads.filter((t) => isThreadForUser(t, userContext)).length;
  }, [threads, userContext]);

  const visibleThreads = React.useMemo(() => {
    if (effectiveScope === 'mine') {
      return threads.filter((t) => isThreadForUser(t, userContext));
    }
    return threads;
  }, [threads, effectiveScope, userContext]);

  // Full-page spinner only on initial mount
  if (isInitialLoading) {
    return (
      <PageContainerFluid className="h-[calc(100vh-64px)] flex flex-col">
        <div
          data-testid="conversations-initial-loading"
          className="flex flex-1 items-center justify-center rounded-2xl border border-border/80 bg-card shadow-xs"
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
        </div>
      </PageContainerFluid>
    );
  }

  return (
    <PageContainerFluid className="h-[calc(100vh-64px)] flex flex-col p-0 sm:p-4 md:p-6">
      <div className="flex flex-1 overflow-hidden rounded-none sm:rounded-2xl border-0 sm:border border-border/80 bg-card text-card-foreground shadow-xs">
        {/* Panel 1: Thread / Contact List */}
        <ThreadList
          threads={visibleThreads}
          selectedEntityId={selectedEntityId}
          onSelect={handleSelectThread}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          scopeFilter={effectiveScope}
          onScopeFilterChange={setScopeFilter}
          canViewAllMessages={canViewAllMessages}
          totalAllCount={totalAllCount}
          totalMineCount={totalMineCount}
          isCollapsed={isThreadListCollapsed}
          onToggleCollapse={toggleThreadList}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          isCapped={isCapped}
          onLoadMore={loadMore}
          className={cn(
            selectedEntityId ? 'hidden md:flex' : 'flex w-full md:w-80 lg:w-96',
            isThreadListCollapsed && 'md:hidden'
          )}
        />

        {/* Panel 2 & Panel 3 wrapper */}
        <div
          className={cn(
            'flex flex-1 overflow-hidden relative min-w-0',
            !selectedEntityId ? 'hidden md:flex' : 'flex w-full flex-1'
          )}
        >
          {selectedThread ? (
            <>
              {/* Panel 2: Message Thread Canvas */}
              <MessageThread
                thread={selectedThread}
                onBack={() => handleSelectThread(null)}
                isThreadListCollapsed={isThreadListCollapsed}
                onExpandThreadList={toggleThreadList}
                isPropertiesCollapsed={isLargeScreen ? isPropertiesCollapsed : !isMobileDetailsOpen}
                onToggleProperties={handleToggleProperties}
              />

              {/* Panel 3: Universal Entity Context & Contact Details Panel (Desktop inline) */}
              {!isPropertiesCollapsed && (
                <EntityContextPanel
                  thread={selectedThread}
                  onClose={() => setIsPropertiesCollapsed(true)}
                  className="hidden lg:flex"
                />
              )}

              {/* Mobile / Tablet Details Slide-Over Sheet */}
              <Sheet open={isMobileDetailsOpen} onOpenChange={setIsMobileDetailsOpen}>
                <SheetContent
                  side="right"
                  className="p-0 w-full sm:max-w-md border-l border-border bg-card flex flex-col h-full"
                >
                  <SheetHeader className="sr-only">
                    <SheetTitle>Contact Details</SheetTitle>
                    <SheetDescription>Contact information, CRM details, and timeline history</SheetDescription>
                  </SheetHeader>
                  <EntityContextPanel
                    thread={selectedThread}
                    onClose={() => setIsMobileDetailsOpen(false)}
                    className="w-full flex flex-1 border-l-0 shadow-none"
                  />
                </SheetContent>
              </Sheet>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center bg-muted/5">
              <div className="h-20 w-20 rounded-full bg-primary/5 border-4 border-primary/10 flex items-center justify-center mb-6 shadow-inner">
                <MessageSquare className="h-8 w-8 text-primary/40" />
              </div>
              <h3 className="text-xl font-semibold tracking-tight text-foreground">
                No conversation selected
              </h3>
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
