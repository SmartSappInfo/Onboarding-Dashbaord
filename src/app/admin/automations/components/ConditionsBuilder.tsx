'use client';

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash, Info, X, HelpCircle, CheckSquare, Play, Globe, Zap, ListFilter, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MessagingTemplateSelector } from '../../components/MessagingTemplateSelector';
import { MultiSelect } from '@/components/ui/multi-select';
import { TagSelector } from '@/components/tags';
import type { ConditionGroup, ConditionItem } from '@/lib/automation-condition';
import type { Pipeline } from '@/lib/types';
import type { Node } from 'reactflow';

// Grouped Condition Fields definition
const CONDITION_FIELDS = [
  {
    group: 'Entity Details',
    items: [
      { value: 'primaryEmail', label: 'Primary Email' },
      { value: 'displayName', label: 'Display Name' },
      { value: 'primaryPhone', label: 'Primary Phone' },
      { value: 'entityType', label: 'Entity Type' },
      { value: 'emailVerified', label: 'Email Verification Status' },
      { value: 'locationCountryId', label: 'Location (Country)' },
      { value: 'locationRegionId', label: 'Location (Region)' },
      { value: 'locationDistrictId', label: 'Location (District)' },
    ],
  },
  {
    group: 'Tags',
    items: [
      { value: 'tags', label: 'Tags' },
    ],
  },
  {
    group: 'App & Custom Fields',
    items: [
      { value: 'survey_field', label: 'Survey Field' },
      { value: 'form_field', label: 'PDF / Form Field' },
    ],
  },
  {
    group: 'Deal Details',
    items: [
      { value: 'deal_status', label: 'Deal Status' },
      { value: 'deal_stage', label: 'Deal Stage' },
      { value: 'deal_owner', label: 'Deal Owner' },
      { value: 'deal_value', label: 'Deal Value' },
    ],
  },
  {
    group: 'Campaign Actions',
    items: [
      { value: 'campaign_action', label: 'Campaign Action / Email Link' },
    ],
  },
  {
    group: 'Landing Pages',
    items: [
      { value: 'landing_page_action', label: 'Page Engagement / Conversion' },
    ],
  },
  {
    group: 'Integrations & Actions',
    items: [
      { value: 'scanned_qr', label: 'Scanned QR Code' },
      { value: 'short_link', label: 'Scanned / Visited Shortlink' },
    ],
  },
  {
    group: 'Saved Audiences & Automations',
    items: [
      { value: 'saved_audience', label: 'Saved Segment / Audience' },
      { value: 'automation', label: 'Automation Status' },
    ],
  },
  {
    group: 'Automation Message Actions',
    items: [
      { value: 'email_action', label: 'Email Action' },
      { value: 'sms_action', label: 'SMS Action' },
      { value: 'whatsapp_action', label: 'WhatsApp Action' },
    ],
  },
];

// Flat field mapping helper for checking types
const FIELD_TYPE_MAP: Record<string, string> = {
  primaryEmail: 'text',
  displayName: 'text',
  primaryPhone: 'text',
  entityType: 'entityType',
  emailVerified: 'emailVerified',
  locationCountryId: 'text',
  locationRegionId: 'text',
  locationDistrictId: 'text',
  tags: 'tags',
  app_field: 'app_field',
  survey_field: 'survey_field',
  form_field: 'form_field',
  deal_status: 'deal_status',
  deal_stage: 'deal_stage',
  deal_owner: 'deal_owner',
  deal_value: 'number',
  campaign_action: 'campaign_action',
  landing_page_action: 'landing_page_action',
  scanned_qr: 'scanned_qr',
  short_link: 'short_link',
  saved_audience: 'audience',
  automation: 'automation',
  email_action: 'email_action',
  sms_action: 'sms_action',
  whatsapp_action: 'whatsapp_action',
};

