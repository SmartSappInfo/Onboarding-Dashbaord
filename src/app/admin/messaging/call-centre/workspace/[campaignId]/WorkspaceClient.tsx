'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
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
  scheduleCallbackAction,
  executeScriptActionAction
} from '@/lib/call-centre-actions';
import { useToast } from '@/hooks/use-toast';
import { logActivity } from '@/lib/activity-logger';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, updateDoc } from 'firebase/firestore';
import type { ScriptNode, Entity, EntityContact } from '@/lib/types';
import {
  isJsonGraph,
  parseGraph,
  getNextNodeChoices,
  resolveScriptVariables,
  ScriptVariableEntity,
} from '@/lib/call-centre-graph';
import { ScriptBodyDisplay } from '../../scripts/components/ScriptBodyDisplay';
import { 
  ArrowLeft,
  ArrowRight,
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
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Clock,
  SkipForward,
  MessageSquare,
  Bookmark,
  History,
  ShieldAlert,
  Sparkles,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';

// Heavy ReactFlow-derived view — loaded only when the agent toggles to it (bundle-conditional)
const InteractiveScriptView = dynamic(
  () => import('../../scripts/components/InteractiveScriptView').then((m) => m.InteractiveScriptView),
  {
    ssr: false,
    loading: () => (
      <div className="flex-grow flex items-center justify-center text-xs text-muted-foreground">
        Loading interactive view…
      </div>
    ),
  },
);

const getOutcomeIcon = (outcome: string) => {
  const lower = outcome.toLowerCase();
  if (lower.includes('interested') && !lower.includes('not')) {
    return <Check className="h-3.5 w-3.5 mr-1.5 shrink-0 text-emerald-400" />;
  }
  if (lower.includes('not interested')) {
    return <X className="h-3.5 w-3.5 mr-1.5 shrink-0 text-rose-400" />;
  }
  if (lower.includes('no answer')) {
    return <PhoneOff className="h-3.5 w-3.5 mr-1.5 shrink-0 text-amber-400" />;
  }
  if (lower.includes('callback') || lower.includes('call back')) {
    return <Clock className="h-3.5 w-3.5 mr-1.5 shrink-0 text-cyan-400" />;
  }
  if (lower.includes('wrong number')) {
    return <AlertTriangle className="h-3.5 w-3.5 mr-1.5 shrink-0 text-red-400" />;
  }
  if (lower.includes('defer')) {
    return <Pause className="h-3.5 w-3.5 mr-1.5 shrink-0 text-indigo-400" />;
  }
  return <ChevronRight className="h-3.5 w-3.5 mr-1.5 shrink-0 text-muted-foreground" />;
};

const getOutcomeIconCollapsed = (outcome: string) => {
  const lower = outcome.toLowerCase();
  if (lower.includes('interested') && !lower.includes('not')) {
    return <Check className="h-3.5 w-3.5 text-emerald-400" />;
  }
  if (lower.includes('not interested')) {
    return <X className="h-3.5 w-3.5 text-rose-400" />;
  }
  if (lower.includes('no answer')) {
    return <PhoneOff className="h-3.5 w-3.5 text-amber-400" />;
  }
  if (lower.includes('callback') || lower.includes('call back')) {
    return <Clock className="h-3.5 w-3.5 text-cyan-400" />;
  }
  if (lower.includes('wrong number')) {
    return <AlertTriangle className="h-3.5 w-3.5 text-red-400" />;
  }
  if (lower.includes('defer')) {
    return <Pause className="h-3.5 w-3.5 text-indigo-400" />;
  }
  return <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />;
};

interface WorkspaceClientProps {
  campaignId: string;
}

export function WorkspaceClient({ campaignId }: WorkspaceClientProps) {
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace() as any;
  const { toast } = useToast();

  const { campaigns } = useCallCampaigns(activeWorkspaceId);
  const { queueItems, isLoading: queueLoading } = useCallQueueItems(campaignId);

  const campaign = React.useMemo(() => campaigns.find(c => c.id === campaignId), [campaigns, campaignId]);

  const hasCallbackOutcome = React.useMemo(() => {
    return campaign?.outcomes?.some(out => {
      const lower = out.toLowerCase();
      return lower.includes('callback') || lower.includes('call back');
    }) || false;
  }, [campaign?.outcomes]);

  const hasDeferOutcome = React.useMemo(() => {
    return campaign?.outcomes?.some(out => {
      const lower = out.toLowerCase();
      return lower.includes('defer');
    }) || false;
  }, [campaign?.outcomes]);

  useSetBreadcrumb(campaign?.name ? `${campaign.name} Workspace` : 'Workspace');

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

  // Panel collapse states
  const [isLeftCollapsed, setIsLeftCollapsed] = React.useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = React.useState(false);

  // Left panel view: 'queue' | 'completed' | 'callbacks'
  const [leftView, setLeftView] = React.useState<'queue' | 'completed' | 'callbacks'>('queue');

  // Interactive node integration states
  const [collectedAnswers, setCollectedAnswers] = React.useState<Record<string, any>>(() => ({}));
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [complianceChecked, setComplianceChecked] = React.useState(false);
  const [actionStatus, setActionStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [objectionSearch, setObjectionSearch] = React.useState('');
  const [guardrailBypassed, setGuardrailBypassed] = React.useState(false);
  const [selectedContactId, setSelectedContactId] = React.useState<string | null>(null);

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

  // Processed Pending Queue (Apply Sort + Virtual Slicing)
  const processedPendingQueue = React.useMemo(() => {
    let items = [...groupedQueue.pending];

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
  }, [groupedQueue.pending, sortOption]);

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
        // Do NOT start call timer automatically on lock; wait for start call button
        setSeconds(0);
        setIsTimerActive(false);
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
    if (!currentItemId) return;

    // Look up active item from queueItems using currentItemId
    const activeItem = queueItems.find(item => item.id === currentItemId);
    if (!activeItem) return;
    
    // Check local storage recovery backup first
    const backupKey = `workspace:call-draft-${currentItemId}`;
    const backup = localStorage.getItem(backupKey);
    
    if (backup) {
      setNotes(backup);
      toast({ title: 'Draft Notes Recovered', description: 'Restored un-saved draft text from your local browser backup.' });
    } else {
      setNotes(activeItem.notesDraft || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItemId]);

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
    
    // Prevent feedback loop: don't save if notes state already matches the db value
    if (notes === (currentItem.notesDraft || '')) return;
    
    // Save backup to local storage immediately
    const backupKey = `workspace:call-draft-${currentItem.id}`;
    localStorage.setItem(backupKey, notes);

    const timeout = setTimeout(async () => {
      await updateNotesDraftAction(currentItem.id, notes, activeWorkspaceId, user.uid);
    }, 2000); // 2 second debounce

    return () => clearTimeout(timeout);
  }, [notes, currentItem?.id, currentItem?.notesDraft, activeWorkspaceId, user]);

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

  const { data: entityData } = useDoc<ScriptVariableEntity>(entityRef);

  const scriptGraph = React.useMemo(() => {
    const scriptBody = campaign?.scriptSnapshot || '';
    return parseGraph(scriptBody);
  }, [campaign?.scriptSnapshot]);

  const isBranching = React.useMemo(() => {
    return isJsonGraph(campaign?.scriptSnapshot);
  }, [campaign?.scriptSnapshot]);

  // The interactive reference works for any script: branching graphs use their real
  // nodes; plain-text scripts use the linear fallback graph from parseGraph.
  const hasScriptNodes = scriptGraph.nodes.length > 0;

  // Active node state for branching scripts
  const [currentNodeId, setCurrentNodeId] = React.useState<string | null>(null);
  const [pathHistory, setPathHistory] = React.useState<string[]>([]); // list of node IDs traversed
  const [selectedSubObjectionIndex, setSelectedSubObjectionIndex] = React.useState<number | null>(null);
  const [enteredObjectionFromChoice, setEnteredObjectionFromChoice] = React.useState(false);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Live script display mode: the guided runner (default) or the read-only interactive reference
  const [liveScriptView, setLiveScriptView] = React.useState<'guided' | 'interactive'>('guided');
  // Action/outcome node ids already triggered for the current contact (prevents double-firing).
  const [triggeredNodeIds, setTriggeredNodeIds] = React.useState<Set<string>>(() => new Set());

  // Switching to interactive mode collapses both side panels (and the contact card is
  // hidden via render) to maximise reading room; switching back to guided restores them.
  const toggleLiveScriptView = React.useCallback(() => {
    const next = liveScriptView === 'guided' ? 'interactive' : 'guided';
    const collapse = next === 'interactive';
    setLiveScriptView(next);
    setIsLeftCollapsed(collapse);
    setIsRightCollapsed(collapse);
  }, [liveScriptView]);

  const currentNode = React.useMemo(() => {
    if (!currentNodeId || !scriptGraph) return null;
    return scriptGraph.nodes.find(n => n.id === currentNodeId) || null;
  }, [currentNodeId, scriptGraph]);

  const subObjections = React.useMemo(() => {
    if (currentNode?.type !== 'objection') return [];
    return (currentNode.data as any)?.objectionConfig?.objections || [
      { title: currentNode.data.label || 'Objection', description: currentNode.data.text || '' }
    ];
  }, [currentNode]);

  const currentContact = React.useMemo((): EntityContact | null => {
    const contacts = entityData?.entityContacts || [];
    if (selectedContactId) {
      return contacts.find(c => c.id === selectedContactId) || null;
    }
    return contacts.find(c => c.isPrimary) || contacts[0] || null;
  }, [entityData, selectedContactId]);

  // Single source of truth for substituting the current contact + caller into a script body.
  // Reused by the guided runner and the interactive reference view.
  const resolveLiveText = React.useCallback((raw: string) => resolveScriptVariables(
    raw,
    entityData || { name: currentItem?.entityName, email: currentItem?.entityEmail, phone: currentItem?.entityPhone },
    contactDeals?.[0] || null,
    user?.displayName || 'Agent',
    currentContact
  ), [entityData, currentItem, contactDeals, user, currentContact]);

  const resolvedActiveNodeText = React.useMemo(
    () => resolveLiveText(currentNode?.data.text || ''),
    [resolveLiveText, currentNode]
  );

  const choices = React.useMemo(() => {
    if (!currentNodeId || !scriptGraph) return [];
    return getNextNodeChoices(scriptGraph, currentNodeId);
  }, [currentNodeId, scriptGraph]);

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
    setTriggeredNodeIds(new Set());
    setSelectedContactId(null);
    setSelectedSubObjectionIndex(null);
    setEnteredObjectionFromChoice(false);
  }, [currentItem?.id, scriptGraph]);

  const handleHistoryClick = (nodeId: string, index: number) => {
    setCurrentNodeId(nodeId);
    setPathHistory(prev => prev.slice(0, index));
    setSelectedSubObjectionIndex(null);
    setEnteredObjectionFromChoice(false);
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
      if (!fieldName) return;
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

    const targetNode = scriptGraph?.nodes.find(n => n.id === targetNodeId);
    if (targetNode?.type === 'objection') {
      setEnteredObjectionFromChoice(true);
      setSelectedSubObjectionIndex(null);
    } else {
      setEnteredObjectionFromChoice(false);
      setSelectedSubObjectionIndex(null);
    }

    setPathHistory(prev => [...prev, activeNode.id]);
    setCurrentNodeId(targetNodeId);
  }, [currentItem?.entityId, contactDeals, firestore, toast, scriptGraph]);

  const handleGoBack = () => {
    if (pathHistory.length === 0) return;
    const newHistory = [...pathHistory];
    const prevNodeId = newHistory.pop();
    setPathHistory(newHistory);
    setCurrentNodeId(prevNodeId || null);
    setValidationError(null);
    setSelectedSubObjectionIndex(null);
    setEnteredObjectionFromChoice(false);
  };

  const handleObjectionClick = (nodeId: string) => {
    if (!currentNodeId) return;
    setPathHistory(prev => [...prev, currentNodeId]);
    setCurrentNodeId(nodeId);
    setSelectedSubObjectionIndex(0);
    setEnteredObjectionFromChoice(false);
    setValidationError(null);
  };

  const handleObjectionClickFromPanel = (nodeId: string, subIndex: number) => {
    if (!currentNodeId) return;
    setPathHistory(prev => [...prev, currentNodeId]);
    setCurrentNodeId(nodeId);
    setSelectedSubObjectionIndex(subIndex);
    setEnteredObjectionFromChoice(false);
    setValidationError(null);
  };

  const handleNextStepAfterObjection = () => {
    if (!currentNode) return;
    const nextChoices = getNextNodeChoices(scriptGraph, currentNode.id);
    if (nextChoices.length > 0) {
      handleChoiceClick(nextChoices[0].targetNode.id);
    } else {
      const mainNodeId = [...pathHistory].reverse().find(id => {
        const node = scriptGraph?.nodes.find(n => n.id === id);
        return node && node.type !== 'objection';
      });
      if (mainNodeId) {
        setCurrentNodeId(mainNodeId);
      }
    }
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
                agentId: user?.uid,
                agentName: user?.displayName || 'Agent',
                workspaceId: activeWorkspaceId,
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
    // Check direct boolean properties or tags matching "dnc" or "do not call"
    const hasDncTag = entityData?.tags?.some((t: any) => {
      const tagName = typeof t === 'string' ? t.toLowerCase() : t?.name?.toLowerCase();
      return tagName === 'dnc' || tagName === 'do not call';
    });
    return (
      entityData?.doNotCall === true ||
      entityData?.dnc === true ||
      (entityData?.status as string) === 'dnc' ||
      !!hasDncTag
    );
  }, [entityData]);

  const isOutsideTimezone = React.useMemo(() => {
    if (currentNode?.type !== 'start' || !currentNode?.data?.startConfig?.checkTimezone) return false;
    const start = currentNode.data.startConfig.allowedHoursStart || "08:00";
    const end = currentNode.data.startConfig.allowedHoursEnd || "17:00";

    // Resolve target timezone context (contact's custom timezone field, e.g. "America/New_York", falling back to agent browser locale)
    const targetTimezone = entityData?.timezone || entityData?.address?.timezone || undefined;
    try {
      const current = new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        ...(targetTimezone && { timeZone: targetTimezone })
      });
      return current < start || current > end;
    } catch (e) {
      console.error('[WORKSPACE_CLIENT] Invalid contact timezone string:', targetTimezone, e);
      const current = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
      return current < start || current > end;
    }
  }, [currentNode, entityData]);

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



  const renderedScript = React.useMemo(() => {
    if (!campaign || !currentItem) return '';
    return resolveLiveText(campaign.scriptSnapshot || '');
  }, [campaign, currentItem, resolveLiveText]);

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

    // Intercept callback outcomes to trigger the date picker instead of raw completion
    const lower = outcome.toLowerCase();
    if (lower.includes('callback') || lower.includes('call back')) {
      setShowCallbackPicker(true);
      return;
    }

    // Intercept defer outcomes to trigger queue defer action instead of raw completion
    if (lower.includes('defer')) {
      handleDefer();
      return;
    }

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

  // ─── Interactive-view trigger handlers (passed down to InteractiveScriptView) ──
  // Execute a single action node's side effect, guarding against double-firing.
  const handleTriggerAction = React.useCallback(async (node: any): Promise<{ ok: boolean; error?: string }> => {
    if (!node || !currentItem?.entityId) return { ok: false, error: 'No active contact.' };
    if (triggeredNodeIds.has(node.id)) return { ok: true };

    const result = await executeScriptActionAction(
      {
        actionType: node.data?.actionType,
        actionConfig: node.data?.actionConfig,
        entityId: currentItem.entityId,
        workspaceId: activeWorkspaceId,
        organizationId: currentItem.organizationId || activeOrganizationId,
        contactId: selectedContactId || undefined,
      },
      user?.uid || ''
    );

    if (result.success) {
      setTriggeredNodeIds(prev => new Set(prev).add(node.id));
      toast({ title: 'Action Triggered', description: `"${node.data?.label || 'Action'}" ran successfully.` });
      return { ok: true };
    }
    toast({ variant: 'destructive', title: 'Action Failed', description: result.error });
    return { ok: false, error: result.error };
  }, [currentItem?.entityId, currentItem?.organizationId, activeWorkspaceId, activeOrganizationId, user?.uid, triggeredNodeIds, selectedContactId, toast]);

  // Trigger an outcome node — reuses the outcome submit path (completes the call + campaign automations).
  // Plain function (not memoized) so it always closes over the latest handleOutcomeSubmit/notes/seconds.
  const handleTriggerOutcome = async (node: any): Promise<{ ok: boolean; error?: string }> => {
    if (!node) return { ok: false, error: 'No outcome.' };
    if (triggeredNodeIds.has(node.id)) return { ok: true };
    setTriggeredNodeIds(prev => new Set(prev).add(node.id));
    await handleOutcomeSubmit(node.data?.outcomeValue || 'Interested');
    return { ok: true };
  };

  const handleStartCall = React.useCallback(() => {
    if (!currentNode) return;
    setIsTimerActive(true);
    const startEdge = scriptGraph?.edges.find(e => e.source === currentNode.id);
    if (startEdge) {
      const targetNodeId = startEdge.target;
      const targetNode = scriptGraph?.nodes.find(n => n.id === targetNodeId);
      if (targetNode?.type === 'objection') {
        setEnteredObjectionFromChoice(true);
        setSelectedSubObjectionIndex(null);
      } else {
        setEnteredObjectionFromChoice(false);
        setSelectedSubObjectionIndex(null);
      }
      setPathHistory(prev => [...prev, currentNode.id]);
      setCurrentNodeId(targetNodeId);
    }
  }, [currentNode, scriptGraph]);

  const handleEndCall = React.useCallback(async () => {
    if (!currentItem || !activeWorkspaceId || !user) return;

    setIsTimerActive(false);

    const contacts = entityData?.entityContacts || [];
    const activeContactId = selectedContactId || contacts.find(c => c.isPrimary)?.id || contacts[0]?.id || 'primary';
    const activeContactName = currentContact?.name || currentItem.entityName;

    try {
      await logActivity({
        organizationId: currentItem.organizationId,
        workspaceId: activeWorkspaceId,
        entityId: currentItem.entityId,
        entityType: (currentItem.entityType as any) || 'contact',
        userId: user.uid,
        type: 'call_completed',
        source: 'call_campaign',
        description: `Completed campaign call for contact: ${activeContactName}. Duration: ${seconds}s.`,
        metadata: {
          campaignId,
          outcome: 'Completed',
          duration: seconds,
          notes: notes,
          agentName: user.displayName || 'Agent',
          contactId: activeContactId,
          contactName: activeContactName,
        }
      });
      toast({ title: 'Call Details Logged', description: `Logged timeline activity for ${activeContactName}.` });
    } catch (err: any) {
      console.error('[WORKSPACE_CLIENT] Failed to log timeline activity:', err);
      toast({ variant: 'destructive', title: 'Activity Logging Failed', description: err.message });
    }

    const currentIdx = contacts.findIndex(c => c.id === activeContactId);
    if (contacts.length > 0 && currentIdx >= 0 && currentIdx < contacts.length - 1) {
      const nextContact = contacts[currentIdx + 1];
      setSelectedContactId(nextContact.id);
      setNotes('');
      setSeconds(0);

      if (scriptGraph && scriptGraph.nodes.length > 0) {
        const startNode = scriptGraph.nodes.find(n => n.type === 'start') || scriptGraph.nodes[0];
        setCurrentNodeId(startNode?.id || null);
        setPathHistory([]);
        setSelectedSubObjectionIndex(null);
        setEnteredObjectionFromChoice(false);
      }
      
      toast({ title: 'Next Contact Selected', description: `Moving to ${nextContact.name} for ${currentItem.entityName}.` });
    } else {
      await handleOutcomeSubmit('Completed');
    }
  }, [
    currentItem,
    activeWorkspaceId,
    user,
    entityData,
    selectedContactId,
    currentContact,
    seconds,
    notes,
    campaignId,
    scriptGraph,
    toast,
    handleOutcomeSubmit
  ]);

  // Active navigation handlers for the current step
  const activeHandlers = React.useMemo(() => {
    if (!currentNode) return [];

    // 1. If we are on the start node
    if (currentNode.type === 'start') {
      return [handleStartCall];
    }

    // 2. If we are on the end node
    if (currentNode.type === 'end') {
      return [handleEndCall];
    }

    // 3. If we are on an outcome node
    if (currentNode.type === 'outcome') {
      return [() => {
        void handleOutcomeSubmit(currentNode.data.outcomeValue || 'Interested');
      }];
    }

    // 4. If we are on an objection node
    if (currentNode.type === 'objection') {
      if (selectedSubObjectionIndex === null && subObjections.length > 1) {
        return subObjections.map((_: any, idx: number) => () => {
          setSelectedSubObjectionIndex(idx);
        });
      }
      return [handleNextStepAfterObjection];
    }

    // 5. Choice branches or normal blocks (if choices.length > 0)
    if (choices.length > 0) {
      const isComplianceBlocked = currentNode.type === 'script_block' && currentNode.data.sayConfig?.complianceVerify && !complianceChecked;
      if (isComplianceBlocked) {
        return [];
      }
      return choices.map(choice => () => {
        handleChoiceClick(choice.targetNode.id);
      });
    }

    return [];
  }, [
    currentNode,
    selectedSubObjectionIndex,
    subObjections,
    handleNextStepAfterObjection,
    choices,
    complianceChecked,
    handleOutcomeSubmit,
    handleChoiceClick,
    handleStartCall,
    handleEndCall
  ]);

  // Keyboard navigation shortcuts
  React.useEffect(() => {
    if (!currentNodeId) return;

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
    currentNodeId,
    pathHistory,
    handleGoBack,
    activeHandlers
  ]);

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
    <div className="h-full flex flex-col bg-background text-foreground overflow-hidden">
      
      {/* ─── Top Bar Banner ────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 bg-card border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => router.push(wrapHref('/admin/messaging/call-centre'))}
            variant="ghost"
            size="icon"
            className="rounded-xl border border-border bg-muted hover:bg-accent text-muted-foreground hover:text-foreground"
            aria-label="Exit workspace"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-sm font-black uppercase text-foreground tracking-wider line-clamp-1">{campaign?.name || 'Call Campaign'}</h2>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Manual Outreach Campaign Workspace
            </p>
          </div>
        </div>

        {/* Live Call Timer + interactive-view toggle */}
        <div className="flex items-center gap-2">
          {hasScriptNodes && !showGuardrailWarning ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={toggleLiveScriptView}
              aria-pressed={liveScriptView === 'interactive'}
              className="h-9 rounded-xl text-[10px] uppercase font-bold tracking-wider gap-1.5 border-border bg-muted hover:bg-accent text-muted-foreground"
              title={liveScriptView === 'interactive' ? 'Switch to step-by-step guided mode' : 'Switch to the full interactive script reference'}
            >
              {liveScriptView === 'interactive' ? (
                <><Play className="h-3.5 w-3.5" /> Guided Mode</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5" /> Interactive View</>
              )}
            </Button>
          ) : null}

          <div className="flex items-center gap-3 px-4 py-2 bg-muted border border-border rounded-xl">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </div>
            <span className="text-xs font-bold text-foreground">Live Call Timer</span>
            <span className="font-mono text-xs font-bold text-primary">{formatTime(seconds)}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsTimerActive(!isTimerActive)}
              className="h-6 w-6 text-muted-foreground hover:text-foreground rounded"
              aria-label={isTimerActive ? "Pause call timer" : "Resume call timer"}
            >
              {isTimerActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Main Content Workspace Grid ───────────────────────────────────────── */}
      <div className="flex-grow flex overflow-hidden">
        
        {/* Left Column: Call Queue Sidebar */}
        <div className={cn(
          "bg-card/50 border-r border-border flex flex-col overflow-hidden shrink-0 transition-all duration-300 ease-in-out relative",
          isLeftCollapsed ? "w-16" : "w-80"
        )}>
          {/* Collapse Toggle */}
          <button
            type="button"
            onClick={() => setIsLeftCollapsed(!isLeftCollapsed)}
            className="absolute top-3 right-2 z-10 w-6 h-6 rounded-md bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label={isLeftCollapsed ? "Expand contact queue" : "Collapse contact queue"}
          >
            {isLeftCollapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
          </button>

          {!isLeftCollapsed && (
            <div className="p-4 border-b border-border space-y-3 shrink-0">
              {/* Header row */}
              <div className="flex items-center justify-between pr-6 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  {leftView !== 'queue' && (
                    <button
                      type="button"
                      onClick={() => setLeftView('queue')}
                      className="flex items-center gap-0.5 text-[9px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors shrink-0"
                      aria-label="Back to call queue"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 -ml-1" />
                      <span>Back</span>
                    </button>
                  )}
                  {leftView !== 'queue' && <span className="text-muted-foreground/30 mx-0.5">|</span>}
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">
                    {leftView === 'completed' ? 'Completed Calls' : leftView === 'callbacks' ? 'Scheduled Callbacks' : 'Campaign Queue'}
                  </span>
                </div>
              </div>

              {/* Sort & Count Row — only in queue view */}
              {leftView === 'queue' && (
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={sortOption}
                    onChange={(e: any) => setSortOption(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg text-[10px] font-semibold text-foreground p-1.5 focus:border-primary focus:ring-0 outline-none"
                    aria-label="Sort queue items"
                  >
                    <option value="default">Default Sort</option>
                    <option value="attempts-asc">Attempts: Low → High</option>
                    <option value="attempts-desc">Attempts: High → Low</option>
                    <option value="active">Recently Active</option>
                    <option value="alpha">Alphabetical</option>
                  </select>

                  <div className="flex items-center justify-center gap-1.5 bg-muted/60 border border-border text-foreground font-mono text-[9px] font-bold rounded-lg py-1.5 px-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                    <span className="truncate">{groupedQueue.pending.length} Contacts</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* List area */}
          <div className={cn("flex-grow overflow-y-auto space-y-2", isLeftCollapsed ? "p-1.5 pt-12" : "p-3")} style={{ contentVisibility: 'auto' }}>

            {leftView === 'completed' && !isLeftCollapsed ? (
              /* ── Completed contacts view ── */
              groupedQueue.completed.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground italic">No completed calls yet.</div>
              ) : (
                groupedQueue.completed.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-border bg-card text-foreground flex flex-col gap-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-xs font-bold truncate">{item.entityName}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{item.entityPhone || 'No Phone'}</p>
                      </div>
                      {item.outcome && (
                        <Badge className="shrink-0 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          {item.outcome}
                        </Badge>
                      )}
                    </div>
                    {item.duration != null && item.duration > 0 && (
                      <p className="text-[9px] text-muted-foreground font-mono">
                        Duration: {Math.floor(item.duration / 60)}m {item.duration % 60}s
                      </p>
                    )}
                  </div>
                ))
              )
            ) : leftView === 'callbacks' && !isLeftCollapsed ? (
              /* ── Callbacks contacts view ── */
              groupedQueue.callbacks.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground italic">No scheduled callbacks.</div>
              ) : (
                groupedQueue.callbacks.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setCurrentItemId(item.id)}
                    className={cn(
                      "p-3 rounded-xl border cursor-pointer transition-all flex flex-col gap-1.5",
                      item.id === currentItemId
                        ? "bg-primary/10 border-primary text-primary shadow"
                        : "bg-card border-border text-muted-foreground hover:bg-muted hover:border-primary/30 hover:text-foreground"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-xs font-bold truncate text-foreground">{item.entityName}</p>
                        <p className="text-[10px] font-mono">{item.entityPhone || 'No Phone'}</p>
                      </div>
                      <Badge className="shrink-0 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500">
                        Callback
                      </Badge>
                    </div>
                    {item.callbackDate && (
                      <div className="flex items-center gap-1 text-[9px] font-mono text-amber-500">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          Scheduled: {new Date(item.callbackDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )
            ) : (
              /* ── Pending queue view ── */
              processedPendingQueue.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground italic">
                  {isLeftCollapsed ? '—' : 'No contacts in queue.'}
                </div>
              ) : (
                processedPendingQueue.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setCurrentItemId(item.id)}
                    className={cn(
                      "rounded-xl border cursor-pointer transition-all",
                      isLeftCollapsed ? "p-1.5 flex items-center justify-center" : "p-3 flex items-center justify-between",
                      item.id === currentItemId
                        ? "bg-primary/10 border-primary text-primary shadow"
                        : "bg-card border-border text-muted-foreground hover:bg-muted hover:border-primary/30 hover:text-foreground"
                    )}
                    title={isLeftCollapsed ? `${item.entityName} — ${item.entityPhone || 'No Phone'}` : undefined}
                  >
                    {isLeftCollapsed ? (
                      /* Avatar-only view */
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black uppercase shrink-0",
                        item.id === currentItemId
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted border border-border text-muted-foreground"
                      )}>
                        {(item.entityName || '?')[0]}
                      </div>
                    ) : (
                      /* Full view */
                      <>
                        <div className="space-y-1">
                          <p className="text-xs font-bold truncate line-clamp-1">{item.entityName}</p>
                          <p className="text-[10px] font-mono">{item.entityPhone || 'No Phone'}</p>
                        </div>
                        {item.attempts > 0 && (
                          <Badge variant="outline" className="text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-muted border-border text-muted-foreground">
                            {item.attempts}×
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                ))
              )
            )}
          </div>

          {/* Statistics footer */}
          {!isLeftCollapsed && (
            <div className="p-4 bg-card border-t border-border shrink-0">
              <div className="grid grid-cols-2 gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setLeftView('completed')}
                  className={cn(
                    "p-2 rounded-lg text-left transition-colors border border-transparent",
                    leftView === 'completed'
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      : "bg-muted hover:bg-emerald-500/10 hover:border-emerald-500/20 hover:text-emerald-400"
                  )}
                  aria-label="View completed calls"
                >
                  <p>Completed</p>
                  <p className="text-sm font-black text-foreground mt-0.5">{groupedQueue.completed.length}</p>
                </button>
                <button
                  type="button"
                  onClick={() => setLeftView('callbacks')}
                  className={cn(
                    "p-2 rounded-lg text-left transition-colors border border-transparent",
                    leftView === 'callbacks'
                      ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                      : "bg-muted hover:bg-amber-500/10 hover:border-amber-500/20 hover:text-amber-500"
                  )}
                  aria-label="View scheduled callbacks"
                >
                  <p>Callbacks</p>
                  <p className="text-sm font-black text-foreground mt-0.5">{groupedQueue.callbacks.length}</p>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Center Column: Contact Profile Context & Script Text (Width 2/4) */}
        <div className="flex-grow flex flex-col overflow-hidden p-6 space-y-6">
          
          {currentItem ? (
            <>
              {/* Contact Profile Context Panel — hidden in interactive mode for more room */}
              {liveScriptView !== 'interactive' && (
              <div className="p-5 bg-card border border-border rounded-2xl space-y-4 shrink-0">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground">{currentItem.entityName}</h3>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{currentItem.entityType}</p>
                    </div>
                  </div>

                  {/* Switcher dropdown */}
                  {entityData?.entityContacts && entityData.entityContacts.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-widest">Dial Target:</span>
                      <Select
                        value={currentContact?.id || ''}
                        onValueChange={setSelectedContactId}
                      >
                        <SelectTrigger className="h-8 w-44 rounded-xl bg-background border text-[11px] font-bold">
                          <SelectValue placeholder="Select contact..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border bg-card">
                          {entityData.entityContacts.map((c: EntityContact) => (
                            <SelectItem key={c.id} value={c.id} className="text-xs font-semibold">
                              {c.name} {c.isPrimary ? '(Primary)' : c.isSignatory ? '(Signatory)' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* OS Telephony trigger */}
                  <a 
                    href={`tel:${currentContact?.phone || currentItem.entityPhone}`}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs rounded-xl shadow-lg transition-transform hover:scale-[1.02]"
                  >
                    <Phone className="h-4 w-4 fill-current animate-bounce" /> Call Contact: {currentContact?.name || currentItem.entityName} ({currentContact?.phone || currentItem.entityPhone || 'Missing phone'})
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-border text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>Email: <span className="text-foreground font-medium">{currentContact?.email || currentItem.entityEmail || 'No Email'}</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FolderOpen className="h-4 w-4 text-primary" />
                    <span>Contact Stage: <span className="text-primary font-bold">{currentItem.status}</span></span>
                  </div>
                </div>
              </div>
              )}

              {/* Call Script Reading panel */}
              <div className="flex-grow bg-card border border-border rounded-2xl p-6 shadow-sm relative flex flex-col min-h-0 overflow-hidden">
                <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Interactive Script View</span>
                </div>

                {liveScriptView === 'interactive' && hasScriptNodes && !showGuardrailWarning ? (
                  // Read-only interactive reference with live contact + caller values substituted
                  <div className="flex-grow min-h-0 overflow-auto pt-4">
                    <InteractiveScriptView
                      nodes={scriptGraph.nodes as any}
                      edges={scriptGraph.edges as any}
                      resolveText={resolveLiveText}
                      onTriggerAction={handleTriggerAction}
                      onTriggerOutcome={handleTriggerOutcome}
                      triggeredIds={triggeredNodeIds}
                      currentContact={currentContact}
                      entityData={entityData}
                    />
                  </div>
                ) : isBranching ? (
                  showGuardrailWarning ? (
                    <div className="flex flex-col items-center justify-center text-center p-8 bg-amber-50 dark:bg-zinc-900 border border-amber-500/20 rounded-2xl max-w-xl mx-auto my-6 space-y-4">
                      <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <AlertTriangle className="h-6 w-6" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-sm font-black uppercase text-amber-500 tracking-wider">Pre-Call Guardrail Alert</h3>
                        <p className="text-xs text-foreground/80 max-w-sm">
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
                          className="flex-grow h-10 border-border bg-muted text-xs font-bold hover:bg-accent"
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
                    <div className="flex flex-grow min-h-0 overflow-hidden pt-4">
                      {/* Left Timeline */}
                      <div className="flex flex-col gap-2 border-r border-border pr-4 mr-4 shrink-0 w-48 overflow-y-auto">
                        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">Conversation Path</span>
                        {pathHistory.length === 0 ? (
                          <span className="text-[10px] text-muted-foreground italic">No steps taken yet.</span>
                        ) : (
                          <div className="space-y-4 relative pl-3 before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-[1px] before:bg-border">
                            {pathHistory.map((histNodeId, idx) => {
                              const histNode = scriptGraph?.nodes.find(n => n.id === histNodeId);
                              if (!histNode) return null;
                              return (
                                <div key={`${histNodeId}-${idx}`} className="relative flex items-center gap-2 text-[10px]">
                                  <span className="absolute -left-[10px] w-2 h-2 rounded-full bg-muted-foreground border border-background" />
                                  <button
                                    type="button"
                                    onClick={() => handleHistoryClick(histNodeId, idx)}
                                    className="text-left font-bold text-muted-foreground hover:text-primary transition-colors hover:underline truncate max-w-[130px]"
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
                          <div className="mt-4 pt-4 border-t border-border pl-3 relative">
                            <span className="absolute -left-[10px] top-[22px] w-2 h-2 rounded-full bg-primary animate-pulse" />
                            <span className="text-[9px] font-black uppercase text-primary tracking-wider block">Active Node</span>
                            <span className="text-[10px] font-bold text-foreground block truncate max-w-[130px]">{currentNode.data.label}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Right dialog state & choices */}
                      <div className="flex-grow flex flex-col min-h-0">
                        {/* Scrollable Readable Content */}
                        <div ref={scrollContainerRef} className="flex-grow overflow-y-auto min-h-0 pr-2 space-y-4">
                          {currentNode && (
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
                              {getNodeBadge(currentNode.type)}
                            </div>
                          )}

                          {currentNode?.type === 'objection' && enteredObjectionFromChoice && selectedSubObjectionIndex === null && subObjections.length > 1 ? (
                            /* Show list of sub-objections first in the readable area */
                            <div className="space-y-3">
                              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                                Select which objection fits:
                              </span>
                              <div className="grid gap-2 max-w-xl">
                                {subObjections.map((sub: any, idx: number) => (
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
                            /* Normal Script Reading view or active rebuttal text */
                            <>
                              {/* Node Type Specific Overlays */}
                              {currentNode?.type === 'outcome' && (
                                <div className="space-y-4 max-w-xl">
                                  <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl space-y-2">
                                    <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wide">Outcome Step Reached</h4>
                                    <p className="text-xs text-foreground">
                                      The conversation has reached the outcome: <span className="font-extrabold text-purple-600">"{currentNode.data.outcomeValue}"</span>.
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
                                    actionStatus === 'success' ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600" :
                                    actionStatus === 'error' ? "bg-rose-500/5 border-rose-500/20 text-rose-600" :
                                    "bg-muted border-border text-muted-foreground"
                                  )}>
                                    <div className="flex items-center justify-between">
                                      <h4 className="text-xs font-bold uppercase tracking-wide">
                                        {actionStatus === 'loading' ? 'Executing Automation Action...' :
                                         actionStatus === 'success' ? 'Automation Action Completed' :
                                         actionStatus === 'error' ? 'Automation Action Failed' :
                                         'Automation Action Step'}
                                      </h4>
                                      {actionStatus === 'loading' && <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />}
                                      {actionStatus === 'success' && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                                      {actionStatus === 'error' && <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />}
                                    </div>
                                    <p className="text-xs text-foreground">
                                      This step triggers the automation action: <span className="font-extrabold">{currentNode.data.actionType?.replace('_', ' ')}</span>.
                                    </p>
                                    {actionError && (
                                      <p className="text-[11px] text-rose-600 font-mono border-t border-rose-500/10 pt-2 mt-2">
                                        Error: {actionError}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}

                              {currentNode?.type === 'objection' && (selectedSubObjectionIndex !== null || subObjections.length <= 1) && (
                                <div className="space-y-2 select-text">
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-orange-500 block">
                                    ➔ Viewing Objection Response
                                  </span>
                                  <ScriptBodyDisplay
                                    text={resolveLiveText(subObjections[selectedSubObjectionIndex ?? 0]?.description || '')}
                                    className="text-base font-serif text-foreground leading-relaxed max-w-2xl pr-4"
                                  />
                                </div>
                              )}

                              {currentNode?.type === 'start' && (
                                <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center max-w-md mx-auto select-none border border-emerald-500/10 bg-emerald-500/5 rounded-2xl p-6">
                                  <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-sm animate-pulse">
                                    <Phone className="h-9 w-9" />
                                  </div>
                                  <div className="space-y-2">
                                    <h3 className="text-lg font-black text-foreground uppercase tracking-wider">Ready to Initiate Call</h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">Press the button below or trigger shortcut (Enter / Tab / Number 1) to start timing and begin the outreach flow.</p>
                                  </div>
                                  <Button
                                    onClick={handleStartCall}
                                    className="h-12 px-10 rounded-xl font-bold uppercase tracking-wider bg-emerald-500 hover:bg-emerald-600 text-white shadow-md flex items-center gap-2 transition-all"
                                  >
                                    <Phone className="h-4 w-4" /> Start Call
                                  </Button>
                                </div>
                              )}

                              {currentNode?.type === 'end' && (
                                <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center max-w-md mx-auto select-none border border-rose-500/10 bg-rose-500/5 rounded-2xl p-6">
                                  <div className="w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-sm">
                                    <PhoneOff className="h-9 w-9" />
                                  </div>
                                  <div className="space-y-2">
                                    <h3 className="text-lg font-black text-foreground uppercase tracking-wider">Outbound Call Ended</h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">Press the button below or trigger shortcut (Enter / Tab / Number 1) to end this call, log details, and proceed.</p>
                                  </div>
                                  <Button
                                    onClick={handleEndCall}
                                    className="h-12 px-10 rounded-xl font-bold uppercase tracking-wider bg-rose-500 hover:bg-rose-600 text-white shadow-md flex items-center gap-2 transition-all"
                                  >
                                    <PhoneOff className="h-4 w-4" /> End Call
                                  </Button>
                                </div>
                              )}

                              {currentNode?.type !== 'objection' && currentNode?.type !== 'start' && currentNode?.type !== 'end' && currentNode?.data?.text && (
                                <ScriptBodyDisplay
                                  text={resolvedActiveNodeText}
                                  className="text-base font-serif text-foreground leading-relaxed max-w-2xl pr-4 select-text"
                                />
                              )}

                              {/* Dynamic Compliance Checkbox for Say nodes */}
                              {currentNode?.type === 'script_block' && currentNode.data.sayConfig?.complianceVerify && (
                                <div className="mt-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-start gap-3 max-w-xl">
                                  <input 
                                    type="checkbox"
                                    id="compliance-checkbox"
                                    checked={complianceChecked}
                                    onChange={(e) => setComplianceChecked(e.target.checked)}
                                    className="mt-0.5 rounded border-border bg-background text-primary focus:ring-0"
                                  />
                                  <label htmlFor="compliance-checkbox" className="text-xs text-foreground/80 cursor-pointer select-none">
                                    <span className="font-extrabold text-amber-600 block mb-1">Compliance Verification Required</span>
                                    I verify that I have read the compliance statement exactly as written.
                                  </label>
                                </div>
                              )}

                              {/* Dynamic Input Fields rendering for Question nodes */}
                              {currentNode?.type === 'question' && currentNode.data.questionConfig?.fieldName && (
                                <div className="p-4 bg-muted/60 border border-border rounded-xl max-w-xl space-y-3 shadow-inner">
                                  <div className="flex justify-between items-center">
                                    <Label htmlFor="question-input" className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                                      Response for <span className="text-primary font-mono">{currentNode.data.questionConfig.fieldName}</span>
                                    </Label>
                                    <Badge variant="outline" className="text-[8px] font-bold uppercase tracking-wider border-border text-muted-foreground bg-muted">
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
                                      className="w-full bg-background border border-border text-foreground rounded-lg text-xs p-2 focus:border-primary focus:ring-0 outline-none"
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
                                      className="w-full bg-background border-border text-foreground text-xs rounded-lg h-9"
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
                                      className="w-full bg-background border-border text-foreground text-xs rounded-lg h-9"
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
                                      className="w-full bg-background border-border text-foreground text-xs rounded-lg h-9"
                                    />
                                  )}
                                  {currentNode.data.questionConfig.validationPattern && (
                                    <p className="text-[9px] text-muted-foreground font-mono">
                                      Validation Regex: {currentNode.data.questionConfig.validationPattern}
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Field level Validation Error banner */}
                              {validationError && (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-lg text-xs flex items-center gap-2 max-w-xl">
                                  <AlertTriangle className="h-4 w-4 shrink-0" />
                                  <span>{validationError}</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Fixed Button Panel at the bottom */}
                        <div className="pt-6 border-t border-border mt-6 shrink-0 select-none bg-card flex items-center justify-between gap-4">
                          {/* Left side: Back button */}
                          <div className="min-w-[100px]">
                            {pathHistory.length > 0 && (
                              <Button
                                variant="outline"
                                type="button"
                                onClick={handleGoBack}
                                className="h-10 px-6 rounded-xl text-xs font-bold uppercase tracking-wider border-border hover:bg-muted text-muted-foreground hover:text-foreground shadow-sm flex items-center gap-1.5"
                              >
                                <ChevronLeft className="h-4 w-4" /> Back
                              </Button>
                            )}
                          </div>

                          {/* Right side: Next Step / Option Buttons */}
                          <div className="flex items-center gap-2 justify-end ml-auto flex-wrap max-w-[75%]">
                            {currentNode?.type === 'objection' && (selectedSubObjectionIndex !== null || subObjections.length <= 1) ? (
                              <Button
                                type="button"
                                onClick={handleNextStepAfterObjection}
                                className="h-10 px-8 min-w-[150px] rounded-xl bg-orange-600 hover:bg-orange-700 border border-orange-600 text-white transition-all text-xs font-black shadow-sm flex items-center justify-center gap-1.5"
                              >
                                Continue to Next Step <ArrowRight className="h-3.5 w-3.5" />
                              </Button>
                            ) : currentNode?.type !== 'objection' && currentNode?.type !== 'start' && currentNode?.type !== 'end' && choices.length > 0 ? (
                              <div className="flex flex-wrap gap-2 justify-end items-center">
                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mr-1">Choose Customer's Response:</span>
                                {choices.map((choice) => (
                                  <Button
                                    key={choice.edgeId}
                                    type="button"
                                    disabled={currentNode?.type === 'script_block' && currentNode.data.sayConfig?.complianceVerify && !complianceChecked}
                                    onClick={() => handleChoiceClick(choice.targetNode.id)}
                                    className="h-10 px-8 min-w-[120px] rounded-xl border border-border bg-card text-foreground hover:bg-primary/20 hover:border-primary hover:text-primary transition-all text-xs font-black shadow-sm"
                                  >
                                    {choice.edgeLabel}
                                  </Button>
                                ))}
                              </div>
                            ) : (
                              currentNode?.type !== 'outcome' && currentNode?.type !== 'objection' && currentNode?.type !== 'start' && currentNode?.type !== 'end' && (
                                <div className="text-xs text-muted-foreground italic">
                                  No further choices. You can log the outcome in the right panel to complete this call.
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <ScriptBodyDisplay
                    text={renderedScript}
                    className="text-base font-serif text-zinc-200 leading-relaxed max-w-3xl pr-4 select-text pt-4 flex-grow overflow-y-auto min-h-0"
                  />
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

        {/* Right Column: Outcomes, Notes & History */}
        <div className={cn(
          "bg-card/50 border-l border-border flex flex-col overflow-hidden shrink-0 transition-all duration-300 ease-in-out relative",
          isRightCollapsed ? "w-14" : "w-96"
        )}>
          {/* Collapse Toggle */}
          <button
            type="button"
            onClick={() => setIsRightCollapsed(!isRightCollapsed)}
            className="absolute top-3 left-2 z-10 w-6 h-6 rounded-md bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label={isRightCollapsed ? "Expand panel" : "Collapse panel"}
          >
            {isRightCollapsed ? <PanelRightOpen className="h-3.5 w-3.5" /> : <PanelRightClose className="h-3.5 w-3.5" />}
          </button>

          {isRightCollapsed ? (
            /* Collapsed: vertical icon bar */
            <div className="flex flex-col items-center pt-12 gap-2 flex-grow overflow-y-auto px-1 pb-4">
              {/* Tab Icons */}
              <button
                type="button"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Notes & Actions"
                onClick={() => setIsRightCollapsed(false)}
              >
                <MessageSquare className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Deals"
                onClick={() => setIsRightCollapsed(false)}
              >
                <Bookmark className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Timeline"
                onClick={() => setIsRightCollapsed(false)}
              >
                <History className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Rebuttals"
                onClick={() => setIsRightCollapsed(false)}
              >
                <ShieldAlert className="h-4 w-4" />
              </button>

              {/* Divider */}
              <div className="w-6 border-t border-border my-1" />

              {/* Compact Outcome Buttons */}
              {currentItem && campaign?.outcomes?.map(out => (
                <button
                  key={out}
                  type="button"
                  onClick={() => handleOutcomeSubmit(out)}
                  disabled={isSaving}
                  className="w-9 h-9 rounded-lg bg-muted/40 border border-border flex items-center justify-center hover:bg-muted hover:border-primary/30 transition-colors disabled:opacity-50"
                  title={out}
                >
                  {getOutcomeIconCollapsed(out)}
                </button>
              ))}

              {/* Quick Actions */}
              {currentItem && (
                <>
                  <div className="w-6 border-t border-border my-1" />
                  <button
                    type="button"
                    onClick={() => { setIsRightCollapsed(false); setShowCallbackPicker(true); }}
                    disabled={isActionsLoading}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    title="Schedule Callback"
                  >
                    <Clock className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleSkip}
                    disabled={isActionsLoading}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    title="Skip Contact"
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          ) : (
            /* Expanded: Full Tabs UI */
            <Tabs defaultValue="notes" className="flex-grow flex flex-col overflow-hidden">
              <TabsList className="bg-card border-b border-border h-12 p-1 rounded-none shrink-0 flex pl-10">
                <TabsTrigger value="notes" className="flex-grow rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-muted text-xs font-bold">Notes</TabsTrigger>
                <TabsTrigger value="deals" className="flex-grow rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-muted text-xs font-bold">Deals ({contactDeals.length})</TabsTrigger>
                <TabsTrigger value="history" className="flex-grow rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-muted text-xs font-bold">Timeline ({contactHistory.length})</TabsTrigger>
                <TabsTrigger value="rebuttals" className="flex-grow rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-muted text-xs font-bold">Rebuttals ({objectionNodes.length})</TabsTrigger>
              </TabsList>

            {/* Notes & Outcomes Tab */}
            <TabsContent value="notes" className="flex-grow flex flex-col justify-between overflow-y-auto p-5 space-y-6">
              
              {currentItem ? (
                <>
                  {/* Notes input */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Call Notes &amp; Log</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Document discussion here… Notes auto-save to database in real-time."
                      className="min-h-[160px] bg-background border-border text-foreground rounded-xl resize-none leading-relaxed p-3 focus:border-primary focus:ring-0"
                    />
                  </div>

                  {/* Unified Call Actions */}
                  <div className="space-y-3 border-t border-border pt-4">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Call Actions</span>
                    
                    {/* Quick Actions Row */}
                    {showCallbackPicker ? (
                      <form onSubmit={handleScheduleCallback} className="space-y-3 p-3 bg-muted border border-border rounded-xl">
                        <Label className="text-[9px] font-bold text-muted-foreground uppercase">Select Callback Date/Time</Label>
                        <Input
                          type="datetime-local"
                          value={callbackDate}
                          onChange={(e) => setCallbackDate(e.target.value)}
                          className="h-9 bg-background border-border text-foreground text-xs rounded-lg"
                          required
                        />
                        <div className="flex gap-2">
                          <Button type="submit" disabled={isActionsLoading} size="sm" className="h-8 rounded-lg font-bold text-[10px] flex-grow">Confirm</Button>
                          <Button type="button" onClick={() => setShowCallbackPicker(false)} variant="outline" size="sm" className="h-8 rounded-lg border-border text-[10px] flex-grow">Cancel</Button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {!hasCallbackOutcome && (
                          <Button
                            onClick={() => setShowCallbackPicker(true)}
                            variant="outline"
                            size="sm"
                            disabled={isActionsLoading}
                            className="h-6 text-[8px] font-bold rounded-md border-border bg-muted hover:bg-accent gap-1 px-1.5 py-0.5"
                          >
                            <Clock className="h-3 w-3" />
                            Callback
                          </Button>
                        )}
                        {!hasDeferOutcome && (
                          <Button
                            onClick={handleDefer}
                            variant="outline"
                            size="sm"
                            disabled={isActionsLoading}
                            className="h-6 text-[8px] font-bold rounded-md border-border bg-muted hover:bg-accent gap-1 px-1.5 py-0.5"
                          >
                            <Pause className="h-3 w-3" />
                            Defer
                          </Button>
                        )}
                        <Button
                          onClick={handleSkip}
                          variant="outline"
                          size="sm"
                          disabled={isActionsLoading}
                          className="h-6 text-[8px] font-bold rounded-md border-border bg-muted hover:bg-accent gap-1 px-1.5 py-0.5"
                        >
                          <SkipForward className="h-3 w-3" />
                          Skip
                        </Button>
                      </div>
                    )}

                    {/* Outcome Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {campaign?.outcomes?.map(out => (
                        <Button
                          key={out}
                          onClick={() => handleOutcomeSubmit(out)}
                          disabled={isSaving}
                          className="h-8 font-bold text-[10px] rounded-lg border border-border bg-card text-foreground/90 flex items-center justify-start px-2.5 transition-all hover:scale-[1.01] hover:bg-muted hover:text-foreground shadow-sm"
                        >
                          {getOutcomeIcon(out)}
                          <span className="truncate">{out}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center text-xs text-muted-foreground italic py-20">No contact loaded.</div>
              )}

            </TabsContent>

            {/* Deals Tab */}
            <TabsContent value="deals" className="flex-grow overflow-y-auto p-4 space-y-3">
              {dealsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="h-6 w-6 text-primary animate-spin" />
                </div>
              ) : contactDeals.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-20">No active CRM deals found for this contact.</p>
              ) : (
                <div className="space-y-3">
                  {contactDeals.map((deal: any) => (
                    <div key={deal.id} className="p-3 bg-muted/40 border border-border rounded-xl space-y-2">
                      <div className="flex justify-between items-start">
                        <h4 className="text-xs font-bold text-foreground line-clamp-1">{deal.name}</h4>
                        <Badge variant="outline" className={cn(
                          "text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                          deal.status === 'won' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                          deal.status === 'lost' ? "bg-rose-500/10 border-rose-500/20 text-rose-400" :
                          "bg-blue-500/10 border-blue-500/20 text-blue-400"
                        )}>
                          {deal.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground font-medium">
                        <span>Stage: <span className="text-foreground">{deal.stageName || 'Unknown'}</span></span>
                        <span className="font-mono text-foreground font-bold">GHS {deal.value?.toLocaleString() || '0'}</span>
                      </div>
                      {deal.expectedCloseDate && (
                        <p className="text-[8px] text-muted-foreground font-medium uppercase">Expected Close: {new Date(deal.expectedCloseDate).toLocaleDateString()}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="flex-grow overflow-y-auto p-4 space-y-3">
              {contactHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-20">No historical CRM activities found for this contact.</p>
              ) : (
                <div className="relative border-l border-border pl-4 ml-2 space-y-6 py-2">
                  {contactHistory.map((act: any) => (
                    <div key={act.id} className="relative space-y-1">
                      {/* Dot Indicator */}
                      <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
                      
                      <div className="flex items-center justify-between text-[9px] font-bold text-muted-foreground">
                        <Badge variant="outline" className="text-[8px] font-bold tracking-wider uppercase border-border text-foreground bg-card">
                          {act.type.replace('_', ' ')}
                        </Badge>
                        <span>{new Date(act.timestamp).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-foreground leading-normal">{act.description}</p>
                      {act.metadata?.notes && (
                        <div className="p-2 bg-muted/50 border border-border rounded-lg text-[10px] text-muted-foreground italic">
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
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Objection Rebuttals Quick-Access</span>
                
                <Input
                  type="text"
                  placeholder="Search objections by keyword..."
                  value={objectionSearch}
                  onChange={(e) => setObjectionSearch(e.target.value)}
                  className="bg-background border-border text-foreground text-xs rounded-xl h-9"
                />
                
                {filteredObjections.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center py-20">No matching objections found.</p>
                ) : (
                  <div className="space-y-4">
                    {filteredObjections.map((node) => {
                      const subObjs = (node.data as any)?.objectionConfig?.objections || [
                        { title: node.data.label || 'Objection', description: node.data.text || '' }
                      ];
                      return (
                        <div key={node.id} className="space-y-1.5">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                              {node.data.label || 'Objection'}
                            </span>
                            {node.data.objectionConfig?.keywordTriggers && node.data.objectionConfig.keywordTriggers.length > 0 && (
                              <div className="flex gap-1">
                                {node.data.objectionConfig.keywordTriggers.slice(0, 2).map((kw: string) => (
                                  <Badge key={kw} variant="outline" className="text-[7px] border-border text-muted-foreground bg-muted px-1 py-0 scale-90">
                                    {kw}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-1 pl-1">
                            {subObjs.map((sub: any, idx: number) => {
                              const isActive = currentNodeId === node.id && selectedSubObjectionIndex === idx;
                              return (
                                <div
                                  key={`${node.id}-${idx}`}
                                  onClick={() => handleObjectionClickFromPanel(node.id, idx)}
                                  className={cn(
                                    "p-2.5 rounded-xl border cursor-pointer transition-all flex flex-col gap-0.5 text-left",
                                    isActive
                                      ? "bg-amber-500/10 border-amber-500 text-amber-500 shadow"
                                      : "bg-muted border-border text-muted-foreground hover:bg-card hover:border-primary/30 hover:text-foreground"
                                  )}
                                >
                                  <span className="text-xs font-bold truncate">{sub.title || 'Objection Option'}</span>
                                  {sub.description && (
                                    <p className="text-[10px] text-muted-foreground line-clamp-1 italic">
                                      {sub.description.replace(/<[^>]+>/g, '')}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
          )}

        </div>

      </div>

    </div>
  );
}
