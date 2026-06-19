'use client';

import * as React from 'react';
import type { Node, Edge } from 'reactflow';
import dynamic from 'next/dynamic';
import { useFirestore } from '@/firebase';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Play,
  HelpCircle,
  Settings,
  X,
  Info,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RefreshCw,
  Zap,
  ChevronLeft,
  Phone,
  PhoneOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getActionMeta } from '@/lib/call-action-types';
import { useZoom } from '@/hooks/use-zoom';
import { ScriptBodyDisplay } from './ScriptBodyDisplay';
import { classifyTraversal } from '@/lib/interactive-traversal';

const MessagingTemplateSelector = dynamic(
  () =>
    import('@/app/admin/components/MessagingTemplateSelector').then(
      (m) => m.MessagingTemplateSelector
    ),
  {
    ssr: false,
    loading: () => <div className="h-10 w-full rounded-xl bg-muted animate-pulse" />,
  }
);

type TriggerResult = { ok: boolean; error?: string };

interface EntityContactInfo {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
}

interface EntityDataInfo {
  id?: string;
  name?: string;
  entityContacts?: EntityContactInfo[];
}

interface InteractiveScriptViewProps {
  nodes: Node[];
  edges: Edge[];
  /**
   * Optional resolver that substitutes live values into `{{VARIABLE}}` tokens
   * (e.g. the current contact + caller during a live call). When omitted, the
   * view stays in builder mode and shows variable pills.
   */
  resolveText?: (raw: string) => string;
  /** Live-mode handlers — when present, actions/outcomes can be triggered for real. */
  onTriggerAction?: (node: Node) => Promise<TriggerResult>;
  onTriggerOutcome?: (node: Node) => Promise<TriggerResult>;
  /** Node ids already triggered this conversation (rendered greyed/disabled). */
  triggeredIds?: Set<string> | string[];
  onEndCall?: () => void;
  currentContact?: { id: string; name?: string; email?: string; phone?: string } | null;
  entityData?: EntityDataInfo | null;
}

