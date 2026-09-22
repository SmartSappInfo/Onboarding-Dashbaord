'use client';

/**
 * @fileOverview Draft-First Create Pipeline Modal Dialog
 * 
 * ARCHITECTURAL POINTER & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Draft-First Pattern: Zero database writes occur while configuring or if cancelled.
 *    Only commits to Firestore when user explicitly clicks "Create Pipeline".
 * 2. Shares <PipelineConfigFields> with PipelineConfigView to guarantee 100% field parity.
 * 3. Pro-actively bundles starter stage templates (Standard Sales, Onboarding, Renewals, Custom)
 *    so new pipelines are immediately functional.
 * 4. Strict zero 'any' / 'any[]' compliance (Rule 5).
 * 5. Touch targets >= 44px on interactive elements (Rule 7).
 */

import * as React from 'react';
import { 
    GitBranch, 
    Plus, 
    Loader2, 
    Sparkles, 
    Layers, 
    X,
    Check
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useWorkspaceUsers } from '@/hooks/use-workspace-users';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { Role, StarterStageConfig, UserProfile } from '@/lib/types';
import { createPipelineWithStagesAction } from '@/lib/pipeline-actions';
import { 
    PipelineConfigFields, 
    type PipelineFormData, 
    type PipelineConfigOption 
} from './PipelineConfigFields';
import { 
    PIPELINE_STARTER_TEMPLATES, 
    type PipelineStarterTemplate 
} from '@/lib/deals/pipeline-starter-templates';

interface CreatePipelineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeWorkspaceId: string;
  allowedWorkspaces: Array<{ id: string; name: string }>;
  onPipelineCreated: (newPipelineId: string) => void;
}

