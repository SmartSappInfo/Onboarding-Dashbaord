'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Phase 6: Survey CRM Mapping & Automation Tab
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10 & Strict Zero-Any Invariant):
 * 1. Visual Two-Way CRM Mapping:
 *    - Maps survey questions to standard contact fields, entity custom fields, and deal fields.
 * 2. Automated Task Dispatch & Deal Creation:
 *    - Configures rules for creating follow-up CRM tasks and pipeline deals on specific score/sentiment triggers.
 * 3. Mobile Optimized & Touch Ergonomics:
 *    - All interactive controls adhere to min-h-[44px] touch targets and active:scale-[0.97] tactile states.
 * 4. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import {
  Survey,
  SurveyElement,
  SurveyQuestion,
  SurveyCrmConfig,
  SurveyCrmFieldMapping,
  SurveyCrmTaskRule,
  SurveyCrmDealRule,
  SurveyCrmFieldDefinition,
  CrmTargetEntityType,
  CrmFieldWriteMode,
  CrmTaskTriggerCondition,
  CrmFieldTransform,
} from '@/lib/types';
import { getSurveyCrmFieldDefinitionsAction } from '@/lib/surveys/survey-crm-sync-actions';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Trash2,
  Database,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Layers,
  Clock,
  UserCheck,
  Briefcase,
  Sliders,
} from 'lucide-react';

export interface SurveyCrmMappingTabProps {
  workspaceId: string;
}