// Operators by Field type
const OPERATORS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  text: [
    { value: 'equals', label: 'Exactly Equals' },
    { value: 'not_equals', label: 'Does Not Equal' },
    { value: 'contains', label: 'Contains Keyword' },
    { value: 'not_contains', label: 'Does Not Contain' },
    { value: 'is_empty', label: 'Is Empty' },
    { value: 'is_not_empty', label: 'Is Not Empty' },
  ],
  number: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does Not Equal' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
    { value: 'is_empty', label: 'Is Empty' },
    { value: 'is_not_empty', label: 'Is Not Empty' },
  ],
  entityType: [
    { value: 'equals', label: 'is exactly' },
    { value: 'not_equals', label: 'is not' },
  ],
  emailVerified: [
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
  ],
  tags: [
    { value: 'exists', label: 'Exists' },
    { value: 'not_exists', label: 'Does not exist' },
    { value: 'all_of', label: 'Matches all of' },
    { value: 'any_of', label: 'Matches any of' },
    { value: 'none_of', label: 'Matches none of' },
  ],
  app_field: [
    { value: 'equals', label: 'Exactly Equals' },
    { value: 'not_equals', label: 'Does Not Equal' },
    { value: 'contains', label: 'Contains Keyword' },
    { value: 'is_empty', label: 'Is Empty' },
    { value: 'is_not_empty', label: 'Is Not Empty' },
  ],
  survey_field: [
    { value: 'answered', label: 'Has answered' },
    { value: 'not_answered', label: 'Has not answered' },
    { value: 'equals', label: 'Answer is exactly' },
    { value: 'contains', label: 'Answer contains' },
  ],
  form_field: [
    { value: 'submitted', label: 'Has submitted form' },
    { value: 'not_submitted', label: 'Has not submitted' },
    { value: 'equals', label: 'Field value is exactly' },
  ],
  deal_status: [
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
  ],
  deal_stage: [
    { value: 'is', label: 'is in stage' },
    { value: 'is_not', label: 'is not in stage' },
  ],
  deal_owner: [
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
  ],
  campaign_action: [
    { value: 'opened', label: 'Has Opened Mail' },
    { value: 'not_opened', label: 'Has Not Opened Mail' },
    { value: 'replied', label: 'Has replied email' },
    { value: 'clicked', label: 'Has clicked on a link' },
    { value: 'watched_video', label: 'Watched video' },
    { value: 'watched_full_video', label: 'Watched full video' },
  ],
  landing_page_action: [
    { value: 'page_visited', label: 'Visited Page' },
    { value: 'page_not_visited', label: 'Has Not Visited Page' },
    { value: 'page_submitted', label: 'Submitted Form on Page' },
  ],
  scanned_qr: [
    { value: 'has_scanned', label: 'Has scanned' },
    { value: 'has_not_scanned', label: 'Has not scanned' },
  ],
  short_link: [
    { value: 'has_visited', label: 'Has scanned/visited' },
    { value: 'has_not_visited', label: 'Has not visited' },
  ],
  audience: [
    { value: 'in_audience', label: 'is in saved segment' },
    { value: 'not_in_audience', label: 'is not in saved segment' },
  ],
  automation: [
    { value: 'currently_in', label: 'Currently in' },
    { value: 'has_entered', label: 'Has entered' },
    { value: 'has_completed', label: 'Has completed' },
    { value: 'not_entered', label: 'Has not entered' },
  ],
  email_action: [
    { value: 'received', label: 'Received email' },
    { value: 'not_received', label: 'Has not received email' },
    { value: 'opened', label: 'Opened email' },
    { value: 'not_opened', label: 'Has not opened email' },
    { value: 'clicked', label: 'Clicked link in email' },
    { value: 'not_clicked', label: 'Has not clicked link in email' },
  ],
  sms_action: [
    { value: 'received', label: 'Received SMS' },
    { value: 'not_received', label: 'Has not received SMS' },
    { value: 'clicked', label: 'Clicked link in SMS' },
    { value: 'not_clicked', label: 'Has not clicked link in SMS' },
  ],
  whatsapp_action: [
    { value: 'received', label: 'Received WhatsApp message' },
    { value: 'not_received', label: 'Has not received WhatsApp message' },
    { value: 'opened', label: 'Opened / Read WhatsApp' },
    { value: 'not_opened', label: 'Has not opened / read WhatsApp' },
    { value: 'clicked', label: 'Clicked button / link in WhatsApp' },
    { value: 'not_clicked', label: 'Has not clicked button / link in WhatsApp' },
  ],
};

interface ConditionsBuilderProps {
  groups: ConditionGroup[];
  relation: 'and' | 'or' | 'AND' | 'OR';
  onChange: (relation: 'and' | 'or', groups: ConditionGroup[]) => void;
  accentColor?: 'amber' | 'purple' | 'violet';
  nodes?: Node[];
}

