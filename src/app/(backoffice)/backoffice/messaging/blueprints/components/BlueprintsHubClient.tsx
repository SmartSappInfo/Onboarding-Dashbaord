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
import { generateContactVariableDefinitions } from '@/lib/contact-variable-definitions';
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
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Execution Error',
        description: error.message || 'An error occurred during template seeding.',
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
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Migration Failed',
        description: error.message || 'An error occurred during template migration.',
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
    return globalTemplates?.find((t) => t.templateType === triggerId && t.channel === channel);
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

  const variables = React.useMemo(() => {
    const contactVarDefs = generateContactVariableDefinitions('institution');
    const firestoreVars = firestoreVariables || [];
    const existingKeys = new Set(contactVarDefs.map((v: VariableDefinition) => v.key));
    const deduped = firestoreVars.filter((v: VariableDefinition) => !existingKeys.has(v.key) && !v.key.startsWith('school_'));

    // Dynamic terminology variables
    const terminologyVars: VariableDefinition[] = [
        {
            id: 'branding_entity_name',
            key: 'entity_name',
            label: `${singular || 'Campus'} Name`,
            category: 'common',
            source: 'branding',
            sourceName: 'Branding & Constants',
            entity: 'Entity',
            path: 'name',
            type: 'string',
        },
        {
            id: 'branding_entity_email',
            key: 'entity_email',
            label: `${singular || 'Campus'} Email`,
            category: 'common',
            source: 'branding',
            sourceName: 'Branding & Constants',
            entity: 'Entity',
            path: 'email',
            type: 'string',
        },
        {
            id: 'branding_entity_phone',
            key: 'entity_phone',
            label: `${singular || 'Campus'} Phone`,
            category: 'common',
            source: 'branding',
            sourceName: 'Branding & Constants',
            entity: 'Entity',
            path: 'phone',
            type: 'string',
        },
        {
            id: 'branding_entity_location',
            key: 'entity_location',
            label: `${singular || 'Campus'} Location`,
            category: 'common',
            source: 'branding',
            sourceName: 'Branding & Constants',
            entity: 'Entity',
            path: 'locationString',
            type: 'string',
        },
        {
            id: 'branding_entity_initials',
            key: 'entity_initials',
            label: `${singular || 'Campus'} Initials`,
            category: 'common',
            source: 'branding',
            sourceName: 'Branding & Constants',
            entity: 'Entity',
            path: 'initials',
            type: 'string',
        },
        {
            id: 'branding_entity_package',
            key: 'entity_package',
            label: `${singular || 'Campus'} Package`,
            category: 'common',
            source: 'branding',
            sourceName: 'Branding & Constants',
            entity: 'Entity',
            path: 'subscriptionPackageName',
            type: 'string',
        }
    ];

    return [...contactVarDefs, ...terminologyVars, ...deduped];
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
              entities={[]}
              meetings={[]}
              surveys={[]}
              pdfs={[]}
              onCancel={() => {
                setIsCustomizing(false);
                setEditingTemplate(null);
              }}
              isSaving={isSaving}
              onSave={async (data) => {
                if (!profile) return;
                setIsSaving(true);
                try {
                  const payload = {
                    name: data.name,
                    category: data.category,
                    templateType: data.templateType,
                    channel: data.channel,
                    subject: data.subject,
                    body: data.body,
                    variableContext: data.variableContext,
                    declaredVariables: data.declaredVariables,
                    reminderConfig: data.reminderConfig,
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
                } catch (e: any) {
                  toast({ variant: 'destructive', title: 'Failed to publish blueprint', description: e.message });
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
    </div>
  );
}