export function SurveyCrmMappingTab({ workspaceId }: SurveyCrmMappingTabProps) {
  const { watch, setValue } = useFormContext();
  const { toast } = useToast();

  const [availableCrmFields, setAvailableCrmFields] = React.useState<SurveyCrmFieldDefinition[]>([]);
  const [isLoadingFields, setIsLoadingFields] = React.useState(true);

  const elements: SurveyElement[] = watch('elements') || [];
  const questions = elements.filter(
    (el): el is SurveyQuestion => !['heading', 'description', 'divider', 'image', 'video', 'audio', 'document', 'embed', 'section'].includes(el.type)
  );

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

  // Load CRM Fields
  React.useEffect(() => {
    async function loadFields() {
      if (!workspaceId) return;
      setIsLoadingFields(true);
      try {
        const res = await getSurveyCrmFieldDefinitionsAction(workspaceId);
        if (res.success && res.fields) {
          setAvailableCrmFields(res.fields);
        }
      } catch (err) {
        console.error('Failed to load CRM fields:', err);
      } finally {
        setIsLoadingFields(false);
      }
    }
    loadFields();
  }, [workspaceId]);

  // Handlers for Field Mappings
  const addFieldMapping = () => {
    if (questions.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Questions Found',
        description: 'Please add questions to the survey before mapping CRM fields.',
      });
      return;
    }
    const newMapping: SurveyCrmFieldMapping = {
      id: `map_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      questionId: questions[0].id,
      targetType: 'contact',
      targetField: 'name',
      writeMode: 'fill_if_empty',
      transform: 'trim',
    };
    setValue('crmConfig.fieldMappings', [...(crmConfig.fieldMappings || []), newMapping], { shouldDirty: true });
  };

  const removeFieldMapping = (id: string) => {
    const updated = (crmConfig.fieldMappings || []).filter((m) => m.id !== id);
    setValue('crmConfig.fieldMappings', updated, { shouldDirty: true });
  };

  const updateFieldMapping = (id: string, patch: Partial<SurveyCrmFieldMapping>) => {
    const updated = (crmConfig.fieldMappings || []).map((m) => (m.id === id ? { ...m, ...patch } : m));
    setValue('crmConfig.fieldMappings', updated, { shouldDirty: true });
  };

  // Handlers for Task Rules
  const addTaskRule = () => {
    const newRule: SurveyCrmTaskRule = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      triggerOn: 'nps_detractor',
      thresholdValue: 6,
      taskTitleTemplate: 'Follow up with {{contact.name}} regarding low survey satisfaction (Score: {{score}})',
      taskDescriptionTemplate: 'Respondent gave a low rating on {{survey.title}}. Reach out promptly to resolve concerns.',
      priority: 'high',
      dueInHours: 24,
      assignTo: 'survey_owner',
    };
    setValue('crmConfig.taskRules', [...(crmConfig.taskRules || []), newRule], { shouldDirty: true });
  };

  const removeTaskRule = (id: string) => {
    const updated = (crmConfig.taskRules || []).filter((r) => r.id !== id);
    setValue('crmConfig.taskRules', updated, { shouldDirty: true });
  };

  const updateTaskRule = (id: string, patch: Partial<SurveyCrmTaskRule>) => {
    const updated = (crmConfig.taskRules || []).map((r) => (r.id === id ? { ...r, ...patch } : r));
    setValue('crmConfig.taskRules', updated, { shouldDirty: true });
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Overview & Master Toggles */}
      <Card className="rounded-2xl border-border bg-card shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">CRM Intelligence & Two-Way Sync</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Map question answers directly to CRM contacts, entity custom fields, and deal attributes upon submission.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-muted/20">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">Auto-Upsert Contacts</Label>
                <p className="text-[11px] text-muted-foreground">Match & update contacts by email/phone</p>
              </div>
              <Switch
                checked={crmConfig.autoUpsertContact !== false}
                onCheckedChange={(checked) => setValue('crmConfig.autoUpsertContact', checked, { shouldDirty: true })}
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-muted/20">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">Sync Entity Custom Fields</Label>
                <p className="text-[11px] text-muted-foreground">Update custom fields on matched entities</p>
              </div>
              <Switch
                checked={crmConfig.autoUpsertEntity !== false}
                onCheckedChange={(checked) => setValue('crmConfig.autoUpsertEntity', checked, { shouldDirty: true })}
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-muted/20">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">Timeline Activity Cards</Label>
                <p className="text-[11px] text-muted-foreground">Log rich cards in CRM activity streams</p>
              </div>
              <Switch
                checked={crmConfig.timelineLoggingEnabled !== false}
                onCheckedChange={(checked) => setValue('crmConfig.timelineLoggingEnabled', checked, { shouldDirty: true })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 1. Question-to-CRM Field Mappings */}
      <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Dynamic Field Mappings ({crmConfig.fieldMappings?.length || 0})
              </CardTitle>
              <CardDescription className="text-xs">
                Select which survey questions should write their answer values directly into CRM contact and entity fields.
              </CardDescription>
            </div>
            <Button
              type="button"
              onClick={addFieldMapping}
              size="sm"
              className="h-9 px-4 gap-1.5 text-xs font-semibold active:scale-[0.97]"
            >
              <Plus className="h-4 w-4" />
              Add Mapping
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {!crmConfig.fieldMappings || crmConfig.fieldMappings.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
              <p>No field mappings configured yet.</p>
              <p className="text-[11px]">Click &ldquo;Add Mapping&rdquo; to route survey answers into CRM profiles.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs font-bold w-[30%]">Survey Question</TableHead>
                    <TableHead className="text-xs font-bold w-[12%]">Target Type</TableHead>
                    <TableHead className="text-xs font-bold w-[28%]">Target CRM Field</TableHead>
                    <TableHead className="text-xs font-bold w-[18%]">Write Mode</TableHead>
                    <TableHead className="text-xs font-bold w-[12%] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {crmConfig.fieldMappings.map((mapping) => (
                    <TableRow key={mapping.id} className="hover:bg-muted/20">
                      {/* Survey Question */}
                      <TableCell>
                        <Select
                          value={mapping.questionId}
                          onValueChange={(val) => updateFieldMapping(mapping.id, { questionId: val })}
                        >
                          <SelectTrigger className="h-9 text-xs rounded-xl truncate">
                            <SelectValue placeholder="Select Question" />
                          </SelectTrigger>
                          <SelectContent>
                            {questions.map((q) => (
                              <SelectItem key={q.id} value={q.id} className="text-xs">
                                <span className="font-semibold">{q.title || 'Untitled Question'}</span>
                                <span className="text-[10px] text-muted-foreground ml-2 font-mono">({q.type})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Target Type */}
                      <TableCell>
                        <Select
                          value={mapping.targetType}
                          onValueChange={(val) => updateFieldMapping(mapping.id, { targetType: val as CrmTargetEntityType })}
                        >
                          <SelectTrigger className="h-9 text-xs rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="contact" className="text-xs font-semibold">Contact</SelectItem>
                            <SelectItem value="entity" className="text-xs font-semibold">Entity</SelectItem>
                            <SelectItem value="deal" className="text-xs font-semibold">Deal</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Target CRM Field */}
                      <TableCell>
                        <Select
                          value={mapping.targetField}
                          onValueChange={(val) => updateFieldMapping(mapping.id, { targetField: val })}
                        >
                          <SelectTrigger className="h-9 text-xs rounded-xl">
                            <SelectValue placeholder="Select Field" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableCrmFields
                              .filter((f) => f.targetType === mapping.targetType)
                              .map((f) => (
                                <SelectItem key={f.key} value={f.key} className="text-xs">
                                  <span>{f.label}</span>
                                  <span className="text-[10px] text-muted-foreground ml-2 font-mono">({f.group})</span>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Write Mode */}
                      <TableCell>
                        <Select
                          value={mapping.writeMode}
                          onValueChange={(val) => updateFieldMapping(mapping.id, { writeMode: val as CrmFieldWriteMode })}
                        >
                          <SelectTrigger className="h-9 text-xs rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fill_if_empty" className="text-xs">
                              Fill if Empty
                            </SelectItem>
                            <SelectItem value="always_overwrite" className="text-xs font-bold text-amber-600">
                              Always Overwrite
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Delete */}
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFieldMapping(mapping.id)}
                          className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 active:scale-[0.97]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Automated Follow-up CRM Tasks */}
      <Card className="rounded-2xl border-border bg-card shadow-sm">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Follow-up CRM Tasks ({crmConfig.taskRules?.length || 0})
              </CardTitle>
              <CardDescription className="text-xs">
                Automatically generate actionable follow-up tasks in the CRM task manager when respondents trigger specific conditions.
              </CardDescription>
            </div>
            <Button
              type="button"
              onClick={addTaskRule}
              size="sm"
              variant="outline"
              className="h-9 px-4 gap-1.5 text-xs font-semibold active:scale-[0.97]"
            >
              <Plus className="h-4 w-4" />
              Add Task Rule
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {!crmConfig.taskRules || crmConfig.taskRules.length === 0 ? (
            <p className="text-center py-6 text-xs text-muted-foreground">
              No follow-up task rules configured. Tasks can automatically alert staff to dissatisfied respondents.
            </p>
          ) : (
            <div className="space-y-4">
              {crmConfig.taskRules.map((rule) => (
                <div key={rule.id} className="p-4 rounded-xl border border-border bg-muted/10 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Label className="text-xs font-bold">Trigger Condition:</Label>
                      <Select
                        value={rule.triggerOn}
                        onValueChange={(val) => updateTaskRule(rule.id, { triggerOn: val as CrmTaskTriggerCondition })}
                      >
                        <SelectTrigger className="h-8 w-44 text-xs rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nps_detractor" className="text-xs">NPS Detractor (&le; 6)</SelectItem>
                          <SelectItem value="score_below" className="text-xs">Score Below Threshold</SelectItem>
                          <SelectItem value="sentiment_negative" className="text-xs">Negative Sentiment</SelectItem>
                          <SelectItem value="always" className="text-xs">Every Submission</SelectItem>
                        </SelectContent>
                      </Select>

                      {rule.triggerOn === 'score_below' && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">Threshold:</span>
                          <Input
                            type="number"
                            value={rule.thresholdValue ?? 50}
                            onChange={(e) => updateTaskRule(rule.id, { thresholdValue: Number(e.target.value) || 0 })}
                            className="h-8 w-20 text-xs rounded-lg font-mono"
                          />
                        </div>
                      )}

                      <Badge variant="outline" className="text-[10px] uppercase font-bold font-mono">
                        Priority: {rule.priority}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold font-mono">
                        Due in +{rule.dueInHours}h
                      </Badge>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTaskRule(rule.id)}
                      className="h-8 w-8 text-rose-500 hover:text-rose-700 active:scale-[0.97]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Task Title Template */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Task Title Template:</Label>
                    <Input
                      value={rule.taskTitleTemplate}
                      onChange={(e) => updateTaskRule(rule.id, { taskTitleTemplate: e.target.value })}
                      placeholder="Follow up with {{contact.name}} regarding low survey satisfaction (Score: {{score}})"
                      className="h-9 text-xs rounded-xl"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Available tokens: <code className="text-primary font-mono">&#123;&#123;contact.name&#125;&#125;</code>, <code className="text-primary font-mono">&#123;&#123;survey.title&#125;&#125;</code>, <code className="text-primary font-mono">&#123;&#123;score&#125;&#125;</code>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
