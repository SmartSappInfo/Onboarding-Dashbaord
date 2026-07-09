
'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, orderBy, query, where } from 'firebase/firestore';
import type { Automation, AutomationTriggerDef } from '@/lib/types';
import { ArrowLeft, CheckCircle2, Loader2, Pencil, Play, Save, AlertCircle, Search, X, Zap, Users, PenTool } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { saveAutomationAction, testAutomationFlowAction, toggleAutomationStatusAction, restoreAutomationAction } from '@/lib/automation-actions';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUnsavedChanges } from '@/context/UnsavedChangesContext';
import { useAutomationAutosave } from '../../hooks/useAutomationAutosave';
import { clearAutomationBackup } from '@/lib/automation-storage';
import { AutomationMetaProvider } from '../../components/AutomationMetaContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const AutomationBuilder = dynamic(() => import('../../components/AutomationBuilder'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
    </div>
  ),
});

const AutomationActivityLog = dynamic(
  () => import('../../components/AutomationActivityLog').then((m) => ({ default: m.AutomationActivityLog })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    ),
  }
);

function getFunctionalSnapshot(data: any) {
  if (!data) return null;
  return {
    name: data.name,
    description: data.description || '',
    triggers: data.triggers ?? [],
    edges: data.edges?.map((e: any) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      type: e.type,
    })) ?? [],
    nodes: data.nodes?.map((n: any) => ({
      id: n.id,
      type: n.type,
      data: n.data,
    })) ?? [],
  };
}

/**
 * @fileOverview High-fidelity Automation Blueprint Editor.
 */
