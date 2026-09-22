'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { useCallCampaigns } from '@/lib/call-centre-hooks';
import {
  enqueueAndLockSingleCallAction,
  executeScriptActionAction,
  submitCallOutcomeAction,
  releaseSingleCallAction,
} from '@/lib/call-centre-actions';
import { getVariableValuesMapAction } from '@/lib/services/fields-variables-service';
import { resolveTextWithMap } from '@/lib/utils/variable-replacer';
import { useToast } from '@/hooks/use-toast';
import type { CallContextParams } from '@/context/CallModalContext';
import type { CallQueueItem, CallCampaign, ScriptNode, BranchingScriptGraph } from '@/lib/types';
import {
  Loader2,
  Phone,
  PhoneOff,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { ScriptThumbnailCard } from '@/components/call-centre/ScriptThumbnailCard';

const InteractiveScriptView = dynamic(
  () =>
    import('@/app/admin/messaging/call-centre/scripts/components/InteractiveScriptView').then(
      (m) => m.InteractiveScriptView
    ),
  {
    ssr: false,
    loading: () => (
      <div className="p-8 text-center flex flex-col items-center justify-center text-sm text-muted-foreground flex-1 min-h-[300px]">
        <Loader2 className="h-6 w-6 animate-spin mb-4 text-primary" />
        Loading Interactive Prompter...
      </div>
    ),
  }
);

interface CallNowModalProps {
  isOpen: boolean;
  onClose: () => void;
  params: CallContextParams;
}

const DEFAULT_CALL_OUTCOMES = [
  'Interested',
  'Meeting Scheduled',
  'Follow-up Needed',
  'Not Interested',
  'No Answer',
  'Busy',
  'Invalid Contact',
];

export function CallNowModal({ isOpen, onClose, params }: CallNowModalProps) {
  const { activeWorkspaceId: workspaceId, activeOrganizationId: organizationId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const [step, setStep] = useState<'select' | 'calling'>('select');
  const [selectedCampaign, setSelectedCampaign] = useState<CallCampaign | null>(null);
  const [queueItem, setQueueItem] = useState<CallQueueItem | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Wrap-up / Outcome state
  const [isEndingCall, setIsEndingCall] = useState(false);
  const [isSubmittingOutcome, setIsSubmittingOutcome] = useState(false);

  // Script state
  const [scriptGraph, setScriptGraph] = useState<BranchingScriptGraph | null>(null);
  const [variablesMap, setVariablesMap] = useState<Map<string, unknown>>(new Map());
  const [triggeredNodeIds, setTriggeredNodeIds] = useState<Set<string>>(new Set());

  // Ref to guarantee call queue unlock on unmount or unexpected dismissal
  const activeCallRef = useRef<{ queueItemId?: string; workspaceId?: string; userId?: string } | null>(null);

  const { campaigns, isLoading: loadingCampaigns } = useCallCampaigns(workspaceId);
  const activeCampaigns = useMemo(
    () => campaigns.filter((c) => c.status === 'running' && c.allowDirectCalling !== false),
    [campaigns]
  );

  // Synchronize active call lock ref for unmount cleanup
  useEffect(() => {
    if (step === 'calling' && queueItem?.id && workspaceId && user?.uid) {
      activeCallRef.current = { queueItemId: queueItem.id, workspaceId, userId: user.uid };
    } else {
      activeCallRef.current = null;
    }
  }, [step, queueItem?.id, workspaceId, user?.uid]);

  // Clean up lock if user closes tab or route changes mid-call
  useEffect(() => {
    return () => {
      if (activeCallRef.current?.queueItemId && activeCallRef.current.workspaceId && activeCallRef.current.userId) {
        void releaseSingleCallAction(
          activeCallRef.current.queueItemId,
          activeCallRef.current.workspaceId,
          activeCallRef.current.userId
        );
      }
    };
  }, []);

  // Live timer tick
  useEffect(() => {
    if (step !== 'calling' || !callStartTime) {
      setElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - callStartTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [step, callStartTime]);

  const formatDuration = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startCall = async (campaign: CallCampaign) => {
    if (!user) return;
    setIsInitializing(true);
    try {
      const res = await enqueueAndLockSingleCallAction(
        campaign.id,
        params.entityId,
        workspaceId,
        user.uid,
        {
          contactId: params.contactId,
          contactName: params.contactName,
          phone: params.phone,
          email: params.email,
        },
        params.dealId
      );

      if (!res.success || !res.queueItem) {
        throw new Error(res.error || 'Failed to start call');
      }

      // Parse graph
      let graph: BranchingScriptGraph = { nodes: [], edges: [] };
      try {
        if (campaign.scriptSnapshot) {
          graph = JSON.parse(campaign.scriptSnapshot) as BranchingScriptGraph;
        }
      } catch (e) {
        console.error('Failed to parse script snapshot', e);
      }
      setScriptGraph(graph);

      // Fetch dynamic variables context for this entity/deal
      const varRes = await getVariableValuesMapAction({
        workspaceId,
        entityId: params.entityId,
        recipientContact: res.queueItem.contactId,
        extraVars: params.dealId ? { deal_id: params.dealId, dealId: params.dealId } : undefined,
      });
      if (varRes) {
        setVariablesMap(new Map(Object.entries(varRes)));
      }

      setQueueItem(res.queueItem);
      setSelectedCampaign(campaign);
      setStep('calling');
      setCallStartTime(Date.now());
      setTriggeredNodeIds(new Set());
      setIsEndingCall(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Error', description: errorMsg });
    } finally {
      setIsInitializing(false);
    }
  };

  const handleTriggerAction = async (node: ScriptNode): Promise<{ ok: boolean; error?: string; meetingId?: string }> => {
    if (!queueItem || !user) return { ok: false, error: 'Call not active' };
    const hasMeetingUpdate = Boolean(
      node.data?.actionConfig?.createdMeetingId ||
        (node.data?.actionType === 'SCHEDULE_MEETING' && node.data?.actionConfig?.meetingTimeOverride)
    );
    if (triggeredNodeIds.has(node.id) && !hasMeetingUpdate) return { ok: true };

    const result = await executeScriptActionAction(
      {
        actionType: node.data?.actionType || 'SEND_SMS',
        actionConfig: JSON.parse(JSON.stringify(node.data?.actionConfig || {})),
        entityId: queueItem.entityId,
        workspaceId,
        organizationId: queueItem.organizationId || organizationId,
        contactId: queueItem.contactId,
      },
      user.uid
    );

    if (result.success) {
      setTriggeredNodeIds((prev) => new Set(prev).add(node.id));
      toast({ title: 'Action Triggered', description: `"${node.data?.label || 'Action'}" ran successfully.` });
      return { ok: true, meetingId: result.meetingId };
    } else {
      toast({ variant: 'destructive', title: 'Action Failed', description: result.error || 'Action failed' });
      return { ok: false, error: result.error || 'Action failed' };
    }
  };

  const submitOutcomeDirectly = async (outcome: string) => {
    if (!queueItem || !user || !selectedCampaign || isSubmittingOutcome) return;
    setIsSubmittingOutcome(true);
    const duration = callStartTime ? Math.round((Date.now() - callStartTime) / 1000) : 0;

    try {
      const campaignAutomations = selectedCampaign.automationRules?.[outcome];
      const matchingNode = scriptGraph?.nodes.find(
        (n) => n.type === 'outcome' && (n.data?.outcomeValue === outcome || n.data?.label === outcome)
      );
      const nodeAutomations = matchingNode?.data?.outcomeConfig?.automations;
      const autosToRun = nodeAutomations && nodeAutomations.length > 0 ? nodeAutomations : campaignAutomations;

      const result = await submitCallOutcomeAction({
        queueItemId: queueItem.id,
        outcome,
        notes: '',
        duration,
        agentName: user.displayName || 'Agent',
        workspaceId,
        userId: user.uid,
        customAutomations: autosToRun,
      });

      if (result.success) {
        toast({ title: 'Call Completed', description: `Outcome "${outcome}" logged successfully.` });
        activeCallRef.current = null;
        onClose();
      } else {
        toast({ variant: 'destructive', title: 'Failed to log outcome', description: result.error });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Error', description: errorMsg });
    } finally {
      setIsSubmittingOutcome(false);
      setIsEndingCall(false);
    }
  };

  const handleTriggerOutcome = async (node: ScriptNode): Promise<{ ok: boolean; error?: string }> => {
    const outcome = node.data?.outcomeValue || node.data?.label || 'Interested';
    await submitOutcomeDirectly(outcome);
    return { ok: true };
  };

  const handleEndCall = () => {
    setIsEndingCall(true);
  };

  const handleBackToSelect = () => {
    if (queueItem?.id && workspaceId && user?.uid) {
      void releaseSingleCallAction(queueItem.id, workspaceId, user.uid);
    }
    setQueueItem(null);
    setSelectedCampaign(null);
    setStep('select');
    setCallStartTime(null);
    setTriggeredNodeIds(new Set());
    setIsEndingCall(false);
  };

  const handleClose = () => {
    if (step === 'calling' && queueItem?.id && workspaceId && user?.uid) {
      void releaseSingleCallAction(queueItem.id, workspaceId, user.uid);
      activeCallRef.current = null;
    }
    onClose();
  };

  const handleReleaseWithoutOutcome = async () => {
    if (queueItem?.id && workspaceId && user?.uid) {
      setIsSubmittingOutcome(true);
      try {
        await releaseSingleCallAction(queueItem.id, workspaceId, user.uid);
        activeCallRef.current = null;
        toast({ title: 'Call Released', description: 'Contact unlocked and returned to queue.' });
        onClose();
      } finally {
        setIsSubmittingOutcome(false);
      }
    } else {
      onClose();
    }
  };

  const resolveLiveText = (text: string) => resolveTextWithMap(text, variablesMap);

  // Available outcome options for rapid wrap-up
  const availableOutcomes = useMemo(() => {
    if (selectedCampaign?.outcomes && selectedCampaign.outcomes.length > 0) {
      return selectedCampaign.outcomes;
    }
    const graphOutcomes = scriptGraph?.nodes
      .filter((n) => n.type === 'outcome')
      .map((n) => n.data?.outcomeValue || n.data?.label || '')
      .filter(Boolean);
    if (graphOutcomes && graphOutcomes.length > 0) {
      return Array.from(new Set(graphOutcomes));
    }
    return DEFAULT_CALL_OUTCOMES;
  }, [selectedCampaign, scriptGraph]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className={cn(
          'p-0 overflow-hidden flex flex-col border border-border/80 shadow-2xl gap-0 transition-all duration-300 font-figtree',
          step === 'select'
            ? 'w-full max-w-5xl h-[92dvh] sm:h-[85vh] sm:rounded-3xl'
            : 'w-full max-w-[98vw] h-[98dvh] sm:h-[96vh] sm:rounded-2xl'
        )}
      >
        {/* Header - Single authoritative close button is automatically provided by DialogContent at top-4 right-4 */}
        <DialogHeader className="px-4 sm:px-6 py-3.5 pr-14 border-b bg-background/95 backdrop-blur-sm z-10 shrink-0 flex flex-row items-center justify-between min-h-[64px]">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {step === 'calling' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToSelect}
                className="h-8 px-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer shrink-0 active:scale-[0.97]"
                title="Back to Script Selection"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline font-medium">Back</span>
              </Button>
            )}

            <div className="min-w-0 flex-1">
              {step === 'select' ? (
                <div>
                  <DialogTitle className="flex items-center gap-2 text-base font-bold">
                    <Phone className="h-5 w-5 text-indigo-500 shrink-0" />
                    <span>Choose Call Script</span>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                    Pick a script to launch the outbound prompter with {params.contactName || 'contact'}.
                  </DialogDescription>
                </div>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 shrink-0">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-sm sm:text-base font-bold truncate leading-tight">
                      Calling {queueItem?.contactName || queueItem?.entityName || params.contactName || 'Contact'}
                    </DialogTitle>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5 truncate">
                      {params.phone && <span className="font-mono">{params.phone}</span>}
                      {selectedCampaign && (
                        <Badge variant="outline" className="text-[8px] font-bold px-1.5 py-0 rounded bg-muted/60">
                          {selectedCampaign.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right side of header when calling: Timer & End Call Button */}
          {step === 'calling' && (
            <div className="flex items-center gap-2 sm:gap-3 shrink-0 mr-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-bold shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{formatDuration(elapsedSeconds)}</span>
              </div>

              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsEndingCall(true)}
                className="h-8 sm:h-9 px-3 sm:px-4 font-bold text-xs gap-1.5 active:scale-[0.97] shadow-sm shrink-0"
              >
                <PhoneOff className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">End Call</span>
              </Button>
            </div>
          )}
        </DialogHeader>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 relative bg-muted/10 overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">
            {step === 'select' && (
              <motion.div
                key="select"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 p-4 sm:p-6 flex flex-col overflow-hidden"
              >
                {loadingCampaigns ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    <span className="text-xs font-medium">Loading call campaigns...</span>
                  </div>
                ) : activeCampaigns.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-card rounded-2xl border border-dashed max-w-md mx-auto my-auto space-y-3">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                      <Phone className="h-6 w-6" />
                    </div>
                    <h3 className="font-bold text-base">No Active Call Campaigns</h3>
                    <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                      There are no published call campaigns in this workspace. Create and publish a campaign from the Call Centre to enable direct dialing.
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="flex-1 pr-3 -mr-3">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 p-1">
                      {activeCampaigns.map((camp) => (
                        <ScriptThumbnailCard
                          key={camp.id}
                          mode="selector"
                          campaign={camp}
                          onSelect={() => startCall(camp)}
                          disabled={isInitializing}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </motion.div>
            )}

            {step === 'calling' && scriptGraph && (
              <motion.div
                key="calling"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex flex-col p-2 sm:p-4 bg-background"
              >
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <InteractiveScriptView
                    nodes={scriptGraph.nodes}
                    edges={scriptGraph.edges}
                    resolveText={resolveLiveText}
                    onTriggerAction={handleTriggerAction}
                    onTriggerOutcome={handleTriggerOutcome}
                    triggeredIds={triggeredNodeIds}
                    onEndCall={handleEndCall}
                    className="h-full min-h-0"
                    currentContact={
                      queueItem
                        ? {
                            id: queueItem.contactId || queueItem.entityId,
                            name: queueItem.contactName || queueItem.entityName,
                            phone: queueItem.entityPhone,
                            email: queueItem.entityEmail,
                          }
                        : null
                    }
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Call Outcome Wrap-Up Modal Overlay */}
          <AnimatePresence>
            {isEndingCall && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full p-5 sm:p-6 flex flex-col gap-4 text-foreground"
                >
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center">
                        <PhoneOff className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm sm:text-base leading-tight">Log Call Outcome</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Duration: <span className="font-mono font-semibold">{formatDuration(elapsedSeconds)}</span>
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] uppercase font-bold px-2 py-0.5">
                      Call Completed
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Select an outcome to finalize this call record and trigger configured workflows.
                  </p>

                  {/* Outcome Buttons Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1">
                    {availableOutcomes.map((outcomeName) => (
                      <Button
                        key={outcomeName}
                        variant="outline"
                        disabled={isSubmittingOutcome}
                        onClick={() => submitOutcomeDirectly(outcomeName)}
                        className="h-11 px-3 justify-start text-xs font-bold gap-2 rounded-xl border-border/80 hover:border-primary/50 hover:bg-primary/5 active:scale-[0.97] transition-all min-h-[44px]"
                      >
                        {isSubmittingOutcome ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        )}
                        <span className="truncate">{outcomeName}</span>
                      </Button>
                    ))}
                  </div>

                  {/* Secondary Actions */}
                  <div className="flex items-center justify-between border-t border-border pt-3 gap-2 mt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isSubmittingOutcome}
                      onClick={handleReleaseWithoutOutcome}
                      className="text-[11px] text-muted-foreground hover:text-foreground h-9 px-3 rounded-lg"
                      title="Release contact back to queue without saving an outcome"
                    >
                      Release Without Outcome
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSubmittingOutcome}
                      onClick={() => setIsEndingCall(false)}
                      className="text-[11px] font-bold h-9 px-4 rounded-lg"
                    >
                      Resume Call
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