export function InteractiveScriptView({
  nodes,
  edges,
  resolveText,
  onTriggerAction,
  onTriggerOutcome,
  triggeredIds,
  onEndCall,
  currentContact,
  entityData,
}: InteractiveScriptViewProps) {
  const { zoom, zoomIn, zoomOut, reset, canZoomIn, canZoomOut } = useZoom();
  const firestore = useFirestore();
  const [activeNodeId, setActiveNodeId] = React.useState<string | null>(null);
  const [rightTab, setRightTab] = React.useState<'objections' | 'actions' | 'outcomes'>('objections');
  const [selectedObjectionId, setSelectedObjectionId] = React.useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = React.useState<string | null>(null);
  const [selectedSubObjectionIndex, setSelectedSubObjectionIndex] = React.useState<number | null>(null);
  const [filterRelatedObjections, setFilterRelatedObjections] = React.useState(true);
  const [pathHistory, setPathHistory] = React.useState<string[]>([]);
  const [enteredObjectionFromChoice, setEnteredObjectionFromChoice] = React.useState(false);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Dynamic Action Middle Panel States
  const [localActionConfig, setLocalActionConfig] = React.useState<Record<string, string>>({});
  const [actionStatus, setActionStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [templateDetails, setTemplateDetails] = React.useState<{ subject?: string; body?: string } | null>(null);
  const [loadingTemplate, setLoadingTemplate] = React.useState(false);

  // Trigger panel state (shared by the Actions & Outcomes tabs and auto-traversal).
  const [triggerView, setTriggerView] = React.useState<{ nodeId: string; kind: 'action' | 'outcome' } | null>(null);
  const [triggerStatus, setTriggerStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [triggerError, setTriggerError] = React.useState<string | null>(null);

  const isTriggered = React.useCallback((id: string) => {
    if (!triggeredIds) return false;
    return triggeredIds instanceof Set ? triggeredIds.has(id) : triggeredIds.includes(id);
  }, [triggeredIds]);

  // Logical pre-order DFS ordering of main blocks (excludes objections/actions/outcomes —
  // outcomes live in their own right-column tab and are triggered, not navigated to).
  const orderedMainNodes = React.useMemo(() => {
    if (!nodes || nodes.length === 0) return [];

    const mainNodes = nodes.filter(n => n.type !== 'objection' && n.type !== 'action' && n.type !== 'outcome');
    const result: Node[] = [];
    const visited = new Set<string>();

    const dfs = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      const node = mainNodes.find(n => n.id === nodeId);
      if (node) result.push(node);

      const outgoing = edges.filter(e => e.source === nodeId);
      outgoing.sort((a, b) => {
        const aH = a.sourceHandle || '';
        const bH = b.sourceHandle || '';
        return aH.localeCompare(bH);
      });

      for (const edge of outgoing) {
        dfs(edge.target);
      }
    };

    const starts = mainNodes.filter(n => n.type === 'start');
    starts.forEach(s => dfs(s.id));

    mainNodes.forEach(n => {
      if (!visited.has(n.id)) {
        dfs(n.id);
      }
    });

    return result;
  }, [nodes, edges]);

  // Set default active node on load
  React.useEffect(() => {
    if (!activeNodeId && orderedMainNodes.length > 0) {
      const startNode = orderedMainNodes.find(n => n.type === 'start');
      setActiveNodeId(startNode ? startNode.id : orderedMainNodes[0].id);
    }
  }, [orderedMainNodes, activeNodeId]);

  // Derive middle pane content without secondary effects
  const activeNode = React.useMemo(() => {
    return nodes.find(n => n.id === activeNodeId) || null;
  }, [nodes, activeNodeId]);

  const middleNode = React.useMemo(() => {
    if (selectedObjectionId) {
      return nodes.find(n => n.id === selectedObjectionId) || null;
    }
    if (selectedActionId) {
      return nodes.find(n => n.id === selectedActionId) || null;
    }
    return activeNode;
  }, [nodes, selectedObjectionId, selectedActionId, activeNode]);

  // Auto-switch right tab when action is selected
  React.useEffect(() => {
    if (middleNode?.type === 'action') {
      setRightTab('actions');
    }
  }, [middleNode?.id]);

  // Initialize/reset local config when middleNode changes
  React.useEffect(() => {
    if (middleNode?.type === 'action') {
      const config = (middleNode.data?.actionConfig as Record<string, string>) || {};
      const initial: Record<string, string> = { ...config };
      if (middleNode.data?.actionType === 'UPDATE_CONTACT') {
        initial.contactName = initial.contactName !== undefined && initial.contactName !== '' ? initial.contactName : (currentContact?.name || '');
        initial.contactEmail = initial.contactEmail !== undefined && initial.contactEmail !== '' ? initial.contactEmail : (currentContact?.email || '');
        initial.contactPhone = initial.contactPhone !== undefined && initial.contactPhone !== '' ? initial.contactPhone : (currentContact?.phone || '');
        initial.updateMode = initial.updateMode || 'update';
      } else if (middleNode.data?.actionType === 'CREATE_TASK') {
        initial.taskTitle = initial.taskTitle || ('Follow up with ' + (currentContact?.name || ''));
        initial.taskDescription = initial.taskDescription || '';
        initial.taskPriority = initial.taskPriority || 'medium';
      } else if (middleNode.data?.actionType === 'SEND_SMS' || middleNode.data?.actionType === 'SEND_WHATSAPP' || middleNode.data?.actionType === 'SEND_EMAIL') {
        initial.templateId = initial.templateId || '';
      }
      setLocalActionConfig(initial);
      setActionStatus(isTriggered(middleNode.id) ? 'success' : 'idle');
      setActionError(null);
    } else {
      setLocalActionConfig({});
    }
  }, [middleNode, currentContact, isTriggered]);

  // Fetch message template details from firestore client-side
  React.useEffect(() => {
    const config = middleNode?.data?.actionConfig;
    const templateId = localActionConfig?.templateId || config?.templateId;
    if (middleNode?.type === 'action' && templateId && firestore) {
      setLoadingTemplate(true);
      setTemplateDetails(null);
      import('firebase/firestore').then(async ({ doc, getDoc }) => {
        try {
          const docSnap = await getDoc(doc(firestore, 'message_templates', templateId));
          if (docSnap.exists()) {
            setTemplateDetails({
              subject: docSnap.data()?.subject || '',
              body: docSnap.data()?.body || '',
            });
          }
        } catch (e) {
          console.error('Failed to load message template:', e);
        } finally {
          setLoadingTemplate(false);
        }
      });
    } else {
      setTemplateDetails(null);
      setLoadingTemplate(false);
    }
  }, [middleNode, localActionConfig?.templateId, firestore]);

  const handleExecuteMiddleAction = async () => {
    if (!middleNode || !onTriggerAction) return;
    setActionStatus('loading');
    setActionError(null);
    try {
      const modifiedNode = {
        ...middleNode,
        data: {
          ...middleNode.data,
          actionConfig: localActionConfig,
        }
      };
      const res = await onTriggerAction(modifiedNode);
      if (res.ok) {
        setActionStatus('success');
      } else {
        setActionStatus('error');
        setActionError(res.error || 'Execution failed.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Execution failed.';
      setActionStatus('error');
      setActionError(message);
    }
  };

  const nextEdgeFromAction = React.useMemo(() => {
    if (middleNode?.type !== 'action') return null;
    const actionOutgoing = edges.filter(e => e.source === middleNode.id);
    return actionOutgoing[0] || null;
  }, [edges, middleNode]);

  const renderMiddleActionConfig = () => {
    if (!middleNode) return null;
    const actionType = middleNode.data?.actionType;

    if (actionType === 'UPDATE_CONTACT') {
      return (
        <div className="space-y-4 max-w-md mx-auto bg-card/60 p-6 rounded-2xl border border-border shadow-sm">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-center mb-2">Update Contact Fields</h4>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Contact Name</Label>
              <Input
                value={localActionConfig.contactName || ''}
                onChange={e => setLocalActionConfig(prev => ({ ...prev, contactName: e.target.value }))}
                placeholder="Name"
                className="h-9 rounded-xl bg-background border-border text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Contact Email</Label>
              <Input
                value={localActionConfig.contactEmail || ''}
                onChange={e => setLocalActionConfig(prev => ({ ...prev, contactEmail: e.target.value }))}
                placeholder="Email"
                type="email"
                className="h-9 rounded-xl bg-background border-border text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Contact Phone</Label>
              <Input
                value={localActionConfig.contactPhone || ''}
                onChange={e => setLocalActionConfig(prev => ({ ...prev, contactPhone: e.target.value }))}
                placeholder="Phone number"
                className="h-9 rounded-xl bg-background border-border text-sm"
              />
            </div>
            
            <div className="space-y-1.5 pt-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Save Option</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLocalActionConfig(prev => ({ ...prev, updateMode: 'update' }))}
                  className={cn(
                    "flex-grow py-2 rounded-xl text-xs font-bold uppercase border transition-all",
                    localActionConfig.updateMode === 'update'
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/50 border-transparent hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  Update Current
                </button>
                <button
                  type="button"
                  onClick={() => setLocalActionConfig(prev => ({ ...prev, updateMode: 'new' }))}
                  className={cn(
                    "flex-grow py-2 rounded-xl text-xs font-bold uppercase border transition-all",
                    localActionConfig.updateMode === 'new'
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/50 border-transparent hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  Add as New Contact
                </button>
              </div>
            </div>
          </div>

          {actionStatus === 'success' && (
            <div className="text-emerald-500 font-bold text-xs text-center py-2 flex items-center justify-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Contact details saved successfully!
            </div>
          )}
          {actionStatus === 'error' && (
            <div className="text-rose-500 font-bold text-xs text-center py-2 flex items-center justify-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0" /> {actionError || 'Failed to save details.'}
            </div>
          )}

          <Button
            type="button"
            onClick={handleExecuteMiddleAction}
            disabled={actionStatus === 'loading'}
            className="w-full h-10 rounded-xl font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white mt-2 shadow-sm"
          >
            {actionStatus === 'loading' ? 'Saving...' : 'Save Contact Details'}
          </Button>
        </div>
      );
    }

    if (actionType === 'SEND_SMS' || actionType === 'SEND_WHATSAPP' || actionType === 'SEND_EMAIL') {
      const channel = actionType === 'SEND_SMS' ? 'sms' : actionType === 'SEND_WHATSAPP' ? 'whatsapp' : 'email';
      const label = actionType === 'SEND_SMS' ? 'SMS' : actionType === 'SEND_WHATSAPP' ? 'WhatsApp' : 'Email';
      const toValue = actionType === 'SEND_EMAIL' ? (currentContact?.email || 'No email configured') : (currentContact?.phone || 'No phone number configured');

      return (
        <div className="space-y-4 max-w-lg mx-auto bg-card/60 p-6 rounded-2xl border border-border shadow-sm">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Select template</Label>
              <MessagingTemplateSelector
                category="campaigns"
                recipientType="entity"
                channel={channel}
                value={localActionConfig.templateId ?? ''}
                onValueChange={(val: string) => setLocalActionConfig(prev => ({ ...prev, templateId: val }))}
                compact
              />
            </div>

            {localActionConfig.templateId ? (
              loadingTemplate ? (
                <div className="h-32 w-full rounded-xl bg-muted animate-pulse flex items-center justify-center text-xs text-muted-foreground italic">
                  Loading template preview...
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block text-center">Preview & Adjust Message</span>
                  
                  <div className={cn(
                    "p-4 rounded-xl border flex flex-col gap-2 text-xs",
                    actionType === 'SEND_WHATSAPP' ? "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20" :
                    actionType === 'SEND_SMS' ? "bg-muted/40 border-border" : "bg-blue-500/5 dark:bg-blue-500/10 border-blue-500/20"
                  )}>
                    <div className="flex justify-between border-b border-border/40 pb-1.5 text-[10px] text-muted-foreground">
                      <span><strong>To:</strong> {toValue}</span>
                      <span className="font-mono text-[8px] uppercase">{label} Preview</span>
                    </div>

                    {actionType === 'SEND_EMAIL' && (
                      <div className="space-y-1">
                        <Label className="text-[9px] font-bold uppercase text-muted-foreground">Subject</Label>
                        <Input
                          value={localActionConfig.customSubject !== undefined ? localActionConfig.customSubject : (templateDetails?.subject || '')}
                          onChange={e => setLocalActionConfig(prev => ({ ...prev, customSubject: e.target.value }))}
                          placeholder="Email subject"
                          className="h-8 rounded-lg bg-background border-border text-xs"
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-[9px] font-bold uppercase text-muted-foreground">Message Body</Label>
                      <Textarea
                        value={localActionConfig.customBody !== undefined ? localActionConfig.customBody : (templateDetails?.body || '')}
                        onChange={e => setLocalActionConfig(prev => ({ ...prev, customBody: e.target.value }))}
                        placeholder="Write template body"
                        rows={5}
                        className="bg-background border-border rounded-lg text-xs p-2 resize-none font-serif leading-relaxed"
                      />
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="text-center py-6 text-xs text-muted-foreground italic border border-dashed border-border rounded-xl">
                Please select a message template to preview.
              </div>
            )}
          </div>

          {actionStatus === 'success' && (
            <div className="text-emerald-500 font-bold text-xs text-center py-2 flex items-center justify-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Message sent successfully!
            </div>
          )}
          {actionStatus === 'error' && (
            <div className="text-rose-500 font-bold text-xs text-center py-2 flex items-center justify-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0" /> {actionError || 'Failed to send message.'}
            </div>
          )}

          <Button
            type="button"
            onClick={handleExecuteMiddleAction}
            disabled={actionStatus === 'loading' || !localActionConfig.templateId}
            className={cn(
              "w-full h-10 rounded-xl font-bold uppercase tracking-wider text-white shadow-sm mt-2",
              actionType === 'SEND_WHATSAPP' ? "bg-green-600 hover:bg-green-700" :
              actionType === 'SEND_SMS' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"
            )}
          >
            {actionStatus === 'loading' ? 'Sending...' : `Send ${label}`}
          </Button>
        </div>
      );
    }

    if (actionType === 'CREATE_TASK') {
      return (
        <div className="space-y-4 max-w-md mx-auto bg-card/60 p-6 rounded-2xl border border-border shadow-sm">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-center mb-2">Create Task</h4>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Task Title</Label>
              <Input
                value={localActionConfig.taskTitle || ''}
                onChange={e => setLocalActionConfig(prev => ({ ...prev, taskTitle: e.target.value }))}
                placeholder="Task title"
                className="h-9 rounded-xl bg-background border-border text-sm"
              />
            </div>
            
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Task Description</Label>
              <Textarea
                value={localActionConfig.taskDescription || ''}
                onChange={e => setLocalActionConfig(prev => ({ ...prev, taskDescription: e.target.value }))}
                placeholder="Describe task details..."
                rows={3}
                className="bg-background border-border rounded-xl text-xs p-2 resize-none"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Priority</Label>
              <div className="flex gap-2">
                {['low', 'medium', 'high'].map(prio => (
                  <button
                    key={prio}
                    type="button"
                    onClick={() => setLocalActionConfig(prev => ({ ...prev, taskPriority: prio }))}
                    className={cn(
                      "flex-grow py-1.5 rounded-lg text-xs font-bold uppercase border transition-all",
                      localActionConfig.taskPriority === prio
                        ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                        : "bg-muted/50 border-transparent hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {prio}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {actionStatus === 'success' && (
            <div className="text-emerald-500 font-bold text-xs text-center py-2 flex items-center justify-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Task created successfully!
            </div>
          )}
          {actionStatus === 'error' && (
            <div className="text-rose-500 font-bold text-xs text-center py-2 flex items-center justify-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0" /> {actionError || 'Failed to create task.'}
            </div>
          )}

          <Button
            type="button"
            onClick={handleExecuteMiddleAction}
            disabled={actionStatus === 'loading' || !localActionConfig.taskTitle}
            className="w-full h-10 rounded-xl font-bold uppercase tracking-wider bg-amber-500 hover:bg-amber-600 text-white mt-2 shadow-sm"
          >
            {actionStatus === 'loading' ? 'Creating...' : 'Create Task'}
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4 max-w-md mx-auto bg-card/60 p-6 rounded-2xl border border-border shadow-sm text-center">
        <p className="text-xs text-muted-foreground italic leading-relaxed">
          Configuration properties: {JSON.stringify(localActionConfig)}
        </p>

        {actionStatus === 'success' && (
          <div className="text-emerald-500 font-bold text-xs text-center py-2 flex items-center justify-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> Action executed successfully!
          </div>
        )}
        {actionStatus === 'error' && (
          <div className="text-rose-500 font-bold text-xs text-center py-2 flex items-center justify-center gap-1.5">
            <AlertCircle className="h-4 w-4 shrink-0" /> {actionError || 'Action execution failed.'}
          </div>
        )}

        <Button
          type="button"
          onClick={handleExecuteMiddleAction}
          disabled={actionStatus === 'loading'}
          className="w-full h-10 rounded-xl font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white mt-2 shadow-sm"
        >
          {actionStatus === 'loading' ? 'Executing...' : 'Execute Action'}
        </Button>
      </div>
    );
  };

  // Gets absolute default placeholder text if none has been configured
  const getFallbackText = React.useCallback((node: Node) => {
    const text = node.data?.text;
    if (text && text.trim()) return text;

    switch (node.type) {
      case 'start':
        return 'Initiate outbound call conversation.';
      case 'end':
        return 'End of call outreach.';
      case 'question':
        return 'Ask your question here…';
      case 'script_block':
        return 'Script body text.';
      case 'objection':
        return 'Objection response details here…';
      case 'action': {
        const meta = getActionMeta(node.data?.actionType || '');
        let details = `Trigger Action: ${meta.label}`;
        const config = node.data?.actionConfig || {};
        if (node.data?.actionType === 'SEND_SMS' || node.data?.actionType === 'SEND_EMAIL' || node.data?.actionType === 'SEND_WHATSAPP') {
          details += ` (Template ID: ${config.templateId || 'Not configured'})`;
        } else if (node.data?.actionType === 'CREATE_TASK') {
          details += ` (Task: "${config.taskTitle || 'Follow up'}" - Priority: ${config.taskPriority || 'medium'})`;
        } else if (node.data?.actionType === 'CHANGE_STAGE') {
          details += ` (Stage ID: ${config.stageId || 'Not configured'})`;
        } else if (node.data?.actionType === 'ADD_TAG' || node.data?.actionType === 'REMOVE_TAG') {
          details += ` (Tag ID: ${config.tagId || 'Not configured'})`;
        } else if (node.data?.actionType === 'WEBHOOK') {
          details += ` (${config.webhookMethod || 'POST'} to ${config.webhookUrl || 'No URL'})`;
        } else if (node.data?.actionType === 'LOG_NOTE') {
          details += ` (Note: ${config.noteContent || 'Empty'})`;
        } else if (node.data?.actionType === 'SCHEDULE_MEETING') {
          details += ` (Meeting Type ID: ${config.meetingTypeId || 'Not configured'})`;
        } else if (node.data?.actionType === 'TRANSFER_CALL') {
          details += ` (Transfer to: ${config.transferTarget || 'No target'} via ${config.transferMode || 'phone'})`;
        } else if (node.data?.actionType === 'UPDATE_CONTACT') {
          details += ` (Update: ${config.contactName || '[No Name]'}, ${config.contactEmail || '[No Email]'}, ${config.contactPhone || '[No Phone]'})`;
        }
        if (config.triggerDelaySeconds) {
          details += ` [Delayed by ${config.triggerDelaySeconds}s]`;
        }
        return details;
      }
      case 'outcome':
        return `Outcome Resolution: ${node.data?.outcomeValue || 'None'}`;
      default:
        return 'Script body text.';
    }
  }, []);

  interface ObjectionData {
    objectionConfig?: {
      objections?: Array<{ title: string; description: string }>;
    };
    label?: string;
    text?: string;
  }

  const getSubObjections = React.useCallback((node: Node): Array<{ title: string; description: string }> => {
    const data = node.data as ObjectionData | undefined;
    const objections = data?.objectionConfig?.objections;
    if (Array.isArray(objections) && objections.length > 0) {
      return objections;
    }
    return [
      {
        title: node.data?.label || 'Objection',
        description: node.data?.text || '',
      }
    ];
  }, []);

  const subObjections = React.useMemo(() => {
    if (!middleNode) return [];
    return getSubObjections(middleNode);
  }, [middleNode, getSubObjections]);

  const middleTitle = React.useMemo(() => {
    if (selectedObjectionId && middleNode) {
      if (selectedSubObjectionIndex !== null) {
        const subObjs = getSubObjections(middleNode);
        const subObj = subObjs[selectedSubObjectionIndex];
        if (subObj?.title) return subObj.title;
      }
      return middleNode.data?.label || 'Objection';
    }
    return middleNode?.data?.label || 'Script Body';
  }, [selectedObjectionId, selectedSubObjectionIndex, middleNode, getSubObjections]);

  const middleText = React.useMemo(() => {
    if (selectedObjectionId && middleNode) {
      if (selectedSubObjectionIndex !== null) {
        const subObjs = getSubObjections(middleNode);
        const subObj = subObjs[selectedSubObjectionIndex];
        if (subObj?.description) return subObj.description;
      }
      return middleNode.data?.text || 'Objection response details here…';
    }
    return middleNode ? getFallbackText(middleNode) : '';
  }, [selectedObjectionId, selectedSubObjectionIndex, middleNode, getFallbackText, getSubObjections]);

  // Memoized callbacks
  const handleMainNodeClick = React.useCallback((nodeId: string) => {
    setActiveNodeId(nodeId);
    setSelectedObjectionId(null);
    setSelectedActionId(null);
    setSelectedSubObjectionIndex(null);
    setEnteredObjectionFromChoice(false);
  }, []);

  const handleObjectionClick = React.useCallback((objectionId: string, subIndex: number | null) => {
    if (activeNodeId) {
      setPathHistory(prev => {
        if (prev.length > 0 && prev[prev.length - 1] === activeNodeId) return prev;
        return [...prev, activeNodeId];
      });
    }
    setSelectedObjectionId(objectionId);
    setSelectedSubObjectionIndex(subIndex);
    setSelectedActionId(null);
    setEnteredObjectionFromChoice(false);
  }, [activeNodeId]);

  const handleGoBack = React.useCallback(() => {
    if (pathHistory.length === 0) return;
    const newHistory = [...pathHistory];
    const prevNodeId = newHistory.pop();
    setPathHistory(newHistory);
    if (prevNodeId) {
      setActiveNodeId(prevNodeId);
    }
    setSelectedObjectionId(null);
    setSelectedActionId(null);
    setSelectedSubObjectionIndex(null);
    setEnteredObjectionFromChoice(false);
  }, [pathHistory]);


  // Compute active outgoing choices & actions for navigation
  const outgoingEdges = React.useMemo(() => {
    return activeNodeId ? edges.filter(e => e.source === activeNodeId) : [];
  }, [edges, activeNodeId]);

  const actionEdges = React.useMemo(() => {
    return outgoingEdges.filter(e => {
      const t = nodes.find(n => n.id === e.target);
      return t?.type === 'action';
    });
  }, [outgoingEdges, nodes]);

  const nextMainEdge = React.useMemo(() => {
    return outgoingEdges.find(e => {
      const t = nodes.find(n => n.id === e.target);
      return t && t.type !== 'action' && t.type !== 'objection';
    });
  }, [outgoingEdges, nodes]);

  // Filter objections based on relations to the active node
  const relatedObjections = React.useMemo(() => {
    if (!activeNodeId) return [];
    const connectedNodeIds = new Set(
      edges
        .filter(e => e.source === activeNodeId || e.target === activeNodeId)
        .map(e => e.source === activeNodeId ? e.target : e.source)
    );
    return nodes.filter(n => n.type === 'objection' && connectedNodeIds.has(n.id));
  }, [nodes, edges, activeNodeId]);

  const allObjections = React.useMemo(() => nodes.filter(n => n.type === 'objection'), [nodes]);
  const displayedObjections = filterRelatedObjections ? relatedObjections : allObjections;

  const allActions = React.useMemo(() => nodes.filter(n => n.type === 'action'), [nodes]);
  const allOutcomes = React.useMemo(() => nodes.filter(n => n.type === 'outcome'), [nodes]);

  // Body text shown for an action/outcome in its detail view.
  const bodyOf = React.useCallback((node: Node) => {
    if (node.type === 'outcome') {
      return node.data?.text || `Mark this call outcome as "${node.data?.outcomeValue || 'Outcome'}".`;
    }
    return getFallbackText(node);
  }, [getFallbackText]);

  // Execute a trigger for the given node, driving the shared status banner.
  const runTrigger = React.useCallback(async (node: Node, kind: 'action' | 'outcome') => {
    const handler = kind === 'action' ? onTriggerAction : onTriggerOutcome;
    if (!handler) return;
    if (isTriggered(node.id)) { setTriggerStatus('success'); return; }
    setTriggerStatus('loading');
    setTriggerError(null);
    try {
      const res = await handler(node);
      if (res.ok) {
        setTriggerStatus('success');
      } else {
        setTriggerStatus('error');
        setTriggerError(res.error || 'Trigger failed.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Trigger failed.';
      setTriggerStatus('error');
      setTriggerError(message);
    }
  }, [onTriggerAction, onTriggerOutcome, isTriggered]);

  const openTrigger = React.useCallback((node: Node, kind: 'action' | 'outcome') => {
    setRightTab(kind === 'action' ? 'actions' : 'outcomes');
    setTriggerView({ nodeId: node.id, kind });
    setTriggerStatus(isTriggered(node.id) ? 'success' : 'idle');
    setTriggerError(null);
  }, [isTriggered]);

  // Navigate to a node via the middle controls — auto-triggering actions/outcomes in live mode.
  const advanceTo = React.useCallback((targetNodeId: string) => {
    const target = nodes.find(n => n.id === targetNodeId);
    if (!target) return;

    if (activeNodeId) {
      setPathHistory(prev => {
        if (prev.length > 0 && prev[prev.length - 1] === activeNodeId) return prev;
        return [...prev, activeNodeId];
      });
    }

    const decision = classifyTraversal(target.type, {
      hasOutcomeHandler: !!onTriggerOutcome,
      hasActionHandler: !!onTriggerAction,
    });
    if (decision === 'trigger-outcome') {
      openTrigger(target, 'outcome');
      void runTrigger(target, 'outcome');
      return;
    }
    if (target.type === 'action') {
      handleMainNodeClick(target.id);
      return;
    }

    if (target.type === 'objection') {
      setSelectedObjectionId(targetNodeId);
      setEnteredObjectionFromChoice(true);
      setSelectedSubObjectionIndex(null);
    } else {
      handleMainNodeClick(targetNodeId);
    }
  }, [nodes, edges, activeNodeId, onTriggerOutcome, onTriggerAction, openTrigger, runTrigger, handleMainNodeClick]);

  const handleNextStepAfterObjection = React.useCallback(() => {
    if (!middleNode) return;
    const objectionOutgoingEdges = edges.filter(e => e.source === middleNode.id);
    if (objectionOutgoingEdges.length > 0) {
      advanceTo(objectionOutgoingEdges[0].target);
    } else {
      const mainNodeId = [...pathHistory].reverse().find(id => {
        const node = nodes.find(n => n.id === id);
        return node && node.type !== 'objection' && node.type !== 'action';
      });
      if (mainNodeId) {
        handleMainNodeClick(mainNodeId);
      }
    }
  }, [middleNode, edges, nodes, pathHistory, advanceTo, handleMainNodeClick]);

  const resetSimulation = React.useCallback(() => {
    const startNode = nodes.find(n => n.type === 'start') || orderedMainNodes[0];
    if (startNode) {
      setActiveNodeId(startNode.id);
      setPathHistory([]);
      setSelectedObjectionId(null);
      setSelectedActionId(null);
      setSelectedSubObjectionIndex(null);
      setEnteredObjectionFromChoice(false);
    }
  }, [nodes, orderedMainNodes]);

  // Active navigation handlers for the current step
  const activeHandlers = React.useMemo(() => {
    if (!middleNode) return [];

    // 1. If we are traversing an objection
    if (selectedObjectionId || middleNode.type === 'objection') {
      if (selectedSubObjectionIndex === null && subObjections.length > 1) {
        return subObjections.map((_: unknown, idx: number) => () => {
          setSelectedSubObjectionIndex(idx);
        });
      }
      return [handleNextStepAfterObjection];
    }

    // 2. If we are on the start node
    if (middleNode.type === 'start') {
      const startEdge = edges.find(e => e.source === middleNode.id);
      return [() => {
        if (startEdge) advanceTo(startEdge.target);
      }];
    }

    // 3. If we are on the end node
    if (middleNode.type === 'end') {
      return [() => {
        onEndCall?.();
        resetSimulation();
      }];
    }

    // 4. If it's a question (Ask) node
    if (middleNode.type === 'question') {
      const options = (middleNode.data.options as string[]) || ['Yes', 'No'];
      const choiceHandlers = options.map((opt, idx) => {
        const matchingEdge = edges.find(e => e.source === middleNode.id && e.sourceHandle === `option-${idx}`);
        const targetExists = matchingEdge && nodes.some(n => n.id === matchingEdge.target);
        if (targetExists && matchingEdge) {
          return () => advanceTo(matchingEdge.target);
        }
        return null;
      }).filter(Boolean) as (() => void)[];

      const actionHandlers = actionEdges.map(edge => {
        const actionNode = nodes.find(n => n.id === edge.target);
        if (!actionNode || isTriggered(actionNode.id)) return null;
        return () => advanceTo(actionNode.id);
      }).filter(Boolean) as (() => void)[];

      return [...choiceHandlers, ...actionHandlers];
    }

    // 5. Normal blocks or action blocks
    const continueHandler = nextMainEdge ? () => advanceTo(nextMainEdge.target) : null;
    const actionContinueHandler = middleNode.type === 'action' && nextEdgeFromAction ? () => advanceTo(nextEdgeFromAction.target) : null;
    const actionHandlers = actionEdges.map(edge => {
      const actionNode = nodes.find(n => n.id === edge.target);
      if (!actionNode || isTriggered(actionNode.id)) return null;
      return () => advanceTo(actionNode.id);
    }).filter(Boolean) as (() => void)[];

    return [continueHandler || actionContinueHandler, ...actionHandlers].filter(Boolean) as (() => void)[];
  }, [
    middleNode,
    selectedObjectionId,
    selectedSubObjectionIndex,
    subObjections,
    handleNextStepAfterObjection,
    edges,
    nodes,
    advanceTo,
    actionEdges,
    isTriggered,
    nextMainEdge,
    nextEdgeFromAction,
    onEndCall,
    resetSimulation
  ]);

  // Keyboard navigation shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
         activeEl.tagName === 'TEXTAREA' ||
         activeEl.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollContainerRef.current?.scrollBy({ top: -40, behavior: 'smooth' });
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        scrollContainerRef.current?.scrollBy({ top: 40, behavior: 'smooth' });
        return;
      }

      if (e.key === 'ArrowLeft') {
        if (pathHistory.length > 0) {
          e.preventDefault();
          handleGoBack();
        }
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          if (pathHistory.length > 0) {
            handleGoBack();
          }
        } else {
          if (activeHandlers.length > 0) {
            activeHandlers[0]();
          }
        }
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (activeHandlers.length > 0) {
          e.preventDefault();
          activeHandlers[0]();
        }
        return;
      }

      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= 9) {
        const idx = num - 1;
        if (idx >= 0 && idx < activeHandlers.length) {
          e.preventDefault();
          activeHandlers[idx]();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    pathHistory,
    handleGoBack,
    activeHandlers
  ]);

  // Shared renderer for the Actions and Outcomes tabs (list ⇄ detail/confirm/back + status banner).
  const renderTriggerTab = (kind: 'action' | 'outcome') => {
    const list = kind === 'action' ? allActions : allOutcomes;
    const handler = kind === 'action' ? onTriggerAction : onTriggerOutcome;
    const open = triggerView?.kind === kind ? list.find(n => n.id === triggerView.nodeId) || null : null;
    const accentText = kind === 'action' ? 'text-indigo-500' : 'text-purple-500';
    const accentBox = kind === 'action'
      ? 'bg-indigo-500/5 dark:bg-indigo-500/10 border-indigo-500/10'
      : 'bg-purple-500/5 dark:bg-purple-500/10 border-purple-500/10';
    const confirmLabel = kind === 'action' ? 'Trigger Action' : 'Confirm Outcome';

    if (open) {
      const triggered = isTriggered(open.id);
      return (
        <div className="flex-grow flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border shrink-0 select-none">
            <button
              type="button"
              onClick={() => { setTriggerView(null); setTriggerStatus('idle'); setTriggerError(null); }}
              className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
            <span className={cn('text-[9px] font-bold uppercase truncate max-w-[150px]', accentText)}>
              {open.data.label || (kind === 'action' ? 'Action' : open.data.outcomeValue || 'Outcome')}
            </span>
          </div>

          <ScriptBodyDisplay
            text={bodyOf(open)}
            resolveText={resolveText}
            highlightVariables={!resolveText}
            className={cn('flex-grow overflow-y-auto p-3.5 rounded-xl border text-xs leading-relaxed text-foreground select-text font-medium scrollbar-thin', accentBox)}
          />

          {/* Trigger status banner */}
          {triggerStatus === 'loading' ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-[10px] font-bold text-primary shrink-0">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Triggering…
            </div>
          ) : triggerStatus === 'success' ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[10px] font-bold text-emerald-600 shrink-0">
              <CheckCircle2 className="h-3.5 w-3.5" /> {kind === 'action' ? 'Action' : 'Outcome'} triggered successfully.
            </div>
          ) : triggerStatus === 'error' ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-[10px] font-bold text-rose-600 shrink-0">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{triggerError || 'Trigger failed.'}</span>
            </div>
          ) : null}

          {/* Footer: confirm / triggered / preview note */}
          <div className="pt-3 shrink-0">
            {triggered ? (
              <div className="text-center text-[10px] font-bold text-emerald-500 uppercase tracking-wider py-2">✓ Already triggered</div>
            ) : handler ? (
              <Button
                onClick={() => runTrigger(open, kind)}
                disabled={triggerStatus === 'loading'}
                className="w-full h-9 rounded-xl text-[10px] font-bold uppercase tracking-wider gap-1.5"
              >
                {triggerStatus === 'loading' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                {confirmLabel}
              </Button>
            ) : (
              <div className="text-center text-[9px] text-muted-foreground italic py-2">
                Preview only — triggering is available during a live call.
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex-grow flex flex-col h-full overflow-hidden">
        <span className="text-[9px] font-bold text-muted-foreground uppercase pb-2 mb-2 border-b border-border shrink-0 select-none">
          {kind === 'action' ? 'Available Actions' : 'Call Outcomes'}
        </span>
        <div className="flex-grow overflow-y-auto space-y-1.5 scrollbar-thin select-none">
          {list.length > 0 ? (
            list.map((node) => {
              const triggered = isTriggered(node.id);
              const meta = kind === 'action' ? getActionMeta(node.data?.actionType || '') : null;
              const Icon = meta ? meta.icon : CheckCircle2;
              const iconColor = meta ? meta.colorClass.replace('bg-', 'text-') : 'text-purple-500';
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => {
                    if (kind === 'action') {
                      setSelectedActionId(node.id);
                      setSelectedObjectionId(null);
                      setSelectedSubObjectionIndex(null);
                      setEnteredObjectionFromChoice(false);
                      setRightTab('actions');
                    } else {
                      openTrigger(node, kind);
                    }
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 p-2.5 rounded-xl text-left border text-[11px] transition-all',
                    triggered
                      ? 'border-border/40 bg-muted/40 text-muted-foreground/50'
                      : 'border-border/60 bg-card hover:bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', triggered ? 'text-muted-foreground/40' : iconColor)} />
                  <span className="truncate flex-grow">
                    {node.data.label || (kind === 'action' ? 'Action' : node.data.outcomeValue || 'Outcome')}
                  </span>
                  {triggered ? <span className="text-[8px] font-bold text-emerald-500 uppercase shrink-0">✓ Triggered</span> : null}
                </button>
              );
            })
          ) : (
            <div className="text-center py-10 text-[11px] text-muted-foreground italic">
              {kind === 'action' ? 'No actions found in this script.' : 'No outcomes found in this script.'}
            </div>
          )}
        </div>
      </div>
    );
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'start':
        return <Play className="h-3.5 w-3.5 text-emerald-500" />;
      case 'end':
        return <AlertCircle className="h-3.5 w-3.5 text-rose-500" />;
      case 'question':
        return <HelpCircle className="h-3.5 w-3.5 text-amber-500" />;
      default:
        return <Layers className="h-3.5 w-3.5 text-primary" />;
    }
  };

  return (
    <div className="grid grid-cols-12 gap-4 h-[680px] overflow-hidden text-foreground">
      {/* 1. Left Panel: Main Block Outlines */}
      <div className="col-span-3 h-full flex flex-col bg-card/30 border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-3.5 bg-muted/30 border-b border-border flex items-center justify-between shrink-0">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Main Flow Steps</span>
          <Badge className="bg-primary/10 text-primary text-[8px] font-extrabold border-none px-2 py-0.5">{orderedMainNodes.length}</Badge>
        </div>
        <div className="flex-grow overflow-y-auto p-2.5 space-y-1 scrollbar-thin select-none">
          {orderedMainNodes.map((node) => {
            const isActive = node.id === activeNodeId;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => handleMainNodeClick(node.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 p-3 rounded-xl text-left transition-all border text-xs",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary font-black shadow-md shadow-primary/10"
                    : "bg-transparent text-muted-foreground border-transparent hover:bg-muted hover:text-foreground"
                )}
              >
                {getNodeIcon(node.type ?? '')}
                <span className="truncate">{node.data.label || `Step (${node.type})`}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Middle Panel: Dialogue Script Content Sheet */}
      <div className="col-span-6 h-full flex flex-col border border-border bg-card rounded-2xl overflow-hidden shadow-sm">
        {middleNode ? (
          <>
            <div className="p-4 bg-muted/20 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                {pathHistory.length > 0 && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg"
                    onClick={handleGoBack}
                    aria-label="Go back to previous step"
                    title="Go back to previous step"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                )}
                <span className="text-xs font-black uppercase tracking-widest text-primary">
                  {middleTitle}
                </span>
                <Badge className="capitalize text-[8px] border-none font-bold bg-muted text-muted-foreground">
                  {middleNode.type || 'objection'}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                {/* Zoom controls for the dialogue text */}
                <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background/60 px-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground rounded-md disabled:opacity-40"
                    onClick={zoomOut}
                    disabled={!canZoomOut}
                    aria-label="Zoom out"
                    title="Zoom out"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </Button>
                  <button
                    type="button"
                    onClick={reset}
                    className="min-w-[34px] text-[9px] font-bold tabular-nums text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Reset zoom"
                    title="Reset zoom"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground rounded-md disabled:opacity-40"
                    onClick={zoomIn}
                    disabled={!canZoomIn}
                    aria-label="Zoom in"
                    title="Zoom in"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground rounded-md"
                    onClick={reset}
                    aria-label="Reset zoom to 100%"
                    title="Reset zoom to 100%"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </div>
                {selectedObjectionId && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground rounded-lg"
                    onClick={() => {
                      setSelectedObjectionId(null);
                      setSelectedSubObjectionIndex(null);
                    }}
                    aria-label="Close objection response"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
                {selectedActionId && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground rounded-lg"
                    onClick={() => {
                      setSelectedActionId(null);
                    }}
                    aria-label="Close action detail"
                    title="Close action detail"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            <div className="flex-grow flex flex-col min-h-0">
              {/* Scrollable Dialogue Viewport */}
              <div ref={scrollContainerRef} className="flex-grow overflow-y-auto p-7 min-h-0 pr-2 space-y-4 scrollbar-thin select-text">
                {middleNode.type === 'objection' && enteredObjectionFromChoice && selectedSubObjectionIndex === null && subObjections.length > 1 ? (
                  /* Show list of sub-objections first in the readable area */
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                      Select which objection fits:
                    </span>
                    <div className="grid gap-2 max-w-xl">
                      {subObjections.map((sub, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedSubObjectionIndex(idx)}
                          className="w-full text-left p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-muted/50 transition-all flex flex-col gap-1 shadow-sm"
                        >
                          <span className="text-sm font-black text-foreground">{sub.title || 'Objection Option'}</span>
                          {sub.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {sub.description.replace(/<[^>]+>/g, '')}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  middleNode.type === 'start' ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center max-w-md mx-auto select-none">
                      <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-sm animate-pulse">
                        <Phone className="h-9 w-9" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-lg font-black text-foreground uppercase tracking-wider">Ready to Initiate Call</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">Press the button below or trigger shortcut (Enter / Tab / Number 1) to start timing and begin the outreach flow.</p>
                      </div>
                      <Button
                        onClick={activeHandlers[0]}
                        className="h-12 px-10 rounded-xl font-bold uppercase tracking-wider bg-emerald-500 hover:bg-emerald-600 text-white shadow-md flex items-center gap-2 transition-all"
                      >
                        <Phone className="h-4 w-4" /> Start Call
                      </Button>
                    </div>
                  ) : middleNode.type === 'end' ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center max-w-md mx-auto select-none">
                      <div className="w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-sm">
                        <PhoneOff className="h-9 w-9" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-lg font-black text-foreground uppercase tracking-wider">Outbound Call Ended</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">Press the button below or trigger shortcut (Enter / Tab / Number 1) to end this call, log details, and proceed.</p>
                      </div>
                      <Button
                        onClick={activeHandlers[0]}
                        className="h-12 px-10 rounded-xl font-bold uppercase tracking-wider bg-rose-500 hover:bg-rose-600 text-white shadow-md flex items-center gap-2 transition-all"
                      >
                        <PhoneOff className="h-4 w-4" /> End Call
                      </Button>
                    </div>
                  ) : middleNode.type === 'action' ? (
                    <div className="flex flex-col space-y-6 select-text max-w-xl mx-auto py-4 text-center">
                      {/* Name of action and body text nicely centered at the top */}
                      <div className="space-y-3">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-500 text-xs font-bold uppercase tracking-wider">
                          {React.createElement(getActionMeta(middleNode.data?.actionType).icon, { className: "h-3.5 w-3.5" })}
                          <span>{getActionMeta(middleNode.data?.actionType).label}</span>
                        </div>
                        <h3 className="text-lg font-black text-foreground uppercase tracking-wide">
                          {middleNode.data?.label || 'Action Step'}
                        </h3>
                        {middleNode.data?.text && (
                          <div className="max-w-md mx-auto text-sm text-muted-foreground leading-relaxed italic">
                            <ScriptBodyDisplay
                              text={middleNode.data.text}
                              resolveText={resolveText}
                              highlightVariables={!resolveText}
                              zoom={zoom}
                              className="text-sm text-muted-foreground font-serif"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(selectedObjectionId || middleNode.type === 'objection') && (selectedSubObjectionIndex !== null || subObjections.length <= 1) && (
                        <span className="text-[9px] font-bold uppercase tracking-widest text-orange-500 block">
                          ➔ Viewing Objection Response
                        </span>
                      )}
                      
                      <ScriptBodyDisplay
                        text={middleText}
                        resolveText={resolveText}
                        highlightVariables={!resolveText}
                        zoom={zoom}
                        className="text-lg leading-relaxed text-foreground font-serif select-text"
                        emptyFallback={
                          <span className="italic text-muted-foreground font-serif text-base">No body content text.</span>
                        }
                      />
                    </div>
                  )
                )}
              </div>

              {/* Fixed Footer (Buttons) */}
              <div className="p-7 pt-4 border-t border-border mt-auto shrink-0 select-none bg-card flex items-center justify-between gap-4">
                {/* Left side: Back button */}
                <div className="min-w-[100px]">
                  {pathHistory.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={handleGoBack}
                      className="h-10 px-6 rounded-xl text-xs font-bold uppercase tracking-wider border-border hover:bg-muted text-muted-foreground hover:text-foreground shadow-sm flex items-center gap-1.5"
                    >
                      <ChevronLeft className="h-4 w-4" /> Back
                    </Button>
                  )}
                </div>

                {/* Right side: Next Step / Option Buttons */}
                <div className="flex items-center gap-2 justify-end ml-auto flex-wrap max-w-[75%]">
                  {/* 1. If viewing an objection (either sidebar or choice), show 'Continue to Next Step' */}
                  {(selectedObjectionId || middleNode.type === 'objection') && (selectedSubObjectionIndex !== null || subObjections.length <= 1) && (
                    <Button
                      onClick={handleNextStepAfterObjection}
                      className="h-10 px-8 min-w-[150px] rounded-xl font-bold uppercase tracking-wider bg-orange-500 hover:bg-orange-600 text-white shadow-sm flex items-center justify-center gap-1.5"
                    >
                      Continue to Next Step <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {/* 2. Choice branches (if active node is question and NOT viewing objection) */}
                  {!selectedObjectionId && middleNode.type === 'question' && (
                    <div className="flex flex-wrap gap-2 justify-end items-center">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mr-1">Choose Response Branch:</span>
                      {((middleNode.data.options as string[]) || ['Yes', 'No']).map((opt, idx) => {
                        const matchingEdge = edges.find(e => e.source === middleNode.id && e.sourceHandle === `option-${idx}`);
                        const targetExists = matchingEdge && nodes.some(n => n.id === matchingEdge.target);
                        return (
                          <Button
                            key={idx}
                            onClick={() => matchingEdge && advanceTo(matchingEdge.target)}
                            disabled={!targetExists}
                            className="h-10 px-8 min-w-[120px] rounded-xl text-xs font-bold uppercase tracking-wider border-amber-500 bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                          >
                            {opt}
                          </Button>
                        );
                      })}
                    </div>
                  )}

                  {/* 3. Continue button for normal blocks (if NOT question and NOT viewing objection and nextMainEdge exists) */}
                  {!selectedObjectionId && middleNode.type !== 'question' && middleNode.type !== 'objection' && middleNode.type !== 'start' && middleNode.type !== 'end' && middleNode.type !== 'action' && nextMainEdge && (
                    <Button
                      onClick={() => advanceTo(nextMainEdge.target)}
                      className="h-10 px-8 min-w-[150px] rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5"
                    >
                      Continue Flow <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {/* 3b. Continue button for action blocks (if NOT question, NOT objection, is action, and nextEdgeFromAction exists) */}
                  {!selectedObjectionId && middleNode.type === 'action' && nextEdgeFromAction && (
                    <Button
                      onClick={() => advanceTo(nextEdgeFromAction.target)}
                      className="h-10 px-8 min-w-[150px] rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5"
                    >
                      Continue Flow <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {/* 4. Action edges (if active node is not question, not viewing objection) */}
                  {!selectedObjectionId && middleNode.type !== 'objection' && actionEdges.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-end items-center border-t border-border/40 pt-2 w-full">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mr-1">Available Actions:</span>
                      {actionEdges.map((edge) => {
                        const actionNode = nodes.find(n => n.id === edge.target);
                        if (!actionNode) return null;
                        return (
                          <Button
                            key={actionNode.id}
                            variant="secondary"
                            disabled={isTriggered(actionNode.id)}
                            onClick={() => advanceTo(actionNode.id)}
                            className="h-10 px-8 min-w-[120px] rounded-xl text-[10px] font-bold uppercase tracking-wider gap-1 border-indigo-500/20 bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 disabled:opacity-50 shadow-sm"
                          >
                            {isTriggered(actionNode.id) ? '✓ Triggered: ' : '➔ Trigger Action: '}{actionNode.data.label}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-grow flex items-center justify-center p-6 text-center text-xs text-muted-foreground italic">
            Select a block from the left panel to begin.
          </div>
        )}
      </div>

      {/* 3. Right Panel: Tabbed Objections & Actions Workspace */}
      <div className="col-span-3 h-full flex flex-col border border-border bg-card/30 rounded-2xl overflow-hidden shadow-sm">
        <Tabs value={rightTab} onValueChange={(val: string) => setRightTab(val as 'objections' | 'actions' | 'outcomes')} className="h-full flex flex-col m-0 p-0">
          <TabsList className="bg-muted/40 border-b border-border h-11 p-0.5 rounded-none gap-1 shrink-0">
            <TabsTrigger 
              value="objections" 
              className="flex-grow rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-[10px] font-bold uppercase tracking-wider h-full transition-colors"
            >
              Objections
            </TabsTrigger>
            <TabsTrigger
              value="actions"
              className="flex-grow rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-[10px] font-bold uppercase tracking-wider h-full transition-colors"
            >
              Actions
            </TabsTrigger>
            <TabsTrigger
              value="outcomes"
              className="flex-grow rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-[10px] font-bold uppercase tracking-wider h-full transition-colors"
            >
              Outcomes
            </TabsTrigger>
          </TabsList>

          {/* Objections Tab Content */}
          <TabsContent value="objections" className="flex-grow overflow-hidden flex flex-col m-0 p-3 outline-none">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-border shrink-0 select-none">
              <span className="text-[9px] font-bold text-muted-foreground uppercase">
                {filterRelatedObjections ? 'Related Objections' : 'All Objections'}
              </span>
              <button
                type="button"
                onClick={() => setFilterRelatedObjections(!filterRelatedObjections)}
                className="text-[9px] font-black text-primary hover:underline"
              >
                {filterRelatedObjections ? 'Show All' : 'Filter Related'}
              </button>
            </div>

            <div className="flex-grow overflow-y-auto space-y-2.5 scrollbar-thin select-none">
              {displayedObjections.length > 0 ? (
                displayedObjections.map((obj) => {
                  const subObjections = getSubObjections(obj);
                  return (
                    <div key={obj.id} className="space-y-1">
                      <div className="flex items-center gap-1.5 px-1.5 py-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                        <Layers className="h-3 w-3 text-muted-foreground" />
                        <span>{obj.data.label || 'Objections'}</span>
                      </div>
                      <div className="pl-3 border-l border-border/60 ml-2.5 space-y-1">
                        {subObjections.map((sub, idx) => {
                          const isSelected = obj.id === selectedObjectionId && idx === selectedSubObjectionIndex;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleObjectionClick(obj.id, idx)}
                              className={cn(
                                "w-full flex items-start gap-2 p-2 rounded-xl text-left border text-[11px] transition-all",
                                isSelected
                                  ? "bg-orange-500/10 text-orange-500 border-orange-500/40 font-bold"
                                  : "bg-card hover:bg-muted text-muted-foreground border-border/60 hover:text-foreground"
                              )}
                            >
                              <Info className="h-3.5 w-3.5 text-orange-400 shrink-0 mt-0.5" />
                              <span className="truncate">{sub.title || `Objection ${idx + 1}`}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 text-[11px] text-muted-foreground italic">
                  No objections found for this step.
                </div>
              )}
            </div>
          </TabsContent>

          {/* Actions Tab Content */}
          <TabsContent value="actions" className="flex-grow overflow-hidden flex flex-col m-0 p-3 outline-none">
            {middleNode?.type === 'action' ? (
              <div className="flex-grow flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-border shrink-0 select-none">
                  <button
                    type="button"
                    onClick={() => { setSelectedActionId(null); }}
                    className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-3 w-3" /> Back
                  </button>
                  <span className="text-[9px] font-bold uppercase truncate max-w-[150px] text-indigo-500">
                    {middleNode.data.label || 'Action'}
                  </span>
                </div>
                <div className="flex-grow overflow-y-auto pr-1 scrollbar-thin">
                  {renderMiddleActionConfig()}
                </div>
              </div>
            ) : (
              renderTriggerTab('action')
            )}
          </TabsContent>

          {/* Outcomes Tab Content */}
          <TabsContent value="outcomes" className="flex-grow overflow-hidden flex flex-col m-0 p-3 outline-none">
            {renderTriggerTab('outcome')}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
