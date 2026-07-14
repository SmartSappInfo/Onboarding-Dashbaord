'use client';

import * as React from 'react';
import { MESSAGING_TRIGGERS } from '@/lib/messaging-triggers';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { MessageTemplate, VariableDefinition, WorkspaceEntity, Meeting, Survey, PDFForm, MessageChannel, MessagingTrigger } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { 
  Zap, Loader2, ArrowLeft, Building2, BarChart2, Search, 
  SlidersHorizontal, X, Info, Inbox, RefreshCw, Database
} from 'lucide-react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { getVariablesAction } from '@/lib/services/fields-variables-service';
import dynamic from 'next/dynamic';
import { getBlueprintAdoptionStats, updateGlobalTemplate, createGlobalTemplate } from '@/lib/template-actions';
import { seedGlobalTemplatesAction } from '@/app/actions/seed-global-templates-action';
import { migrateTemplatesAction } from '@/app/actions/migrate-templates-action';
import { useBackoffice } from '../../../context/BackofficeProvider';
import { BlueprintListItem } from './BlueprintListItem';
import { BlueprintDetailPane } from './BlueprintDetailPane';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input as CustomInput } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';

// Dynamically import the heavy workshop to keep the initial hub lightweight
const TemplateWorkshop = dynamic(
  () => import('@/app/admin/messaging/templates/components/template-workshop').then(m => m.TemplateWorkshop),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-background z-[100]">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm font-semibold text-muted-foreground animate-pulse">Loading Global Blueprint Workshop...</p>
        </div>
      </div>
    )
  }
);

import { useTerminology } from '@/hooks/use-terminology';

