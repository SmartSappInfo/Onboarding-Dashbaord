'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { collection, query, where, limit } from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Sparkles, 
  Calendar, 
  MessageSquare, 
  Activity, 
  Settings, 
  ChevronRight, 
  Users, 
  TrendingUp, 
  Radio, 
  Loader2, 
  ArrowUpRight 
} from 'lucide-react';
import type { SocialPost, SocialInboxItem, SocialListeningRule } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SocialListeningAlert {
  id: string;
  author: string;
  platform: string;
  content: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  createdAt: string;
}

export default function SocialDashboardClient() {
  const db = useFirestore();
  const { activeWorkspaceId } = useTenant() as { activeWorkspaceId: string };
  const router = useRouter();

  // 1. Fetch Social Posts
  const postsQuery = useMemoFirebase(() => {
    if (!db || !activeWorkspaceId) return null;
    return query(
      collection(db, 'socialPosts'),
      where('workspaceId', '==', activeWorkspaceId)
    );
  }, [db, activeWorkspaceId]);

  const { data: postsRaw, isLoading: isLoadingPosts } = useCollection<SocialPost>(postsQuery);
  const posts = postsRaw || [];
  const scheduledCount = posts.filter(p => p.status === 'scheduled').length;

  // 2. Fetch Inbox Items
  const inboxQuery = useMemoFirebase(() => {
    if (!db || !activeWorkspaceId) return null;
    return query(
      collection(db, 'socialInbox'),
      where('workspaceId', '==', activeWorkspaceId)
    );
  }, [db, activeWorkspaceId]);

  const { data: inboxRaw, isLoading: isLoadingInbox } = useCollection<SocialInboxItem>(inboxQuery);
  const inboxItems = inboxRaw || [];
  const pendingInboxCount = inboxItems.filter(i => i.status === 'unread' || i.status === 'pending').length;

  // 3. Fetch Alerts Feed
  const alertsQuery = useMemoFirebase(() => {
    if (!db || !activeWorkspaceId) return null;
    return query(
      collection(db, 'socialListeningAlerts'),
      where('workspaceId', '==', activeWorkspaceId),
      limit(3)
    );
  }, [db, activeWorkspaceId]);

  const { data: alertsRaw } = useCollection<SocialListeningAlert>(alertsQuery);
  const alerts = alertsRaw || [];

  // Connected accounts simulation mock
  const connectedProfilesCount = 4; // Mock standard LinkedIn + FB + Instagram + X profiles

  const shortcuts = [
    { title: 'AI Composer', desc: 'Generate multi-channel post variations using Gemini.', href: '/admin/social/composer', icon: Sparkles, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
    { title: 'Reschedule Calendar', desc: 'Drag-and-drop scheduled variations queue.', href: '/admin/social/calendar', icon: Calendar, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' },
    { title: 'Social Inbox', desc: 'Adapt DMs replies with automated sentiment checks.', href: '/admin/social/inbox', icon: MessageSquare, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
    { title: 'ROI Analytics', desc: 'Measure post conversion funnels and tuition revenue.', href: '/admin/social/analytics', icon: TrendingUp, color: 'text-teal-500 bg-teal-500/10 border-teal-500/20' },
    { title: 'Listening Rules', desc: 'Track brand keywords and competitor mention alerts.', href: '/admin/social/listening', icon: Radio, color: 'text-pink-500 bg-pink-500/10 border-pink-500/20' },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-8 px-4">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <LayoutDashboard className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Social Hub</h1>
            <p className="text-muted-foreground text-xs font-medium">Configure brand voice tones, review unread parent comments, and track conversions pipeline.</p>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="border border-border/30 bg-card/40 backdrop-blur-sm rounded-2xl hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
          <CardHeader className="pb-2">
            <CardDescription className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Connected Profiles</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between pb-4">
            <span className="text-xl font-black text-foreground">{connectedProfilesCount}</span>
            <Badge className="text-[9px] uppercase tracking-wider h-5 bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" variant="outline">
              Active
            </Badge>
          </CardContent>
        </Card>

        <Card className="border border-border/30 bg-card/40 backdrop-blur-sm rounded-2xl hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
          <CardHeader className="pb-2">
            <CardDescription className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Inbox Inquiries</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between pb-4">
            <span className="text-xl font-black text-foreground">{pendingInboxCount}</span>
            {pendingInboxCount > 0 ? (
              <Badge className="text-[9px] uppercase tracking-wider h-5 bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 animate-pulse" variant="outline">
                Unresolved
              </Badge>
            ) : (
              <Badge className="text-[9px] uppercase tracking-wider h-5 bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" variant="outline">
                Clear
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/30 bg-card/40 backdrop-blur-sm rounded-2xl hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
          <CardHeader className="pb-2">
            <CardDescription className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Queue Calendar</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between pb-4">
            <span className="text-xl font-black text-foreground">{scheduledCount}</span>
            <span className="text-[9px] font-bold text-muted-foreground uppercase">Scheduled Posts</span>
          </CardContent>
        </Card>

        <Card className="border border-border/30 bg-card/40 backdrop-blur-sm rounded-2xl hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
          <CardHeader className="pb-2">
            <CardDescription className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Active Alerts</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between pb-4">
            <span className="text-xl font-black text-foreground">{alerts.length}</span>
            <span className="text-[9px] font-bold text-muted-foreground uppercase">Keyword Mentions</span>
          </CardContent>
        </Card>
      </div>

      {/* Bento Grid Shortcuts */}
      <div className="space-y-3">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Management Consoles</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {shortcuts.map((sc) => {
            const Icon = sc.icon;
            return (
              <button
                key={sc.title}
                onClick={() => router.push(sc.href)}
                className="w-full text-left p-4 rounded-2xl border border-border/20 bg-card/20 hover:bg-card/40 hover:border-border/40 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between items-start gap-4 active:scale-[0.98]"
              >
                <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center border shrink-0", sc.color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <span className="font-extrabold text-xs text-foreground block flex items-center gap-1">
                    {sc.title} <ArrowUpRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium leading-relaxed block">{sc.desc}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom columns: Inbound Feed & Alerts Feed preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Column 1: Inbound Messages */}
        <Card className="border border-border/20 bg-card/15 rounded-3xl overflow-hidden shadow-xl">
          <CardHeader className="pb-4 border-b border-border/10">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              Inbound Threads Preview
              <Button variant="ghost" size="sm" onClick={() => router.push('/admin/social/inbox')} className="h-6 text-[9px] font-bold uppercase tracking-wider gap-0.5 text-emerald-500">
                View Inbox <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 divide-y divide-border/10 space-y-3.5">
            {isLoadingInbox ? (
              <div className="h-24 flex items-center justify-center text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                <span className="text-[9px] font-bold uppercase tracking-widest">Loading previews...</span>
              </div>
            ) : inboxItems.length === 0 ? (
              <p className="text-[10px] text-muted-foreground/60 italic py-4">No inbound comments or messages cataloged yet.</p>
            ) : (
              inboxItems.slice(0, 3).map((item) => (
                <div key={item.id} className="pt-3.5 first:pt-0 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-extrabold text-[11px] text-foreground block">{item.senderName}</span>
                    <p className="text-[10px] text-muted-foreground/90 truncate max-w-sm mt-0.5">{item.content}</p>
                  </div>
                  <Badge className="text-[9px] uppercase tracking-wider" variant="outline">{item.sentiment}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Column 2: Brand Mentions alerts */}
        <Card className="border border-border/20 bg-card/15 rounded-3xl overflow-hidden shadow-xl">
          <CardHeader className="pb-4 border-b border-border/10">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              Tracked Mentions Alert
              <Button variant="ghost" size="sm" onClick={() => router.push('/admin/social/listening')} className="h-6 text-[9px] font-bold uppercase tracking-wider gap-0.5 text-emerald-500">
                View Listening <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 divide-y divide-border/10 space-y-3.5">
            {alerts.length === 0 ? (
              <p className="text-[10px] text-muted-foreground/60 italic py-4">No mentions captured yet. Trigger simulations to seed alerts.</p>
            ) : (
              alerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="pt-3.5 first:pt-0 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-extrabold text-[11px] text-foreground block">{alert.author} via {alert.platform}</span>
                    <p className="text-[10px] text-muted-foreground/90 truncate max-w-sm mt-0.5">{alert.content}</p>
                  </div>
                  <Badge className="text-[9px] uppercase tracking-wider" variant="outline">{alert.sentiment}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
