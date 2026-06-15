'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { useCallCampaigns, useCallQueueItems } from '@/lib/call-centre-hooks';
import { 
  lockQueueItemAction, 
  releaseQueueItemAction, 
  submitCallOutcomeAction, 
  updateNotesDraftAction,
  skipQueueItemAction,
  deferQueueItemAction,
  scheduleCallbackAction
} from '@/lib/call-centre-actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, updateDoc } from 'firebase/firestore';
import type { ScriptNode } from '@/lib/types';
import { 
  isJsonGraph, 
  parseGraph, 
  getNextNodeChoices, 
  resolveScriptVariables 
} from '@/lib/call-centre-graph';
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  Play, 
  Pause, 
  FileText, 
  Check, 
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  PhoneOff,
  User,
  AlertTriangle,
  FolderOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface WorkspaceClientProps {
  campaignId: string;
}

export function WorkspaceClient({ campaignId }: WorkspaceClientProps) {
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace() as any;
  const { toast } = useToast();

  const { campaigns } = useCallCampaigns(activeWorkspaceId);
  const { queueItems, isLoading: queueLoading } = useCallQueueItems(campaignId);

  const campaign = React.useMemo(() => campaigns.find(c => c.id === campaignId), [campaigns, campaignId]);

  // Selected queue item state
  const [currentItemId, setCurrentItemId] = React.useState<string | null>(null);
  
  // Timer States
  const [seconds, setSeconds] = React.useState(0);
  const [isTimerActive, setIsTimerActive] = React.useState(false);

  // Form states
  const [notes, setNotes] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [isActionsLoading, setIsActionsLoading] = React.useState(false);

  // Callback Date picker state
  const [showCallbackPicker, setShowCallbackPicker] = React.useState(false);
  const [callbackDate, setCallbackDate] = React.useState('');

  // Queue sorting & filtering states
  const [sortOption, setSortOption] = React.useState<'default' | 'attempts-asc' | 'attempts-desc' | 'active' | 'alpha'>('default');
  const [filterOption, setFilterOption] = React.useState<'all' | 'institution' | 'person' | 'family'>('all');

  // Interactive node integration states
  const [collectedAnswers, setCollectedAnswers] = React.useState<Record<string, any>>(() => ({}));
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [complianceChecked, setComplianceChecked] = React.useState(false);
  const [actionStatus, setActionStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [objectionSearch, setObjectionSearch] = React.useState('');
  const [guardrailBypassed, setGuardrailBypassed] = React.useState(false);

  const wrapHref = (href: string) => {
    if (!activeWorkspaceId) return href;
    const separator = href.includes('?') ? '&' : '?';
    return `${href}${separator}track=${activeWorkspaceId}`;
  };

  // ─── Filter Queue Groups ───────────────────────────────────────────────────

  const groupedQueue = React.useMemo(() => {
    const pending = queueItems.filter(item => item.status === 'scheduled' || item.status === 'in_progress');
    const completed = queueItems.filter(item => item.status === 'completed');
    const skipped = queueItems.filter(item => item.status === 'skipped');
    const callbacks = queueItems.filter(item => item.status === 'callback_scheduled');
    const deferred = queueItems.filter(item => item.status === 'deferred');
    return { pending, completed, skipped, callbacks, deferred };
  }, [queueItems]);

  // Processed Pending Queue (Apply Filter + Sort + Virtual Slicing)
  const processedPendingQueue = React.useMemo(() => {
    let items = [...groupedQueue.pending];

    // Apply Filter
    if (filterOption !== 'all') {
      items = items.filter(item => item.entityType === filterOption);
    }

    // Apply Sort
    if (sortOption === 'attempts-asc') {
      items.sort((a, b) => (a.attempts || 0) - (b.attempts || 0));
    } else if (sortOption === 'attempts-desc') {
      items.sort((a, b) => (b.attempts || 0) - (a.attempts || 0));
    } else if (sortOption === 'active') {
      items.sort((a, b) => {
        const timeA = a.lastAttemptAt ? new Date(a.lastAttemptAt).getTime() : 0;
        const timeB = b.lastAttemptAt ? new Date(b.lastAttemptAt).getTime() : 0;
        return timeB - timeA;
      });
    } else if (sortOption === 'alpha') {
      items.sort((a, b) => (a.entityName || '').localeCompare(b.entityName || ''));
    }

    // Slice to 150 items to optimize browser DOM size
    return items.slice(0, 150);
  }, [groupedQueue.pending, sortOption, filterOption]);

  // Current Active Queue Item
  const currentItem = React.useMemo(() => {
    if (currentItemId) {
      return queueItems.find(item => item.id === currentItemId);
    }
    // Default to the first pending/scheduled item in the processed queue list
    return processedPendingQueue[0] || null;
  }, [queueItems, currentItemId, processedPendingQueue]);

  // Auto-set currentItemId on load or advance
  React.useEffect(() => {
    if (currentItem && currentItem.id !== currentItemId) {
      setCurrentItemId(currentItem.id);
    }
  }, [currentItem, currentItemId]);

  // ─── Lock Management ───────────────────────────────────────────────────────

  React.useEffect(() => {
    if (!currentItemId || !activeWorkspaceId || !user) return;

    const lockItem = async () => {
      const lockRes = await lockQueueItemAction(currentItemId, activeWorkspaceId, user.uid);
      if (!lockRes.success) {
        toast({ variant: 'destructive', title: 'Concurrent User Alert', description: lockRes.error });
      } else {
        // Start call timer automatically on lock
        setSeconds(0);
        setIsTimerActive(true);
      }
    };

    lockItem();

    const handleUnload = () => {
      // best effort unlock on tab close
      releaseQueueItemAction(currentItemId, activeWorkspaceId, user.uid);
    };
    window.addEventListener('beforeunload', handleUnload);

    // Release lock on unmount or item change
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      releaseQueueItemAction(currentItemId, activeWorkspaceId, user.uid);
    };
  }, [currentItemId, activeWorkspaceId, user]);

  // ─── Call Timer Effect ─────────────────────────────────────────────────────

  React.useEffect(() => {
    let interval: any = null;
    if (isTimerActive) {
      interval = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerActive]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ─── Note Drafts & Local Backup Recovery ───────────────────────────────────

  // Load draft notes on item change
  React.useEffect(() => {
    if (!currentItem) return;
    
    // Check local storage recovery backup first
    const backupKey = `workspace:call-draft-${currentItem.id}`;
    const backup = localStorage.getItem(backupKey);
    
    if (backup) {
      setNotes(backup);
      toast({ title: 'Draft Notes Recovered', description: 'Restored un-saved draft text from your local browser backup.' });
    } else {
      setNotes(currentItem.notesDraft || '');
    }
  }, [currentItem]);

  // Refs to track current state for immediate flush on change/unmount
  const notesRef = React.useRef(notes);
  const currentItemIdRef = React.useRef(currentItem?.id);
  const activeWorkspaceIdRef = React.useRef(activeWorkspaceId);
  const userRef = React.useRef(user);
  const isSubmittingOutcomeRef = React.useRef(false);

  React.useEffect(() => { notesRef.current = notes; }, [notes]);
  React.useEffect(() => { currentItemIdRef.current = currentItem?.id; }, [currentItem?.id]);
  React.useEffect(() => { activeWorkspaceIdRef.current = activeWorkspaceId; }, [activeWorkspaceId]);
  React.useEffect(() => { userRef.current = user; }, [user]);

  const flushNotes = React.useCallback(async (itemId: string, noteVal: string) => {
    if (!itemId || !activeWorkspaceIdRef.current || !userRef.current) return;
    try {
      await updateNotesDraftAction(itemId, noteVal, activeWorkspaceIdRef.current, userRef.current.uid);
    } catch (err) {
      console.error('[WORKSPACE_CLIENT] Failed to flush notes draft:', err);
    }
  }, []);

  // Flush notes on contact switch or unmount
  React.useEffect(() => {
    const prevItemId = currentItemIdRef.current;
    return () => {
      if (prevItemId && notesRef.current && !isSubmittingOutcomeRef.current) {
        flushNotes(prevItemId, notesRef.current);
      }
    };
  }, [currentItem?.id, flushNotes]);

  // Debounced auto-save notes draft to database
  React.useEffect(() => {
    if (!currentItem || !activeWorkspaceId || !user) return;
    
    // Save backup to local storage immediately
    const backupKey = `workspace:call-draft-${currentItem.id}`;
    localStorage.setItem(backupKey, notes);

    const timeout = setTimeout(async () => {
      await updateNotesDraftAction(currentItem.id, notes, activeWorkspaceId, user.uid);
    }, 2000); // 2 second debounce

    return () => clearTimeout(timeout);
  }, [notes, currentItem, activeWorkspaceId, user]);

  // ─── Query Entity Contact History ──────────────────────────────────────────

  const activitiesQuery = useMemoFirebase(() => {
    if (!firestore || !currentItem?.entityId) return null;
    return query(
      collection(firestore, 'activities'),
      where('entityId', '==', currentItem.entityId),
      orderBy('timestamp', 'desc')
    );
  }, [firestore, currentItem?.entityId]);
  
  const { data: contactHistoryData } = useCollection<any>(activitiesQuery);
  const contactHistory = contactHistoryData || [];

  const dealsQuery = useMemoFirebase(() => {
    if (!firestore || !currentItem?.entityId) return null;
    return query(
      collection(firestore, 'deals'),
      where('entityId', '==', currentItem.entityId)
    );
  }, [firestore, currentItem?.entityId]);

  const { data: dealsData, isLoading: dealsLoading } = useCollection<any>(dealsQuery);

  const contactDeals = React.useMemo(() => {
    if (!dealsData) return [];
    // Sort deals locally to prevent composite index requirement in Firestore
    return [...dealsData].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [dealsData]);

  // ─── Resolve Call Script Placeholders ──────────────────────────────────────

  const entityRef = useMemoFirebase(() => {
    if (!firestore || !currentItem?.entityId) return null;
    return doc(firestore, 'entities', currentItem.entityId);
  }, [firestore, currentItem?.entityId]);

  const { data: entityData } = useDoc<any>(entityRef);

  const scriptGraph = React.useMemo(() => {
    const scriptBody = campaign?.scriptSnapshot || '';
    return parseGraph(scriptBody);
  }, [campaign?.scriptSnapshot]);

  const isBranching = React.useMemo(() => {
    return isJsonGraph(campaign?.scriptSnapshot);
  }, [campaign?.scriptSnapshot]);

  // Active node state for branching scripts
  const [currentNodeId, setCurrentNodeId] = React.useState<string | null>(null);
  const [pathHistory, setPathHistory] = React.useState<string[]>([]); // list of node IDs traversed

  // Reset navigation states when contact changes or script changes
  React.useEffect(() => {
    if (scriptGraph && scriptGraph.nodes.length > 0) {
      const startNode = scriptGraph.nodes.find(n => n.type === 'start') || scriptGraph.nodes[0];
      setCurrentNodeId(startNode?.id || null);
      setPathHistory([]);
    } else {
      setCurrentNodeId(null);
      setPathHistory([]);
    }
    setCollectedAnswers({});
    setValidationError(null);
    setComplianceChecked(false);
    setActionStatus('idle');
    setActionError(null);
    setGuardrailBypassed(false);
  }, [currentItem?.id, scriptGraph]);

  const handleHistoryClick = (nodeId: string, index: number) => {
    setCurrentNodeId(nodeId);
    setPathHistory(prev => prev.slice(0, index));
  };

  // Weak references to preserve state without causing stale closure updates in callback triggers
  const collectedAnswersRef = React.useRef(collectedAnswers);
  React.useEffect(() => { collectedAnswersRef.current = collectedAnswers; }, [collectedAnswers]);

  const currentNodeRef = React.useRef(currentNode);
  React.useEffect(() => { currentNodeRef.current = currentNode; }, [currentNode]);

  const handleChoiceClick = React.useCallback(async (targetNodeId: string) => {
    const activeNode = currentNodeRef.current;
    if (!activeNode) return;

    // Validation & Writeback logic for Question nodes
    if (activeNode.type === 'question' && activeNode.data.questionConfig?.fieldName) {
      const qc = activeNode.data.questionConfig;
      const fieldName = qc.fieldName;
      const value = collectedAnswersRef.current[fieldName];

      // Regular Expression Validation Pattern
      if (qc.validationPattern) {
        try {
          const regex = new RegExp(qc.validationPattern);
          if (!value || !regex.test(value.toString())) {
            setValidationError(`Input value does not match the required format pattern: ${qc.validationPattern}`);
            toast({
              variant: 'destructive',
              title: 'Validation Failed',
              description: `The input for "${fieldName}" does not match the required format.`
            });
            return;
          }
        } catch (e) {
          console.error('[WORKSPACE_CLIENT] Invalid validation regex pattern:', qc.validationPattern);
        }
      }

      setValidationError(null);

      const fieldBinding = qc.fieldBinding || 'contact';
      let castValue: any = value;
      if (qc.fieldType === 'number') {
        castValue = Number(value) || 0;
      }

      if (castValue !== undefined) {
        if (fieldBinding === 'contact' && currentItem?.entityId) {
          // Asynchronously write to contact (entities collection)
          updateDoc(doc(firestore, 'entities', currentItem.entityId), {
            [fieldName]: castValue,
            updatedAt: new Date().toISOString()
          }).catch(err => {
            console.error('[WORKSPACE_CLIENT] Failed to write-back contact field:', err);
            toast({
              variant: 'destructive',
              title: 'CRM Save Failed',
              description: `Could not save field "${fieldName}" to contact profile.`
            });
          });
        } else if (fieldBinding === 'deal' && contactDeals.length > 0) {
          // Asynchronously write to deal
          const dealId = contactDeals[0].id;
          updateDoc(doc(firestore, 'deals', dealId), {
            [fieldName]: castValue,
            updatedAt: new Date().toISOString()
          }).catch(err => {
            console.error('[WORKSPACE_CLIENT] Failed to write-back deal field:', err);
            toast({
              variant: 'destructive',
              title: 'CRM Save Failed',
              description: `Could not save field "${fieldName}" to active deal.`
            });
          });
        }
      }
    }

    setPathHistory(prev => [...prev, activeNode.id]);
    setCurrentNodeId(targetNodeId);
  }, [currentItem?.entityId, contactDeals, firestore, toast]);

  const handleGoBack = () => {
    if (pathHistory.length === 0) return;
    const newHistory = [...pathHistory];
    const prevNodeId = newHistory.pop();
    setPathHistory(newHistory);
    setCurrentNodeId(prevNodeId || null);
    setValidationError(null);
  };

  const handleObjectionClick = (nodeId: string) => {
    if (!currentNodeId) return;
    setPathHistory(prev => [...prev, currentNodeId]);
    setCurrentNodeId(nodeId);
    setValidationError(null);
  };

  // Automated Webhook Actions Trigger Effect
  React.useEffect(() => {
    if (!currentNode || currentNode.type !== 'action') return;

    let isMounted = true;
    const runAction = async () => {
      const ac = currentNode.data.actionConfig;
      if (currentNode.data.actionType === 'WEBHOOK' && ac?.webhookUrl) {
        if (isMounted) {
          setActionStatus('loading');
          setActionError(null);
        }

        try {
          const response = await fetch('/api/call-centre/webhook', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: ac.webhookUrl,
              headers: ac.webhookHeaders,
              payload: {
                campaignId,
                entityId: currentItem?.entityId,
                entityName: currentItem?.entityName,
                entityPhone: currentItem?.entityPhone,
                entityEmail: currentItem?.entityEmail,
                collectedAnswers: collectedAnswersRef.current,
                timestamp: new Date().toISOString(),
              }
            })
          });
          const result = await response.json();
          if (!isMounted) return;

          if (response.ok && result.status >= 200 && result.status < 300) {
            setActionStatus('success');
            toast({
              title: 'Webhook Success',
              description: `Successfully executed webhook action.`
            });

            // Automatically transition forward after 1.5 seconds if there's exactly one choice
            if (choices.length === 1) {
              setTimeout(() => {
                if (isMounted) {
                  handleChoiceClick(choices[0].targetNode.id);
                }
              }, 1500);
            }
          } else {
            setActionStatus('error');
            const errMsg = result.error || `Failed with status ${result.status}`;
            setActionError(errMsg);
            toast({
              variant: 'destructive',
              title: 'Webhook Failed',
              description: errMsg
            });
          }
        } catch (err: any) {
          if (!isMounted) return;
          setActionStatus('error');
          setActionError(err.message);
          toast({
            variant: 'destructive',
            title: 'Webhook Error',
            description: err.message
          });
        }
      } else {
        if (isMounted) {
          setActionStatus('success');
          if (choices.length === 1) {
            setTimeout(() => {
              if (isMounted) {
                handleChoiceClick(choices[0].targetNode.id);
              }
            }, 1000);
          }
        }
      }
    };

    runAction();

    return () => {
      isMounted = false;
    };
  }, [currentNodeId, choices, handleChoiceClick, campaignId, currentItem, toast]);

  // Pre-call Guardrails (DNC/Timezone) calculations
  const isDncContact = React.useMemo(() => {
    return entityData?.doNotCall === true || entityData?.dnc === true || entityData?.status === 'dnc';
  }, [entityData]);

  const isOutsideTimezone = React.useMemo(() => {
    if (currentNode?.type !== 'start' || !currentNode?.data?.startConfig?.checkTimezone) return false;
    const start = currentNode.data.startConfig.allowedHoursStart || "08:00";
    const end = currentNode.data.startConfig.allowedHoursEnd || "17:00";
    const current = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    return current < start || current > end;
  }, [currentNode]);

  const showGuardrailWarning = React.useMemo(() => {
    if (currentNode?.type !== 'start' || guardrailBypassed) return false;
    const checkDnc = currentNode.data.startConfig?.checkDnc;
    const checkTimezone = currentNode.data.startConfig?.checkTimezone;
    return (checkDnc && isDncContact) || (checkTimezone && isOutsideTimezone);
  }, [currentNode, guardrailBypassed, isDncContact, isOutsideTimezone]);

  // Objection Rebuttals lists
  const objectionNodes = React.useMemo(() => {
    if (!scriptGraph) return [];
    return scriptGraph.nodes.filter(n => n.type === 'objection');
  }, [scriptGraph]);

  const escapeRegExp = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const filteredObjections = React.useMemo(() => {
    if (!objectionNodes) return [];
    if (!objectionSearch.trim()) return objectionNodes;

    const searchLower = objectionSearch.toLowerCase();
    return objectionNodes.filter(node => {
      const labelMatch = node.data.label?.toLowerCase().includes(searchLower);
      const textMatch = node.data.text?.toLowerCase().includes(searchLower);
      const keywordMatch = node.data.objectionConfig?.keywordTriggers?.some((kw: string) => {
        try {
          const regex = new RegExp(escapeRegExp(kw), 'i');
          return regex.test(searchLower);
        } catch {
          return kw.toLowerCase().includes(searchLower);
        }
      });
      return labelMatch || textMatch || keywordMatch;
    });
  }, [objectionNodes, objectionSearch]);

  const currentNode = React.useMemo(() => {
    if (!currentNodeId || !scriptGraph) return null;
    return scriptGraph.nodes.find(n => n.id === currentNodeId) || null;
  }, [currentNodeId, scriptGraph]);

  const resolvedActiveNodeText = React.useMemo(() => {
    if (!currentNode) return '';
    const rawText = currentNode.data.text || '';
    return resolveScriptVariables(
      rawText,
      entityData || { name: currentItem?.entityName, email: currentItem?.entityEmail, phone: currentItem?.entityPhone },
      contactDeals?.[0] || null,
      user?.displayName || 'Akosua'
    );
  }, [currentNode, entityData, currentItem, contactDeals, user]);

  const choices = React.useMemo(() => {
    if (!currentNodeId || !scriptGraph) return [];
    return getNextNodeChoices(scriptGraph, currentNodeId);
  }, [currentNodeId, scriptGraph]);

  const renderedScript = React.useMemo(() => {
    if (!campaign || !currentItem) return '';
    const scriptBody = campaign.scriptSnapshot || '';
    return resolveScriptVariables(
      scriptBody,
      entityData || { name: currentItem.entityName, email: currentItem.entityEmail, phone: currentItem.entityPhone },
      contactDeals?.[0] || null,
      user?.displayName || 'Akosua'
    );
  }, [campaign, currentItem, entityData, contactDeals, user]);

  const getNodeBadge = (type: ScriptNode['type']) => {
    switch (type) {
      case 'start':
        return <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[8px] uppercase tracking-wider font-bold">Start</Badge>;
      case 'end':
        return <Badge className="bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[8px] uppercase tracking-wider font-bold">End</Badge>;
      case 'question':
        return <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[8px] uppercase tracking-wider font-bold">Question</Badge>;
      case 'multiple_choice':
        return <Badge className="bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[8px] uppercase tracking-wider font-bold">Choices</Badge>;
      case 'objection':
        return <Badge className="bg-orange-500/10 text-orange-500 border border-orange-500/20 text-[8px] uppercase tracking-wider font-bold">Objection</Badge>;
      case 'action':
        return <Badge className="bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 text-[8px] uppercase tracking-wider font-bold">Action</Badge>;
      case 'outcome':
        return <Badge className="bg-purple-500/10 text-purple-500 border border-purple-500/20 text-[8px] uppercase tracking-wider font-bold">Outcome</Badge>;
      default:
        return <Badge className="bg-zinc-550 text-zinc-400 border border-zinc-800 text-[8px] uppercase tracking-wider font-bold">Script Block</Badge>;
    }
  };

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleOutcomeSubmit = async (outcome: string) => {
    if (!currentItem || !activeWorkspaceId || !user) return;

    setIsSaving(true);
    setIsTimerActive(false);
    isSubmittingOutcomeRef.current = true;

    try {
      const result = await submitCallOutcomeAction({
        queueItemId: currentItem.id,
        outcome,
        notes,
        duration: seconds,
        agentName: user.displayName || 'Agent',
        workspaceId: activeWorkspaceId,
        userId: user.uid,
      });

      if (result.success) {
        // Clear local storage backup
        const backupKey = `workspace:call-draft-${currentItem.id}`;
        localStorage.removeItem(backupKey);
        
        toast({ title: 'Call Outcome Logged', description: `Outcome "${outcome}" saved. Advancing queue.` });
        
        // Clear workspace editor fields
        setNotes('');
        setSeconds(0);
        
        // Find next item
        const nextItem = processedPendingQueue.find(item => item.id !== currentItem.id);
        if (nextItem) {
          setCurrentItemId(nextItem.id);
        } else {
          setCurrentItemId(null);
          toast({ title: 'Campaign Queue Completed', description: 'All target contacts in the campaign have been called.' });
          router.push(wrapHref('/admin/messaging/call-centre'));
        }
      } else {
        toast({ variant: 'destructive', title: 'Submit Failed', description: result.error });
        setIsTimerActive(true); // resume timer on error
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
      setIsTimerActive(true);
    } finally {
      setIsSaving(false);
      isSubmittingOutcomeRef.current = false;
    }
  };

  const handleSkip = async () => {
    if (!currentItem || !activeWorkspaceId || !user) return;
    setIsActionsLoading(true);
    try {
      await skipQueueItemAction(currentItem.id, activeWorkspaceId, user.uid);
      localStorage.removeItem(`workspace:call-draft-${currentItem.id}`);
      
      const next = processedPendingQueue.find(item => item.id !== currentItem.id);
      setCurrentItemId(next ? next.id : null);
      toast({ title: 'Contact Skipped' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsActionsLoading(false);
    }
  };

  const handleDefer = async () => {
    if (!currentItem || !activeWorkspaceId || !user) return;
    setIsActionsLoading(true);
    try {
      await deferQueueItemAction(currentItem.id, activeWorkspaceId, user.uid);
      localStorage.removeItem(`workspace:call-draft-${currentItem.id}`);

      const next = processedPendingQueue.find(item => item.id !== currentItem.id);
      setCurrentItemId(next ? next.id : null);
      toast({ title: 'Contact Deferred', description: 'Contact moved to deferred queue list.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsActionsLoading(false);
    }
  };

  const handleScheduleCallback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentItem || !activeWorkspaceId || !user || !callbackDate) return;
    setIsActionsLoading(true);
    try {
      await scheduleCallbackAction(currentItem.id, callbackDate, activeWorkspaceId, user.uid);
      localStorage.removeItem(`workspace:call-draft-${currentItem.id}`);
      setShowCallbackPicker(false);
      setCallbackDate('');

      const next = processedPendingQueue.find(item => item.id !== currentItem.id);
      setCurrentItemId(next ? next.id : null);
      toast({ title: 'Callback Scheduled', description: `Scheduled callback for ${new Date(callbackDate).toLocaleString()}` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsActionsLoading(false);
    }
  };

  if (queueLoading) {
    return (
      <div className="flex items-center justify-center py-40">
        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      
      {/* ─── Top Bar Banner ────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => router.push(wrapHref('/admin/messaging/call-centre'))}
            variant="ghost"
            size="icon"
            className="rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
            aria-label="Exit workspace"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-sm font-black uppercase text-zinc-100 tracking-wider line-clamp-1">{campaign?.name || 'Call Campaign'}</h2>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
              Manual Outreach Campaign Workspace
            </p>
          </div>
        </div>

        {/* Live Call Timer */}
        <div className="flex items-center gap-3 px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </div>
          <span className="text-xs font-bold text-zinc-300">Live Call Timer</span>
          <span className="font-mono text-xs font-bold text-primary">{formatTime(seconds)}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsTimerActive(!isTimerActive)}
            className="h-6 w-6 text-zinc-400 hover:text-zinc-100 rounded"
            aria-label={isTimerActive ? "Pause call timer" : "Resume call timer"}
          >
            {isTimerActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* ─── Main Content Workspace Grid ───────────────────────────────────────── */}
      <div className="flex-grow flex overflow-hidden">
        
        {/* Left Column: Call Queue Sidebar (Width 1/4) */}
        <div className="w-80 bg-zinc-900/50 border-r border-zinc-800 flex flex-col justify-between overflow-hidden shrink-0">
          <div className="p-4 border-b border-zinc-800 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Campaign Queue</span>
              <Badge className="bg-zinc-800 border-zinc-700 text-zinc-300 font-mono text-[9px] font-bold">
                {groupedQueue.pending.length} Pending
              </Badge>
            </div>
            
            {/* Sorting and Filtering Dropdowns */}
            <div className="grid grid-cols-2 gap-2">
              <select
                value={sortOption}
                onChange={(e: any) => setSortOption(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-lg text-[10px] font-semibold text-zinc-300 p-1.5 focus:border-primary focus:ring-0 outline-none"
                aria-label="Sort queue items"
              >
                <option value="default">Default Sort</option>
                <option value="attempts-asc">Attempts: Low-High</option>
                <option value="attempts-desc">Attempts: High-Low</option>
                <option value="active">Recently Active</option>
                <option value="alpha">Alphabetical</option>
              </select>
              
              <select
                value={filterOption}
                onChange={(e: any) => setFilterOption(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-lg text-[10px] font-semibold text-zinc-300 p-1.5 focus:border-primary focus:ring-0 outline-none"
                aria-label="Filter queue items by entity type"
              >
                <option value="all">All Types</option>
                <option value="institution">Institutions</option>
                <option value="person">Persons</option>
                <option value="family">Families</option>
              </select>
            </div>
          </div>

          {/* List items (content-visibility virtual loading style) */}
          <div className="flex-grow overflow-y-auto p-3 space-y-2" style={{ contentVisibility: 'auto' }}>
            {processedPendingQueue.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 italic">No matching contacts.</div>
            ) : (
              processedPendingQueue.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setCurrentItemId(item.id)}
                  className={cn(
                    "p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between",
                    item.id === currentItemId
                      ? "bg-primary/10 border-primary text-primary shadow"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800/50 hover:border-zinc-700 hover:text-zinc-200"
                  )}
                >
                  <div className="space-y-1">
                    <p className="text-xs font-bold truncate line-clamp-1">{item.entityName}</p>
                    <p className="text-[10px] font-mono">{item.entityPhone || 'No Phone'}</p>
                  </div>
                  {item.attempts > 0 && (
                    <Badge variant="outline" className="text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-zinc-950 border-zinc-800 text-zinc-400">
                      {item.attempts} attempts
                    </Badge>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Statistics summary */}
          <div className="p-4 bg-zinc-900 border-t border-zinc-800 text-center shrink-0">
            <div className="grid grid-cols-2 gap-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              <div className="p-2 bg-zinc-950 rounded-lg">
                <p>Completed</p>
                <p className="text-sm font-black text-zinc-100">{groupedQueue.completed.length}</p>
              </div>
              <div className="p-2 bg-zinc-950 rounded-lg">
                <p>Callbacks</p>
                <p className="text-sm font-black text-amber-500">{groupedQueue.callbacks.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Center Column: Contact Profile Context & Script Text (Width 2/4) */}
        <div className="flex-grow flex flex-col justify-between overflow-y-auto p-6 space-y-6">
          
          {currentItem ? (
            <>
              {/* Contact Profile Context Panel */}
              <div className="p-5 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-zinc-100">{currentItem.entityName}</h3>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{currentItem.entityType}</p>
                    </div>
                  </div>

                  {/* OS Telephony trigger */}
                  <a 
                    href={`tel:${currentItem.entityPhone}`}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs rounded-xl shadow-lg transition-transform hover:scale-[1.02]"
                  >
                    <Phone className="h-4 w-4 fill-current animate-bounce" /> Call Contact: {currentItem.entityPhone || 'Missing phone'}
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-zinc-800 text-xs">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Mail className="h-4 w-4" />
                    <span>Email: <span className="text-zinc-200 font-medium">{currentItem.entityEmail || 'No Email'}</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400">
                    <FolderOpen className="h-4 w-4 text-primary" />
                    <span>Contact Stage: <span className="text-primary font-bold">{currentItem.status}</span></span>
                  </div>
                </div>
              </div>

              {/* Call Script Reading panel */}
              <div className="flex-grow bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-inner relative flex flex-col justify-between min-h-[300px]">
                <div className="absolute top-4 right-4 flex items-center gap-1.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Interactive Script View</span>
                </div>
                
                {isBranching ? (
                  showGuardrailWarning ? (
                    <div className="flex flex-col items-center justify-center text-center p-8 bg-zinc-900 border border-amber-500/20 rounded-2xl max-w-xl mx-auto my-6 space-y-4">
                      <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <AlertTriangle className="h-6 w-6" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-sm font-black uppercase text-amber-500 tracking-wider">Pre-Call Guardrail Alert</h3>
                        <p className="text-xs text-zinc-300 max-w-sm">
                          {currentNode?.data.startConfig?.checkDnc && isDncContact && (
                            <span>This contact is registered on the Do Not Call (DNC) list. Calling them may violate compliance regulations.</span>
                          )}
                          {currentNode?.data.startConfig?.checkTimezone && isOutsideTimezone && (
                            <span>It is currently outside the allowed contact hours ({currentNode.data.startConfig.allowedHoursStart} - {currentNode.data.startConfig.allowedHoursEnd}) for this contact's timezone.</span>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2 w-full pt-2">
                        <Button
                          onClick={handleSkip}
                          variant="outline"
                          className="flex-grow h-10 border-zinc-800 bg-zinc-950 text-xs font-bold hover:bg-zinc-900"
                        >
                          Skip Contact
                        </Button>
                        <Button
                          onClick={() => setGuardrailBypassed(true)}
                          className="flex-grow h-10 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
                        >
                          Acknowledge & Proceed
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[260px] overflow-hidden pt-4">
                      {/* Left Timeline */}
                      <div className="flex flex-col gap-2 border-r border-zinc-805 pr-4 mr-4 shrink-0 w-48 overflow-y-auto">
                        <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">Conversation Path</span>
                        {pathHistory.length === 0 ? (
                          <span className="text-[10px] text-zinc-650 italic">No steps taken yet.</span>
                        ) : (
                          <div className="space-y-4 relative pl-3 before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-[1px] before:bg-zinc-800">
                            {pathHistory.map((histNodeId, idx) => {
                              const histNode = scriptGraph?.nodes.find(n => n.id === histNodeId);
                              if (!histNode) return null;
                              return (
                                <div key={`${histNodeId}-${idx}`} className="relative flex items-center gap-2 text-[10px]">
                                  <span className="absolute -left-[10px] w-2 h-2 rounded-full bg-zinc-700 border border-zinc-950" />
                                  <button
                                    type="button"
                                    onClick={() => handleHistoryClick(histNodeId, idx)}
                                    className="text-left font-bold text-zinc-400 hover:text-primary transition-colors hover:underline truncate max-w-[130px]"
                                    title={`Jump back to ${histNode.data.label}`}
                                  >
                                    {histNode.data.label || histNode.id}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {currentNode && (
                          <div className="mt-4 pt-4 border-t border-zinc-805 pl-3 relative">
                            <span className="absolute -left-[10px] top-[22px] w-2 h-2 rounded-full bg-primary animate-pulse" />
                            <span className="text-[9px] font-black uppercase text-primary tracking-wider block">Active Node</span>
                            <span className="text-[10px] font-bold text-zinc-200 block truncate max-w-[130px]">{currentNode.data.label}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Right dialog state & choices */}
                      <div className="flex-grow flex flex-col justify-between overflow-y-auto min-h-[220px]">
                        <div className="space-y-4">
                          {currentNode && (
                            <div className="flex items-center gap-2">
                              {getNodeBadge(currentNode.type)}
                            </div>
                          )}
                          
                          {/* Node Type Specific Overlays */}
                          {currentNode?.type === 'outcome' && (
                            <div className="space-y-4 max-w-xl">
                              <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl space-y-2">
                                <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wide">Outcome Step Reached</h4>
                                <p className="text-xs text-zinc-300">
                                  The conversation has reached the outcome: <span className="font-extrabold text-purple-300">"{currentNode.data.outcomeValue}"</span>.
                                </p>
                              </div>
                              <Button
                                onClick={() => handleOutcomeSubmit(currentNode.data.outcomeValue || 'Interested')}
                                disabled={isSaving}
                                className="w-full h-11 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs rounded-xl uppercase tracking-wider shadow-lg flex items-center justify-center gap-2"
                              >
                                <Check className="h-4 w-4" /> Confirm & Save Outcome: {currentNode.data.outcomeValue}
                              </Button>
                            </div>
                          )}

                          {currentNode?.type === 'action' && (
                            <div className="space-y-4 max-w-xl">
                              <div className={cn(
                                "p-4 border rounded-xl space-y-2",
                                actionStatus === 'loading' ? "bg-primary/5 border-primary/20 text-primary" :
                                actionStatus === 'success' ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" :
                                actionStatus === 'error' ? "bg-rose-500/5 border-rose-500/20 text-rose-400" :
                                "bg-zinc-900 border-zinc-800 text-zinc-350"
                              )}>
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-bold uppercase tracking-wide">
                                    {actionStatus === 'loading' ? 'Executing Automation Action...' :
                                     actionStatus === 'success' ? 'Automation Action Completed' :
                                     actionStatus === 'error' ? 'Automation Action Failed' :
                                     'Automation Action Step'}
                                  </h4>
                                  {actionStatus === 'loading' && <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />}
                                  {actionStatus === 'success' && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                                  {actionStatus === 'error' && <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />}
                                </div>
                                <p className="text-xs text-zinc-350">
                                  This step triggers the automation action: <span className="font-extrabold">{currentNode.data.actionType?.replace('_', ' ')}</span>.
                                </p>
                                {actionError && (
                                  <p className="text-[11px] text-rose-400 font-mono border-t border-rose-500/10 pt-2 mt-2">
                                    Error: {actionError}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {currentNode?.data?.text && (
                            <div className="text-base font-serif text-zinc-200 leading-relaxed max-w-2xl pr-4 whitespace-pre-line select-text">
                              {resolvedActiveNodeText}
                            </div>
                          )}

                          {/* Dynamic Compliance Checkbox for Say nodes */}
                          {currentNode?.type === 'say' && currentNode.data.sayConfig?.complianceVerify && (
                            <div className="mt-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-start gap-3 max-w-xl">
                              <input 
                                type="checkbox"
                                id="compliance-checkbox"
                                checked={complianceChecked}
                                onChange={(e) => setComplianceChecked(e.target.checked)}
                                className="mt-0.5 rounded border-zinc-800 bg-zinc-950 text-primary focus:ring-0"
                              />
                              <label htmlFor="compliance-checkbox" className="text-xs text-zinc-350 cursor-pointer select-none">
                                <span className="font-extrabold text-amber-400 block mb-1">Compliance Verification Required</span>
                                I verify that I have read the compliance statement exactly as written.
                              </label>
                            </div>
                          )}

                          {/* Dynamic Input Fields rendering for Question nodes */}
                          {currentNode?.type === 'question' && currentNode.data.questionConfig?.fieldName && (
                            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl max-w-xl space-y-3 shadow-inner">
                              <div className="flex justify-between items-center">
                                <Label htmlFor="question-input" className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
                                  Response for <span className="text-primary font-mono">{currentNode.data.questionConfig.fieldName}</span>
                                </Label>
                                <Badge variant="outline" className="text-[8px] font-bold uppercase tracking-wider border-zinc-800 text-zinc-400 bg-zinc-900/40">
                                  {currentNode.data.questionConfig.fieldType || 'text'}
                                </Badge>
                              </div>
                              
                              {currentNode.data.questionConfig.fieldType === 'select' ? (
                                <select
                                  id="question-input"
                                  value={collectedAnswers[currentNode.data.questionConfig.fieldName] || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setCollectedAnswers(prev => ({ ...prev, [currentNode.data.questionConfig!.fieldName!]: val }));
                                    setValidationError(null);
                                  }}
                                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg text-xs p-2 focus:border-primary focus:ring-0 outline-none"
                                >
                                  <option value="">-- Choose Option --</option>
                                  {currentNode.data.questionConfig.selectOptions?.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ) : currentNode.data.questionConfig.fieldType === 'datepicker' ? (
                                <Input
                                  id="question-input"
                                  type="date"
                                  value={collectedAnswers[currentNode.data.questionConfig.fieldName] || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setCollectedAnswers(prev => ({ ...prev, [currentNode.data.questionConfig!.fieldName!]: val }));
                                    setValidationError(null);
                                  }}
                                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded-lg h-9"
                                />
                              ) : currentNode.data.questionConfig.fieldType === 'number' ? (
                                <Input
                                  id="question-input"
                                  type="number"
                                  placeholder="Enter numeric response..."
                                  value={collectedAnswers[currentNode.data.questionConfig.fieldName] || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setCollectedAnswers(prev => ({ ...prev, [currentNode.data.questionConfig!.fieldName!]: val }));
                                    setValidationError(null);
                                  }}
                                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded-lg h-9"
                                />
                              ) : (
                                <Input
                                  id="question-input"
                                  type="text"
                                  placeholder="Type response..."
                                  value={collectedAnswers[currentNode.data.questionConfig.fieldName] || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setCollectedAnswers(prev => ({ ...prev, [currentNode.data.questionConfig!.fieldName!]: val }));
                                    setValidationError(null);
                                  }}
                                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded-lg h-9"
                                />
                              )}
                              {currentNode.data.questionConfig.validationPattern && (
                                <p className="text-[9px] text-zinc-500 font-mono">
                                  Validation Regex: {currentNode.data.questionConfig.validationPattern}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Field level Validation Error banner */}
                          {validationError && (
                            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs flex items-center gap-2 max-w-xl">
                              <AlertTriangle className="h-4 w-4 shrink-0" />
                              <span>{validationError}</span>
                            </div>
                          )}
                        </div>

                        <div className="pt-6 border-t border-zinc-800/80 mt-6 space-y-3 shrink-0">
                          {choices.length > 0 ? (
                            <>
                              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Choose Customer's Response:</span>
                              <div className="flex flex-wrap gap-2">
                                {choices.map((choice) => (
                                  <Button
                                    key={choice.edgeId}
                                    type="button"
                                    disabled={currentNode?.type === 'say' && currentNode.data.sayConfig?.complianceVerify && !complianceChecked}
                                    onClick={() => handleChoiceClick(choice.targetNode.id)}
                                    className="h-9 px-4 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-primary/20 hover:border-primary hover:text-primary transition-all text-xs font-black"
                                  >
                                    {choice.edgeLabel}
                                  </Button>
                                ))}
                              </div>
                            </>
                          ) : (
                            currentNode?.type !== 'outcome' && (
                              <div className="text-xs text-zinc-500 italic">
                                No further choices. You can log the outcome in the right panel to complete this call.
                              </div>
                            )
                          )}
                          
                          {pathHistory.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              onClick={handleGoBack}
                              className="h-8 text-[10px] font-bold text-zinc-400 hover:text-zinc-100 rounded-lg gap-1 px-2.5 mt-2"
                            >
                              <ChevronLeft className="h-3.5 w-3.5" /> Back to Previous Step
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="text-base font-serif text-zinc-200 leading-relaxed max-w-3xl pr-4 whitespace-pre-line select-text pt-4">
                    {renderedScript}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-12 bg-zinc-900/20 border border-dashed border-zinc-800 rounded-2xl">
              <PhoneOff className="h-10 w-10 text-zinc-600 mb-3" />
              <h3 className="text-sm font-bold text-zinc-400">No active queue contact</h3>
              <p className="text-xs text-zinc-500 max-w-xs mt-1">Select a contact from the queue list on the left to begin.</p>
            </div>
          )}

        </div>

        {/* Right Column: Outcomes, Notes & History (Width 1/4) */}
        <div className="w-96 bg-zinc-900/50 border-l border-zinc-800 flex flex-col overflow-hidden shrink-0">
          
          <Tabs defaultValue="notes" className="flex-grow flex flex-col overflow-hidden">
            <TabsList className="bg-zinc-900 border-b border-zinc-800 h-12 p-1 rounded-none shrink-0 flex">
              <TabsTrigger value="notes" className="flex-grow rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-zinc-950 text-xs font-bold">Notes</TabsTrigger>
              <TabsTrigger value="deals" className="flex-grow rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-zinc-950 text-xs font-bold">Deals ({contactDeals.length})</TabsTrigger>
              <TabsTrigger value="history" className="flex-grow rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-zinc-950 text-xs font-bold">Timeline ({contactHistory.length})</TabsTrigger>
              <TabsTrigger value="rebuttals" className="flex-grow rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-zinc-950 text-xs font-bold">Rebuttals ({objectionNodes.length})</TabsTrigger>
            </TabsList>

            {/* Notes & Outcomes Tab */}
            <TabsContent value="notes" className="flex-grow flex flex-col justify-between overflow-y-auto p-5 space-y-6">
              
              {currentItem ? (
                <>
                  {/* Notes input */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Call Notes & Log</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Document discussion here… Notes auto-save to database in real-time."
                      className="min-h-[160px] bg-zinc-950 border-zinc-800 text-zinc-100 rounded-xl resize-none leading-relaxed p-3 focus:border-primary focus:ring-0"
                    />
                  </div>

                  {/* Secondary Queue controls */}
                  <div className="space-y-2 border-t border-zinc-800 pt-4">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Secondary Actions</span>
                    
                    {showCallbackPicker ? (
                      <form onSubmit={handleScheduleCallback} className="space-y-3 p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
                        <Label className="text-[9px] font-bold text-zinc-400 uppercase">Select Callback Date/Time</Label>
                        <Input
                          type="datetime-local"
                          value={callbackDate}
                          onChange={(e) => setCallbackDate(e.target.value)}
                          className="h-9 bg-zinc-900 border-zinc-800 text-zinc-200 text-xs rounded-lg"
                          required
                        />
                        <div className="flex gap-2">
                          <Button type="submit" disabled={isActionsLoading} size="sm" className="h-8 rounded-lg font-bold text-[10px] flex-grow">Confirm</Button>
                          <Button type="button" onClick={() => setShowCallbackPicker(false)} variant="outline" size="sm" className="h-8 rounded-lg border-zinc-800 text-[10px] flex-grow">Cancel</Button>
                        </div>
                      </form>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          onClick={() => setShowCallbackPicker(true)}
                          variant="outline"
                          disabled={isActionsLoading}
                          className="h-9 text-[10px] font-bold rounded-xl border-zinc-800 bg-zinc-900 hover:bg-zinc-800"
                        >
                          Callback
                        </Button>
                        <Button
                          onClick={handleDefer}
                          variant="outline"
                          disabled={isActionsLoading}
                          className="h-9 text-[10px] font-bold rounded-xl border-zinc-800 bg-zinc-900 hover:bg-zinc-800"
                        >
                          Defer Call
                        </Button>
                        <Button
                          onClick={handleSkip}
                          variant="outline"
                          disabled={isActionsLoading}
                          className="h-9 text-[10px] font-bold rounded-xl border-zinc-800 bg-zinc-900 hover:bg-zinc-800"
                        >
                          Skip
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Call Outcomes grid buttons */}
                  <div className="space-y-3 border-t border-zinc-800 pt-4">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Select Outcome (Completes Call)</span>
                    <div className="grid grid-cols-2 gap-2">
                      {campaign?.outcomes?.map(out => (
                        <Button
                          key={out}
                          onClick={() => handleOutcomeSubmit(out)}
                          disabled={isSaving}
                          className="h-11 font-bold text-xs rounded-xl shadow-md transition-all hover:scale-[1.02]"
                        >
                          {out}
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center text-xs text-zinc-500 italic py-20">No contact loaded.</div>
              )}

            </TabsContent>

            {/* Deals Tab */}
            <TabsContent value="deals" className="flex-grow overflow-y-auto p-4 space-y-3">
              {dealsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="h-6 w-6 text-primary animate-spin" />
                </div>
              ) : contactDeals.length === 0 ? (
                <p className="text-xs text-zinc-500 italic text-center py-20">No active CRM deals found for this contact.</p>
              ) : (
                <div className="space-y-3">
                  {contactDeals.map((deal: any) => (
                    <div key={deal.id} className="p-3 bg-zinc-950 border border-zinc-800/80 rounded-xl space-y-2">
                      <div className="flex justify-between items-start">
                        <h4 className="text-xs font-bold text-zinc-100 line-clamp-1">{deal.name}</h4>
                        <Badge variant="outline" className={cn(
                          "text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                          deal.status === 'won' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                          deal.status === 'lost' ? "bg-rose-500/10 border-rose-500/20 text-rose-400" :
                          "bg-blue-500/10 border-blue-500/20 text-blue-400"
                        )}>
                          {deal.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-zinc-400 font-medium">
                        <span>Stage: <span className="text-zinc-200">{deal.stageName || 'Unknown'}</span></span>
                        <span className="font-mono text-zinc-100 font-bold">GHS {deal.value?.toLocaleString() || '0'}</span>
                      </div>
                      {deal.expectedCloseDate && (
                        <p className="text-[8px] text-zinc-500 font-medium uppercase">Expected Close: {new Date(deal.expectedCloseDate).toLocaleDateString()}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="flex-grow overflow-y-auto p-4 space-y-3">
              {contactHistory.length === 0 ? (
                <p className="text-xs text-zinc-500 italic text-center py-20">No historical CRM activities found for this contact.</p>
              ) : (
                <div className="relative border-l border-zinc-800 pl-4 ml-2 space-y-6 py-2">
                  {contactHistory.map((act: any) => (
                    <div key={act.id} className="relative space-y-1">
                      {/* Dot Indicator */}
                      <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-zinc-950" />
                      
                      <div className="flex items-center justify-between text-[9px] font-bold text-zinc-400">
                        <Badge variant="outline" className="text-[8px] font-bold tracking-wider uppercase border-zinc-800 text-zinc-300 bg-zinc-900/50">
                          {act.type.replace('_', ' ')}
                        </Badge>
                        <span>{new Date(act.timestamp).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-zinc-200 leading-normal">{act.description}</p>
                      {act.metadata?.notes && (
                        <div className="p-2 bg-zinc-900/50 border border-zinc-800/50 rounded-lg text-[10px] text-zinc-400 italic">
                          Notes: {act.metadata.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Rebuttals & Objections Tab */}
            <TabsContent value="rebuttals" className="flex-grow overflow-y-auto p-4 space-y-4 flex flex-col">
              <div className="space-y-3 flex-grow overflow-y-auto">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Objection Rebuttals Quick-Access</span>
                
                <Input
                  type="text"
                  placeholder="Search objections by keyword..."
                  value={objectionSearch}
                  onChange={(e) => setObjectionSearch(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-zinc-150 text-xs rounded-xl h-9"
                />
                
                {filteredObjections.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic text-center py-20">No matching objections found.</p>
                ) : (
                  <div className="space-y-2">
                    {filteredObjections.map((node) => (
                      <div 
                        key={node.id} 
                        onClick={() => handleObjectionClick(node.id)}
                        className={cn(
                          "p-3 rounded-xl border cursor-pointer transition-all flex flex-col gap-1 text-left",
                          currentNodeId === node.id
                            ? "bg-amber-500/10 border-amber-500 text-amber-500 shadow"
                            : "bg-zinc-950 border-zinc-850 text-zinc-400 hover:bg-zinc-900 hover:border-zinc-750 hover:text-zinc-200"
                        )}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold truncate">{node.data.label || 'Objection'}</span>
                          <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[8px] font-bold uppercase tracking-wider scale-90">
                            Objection
                          </Badge>
                        </div>
                        {node.data.objectionConfig?.keywordTriggers && node.data.objectionConfig.keywordTriggers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {node.data.objectionConfig.keywordTriggers.map((kw: string) => (
                              <Badge key={kw} variant="outline" className="text-[8px] border-zinc-805 text-zinc-400 bg-zinc-900/50">
                                {kw}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

        </div>

      </div>

    </div>
  );
}
