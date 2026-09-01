'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { useCallCampaigns } from '@/lib/call-centre-hooks';
import { enqueueAndLockSingleCallAction, executeScriptActionAction, submitCallOutcomeAction } from '@/lib/call-centre-actions';
import { getVariableValuesMapAction } from '@/lib/services/fields-variables-service';
import { resolveTextWithMap } from '@/lib/utils/variable-replacer';
import { useToast } from '@/hooks/use-toast';
import type { CallContextParams } from '@/context/CallModalContext';
import type { CallQueueItem, CallCampaign, ScriptNode, ScriptEdge, BranchingScriptGraph } from '@/lib/types';
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
  
  // Script state
  const [scriptGraph, setScriptGraph] = useState<BranchingScriptGraph | null>(null);
  const [variablesMap, setVariablesMap] = useState<Map<string, unknown>>(new Map());
  const triggeredNodeIds = useRef<Set<string>>(new Set());
  
  const { campaigns, isLoading: loadingCampaigns } = useCallCampaigns(workspaceId);
  const activeCampaigns = campaigns.filter(c => c.status === 'running');

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
        }
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
        entityId: params.entityId
      });
      if (varRes) {
        setVariablesMap(new Map(Object.entries(varRes)));
      }
      
      setQueueItem(res.queueItem);
      setSelectedCampaign(campaign);
      setStep('calling');
      triggeredNodeIds.current.clear();
      
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsInitializing(false);
    }
  };

  const handleTriggerAction = async (node: ScriptNode): Promise<{ ok: boolean; error?: string; meetingId?: string }> => {
    if (!queueItem || !user) return { ok: false, error: 'Call not active' };
    const hasMeetingUpdate = Boolean(node.data?.actionConfig?.createdMeetingId || (node.data?.actionType === 'SCHEDULE_MEETING' && node.data?.actionConfig?.meetingTimeOverride));
    if (triggeredNodeIds.current.has(node.id) && !hasMeetingUpdate) return { ok: true };

    const result = await executeScriptActionAction({
      actionType: node.data?.actionType || 'SEND_SMS',
      actionConfig: JSON.parse(JSON.stringify(node.data?.actionConfig || {})),
      entityId: queueItem.entityId,
      workspaceId,
      organizationId,
      contactId: queueItem.contactId,
    }, user.uid);

    if (result.success) {
      triggeredNodeIds.current.add(node.id);
      return { ok: true, meetingId: result.meetingId };
    } else {
      return { ok: false, error: result.error || 'Action failed' };
    }
  };

  const handleTriggerOutcome = async (node: ScriptNode): Promise<{ ok: boolean; error?: string }> => {
    const outcome = node.data?.outcomeValue || 'Interested';
    const runAutomations = true;
    const payload = {} as any;
    if (!queueItem || !user || !selectedCampaign) return { ok: false, error: 'Not initialized' };
    
    try {
      let autosToRun = undefined;
      if (runAutomations && selectedCampaign.automationRules && selectedCampaign.automationRules[outcome]) {
        autosToRun = selectedCampaign.automationRules[outcome];
      }
      
      const result = await submitCallOutcomeAction({
        queueItemId: queueItem.id,
        outcome,
        notes: payload?.notes || '',
        duration: 0, // Simplified for single call
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
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
      return { ok: false, error: err.message };
    }
  };

  const resolveLiveText = (text: string) => resolveTextWithMap(text, variablesMap);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-0 h-[100dvh] sm:h-[85vh] sm:rounded-2xl overflow-hidden flex flex-col border-none shadow-2xl gap-0">
        <DialogHeader className="px-6 py-4 border-b bg-background z-10 shrink-0 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-indigo-500" />
              {step === 'select' ? 'Select Call Campaign' : `Calling ${queueItem?.contactName || queueItem?.entityName}`}
            </DialogTitle>
            <DialogDescription className="mt-1">
              {step === 'select' ? 'Choose a published campaign to run this script against.' : 'Interactive script view'}
            </DialogDescription>
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
