'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Unified CRM & Lead Capture Engine
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Compact Single-Row Question Listing with Expandable '+ Map' Drawer.
 * 2. Identity Bridge Segregation: Detects and badges primary anchors from Tab 1.
 * 3. Grouped Searchable Variable Selector with single '+ Create New Property' action inside list view.
 * 4. Optimistic catalog update on schema property creation via CreateFieldDialog.
 * 5. Full WYSIWYG Form Editor Canvas under Tab 1 Dedicated Contact Card.
 * 6. Mobile Ergonomics: Touch targets >= 44px (min-h-[44px]), tactile press (active:scale-[0.97]).
 * 7. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Database,
  Layers,
  GitMerge,
  Tags,
  Plus,
  Trash2,
  PlusCircle,
  Zap,
  Sparkles,
  UserCheck,
  User,
  Building2,
  Mail,
  Phone,
  Layout,
  Eye,
  EyeOff,
  Check,
  Search,
  ShieldCheck,
  Wand2,
  ArrowUpRight,
  ChevronDown,
  Pencil,
  X,
} from 'lucide-react';
import { cn, stripHtml } from '@/lib/utils';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { MultiSelect } from '@/components/ui/multi-select';
import { PipelineStageSelector } from './PipelineStageSelector';
import { getSurveyCrmFieldDefinitionsAction } from '@/lib/surveys/survey-crm-sync-actions';
import { createFieldAction, createFieldGroupAction } from '@/lib/fields-actions';
import { createTagAction } from '@/lib/tag-actions';
import { saveAutomationAction } from '@/lib/automation-actions';
import type {
  SurveyElement,
  SurveyQuestion,
  SurveyCrmConfig,
  SurveyCrmFieldMapping,
  SurveyCrmFieldDefinition,
  CrmTargetEntityType,
  CrmFieldWriteMode,
  AppField,
  FieldGroup,
  Tag,
  TagCategory,
  Automation,
} from '@/lib/types';

interface LeadCaptureFieldItem {
  show?: boolean;
  label?: string;
  required?: boolean;
  placeholder?: string;
  isCustom?: boolean;
  type?: string;
}

