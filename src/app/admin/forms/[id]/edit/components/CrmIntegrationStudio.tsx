'use client';

/**
 * SmartSapp Forms 2.0: CRM Integration Studio
 * 
 * Provides an enterprise-grade visual workspace for configuring multi-attribute
 * CRM identity matching, progressive profiling, automatic pipeline deal creation,
 * follow-up task assignment, and standardized contact tagging.
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck, 
  Building, 
  Home, 
  Sparkles, 
  TrendingUp, 
  CheckSquare, 
  Tags, 
  Info,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TagSelector } from '@/components/tags/TagSelector';
import type { 
  FormCrmSettings, 
  EntityHandlingStrategy, 
  WorkspacePipeline, 
  WorkspaceTeamMember 
} from '@/lib/forms/form-crm-types';
import type { EntityType, AppField } from '@/lib/types';
import { 
  getWorkspacePipelinesAction, 
  getWorkspaceTeamMembersAction 
} from '@/lib/forms/crm-integration-actions';

interface CrmIntegrationStudioProps {
  workspaceId: string;
  contactScope: EntityType;
  actions: Record<string, any>;
  availableFields: AppField[];
  onChange: (updatedSettings: Partial<FormCrmSettings>) => void;
}

export default function CrmIntegrationStudio({
  workspaceId,
  contactScope,
  actions = {},
  availableFields: _availableFields = [],
  onChange,
}: CrmIntegrationStudioProps) {
  const [pipelines, setPipelines] = useState<WorkspacePipeline[]>([]);
  const [teamMembers, setTeamMembers] = useState<WorkspaceTeamMember[]>([]);
  const [_isLoading, setIsLoading] = useState(true);

  // Extract settings with safe defaults
  const entityHandling: EntityHandlingStrategy = actions.entityHandling || 'create_or_update';
  const leadSource: string = actions.leadSource || '';
  const progressiveProfiling = actions.progressiveProfiling || { enabled: true, hideKnownFields: false };
  const dealCreation = actions.dealCreation || { enabled: false, titleTemplate: '{{name}} - Form Inquiry' };
  const taskAssignment = actions.taskAssignment || { enabled: false, titleTemplate: 'Follow up with {{name}}', priority: 'medium', dueInHours: 24 };
  const tags: string[] = Array.isArray(actions.tags) ? actions.tags : [];

  // Fetch workspace pipelines and team members on load
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setIsLoading(true);
      try {
        const [pipes, members] = await Promise.all([
          getWorkspacePipelinesAction(workspaceId),
          getWorkspaceTeamMembersAction(workspaceId),
        ]);
        if (isMounted) {
          setPipelines(pipes);
          setTeamMembers(members);
        }
      } catch (err) {
        console.error('Failed to load CRM pipelines or team members:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [workspaceId]);

  // Selected pipeline's active stages
  const selectedPipeline = pipelines.find(p => p.id === dealCreation.pipelineId) || pipelines[0];

  return (
    <div className="space-y-6">
      {/* ── 1. Contact Match & Identity Strategy ── */}
      <Card className="rounded-3xl border border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" />
                Contact Match & Entity Strategy
              </CardTitle>
              <CardDescription className="text-xs">
                Control how submissions resolve against existing CRM contacts, families, and institutions.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-primary/5 text-primary border-primary/20">
              4-Tier Hierarchy Active
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Contact Scope */}
          <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Target Entity Scope
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'person', label: 'Individual Person', icon: Users, desc: 'Creates or matches Person contacts' },
                { id: 'family', label: 'Family / Household', icon: Home, desc: 'Links responses to Family records' },
                { id: 'institution', label: 'Institution / School', icon: Building, desc: 'Binds to Organization accounts' },
              ].map(scope => {
                const isSelected = (contactScope || 'person') === scope.id;
                const IconComponent = scope.icon;
                return (
                  <button
                    key={scope.id}
                    type="button"
                    onClick={() => onChange({ contactScope: scope.id as EntityType })}
                    className={cn(
                      "flex flex-col text-left p-4 rounded-2xl border transition-all duration-200 min-h-[44px]",
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                        : "border-border/60 bg-card hover:bg-muted/20"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <IconComponent className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                      <span className="text-xs font-bold text-foreground">{scope.label}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground leading-snug">{scope.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Handling Strategy */}
          <div className="space-y-3 pt-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Matching & Creation Rule
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'create_or_update',
                  label: 'Match or Create',
                  badge: 'Recommended',
                  desc: 'Updates matched contact by ID, Email, Phone, or Tax ID. Creates new lead if no match exists.',
                },
                {
                  id: 'update_matching',
                  label: 'Update Existing Only',
                  badge: 'Strict Match',
                  desc: 'Only updates existing records. Ignores submissions that do not match an existing CRM contact.',
                },
                {
                  id: 'create_new',
                  label: 'Always Create New',
                  badge: 'No Deduplication',
                  desc: 'Creates a separate lead record for every single submission without deduplication.',
                },
              ].map(strat => {
                const isSelected = entityHandling === strat.id;
                return (
                  <button
                    key={strat.id}
                    type="button"
                    onClick={() => onChange({ entityHandling: strat.id as EntityHandlingStrategy })}
                    className={cn(
                      "flex flex-col text-left p-4 rounded-2xl border transition-all duration-200 min-h-[44px]",
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                        : "border-border/60 bg-card hover:bg-muted/20"
                    )}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-xs font-bold text-foreground">{strat.label}</span>
                      <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 font-semibold", isSelected ? "bg-primary text-primary-foreground border-transparent" : "text-muted-foreground")}>
                        {strat.badge}
                      </Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground leading-snug">{strat.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lead Source */}
          <div className="space-y-1.5 pt-2">
            <Label htmlFor="leadSourceInput" className="text-xs font-semibold">
              Default Lead Source Attribution Tag
            </Label>
            <Input
              id="leadSourceInput"
              value={leadSource}
              onChange={(e) => onChange({ leadSource: e.target.value })}
              placeholder="e.g. website_admissions, open_day_registration"
              className="h-11 rounded-xl bg-background text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              This source will be attached to the CRM contact and submission activity record.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Progressive Profiling & Smart Concealment ── */}
      <Card className="rounded-3xl border border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Progressive Profiling & Smart Pre-Fill
              </CardTitle>
              <CardDescription className="text-xs">
                Deliver high-conversion personalized intake experiences for known contacts.
              </CardDescription>
            </div>
            <Switch
              checked={progressiveProfiling.enabled !== false}
              onCheckedChange={(checked) => onChange({
                progressiveProfiling: { ...progressiveProfiling, enabled: checked }
              })}
            />
          </div>
        </CardHeader>

        {progressiveProfiling.enabled !== false && (
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-950 dark:text-amber-200 text-xs">
              <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1 leading-relaxed">
                <span className="font-bold">How Progressive Profiling Works:</span>
                <p>
                  When respondents open your form via personalized email or SMS links, SmartSapp automatically resolves their CRM attributes and pre-fills known fields.
                </p>
              </div>
            </div>

            {/* Smart Field Concealment Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/20 border border-border/40">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">
                  Smart Field Concealment
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Automatically hide fields that the CRM already has verified values for, dramatically shortening the form.
                </p>
              </div>
              <Switch
                checked={!!progressiveProfiling.hideKnownFields}
                onCheckedChange={(checked) => onChange({
                  progressiveProfiling: { ...progressiveProfiling, hideKnownFields: checked }
                })}
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── 3. Automated Deal & Pipeline Opportunity ── */}
      <Card className="rounded-3xl border border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Automated CRM Deal / Opportunity Creation
              </CardTitle>
              <CardDescription className="text-xs">
                Automatically generate a deal in your sales or admissions pipeline upon submission.
              </CardDescription>
            </div>
            <Switch
              checked={!!dealCreation.enabled}
              onCheckedChange={(checked) => onChange({
                dealCreation: { ...dealCreation, enabled: checked }
              })}
            />
          </div>
        </CardHeader>

        {dealCreation.enabled && (
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Pipeline Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Target Pipeline</Label>
                <Select
                  value={dealCreation.pipelineId || (pipelines[0]?.id || '')}
                  onValueChange={(val) => {
                    const pipe = pipelines.find(p => p.id === val);
                    onChange({
                      dealCreation: {
                        ...dealCreation,
                        pipelineId: val,
                        stageId: pipe?.stages[0]?.id,
                      }
                    });
                  }}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-background">
                    <SelectValue placeholder="Select pipeline..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Stage Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Initial Stage</Label>
                <Select
                  value={dealCreation.stageId || (selectedPipeline?.stages[0]?.id || '')}
                  onValueChange={(val) => onChange({
                    dealCreation: { ...dealCreation, stageId: val }
                  })}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-background">
                    <SelectValue placeholder="Select initial stage..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(selectedPipeline?.stages || []).map(stage => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Deal Title Template */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Deal Title Template</Label>
              <Input
                value={dealCreation.titleTemplate || '{{name}} - Form Inquiry'}
                onChange={(e) => onChange({
                  dealCreation: { ...dealCreation, titleTemplate: e.target.value }
                })}
                placeholder="e.g. {{name}} - 2026 Admissions"
                className="h-11 rounded-xl bg-background"
              />
              <p className="text-[10px] text-muted-foreground">
                Supports variable replacement tokens such as <code className="text-primary font-mono">{`{{name}}`}</code>, <code className="text-primary font-mono">{`{{email}}`}</code>.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── 4. Follow-Up Task Assignment ── */}
      <Card className="rounded-3xl border border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-indigo-500" />
                Follow-Up Task & Owner Routing
              </CardTitle>
              <CardDescription className="text-xs">
                Automatically generate a task for a team member when a response is received.
              </CardDescription>
            </div>
            <Switch
              checked={!!taskAssignment.enabled}
              onCheckedChange={(checked) => onChange({
                taskAssignment: { ...taskAssignment, enabled: checked }
              })}
            />
          </div>
        </CardHeader>

        {taskAssignment.enabled && (
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Assigned Team Member */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Assignee</Label>
                <Select
                  value={taskAssignment.assignedUserId || 'unassigned'}
                  onValueChange={(val) => onChange({
                    taskAssignment: {
                      ...taskAssignment,
                      assignedUserId: val === 'unassigned' ? undefined : val
                    }
                  })}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-background">
                    <SelectValue placeholder="Select team member..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned (Workspace Default)</SelectItem>
                    {teamMembers.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Task Priority</Label>
                <Select
                  value={taskAssignment.priority || 'medium'}
                  onValueChange={(val) => onChange({
                    taskAssignment: {
                      ...taskAssignment,
                      priority: val as 'low' | 'medium' | 'high'
                    }
                  })}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-background">
                    <SelectValue placeholder="Select priority..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low Priority</SelectItem>
                    <SelectItem value="medium">Medium Priority</SelectItem>
                    <SelectItem value="high">High Priority (Urgent)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Task Due In */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Due Date Offset</Label>
              <Select
                value={String(taskAssignment.dueInHours || 24)}
                onValueChange={(val) => onChange({
                  taskAssignment: { ...taskAssignment, dueInHours: Number(val) }
                })}
              >
                <SelectTrigger className="h-11 rounded-xl bg-background">
                  <SelectValue placeholder="Select due timeframe..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">Due in 4 Hours (Fast Response)</SelectItem>
                  <SelectItem value="24">Due in 24 Hours (Next Day)</SelectItem>
                  <SelectItem value="72">Due in 3 Business Days</SelectItem>
                  <SelectItem value="168">Due in 1 Week</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── 5. Standardized Contact Tag Application ── */}
      <Card className="rounded-3xl border border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Tags className="h-4 w-4 text-primary" />
              Automated Registry Tags
            </CardTitle>
            <CardDescription className="text-xs">
              Automatically apply standardized CRM tags to respondents upon form completion.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-3">
          <TagSelector
            currentTagIds={tags}
            onTagsChange={(newTags: string[]) => onChange({ tags: newTags })}
          />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Tags selected here will be merged with any dynamic tags calculated by the Logic Studio rules engine.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
