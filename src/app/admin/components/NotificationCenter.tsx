'use client';

import * as React from 'react';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Calendar,
  FileText,
  Settings,
  MessageSquareWarning,
  Info,
  Clock,
  ArrowRight,
  Inbox,
  Building2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  doc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { InAppNotification, Activity } from '@/lib/types';
import DOMPurify from 'isomorphic-dompurify';
import Link from 'next/link';

/**
 * @fileOverview Unified Notification Center with dual-category tabs.
 *
 * Consolidates individual notification bell and notification center triggers into
 * a single high-fidelity, accessible navigation trigger with:
 * - "Alerts" tab: Direct user notifications, tasks, mentions, reminders, and messaging alerts.
 * - "System" tab: Workspace-wide system event log and audit trail activities.
 *
 * ARCHITECTURAL INVARIANTS:
 * - Zero `any` or `any[]` typing.
 * - Strict open-redirect protection for notification links (`safeActionUrl`).
 * - Firestore writeBatch for one-click "Mark all as read".
 * - Demarcated header, accessible touch targets (min-h-[44px]), and tactile feedback.
 *
 * @testability Covered in `src/app/admin/components/__tests__/NotificationCenter.test.tsx`.
 */

export interface NotificationCenterProps {
  defaultOpen?: boolean;
}