export function CreatePipelineModal({
  open,
  onOpenChange,
  activeWorkspaceId,
  allowedWorkspaces,
  onPipelineCreated,
}: CreatePipelineModalProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { activeOrganizationId } = useWorkspace();
  const { data: workspaceUsers } = useWorkspaceUsers(activeWorkspaceId);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>('standard_sales');
  const [stages, setStages] = React.useState<StarterStageConfig[]>(
    PIPELINE_STARTER_TEMPLATES[0].stages
  );
  const [newStageName, setNewStageName] = React.useState('');

  // Local draft state — zero Firestore side-effects until submitted
  const [formData, setFormData] = React.useState<PipelineFormData>({
    name: '',
    description: '',
    type: 'sales',
    defaultProbability: 50,
    workspaceIds: [activeWorkspaceId],
    columnWidth: 320,
    showDealTotals: true,
    accessRoles: [],
    assignmentStrategy: 'direct',
    assignmentUserIds: [],
    defaultCloseDateOffsetValue: 30,
    defaultCloseDateOffsetUnit: 'days',
  });

  // Query workspace roles scoped strictly to active organization
  const rolesQuery = useMemoFirebase(() => 
    firestore && activeOrganizationId ? query(
      collection(firestore, 'roles'),
      where('organizationId', '==', activeOrganizationId),
      orderBy('name', 'asc')
    ) : null, 
    [firestore, activeOrganizationId]
  );
  const { data: rawRoles } = useCollection<Role>(rolesQuery);

  const roleOptions: PipelineConfigOption[] = React.useMemo(() => {
    return rawRoles?.map(r => ({ label: r.name, value: r.id })) || [];
  }, [rawRoles]);

  const workspaceOptions: PipelineConfigOption[] = React.useMemo(() => {
    return allowedWorkspaces.map(w => ({ label: w.name, value: w.id }));
  }, [allowedWorkspaces]);

  const workspaceUserOptions: PipelineConfigOption[] = React.useMemo(() => {
    return workspaceUsers?.map((u: UserProfile) => ({ label: u.name || u.email || 'Team Member', value: u.id })) || [];
  }, [workspaceUsers]);

  // Reset form to pristine defaults whenever modal opens
  React.useEffect(() => {
    if (open) {
      const defaultTemplate = PIPELINE_STARTER_TEMPLATES[0];
      setSelectedTemplateId(defaultTemplate.id);
      setStages([...defaultTemplate.stages]);
      setFormData({
        name: '',
        description: '',
        type: defaultTemplate.type,
        defaultProbability: 50,
        workspaceIds: [activeWorkspaceId],
        columnWidth: 320,
        showDealTotals: true,
        accessRoles: [],
        assignmentStrategy: 'direct',
        assignmentUserIds: [],
        defaultCloseDateOffsetValue: 30,
        defaultCloseDateOffsetUnit: 'days',
      });
      setNewStageName('');
    }
  }, [open, activeWorkspaceId]);

  const updateField = React.useCallback(<K extends keyof PipelineFormData>(key: K, value: PipelineFormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSelectTemplate = (template: PipelineStarterTemplate) => {
    setSelectedTemplateId(template.id);
    setStages([...template.stages]);
    setFormData(prev => ({
      ...prev,
      type: template.type,
      name: prev.name || template.name,
    }));
  };

  const handleAddCustomStage = () => {
    if (!newStageName.trim()) return;
    const nextOrder = stages.length + 1;
    const stage: StarterStageConfig = {
      name: newStageName.trim(),
      order: nextOrder,
      color: '#3B82F6',
      probability: 50,
    };
    setStages(prev => [...prev, stage]);
    setNewStageName('');
  };

  const handleRemoveStage = (indexToRemove: number) => {
    if (stages.length <= 1) {
      toast({ variant: 'destructive', title: 'Constraint Alert', description: 'Pipeline must have at least one stage.' });
      return;
    }
    setStages(prev => prev.filter((_, idx) => idx !== indexToRemove).map((s, idx) => ({ ...s, order: idx + 1 })));
  };

  const handleCreatePipeline = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please provide a pipeline name.' });
      return;
    }

    if (formData.workspaceIds.length === 0) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Pipeline must be assigned to at least one workspace.' });
      return;
    }

    if (stages.length === 0) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Pipeline must contain at least one stage.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createPipelineWithStagesAction({
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: formData.type,
        defaultProbability: formData.defaultProbability,
        workspaceIds: formData.workspaceIds,
        columnWidth: formData.columnWidth,
        showDealTotals: formData.showDealTotals,
        accessRoles: formData.accessRoles,
        assignmentStrategy: formData.assignmentStrategy,
        assignmentUserIds: formData.assignmentUserIds,
        defaultCloseDateOffsetValue: typeof formData.defaultCloseDateOffsetValue === 'number' ? formData.defaultCloseDateOffsetValue : null,
        defaultCloseDateOffsetUnit: formData.defaultCloseDateOffsetUnit,
        initialStages: stages,
      });

      if (res.success && res.id) {
        toast({
          title: 'Pipeline Created Successfully',
          description: `"${formData.name.trim()}" initialized with ${stages.length} stages.`,
          actionConfig: {
            path: '/admin/pipeline',
            label: 'View Pipeline',
          },
        });
        onPipelineCreated(res.id);
        onOpenChange(false);
      } else {
        throw new Error(res.error || 'Failed to create pipeline');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown creation error';
      toast({ variant: 'destructive', title: 'Creation Failed', description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
              <GitBranch className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">
                Create New Pipeline
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Configure your workflow track. Changes are saved only when you click Create.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Scrollable Body */}
        <form onSubmit={handleCreatePipeline} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Starter Templates Picker */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={13} className="text-amber-500" /> Starter Blueprint Presets
                </Label>
                <span className="text-[10px] text-muted-foreground">Pick a blueprint or customize below</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                {PIPELINE_STARTER_TEMPLATES.map((tmpl) => {
                  const isSelected = selectedTemplateId === tmpl.id;
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => handleSelectTemplate(tmpl)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all duration-150 flex flex-col justify-between ${
                        isSelected
                          ? 'border-primary/60 bg-primary/5 shadow-xs ring-1 ring-primary/20'
                          : 'border-border/70 bg-background hover:bg-muted/30 hover:border-border'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground">{tmpl.name}</span>
                          {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {tmpl.description}
                        </p>
                      </div>
                      <span className="text-[9px] font-bold text-muted-foreground/70 uppercase mt-2 block">
                        {tmpl.stages.length} Stages
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stages Preview & Inline Customizer */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={13} className="text-primary" /> Included Stages ({stages.length})
                </Label>
                <span className="text-[10px] text-muted-foreground">Ordered workflow progression</span>
              </div>

              {/* Stage Chips */}
              <div className="flex flex-wrap gap-2">
                {stages.map((stage, idx) => (
                  <div
                    key={`${stage.name}-${idx}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border text-xs font-semibold shadow-2xs group"
                  >
                    <span 
                      className="h-2 w-2 rounded-full shrink-0" 
                      style={{ backgroundColor: stage.color || '#3B82F6' }} 
                    />
                    <span className="text-foreground">{stage.name}</span>
                    {typeof stage.probability === 'number' && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {stage.probability}%
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveStage(idx)}
                      className="text-muted-foreground hover:text-destructive ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                      title="Remove stage"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Quick Add Stage Input */}
              <div className="flex items-center gap-2 pt-1">
                <Input
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomStage();
                    }
                  }}
                  placeholder="Add custom stage name..."
                  className="h-9 text-xs rounded-xl bg-background border-border"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddCustomStage}
                  disabled={!newStageName.trim()}
                  className="h-9 text-xs font-bold rounded-xl shrink-0"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Stage
                </Button>
              </div>
            </div>

            {/* Shared Pipeline Configuration Fields (Single Source of Truth) */}
            <div className="pt-2">
              <PipelineConfigFields
                variant="modal"
                formData={formData}
                onChange={updateField}
                workspaceOptions={workspaceOptions}
                roleOptions={roleOptions}
                workspaceUserOptions={workspaceUserOptions}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Modal Footer */}
          <DialogFooter className="p-4 sm:p-6 border-t border-border/60 bg-muted/10 shrink-0 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-10 px-5 text-xs font-semibold rounded-xl min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.name.trim()}
              className="h-10 px-6 text-xs font-bold rounded-xl min-h-[44px] bg-primary text-primary-foreground hover:bg-primary/95 shadow-md active:scale-[0.97] transition-all gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Creating Pipeline...</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Pipeline</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