export function SurveyCrmEngineCard() {
  const { control, watch, setValue } = useFormContext();
  const firestore = useFirestore();
  const { activeWorkspaceId, activeOrganizationId, activeWorkspace } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const entityTerminology = activeWorkspace?.terminology?.singular || 'Contact';

  // Active Tab state inside CRM Engine
  const [activeCrmTab, setActiveCrmTab] = React.useState<'identity' | 'mappings' | 'routing'>('identity');

  // Survey Questions list
  const elements = (watch('elements') || []) as SurveyElement[];
  const questions = React.useMemo<SurveyQuestion[]>(() => {
    const qList = elements.filter((el): el is SurveyQuestion => 'isRequired' in el || ['nps', 'rating', 'text', 'multiple_choice', 'email', 'phone', 'number'].includes(el.type));
    return qList.map((q) => ({
      ...q,
      title: stripHtml(q.title || ''),
    }));
  }, [elements]);

  const createEntity: boolean = watch('createEntity') || false;
  const leadCaptureMode: 'questions' | 'form' = watch('leadCaptureMode') || 'questions';

  const crmConfig: SurveyCrmConfig = watch('crmConfig') || {
    enabled: true,
    autoUpsertContact: true,
    autoUpsertEntity: true,
    fieldMappings: [],
    taskRules: [],
    dealRules: [],
    leadScoreAdjustment: { enabled: true, pointsPerSurveyCompleted: 5, pointsForPromoter: 10, pointsForDetractor: -15 },
    timelineLoggingEnabled: true,
  };

  // 1. Identity Bridge Anchors (Tab 1)
  const contactNameFieldId = (watch('entityMapping.contactNameFieldId') as string) || '';
  const contactEmailFieldId = (watch('entityMapping.contactEmailFieldId') as string) || '';
  const contactPhoneFieldId = (watch('entityMapping.contactPhoneFieldId') as string) || '';
  const entityNameFieldId = (watch('entityMapping.entityNameFieldId') as string) || '';

  const identityAnchorMap = React.useMemo(() => {
    const map = new Map<string, { label: string; icon: 'user' | 'mail' | 'phone' | 'building' }>();
    if (contactNameFieldId) map.set(contactNameFieldId, { label: 'Contact Name', icon: 'user' });
    if (contactEmailFieldId) map.set(contactEmailFieldId, { label: 'Email Address', icon: 'mail' });
    if (contactPhoneFieldId) map.set(contactPhoneFieldId, { label: 'Phone / Mobile', icon: 'phone' });
    if (entityNameFieldId) map.set(entityNameFieldId, { label: `${entityTerminology} Name`, icon: 'building' });
    return map;
  }, [contactNameFieldId, contactEmailFieldId, contactPhoneFieldId, entityNameFieldId, entityTerminology]);

  // 2. Field Configs for WYSIWYG Editor
  const fieldsConfig = (watch('leadCaptureFieldsConfig') || {}) as Record<string, LeadCaptureFieldItem>;
  const allKeys = Object.keys(fieldsConfig);
  const standardKeys = ['name', 'email', 'phone', 'company'];
  const sortedKeys = React.useMemo(() => {
    return [
      ...standardKeys.filter((k) => allKeys.includes(k)),
      ...allKeys.filter((k) => !standardKeys.includes(k)),
    ];
  }, [allKeys]);

  // Ensure default config values are loaded in form state if createEntity is toggled
  React.useEffect(() => {
    if (createEntity) {
      if (!watch('leadCaptureTitle')) {
        setValue('leadCaptureTitle', 'Claim Your Results', { shouldDirty: true });
      }
      if (!watch('leadCaptureDescription')) {
        setValue('leadCaptureDescription', 'Kindly provide your details so that we can send you your results', { shouldDirty: true });
      }
      if (!watch('leadCaptureFieldsConfig') || Object.keys(watch('leadCaptureFieldsConfig') || {}).length === 0) {
        setValue('leadCaptureFieldsConfig', {
          name: { show: true, label: 'Full Name', required: true, placeholder: 'Enter your name' },
          email: { show: true, label: 'Email Address', required: true, placeholder: 'name@example.com' },
          phone: { show: false, label: 'Phone Number', required: false, placeholder: '+1 (555) 000-0000' },
          company: { show: false, label: 'Company Name', required: false, placeholder: 'Enter company name' },
        }, { shouldDirty: true });
      }
    }
  }, [createEntity, setValue, watch]);

  // 3. Data Fetching
  const [availableCrmFields, setAvailableCrmFields] = React.useState<SurveyCrmFieldDefinition[]>([]);
  const [isLoadingFields, setIsLoadingFields] = React.useState(true);

  const loadCrmFields = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsLoadingFields(true);
    try {
      const res = await getSurveyCrmFieldDefinitionsAction(activeWorkspaceId);
      if (res.success && res.fields) {
        setAvailableCrmFields(res.fields);
      }
    } catch (err) {
      console.error('Failed to load CRM fields:', err);
    } finally {
      setIsLoadingFields(false);
    }
  }, [activeWorkspaceId]);

  React.useEffect(() => {
    loadCrmFields();
  }, [loadCrmFields]);

  const tagsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'tags'), where('workspaceId', '==', activeWorkspaceId), orderBy('name', 'asc'));
  }, [firestore, activeWorkspaceId]);
  const { data: tags } = useCollection<Tag>(tagsQuery);

  const automationsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'automations'),
      where('workspaceIds', 'array-contains', activeWorkspaceId),
      orderBy('name', 'asc')
    );
  }, [firestore, activeWorkspaceId]);
  const { data: automations } = useCollection<Automation>(automationsQuery);

  const fieldGroupsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'field_groups'), where('workspaceId', '==', activeWorkspaceId), orderBy('order', 'asc'));
  }, [firestore, activeWorkspaceId]);
  const { data: fieldGroups } = useCollection<FieldGroup>(fieldGroupsQuery);

  // 4. Dialog & Expanded Row States
  const [isCreateTagOpen, setIsCreateTagOpen] = React.useState(false);
  const [isCreateAutomationOpen, setIsCreateAutomationOpen] = React.useState(false);
  const [isCreateFieldOpen, setIsCreateFieldOpen] = React.useState(false);
  const [activeQuestionIdForNewField, setActiveQuestionIdForNewField] = React.useState<string | null>(null);
  const [newFieldInitialLabel, setNewFieldInitialLabel] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Track expanded question mapping drawers
  const [expandedQuestionIds, setExpandedQuestionIds] = React.useState<Set<string>>(new Set());

  const toggleExpandQuestion = (qId: string) => {
    setExpandedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) {
        next.delete(qId);
      } else {
        next.add(qId);
      }
      return next;
    });
  };

  // Tab 2 Mapping Filter & Search
  const [mappingFilter, setMappingFilter] = React.useState<'all' | 'unmapped' | 'mapped' | 'anchors'>('all');
  const [searchFilter, setSearchFilter] = React.useState('');

  // 5. Grouped Variable Taxonomy for Selector
  const groupedVariableOptions = React.useMemo(() => {
    const seen = new Set<string>();
    const dedupe = (items: SurveyCrmFieldDefinition[]) =>
      items.filter((item) => {
        if (seen.has(item.key)) return false;
        seen.add(item.key);
        return true;
      });

    const standardContact = dedupe(availableCrmFields.filter((f) => f.targetType === 'contact'));
    const entityCustom = dedupe(availableCrmFields.filter((f) => f.targetType === 'entity'));
    const dealFields = dedupe(availableCrmFields.filter((f) => f.targetType === 'deal'));

    return [
      { label: 'Standard Contact Properties', options: standardContact },
      { label: 'Workspace Custom Fields', options: entityCustom },
      { label: 'Deal Pipeline Properties', options: dealFields },
    ].filter((g) => g.options.length > 0);
  }, [availableCrmFields]);

  // 6. Mapping Mutation Handlers
  const handleSetQuestionMapping = (
    questionId: string,
    targetFieldKey: string,
    targetType?: CrmTargetEntityType,
    writeMode?: CrmFieldWriteMode
  ) => {
    const currentMappings = (crmConfig.fieldMappings || []).filter((m) => m.questionId !== questionId);
    if (!targetFieldKey || targetFieldKey === 'none') {
      setValue('crmConfig.fieldMappings', currentMappings, { shouldDirty: true });
      return;
    }

    const fieldDef = availableCrmFields.find((f) => f.key === targetFieldKey);
    const resolvedTargetType = targetType || fieldDef?.targetType || 'contact';
    const resolvedWriteMode = writeMode || 'fill_if_empty';

    const newMapping: SurveyCrmFieldMapping = {
      id: `map_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      questionId,
      targetType: resolvedTargetType,
      targetField: targetFieldKey,
      writeMode: resolvedWriteMode,
      transform: 'trim',
    };

    setValue('crmConfig.fieldMappings', [...currentMappings, newMapping], { shouldDirty: true });
  };

  const handleUpdateMappingWriteMode = (questionId: string, writeMode: CrmFieldWriteMode) => {
    const existing = (crmConfig.fieldMappings || []).find((m) => m.questionId === questionId);
    if (existing) {
      const updated = (crmConfig.fieldMappings || []).map((m) =>
        m.questionId === questionId ? { ...m, writeMode } : m
      );
      setValue('crmConfig.fieldMappings', updated, { shouldDirty: true });
    }
  };

  const handleUnmapQuestion = (questionId: string) => {
    const updated = (crmConfig.fieldMappings || []).filter((m) => m.questionId !== questionId);
    setValue('crmConfig.fieldMappings', updated, { shouldDirty: true });
  };

  // 7. Smart Auto-Match Routine
  const handleAutoMatch = () => {
    let matchedCount = 0;
    const currentMappings = [...(crmConfig.fieldMappings || [])];

    questions.forEach((q) => {
      // Skip if already an identity anchor
      if (identityAnchorMap.has(q.id)) return;
      // Skip if already mapped
      if (currentMappings.some((m) => m.questionId === q.id)) return;

      const normalizedTitle = q.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const bestMatch = availableCrmFields.find((f) => {
        const normLabel = f.label.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normKey = f.key.replace('customFields.', '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return (
          normalizedTitle.includes(normLabel) ||
          normLabel.includes(normalizedTitle) ||
          normalizedTitle === normKey
        );
      });

      if (bestMatch) {
        currentMappings.push({
          id: `map_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          questionId: q.id,
          targetType: bestMatch.targetType,
          targetField: bestMatch.key,
          writeMode: 'fill_if_empty',
          transform: 'trim',
        });
        matchedCount++;
      }
    });

    if (matchedCount > 0) {
      setValue('crmConfig.fieldMappings', currentMappings, { shouldDirty: true });
      toast({
        title: 'Auto-Mapping Complete',
        description: `Successfully mapped ${matchedCount} question${matchedCount > 1 ? 's' : ''} to matching CRM properties.`,
      });
    } else {
      toast({
        title: 'No Direct Matches Found',
        description: 'All questions are either already mapped or require manual property selection.',
      });
    }
  };

  // 8. In-Studio Property Creation
  const handleCreateField = async (data: {
    label: string;
    variableName: string;
    type?: string;
    groupId?: string;
    newGroupName?: string;
  }) => {
    if (!user || !activeWorkspaceId) return;
    setIsSubmitting(true);
    try {
      let groupId = data.groupId || '';
      if (data.newGroupName?.trim()) {
        const groupRes = await createFieldGroupAction(
          {
            workspaceId: activeWorkspaceId,
            organizationId: activeOrganizationId || 'default',
            name: data.newGroupName.trim(),
            description: 'Custom field group created from Survey Studio.',
            icon: 'Folder',
            color: '#4f46e5',
            entityTypes: ['person', 'institution', 'family'],
          },
          user.uid
        );

        if (groupRes.success && groupRes.id) {
          groupId = groupRes.id;
        }
      } else if (!groupId && fieldGroups && fieldGroups.length > 0) {
        groupId = fieldGroups[0].id;
      }

      const res = await createFieldAction(
        {
          workspaceId: activeWorkspaceId,
          organizationId: activeOrganizationId || '',
          name: data.variableName,
          label: data.label,
          variableName: data.variableName,
          type: (data.type as AppField['type']) || 'short_text',
          groupId: groupId || 'custom',
          section: 'common',
          compatibilityScope: ['common'],
          status: 'active',
          isNative: false,
          description: `Custom field created via Survey Studio for question mapping.`,
        },
        user.uid
      );

      if (res.success && res.id) {
        const newKey = `customFields.${data.variableName}`;
        const newFieldDef: SurveyCrmFieldDefinition = {
          key: newKey,
          label: data.label,
          type: data.type === 'number' ? 'number' : data.type === 'boolean' ? 'boolean' : 'string',
          group: 'Entity Custom Fields',
          targetType: 'entity',
          description: data.label,
        };

        // Optimistically update catalog
        setAvailableCrmFields((prev) => [newFieldDef, ...prev.filter((f) => f.key !== newKey)]);

        // Auto-assign to active question if set
        if (activeQuestionIdForNewField) {
          handleSetQuestionMapping(activeQuestionIdForNewField, newKey, 'entity', 'fill_if_empty');
          // Ensure the drawer remains expanded to show the mapped state
          setExpandedQuestionIds((prev) => new Set(prev).add(activeQuestionIdForNewField));
        }

        toast({
          title: 'Property Created & Mapped',
          description: `"${data.label}" (${newKey}) added to workspace schema and mapped.`,
        });
        setIsCreateFieldOpen(false);
        setActiveQuestionIdForNewField(null);
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to Create Property',
          description: res.error || 'Could not save field to schema.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTag = async (data: { name: string; category?: string; color?: string }) => {
    if (!user || !activeWorkspaceId) return;
    const trimmedName = data.name.trim();
    const existingTag = tags?.find((t) => t.name.toLowerCase() === trimmedName.toLowerCase());
    if (existingTag) {
      toast({ title: 'Tag Auto-Selected', description: `Tag "${existingTag.name}" already exists.` });
      setIsCreateTagOpen(false);
      const current = (watch('autoTags') as string[]) || [];
      if (!current.includes(existingTag.id)) {
        setValue('autoTags', [...current, existingTag.id], { shouldDirty: true });
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createTagAction({
        workspaceId: activeWorkspaceId,
        organizationId: activeOrganizationId || '',
        name: trimmedName,
        category: [
          'behavioral',
          'demographic',
          'interest',
          'status',
          'lifecycle',
          'engagement',
          'custom',
        ].includes(data.category || '')
          ? (data.category as TagCategory)
          : 'custom',
        color: data.color || '#3B82F6',
        userId: user.uid,
        userName: user.displayName || 'System',
      });
      if (res.success && res.data?.id) {
        toast({ title: 'Tag Created', description: `Tag "${trimmedName}" added to registry.` });
        setIsCreateTagOpen(false);
        const current = (watch('autoTags') as string[]) || [];
        setValue('autoTags', [...current, res.data.id], { shouldDirty: true });
      } else {
        toast({ variant: 'destructive', title: 'Action Failed', description: res?.error || 'Failed to create tag.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAutomation = async (data: { name: string }) => {
    if (!user || !activeWorkspaceId) return;
    setIsSubmitting(true);
    try {
      const res = await saveAutomationAction(
        null,
        {
          workspaceIds: [activeWorkspaceId],
          name: data.name,
          status: 'draft',
          isActive: false,
          nodes: [],
          edges: [],
          trigger: { type: 'SURVEY_SUBMITTED', config: {} },
        } as unknown as Automation,
        user.uid
      );
      if (res.success && res.id) {
        toast({ title: 'Automation Drafted', description: `"${data.name}" created.` });
        setIsCreateAutomationOpen(false);
        const current = (watch('autoAutomations') as string[]) || [];
        setValue('autoAutomations', [...current, res.id], { shouldDirty: true });
      } else {
        toast({ variant: 'destructive', title: 'Action Failed', description: res.error });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedAutomations = (watch('autoAutomations') as string[]) || [];
  const hasDraftAutomations = React.useMemo(() => {
    if (!automations || selectedAutomations.length === 0) return false;
    return automations.some((a) => selectedAutomations.includes(a.id) && !a.isActive);
  }, [automations, selectedAutomations]);

  // 9. Computed Question Counts for Tab 2
  const mappedCount = (crmConfig.fieldMappings || []).length;
  const identityAnchorCount = identityAnchorMap.size;
  const unmappedCount = questions.filter(
    (q) => !identityAnchorMap.has(q.id) && !(crmConfig.fieldMappings || []).some((m) => m.questionId === q.id)
  ).length;

  // Filtered Question List for Display
  const filteredQuestions = React.useMemo(() => {
    return questions.filter((q) => {
      const isAnchor = identityAnchorMap.has(q.id);
      const isMapped = (crmConfig.fieldMappings || []).some((m) => m.questionId === q.id);

      if (mappingFilter === 'unmapped' && (isAnchor || isMapped)) return false;
      if (mappingFilter === 'mapped' && !isMapped) return false;
      if (mappingFilter === 'anchors' && !isAnchor) return false;

      if (searchFilter.trim()) {
        const query = searchFilter.toLowerCase();
        return q.title.toLowerCase().includes(query) || q.type.toLowerCase().includes(query);
      }
      return true;
    });
  }, [questions, identityAnchorMap, crmConfig.fieldMappings, mappingFilter, searchFilter]);

  return (
    <Card className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
      {/* ─── MASTER HEADER ─── */}
      <CardHeader className="bg-muted/10 border-b border-border/60 py-4 px-5 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
              <Database className="h-4.5 w-4.5" />
            </div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm sm:text-base font-bold text-foreground">
                CRM & Lead Capture Engine
              </CardTitle>
              <CardInfoTooltip text={`Match survey responses to CRM ${entityTerminology.toLowerCase()} profiles, dynamic custom fields, and deal pipelines.`} />
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-primary/5 text-primary border-primary/20">
              {entityTerminology}
            </Badge>
            <div className="flex items-center gap-2">
              <Switch
                id="crm-master-toggle"
                checked={createEntity}
                onCheckedChange={(checked) => setValue('createEntity', checked, { shouldDirty: true })}
                className="data-[state=checked]:bg-primary scale-110"
              />
              <Label htmlFor="crm-master-toggle" className="text-xs font-semibold cursor-pointer select-none">
                {createEntity ? 'Active' : 'Disabled'}
              </Label>
            </div>
          </div>
        </div>

        {/* ─── QUICK-SYNC MODIFIER CHIPS ─── */}
        {createEntity && (
          <div className="pt-3 mt-3 border-t border-border/40 grid grid-cols-1 sm:grid-cols-3 gap-2 animate-in fade-in duration-300">
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-muted/20">
              <div className="space-y-0.5">
                <span className="text-[11px] font-bold text-foreground block">Auto-Upsert</span>
                <span className="text-[9px] text-muted-foreground block">Match by email/phone</span>
              </div>
              <Switch
                checked={crmConfig.autoUpsertContact !== false}
                onCheckedChange={(checked) => setValue('crmConfig.autoUpsertContact', checked, { shouldDirty: true })}
                className="scale-75"
              />
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-muted/20">
              <div className="space-y-0.5">
                <span className="text-[11px] font-bold text-foreground block">Custom Fields</span>
                <span className="text-[9px] text-muted-foreground block">Update entity schema</span>
              </div>
              <Switch
                checked={crmConfig.autoUpsertEntity !== false}
                onCheckedChange={(checked) => setValue('crmConfig.autoUpsertEntity', checked, { shouldDirty: true })}
                className="scale-75"
              />
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-muted/20">
              <div className="space-y-0.5">
                <span className="text-[11px] font-bold text-foreground block">Timeline Cards</span>
                <span className="text-[9px] text-muted-foreground block">Log submission activity</span>
              </div>
              <Switch
                checked={crmConfig.timelineLoggingEnabled !== false}
                onCheckedChange={(checked) => setValue('crmConfig.timelineLoggingEnabled', checked, { shouldDirty: true })}
                className="scale-75"
              />
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6">
        {!createEntity ? (
          <div className="p-8 text-center border border-dashed border-border/80 rounded-2xl bg-muted/10 space-y-2">
            <Database className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <h4 className="text-xs font-bold text-foreground">CRM Synchronization is Disabled</h4>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Enable the master switch above to route respondents into your CRM, map custom properties, apply tags, and trigger pipeline stages.
            </p>
          </div>
        ) : (
          <Tabs value={activeCrmTab} onValueChange={(val) => setActiveCrmTab(val as 'identity' | 'mappings' | 'routing')} className="w-full">
            <TabsList className="grid grid-cols-3 h-11 p-1 bg-muted/40 rounded-xl border border-border/50 select-none">
              <TabsTrigger
                value="identity"
                className="text-xs font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all gap-1.5 min-h-[36px]"
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span className="truncate">Identity Bridge</span>
              </TabsTrigger>

              <TabsTrigger
                value="mappings"
                className="text-xs font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all gap-1.5 min-h-[36px]"
              >
                <Layers className="h-3.5 w-3.5" />
                <span className="truncate">Field Mappings ({mappedCount})</span>
                {unmappedCount > 0 && (
                  <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" title={`${unmappedCount} unmapped questions`} />
                )}
              </TabsTrigger>

              <TabsTrigger
                value="routing"
                className="text-xs font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all gap-1.5 min-h-[36px]"
              >
                <GitMerge className="h-3.5 w-3.5" />
                <span className="truncate">Tags & Pipeline</span>
              </TabsTrigger>
            </TabsList>

            {/* ─── TAB 1: IDENTITY BRIDGE & FORM DESIGNER ─── */}
            <TabsContent value="identity" className="mt-5 space-y-5 outline-none animate-in fade-in-50 duration-200">
              {/* Lead Capture Mode Selector */}
              <div className="space-y-3">
                <Label className="text-xs font-bold text-foreground">Lead Capture Mechanism</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setValue('leadCaptureMode', 'questions', { shouldDirty: true })}
                    className={cn(
                      'p-3.5 rounded-xl border text-left transition-all min-h-[44px] active:scale-[0.97] flex flex-col justify-center',
                      leadCaptureMode === 'questions'
                        ? 'bg-card border-primary ring-1 ring-primary/30 shadow-xs'
                        : 'bg-background border-border/50 opacity-70 hover:opacity-100'
                    )}
                  >
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-primary" /> Map Survey Questions
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      Extract identity from answers provided during the survey questionnaire.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setValue('leadCaptureMode', 'form', { shouldDirty: true })}
                    className={cn(
                      'p-3.5 rounded-xl border text-left transition-all min-h-[44px] active:scale-[0.97] flex flex-col justify-center',
                      leadCaptureMode === 'form'
                        ? 'bg-card border-primary ring-1 ring-primary/30 shadow-xs'
                        : 'bg-background border-border/50 opacity-70 hover:opacity-100'
                    )}
                  >
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Layout className="h-3.5 w-3.5 text-primary" /> Dedicated Contact Card
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      Present a dedicated lead capture card before revealing final survey results.
                    </span>
                  </button>
                </div>
              </div>

              {/* Mode 1: Survey Question Sources */}
              {leadCaptureMode === 'questions' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-border/60 bg-muted/10">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-primary" /> Contact Name Source
                    </Label>
                    <Controller
                      name="entityMapping.contactNameFieldId"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || 'none'} onValueChange={(val) => field.onChange(val === 'none' ? '' : val)}>
                          <SelectTrigger className="h-9 text-xs rounded-xl bg-card">
                            <SelectValue placeholder="Select question..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" className="text-xs italic text-muted-foreground">None / Skip</SelectItem>
                            {questions.map((q) => (
                              <SelectItem key={q.id} value={q.id} className="text-xs">
                                {q.title || 'Untitled Question'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-primary" /> Email Address Source
                    </Label>
                    <Controller
                      name="entityMapping.contactEmailFieldId"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || 'none'} onValueChange={(val) => field.onChange(val === 'none' ? '' : val)}>
                          <SelectTrigger className="h-9 text-xs rounded-xl bg-card">
                            <SelectValue placeholder="Select question..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" className="text-xs italic text-muted-foreground">None / Skip</SelectItem>
                            {questions.map((q) => (
                              <SelectItem key={q.id} value={q.id} className="text-xs">
                                {q.title || 'Untitled Question'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-primary" /> Phone Number Source
                    </Label>
                    <Controller
                      name="entityMapping.contactPhoneFieldId"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || 'none'} onValueChange={(val) => field.onChange(val === 'none' ? '' : val)}>
                          <SelectTrigger className="h-9 text-xs rounded-xl bg-card">
                            <SelectValue placeholder="Select question..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" className="text-xs italic text-muted-foreground">None / Skip</SelectItem>
                            {questions.map((q) => (
                              <SelectItem key={q.id} value={q.id} className="text-xs">
                                {q.title || 'Untitled Question'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-primary" /> Entity / Organization Source
                    </Label>
                    <Controller
                      name="entityMapping.entityNameFieldId"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || 'none'} onValueChange={(val) => field.onChange(val === 'none' ? '' : val)}>
                          <SelectTrigger className="h-9 text-xs rounded-xl bg-card">
                            <SelectValue placeholder="Select question..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" className="text-xs italic text-muted-foreground">None / Skip</SelectItem>
                            {questions.map((q) => (
                              <SelectItem key={q.id} value={q.id} className="text-xs">
                                {q.title || 'Untitled Question'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>
              ) : (
                /* Mode 2: Interactive Full WYSIWYG Lead Capture Form Canvas */
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between pb-1">
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] font-bold uppercase tracking-tight">
                      WYSIWYG Form Editor Canvas
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      Live preview of respondent contact card
                    </span>
                  </div>

                  <div className="w-full mx-auto bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-6 text-left bg-gradient-to-b from-card to-muted/20 relative">
                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-muted/60 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider text-muted-foreground select-none border border-border/40">
                      <Layout className="h-3 w-3 mr-1 text-primary" /> Live Form Preview
                    </div>

                    {/* Header: Title & Description */}
                    <div className="space-y-3 text-center border-b border-border/50 pb-5 pt-2">
                      <Controller
                        name="leadCaptureTitle"
                        control={control}
                        render={({ field }) => (
                          <input
                            type="text"
                            {...field}
                            value={field.value || ''}
                            placeholder="Claim Your Results"
                            className="w-full text-lg sm:text-xl font-bold tracking-tight bg-transparent border-b border-dashed border-transparent hover:border-muted-foreground/30 focus:border-primary focus:outline-none text-center transition-all px-2 py-1 text-foreground"
                          />
                        )}
                      />
                      <Controller
                        name="leadCaptureDescription"
                        control={control}
                        render={({ field }) => (
                          <textarea
                            {...field}
                            value={field.value || ''}
                            placeholder="Kindly provide your details so that we can send you your results"
                            className="w-full text-xs text-muted-foreground leading-relaxed max-w-md mx-auto bg-transparent border-b border-dashed border-transparent hover:border-muted-foreground/30 focus:border-primary focus:outline-none text-center transition-all resize-none px-2 py-1 font-medium"
                            rows={2}
                          />
                        )}
                      />
                    </div>

                    {/* Fields List */}
                    <div className="space-y-3">
                      {sortedKeys.map((fKey) => {
                        const fCfg = fieldsConfig[fKey] || {};
                        const isShow = fCfg.show !== false;
                        const isRequired = !!fCfg.required;
                        const isCustom = !!fCfg.isCustom;

                        return (
                          <div
                            key={fKey}
                            className={cn(
                              'p-3.5 rounded-xl border transition-all relative group/field',
                              isShow ? 'bg-muted/15 border-border/60' : 'bg-muted/30 border-dashed border-border/40 opacity-60'
                            )}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                                {fKey === 'name' && <User className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />}
                                {fKey === 'email' && <Mail className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />}
                                {fKey === 'phone' && <Phone className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />}
                                {fKey === 'company' && <Building2 className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />}
                                {isCustom && <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />}

                                <Controller
                                  name={`leadCaptureFieldsConfig.${fKey}.label`}
                                  control={control}
                                  render={({ field }) => (
                                    <input
                                      type="text"
                                      {...field}
                                      value={field.value || ''}
                                      className="text-xs font-bold text-foreground bg-transparent border-b border-dashed border-transparent hover:border-muted-foreground/30 focus:border-primary focus:outline-none flex-1 min-w-0"
                                      placeholder="Field Label"
                                    />
                                  )}
                                />
                                {isRequired && <span className="text-destructive font-bold text-xs shrink-0">*</span>}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {/* Required Toggle Button */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setValue(`leadCaptureFieldsConfig.${fKey}.required`, !isRequired, { shouldDirty: true })
                                  }
                                  className={cn(
                                    'text-[10px] px-2 py-0.5 rounded-md font-bold transition-all border shrink-0',
                                    isRequired
                                      ? 'bg-red-500/10 text-red-600 border-red-500/20'
                                      : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80'
                                  )}
                                >
                                  Required
                                </button>

                                {/* Visible / Show Toggle Button */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setValue(`leadCaptureFieldsConfig.${fKey}.show`, !isShow, { shouldDirty: true })
                                  }
                                  className={cn(
                                    'p-1 rounded-lg border transition-all shrink-0',
                                    isShow
                                      ? 'bg-primary/10 text-primary border-primary/20'
                                      : 'bg-muted/40 text-muted-foreground/60 border-transparent hover:bg-muted/60'
                                  )}
                                  title={isShow ? 'Visible' : 'Hidden'}
                                >
                                  {isShow ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                                </button>

                                {/* Delete Custom Field Button */}
                                {isCustom && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const current = { ...fieldsConfig };
                                      delete current[fKey];
                                      setValue('leadCaptureFieldsConfig', current, { shouldDirty: true });
                                    }}
                                    className="p-1 rounded-lg border border-transparent text-destructive hover:bg-destructive/10 hover:border-destructive/20 transition-all shrink-0"
                                    title="Delete custom field"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Simulated Input / Disabled Preview */}
                            {isShow ? (
                              <Controller
                                name={`leadCaptureFieldsConfig.${fKey}.placeholder`}
                                control={control}
                                render={({ field }) => (
                                  <input
                                    type="text"
                                    {...field}
                                    value={field.value || ''}
                                    placeholder={`e.g. Enter ${fCfg.label?.toLowerCase() || fKey}...`}
                                    className="w-full h-10 rounded-xl bg-background/80 border border-border/80 px-3.5 text-xs font-medium text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all mt-1"
                                  />
                                )}
                              />
                            ) : (
                              <div className="w-full h-10 rounded-xl bg-muted/40 border border-dashed border-border/80 px-3.5 text-xs font-medium text-muted-foreground/30 flex items-center select-none opacity-50 mt-1">
                                (Field Hidden from Respondent)
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Submit Button Preview */}
                    <div className="pt-2">
                      <div className="w-full h-11 rounded-xl font-bold text-xs tracking-wide bg-gradient-to-r from-primary to-primary/85 text-primary-foreground shadow-sm flex items-center justify-center gap-2 select-none opacity-95 transition-all">
                        {watch('submitButtonText')?.trim() || 'Submit & View Results'}
                      </div>
                      <p className="text-[10px] text-center text-muted-foreground mt-1.5">
                        Submit button label is configurable in Step 1 (Details)
                      </p>
                    </div>

                    {/* Add Custom Field Button */}
                    <div className="pt-3 border-t border-border/40 flex justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const current = (watch('leadCaptureFieldsConfig') || {}) as Record<string, LeadCaptureFieldItem>;
                          const customKey = `custom_${Date.now()}`;
                          setValue(
                            'leadCaptureFieldsConfig',
                            {
                              ...current,
                              [customKey]: {
                                show: true,
                                label: 'Custom Property',
                                required: false,
                                isCustom: true,
                                type: 'text',
                              },
                            },
                            { shouldDirty: true }
                          );
                        }}
                        className="rounded-xl border-dashed border-2 border-primary/40 text-primary hover:bg-primary/5 px-4 h-9 font-bold transition-all text-xs flex items-center gap-1.5 active:scale-[0.97]"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Custom Field
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ─── TAB 2: AUTOMATIC FIELD MAPPINGS & EXPANDABLE QUESTION ROWS ─── */}
            <TabsContent value="mappings" className="mt-5 space-y-4 outline-none animate-in fade-in-50 duration-200">
              {/* Toolbar & Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-border/40">
                <div>
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary" /> Survey Questions ➔ CRM Properties
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Click <strong>+ Map</strong> on any question below to expand and route answers to standard contact properties or custom schema variables.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAutoMatch}
                    className="h-8 px-3 text-xs font-bold gap-1.5 rounded-xl border-primary/30 text-primary hover:bg-primary/5 active:scale-[0.97]"
                    title="Auto-match question titles to CRM property names"
                  >
                    <Wand2 className="h-3.5 w-3.5" /> Auto-Match
                  </Button>
                </div>
              </div>

              {/* Filter Pills & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setMappingFilter('all')}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border shrink-0 active:scale-[0.97]',
                      mappingFilter === 'all'
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/60'
                    )}
                  >
                    All Questions ({questions.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setMappingFilter('unmapped')}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border shrink-0 active:scale-[0.97]',
                      mappingFilter === 'unmapped'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                        : 'bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/60'
                    )}
                  >
                    Unmapped ({unmappedCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => setMappingFilter('mapped')}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border shrink-0 active:scale-[0.97]',
                      mappingFilter === 'mapped'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/60'
                    )}
                  >
                    Mapped ({mappedCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => setMappingFilter('anchors')}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border shrink-0 active:scale-[0.97]',
                      mappingFilter === 'anchors'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/60'
                    )}
                  >
                    Identity Anchors ({identityAnchorCount})
                  </button>
                </div>

                <div className="relative w-full sm:w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                  <Input
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search questions..."
                    className="h-8 pl-8 text-xs rounded-xl bg-card border-border/60"
                  />
                  {searchFilter && (
                    <button
                      type="button"
                      onClick={() => setSearchFilter('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Questions Single-Row Expandable List */}
              {questions.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-border/80 rounded-xl bg-muted/10 space-y-1">
                  <Layers className="h-8 w-8 text-muted-foreground/40 mx-auto mb-1" />
                  <p className="text-xs font-bold text-foreground">No Survey Questions Found</p>
                  <p className="text-[11px] text-muted-foreground">Add questions in Step 2 (Builder) to map their answers to CRM properties.</p>
                </div>
              ) : filteredQuestions.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-border/80 rounded-xl bg-muted/10 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">No questions match the selected filter.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredQuestions.map((q) => {
                    const isAnchor = identityAnchorMap.has(q.id);
                    const anchorInfo = identityAnchorMap.get(q.id);
                    const mapping = (crmConfig.fieldMappings || []).find((m) => m.questionId === q.id);
                    const isMapped = !!mapping;
                    const isExpanded = expandedQuestionIds.has(q.id);
                    const mappedFieldDef = isMapped ? availableCrmFields.find((f) => f.key === mapping.targetField) : null;

                    return (
                      <div
                        key={q.id}
                        className={cn(
                          'rounded-xl border transition-all bg-card overflow-hidden',
                          isAnchor
                            ? 'border-blue-500/30 bg-blue-500/[0.02]'
                            : isMapped
                            ? 'border-emerald-500/30 bg-emerald-500/[0.01]'
                            : 'border-border/60 hover:border-border/80'
                        )}
                      >
                        {/* Compact Single-Row Question Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4">
                          {/* Left: Question Title & Type Badges */}
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-foreground leading-snug break-words">
                                {q.title}
                              </span>
                              <Badge variant="secondary" className="text-[9px] font-bold uppercase py-0 px-1.5 bg-muted">
                                {q.type}
                              </Badge>
                              {q.isRequired && (
                                <Badge variant="outline" className="text-[8px] font-bold uppercase py-0 px-1 text-destructive border-destructive/20">
                                  Required
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Right: Status Pill & Map/Expand Actions */}
                          <div className="shrink-0 flex items-center gap-2 flex-wrap sm:flex-nowrap">
                            {isAnchor ? (
                              <button
                                type="button"
                                onClick={() => setActiveCrmTab('identity')}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20 hover:bg-blue-500/20 transition-all active:scale-[0.97]"
                                title="Configured in Identity Bridge (Tab 1)"
                              >
                                <ShieldCheck className="h-3.5 w-3.5" />
                                <span>Anchor: {anchorInfo?.label}</span>
                                <ArrowUpRight className="h-3 w-3 opacity-60" />
                              </button>
                            ) : isMapped ? (
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                  <span className="truncate max-w-[140px] sm:max-w-[180px]">
                                    {mappedFieldDef?.label || mapping.targetField}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground font-normal">
                                    ({mapping.writeMode === 'always_overwrite' ? 'Overwrite' : 'Fill empty'})
                                  </span>
                                </div>

                                <Button
                                  type="button"
                                  variant={isExpanded ? 'secondary' : 'outline'}
                                  size="sm"
                                  onClick={() => toggleExpandQuestion(q.id)}
                                  className="h-8 w-8 p-0 rounded-xl active:scale-[0.97]"
                                  title={isExpanded ? 'Hide mapping editor' : 'Edit CRM mapping'}
                                >
                                  <Pencil className={cn('h-3.5 w-3.5', isExpanded ? 'text-primary' : 'text-muted-foreground')} />
                                </Button>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUnmapQuestion(q.id)}
                                  className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl active:scale-[0.97]"
                                  title="Unmap this question"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] font-bold py-1 px-2.5">
                                  Unmapped
                                </Badge>

                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => toggleExpandQuestion(q.id)}
                                  className={cn(
                                    'h-8 px-3 text-xs font-bold gap-1.5 rounded-xl transition-all active:scale-[0.97]',
                                    isExpanded ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground shadow-xs'
                                  )}
                                >
                                  {isExpanded ? (
                                    <>
                                      <ChevronDown className="h-3.5 w-3.5 rotate-180" /> Hide
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="h-3.5 w-3.5" /> Map
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Expanded Mapping Controls (When '+ Map' or 'Edit' is clicked) */}
                        {!isAnchor && isExpanded && (
                          <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4 pt-2 border-t border-border/40 bg-muted/10 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                              {/* Variable Selector */}
                              <div className="sm:col-span-7 space-y-1">
                                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                  Target CRM Variable / Property
                                </Label>
                                <SearchablePropertySelect
                                  value={mapping?.targetField || 'none'}
                                  onSelect={(val) => {
                                    handleSetQuestionMapping(q.id, val, mapping?.targetType, mapping?.writeMode);
                                  }}
                                  groups={groupedVariableOptions}
                                  placeholder="Select CRM Variable / Property..."
                                  onCreateNew={(searchQuery) => {
                                    setActiveQuestionIdForNewField(q.id);
                                    setNewFieldInitialLabel(searchQuery || '');
                                    setIsCreateFieldOpen(true);
                                  }}
                                />
                              </div>

                              {/* Write Mode */}
                              <div className="sm:col-span-5 space-y-1">
                                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                  Sync Write Mode
                                </Label>
                                <Select
                                  value={mapping?.writeMode || 'fill_if_empty'}
                                  onValueChange={(val) => handleUpdateMappingWriteMode(q.id, val as CrmFieldWriteMode)}
                                  disabled={!isMapped}
                                >
                                  <SelectTrigger className="h-9 text-xs rounded-xl bg-card border-border/60">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="fill_if_empty" className="text-xs">
                                      <span>Fill if Empty</span>
                                      <span className="text-[10px] text-muted-foreground ml-1.5 font-normal">(Safe)</span>
                                    </SelectItem>
                                    <SelectItem value="always_overwrite" className="text-xs font-bold text-amber-600">
                                      <span>Always Overwrite</span>
                                      <span className="text-[10px] text-muted-foreground ml-1.5 font-normal">(Authoritative)</span>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ─── TAB 3: TAGS & PIPELINE ROUTING ─── */}
            <TabsContent value="routing" className="mt-5 space-y-5 outline-none animate-in fade-in-50 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Auto Tags */}
                <div className="space-y-3 p-4 rounded-xl border border-border/60 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Tags className="h-3.5 w-3.5 text-primary" /> Auto-Apply Registry Tags
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-primary hover:bg-primary/10 rounded-full px-2 gap-1 text-[10px] font-bold uppercase active:scale-[0.97]"
                      onClick={() => setIsCreateTagOpen(true)}
                    >
                      <PlusCircle className="h-3 w-3" /> New
                    </Button>
                  </div>
                  <Controller
                    name="autoTags"
                    control={control}
                    render={({ field }) => (
                      <MultiSelect
                        options={(tags || []).map((t) => ({ label: t.name, value: t.id }))}
                        value={field.value || []}
                        onChange={field.onChange}
                        placeholder="Select tags..."
                        className="rounded-xl bg-card border border-border/50 font-bold min-h-[44px]"
                      />
                    )}
                  />
                  <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                    Respondents will automatically join corresponding segments in the CRM upon submission.
                  </p>
                </div>

                {/* Executive Workflows */}
                <div className="space-y-3 p-4 rounded-xl border border-border/60 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-indigo-600" /> Executive Workflows
                    </Label>
                    <div className="flex items-center gap-1.5">
                      {hasDraftAutomations && (
                        <Badge variant="outline" className="text-[8px] font-black uppercase bg-amber-500/10 text-amber-600 border-amber-500/20">
                          Drafts
                        </Badge>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-primary hover:bg-primary/10 rounded-full px-2 gap-1 text-[10px] font-bold uppercase active:scale-[0.97]"
                        onClick={() => setIsCreateAutomationOpen(true)}
                      >
                        <PlusCircle className="h-3 w-3" /> New
                      </Button>
                    </div>
                  </div>
                  <Controller
                    name="autoAutomations"
                    control={control}
                    render={({ field }) => (
                      <MultiSelect
                        options={(automations || []).map((a) => ({
                          label: `${a.name}${!a.isActive ? ' (Draft)' : ''}`,
                          value: a.id,
                        }))}
                        value={field.value || []}
                        onChange={field.onChange}
                        placeholder="Select workflows..."
                        className="rounded-xl bg-card border border-border/50 font-bold min-h-[44px]"
                      />
                    )}
                  />
                  <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                    Trigger behavioral workflows immediately after response is saved.
                  </p>
                </div>
              </div>

              {/* Pipeline Stage Transitions */}
              <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitMerge className="h-4 w-4 text-primary" />
                    <Label className="text-xs font-bold text-foreground">Pipeline Stage Routing</Label>
                  </div>
                  <Switch
                    checked={!!watch('autoPipelineEnabled')}
                    onCheckedChange={(val) => {
                      setValue('autoPipelineEnabled', val, { shouldDirty: true });
                      if (!val) {
                        setValue('autoPipelineId', '', { shouldDirty: true });
                        setValue('autoPipelineStageId', '', { shouldDirty: true });
                      }
                    }}
                    className="scale-90 data-[state=checked]:bg-primary"
                  />
                </div>

                {watch('autoPipelineEnabled') && (
                  <div className="space-y-4 pt-2 border-t border-border/40 animate-in fade-in slide-in-from-top-2 duration-200">
                    <PipelineStageSelector
                      pipelineId={watch('autoPipelineId')}
                      stageId={watch('autoPipelineStageId')}
                      onPipelineChange={(pId) => setValue('autoPipelineId', pId, { shouldDirty: true })}
                      onStageChange={(sId) => setValue('autoPipelineStageId', sId, { shouldDirty: true })}
                    />

                    <div className="space-y-2 pt-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Execution Strategy
                      </Label>
                      <Controller
                        name="autoPipelineMode"
                        control={control}
                        render={({ field }) => (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => field.onChange('fallback')}
                              className={cn(
                                'p-3 rounded-xl border text-left transition-all min-h-[44px] flex flex-col justify-center active:scale-[0.97]',
                                (field.value || 'fallback') === 'fallback'
                                  ? 'bg-card border-primary ring-1 ring-primary/30 shadow-xs'
                                  : 'bg-background border-border/50 opacity-70 hover:opacity-100'
                              )}
                            >
                              <span className="text-xs font-bold text-foreground">Fallback Automation</span>
                              <span className="text-[9px] text-muted-foreground font-semibold">
                                Executes ONLY IF no individual score result rule moves the deal.
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => field.onChange('additional')}
                              className={cn(
                                'p-3 rounded-xl border text-left transition-all min-h-[44px] flex flex-col justify-center active:scale-[0.97]',
                                field.value === 'additional'
                                  ? 'bg-card border-primary ring-1 ring-primary/30 shadow-xs'
                                  : 'bg-background border-border/50 opacity-70 hover:opacity-100'
                              )}
                            >
                              <span className="text-xs font-bold text-foreground">Additional Automation</span>
                              <span className="text-[9px] text-muted-foreground font-semibold">
                                ALWAYS executes alongside individual result stage moves.
                              </span>
                            </button>
                          </div>
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>

      {/* ─── CREATION DIALOGS ─── */}
      <CreateFieldDialog
        open={isCreateFieldOpen}
        onOpenChange={(open) => {
          setIsCreateFieldOpen(open);
          if (!open) {
            setActiveQuestionIdForNewField(null);
            setNewFieldInitialLabel('');
          }
        }}
        onSubmit={handleCreateField}
        isSubmitting={isSubmitting}
        fieldGroups={fieldGroups || []}
        initialLabel={newFieldInitialLabel}
      />
      <CreateTagDialog open={isCreateTagOpen} onOpenChange={setIsCreateTagOpen} onSubmit={handleCreateTag} isSubmitting={isSubmitting} />
      <CreateAutomationDialog open={isCreateAutomationOpen} onOpenChange={setIsCreateAutomationOpen} onSubmit={handleCreateAutomation} isSubmitting={isSubmitting} />
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Searchable Property Combobox Component (Singular "+ Create New Field" in List View)
// ──────────────────────────────────────────────────────────────────────────────

interface SearchablePropertySelectProps {
  value: string;
  onSelect: (val: string) => void;
  groups: { label: string; options: SurveyCrmFieldDefinition[] }[];
  placeholder?: string;
  onCreateNew?: (initialLabel?: string) => void;
}

function SearchablePropertySelect({
  value,
  onSelect,
  groups,
  placeholder = 'Select CRM property...',
  onCreateNew,
}: SearchablePropertySelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const allOptions = groups.flatMap((g) => g.options);
  const selectedOpt = allOptions.find((o) => o.key === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-9 rounded-xl bg-card border-border/60 px-3 text-xs font-medium shadow-none hover:bg-muted/10 transition-all min-h-[36px]"
        >
          <span className="truncate">
            {value && value !== 'none' ? (
              <span className="font-semibold text-foreground">
                {selectedOpt?.label || value}
                <span className="text-[10px] text-muted-foreground ml-1.5 font-mono">({selectedOpt?.group || 'Property'})</span>
              </span>
            ) : (
              <span className="text-muted-foreground/70">{placeholder}</span>
            )}
          </span>
          <Search className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="p-0 rounded-2xl border-border/80 shadow-2xl bg-popover w-[320px] sm:w-[380px]" align="start" sideOffset={6}>
        <Command className="rounded-2xl bg-transparent">
          <div className="p-2 border-b border-border/40">
            <CommandInput
              value={searchQuery}
              onValueChange={setSearchQuery}
              placeholder="Search standard & custom properties..."
              className="h-9 text-xs font-medium"
              autoFocus
            />
          </div>
          <CommandList className="max-h-[260px] overflow-y-auto no-scrollbar p-1">
            <CommandEmpty className="py-4 px-3 text-center space-y-2">
              <p className="text-xs text-muted-foreground">No matching field found.</p>
              {onCreateNew && searchQuery.trim() && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const text = searchQuery.trim();
                    setOpen(false);
                    onCreateNew(text);
                  }}
                  className="h-8 px-3 text-xs font-bold gap-1.5 rounded-xl active:scale-[0.97] w-full"
                >
                  <Plus className="h-3.5 w-3.5" /> Create &quot;{searchQuery.trim()}&quot; as New Field
                </Button>
              )}
            </CommandEmpty>

            <CommandGroup>
              <CommandItem
                value="none_skip_mapping"
                onSelect={() => {
                  onSelect('none');
                  setOpen(false);
                }}
                className="text-xs font-medium py-2 px-3 cursor-pointer hover:bg-primary/5 rounded-lg"
              >
                <Check className={cn('mr-2 h-3.5 w-3.5 text-primary', value === 'none' || !value ? 'opacity-100' : 'opacity-0')} />
                <span className="italic text-muted-foreground">Do not map (Skip)</span>
              </CommandItem>
            </CommandGroup>

            {groups.map((group) => (
              <React.Fragment key={group.label}>
                <div className="px-3 py-1.5 text-[9px] uppercase tracking-wider font-bold text-muted-foreground/70 select-none">
                  {group.label}
                </div>
                <CommandGroup>
                  {group.options.map((opt) => (
                    <CommandItem
                      key={opt.key}
                      value={`${opt.label} ${opt.key}`}
                      onSelect={() => {
                        onSelect(opt.key);
                        setOpen(false);
                      }}
                      className="text-xs font-medium py-2 px-3 cursor-pointer hover:bg-primary/5 rounded-lg flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Check className={cn('h-3.5 w-3.5 text-primary shrink-0', value === opt.key ? 'opacity-100' : 'opacity-0')} />
                        <span className="font-semibold text-foreground truncate">{opt.label}</span>
                      </div>
                      <span className="text-[9px] text-muted-foreground font-mono ml-2 shrink-0">
                        {opt.type}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </React.Fragment>
            ))}
          </CommandList>

          {/* Singular in-list creation trigger */}
          {onCreateNew && (
            <div className="p-1.5 border-t border-border/40 bg-muted/20">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const text = searchQuery.trim();
                  setOpen(false);
                  onCreateNew(text || undefined);
                }}
                className="w-full h-8 text-xs font-bold text-primary hover:bg-primary/10 rounded-xl justify-start gap-2 active:scale-[0.97]"
              >
                <Plus className="h-3.5 w-3.5" />
                {searchQuery.trim() ? (
                  <span>Create &quot;{searchQuery.trim()}&quot; as New Field</span>
                ) : (
                  <span>Create New Field</span>
                )}
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// In-Studio Field Creation Dialog
// ──────────────────────────────────────────────────────────────────────────────

interface CreateFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    label: string;
    variableName: string;
    type?: string;
    groupId?: string;
    newGroupName?: string;
  }) => void;
  isSubmitting: boolean;
  fieldGroups: FieldGroup[];
  initialLabel?: string;
}

function CreateFieldDialog({ open, onOpenChange, onSubmit, isSubmitting, fieldGroups, initialLabel }: CreateFieldDialogProps) {
  const [label, setLabel] = React.useState('');
  const [variableName, setVariableName] = React.useState('');
  const [type, setType] = React.useState('short_text');
  const [selectedGroupId, setSelectedGroupId] = React.useState('');
  const [newGroupName, setNewGroupName] = React.useState('');
  const [showNewGroupInput, setShowNewGroupInput] = React.useState(false);

  const handleLabelChange = (val: string) => {
    setLabel(val);
    setVariableName(val.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
  };

  React.useEffect(() => {
    if (open) {
      const init = initialLabel?.trim() || '';
      setLabel(init);
      setVariableName(init.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
      setType('short_text');
      setShowNewGroupInput(false);
      setNewGroupName('');
      if (fieldGroups.length > 0) {
        setSelectedGroupId(fieldGroups[0].id);
      }
    }
  }, [open, fieldGroups, initialLabel]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[2rem] max-w-md">
        <DialogHeader className="pt-4 px-2">
          <DialogTitle className="font-bold text-xl tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Create New Field
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Define a new CRM custom field, select its category, and map it directly to this survey question.
          </DialogDescription>
        </DialogHeader>

        <div className="p-2 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Field Label</Label>
            <Input
              value={label}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder="e.g. Budget Tier"
              className="h-10 rounded-xl text-xs font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Variable DB Identifier</Label>
            <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 h-10 border border-dashed border-border/80">
              <span className="text-[10px] text-muted-foreground font-mono">customFields.</span>
              <code className="text-xs font-bold text-primary font-mono">{variableName || 'identifier_slug'}</code>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Data Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-10 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short_text" className="text-xs">Short Text</SelectItem>
                  <SelectItem value="number" className="text-xs">Number</SelectItem>
                  <SelectItem value="boolean" className="text-xs">Boolean (Yes/No)</SelectItem>
                  <SelectItem value="dropdown" className="text-xs">Dropdown</SelectItem>
                  <SelectItem value="date" className="text-xs">Date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Category / Group</Label>
              {!showNewGroupInput ? (
                <div className="space-y-1">
                  <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                    <SelectTrigger className="h-10 text-xs rounded-xl">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldGroups.map((g) => (
                        <SelectItem key={g.id} value={g.id} className="text-xs">
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    onClick={() => setShowNewGroupInput(true)}
                    className="text-[10px] text-primary font-semibold hover:underline"
                  >
                    + New Category
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <Input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="New Category Name"
                    className="h-10 text-xs rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewGroupInput(false)}
                    className="text-[10px] text-muted-foreground font-semibold hover:underline"
                  >
                    Use Existing Category
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="px-2 pb-4 pt-2">
          <Button
            onClick={() =>
              onSubmit({
                label,
                variableName,
                type,
                groupId: showNewGroupInput ? undefined : selectedGroupId,
                newGroupName: showNewGroupInput ? newGroupName : undefined,
              })
            }
            disabled={isSubmitting || !label || !variableName}
            className="w-full h-11 rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm active:scale-[0.97]"
          >
            {isSubmitting ? 'Creating Field...' : 'Save & Map to Question'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Local Dialog Helpers (Strict Typed)
// ──────────────────────────────────────────────────────────────────────────────

interface CreateTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; category?: string; color?: string }) => void;
  isSubmitting: boolean;
}

function CreateTagDialog({ open, onOpenChange, onSubmit, isSubmitting }: CreateTagDialogProps) {
  const [name, setName] = React.useState('');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[2.5rem] max-w-sm">
        <DialogHeader className="pt-4 px-2">
          <DialogTitle className="font-black text-2xl tracking-tighter text-primary">New Registry Tag</DialogTitle>
          <DialogDescription className="text-[11px] font-bold text-muted-foreground/60 leading-relaxed italic">
            Add an organizational label to your CRM taxonomy.
          </DialogDescription>
        </DialogHeader>
        <div className="p-4 space-y-4">
          <div className="space-y-2 px-1">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Tag Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. High Intent"
              className="h-12 rounded-2xl border-none bg-muted/20 px-5 font-bold shadow-inner"
            />
          </div>
        </div>
        <DialogFooter className="px-4 pb-8">
          <Button
            onClick={() => onSubmit({ name })}
            disabled={isSubmitting || !name}
            className="w-full h-14 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/30 active:scale-[0.97]"
          >
            {isSubmitting ? 'Registering...' : 'Add to Registry'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CreateAutomationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string }) => void;
  isSubmitting: boolean;
}

function CreateAutomationDialog({ open, onOpenChange, onSubmit, isSubmitting }: CreateAutomationDialogProps) {
  const [name, setName] = React.useState('');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[2.5rem] max-w-sm">
        <DialogHeader className="pt-6 px-4">
          <DialogTitle className="font-black text-2xl tracking-tighter flex items-center gap-3">
            <Zap className="h-6 w-6 text-amber-500 fill-amber-500" /> Quick Workflow
          </DialogTitle>
          <DialogDescription className="text-[11px] font-bold text-muted-foreground/60 leading-relaxed italic">
            Draft a new behavioral chain for this survey.
          </DialogDescription>
        </DialogHeader>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Workflow Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lead Qualification Sync"
              className="h-12 rounded-2xl border-none bg-muted/20 px-5 font-bold shadow-inner"
            />
          </div>
        </div>
        <DialogFooter className="p-6 pt-0">
          <Button
            onClick={() => onSubmit({ name })}
            disabled={isSubmitting || !name}
            className="w-full h-14 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-amber-500/20 bg-amber-500 hover:bg-amber-600 active:scale-[0.97]"
          >
            {isSubmitting ? 'Drafting...' : 'Initialize Draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