export default function EditAutomationPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const { registerUnsavedChanges, unregisterUnsavedChanges } = useUnsavedChanges();
  const firestore = useFirestore();
  const automationId = params.id as string;

  const [isSaving, setIsSaving] = React.useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState(false);
  const [testDialogOpen, setTestDialogOpen] = React.useState(false);
  const [testEntityId, setTestEntityId] = React.useState('');
  const [testEntityName, setTestEntityName] = React.useState('');
  const [entitySearch, setEntitySearch] = React.useState('');
  const [entityDropdownOpen, setEntityDropdownOpen] = React.useState(false);
  const [currentData, setCurrentData] = React.useState<Partial<Automation>>({});
  // Pencil editor state
  const [isEditingMeta, setIsEditingMeta] = React.useState(false);
  const [editDraft, setEditDraft] = React.useState({ name: '', description: '' });
  const [activeTab, setActiveTab] = React.useState<'designer' | 'activity'>('designer');

  const isNew = automationId === 'new';

  const docRef = useMemoFirebase(
    () => (firestore && !isNew ? doc(firestore, 'automations', automationId) : null),
    [firestore, automationId, isNew]
  );

  const { data: dbAutomation, isLoading: isDocLoading } = useDoc<Automation>(docRef);

  const defaultNewAutomation = React.useMemo(() => {
    return {
      id: 'new',
      name: 'Untitled Workflow',
      description: '',
      isActive: false,
      triggers: [],
      triggerTypes: [],
      workspaceIds: [activeWorkspaceId],
      nodes: [
        {
          id: 'trigger',
          type: 'triggerNode',
          position: { x: 250, y: 100 },
          data: { label: 'Event Trigger' }
        }
      ],
      edges: [],
    } as unknown as Automation;
  }, [activeWorkspaceId]);

  const automation = isNew ? defaultNewAutomation : dbAutomation;
  const isLoading = isNew ? false : isDocLoading;

  React.useEffect(() => {
    if (automation) {
      setCurrentData((prev) => {
        const next = { ...prev };
        if (next.name === undefined) next.name = automation.name;
        if (next.description === undefined) next.description = automation.description || '';
        if (next.triggers === undefined) next.triggers = automation.triggers ?? [];
        if (next.isActive === undefined) next.isActive = automation.isActive ?? false;
        if (isNew) {
          if (next.nodes === undefined) next.nodes = automation.nodes;
          if (next.edges === undefined) next.edges = automation.edges;
        }
        return next;
      });
    }
  }, [automation, isNew]);

  // Snapshot of the last-saved state — used for accurate isDirty comparison.
  // Updated after every successful save so isDirty resets to false.
  const [savedSnapshot, setSavedSnapshot] = React.useState<string | null>(null);

  // Set initial snapshot when automation loads from Firestore
  React.useEffect(() => {
    if (automation && !savedSnapshot) {
      setSavedSnapshot(JSON.stringify(getFunctionalSnapshot({
        name: automation.name,
        description: automation.description || '',
        nodes: automation.nodes,
        edges: automation.edges,
        triggers: automation.triggers ?? [],
      })));
    }
  }, [automation, savedSnapshot]);

  const isDirty = React.useMemo(() => {
    if (!savedSnapshot) return false;
    const currentStr = JSON.stringify(getFunctionalSnapshot({
      name: currentData.name,
      description: currentData.description,
      nodes: currentData.nodes,
      edges: currentData.edges,
      triggers: currentData.triggers,
    }));
    return currentStr !== savedSnapshot;
  }, [savedSnapshot, currentData]);

  const {
    showRestoreDialog,
    setShowRestoreDialog,
    backupData,
    builderKey,
    handleRestore,
    handleDiscard
  } = useAutomationAutosave(automationId, currentData, automation || undefined, isDirty);

  const handleRestoreBackup = React.useCallback(() => {
    handleRestore((restored) => {
      setCurrentData((prev) => ({
        ...prev,
        ...restored,
      }));
    });
  }, [handleRestore]);

  const testWorkspaceId =
    automation?.workspaceIds?.[0] || activeWorkspaceId || '';

  // ── Entity search query ──────────────────────────────────────────────────────
  // Entities don't store workspaceIds on the root document. The join collection
  // `workspace_entities` is the correct scoped source with displayName denormalized.
  const entitiesQuery = useMemoFirebase(() => {
    if (!firestore || !testDialogOpen || !testWorkspaceId) return null;
    return query(
      collection(firestore, 'workspace_entities'),
      where('workspaceId', '==', testWorkspaceId),
      orderBy('displayName', 'asc'),
    );
  }, [firestore, testDialogOpen, testWorkspaceId]);

  const { data: rawEntities } = useCollection<{
    id: string;
    entityId: string;
    displayName: string;
    entityType?: string;
  }>(entitiesQuery);

  const filteredEntities = React.useMemo(() => {
    if (!rawEntities) return [];
    const q = entitySearch.trim().toLowerCase();
    if (!q) return rawEntities.slice(0, 50);
    return rawEntities
      .filter((e) => (e.displayName || '').toLowerCase().includes(q))
      .slice(0, 50);
  }, [rawEntities, entitySearch]);

  const handleStateChange = React.useCallback((nodes: unknown[], edges: unknown[]) => {
    setCurrentData((prev) => {
      if (
        JSON.stringify(prev.nodes) === JSON.stringify(nodes) &&
        JSON.stringify(prev.edges) === JSON.stringify(edges)
      ) {
        return prev;
      }
      return { ...prev, nodes, edges } as Partial<Automation>;
    });
  }, []);

  const handleTriggersChange = React.useCallback((triggers: AutomationTriggerDef[]) => {
    setCurrentData((prev) => ({ ...prev, triggers }));
  }, []);

  // Resolved triggers: prefer in-flight edits, fall back to saved data
  const activeTriggers: AutomationTriggerDef[] = currentData.triggers ?? automation?.triggers ?? [];

  const handleSaveAndReturn = React.useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    setIsSaving(true);
    const cleanData = JSON.parse(JSON.stringify(currentData));

    if (isNew) {
      if (!cleanData.workspaceIds || cleanData.workspaceIds.length === 0) {
        cleanData.workspaceIds = [activeWorkspaceId];
      }
    }

    const res = await saveAutomationAction(isNew ? null : automationId, cleanData, user.uid);
    setIsSaving(false);
    if (res.success) {
      toast({ 
        title: isNew ? 'Automation Created' : 'Automation Saved', 
        description: isNew ? 'Blueprint created successfully.' : 'Blueprint updated successfully.' 
      });
      clearAutomationBackup(automationId);
      // Update saved snapshot so isDirty resets to false
      setSavedSnapshot(JSON.stringify(getFunctionalSnapshot({
        name: currentData.name,
        description: currentData.description,
        nodes: currentData.nodes,
        edges: currentData.edges,
        triggers: currentData.triggers,
      })));
      if (isNew && res.id) {
        unregisterUnsavedChanges('automation-builder');
        router.push(`/admin/automations/${res.id}/edit`);
      }
      return true;
    } else {
      toast({ variant: 'destructive', title: 'Save Failed', description: res.error });
      return false;
    }
  }, [user, currentData, automationId, isNew, activeWorkspaceId, toast, router, unregisterUnsavedChanges]);

  const handleSave = async () => {
    await handleSaveAndReturn();
  };

  const handleToggleActive = async (active: boolean) => {
    if (!user?.uid) return;
    setIsTogglingStatus(true);
    const res = await toggleAutomationStatusAction(automationId, active, user.uid);
    setIsTogglingStatus(false);
    if (res.success) {
      toast({
        title: active ? 'Automation Activated' : 'Automation Paused',
        description: active ? 'This automation will now run on triggers.' : 'No new runs will be started.',
      });
    } else {
      toast({ variant: 'destructive', title: 'Toggle failed', description: (res as any).error });
    }
  };

  const openEditMeta = () => {
    setEditDraft({ name: currentData.name ?? automation?.name ?? '', description: currentData.description ?? automation?.description ?? '' });
    setIsEditingMeta(true);
  };

  const commitEditMeta = () => {
    setCurrentData((prev) => ({ ...prev, name: editDraft.name, description: editDraft.description }));
    setIsEditingMeta(false);
  };

  React.useEffect(() => {
    registerUnsavedChanges('automation-builder', isDirty, handleSaveAndReturn);
    return () => unregisterUnsavedChanges('automation-builder');
  }, [isDirty, handleSaveAndReturn, registerUnsavedChanges, unregisterUnsavedChanges]);

  const handleTestFlow = async () => {
    if (!user?.uid) return;
    if (!testEntityId.trim()) {
      toast({
        variant: 'destructive',
        title: 'Entity required',
        description: 'Select an entity from the list to run the test against.',
      });
      return;
    }
    setIsTesting(true);
    const res = await testAutomationFlowAction(automationId, user.uid, {
      workspaceId: testWorkspaceId,
      entityId: testEntityId.trim(),
    });
    setIsTesting(false);
    if (res.success) {
      setTestDialogOpen(false);
      setTestEntityId('');
      setTestEntityName('');
      setEntitySearch('');
      toast({
        title: 'Test run started',
        description: res.message || 'Check the Automation Hub run ledger.',
      });
    } else {
      toast({ variant: 'destructive', title: 'Test failed', description: res.error });
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  if (!automation) {
    return (
      <div className="p-20 text-center">
        <p className="text-muted-foreground font-semibold">Blueprint not found.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="h-16 shrink-0 bg-card/80 border-b px-6 flex items-center justify-between z-30 shadow-sm">
        <div className="flex items-center gap-4 min-w-0 flex-1 mr-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/admin/automations')}
            className="rounded-xl h-10 w-10 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {/* Title / description — inline editable on pencil click */}
          <div className="min-w-0 flex-1">
            {isEditingMeta ? (
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <input
                    type="text"
                    value={editDraft.name}
                    onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEditMeta();
                      if (e.key === 'Escape') setIsEditingMeta(false);
                    }}
                    placeholder="Automation name"
                    autoFocus
                    className="text-sm font-semibold tracking-tight text-foreground bg-muted/40 border border-primary/40 rounded-lg px-2 py-0.5 h-6 w-full focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all"
                  />
                  <input
                    type="text"
                    value={editDraft.description}
                    onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setIsEditingMeta(false);
                    }}
                    placeholder="Add a description…"
                    className="text-[10px] font-medium text-muted-foreground bg-muted/40 border border-border/50 rounded-lg px-2 py-0.5 h-4 w-full focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                  />
                </div>
                {/* Confirm */}
                <button
                  type="button"
                  title="Save"
                  onClick={commitEditMeta}
                  disabled={!editDraft.name.trim()}
                  className="h-7 w-7 rounded-lg flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all shrink-0"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </button>
                {/* Cancel */}
                <button
                  type="button"
                  title="Cancel"
                  onClick={() => setIsEditingMeta(false)}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0 group/meta">
                <div className="min-w-0 flex flex-col justify-center">
                  <p className="text-sm font-semibold tracking-tight text-foreground truncate leading-snug">
                    {currentData.name || automation.name || 'Untitled Workflow'}
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground truncate leading-snug">
                    {currentData.description || automation.description || 'Add a description…'}
                  </p>
                </div>
                <button
                  type="button"
                  title="Edit name & description"
                  onClick={openEditMeta}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 opacity-0 group-hover/meta:opacity-100 transition-all shrink-0"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Active / Inactive toggle */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/60 bg-card/50">
            <Switch
              id="automation-active-toggle"
              checked={isNew ? (currentData.isActive ?? false) : (automation.isActive ?? false)}
              onCheckedChange={v => {
                if (isNew) {
                  setCurrentData(prev => ({ ...prev, isActive: v }));
                } else {
                  handleToggleActive(v);
                }
              }}
              disabled={isTogglingStatus || automation.isArchived}
              className="data-[state=checked]:bg-emerald-500"
            />
            <Label
              htmlFor="automation-active-toggle"
              className={cn(
                'text-[11px] font-semibold cursor-pointer select-none transition-colors',
                isNew ? (currentData.isActive ? 'text-emerald-600' : 'text-muted-foreground') : (automation.isActive ? 'text-emerald-600' : 'text-muted-foreground'),
              )}
            >
              {isTogglingStatus ? 'Updating…' : (isNew ? (currentData.isActive ? 'Active' : 'Inactive') : (automation.isActive ? 'Active' : 'Inactive'))}
            </Label>
          </div>

          {!isNew && !automation.isArchived ? (
            <div className="flex items-center gap-0.5 bg-muted/40 rounded-xl p-0.5 mr-1">
              <button
                type="button"
                onClick={() => setActiveTab('designer')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all',
                  activeTab === 'designer'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <PenTool size={12} /> Designer
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('activity')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all',
                  activeTab === 'activity'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Users size={12} /> Activity
              </button>
            </div>
          ) : null}

          {!isNew && !automation.isArchived ? (
            <Button
              variant="outline"
              className="rounded-xl font-bold h-10 gap-2 border-primary/20 text-primary"
              onClick={() => setTestDialogOpen(true)}
            >
              <Play className="h-4 w-4" /> Test Flow
            </Button>
          ) : null}
          <Button
            onClick={handleSave}
            disabled={isSaving || automation.isArchived}
            className="rounded-xl font-semibold h-10 px-6 shadow-xl shadow-primary/20 gap-2 text-xs"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Automation
          </Button>
        </div>
      </header>

      {automation.isArchived ? (
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-6 py-3 flex items-center justify-between gap-4 z-20">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
            <p className="text-xs font-bold text-rose-950 dark:text-rose-200">
              This automation is archived. You must restore it before making changes or executing it.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-4 rounded-xl border-rose-500/20 text-rose-600 dark:text-rose-400 bg-background hover:bg-rose-500/10 text-xs font-bold transition-all active:scale-95 shadow-sm shrink-0"
            onClick={async () => {
              if (!user?.uid) return;
              const res = await restoreAutomationAction(automationId, user.uid);
              if (res.success) {
                toast({ title: 'Automation Restored', description: 'This workflow can now be edited and activated.' });
              } else {
                toast({ variant: 'destructive', title: 'Restore failed', description: res.error });
              }
            }}
          >
            Restore Automation
          </Button>
        </div>
      ) : null}

      {(!automation.workspaceIds || automation.workspaceIds.length === 0) ? (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-3 z-20">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-xs font-bold text-amber-900">
            <span className="font-semibold">Warning:</span> This automation has no workspace
            constraint and may trigger across all workspaces.
          </p>
        </div>
      ) : null}

      <div className="flex-1 relative overflow-hidden">
        {activeTab === 'designer' ? (
          <AutomationMetaProvider automationId={automationId}>
            <AutomationBuilder
              key={builderKey}
              initialNodes={currentData.nodes ?? automation.nodes}
              initialEdges={currentData.edges ?? automation.edges}
              triggers={activeTriggers}
              onStateChange={handleStateChange}
              onTriggersChange={handleTriggersChange}
              automationId={automationId}
            />
          </AutomationMetaProvider>
        ) : (
          <AutomationActivityLog
            automationId={automationId}
            nodes={currentData.nodes ?? automation.nodes ?? []}
          />
        )}
      </div>

      <Dialog
        open={testDialogOpen}
        onOpenChange={(open) => {
          setTestDialogOpen(open);
          if (!open) {
            setEntitySearch('');
            setEntityDropdownOpen(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Test automation flow</DialogTitle>
            <DialogDescription>
              Runs this blueprint once with a synthetic trigger payload. Results appear in the
              Automation Hub run ledger.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Workspace (read-only) */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Workspace</Label>
              <Input value={testWorkspaceId} disabled className="font-mono text-xs" />
            </div>

            {/* Entity search picker */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Target Entity</Label>

              {/* Selected entity badge */}
              {testEntityId && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 animate-in fade-in duration-200">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs font-semibold text-primary flex-1 truncate">{testEntityName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTestEntityId('');
                      setTestEntityName('');
                      setEntitySearch('');
                    }}
                    className="text-primary/60 hover:text-primary transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={entitySearch}
                  onChange={(e) => {
                    setEntitySearch(e.target.value);
                    setEntityDropdownOpen(true);
                    if (testEntityId) {
                      setTestEntityId('');
                      setTestEntityName('');
                    }
                  }}
                  onFocus={() => setEntityDropdownOpen(true)}
                  placeholder="Search by name…"
                  className="pl-8 text-xs h-10 rounded-xl"
                />
              </div>

              {/* Results dropdown */}
              {entityDropdownOpen && entitySearch.trim() && (
                <div className="border border-border/60 rounded-xl bg-card shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  {filteredEntities.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <p className="text-xs font-semibold text-muted-foreground">No entities found</p>
                    </div>
                  ) : (
                    <ul className="max-h-52 overflow-y-auto divide-y divide-border/30">
                      {filteredEntities.map((entity) => {
                        const label = entity.displayName || entity.id;
                        const entityId = entity.entityId || entity.id;
                        return (
                          <li key={entity.id}>
                            <button
                              type="button"
                              className={cn(
                                'w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-primary/5 transition-colors group',
                                testEntityId === entityId && 'bg-primary/10',
                              )}
                              onClick={() => {
                                setTestEntityId(entityId);
                                setTestEntityName(label);
                                setEntitySearch('');
                                setEntityDropdownOpen(false);
                              }}
                            >
                              <div className="h-6 w-6 rounded-lg bg-muted flex items-center justify-center shrink-0 text-[9px] font-black text-muted-foreground uppercase">
                                {label.charAt(0)}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-semibold text-foreground truncate">{label}</span>
                                <span className="text-[9px] text-muted-foreground/50 truncate">{entity.entityType || 'entity'}</span>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setTestDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleTestFlow}
              disabled={isTesting || !testEntityId}
              className="gap-2"
            >
              {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recovery Dialog */}
      <Dialog
        open={showRestoreDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowRestoreDialog(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md rounded-3xl border border-border/20 shadow-2xl bg-card/90 backdrop-blur-md p-6 animate-in fade-in zoom-in-95 duration-200">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg font-bold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
              Unsaved Changes Detected
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs leading-relaxed pt-2">
              We found a local backup of this workflow with unsaved changes. This typically happens if the browser closed unexpectedly.
            </DialogDescription>
          </DialogHeader>

          {backupData && (
            <div className="my-4 p-4 rounded-2xl bg-muted/40 border border-border/50 space-y-2 text-xs">
              <div className="flex justify-between items-center text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                <span>Backup Created</span>
                <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                  Unsaved Draft
                </span>
              </div>
              <div className="font-semibold text-foreground text-sm">
                {new Date(backupData.timestamp).toLocaleString()}
              </div>
              <div className="text-[11px] text-muted-foreground line-clamp-2">
                <span className="font-semibold text-foreground">Name:</span> {backupData.name}
                {backupData.description && (
                  <>
                    <br />
                    <span className="font-semibold text-foreground">Desc:</span> {backupData.description}
                  </>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={handleDiscard}
              className="rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive text-xs transition-all duration-200"
            >
              Discard Backup
            </Button>
            <Button
              onClick={handleRestoreBackup}
              className="rounded-xl font-semibold shadow-lg shadow-primary/20 bg-primary text-primary-foreground hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 text-xs gap-2"
            >
              Restore Backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
