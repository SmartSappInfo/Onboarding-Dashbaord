'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { useCallCampaigns } from '@/lib/call-centre-hooks';
import { enqueueAndLockSingleCallAction, executeScriptActionAction, submitCallOutcomeAction, releaseSingleCallAction } from '@/lib/call-centre-actions';
import { getVariableValuesMapAction } from '@/lib/services/fields-variables-service';
import { resolveTextWithMap } from '@/lib/utils/variable-replacer';
import { useToast } from '@/hooks/use-toast';
import type { CallContextParams } from '@/context/CallModalContext';
import type { CallQueueItem, CallCampaign, ScriptNode, BranchingScriptGraph } from '@/lib/types';
import { Loader2, Phone, Play, X, ArrowLeft } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

const InteractiveScriptView = dynamic(
  () => import('@/app/admin/messaging/call-centre/scripts/components/InteractiveScriptView').then(m => m.InteractiveScriptView),
  { ssr: false, loading: () => <div className="p-8 text-center flex flex-col items-center justify-center text-sm text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mb-4" />Loading Script Interface...</div> }
);

interface CallNowModalProps {
  isOpen: boolean;
  onClose: () => void;
  params: CallContextParams;
}

export function CallNowModal({ isOpen, onClose, params }: CallNowModalProps) {
  const { activeWorkspaceId: workspaceId, activeOrganizationId: organizationId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [step, setStep] = useState<'select' | 'calling'>('select');
  const [selectedCampaign, setSelectedCampaign] = useState<CallCampaign | null>(null);
  const [queueItem, setQueueItem] = useState<CallQueueItem | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  
  // Script state
  const [scriptGraph, setScriptGraph] = useState<BranchingScriptGraph | null>(null);
  const [variablesMap, setVariablesMap] = useState<Map<string, unknown>>(new Map());
  const [triggeredNodeIds, setTriggeredNodeIds] = useState<Set<string>>(new Set());
  
  const { campaigns, isLoading: loadingCampaigns } = useCallCampaigns(workspaceId);
  const activeCampaigns = campaigns.filter(c => c.status === 'running' && c.allowDirectCalling !== false);

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
          email: params.email
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
          graph = JSON.parse(campaign.scriptSnapshot);
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
        extraVars: params.dealId ? { deal_id: params.dealId, dealId: params.dealId } : undefined
      });
      if (varRes) {
        setVariablesMap(new Map(Object.entries(varRes)));
      }
      
      setQueueItem(res.queueItem);
      setSelectedCampaign(campaign);
      setStep('calling');
      setCallStartTime(Date.now());
      setTriggeredNodeIds(new Set());
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Error', description: errorMsg });
    } finally {
      setIsInitializing(false);
    }
  };

  const handleTriggerAction = async (node: ScriptNode): Promise<{ ok: boolean; error?: string; meetingId?: string }> => {
    if (!queueItem || !user) return { ok: false, error: 'Call not active' };
    const hasMeetingUpdate = Boolean(node.data?.actionConfig?.createdMeetingId || (node.data?.actionType === 'SCHEDULE_MEETING' && node.data?.actionConfig?.meetingTimeOverride));
    if (triggeredNodeIds.has(node.id) && !hasMeetingUpdate) return { ok: true };

    const result = await executeScriptActionAction({
      actionType: node.data?.actionType || 'SEND_SMS',
      actionConfig: JSON.parse(JSON.stringify(node.data?.actionConfig || {})),
      entityId: queueItem.entityId,
      workspaceId,
      organizationId: queueItem.organizationId || organizationId,
      contactId: queueItem.contactId,
    }, user.uid);

    if (result.success) {
      setTriggeredNodeIds(prev => new Set(prev).add(node.id));
      toast({ title: 'Action Triggered', description: `"${node.data?.label || 'Action'}" ran successfully.` });
      return { ok: true, meetingId: result.meetingId };
    } else {
      toast({ variant: 'destructive', title: 'Action Failed', description: result.error || 'Action failed' });
      return { ok: false, error: result.error || 'Action failed' };
    }
  };

  const handleTriggerOutcome = async (node: ScriptNode): Promise<{ ok: boolean; error?: string }> => {
    const outcome = node.data?.outcomeValue || 'Interested';
    const runAutomations = true;
    const duration = callStartTime ? Math.round((Date.now() - callStartTime) / 1000) : 0;
    if (!queueItem || !user || !selectedCampaign) return { ok: false, error: 'Not initialized' };
    
    try {
      // Prioritize visual script node-level automations, falling back to legacy campaign rules
      const nodeAutomations = node.data?.outcomeConfig?.automations;
      const campaignAutomations = selectedCampaign.automationRules?.[outcome];
      const autosToRun = (runAutomations && nodeAutomations && nodeAutomations.length > 0)
        ? nodeAutomations
        : (runAutomations ? campaignAutomations : undefined);
      
      const result = await submitCallOutcomeAction({
        queueItemId: queueItem.id,
        outcome,
        notes: '',
        duration,
        agentName: user.displayName || 'Agent',
        workspaceId,
        userId: user.uid,
        customAutomations: autosToRun
      });
      
      if (result.success) {
        toast({ title: 'Call Completed', description: `Outcome "${outcome}" logged successfully.` });
        onClose();
        return { ok: true };
      } else {
        toast({ variant: 'destructive', title: 'Failed to log outcome', description: result.error });
        return { ok: false, error: result.error };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Error', description: errorMsg });
      return { ok: false, error: errorMsg };
    }
  };

  const handleEndCall = () => {
    toast({ title: 'Call Finished', description: 'Please select an outcome to save and finalize this call.' });
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
  };

  const handleClose = () => {
    if (step === 'calling' && queueItem?.id && workspaceId && user?.uid) {
      void releaseSingleCallAction(queueItem.id, workspaceId, user.uid);
    }
    onClose();
  };

  const resolveLiveText = (text: string) => resolveTextWithMap(text, variablesMap);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl p-0 h-[100dvh] sm:h-[85vh] sm:rounded-2xl overflow-hidden flex flex-col border-none shadow-2xl gap-0">
        <DialogHeader className="px-6 py-4 border-b bg-background z-10 shrink-0 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            {step === 'calling' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToSelect}
                className="h-8 px-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                title="Back to Campaign Selection"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline font-medium">Back</span>
              </Button>
            )}
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-indigo-500" />
                {step === 'select' ? 'Select Call Campaign' : `Calling ${queueItem?.contactName || queueItem?.entityName}`}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {step === 'select' ? 'Choose a published campaign to run this script against.' : 'Interactive script view'}
              </DialogDescription>
            </div>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="flex-1 min-h-0 relative bg-muted/20">
          <AnimatePresence mode="wait">
            {step === 'select' && (
              <motion.div 
                key="select"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute inset-0 p-6 flex flex-col"
              >
                {loadingCampaigns ? (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading campaigns...
                  </div>
                ) : activeCampaigns.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-card rounded-xl border border-dashed">
                    <Phone className="h-10 w-10 text-muted-foreground/30 mb-4" />
                    <h3 className="font-semibold text-lg">No Active Campaigns</h3>
                    <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                      There are no published call campaigns in this workspace. Create and publish a campaign first.
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="flex-1 pr-4 -mr-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {activeCampaigns.map(camp => (
                        <button
                          key={camp.id}
                          onClick={() => startCall(camp)}
                          disabled={isInitializing}
                          className={cn(
                            "group text-left p-4 rounded-xl border bg-card transition-all hover:border-indigo-500/50 hover:shadow-md",
                            isInitializing && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-bold text-sm truncate pr-2">{camp.name}</h4>
                            <div className="bg-indigo-500/10 text-indigo-600 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Play className="h-3.5 w-3.5" />
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">
                            {camp.description || 'No description provided.'}
                          </p>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </motion.div>
            )}

            {step === 'calling' && scriptGraph && (
              <motion.div
                key="calling"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="absolute inset-0 flex flex-col"
              >
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-background">
                  <InteractiveScriptView
                    nodes={scriptGraph.nodes}
                    edges={scriptGraph.edges}
                    resolveText={resolveLiveText}
                    onTriggerAction={handleTriggerAction}
                    onTriggerOutcome={handleTriggerOutcome}
                    triggeredIds={triggeredNodeIds}
                    onEndCall={handleEndCall}
                    currentContact={queueItem ? {
                      id: queueItem.contactId || queueItem.entityId,
                      name: queueItem.contactName || queueItem.entityName,
                      phone: queueItem.entityPhone,
                      email: queueItem.entityEmail,
                    } : null}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