export default function NotificationCenter({ defaultOpen }: NotificationCenterProps = {}) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const [activeTab, setActiveTab] = React.useState<'alerts' | 'system'>('alerts');
  const [isMarkingAll, setIsMarkingAll] = React.useState(false);

  // 1. DIRECT IN-APP NOTIFICATIONS QUERY
  const alertsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'in_app_notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
  }, [firestore, user?.uid]);

  const { data: notifications, isLoading: isLoadingAlerts } =
    useCollection<InAppNotification>(alertsQuery);

  // 2. WORKSPACE SYSTEM ACTIVITIES QUERY
  const activitiesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'activities'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
  }, [firestore, activeWorkspaceId]);

  const { data: allActivities, isLoading: isLoadingActivities } =
    useCollection<Activity>(activitiesQuery);

  // Filter for system-generated activities
  const systemActivities = React.useMemo(() => {
    if (!allActivities) return [];
    return allActivities.filter((a) => a.source === 'system').slice(0, 15);
  }, [allActivities]);

  // UNREAD & RECENT METRICS
  const unreadAlertsCount = React.useMemo(() => {
    if (!notifications) return 0;
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  const recentSystemCount = React.useMemo(() => {
    if (!systemActivities) return 0;
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    return systemActivities.filter((a) => {
      const time = new Date(a.timestamp).getTime();
      return !isNaN(time) && time > oneHourAgo;
    }).length;
  }, [systemActivities]);

  const totalUnread = unreadAlertsCount;

  // SAFE PATH SANITIZATION (Prevents Open Redirect & XSS vulnerabilities)
  const safeActionUrl = React.useCallback((rawUrl?: string): string | null => {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    const trimmed = rawUrl.trim();
    if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\')) {
      return trimmed;
    }
    return null;
  }, []);

  // MARK SINGLE NOTIFICATION AS READ
  const markAsRead = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, 'in_app_notifications', id), { isRead: true });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // BATCH MARK ALL ALERTS AS READ
  const markAllAlertsAsRead = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!firestore || !notifications || isMarkingAll) return;

    const unreadAlerts = notifications.filter((n) => !n.isRead && n.id);
    if (unreadAlerts.length === 0) return;

    setIsMarkingAll(true);
    try {
      const batch = writeBatch(firestore);
      for (const item of unreadAlerts.slice(0, 50)) {
        batch.update(doc(firestore, 'in_app_notifications', item.id), { isRead: true });
      }
      await batch.commit();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    } finally {
      setIsMarkingAll(false);
    }
  };

  // CATEGORY & EVENT ICON RESOLVERS
  const getAlertIcon = (category?: string) => {
    switch (category) {
      case 'tasks':
        return <Check className="h-4 w-4 text-emerald-500" />;
      case 'reminders':
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case 'automations':
        return <Settings className="h-4 w-4 text-purple-500" />;
      case 'forms':
        return <FileText className="h-4 w-4 text-amber-500" />;
      case 'messaging':
        return <MessageSquareWarning className="h-4 w-4 text-rose-500" />;
      case 'general':
      default:
        return <Info className="h-4 w-4 text-primary" />;
    }
  };

  const getSystemIcon = (type: string) => {
    switch (type) {
      case 'meeting_created':
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case 'pdf_form_submitted':
        return <FileText className="h-4 w-4 text-emerald-500" />;
      case 'school_assigned':
      case 'entity_assigned':
        return <Building2 className="h-4 w-4 text-purple-500" />;
      default:
        return <Info className="h-4 w-4 text-primary" />;
    }
  };

  const formatSafeTime = (dateString?: string): string => {
    if (!dateString) return 'recently';
    const parsed = new Date(dateString);
    if (isNaN(parsed.getTime())) return 'recently';
    return formatDistanceToNow(parsed, { addSuffix: true });
  };

  return (
    <DropdownMenu modal={false} defaultOpen={defaultOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 min-h-[44px] min-w-[44px] rounded-xl hover:bg-primary/5 transition-all active:scale-[0.97]"
          aria-label={
            totalUnread > 0
              ? `Notifications (${totalUnread} unread)`
              : 'Notifications'
          }
        >
          <Bell
            className={cn(
              'h-5 w-5 transition-colors',
              totalUnread > 0 ? 'text-primary fill-primary/10' : 'text-muted-foreground'
            )}
          />
          {totalUnread > 0 && (
            <span
              data-testid="notification-unread-badge"
              className="absolute top-1.5 right-1.5 min-w-4.5 h-4.5 px-1 flex items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground ring-2 ring-background animate-in zoom-in duration-200"
            >
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[calc(100vw-32px)] sm:w-[400px] max-w-[420px] p-0 rounded-2xl overflow-hidden shadow-2xl border border-border/80 bg-card text-card-foreground animate-in zoom-in-95 duration-150"
      >
        {/* DEMARCATED HEADER WITH SEGMENTED TABS */}
        <div className="p-3.5 sm:p-4 bg-muted/20 border-b border-border/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
              {totalUnread > 0 && (
                <Badge
                  variant="secondary"
                  className="rounded-full px-2 py-0 text-[10px] font-semibold text-primary bg-primary/10 border-primary/20"
                >
                  {totalUnread} new
                </Badge>
              )}
            </div>

            {activeTab === 'alerts' && unreadAlertsCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAlertsAsRead}
                disabled={isMarkingAll}
                className="h-7 px-2 text-[11px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-all active:scale-[0.97]"
                aria-label="Mark all alerts as read"
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                {isMarkingAll ? 'Marking...' : 'Mark all read'}
              </Button>
            )}
          </div>

          {/* TWO DEDICATED TABS */}
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as 'alerts' | 'system')}
            className="w-full"
          >
            <TabsList className="grid grid-cols-2 w-full h-9 p-1 bg-muted/50 rounded-xl">
              <TabsTrigger
                value="alerts"
                onClick={() => setActiveTab('alerts')}
                className="rounded-lg text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center justify-center gap-1.5 transition-all"
              >
                <span>Direct Alerts</span>
                {unreadAlertsCount > 0 && (
                  <span className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    {unreadAlertsCount > 99 ? '99+' : unreadAlertsCount}
                  </span>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="system"
                onClick={() => setActiveTab('system')}
                className="rounded-lg text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center justify-center gap-1.5 transition-all"
              >
                <span>System Feed</span>
                {recentSystemCount > 0 && (
                  <span className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-muted-foreground/20 text-[9px] font-semibold text-foreground">
                    {recentSystemCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* TAB 1 CONTENT: DIRECT ALERTS */}
        {activeTab === 'alerts' && (
          <div>
            <ScrollArea className="h-[360px] sm:h-[390px]">
              <div className="divide-y divide-border/50">
                {isLoadingAlerts ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="p-4 space-y-2">
                      <div className="h-3.5 w-2/3 bg-muted animate-pulse rounded-md" />
                      <div className="h-2.5 w-1/2 bg-muted animate-pulse rounded-md" />
                    </div>
                  ))
                ) : notifications && notifications.length > 0 ? (
                  notifications.map((n) => {
                    const actionPath = safeActionUrl(n.actionUrl);
                    const alertBody = (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <p
                            className={cn(
                              'text-xs font-semibold leading-tight',
                              n.isRead ? 'text-muted-foreground' : 'text-foreground'
                            )}
                          >
                            {n.title}
                          </p>
                          {!n.isRead && (
                            <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          )}
                        </div>

                        {n.body && (
                          <div
                            className="text-[11px] text-muted-foreground/90 mb-1.5 line-clamp-2 leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: DOMPurify.sanitize(n.body, {
                                USE_PROFILES: { html: true },
                              }),
                            }}
                          />
                        )}

                        <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground/60">
                          <Clock className="h-2.5 w-2.5" />
                          <span>{formatSafeTime(n.createdAt)}</span>
                        </div>
                      </>
                    );

                    return (
                      <div
                        key={n.id}
                        className={cn(
                          'p-3.5 sm:p-4 transition-colors group relative flex gap-3 sm:gap-3.5 items-start',
                          n.isRead
                            ? 'bg-background/40 hover:bg-muted/30 opacity-75'
                            : 'bg-primary/[0.03] hover:bg-primary/[0.06]'
                        )}
                      >
                        <div
                          className={cn(
                            'p-2 rounded-xl h-fit shrink-0 shadow-inner transition-colors mt-0.5',
                            n.isRead ? 'bg-muted/60' : 'bg-background border border-border/60'
                          )}
                        >
                          {getAlertIcon(n.category)}
                        </div>

                        {actionPath ? (
                          <Link href={actionPath} className="block flex-1 min-w-0 pr-2">
                            {alertBody}
                          </Link>
                        ) : (
                          <div className="flex-1 min-w-0 pr-2">
                            {alertBody}
                          </div>
                        )}

                        {!n.isRead && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 shrink-0 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity active:scale-[0.97]"
                            onClick={(e) => markAsRead(n.id, e)}
                            title="Mark as read"
                            aria-label={`Mark "${n.title}" as read`}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="py-20 text-center space-y-2.5 opacity-60">
                    <BellOff className="h-9 w-9 mx-auto text-muted-foreground/50" />
                    <p className="text-xs font-semibold text-foreground">No alerts</p>
                    <p className="text-[11px] text-muted-foreground max-w-[200px] mx-auto">
                      You are all caught up on direct notifications and assignments.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* TAB 1 FOOTER */}
            <div className="p-2.5 px-4 bg-muted/15 border-t border-border/80 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{notifications?.length || 0} direct alerts</span>
              <Link
                href="/admin/settings"
                className="font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                Preferences
              </Link>
            </div>
          </div>
        )}

        {/* TAB 2 CONTENT: SYSTEM ACTIVITIES FEED */}
        {activeTab === 'system' && (
          <div>
            <ScrollArea className="h-[360px] sm:h-[390px]">
              <div className="divide-y divide-border/50">
                {isLoadingActivities ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="p-4 space-y-2">
                      <div className="h-3.5 w-2/3 bg-muted animate-pulse rounded-md" />
                      <div className="h-2.5 w-1/2 bg-muted animate-pulse rounded-md" />
                    </div>
                  ))
                ) : systemActivities && systemActivities.length > 0 ? (
                  systemActivities.map((a) => (
                    <div
                      key={a.id}
                      className="p-3.5 sm:p-4 hover:bg-muted/30 transition-colors cursor-default group flex gap-3 sm:gap-3.5 items-start"
                    >
                      <div className="p-2 bg-muted/60 rounded-xl h-fit shrink-0 shadow-inner group-hover:bg-background transition-colors mt-0.5">
                        {getSystemIcon(a.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold leading-tight mb-1 text-foreground">
                          {a.description}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground/60 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {formatSafeTime(a.timestamp)}
                          </span>
                          {(a.entityName || a.displayName) && (
                            <span className="border-l border-border/80 pl-2 truncate max-w-[180px] text-foreground/80 font-medium">
                              {a.entityName || a.displayName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center space-y-2.5 opacity-60">
                    <Inbox className="h-9 w-9 mx-auto text-muted-foreground/50" />
                    <p className="text-xs font-semibold text-foreground">Feed empty</p>
                    <p className="text-[11px] text-muted-foreground max-w-[200px] mx-auto">
                      Recent system events and automated actions will be tracked here.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* TAB 2 FOOTER */}
            <div className="p-2.5 bg-muted/15 border-t border-border/80">
              <Button
                variant="ghost"
                asChild
                className="w-full h-8 sm:h-9 rounded-xl font-medium text-xs hover:text-primary transition-all active:scale-[0.97]"
              >
                <Link href="/admin/activities" className="flex items-center justify-center gap-1.5">
                  <span>View Complete Audit Timeline</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
