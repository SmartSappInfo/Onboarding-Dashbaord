'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useCallQueueItems, useCallCampaigns } from '@/lib/call-centre-hooks';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageContainer } from '@/components/ui/page-container';
import { cn } from '@/lib/utils';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';
import { 
  RefreshCw, 
  ArrowLeft, 
  AlertCircle, 
  Phone, 
  Clock, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  Settings,
  CheckCircle2,
  PhoneOff,
  UserCheck,
  ChevronRight,
  UserPlus,
  Play
} from 'lucide-react';
import { generateCampaignQueueAction } from '@/lib/call-centre-actions';
import { parseGraph, getOutcomeAutomations } from '@/lib/call-centre-graph';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { CallCampaign } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';

const AddContactsDialog = dynamic(
  () => import('../../components/AddContactsDialog').then(m => m.AddContactsDialog),
  { ssr: false, loading: () => <Skeleton className="h-10 w-full rounded-xl" /> }
);

interface CampaignAnalyticsClientProps {
  campaignId: string;
  workspaceId: string;
}

export function CampaignAnalyticsClient({ campaignId, workspaceId }: CampaignAnalyticsClientProps) {
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();
  const { activeWorkspaceId: contextWorkspaceId } = useWorkspace() as any;
  const activeWorkspaceId = workspaceId || contextWorkspaceId;

  const { campaigns, isLoading: campaignsLoading } = useCallCampaigns(activeWorkspaceId);
  const { queueItems, isLoading: queueItemsLoading } = useCallQueueItems(campaignId);

  const campaign = React.useMemo(() => campaigns.find(c => c.id === campaignId), [campaigns, campaignId]);
  // Parse the campaign's script snapshot once (not per row — js-cache-function-results).
  const scriptGraph = React.useMemo(
    () => (campaign ? parseGraph(campaign.scriptSnapshot) : null),
    [campaign?.scriptSnapshot]
  );
  useSetBreadcrumb(campaign?.name ? `${campaign.name} Analytics` : 'Campaign Analytics');

  const [expandedNotesId, setExpandedNotesId] = React.useState<string | null>(null);
  const [isAddContactsOpen, setIsAddContactsOpen] = React.useState(false);
  const [isLaunching, setIsLaunching] = React.useState(false);

  const handleLaunchOrContinue = async () => {
    if (!campaign) return;
    if (campaign.status === 'running' || campaign.status === 'paused') {
      router.push(wrapHref(`/admin/messaging/call-centre/workspace/${campaign.id}`));
      return;
    }
    // Draft/scheduled → launch
    if (!campaign.scriptId) {
      toast({ variant: 'destructive', title: 'Launch Prevented', description: 'Assign a script playbook before launching.' });
      return;
    }
    setIsLaunching(true);
    try {
      const result = await generateCampaignQueueAction(campaign.id, activeWorkspaceId, user?.uid || '');
      if (result.success) {
        toast({ title: 'Campaign Launched', description: 'Call queue successfully created.' });
        router.push(wrapHref(`/admin/messaging/call-centre/workspace/${campaign.id}`));
      } else {
        toast({ variant: 'destructive', title: 'Launch Failed', description: result.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsLaunching(false);
    }
  };

  const wrapHref = (href: string) => {
    if (!activeWorkspaceId) return href;
    const separator = href.includes('?') ? '&' : '?';
    return `${href}${separator}track=${activeWorkspaceId}`;
  };

  // Filter completed calls for log
  const completedCalls = React.useMemo(() => {
    return queueItems
      .filter(item => item.status === 'completed')
      .sort((a, b) => {
        const timeA = a.lastAttemptAt ? new Date(a.lastAttemptAt).getTime() : 0;
        const timeB = b.lastAttemptAt ? new Date(b.lastAttemptAt).getTime() : 0;
        return timeB - timeA; // Most recent calls first
      });
  }, [queueItems]);

  // Aggregate outcomes and statuses
  const analytics = React.useMemo(() => {
    if (queueItems.length === 0) return [];

    const counts: Record<string, { count: number; color: string; label: string }> = {};

    const addCount = (key: string, label: string, color: string) => {
      if (!counts[key]) {
        counts[key] = { count: 0, label, color };
      }
      counts[key].count++;
    };

    queueItems.forEach(item => {
      if (item.status === 'completed') {
        const outcomeLabel = item.outcome || 'Completed (No Outcome)';
        let color = 'bg-primary';
        if (outcomeLabel.toLowerCase().includes('interested') && !outcomeLabel.toLowerCase().includes('not')) {
          color = 'bg-emerald-500';
        } else if (outcomeLabel.toLowerCase().includes('not interested')) {
          color = 'bg-rose-500';
        } else if (outcomeLabel.toLowerCase().includes('callback') || outcomeLabel.toLowerCase().includes('call back')) {
          color = 'bg-amber-500';
        } else if (outcomeLabel.toLowerCase().includes('wrong')) {
          color = 'bg-red-700';
        } else if (outcomeLabel.toLowerCase().includes('no answer') || outcomeLabel.toLowerCase().includes('voicemail')) {
          color = 'bg-zinc-500';
        } else if (outcomeLabel.toLowerCase().includes('defer')) {
          color = 'bg-purple-500';
        }
        addCount(`outcome:${outcomeLabel}`, outcomeLabel, color);
      } else if (item.status === 'callback_scheduled') {
        addCount('status:callback', 'Callback Scheduled', 'bg-amber-400');
      } else if (item.status === 'deferred') {
        addCount('status:deferred', 'Deferred Call', 'bg-purple-400');
      } else if (item.status === 'skipped') {
        addCount('status:skipped', 'Skipped', 'bg-zinc-400');
      } else {
        addCount('status:pending', 'Pending / In Progress', 'bg-blue-500');
      }
    });

    const total = queueItems.length;
    return Object.values(counts)
      .map(group => ({
        ...group,
        percentage: Math.round((group.count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [queueItems]);

  const formatCallDuration = (secs: number | undefined) => {
    if (secs === undefined) return '0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const getOutcomeBadgeColor = (outcomeLabel: string | undefined) => {
    if (!outcomeLabel) return 'bg-zinc-500/10 border-zinc-500/20 text-zinc-400';
    const clean = outcomeLabel.toLowerCase();
    if (clean.includes('interested') && !clean.includes('not')) {
      return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
    }
    if (clean.includes('not interested')) {
      return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
    }
    if (clean.includes('callback') || clean.includes('call back')) {
      return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
    }
    return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
  };

  const getStatusBadge = (status: CallCampaign['status']) => {
    switch (status) {
      case 'running':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 font-bold uppercase text-[9px] px-2 rounded-md">Running</Badge>;
      case 'paused':
        return <Badge variant="secondary" className="bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 font-bold uppercase text-[9px] px-2 rounded-md">Paused</Badge>;
      case 'completed':
        return <Badge className="bg-blue-500 hover:bg-blue-600 font-bold uppercase text-[9px] px-2 rounded-md">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive" className="font-bold uppercase text-[9px] px-2 rounded-md">Cancelled</Badge>;
      default:
        return <Badge variant="outline" className="font-bold uppercase text-[9px] px-2 rounded-md">Draft</Badge>;
    }
  };

  const isLoading = campaignsLoading || queueItemsLoading;

  return (
    <div className="h-full overflow-y-auto bg-background text-foreground">
      <PageContainer>
        <div className="space-y-8 py-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border pb-5">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Button
                onClick={() => router.push(wrapHref('/admin/messaging/call-centre'))}
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl border border-border bg-muted hover:bg-accent text-muted-foreground shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-xl font-black uppercase text-foreground tracking-wider truncate">
                  {campaign?.name || 'Campaign Analytics'}
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-lg">
                  {campaign?.description || 'Detailed outcomes, duration metrics, and call history logs'}
                </p>
              </div>
            </div>
            {campaign && (
              <div className="flex items-center gap-2 shrink-0">
                {/* Add Contacts button */}
                {campaign.allowAddContactsAfterLaunch !== false || campaign.status === 'draft' ? (
                  <Button
                    onClick={() => setIsAddContactsOpen(true)}
                    variant="outline"
                    className="h-9 px-4 rounded-xl font-bold text-[10px] uppercase tracking-wider gap-1.5 border-border hover:bg-accent"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Add Contacts
                  </Button>
                ) : null}

                {/* Launch / Continue button */}
                {campaign.status !== 'completed' && campaign.status !== 'cancelled' && (
                  <Button
                    onClick={handleLaunchOrContinue}
                    disabled={isLaunching}
                    className="h-9 px-5 rounded-xl font-bold text-[10px] uppercase tracking-wider gap-1.5 bg-primary hover:bg-primary/90 text-white"
                  >
                    {isLaunching ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5 fill-current" />
                    )}
                    {campaign.status === 'running' || campaign.status === 'paused' ? 'Continue Calling' : 'Launch Campaign'}
                  </Button>
                )}
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-40 gap-3 text-muted-foreground">
              <RefreshCw className="h-8 w-8 text-primary animate-spin" />
              <span className="text-xs font-semibold">Loading campaign analytics...</span>
            </div>
          ) : !campaign ? (
            <div className="text-center py-20 space-y-3">
              <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
              <h4 className="text-sm font-bold text-muted-foreground">Campaign not found</h4>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">The requested campaign does not exist or you do not have permission to view it.</p>
              <Button onClick={() => router.push(wrapHref('/admin/messaging/call-centre'))} className="rounded-xl font-bold text-xs">
                Back to Dashboard
              </Button>
            </div>
          ) : (
            <>
              {/* Premium KPI Metric Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border border-border bg-card rounded-2xl shadow-sm hover:shadow-md transition-all">
                  <CardContent className="p-6 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-primary/10 text-primary rounded-xl border border-primary/20">
                        <Phone className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Queue Contacts</p>
                        <p className="text-2xl font-black text-foreground">{queueItems.length}</p>
                      </div>
                    </div>
                    {campaign.allowAddContactsAfterLaunch === false && campaign.status !== 'draft' ? (
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="opacity-50 cursor-not-allowed">
                              <Button
                                disabled
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-lg font-bold text-[10px] uppercase tracking-wider gap-1"
                              >
                                <UserPlus className="h-3.5 w-3.5" /> Add
                              </Button>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-[10px] font-bold">Audience is fixed after launch.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <Button
                        onClick={() => setIsAddContactsOpen(true)}
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg font-bold text-[10px] uppercase tracking-wider text-primary border-primary/20 hover:bg-primary/5 gap-1"
                      >
                        <UserPlus className="h-3.5 w-3.5" /> Add
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card className="border border-border bg-card rounded-2xl shadow-sm hover:shadow-md transition-all">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Completed Calls</p>
                      <p className="text-2xl font-black text-foreground">{completedCalls.length}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border bg-card rounded-2xl shadow-sm hover:shadow-md transition-all">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20">
                      <Clock className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Callbacks Pending</p>
                      <p className="text-2xl font-black text-foreground">
                        {queueItems.filter(i => i.status === 'callback_scheduled').length}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border bg-card rounded-2xl shadow-sm hover:shadow-md transition-all">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl border border-purple-500/20">
                      <UserCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Deferred Calls</p>
                      <p className="text-2xl font-black text-foreground">
                        {queueItems.filter(i => i.status === 'deferred').length}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Analytics Content — Full Width */}
              <div className="space-y-6">
                <Tabs defaultValue="distribution" className="w-full">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <TabsList className="bg-transparent h-10 p-0 rounded-none border-b border-transparent gap-6">
                      <TabsTrigger 
                        value="distribution" 
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-sm font-bold px-0 pb-2.5 text-muted-foreground data-[state=active]:text-foreground"
                      >
                        Outcomes Distribution
                      </TabsTrigger>
                      <TabsTrigger 
                        value="logs" 
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-sm font-bold px-0 pb-2.5 text-muted-foreground data-[state=active]:text-foreground"
                      >
                        Call Logs ({completedCalls.length})
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="distribution" className="pt-6 space-y-8">
                    {queueItems.length === 0 ? (
                      <div className="text-center py-20 border border-dashed border-border rounded-2xl bg-muted/20">
                        <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <h4 className="text-sm font-bold text-muted-foreground">No dialer records found</h4>
                        <p className="text-xs text-muted-foreground">This campaign does not have any contacts in its queue yet.</p>
                      </div>
                    ) : (
                      <Card className="border border-border bg-card rounded-2xl">
                        <div className="p-6 border-b border-border bg-muted/20">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-foreground">Visual Outcome Distribution</h3>
                            <span className="text-xs font-bold text-muted-foreground">{queueItems.length} total contacts</span>
                          </div>
                        </div>
                        <div className="p-6 space-y-6">
                          {/* Segmented Bar — one bar per outcome like the reference */}
                          <div className="h-3 w-full rounded-full overflow-hidden flex bg-muted/50">
                            {analytics.map((group, idx) => {
                              if (group.percentage === 0) return null;
                              return (
                                <TooltipProvider key={idx} delayDuration={100}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        className={`${group.color} transition-all duration-300 hover:brightness-110 cursor-default`}
                                        style={{ width: `${group.percentage}%` }}
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p className="text-[10px] font-bold">{group.label}: {group.count} ({group.percentage}%)</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })}
                          </div>

                          {/* Individual segment bars with labels (like the currency balance reference) */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-5">
                            {analytics.map((group, idx) => (
                              <div key={idx} className="space-y-1.5">
                                <div className="h-2 w-full rounded-full overflow-hidden bg-muted/50">
                                  <div
                                    className={`${group.color} h-full rounded-full transition-all duration-500`}
                                    style={{ width: `${group.percentage}%` }}
                                  />
                                </div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate" title={group.label}>
                                  {group.label}
                                </p>
                                <p className="text-sm font-black text-foreground">
                                  {group.percentage}%
                                  <span className="text-[10px] font-medium text-muted-foreground ml-1">({group.count})</span>
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Card>
                    )}
                  </TabsContent>

                  {/* Logs Tab Content */}
                  <TabsContent value="logs" className="pt-6" style={{ contentVisibility: 'auto' }}>
                    {completedCalls.length === 0 ? (
                      <div className="text-center py-20 border border-dashed border-border rounded-2xl bg-muted/20">
                        <PhoneOff className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <h4 className="text-sm font-bold text-muted-foreground">No completed calls</h4>
                        <p className="text-xs text-muted-foreground">No contacts have been resolved in this campaign yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {completedCalls.map((item) => {
                          const isExpanded = expandedNotesId === item.id;
                          // Script-owned automations first; fall back to legacy campaign rules.
                          const rules = (item.outcome && scriptGraph ? getOutcomeAutomations(scriptGraph, item.outcome) : null)
                            ?? campaign?.automationRules?.[item.outcome || '']
                            ?? [];

                          return (
                            <div 
                              key={item.id} 
                              className="p-5 bg-card border border-border rounded-2xl space-y-4 hover:border-primary/30 hover:shadow-sm transition-all"
                            >
                              {/* Contact Info Header */}
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <h4 className="text-sm font-bold text-foreground">{item.entityName}</h4>
                                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground font-medium">
                                    <span className="font-mono">{item.entityPhone || 'No Phone'}</span>
                                    {item.entityEmail && (
                                      <>
                                        <span>•</span>
                                        <span className="truncate max-w-[200px]">{item.entityEmail}</span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <Badge variant="outline" className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded", getOutcomeBadgeColor(item.outcome))}>
                                  {item.outcome || 'Completed'}
                                </Badge>
                              </div>

                              {/* Log stats (Duration, Date, attempts) */}
                              <div className="grid grid-cols-3 gap-2 bg-muted/60 p-3.5 border border-border rounded-xl text-center text-xs font-mono text-muted-foreground">
                                <div className="flex items-center justify-center gap-1.5">
                                  <Clock className="h-3.5 w-3.5" />
                                  <span>{formatCallDuration(item.duration)}</span>
                                </div>
                                <div>
                                  <span className="font-bold text-foreground">{item.attempts}</span> attempts
                                </div>
                                <div>
                                  <span>{item.lastAttemptAt ? new Date(item.lastAttemptAt).toLocaleDateString() : '—'}</span>
                                </div>
                              </div>

                              {/* Post-Call Actions / Automations badges */}
                              <div className="pt-1 space-y-2">
                                <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                  <Settings className="h-3.5 w-3.5" />
                                  <span>Triggered Automations ({rules.length})</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {rules.length === 0 ? (
                                    <span className="text-[10px] text-muted-foreground italic">No automations mapped to this outcome</span>
                                  ) : (
                                    rules.map((rule, idx) => (
                                      <Badge key={idx} variant="outline" className="text-[8px] font-bold uppercase tracking-wider bg-muted border-border text-muted-foreground">
                                        {rule.type === 'CHANGE_STAGE' && 'Stage Changed'}
                                        {rule.type === 'ADD_TAG' && 'Applied Tag'}
                                        {rule.type === 'CREATE_TASK' && 'Created Task'}
                                        {rule.type === 'SEND_SMS' && 'Sent SMS'}
                                        {rule.type === 'SEND_EMAIL' && 'Sent Email'}
                                      </Badge>
                                    ))
                                  )}
                                </div>
                              </div>

                              {/* Call Notes Collapsible toggler */}
                              {item.notesDraft && (
                                <div className="border-t border-border pt-3">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedNotesId(isExpanded ? null : item.id)}
                                    className="flex items-center gap-1.5 text-[9px] font-bold text-primary uppercase tracking-widest hover:text-primary/80"
                                  >
                                    <FileText className="h-3.5 w-3.5" />
                                    <span>Call Notes Logged</span>
                                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                  </button>
                                  
                                  {isExpanded && (
                                    <div className="mt-2.5 p-3.5 bg-muted border border-border rounded-xl text-xs text-foreground font-serif leading-relaxed italic whitespace-pre-line select-text animate-in slide-in-from-top-2 duration-200">
                                      "{item.notesDraft}"
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </div>
      </PageContainer>
      {isAddContactsOpen && campaign && (
        <AddContactsDialog
          open={isAddContactsOpen}
          onOpenChange={setIsAddContactsOpen}
          campaignId={campaign.id}
          workspaceId={activeWorkspaceId}
          campaignName={campaign.name}
        />
      )}
    </div>
  );
}
