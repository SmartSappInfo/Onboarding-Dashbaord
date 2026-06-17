'use client';

// Force Turbopack re-compilation to clear runtime caching error
import * as React from 'react';

import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { useCallCampaigns, useCallScripts } from '@/lib/call-centre-hooks';
import { deleteCallScriptAction, deleteCallCampaignAction, generateCampaignQueueAction } from '@/lib/call-centre-actions';
import { extractPreviewText, isJsonGraph, parseGraph } from '@/lib/call-centre-graph';
import { useToast } from '@/hooks/use-toast';
import { PageContainer } from '@/components/ui/page-container';
import type { CallCampaign, CallScript } from '@/lib/types';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScriptPlaybookView } from './scripts/components/ScriptPlaybookView';
import { 
  PhoneCall, 
  Plus, 
  FileText, 
  Play, 
  RefreshCw, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Clock, 
  PhoneOff,
  UserCheck,
  BarChart3,
  Phone,
  ChevronRight,
  Eye
} from 'lucide-react';
export function CallCentreClient({ defaultTab }: { defaultTab: string }) {
  const router = useRouter();
  const { user } = useUser();
  useSetBreadcrumb('Call Centre');
  const { activeWorkspaceId } = useWorkspace() as any;
  const { toast } = useToast();

  const { campaigns, isLoading: campaignsLoading } = useCallCampaigns(activeWorkspaceId);
  const { scripts, isLoading: scriptsLoading } = useCallScripts(activeWorkspaceId);

  const [activeTab, setActiveTab] = React.useState(defaultTab);

  const wrapHref = (href: string) => {
    if (!activeWorkspaceId) return href;
    const separator = href.includes('?') ? '&' : '?';
    return `${href}${separator}track=${activeWorkspaceId}`;
  };

  // ─── Calculations ──────────────────────────────────────────────────────────

  const stats = React.useMemo(() => {
    let totalCalls = 0;
    let completedCalls = 0;
    let pendingCalls = 0;
    let callbackCalls = 0;
    let deferredCalls = 0;

    campaigns.forEach(c => {
      totalCalls += c.progress?.total || 0;
      completedCalls += c.progress?.completed || 0;
      pendingCalls += c.progress?.pending || 0;
      callbackCalls += c.progress?.callbacks || 0;
      deferredCalls += c.progress?.deferred || 0;
    });

    return { totalCalls, completedCalls, pendingCalls, callbackCalls, deferredCalls };
  }, [campaigns]);

  // ─── States & Handlers ─────────────────────────────────────────────────────

  const [scriptToDelete, setScriptToDelete] = React.useState<string | null>(null);
  const [campaignToDelete, setCampaignToDelete] = React.useState<string | null>(null);
  const [campaignToLaunch, setCampaignToLaunch] = React.useState<string | null>(null);
  const [launchingCampaignId, setLaunchingCampaignId] = React.useState<string | null>(null);
  const [previewScript, setPreviewScript] = React.useState<CallScript | null>(null);

  const performDeleteScript = async (scriptId: string) => {
    try {
      const result = await deleteCallScriptAction(scriptId, activeWorkspaceId, user?.uid || '');
      if (result.success) {
        toast({ title: 'Script Deleted' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setScriptToDelete(null);
    }
  };

  const performDeleteCampaign = async (campaignId: string) => {
    try {
      const result = await deleteCallCampaignAction(campaignId, activeWorkspaceId, user?.uid || '');
      if (result.success) {
        toast({ title: 'Campaign Deleted' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setCampaignToDelete(null);
    }
  };

  const handleLaunchConfirm = (campaign: CallCampaign) => {
    if (!campaign.scriptId) {
      toast({
        variant: 'destructive',
        title: 'Launch Prevented',
        description: 'You must edit the campaign and assign a script playbook before launching.'
      });
      return;
    }
    setCampaignToLaunch(campaign.id);
  };

  const performLaunchCampaign = async (campaignId: string) => {
    setCampaignToLaunch(null);
    setLaunchingCampaignId(campaignId);
    try {
      const result = await generateCampaignQueueAction(campaignId, activeWorkspaceId, user?.uid || '');
      if (result.success) {
        toast({ title: 'Campaign Launched', description: 'Call queue successfully created.' });
        router.push(wrapHref(`/admin/messaging/call-centre/workspace/${campaignId}`));
      } else {
        toast({ variant: 'destructive', title: 'Launch Failed', description: result.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setLaunchingCampaignId(null);
    }
  };

  const handleDeleteScript = (scriptId: string) => {
    setScriptToDelete(scriptId);
  };

  const handleDeleteCampaign = (campaignId: string) => {
    setCampaignToDelete(campaignId);
  };

  // Status Badge Helper
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

  return (
    <div className="h-full overflow-y-auto bg-background text-foreground">
      <PageContainer>
        <Tabs defaultValue="campaigns" value={activeTab} onValueChange={setActiveTab} className="w-full space-y-8 py-6">
          
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border pb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner shrink-0">
                <PhoneCall className="h-5 w-5 text-primary animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl font-black uppercase text-foreground tracking-wider mt-0.5">Call Centre</h1>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                  Outreach scripts, dialer queues, and AI-powered workflows
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <TabsList className="bg-muted border border-border shadow-sm h-10 p-1 rounded-xl ring-1 ring-border/50">
                <TabsTrigger value="campaigns" className="rounded-lg font-bold text-xs px-4 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Outreach Campaigns</TabsTrigger>
                <TabsTrigger value="scripts" className="rounded-lg font-bold text-xs px-4 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Call Scripts</TabsTrigger>
              </TabsList>

              {activeTab === 'campaigns' ? (
                <Button
                  onClick={() => router.push(wrapHref('/admin/messaging/call-centre/campaigns/new'))}
                  className="h-9 px-4 rounded-xl font-bold text-[10px] uppercase tracking-wider gap-2 bg-primary hover:bg-primary/95 text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> New Campaign
                </Button>
              ) : (
                <Button
                  onClick={() => router.push(wrapHref('/admin/messaging/call-centre/scripts/new'))}
                  className="h-9 px-4 rounded-xl font-bold text-[10px] uppercase tracking-wider gap-2 bg-primary hover:bg-primary/95 text-white"
                >
                  <FileText className="h-3.5 w-3.5" /> New Script
                </Button>
              )}
            </div>
          </div>

          {/* Stats Row */}
          {activeTab === 'campaigns' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border border-border bg-card rounded-2xl shadow-sm hover:shadow-md transition-all">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-primary/10 text-primary rounded-xl border border-primary/20">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Calls Completed</p>
                    <p className="text-2xl font-black text-foreground">{stats.completedCalls}</p>
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
                    <p className="text-2xl font-black text-foreground">{stats.callbackCalls}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border bg-card rounded-2xl shadow-sm hover:shadow-md transition-all">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl border border-indigo-500/20">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Deferred / Retries</p>
                    <p className="text-2xl font-black text-foreground">{stats.deferredCalls}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Campaigns View */}
          <TabsContent value="campaigns" className="mt-0 space-y-6 outline-none">
            {campaignsLoading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="h-6 w-6 text-primary animate-spin" />
              </div>
            ) : campaigns.length === 0 ? (
              <Card className="border border-dashed border-border/70 p-12 text-center rounded-2xl bg-muted/10">
                <div className="max-w-md mx-auto space-y-4">
                  <PhoneOff className="h-10 w-10 text-muted-foreground mx-auto" />
                  <h3 className="text-sm font-bold text-foreground">No call campaigns found</h3>
                  <p className="text-xs text-muted-foreground">
                    Organize your outreach workflow, assign target scripts, and process customer segments.
                  </p>
                  <Button onClick={() => router.push(wrapHref('/admin/messaging/call-centre/campaigns/new'))} className="rounded-xl font-bold text-xs">
                    Create Campaign
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {campaigns.map((camp) => {
                  const progressVal = camp.progress?.total 
                    ? Math.round((camp.progress.completed / camp.progress.total) * 100)
                    : 0;

                  return (
                    <div 
                      key={camp.id} 
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-card border border-border rounded-xl hover:border-primary/30 hover:shadow-sm transition-all gap-4"
                    >
                      {/* Left Section: Icon & Info */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
                          <PhoneCall className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-foreground truncate">{camp.name}</h4>
                            {getStatusBadge(camp.status)}
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5 max-w-sm sm:max-w-md">
                            {camp.description || 'Calling campaign.'}
                          </p>
                        </div>
                      </div>

                      {/* Middle Section: Progress & Stats */}
                      <div className="flex items-center gap-6 shrink-0 flex-wrap sm:flex-nowrap">
                        <div className="w-40 space-y-1">
                          <div className="flex justify-between text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                            <span>Progress</span>
                            <span>{progressVal}% ({camp.progress?.completed}/{camp.progress?.total})</span>
                          </div>
                          <Progress value={progressVal} className="h-1.5 bg-muted" />
                        </div>

                        <div className="flex gap-4 text-center">
                          <div>
                            <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest block">Pending</span>
                            <span className="text-xs font-black text-foreground">{camp.progress?.pending}</span>
                          </div>
                          <div className="border-l border-border pl-4">
                            <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest block">Callbacks</span>
                            <span className="text-xs font-black text-amber-500">{camp.progress?.callbacks}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Section: Actions */}
                      <div className="flex items-center gap-2 shrink-0 justify-end">
                        <Button 
                          onClick={() => handleDeleteCampaign(camp.id)}
                          variant="ghost" 
                          size="icon" 
                          className="text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg h-8 w-8 border border-border"
                          aria-label="Delete campaign"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>

                        {camp.status !== 'draft' && (
                          <Button 
                            onClick={() => router.push(wrapHref(`/admin/messaging/call-centre/analytics/${camp.id}`))}
                            variant="ghost" 
                            size="icon" 
                            className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg h-8 w-8 border border-border"
                            title="View Outcome Analytics"
                            aria-label="View outcome analytics"
                          >
                            <BarChart3 className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        {camp.status === 'draft' ? (
                          <div className="flex items-center gap-1.5">
                            <Button 
                              onClick={() => router.push(wrapHref(`/admin/messaging/call-centre/campaigns/new?id=${camp.id}`))}
                              variant="outline" 
                              className="h-8 px-3 rounded-lg text-[10px] uppercase font-bold tracking-wider border-border bg-muted hover:bg-accent text-muted-foreground gap-1"
                            >
                              <Edit3 className="h-3.5 w-3.5" /> Edit
                            </Button>
                            <Button 
                              onClick={() => handleLaunchConfirm(camp)}
                              disabled={launchingCampaignId === camp.id}
                              className="h-8 px-3 rounded-lg text-[10px] uppercase font-bold tracking-wider gap-1"
                            >
                              {launchingCampaignId === camp.id ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Play className="h-3.5 w-3.5 fill-current" />
                              )}
                              Launch
                            </Button>
                          </div>
                        ) : (
                          <Button 
                            onClick={() => router.push(wrapHref(`/admin/messaging/call-centre/workspace/${camp.id}`))}
                            className="h-8 px-4 rounded-lg text-[10px] uppercase font-bold tracking-wider gap-1.5"
                            disabled={camp.status === 'completed' || camp.status === 'cancelled'}
                          >
                            <Play className="h-3 w-3 fill-current" /> Open
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Scripts View */}
          <TabsContent value="scripts" className="mt-0 space-y-6 outline-none">
            {scriptsLoading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="h-6 w-6 text-primary animate-spin" />
              </div>
            ) : scripts.length === 0 ? (
              <Card className="border border-dashed border-border/70 p-12 text-center rounded-2xl bg-muted/10">
                <div className="max-w-md mx-auto space-y-4">
                  <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
                  <h3 className="text-sm font-bold text-foreground">No call scripts defined</h3>
                  <p className="text-xs text-muted-foreground">
                    Scripts serve as dynamic templates. Set placeholder tokens like `FIRST_NAME` and `SCHOOL_NAME` to assist callers.
                  </p>
                  <Button onClick={() => router.push(wrapHref('/admin/messaging/call-centre/scripts/new'))} className="rounded-xl font-bold text-xs">
                    Create Script
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {scripts.map((script) => (
                  <Card key={script.id} className="group relative border border-border transition-all duration-500 rounded-2xl overflow-hidden bg-card shadow-sm hover:shadow-xl flex flex-col h-[420px]">
                    {/* Top Bar: Actions */}
                    <div className="h-12 shrink-0 border-b border-border flex items-center justify-between px-4 bg-muted/30 transition-colors duration-500">
                      <div className="flex items-center gap-1.5">
                        <div className="p-1.5 rounded-lg border border-primary/20 bg-primary/10 text-primary">
                          <FileText className="h-3 w-3" />
                        </div>
                        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Outbound Call Script</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
                          onClick={() => setPreviewScript(script)}
                          title="Preview Script"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-lg text-emerald-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                          onClick={() => router.push(wrapHref(`/admin/messaging/call-centre/campaigns/new?scriptId=${script.id}`))}
                          title="Use Script to Create Campaign"
                        >
                          <Play className="h-4 w-4 fill-current" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
                          onClick={() => router.push(wrapHref(`/admin/messaging/call-centre/scripts/new?id=${script.id}`))}
                          title="Edit Script"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-rose-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg"
                          onClick={() => handleDeleteScript(script.id)}
                          title="Delete Script"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Middle: Dialogue Simulator Panel */}
                    <div className="flex-1 overflow-hidden relative bg-muted/20 flex flex-col items-center justify-center p-4">
                      <div className="w-full h-full bg-muted/40 rounded-xl p-4 flex flex-col justify-between gap-4 relative overflow-hidden group-hover:scale-[1.02] transition-transform duration-500 border border-border shadow-inner">
                        <div className="absolute -right-4 -top-4 opacity-5 rotate-12 text-primary">
                          <PhoneCall size={120} />
                        </div>
                        <div className="p-4 bg-background border border-border rounded-2xl shadow-sm backdrop-blur-sm flex-1 overflow-y-auto max-h-[160px] custom-scrollbar">
                          <p className="text-[9px] font-bold text-foreground/80 leading-relaxed italic font-serif">
                            &ldquo;{extractPreviewText(script.content) || 'Start editing this script...'}&rdquo;
                          </p>
                        </div>
                        <div className="flex items-center justify-between opacity-40 border-t border-border pt-2 shrink-0">
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-primary" />
                            <span className="text-[7px] font-semibold text-foreground/70">Outbound Dial Preview</span>
                          </div>
                          <span className="text-[7px] font-semibold text-muted-foreground">Duration Est. ~2m</span>
                        </div>
                      </div>
                      <div className="absolute inset-0 bg-transparent z-10" />
                    </div>

                    {/* Bottom: Info Card */}
                    <CardHeader className="p-5 shrink-0 bg-card border-t border-border">
                      <div className="min-w-0">
                        <CardTitle className="text-sm font-semibold truncate text-card-foreground group-hover:text-primary transition-colors leading-tight tracking-tight">
                          {script.name}
                        </CardTitle>
                        <p className="text-[9px] font-medium text-muted-foreground truncate mt-1">
                          {script.description || 'Call outreach script template.'}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-3 max-h-[48px] overflow-hidden">
                          {script.variables.map(v => (
                            <Badge key={v} variant="outline" className="text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-muted border-border text-muted-foreground">
                              {v}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PageContainer>

      {/* Script Deletion Confirmation Dialog */}
      <AlertDialog open={!!scriptToDelete} onOpenChange={(o) => !o && setScriptToDelete(null)}>
        <AlertDialogContent className="rounded-2xl max-w-md p-6 bg-card border border-border text-foreground">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="font-bold text-base text-foreground">Delete Call Script</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to delete this script? This action cannot be undone and will permanently remove this script definition.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex justify-end gap-3">
            <AlertDialogCancel className="rounded-xl border border-border bg-muted text-muted-foreground hover:text-foreground hover:bg-accent text-xs font-bold px-4 py-2">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (scriptToDelete) {
                  performDeleteScript(scriptToDelete);
                }
              }}
              className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-4 py-2 border-none"
            >
              Delete Script
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Campaign Deletion Confirmation Dialog */}
      <AlertDialog open={!!campaignToDelete} onOpenChange={(o) => !o && setCampaignToDelete(null)}>
        <AlertDialogContent className="rounded-2xl max-w-md p-6 bg-card border border-border text-foreground">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="font-bold text-base text-foreground">Delete Call Campaign</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to delete this campaign and all its call queue items? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex justify-end gap-3">
            <AlertDialogCancel className="rounded-xl border border-border bg-muted text-muted-foreground hover:text-foreground hover:bg-accent text-xs font-bold px-4 py-2">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (campaignToDelete) {
                  performDeleteCampaign(campaignToDelete);
                }
              }}
              className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-4 py-2 border-none"
            >
              Delete Campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Launch Confirmation Dialog */}
      <AlertDialog open={!!campaignToLaunch} onOpenChange={(open) => !open && setCampaignToLaunch(null)}>
        <AlertDialogContent className="rounded-2xl max-w-md p-6 bg-card border border-border text-foreground">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="font-bold text-base text-foreground">Launch Call Campaign?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              This will resolve your target audience, lock in the selected script snapshot, and generate a new dialer queue. Unused callbacks from previous runs of the same campaign will be cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex justify-end gap-3">
            <AlertDialogCancel className="rounded-xl border border-border bg-muted text-muted-foreground hover:text-foreground hover:bg-accent text-xs font-bold px-4 py-2">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (campaignToLaunch) {
                  performLaunchCampaign(campaignToLaunch);
                }
              }}
              className="rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold px-4 py-2 border-none"
            >
              Launch Campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Script Preview Dialog */}
      <Dialog open={!!previewScript} onOpenChange={(open) => !open && setPreviewScript(null)}>
        <DialogContent className="rounded-2xl max-w-4xl max-h-[85vh] p-6 bg-card border border-border text-foreground flex flex-col overflow-hidden shadow-2xl">
          <DialogHeader className="space-y-1.5 shrink-0">
            <DialogTitle className="font-bold text-base text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {previewScript?.name || 'Script Preview'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              {previewScript?.description || 'Outbound call outreach conversation layout.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-[300px] mt-4 pr-1 scrollbar-thin">
            {previewScript && (
              isJsonGraph(previewScript.content) ? (
                <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                  <ScriptPlaybookView graph={parseGraph(previewScript.content)} />
                </div>
              ) : (
                <div className="bg-muted/30 p-5 rounded-xl border border-border/50 text-sm font-serif whitespace-pre-line leading-relaxed select-text">
                  {previewScript.content}
                </div>
              )
            )}
          </div>
          <div className="mt-6 flex justify-end gap-3 shrink-0 border-t border-border pt-4">
            <Button
              variant="outline"
              onClick={() => setPreviewScript(null)}
              className="rounded-xl border border-border bg-muted text-muted-foreground hover:text-foreground hover:bg-accent text-xs font-bold px-4 h-9"
            >
              Close
            </Button>
            {previewScript && (
              <Button
                onClick={() => {
                  router.push(wrapHref(`/admin/messaging/call-centre/campaigns/new?scriptId=${previewScript.id}`));
                  setPreviewScript(null);
                }}
                className="rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold px-4 h-9 gap-1.5"
              >
                <Play className="h-3 w-3 fill-current" />
                Use Script
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