export function ConditionsBuilder({
  groups = [],
  relation = 'and',
  onChange,
  accentColor = 'purple',
  nodes = [],
}: ConditionsBuilderProps) {
  const firestore = useFirestore();
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace() as { activeWorkspaceId: string; activeOrganizationId: string };

  // Real-time Firestore Queries
  const tagsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'tags'), where('workspaceId', '==', activeWorkspaceId), orderBy('name', 'asc'));
  }, [firestore, activeWorkspaceId]);
  const { data: allTags } = useCollection<any>(tagsQuery);

  const audiencesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'message_audiences'), where('workspaceId', '==', activeWorkspaceId), orderBy('name', 'asc'));
  }, [firestore, activeWorkspaceId]);
  const { data: allAudiences } = useCollection<any>(audiencesQuery);

  const surveysQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'surveys'), where('workspaceIds', 'array-contains', activeWorkspaceId));
  }, [firestore, activeWorkspaceId]);
  const { data: allSurveys } = useCollection<any>(surveysQuery);

  const pdfsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'pdfs'), where('workspaceIds', 'array-contains', activeWorkspaceId));
  }, [firestore, activeWorkspaceId]);
  const { data: allPdfs } = useCollection<any>(pdfsQuery);

  const allAppFields: any[] = [];

  const qrCodesQuery = useMemoFirebase(() => {
    if (!firestore || !activeOrganizationId || !activeWorkspaceId) return null;
    return query(collection(firestore, 'organizations', activeOrganizationId, 'workspaces', activeWorkspaceId, 'qr_codes'));
  }, [firestore, activeOrganizationId, activeWorkspaceId]);
  const { data: allQrCodes } = useCollection<any>(qrCodesQuery);

  const pipelinesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'pipelines'), orderBy('name', 'asc'));
  }, [firestore]);
  const { data: allPipelines } = useCollection<any>(pipelinesQuery);

  const stagesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'onboardingStages'), orderBy('order'));
  }, [firestore]);
  const { data: allStages } = useCollection<any>(stagesQuery);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('isAuthorized', '==', true), orderBy('name', 'asc'));
  }, [firestore]);
  const { data: allUsers } = useCollection<any>(usersQuery);

  const templatesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    // Scoped to the active workspace: templates belong to a tenant, so an
    // unscoped read would both leak and be rejected by the security rules.
    return query(
      collection(firestore, 'message_templates'),
      where('workspaceIds', 'array-contains', activeWorkspaceId),
    );
  }, [firestore, activeWorkspaceId]);
  const { data: allTemplates } = useCollection<any>(templatesQuery);

  const pagesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'campaign_pages'),
      where('workspaceIds', 'array-contains', activeWorkspaceId),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, activeWorkspaceId]);
  const { data: allPages } = useCollection<any>(pagesQuery);

  const automationsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'automations'),
      where('workspaceIds', 'array-contains', activeWorkspaceId),
      orderBy('name', 'asc')
    );
  }, [firestore, activeWorkspaceId]);
  const { data: allWorkspaceAutomations } = useCollection<any>(automationsQuery);

  // Extract only templates in the current automation from the nodes list
  const automationTemplates = React.useMemo(() => {
    if (!nodes || !Array.isArray(nodes)) return [];
    const templates: { id: string; name: string; channel: 'email' | 'sms' | 'whatsapp' }[] = [];
    nodes.forEach((node) => {
      if (node.type === 'actionNode' && node.data?.actionType === 'SEND_MESSAGE') {
        const templateId = node.data?.config?.templateId;
        const channel = node.data?.config?.channel || 'email';
        if (templateId) {
          const matchedTpl = allTemplates?.find(t => t.id === templateId);
          if (!templates.some(t => t.id === templateId)) {
            templates.push({
              id: templateId,
              name: matchedTpl?.name || node.data?.config?.templateName || `Template (${templateId})`,
              channel: channel as 'email' | 'sms' | 'whatsapp',
            });
          }
        }
      }
    });
    return templates;
  }, [nodes, allTemplates]);

  // Initialize with at least one group and condition if empty
  const activeGroups = React.useMemo(() => {
    if (groups && groups.length > 0) return groups;
    return [
      {
        id: 'group_init',
        relation: 'and' as const,
        conditions: [{ id: 'cond_init', field: 'tags', operator: 'any_of', value: [] }],
      },
    ];
  }, [groups]);

  const updateGroupsState = (nextGroups: ConditionGroup[], nextRelation = relation) => {
    onChange((nextRelation || 'and').toLowerCase() as 'and' | 'or', nextGroups);
  };

  const addGroup = () => {
    const newGroup: ConditionGroup = {
      id: `g_${Date.now()}`,
      relation: 'and',
      conditions: [{ id: `c_${Date.now()}`, field: 'tags', operator: 'any_of', value: [] }],
    };
    updateGroupsState([...activeGroups, newGroup]);
  };

  const removeGroup = (groupId: string) => {
    if (activeGroups.length <= 1) {
      // If last group, clear conditions
      updateGroupsState([{
        id: `g_${Date.now()}`,
        relation: 'and',
        conditions: [{ id: `c_${Date.now()}`, field: 'tags', operator: 'any_of', value: [] }],
      }]);
      return;
    }
    updateGroupsState(activeGroups.filter(g => g.id !== groupId));
  };

  const clearAll = () => {
    updateGroupsState([{
      id: `g_${Date.now()}`,
      relation: 'and',
      conditions: [{ id: `c_${Date.now()}`, field: 'tags', operator: 'any_of', value: [] }],
    }], 'and');
  };

  const addCondition = (groupId: string) => {
    const next = activeGroups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        conditions: [
          ...(g.conditions || []),
          { id: `c_${Date.now()}`, field: 'tags', operator: 'any_of', value: [] },
        ],
      };
    });
    updateGroupsState(next);
  };

  const removeCondition = (groupId: string, condId: string) => {
    const next = activeGroups.map((g) => {
      if (g.id !== groupId) return g;
      const filtered = (g.conditions || []).filter(c => c.id !== condId);
      return {
        ...g,
        conditions: filtered.length > 0 ? filtered : [{ id: `c_${Date.now()}`, field: 'tags', operator: 'any_of', value: [] }],
      };
    });
    updateGroupsState(next);
  };

  const updateConditionValue = (groupId: string, condId: string, updates: Partial<ConditionItem>) => {
    const next = activeGroups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        conditions: (g.conditions || []).map((c) => {
          if (c.id !== condId) return c;
          const merged = { ...c, ...updates };
          
          // Reset operator/value if field changes
          if (updates.field) {
            const vType = FIELD_TYPE_MAP[updates.field] || 'text';
            merged.operator = OPERATORS_BY_TYPE[vType]?.[0]?.value || 'equals';
            merged.value = vType === 'tags' ? [] : '';
            merged.emailTemplateId = undefined;
            merged.linkUrl = undefined;
            merged.surveyId = undefined;
            merged.surveyFieldId = undefined;
            merged.pdfId = undefined;
            merged.pdfFieldId = undefined;
            merged.customFieldId = undefined;
            merged.pipelineId = undefined;
            merged.campaignId = undefined;
            merged.qrId = undefined;
            merged.shortPath = undefined;
            merged.pageId = undefined;
          }

          if (updates.surveyId) {
            merged.surveyFieldId = undefined;
            merged.value = '';
          }
          if (updates.pdfId) {
            merged.pdfFieldId = undefined;
            merged.value = '';
          }
          if (updates.pipelineId) {
            merged.value = '';
          }

          return merged;
        }),
      };
    });
    updateGroupsState(next);
  };

  const updateGroupRelation = (groupId: string, rel: 'and' | 'or') => {
    const next = activeGroups.map(g => g.id === groupId ? { ...g, relation: rel } : g);
    updateGroupsState(next);
  };

  const toggleRootRelation = () => {
    const next = relation.toLowerCase() === 'and' ? 'or' as const : 'and' as const;
    updateGroupsState(activeGroups, next);
  };

  const getBorderColor = () => {
    if (accentColor === 'amber') return 'border-amber-500/10 hover:border-amber-500/30';
    return 'border-purple-500/10 hover:border-purple-500/30';
  };

  return (
    <div className="space-y-6">
      {/* Header and Clear All Actions */}
      <div className="flex items-center justify-between px-1.5">
        <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Segmentation Rules</Label>
        <button 
          type="button" 
          onClick={clearAll} 
          className="text-[9px] font-black text-rose-500 hover:text-rose-600 flex items-center gap-1 hover:underline transition-all"
        >
          <Trash2 className="h-3 w-3" /> Clear all conditions
        </button>
      </div>

      <div className="space-y-4">
        {activeGroups.map((group, groupIdx) => {
          const conditions = group.conditions || [];
          const groupRel = (group.relation || 'and').toLowerCase();

          return (
            <React.Fragment key={group.id}>
              {/* Outer Group Card */}
              <div 
                className={cn(
                  "relative p-5 rounded-[2rem] border border-dashed bg-background/35 backdrop-blur-md space-y-4 shadow-sm transition-all duration-300",
                  getBorderColor()
                )}
              >
                {/* Delete Group Trigger */}
                <button
                  type="button"
                  onClick={() => removeGroup(group.id)}
                  className="absolute right-4 top-4 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-rose-500 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>

                {/* Inner conditions stack */}
                <div className="space-y-3.5">
                  {conditions.map((cond, condIdx) => {
                    const valueType = FIELD_TYPE_MAP[cond.field] || 'text';
                    const operators = OPERATORS_BY_TYPE[valueType] || [];

                    return (
                      <React.Fragment key={cond.id}>
                        {/* Inline AND/OR Condition Connector Toggle */}
                        {condIdx > 0 && (
                          <div className="flex items-center justify-start py-0.5 ml-2.5">
                            <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/30">
                              <button
                                type="button"
                                onClick={() => updateGroupRelation(group.id, 'and')}
                                className={cn(
                                  "px-2 py-0.5 text-[8px] font-black uppercase rounded-md transition-all",
                                  groupRel === 'and' ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-muted"
                                )}
                              >
                                And
                              </button>
                              <button
                                type="button"
                                onClick={() => updateGroupRelation(group.id, 'or')}
                                className={cn(
                                  "px-2 py-0.5 text-[8px] font-black uppercase rounded-md transition-all",
                                  groupRel === 'or' ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-muted"
                                )}
                              >
                                Or
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="flex items-start gap-3 flex-wrap relative group/row pr-8">
                          {/* Field Selector */}
                          <div className="flex-1 min-w-[130px] space-y-1">
                            <Label className="text-[8px] font-black uppercase tracking-wider text-muted-foreground/80">Category Field</Label>
                            <Select 
                              value={cond.field || 'tags'} 
                              onValueChange={(val) => updateConditionValue(group.id, cond.id, { field: val })}
                            >
                              <SelectTrigger className="h-8 rounded-lg bg-background border-none font-bold text-[10px] px-2 shadow-inner w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {CONDITION_FIELDS.map((category) => (
                                  <SelectGroup key={category.group}>
                                    <SelectLabel className="text-[8px] font-black uppercase tracking-wider text-muted-foreground/60">{category.group}</SelectLabel>
                                    {category.items.map((field) => (
                                      <SelectItem key={field.value} value={field.value} className="text-[10px] font-bold">
                                        {field.label}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Dynamic Custom Field Selection */}
                          {valueType === 'app_field' && (
                            <div className="flex-1 min-w-[130px] space-y-1">
                              <Label className="text-[8px] font-black uppercase tracking-wider text-muted-foreground/80">App Custom Field</Label>
                              <Select
                                value={cond.customFieldId || ''}
                                onValueChange={(val) => updateConditionValue(group.id, cond.id, { customFieldId: val })}
                              >
                                <SelectTrigger className="h-8 rounded-lg bg-background border-none font-bold text-[10px] px-2 shadow-inner w-full">
                                  <SelectValue placeholder="Select field..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  {allAppFields?.map((f: any) => (
                                    <SelectItem key={f.id} value={f.id} className="text-[10px] font-bold">
                                      {f.label || f.name}
                                    </SelectItem>
                                  ))}
                                  {(!allAppFields || allAppFields.length === 0) && (
                                    <SelectItem value="none" disabled className="text-[10px]">No custom fields found</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {/* Dynamic Survey Selection & Question Selection */}
                          {valueType === 'survey_field' && (
                            <>
                              <div className="flex-1 min-w-[130px] space-y-1">
                                <Label className="text-[8px] font-black uppercase tracking-wider text-muted-foreground/80">Survey</Label>
                                <Select
                                  value={cond.surveyId || ''}
                                  onValueChange={(val) => updateConditionValue(group.id, cond.id, { surveyId: val })}
                                >
                                  <SelectTrigger className="h-8 rounded-lg bg-background border-none font-bold text-[10px] px-2 shadow-inner w-full">
                                    <SelectValue placeholder="Select survey..." />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    {allSurveys?.map((s: any) => (
                                      <SelectItem key={s.id} value={s.id} className="text-[10px] font-bold">
                                        {s.internalName || s.title || s.name}
                                      </SelectItem>
                                    ))}
                                    {(!allSurveys || allSurveys.length === 0) && (
                                      <SelectItem value="none" disabled className="text-[10px]">No surveys found</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex-1 min-w-[130px] space-y-1">
                                <Label className="text-[8px] font-black uppercase tracking-wider text-muted-foreground/80">Survey Question</Label>
                                <Select
                                  value={cond.surveyFieldId || ''}
                                  onValueChange={(val) => updateConditionValue(group.id, cond.id, { surveyFieldId: val })}
                                  disabled={!cond.surveyId}
                                >
                                  <SelectTrigger className="h-8 rounded-lg bg-background border-none font-bold text-[10px] px-2 shadow-inner w-full">
                                    <SelectValue placeholder="Select question..." />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    {(() => {
                                      const selSurv = allSurveys?.find(s => s.id === cond.surveyId);
                                      const questions = selSurv?.elements?.filter((el: any) => 
                                        ['text', 'long-text', 'yes-no', 'multiple-choice', 'checkboxes', 'dropdown', 'rating', 'date', 'time', 'file-upload', 'email', 'phone', 'number', 'link'].includes(el.type)
                                      ) || [];
                                      return questions.map((q: any) => (
                                        <SelectItem key={q.id} value={q.id} className="text-[10px] font-bold">
                                          {q.title || q.label || q.id}
                                        </SelectItem>
                                      ));
                                    })()}
                                    {(!cond.surveyId || !(allSurveys?.find(s => s.id === cond.surveyId)?.elements)) && (
                                      <SelectItem value="none" disabled className="text-[10px]">Select survey first</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            </>
                          )}

                          {/* Dynamic PDF / Form Selection & Field Selection */}
                          {valueType === 'form_field' && (
                            <>
                              <div className="flex-1 min-w-[130px] space-y-1">
                                <Label className="text-[8px] font-black uppercase tracking-wider text-muted-foreground/80">PDF Form</Label>
                                <Select
                                  value={cond.pdfId || ''}
                                  onValueChange={(val) => updateConditionValue(group.id, cond.id, { pdfId: val })}
                                >
                                  <SelectTrigger className="h-8 rounded-lg bg-background border-none font-bold text-[10px] px-2 shadow-inner w-full">
                                    <SelectValue placeholder="Select PDF..." />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    {allPdfs?.map((p: any) => (
                                      <SelectItem key={p.id} value={p.id} className="text-[10px] font-bold">
                                        {p.name || p.publicTitle || p.title}
                                      </SelectItem>
                                    ))}
                                    {(!allPdfs || allPdfs.length === 0) && (
                                      <SelectItem value="none" disabled className="text-[10px]">No PDFs found</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex-1 min-w-[130px] space-y-1">
                                <Label className="text-[8px] font-black uppercase tracking-wider text-muted-foreground/80">Form Field</Label>
                                <Select
                                  value={cond.pdfFieldId || ''}
                                  onValueChange={(val) => updateConditionValue(group.id, cond.id, { pdfFieldId: val })}
                                  disabled={!cond.pdfId}
                                >
                                  <SelectTrigger className="h-8 rounded-lg bg-background border-none font-bold text-[10px] px-2 shadow-inner w-full">
                                    <SelectValue placeholder="Select field..." />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    {(() => {
                                      const selPdf = allPdfs?.find(p => p.id === cond.pdfId);
                                      const fields = selPdf?.fields || [];
                                      return fields.map((f: any) => (
                                        <SelectItem key={f.id} value={f.id} className="text-[10px] font-bold">
                                          {f.label || f.id}
                                        </SelectItem>
                                      ));
                                    })()}
                                    {(!cond.pdfId || !(allPdfs?.find(p => p.id === cond.pdfId)?.fields)) && (
                                      <SelectItem value="none" disabled className="text-[10px]">Select PDF first</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            </>
                          )}

                          {/* Dynamic Pipeline Selection for Deal Stage */}
                          {cond.field === 'deal_stage' && (
                            <div className="flex-1 min-w-[130px] space-y-1">
                              <Label className="text-[8px] font-black uppercase tracking-wider text-muted-foreground/80">Pipeline</Label>
                              <Select
                                value={cond.pipelineId || ''}
                                onValueChange={(val) => updateConditionValue(group.id, cond.id, { pipelineId: val })}
                              >
                                <SelectTrigger className="h-8 rounded-lg bg-background border-none font-bold text-[10px] px-2 shadow-inner w-full">
                                  <SelectValue placeholder="Select pipeline..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  {(allPipelines || [])
                                    .filter((p: Pipeline) => !activeWorkspaceId || p.workspaceIds?.includes(activeWorkspaceId))
                                    .map((p: Pipeline) => (
                                      <SelectItem key={p.id} value={p.id} className="text-[10px] font-bold">
                                        {p.name}
                                      </SelectItem>
                                    ))}
                                  {(!allPipelines || allPipelines.length === 0) && (
                                    <SelectItem value="none" disabled className="text-[10px]">No pipelines found</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {/* Operator Selector */}
                          <div className="flex-1 min-w-[120px] space-y-1">
                            <Label className="text-[8px] font-black uppercase tracking-wider text-muted-foreground/80">Evaluation Rule</Label>
                            <Select 
                              value={cond.operator || 'equals'} 
                              onValueChange={(val) => updateConditionValue(group.id, cond.id, { operator: val })}
                            >
                              <SelectTrigger className="h-8 rounded-lg bg-background border-none font-bold text-[10px] px-2 shadow-inner w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {operators.map((op) => (
                                  <SelectItem key={op.value} value={op.value} className="text-[10px] font-bold">
                                    {op.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Context-Dependent Value Input/Selector */}
                          {cond.operator !== 'is_empty' && 
                           cond.operator !== 'is_not_empty' && 
                           cond.operator !== 'answered' && 
                           cond.operator !== 'not_answered' && 
                           cond.operator !== 'submitted' && 
                           cond.operator !== 'not_submitted' && (
                            <div className="flex-grow min-w-[180px] space-y-1">
                              <Label className="text-[8px] font-black uppercase tracking-wider text-muted-foreground/80">Value Criteria</Label>
                              
                              {/* 1. TagSelector for Tags */}
                              {valueType === 'tags' && (
                                <TagSelector
                                  currentTagIds={Array.isArray(cond.value) ? cond.value : []}
                                  onTagsChange={(val: string[]) => updateConditionValue(group.id, cond.id, { value: val })}
                                  className="min-h-8 w-full bg-background/50 p-1.5 rounded-xl border"
                                />
                              )}

                              {/* 2. App Custom Field Value Select/Input */}
                              {valueType === 'app_field' && (() => {
                                const selF = allAppFields?.find(f => f.id === cond.customFieldId);
                                const opts = selF?.options || [];
                                if (opts.length > 0) {
                                  return (
                                    <Select
                                      value={String(cond.value ?? '')}
                                      onValueChange={(val) => updateConditionValue(group.id, cond.id, { value: val })}
                                    >
                                      <SelectTrigger className="h-8 rounded-lg bg-background border-none font-bold text-[10px] px-2 shadow-inner w-full">
                                        <SelectValue placeholder="Select option..." />
                                      </SelectTrigger>
                                      <SelectContent className="rounded-xl">
                                        {opts.map((o: any) => (
                                          <SelectItem key={o.value} value={o.value} className="text-[10px] font-bold">
                                            {o.label || o.value}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  );
                                }
                                return (
                                  <Input
                                    value={cond.value || ''}
                                    onChange={(e) => updateConditionValue(group.id, cond.id, { value: e.target.value })}
                                    placeholder="Compare Value"
                                    className="h-8 rounded-lg bg-background border-none text-[10px] px-2 shadow-inner w-full"
                                  />
                                );
                              })()}

                              {/* 3. Survey Field Value Select/Input */}
                              {valueType === 'survey_field' && (() => {
                                const selSurv = allSurveys?.find(s => s.id === cond.surveyId);
                                const question = selSurv?.elements?.find((el: any) => el.id === cond.surveyFieldId);
                                const opts = question?.options || [];
                                if (opts.length > 0) {
                                  return (
                                    <Select
                                      value={String(cond.value ?? '')}
                                      onValueChange={(val) => updateConditionValue(group.id, cond.id, { value: val })}
                                    >
                                      <SelectTrigger className="h-8 rounded-lg bg-background border-none font-bold text-[10px] px-2 shadow-inner w-full">
                                        <SelectValue placeholder="Select option..." />
                                      </SelectTrigger>
                                      <SelectContent className="rounded-xl">
                                        {opts.map((o: any) => {
                                          const optVal = typeof o === 'string' ? o : o.value;
                                          const optLabel = typeof o === 'string' ? o : o.label;
                                          return (
                                            <SelectItem key={optVal} value={optVal} className="text-[10px] font-bold">
                                              {optLabel}
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
                                  );
                                }
                                return (
                                  <Input
                                    value={cond.value || ''}
                                    onChange={(e) => updateConditionValue(group.id, cond.id, { value: e.target.value })}
                                    placeholder="Compare Value"
                                    className="h-8 rounded-lg bg-background border-none text-[10px] px-2 shadow-inner w-full"
                                  />
                                );
                              })()}

                              {/* 4. Form Field value criteria */}
                              {valueType === 'form_field' && (
                                <Input
                                  value={cond.value || ''}
                                  onChange={(e) => updateConditionValue(group.id, cond.id, { value: e.target.value })}
                                  placeholder="Compare Value"
                                  className="h-8 rounded-lg bg-background border-none text-[10px] px-2 shadow-inner w-full"
                                />
                              )}

                              {/* 5. Deal Stage Selection */}
                              {cond.field === 'deal_stage' && (
                                <Select
                                  value={cond.value || ''}
                                  onValueChange={(val) => updateConditionValue(group.id, cond.id, { value: val })}
                                  disabled={!cond.pipelineId}
                                >
                                  <SelectTrigger className="h-8 rounded-lg bg-background border-none font-bold text-[10px] px-2 shadow-inner w-full">
                                    <SelectValue placeholder="Select stage..." />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    {(() => {
                                      const pipelineStages = allStages?.filter((s: any) => s.pipelineId === cond.pipelineId) || [];
                                      return pipelineStages.map((s: any) => (
                                        <SelectItem key={s.id} value={s.id} className="text-[10px] font-bold">
                                          {s.name}
                                        </SelectItem>
                                      ));
                                    })()}
                                    {(!cond.pipelineId || !allStages) && (
                                      <SelectItem value="none" disabled className="text-[10px]">Select pipeline first</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              )}

                              {/* 6. Deal Owner Selection */}
                              {cond.field === 'deal_owner' && (
                                <Select
                                  value={cond.value || ''}
                                  onValueChange={(val) => updateConditionValue(group.id, cond.id, { value: val })}
                                >
                                  <SelectTrigger className="h-8 rounded-lg bg-background border-none font-bold text-[10px] px-2 shadow-inner w-full">
                                    <SelectValue placeholder="Select owner..." />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    {allUsers?.map((u: any) => (
                                      <SelectItem key={u.id || u.uid} value={u.id || u.uid} className="text-[10px] font-bold">
                                        {u.name}
                                      </SelectItem>
                                    ))}
                                    {(!allUsers || allUsers.length === 0) && (
                                      <SelectItem value="none" disabled className="text-[10px]">No users found</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              )}

                              {/* 7. Deal Status Selection */}
                              {cond.field === 'deal_status' && (
                                <Select
                                  value={cond.value || 'open'}
                                  onValueChange={(val) => updateConditionValue(group.id, cond.id, { value: val })}
                                >
                                  <SelectTrigger className="h-8 rounded-lg bg-background border-none font-bold text-[10px] px-2 shadow-inner w-full">
                                    <SelectValue placeholder="Select status..." />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    <SelectItem value="open" className="text-[10px] font-bold">Open</SelectItem>
                                    <SelectItem value="won" className="text-[10px] font-bold">Won</SelectItem>
                                    <SelectItem value="lost" className="text-[10px] font-bold">Lost</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}

                              {/* 8. Deal Value Numeric Input */}
                              {cond.field === 'deal_value' && (
                                <Input
                                  type="number"
                                  value={cond.value ?? ''}
                                  onChange={(e) => updateConditionValue(group.id, cond.id, { value: e.target.value })}
                                  placeholder="Amount"
                                  className="h-8 rounded-lg bg-background border-none text-[10px] px-2 shadow-inner w-full"
                                />
                              )}

                              {/* 9. Campaign Action template selection */}
                              {cond.field === 'campaign_action' && (
                                <div className="space-y-2">
                                  <Select
                                    value={cond.emailTemplateId || cond.value || ''}
                                    onValueChange={(val) => updateConditionValue(group.id, cond.id, { emailTemplateId: val, value: val })}
                                  >
                                    <SelectTrigger className="h-8 rounded-lg bg-background border-none font-bold text-[10px] px-2 shadow-inner w-full">
                                      <SelectValue placeholder="Select template..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                      {allTemplates?.map((t: any) => (
                                        <SelectItem key={t.id} value={t.id} className="text-[10px] font-bold">
                                          {t.name}
                                        </SelectItem>
                                      ))}
                                      {(!allTemplates || allTemplates.length === 0) && (
                                        <SelectItem value="none" disabled className="text-[10px]">No templates found</SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>

                                  {cond.operator === 'clicked' && (
                                    <div className="space-y-1">
                                      <Label className="text-[8px] font-black uppercase tracking-wider text-muted-foreground/60">Target Link URL</Label>
                                      <Input
                                        value={cond.linkUrl || ''}
                                        onChange={(e) => updateConditionValue(group.id, cond.id, { linkUrl: e.target.value })}
                                        placeholder="e.g. https://domain.com/link"
                                        className="h-8 rounded-lg bg-background border-none shadow-inner font-mono text-[10px] px-2 w-full"
                                      />
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* 9.2. Automation Message Action template selection */}
                              {(cond.field === 'email_action' || cond.field === 'sms_action' || cond.field === 'whatsapp_action') && (
                                <div className="space-y-2 w-full min-w-0">
                                  <Select
                                    value={cond.emailTemplateId || cond.value || ''}
                                    onValueChange={(val) => updateConditionValue(group.id, cond.id, { emailTemplateId: val, value: val })}
                                  >
                                    <SelectTrigger className="h-8 rounded-lg bg-background border-none font-bold text-[10px] px-2 shadow-inner w-full text-left truncate">
                                      <SelectValue placeholder="Select template in current automation..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl max-w-[calc(100vw-4rem)]">
                                      {(() => {
                                        const expectedChannel = cond.field === 'email_action' ? 'email' :
                                                              cond.field === 'sms_action' ? 'sms' : 'whatsapp';
                                        const filtered = automationTemplates.filter(t => t.channel === expectedChannel);
                                        return filtered.map((t) => (
                                          <SelectItem key={t.id} value={t.id} className="text-[10px] font-bold">
                                            {t.name}
                                          </SelectItem>
                                        ));
                                      })()}
                                      {(() => {
                                        const expectedChannel = cond.field === 'email_action' ? 'email' :
                                                              cond.field === 'sms_action' ? 'sms' : 'whatsapp';
                                        const filtered = automationTemplates.filter(t => t.channel === expectedChannel);
                                        if (filtered.length === 0) {
                                          return (
                                            <SelectItem value="none" disabled className="text-[10px] text-muted-foreground italic">
                                              No {expectedChannel} templates in this automation
                                            </SelectItem>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {/* 10. Landing Page Selection */}
                              {cond.field === 'landing_page_action' && (
                                <Select
                                  value={cond.pageId || cond.value || ''}
                                  onValueChange={(val) => updateConditionValue(group.id, cond.id, { pageId: val, value: val })}
                                >
                                  <SelectTrigger className="h-8 rounded-lg bg-background border-none font-bold text-[10px] px-2 shadow-inner w-full">
                                    <SelectValue placeholder="Select page..." />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    {allPages?.map((p: any) => (
                                      <SelectItem key={p.id} value={p.id} className="text-[10px] font-bold">
                                        {p.name}
                                      </SelectItem>
                                    ))}
                                    {(!allPages || allPages.length === 0) && (
                                      <SelectItem value="none" disabled className="text-[10px]">No pages found</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              )}

                              {/* 11. Scanned QR Code Selector */}
                              {cond.field === 'scanned_qr' && (
                                <Select
                                  value={cond.qrId || cond.value || ''}
                                  onValueChange={(val) => updateConditionValue(group.id, cond.id, { qrId: val, value: val })}
                                >
                                  <SelectTrigger className="h-8 rounded-lg bg-background border-none font-bold text-[10px] px-2 shadow-inner w-full">
                                    <SelectValue placeholder="Select QR..." />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    {allQrCodes?.map((q: any) => (
                                      <SelectItem key={q.id} value={q.id} className="text-[10px] font-bold">
                                        {q.name}
                                      </SelectItem>
                                    ))}
                                    {(!allQrCodes || allQrCodes.length === 0) && (
                                      <SelectItem value="none" disabled className="text-[10px]">No QR codes found</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              )}

                              {/* 12. Shortlink Selector */}
                              {cond.field === 'short_link' && (
                                <Select
                                  value={cond.shortPath || cond.value || ''}
                                  onValueChange={(val) => updateConditionValue(group.id, cond.id, { shortPath: val, value: val })}
                                >
                                  <SelectTrigger className="h-8 rounded-lg bg-background border-none font-bold text-[10px] px-2 shadow-inner w-full">
                                    <SelectValue placeholder="Select shortlink..." />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    {allQrCodes?.filter(q => q.mode === 'dynamic' && q.customShortPath).map((q: any) => (
                                      <SelectItem key={q.customShortPath} value={q.customShortPath} className="text-[10px] font-bold">
                                        {q.name} (/{q.customShortPath})
                                      </SelectItem>
                                    ))}
                                    {(!allQrCodes || allQrCodes.filter(q => q.mode === 'dynamic' && q.customShortPath).length === 0) && (
                                      <SelectItem value="none" disabled className="text-[10px]">No dynamic shortlinks found</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              )}

                              {/* 13. Email Verification selector */}
                              {cond.field === 'emailVerified' && (
                                <Select
                                  value={String(cond.value ?? 'true')}
                                  onValueChange={(val) => updateConditionValue(group.id, cond.id, { value: val })}
                                >
                                  <SelectTrigger className="h-8 rounded-lg bg-background border-none font-bold text-[10px] px-2 shadow-inner w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    <SelectItem value="true" className="text-[10px] font-bold">Verified</SelectItem>
                                    <SelectItem value="false" className="text-[10px] font-bold">Unverified</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}

                              {/* 14. Entity Type selector */}
                              {cond.field === 'entityType' && (
                                <Select
                                  value={cond.value || 'person'}
                                  onValueChange={(val) => updateConditionValue(group.id, cond.id, { value: val })}
                                >
                                  <SelectTrigger className="h-8 rounded-lg bg-background border-none font-bold text-[10px] px-2 shadow-inner w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    <SelectItem value="institution" className="text-[10px] font-bold">Institution</SelectItem>
                                    <SelectItem value="family" className="text-[10px] font-bold">Family</SelectItem>
                                    <SelectItem value="person" className="text-[10px] font-bold">Person</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}

                              {/* 15. Saved Segment / Audience Selector */}
                              {valueType === 'audience' && (
                                <Select 
                                  value={cond.value || ''} 
                                  onValueChange={(val) => updateConditionValue(group.id, cond.id, { value: val })}
                                >
                                  <SelectTrigger className="h-8 rounded-lg bg-background border-none font-bold text-[10px] px-2 shadow-inner w-full">
                                    <SelectValue placeholder="Select segment..." />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    {allAudiences?.map((aud: any) => (
                                      <SelectItem key={aud.id} value={aud.id} className="text-[10px] font-bold">
                                        {aud.name}
                                      </SelectItem>
                                    ))}
                                    {(!allAudiences || allAudiences.length === 0) && (
                                      <SelectItem value="none" disabled className="text-[10px]">No segments found</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              )}

                              {/* 15.1. Automation Status Selector */}
                              {valueType === 'automation' && (
                                <Select 
                                  value={cond.value || ''} 
                                  onValueChange={(val) => updateConditionValue(group.id, cond.id, { value: val })}
                                >
                                  <SelectTrigger className="h-8 rounded-lg bg-background border-none font-bold text-[10px] px-2 shadow-inner w-full">
                                    <SelectValue placeholder="Select automation..." />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    {allWorkspaceAutomations?.map((auto: any) => (
                                      <SelectItem key={auto.id} value={auto.id} className="text-[10px] font-bold">
                                        {auto.name}
                                      </SelectItem>
                                    ))}
                                    {(!allWorkspaceAutomations || allWorkspaceAutomations.length === 0) && (
                                      <SelectItem value="none" disabled className="text-[10px]">No automations found</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              )}

                              {/* 16. Default Text Value Input */}
                              {valueType === 'text' && (
                                <Input
                                  value={cond.value || ''}
                                  onChange={(e) => updateConditionValue(group.id, cond.id, { value: e.target.value })}
                                  placeholder="Compare Value"
                                  className="h-8 rounded-lg bg-background border-none text-[10px] px-2 shadow-inner w-full"
                                />
                              )}

                              {/* 17. Default Number Value Input */}
                              {valueType === 'number' && cond.field !== 'deal_value' && (
                                <Input
                                  type="number"
                                  value={cond.value ?? ''}
                                  onChange={(e) => updateConditionValue(group.id, cond.id, { value: e.target.value })}
                                  placeholder="Compare Number"
                                  className="h-8 rounded-lg bg-background border-none text-[10px] px-2 shadow-inner w-full"
                                />
                              )}

                            </div>
                          )}

                          {/* Row Delete Button */}
                          <button
                            type="button"
                            onClick={() => removeCondition(group.id, cond.id)}
                            className="absolute right-0 top-[18px] lg:top-6 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-rose-500 transition-colors lg:opacity-0 lg:group-hover/row:opacity-100"
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Add condition inside group */}
                <button
                  type="button"
                  onClick={() => addCondition(group.id)}
                  className="text-[9px] font-black text-primary hover:text-primary/80 flex items-center gap-1 hover:underline ml-1.5 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Add another condition
                </button>
              </div>

              {/* Group-Level relation connector badge */}
              {groupIdx < activeGroups.length - 1 && (
                <div className="flex items-center justify-center relative py-1">
                  <div className="absolute top-0 bottom-0 left-1/2 w-0.5 border-l border-dashed border-border" />
                  <button
                    type="button"
                    onClick={toggleRootRelation}
                    className={cn(
                      "relative h-7 px-4 rounded-xl text-[9px] font-black uppercase border shadow-sm transition-all z-10",
                      relation.toLowerCase() === 'and' 
                        ? "bg-violet-600 text-white border-violet-700 hover:bg-violet-700" 
                        : "bg-amber-500 text-white border-amber-600 hover:bg-amber-600"
                    )}
                  >
                    {relation.toLowerCase() === 'and' ? 'AND' : 'OR'}
                  </button>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Add condition group trigger button */}
      <Button 
        type="button" 
        variant="outline" 
        size="sm" 
        onClick={addGroup}
        className="w-full h-9 rounded-2xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 border border-dashed border-primary/20 hover:bg-primary/5 transition-colors shadow-inner"
      >
        <ListFilter className="h-3.5 w-3.5" /> Add a new segment group
      </Button>
    </div>
  );
}