export default function BlueprintsHubClient() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { profile } = useBackoffice();
  const { singular } = useTerminology();
  const [editingTemplate, setEditingTemplate] = React.useState<MessageTemplate | null>(null);
  const [isCustomizing, setIsCustomizing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [adoptionStats, setAdoptionStats] = React.useState<Record<string, number>>({});
  const [isSeedingBlueprints, setIsSeedingBlueprints] = React.useState(false);
  const [isMigratingTemplates, setIsMigratingTemplates] = React.useState(false);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [newTriggerId, setNewTriggerId] = React.useState('');
  const [newChannel, setNewChannel] = React.useState<MessageChannel | ''>('');
  const [newName, setNewName] = React.useState('');

  const selectedTriggerForCreate = React.useMemo(() => {
    return MESSAGING_TRIGGERS.find(t => t.id === newTriggerId) || null;
  }, [newTriggerId]);

  React.useEffect(() => {
    if (selectedTriggerForCreate) {
      const defaultChannel = (selectedTriggerForCreate.supportedChannels[0] as MessageChannel) || 'email';
      setNewChannel(defaultChannel);
      const chanLabel = defaultChannel === 'email' ? 'Email' : defaultChannel === 'whatsapp' ? 'WhatsApp' : defaultChannel.toUpperCase();
      setNewName(`Global ${selectedTriggerForCreate.name} (${chanLabel})`);
    } else {
      setNewChannel('');
      setNewName('');
    }
  }, [selectedTriggerForCreate]);

  React.useEffect(() => {
    if (selectedTriggerForCreate && newChannel) {
      const chanLabel = newChannel === 'email' ? 'Email' : newChannel === 'whatsapp' ? 'WhatsApp' : newChannel.toUpperCase();
      setNewName(`Global ${selectedTriggerForCreate.name} (${chanLabel})`);
    }
  }, [newChannel, selectedTriggerForCreate]);

  const handleSeedBlueprints = async () => {
    setIsSeedingBlueprints(true);
    try {
      const result = await seedGlobalTemplatesAction();
      if (result.created > 0) {
        toast({
          title: 'Blueprints Seeded',
          description: `Successfully initialized ${result.created} global messaging templates.`,
        });
      } else if (result.failed > 0) {
        toast({
          variant: 'destructive',
          title: 'Seeding Failed',
          description: result.errors?.[0]?.error || 'Failed to seed messaging templates.',
        });
      } else {
        toast({
          title: 'Blueprints Synchronized',
          description: 'Global messaging templates are already up-to-date.',
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({
        variant: 'destructive',
        title: 'Execution Error',
        description: errorMessage,
      });
    } finally {
      setIsSeedingBlueprints(false);
    }
  };

  const handleMigrateTemplates = async () => {
    if (!profile?.id) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'User profile is not loaded.',
      });
      return;
    }
    setIsMigratingTemplates(true);
    try {
      const result = await migrateTemplatesAction(profile.id);
      if (result.migrated > 0) {
        toast({
          title: 'Migration Successful',
          description: `Migrated ${result.migrated} templates. (Scanned: ${result.total}, Skipped: ${result.skipped})`,
        });
      } else if (result.failed > 0) {
        toast({
          variant: 'destructive',
          title: 'Migration Partially Failed',
          description: `Failed to migrate ${result.failed} templates. Check console logs for details.`,
        });
      } else {
        toast({
          title: 'Migration Checked',
          description: `No legacy templates required migration. (Scanned: ${result.total}, Skipped: ${result.skipped})`,
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({
        variant: 'destructive',
        title: 'Migration Failed',
        description: errorMessage,
      });
    } finally {
      setIsMigratingTemplates(false);
    }
  };

  // Fetch only global templates
  const globalQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'message_templates'), where('scope', '==', 'global'));
  }, [firestore]);

  const { data: globalTemplates, isLoading } = useCollection<MessageTemplate>(globalQuery);

  // Fetch Adoption Stats
  React.useEffect(() => {
    async function loadStats() {
      const statsMap: Record<string, number> = {};
      await Promise.all(
        MESSAGING_TRIGGERS.map(async (trigger) => {
          try {
            const stats = await getBlueprintAdoptionStats(trigger.id);
            statsMap[trigger.id] = stats.activeOverrides;
          } catch (error) {
            console.error(`Failed to fetch stats for ${trigger.id}`, error);
            statsMap[trigger.id] = 0;
          }
        })
      );
      setAdoptionStats(statsMap);
    }
    loadStats();
  }, []);

  // ── Filters & Search State (Responsive React Transitions) ────────────
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const [selectedRecipient, setSelectedRecipient] = React.useState<string>('all');
  const [selectedChannel, setSelectedChannel] = React.useState<string>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = React.useState(false);

  const deferredSearchQuery = React.useDeferredValue(searchQuery);

  const filteredTriggers = React.useMemo(() => {
    return MESSAGING_TRIGGERS.filter(trigger => {
      // 1. Search Query
      if (deferredSearchQuery.trim()) {
        const query = deferredSearchQuery.toLowerCase();
        const matchesName = trigger.name.toLowerCase().includes(query);
        const matchesDesc = trigger.description?.toLowerCase().includes(query);
        const matchesId = trigger.id.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesId) return false;
      }

      // 2. Category
      if (selectedCategory !== 'all' && trigger.category !== selectedCategory) return false;

      // 3. Recipient
      if (selectedRecipient !== 'all' && trigger.recipientType !== selectedRecipient) return false;

      // 4. Channel
      if (selectedChannel !== 'all' && !trigger.supportedChannels.includes(selectedChannel as any)) return false;

      return true;
    });
  }, [deferredSearchQuery, selectedCategory, selectedRecipient, selectedChannel]);

  // ── Active Selection State ───────────────────────────────────────────
  const [selectedTriggerId, setSelectedTriggerId] = React.useState<string | null>(null);

  const selectedTrigger = React.useMemo(() => {
    const found = MESSAGING_TRIGGERS.find(t => t.id === selectedTriggerId);
    if (found && filteredTriggers.some(t => t.id === selectedTriggerId)) {
      return found;
    }
    return filteredTriggers[0] || null;
  }, [selectedTriggerId, filteredTriggers]);

  // Sync active selection on filter changes
  React.useEffect(() => {
    if (selectedTrigger && selectedTrigger.id !== selectedTriggerId) {
      setSelectedTriggerId(selectedTrigger.id);
    }
  }, [selectedTrigger, selectedTriggerId]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedRecipient('all');
    setSelectedChannel('all');
  };

  const getGlobalTemplate = (triggerId: string, channel: MessageChannel) => {
    return globalTemplates?.find((t) => t.templateType === triggerId && t.channel === channel && t.isActive === true) ||
           globalTemplates?.find((t) => t.templateType === triggerId && t.channel === channel);
  };

  const handleCustomize = (trigger: MessagingTrigger, channel: MessageChannel) => {
    const globalTemplate = getGlobalTemplate(trigger.id, channel);

    if (globalTemplate) {
      setEditingTemplate(globalTemplate);
    } else {
      // Create a blank slate locked to this trigger for creation
      setEditingTemplate({
        name: `Global ${trigger.name}`,
        category: trigger.category,
        templateType: trigger.id,
        channel: channel,
        target: trigger.target,
        recipientType: trigger.recipientType,
        body: '',
        variableContext: 'common' as const,
        scope: 'global' as const,
        version: 1,
        status: 'active' as const,
        declaredVariables: []
      } as unknown as MessageTemplate);
    }
    setIsCustomizing(true);
  };

  // Necessary contexts for Workshop
  const varsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'messaging_variables'), orderBy('category', 'asc'));
  }, [firestore]);
  const { data: firestoreVariables } = useCollection<VariableDefinition>(varsQuery);

  const [variables, setVariables] = React.useState<VariableDefinition[]>([]);

  React.useEffect(() => {
    let active = true;
    getVariablesAction({
      workspaceId: 'onboarding',
      terminology: singular ? { singular, plural: `${singular}s` } : undefined
    }).then((res) => {
      if (!active) return;
      const mapped = res.map((v) => ({
        id: v.key,
        key: v.key,
        label: v.label,
        category: v.category,
        source: v.source,
        entity: 'Entity',
        path: v.path || '',
        type: v.dataType,
      }));
      setVariables(mapped);
    }).catch(console.error);

    return () => {
      active = false;
    };
  }, [firestoreVariables, singular]);

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'meetings', label: 'Meetings' },
    { value: 'forms', label: 'Forms' },
    { value: 'surveys', label: 'Surveys' },
    { value: 'agreements', label: 'Agreements' },
    { value: 'users', label: 'Users' },
    { value: 'general', label: 'General' },
    { value: 'tasks', label: 'Tasks' },
    { value: 'automations', label: 'Automations' },
    { value: 'qr_codes', label: 'QR Codes' }
  ];

  return (
    <div className="h-[calc(100vh-10rem)] min-h-[600px] flex flex-col overflow-hidden bg-background rounded-3xl border border-border shadow-md">
      <AnimatePresence mode="wait">
        {isCustomizing ? (
          <div className="fixed inset-0 z-50 flex flex-col bg-background">
            <TemplateWorkshop 
              key="workshop"
              mode="superadmin_blueprint"
              initialTemplate={editingTemplate}
              initialContext={editingTemplate ? {
                category: editingTemplate.category,
                channel: editingTemplate.channel,
                recipientType: editingTemplate.recipientType,
                templateType: editingTemplate.templateType
              } : undefined}
              variables={variables || []}
              styles={[]}
              meetings={[]}
              surveys={[]}
              pdfs={[]}
              onCancel={() => {
                setIsCustomizing(false);
                setEditingTemplate(null);
              }}
              isSaving={isSaving}
              onSave={async (data: Partial<MessageTemplate>) => {
                if (!profile) return;
                setIsSaving(true);
                try {
                  const payload = {
                    name: data.name || '',
                    category: data.category || 'general',
                    templateType: data.templateType || '',
                    channel: data.channel || 'email',
                    subject: data.subject,
                    body: data.body || '',
                    variableContext: data.variableContext || 'common',
                    declaredVariables: data.declaredVariables,
                    reminderConfig: data.reminderConfig,
                    target: data.target || editingTemplate?.target,
                    recipientType: data.recipientType || editingTemplate?.recipientType,
                    status: data.status || editingTemplate?.status,
                    isActive: data.isActive !== undefined ? data.isActive : editingTemplate?.isActive,
                  };

                  if (editingTemplate && editingTemplate.id) {
                    await updateGlobalTemplate(editingTemplate.id, payload, profile.id);
                  } else {
                    await createGlobalTemplate({
                      ...payload,
                      createdBy: profile.id,
                    });
                  }
                  
                  setIsCustomizing(false);
                  setEditingTemplate(null);
                  toast({
                    title: 'Blueprint Published',
                    description: 'The global blueprint has been updated successfully.',
                  });
                } catch (e: unknown) {
                  const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
                  toast({ variant: 'destructive', title: 'Failed to publish blueprint', description: errorMessage });
                } finally {
                  setIsSaving(false);
                }
              }}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden text-left h-full">
            {/* Header */}
            <div className="shrink-0 p-6 border-b flex items-center justify-between gap-4 bg-card">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild className="rounded-xl h-10 w-10 border shadow-sm shrink-0">
                  <Link href="/backoffice"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-emerald-500/5 text-emerald-600 dark:text-emerald-500 border-emerald-500/20 font-bold uppercase tracking-widest text-[9px] px-2 py-0.5">
                      Superadmin Backoffice
                    </Badge>
                  </div>
                  <h1 className="text-xl font-bold tracking-tight text-foreground mt-0.5 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-emerald-500 fill-emerald-500/20" /> System Blueprints
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-md border-none gap-2 font-semibold text-xs h-9 px-4 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  New Blueprint
                </Button>

                <Button
                  onClick={handleSeedBlueprints}
                  disabled={isSeedingBlueprints}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md border-none gap-2 font-semibold text-xs h-9 px-4 shrink-0"
                >
                  {isSeedingBlueprints ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {isSeedingBlueprints ? 'Syncing...' : 'Sync Blueprints'}
                </Button>

                <Button
                  onClick={handleMigrateTemplates}
                  disabled={isMigratingTemplates}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md border-none gap-2 font-semibold text-xs h-9 px-4 shrink-0"
                >
                  {isMigratingTemplates ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  {isMigratingTemplates ? 'Migrating...' : 'Migrate Legacy Variables'}
                </Button>
              </div>
            </div>

            {/* Split Master-Detail layout */}
            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-4 bg-background">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-sm font-semibold text-muted-foreground animate-pulse">Loading Blueprints Registry...</p>
              </div>
            ) : (
              <div className="flex-1 flex overflow-hidden">
              
              {/* Left Column: Master list of triggers */}
              <div className="w-full lg:w-[420px] shrink-0 border-r flex flex-col bg-card overflow-hidden">
                {/* Search & Filters */}
                <div className="p-4 border-b space-y-3 bg-muted/10 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <CustomInput
                        placeholder="Search blueprints..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9 rounded-xl text-xs bg-background"
                      />
                      {searchQuery && (
                        <button 
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-2.5 hover:text-foreground text-muted-foreground transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                      className={cn(
                        "h-9 w-9 rounded-xl border shrink-0",
                        showAdvancedFilters && "bg-emerald-500/5 text-emerald-600 border-emerald-500/20"
                      )}
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Horizontal Scroll category badges */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar shrink-0">
                    {categories.map((cat) => (
                      <button
                        key={cat.value}
                        onClick={() => setSelectedCategory(cat.value)}
                        className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase border transition-all shrink-0",
                          selectedCategory === cat.value
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-sm"
                            : "bg-background text-muted-foreground border-border hover:text-foreground"
                        )}
                      >
                        {cat.label.replace('All Categories', 'All')}
                      </button>
                    ))}
                  </div>

                  {/* Advanced dropdown selectors */}
                  <AnimatePresence>
                    {showAdvancedFilters && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden pt-2 space-y-2 border-t border-dashed"
                      >
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase font-bold text-muted-foreground">Recipient Type</label>
                            <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
                              <SelectTrigger className="h-8 rounded-lg text-[11px] bg-background">
                                <SelectValue placeholder="Recipient" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="all">All Recipients</SelectItem>
                                <SelectItem value="external_alert">External Alert</SelectItem>
                                <SelectItem value="internal_alert">Internal Alert</SelectItem>
                                <SelectItem value="respondent">Respondent</SelectItem>
                                <SelectItem value="entity">Entity</SelectItem>
                                <SelectItem value="assignee">Assignee</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] uppercase font-bold text-muted-foreground">Channel Support</label>
                            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                              <SelectTrigger className="h-8 rounded-lg text-[11px] bg-background">
                                <SelectValue placeholder="Channel" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="all">All Channels</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="sms">SMS</SelectItem>
                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                <SelectItem value="push">Push</SelectItem>
                                <SelectItem value="in_app">In-App</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="flex justify-end pt-1">
                          <Button 
                            variant="ghost" 
                            onClick={handleClearFilters}
                            className="h-8 text-[10px] font-bold uppercase rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground px-4"
                          >
                            Reset Filters
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Left panel items list */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {filteredTriggers.length > 0 ? (
                    filteredTriggers.map(trigger => (
                      <BlueprintListItem
                        key={trigger.id}
                        trigger={trigger}
                        isActive={selectedTrigger?.id === trigger.id}
                        globalTemplates={globalTemplates || undefined}
                        adoptionCount={adoptionStats[trigger.id] || 0}
                        onClick={() => setSelectedTriggerId(trigger.id)}
                      />
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-8 space-y-4 border border-dashed rounded-2xl bg-muted/10 mt-4">
                      <Inbox className="h-10 w-10 text-muted-foreground/30 stroke-[1.5]" />
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-foreground">No blueprints match search</p>
                        <p className="text-[10px] text-muted-foreground leading-relaxed max-w-[200px]">Adjust your filter options to find the active system default layouts.</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleClearFilters}
                        className="h-8 text-[10px] font-bold uppercase px-3 rounded-lg"
                      >
                        Clear Filters
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Stationed preview details */}
              <div className="hidden lg:flex flex-1 flex-col overflow-hidden p-6 bg-muted/10">
                {selectedTrigger ? (
                  <BlueprintDetailPane
                    trigger={selectedTrigger}
                    globalTemplates={globalTemplates || undefined}
                    adoptionCount={adoptionStats[selectedTrigger.id] || 0}
                    onCustomize={handleCustomize}
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <Info className="h-10 w-10 text-muted-foreground/30 mb-2 stroke-[1.5]" />
                    <p className="text-sm font-semibold text-muted-foreground">Select a blueprint trigger from the left list to review dynamic defaults and global usage rates.</p>
                  </div>
                )}
              </div>

              </div>
            )}
          </div>
        )}
      </AnimatePresence>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-3xl border p-6 bg-card text-left">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" /> Create Global Blueprint
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Map a new global template override to an existing system trigger. If an active blueprint already exists for the selected trigger and channel, it will be automatically archived when you activate the new one.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Select Trigger</label>
              <Select value={newTriggerId} onValueChange={setNewTriggerId}>
                <SelectTrigger className="w-full rounded-xl bg-background border text-xs h-10">
                  <SelectValue placeholder="Choose a trigger..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] rounded-xl">
                  {MESSAGING_TRIGGERS.map((trigger) => (
                    <SelectItem key={trigger.id} value={trigger.id} className="text-xs">
                      {trigger.name} ({trigger.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTriggerForCreate && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Select Channel</label>
                  <Select 
                    value={newChannel} 
                    onValueChange={(val) => setNewChannel(val as MessageChannel)}
                  >
                    <SelectTrigger className="w-full rounded-xl bg-background border text-xs h-10">
                      <SelectValue placeholder="Choose a channel..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {selectedTriggerForCreate.supportedChannels.map((ch) => (
                        <SelectItem key={ch} value={ch} className="text-xs">
                          {ch.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Blueprint Name</label>
                  <CustomInput
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Enter blueprint name..."
                    className="rounded-xl text-xs h-10 bg-background"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              className="rounded-xl text-xs h-9 px-4"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedTriggerForCreate || !newChannel || !newName.trim()) return;
                setIsCreateDialogOpen(false);
                setEditingTemplate({
                  name: newName,
                  category: selectedTriggerForCreate.category,
                  templateType: selectedTriggerForCreate.id,
                  channel: newChannel,
                  target: selectedTriggerForCreate.target,
                  recipientType: selectedTriggerForCreate.recipientType,
                  body: '',
                  variableContext: selectedTriggerForCreate.category === 'surveys' ? 'survey' : (selectedTriggerForCreate.category === 'meetings' ? 'meeting' : (selectedTriggerForCreate.category === 'agreements' ? 'agreement' : 'common')),
                  scope: 'global' as const,
                  version: 1,
                  status: 'draft' as const,
                  isActive: false,
                  declaredVariables: []
                } as unknown as MessageTemplate);
                setIsCustomizing(true);
              }}
              disabled={!newTriggerId || !newChannel || !newName.trim()}
              className="rounded-xl text-xs h-9 px-4"
            >
              Create & Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
