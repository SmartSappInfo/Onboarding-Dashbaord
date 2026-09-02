'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Survey Design Studio Inspector
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. 4-Tab Inspector IA: Identity, Media & Hero, Theme & Palette, Layout & Stepper.
 * 2. Strict Zero-Any Invariant across all controller renders, helpers, and entities.
 * 3. Mobile-first touch optimization (min-h-[44px], active:scale-[0.97]).
 * 4. Integrates with ThemePalettePicker, PatternSwatchSelector, StepperStyleSelector, and StudioMediaField.
 */

import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import {
  Sparkles,
  Building,
  Users,
  User,
  Layout,
  Video,
  Palette,
  Sliders,
  FolderGit2,
  Layers,
  MessageSquareText,
  Type,
  FlaskConical,
  Eye,
} from 'lucide-react';
import { useEntitySearch } from '@/hooks/use-entity-search';
import { useEntityResolver } from '@/context/EntityCacheContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { getSurveyProjectsAction } from '@/lib/surveys/survey-project-actions';
import { getVariablesAction } from '@/lib/services/fields-variables-service';
import type { SurveyProject, SurveyType, WorkspaceEntity, SurveyExperimentVariant, TemplateVariable } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ThemePalettePicker } from './inspector/ThemePalettePicker';
import { PatternSwatchSelector } from './inspector/PatternSwatchSelector';
import { StepperStyleSelector } from './inspector/StepperStyleSelector';
import { ImageUploader } from '@/components/shared/image-uploader';
import { VideoUploader } from '@/components/shared/video-uploader';
import { IdentityExperimentVariants } from './inspector/IdentityExperimentVariants';
import { SlashInput, SlashTextarea } from '@/components/messaging/SlashInput';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import type { StudioInspectorTab, SurveyBackgroundPattern, SurveyStepperVariant } from './inspector/types';

interface Step1DetailsProps {}

// Sub-component for Entity Selection
function EntityPickerField({
  field,
  setValue,
  watch,
}: {
  field: { value: string | null; onChange: (v: string | null) => void };
  setValue: (name: string, value: unknown, options?: { shouldDirty?: boolean }) => void;
  watch: (name: string) => unknown;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const { results, hasMore, loadMore } = useEntitySearch({ search, enabled: open, pageSize: 25 });
  const { entitiesById, resolveIds } = useEntityResolver();

  React.useEffect(() => {
    if (field.value) resolveIds([field.value]);
  }, [field.value, resolveIds]);

  const entityTypeConfig = {
    institution: { label: 'Institution', icon: Building, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    family: { label: 'Family', icon: Users, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
    person: { label: 'Person', icon: User, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
    other: { label: 'Other', icon: Layout, color: 'text-slate-500', bgColor: 'bg-muted/100/10' },
  };

  const normalize = (e: WorkspaceEntity & { id: string }) => ({
    ...e,
    label: e.displayName || e.entityId || e.id || 'Unnamed Entity',
    type: (e.entityType || 'other').toLowerCase() as keyof typeof entityTypeConfig,
  });

  type NormalizedEntity = ReturnType<typeof normalize>;
  const normalizedEntities: NormalizedEntity[] = results.map((e: WorkspaceEntity & { id: string }) => normalize(e));

  const grouped: Record<keyof typeof entityTypeConfig, NormalizedEntity[]> = {
    institution: normalizedEntities.filter((e: NormalizedEntity) => e.type === 'institution'),
    family: normalizedEntities.filter((e: NormalizedEntity) => e.type === 'family'),
    person: normalizedEntities.filter((e: NormalizedEntity) => e.type === 'person'),
    other: normalizedEntities.filter((e: NormalizedEntity) => !['institution', 'family', 'person'].includes(e.type)),
  };

  const selectedEntity = React.useMemo(() => {
    if (!field.value) return null;
    const inResults = normalizedEntities.find((e: NormalizedEntity) => e.entityId === field.value);
    if (inResults) return inResults;
    const resolved = entitiesById.get(field.value);
    return resolved ? normalize(resolved as WorkspaceEntity & { id: string }) : null;
  }, [field.value, normalizedEntities, entitiesById]);

  const selectedConfig = selectedEntity ? entityTypeConfig[selectedEntity.type] || entityTypeConfig.other : null;
  const SelectedIcon = selectedConfig ? selectedConfig.icon : Building;

  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold">Associated Entity</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'w-full h-11 px-3 flex items-center gap-2.5 rounded-xl bg-muted/20 text-left font-bold text-sm',
              'border border-border/50 shadow-xs hover:bg-muted/30 transition-colors',
              !field.value && 'text-muted-foreground'
            )}
          >
            {selectedEntity ? (
              <>
                <div className={cn('p-1 rounded-lg shrink-0', selectedConfig?.bgColor)}>
                  <SelectedIcon className={cn('h-3.5 w-3.5', selectedConfig?.color)} />
                </div>
                <span className="flex-1 truncate">{selectedEntity.label}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[9px] font-semibold uppercase shrink-0 border-0',
                    selectedConfig?.bgColor,
                    selectedConfig?.color
                  )}
                >
                  {selectedConfig?.label}
                </Badge>
              </>
            ) : (
              <>
                <Building className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                <span>Global / Generic</span>
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0 rounded-2xl shadow-2xl border border-border/50" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search entities..."
              value={search}
              onValueChange={setSearch}
              className="h-10"
            />
            <CommandList className="max-h-[280px]">
              <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
                No entities found.
              </CommandEmpty>
              <CommandItem
                value="none"
                onSelect={() => {
                  field.onChange(null);
                  setValue('entityName', null, { shouldDirty: true });
                  setOpen(false);
                  setSearch('');
                }}
                className={cn('rounded-xl mx-1 my-0.5 gap-2', !field.value && 'bg-primary/5 text-primary')}
              >
                <Building className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-bold text-sm">Global / Generic</span>
              </CommandItem>
              {(Object.entries(grouped) as [keyof typeof entityTypeConfig, NormalizedEntity[]][]).map(([type, entities]) => {
                if (entities.length === 0) return null;
                const config = entityTypeConfig[type];
                const GroupIcon = config.icon;
                return (
                  <CommandGroup
                    key={type}
                    heading={
                      <span className={cn('flex items-center gap-1.5 text-[9px] font-semibold', config.color)}>
                        <GroupIcon className="h-3 w-3" />
                        {config.label}s
                      </span>
                    }
                  >
                    {entities.map((entity: NormalizedEntity) => (
                      <CommandItem
                        key={entity.entityId || entity.id}
                        value={entity.entityId || entity.id}
                        onSelect={() => {
                          field.onChange(entity.entityId);
                          setValue('entityName', entity.label, { shouldDirty: true });

                          // Auto-sync logo if enabled
                          if (watch('useEntityLogo') && entity.logoUrl) {
                            setValue('logoUrl', entity.logoUrl, { shouldDirty: true });
                          }

                          setOpen(false);
                          setSearch('');
                        }}
                        className={cn(
                          'rounded-xl mx-1 my-0.5 gap-2',
                          field.value === entity.entityId && 'bg-primary/5 text-primary'
                        )}
                      >
                        <div className={cn('p-0.5 rounded shrink-0', config.bgColor)}>
                          <GroupIcon className={cn('h-3 w-3', config.color)} />
                        </div>
                        <span className="font-bold text-sm flex-1 truncate">{entity.label}</span>
                        {field.value === entity.entityId && (
                          <span className="text-primary text-[10px] font-semibold">✓</span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
              {hasMore && (
                <CommandItem
                  value="__load_more__"
                  onSelect={() => loadMore()}
                  className="justify-center text-[10px] font-bold text-primary"
                >
                  Load more…
                </CommandItem>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function Step1Details(_props: Step1DetailsProps) {
  const { control, setValue, watch } = useFormContext();
  const { activeWorkspaceId } = useWorkspace() as { activeWorkspaceId: string | null };
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState<StudioInspectorTab>('identity');

  // Load dynamic workspace variables for inline "/" slash command variable insertion
  const [templateVariables, setTemplateVariables] = React.useState<TemplateVariable[]>([]);

  React.useEffect(() => {
    let isMounted = true;
    const fetchVars = async () => {
      try {
        const unified = await getVariablesAction({ workspaceId: activeWorkspaceId || '', featureContext: 'all' });
        if (isMounted && unified && unified.length > 0) {
          const mapped: TemplateVariable[] = unified.map((u) => ({
            id: u.key,
            name: u.key,
            label: u.label,
            context: u.category || 'general',
            description: u.description || u.label,
            dataType: (u.dataType === 'string' || u.dataType === 'number' || u.dataType === 'date' || u.dataType === 'url' || u.dataType === 'html' ? u.dataType : 'string'),
            exampleValue: u.exampleValue || '',
            isDynamic: false,
            isComputed: false,
          }));
          setTemplateVariables(mapped);
          return;
        }
      } catch (err) {
        console.warn('Failed to load dynamic variables for SlashInput:', err);
      }
      if (isMounted) {
        setTemplateVariables([
          { id: 'entity_name', name: 'entity.name', label: 'Entity / School Name', context: 'entity', description: 'Name of the entity', dataType: 'string', exampleValue: 'SmartSapp', isDynamic: false, isComputed: false },
          { id: 'contact_name', name: 'contact.name', label: 'Recipient Contact Name', context: 'contact', description: 'Name of recipient contact', dataType: 'string', exampleValue: 'Jane Doe', isDynamic: false, isComputed: false },
          { id: 'contact_email', name: 'contact.email', label: 'Recipient Contact Email', context: 'contact', description: 'Email of recipient contact', dataType: 'string', exampleValue: 'jane@example.com', isDynamic: false, isComputed: false },
          { id: 'contact_phone', name: 'contact.phone', label: 'Recipient Contact Phone', context: 'contact', description: 'Phone of recipient contact', dataType: 'string', exampleValue: '+1234567890', isDynamic: false, isComputed: false },
        ]);
      }
    };
    fetchVars();
    return () => {
      isMounted = false;
    };
  }, [activeWorkspaceId]);

  // Load Projects for longitudinal study linkage
  const [projects, setProjects] = React.useState<SurveyProject[]>([]);
  React.useEffect(() => {
    if (!activeWorkspaceId) return;
    getSurveyProjectsAction(activeWorkspaceId).then((res) => {
      if (res.success && res.projects) {
        setProjects(res.projects);
      }
    });
  }, [activeWorkspaceId]);

  const isExperimentEnabled = watch('experimentConfig.enabled') === true;

  const handleToggleExperiment = (checked: boolean) => {
    if (checked) {
      const currentVariants = (watch('experimentConfig.variants') as SurveyExperimentVariant[]) || [];
      if (currentVariants.length === 0) {
        const initialVariants: SurveyExperimentVariant[] = [
          {
            id: 'control-a',
            label: 'Control (Variant A)',
            weight: 50,
            isControl: true,
          },
          {
            id: 'var_b',
            label: 'Variant B',
            weight: 50,
            isControl: false,
          },
        ];
        setValue(
          'experimentConfig',
          {
            enabled: true,
            trafficAllocation: 100,
            status: 'running',
            variants: initialVariants,
          },
          { shouldDirty: true }
        );
      } else {
        setValue('experimentConfig.enabled', true, { shouldDirty: true });
        setValue('experimentConfig.status', 'running', { shouldDirty: true });
      }
    } else {
      setValue('experimentConfig.enabled', false, { shouldDirty: true });
      setValue('experimentConfig.status', 'draft', { shouldDirty: true });
    }
  };

  return (
    <div className="space-y-5">
      {/* 4-Tab Studio Inspector Navigation */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as StudioInspectorTab)} className="w-full">
        <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 p-1 rounded-2xl bg-muted/50 border border-border/60 h-auto gap-1">
          <TabsTrigger
            value="identity"
            className="rounded-xl py-2 px-2 text-xs font-bold transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs flex items-center justify-center gap-1.5 active:scale-[0.97]"
          >
            <Building className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Identity</span>
          </TabsTrigger>

          <TabsTrigger
            value="media"
            className="rounded-xl py-2 px-2 text-xs font-bold transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs flex items-center justify-center gap-1.5 active:scale-[0.97]"
          >
            <Video className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Media & Hero</span>
          </TabsTrigger>

          <TabsTrigger
            value="palette"
            className="rounded-xl py-2 px-2 text-xs font-bold transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs flex items-center justify-center gap-1.5 active:scale-[0.97]"
          >
            <Palette className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Theme</span>
          </TabsTrigger>

          <TabsTrigger
            value="layout"
            className="rounded-xl py-2 px-2 text-xs font-bold transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs flex items-center justify-center gap-1.5 active:scale-[0.97]"
          >
            <Sliders className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Layout</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: IDENTITY & ARCHETYPE */}
        <TabsContent value="identity" className="mt-4 space-y-6">
          <Card className="rounded-2xl border border-border bg-card shadow-xs">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl text-primary shrink-0">
                  <Building className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-bold text-foreground">Survey Identity &amp; Scope</CardTitle>
                  <CardInfoTooltip text="Define administrative names, target entity binding, and public title." />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 pt-0 space-y-6">
              {/* Internal Name & Entity Binding */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Controller
                  name="internalName"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Internal Admin Name</Label>
                      <Input
                        {...field}
                        placeholder="e.g. Q3 Parent Feedback Wave"
                        className="h-11 rounded-xl bg-card border border-border/60 focus-visible:ring-1 focus-visible:ring-primary/40"
                      />
                    </div>
                  )}
                />

                <Controller
                  name="entityId"
                  control={control}
                  render={({ field }) => (
                    <EntityPickerField field={field} setValue={setValue} watch={watch} />
                  )}
                />
              </div>

              {/* Survey Archetype & Project */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Controller
                  name="surveyArchetype"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Survey Archetype</Label>
                      <Select
                        value={field.value || 'feedback'}
                        onValueChange={(val) => field.onChange(val as SurveyType)}
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-card border border-border/60">
                          <SelectValue placeholder="Select archetype..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="feedback">Feedback & CSAT</SelectItem>
                          <SelectItem value="nps">NPS & Loyalty</SelectItem>
                          <SelectItem value="evaluation">Academic / Course Evaluation</SelectItem>
                          <SelectItem value="assessment">Psychometric & Assessment</SelectItem>
                          <SelectItem value="lead_capture">Lead Capture & Intake</SelectItem>
                          <SelectItem value="poll">Quick Pulse Poll</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                />

                <Controller
                  name="projectId"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center justify-between">
                        <span>Research Project</span>
                        {field.value && (
                          <Badge variant="outline" className="text-[10px] font-normal">
                            Wave Linked
                          </Badge>
                        )}
                      </Label>
                      <Select
                        value={field.value || 'none'}
                        onValueChange={(val) => field.onChange(val === 'none' ? undefined : val)}
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-card border border-border/60">
                          <SelectValue placeholder="Standalone (No Project)" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="none">Standalone (No Project)</SelectItem>
                          {projects.map((proj) => (
                            <SelectItem key={proj.id} value={proj.id}>
                              {proj.name} ({proj.projectType})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                />
              </div>

              <div className="h-px bg-border/50" />

              {/* A/B Headline & Copy Testing Interactive Switch */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-purple-500/[0.04] border border-purple-500/20">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <FlaskConical className="h-4.5 w-4.5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="identity-ab-toggle" className="text-xs font-bold text-foreground cursor-pointer">
                        A/B Headline & Copy Testing
                      </Label>
                      {isExperimentEnabled ? (
                        <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[9px] font-bold uppercase py-0 px-1.5">
                          Active Split Test
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] font-bold text-muted-foreground uppercase py-0 px-1.5">
                          Off
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground block">
                      {isExperimentEnabled
                        ? 'Traffic is split between your primary copy (Control A) and custom variants below.'
                        : 'Enable to create multiple variants and test different headlines, intros, or CTA copy.'}
                    </span>
                  </div>
                </div>

                <Switch
                  id="identity-ab-toggle"
                  checked={isExperimentEnabled}
                  onCheckedChange={handleToggleExperiment}
                />
              </div>

              {/* Public Header Title & Prose */}
              <div className="space-y-4">
                <Controller
                  name="title"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm font-semibold">Public Header Title</Label>
                          {isExperimentEnabled && (
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-[9px] font-bold uppercase py-0 px-1.5 bg-primary/5 text-primary border-primary/20">
                                Control (Variant A - Baseline)
                              </Badge>
                              {(!watch('previewVariantId') || watch('previewVariantId') === 'control') ? (
                                <Badge className="h-5 px-1.5 text-[9px] font-bold rounded-md bg-primary text-white gap-1 shadow-xs border-none">
                                  <Eye className="h-2.5 w-2.5" />
                                  <span>Live in Preview</span>
                                </Badge>
                              ) : (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setValue('previewVariantId', 'control', { shouldDirty: true });
                                    toast({
                                      title: 'Previewing Control A',
                                      description: 'The simulation canvas now displays the baseline copy.',
                                    });
                                  }}
                                  className="h-5 px-1.5 text-[9px] font-bold text-muted-foreground hover:text-primary gap-1 active:scale-[0.97]"
                                  title="Preview Control A in simulation canvas"
                                >
                                  <Eye className="h-2.5 w-2.5" />
                                  <span>Preview Control A</span>
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground font-medium">
                          Type <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono border">/</kbd> to insert variables
                        </span>
                      </div>
                      <SlashInput
                        value={field.value || ''}
                        onChange={field.onChange}
                        variables={templateVariables}
                        placeholder="e.g. Help Us Improve or type / for variables..."
                        className="h-11 rounded-xl bg-card border border-border/60 focus-visible:ring-1 focus-visible:ring-primary/40 text-sm"
                      />
                    </div>
                  )}
                />

                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Introductory Prose</Label>
                        <span className="text-[11px] text-muted-foreground font-medium">
                          Type <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono border">/</kbd> to insert variables
                        </span>
                      </div>
                      <SlashTextarea
                        value={field.value || ''}
                        onChange={field.onChange}
                        variables={templateVariables}
                        placeholder="Explain why this survey matters to your community... (Type / to insert variables)"
                        className="min-h-[100px] rounded-xl bg-card border border-border/60 focus-visible:ring-1 focus-visible:ring-primary/40 leading-relaxed text-sm"
                      />
                    </div>
                  )}
                />
              </div>

              {/* Button Labels */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Controller
                  name="startButtonText"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Start Button Label</Label>
                      <Input
                        {...field}
                        placeholder="Let's Start"
                        className="h-11 rounded-xl bg-card border border-border/60"
                      />
                    </div>
                  )}
                />

                <Controller
                  name="submitButtonText"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Submit Button Label</Label>
                      <Input
                        {...field}
                        placeholder="Submit Response"
                        className="h-11 rounded-xl bg-card border border-border/60"
                      />
                    </div>
                  )}
                />
              </div>

              {/* Inline A/B Variant Studio on Identity Page */}
              {isExperimentEnabled && (
                <IdentityExperimentVariants
                  surveyId={watch('id')}
                  workspaceId={activeWorkspaceId || ''}
                  templateVariables={templateVariables}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: MEDIA & HERO */}
        <TabsContent value="media" className="mt-4 space-y-6">
          <Card className="rounded-2xl border border-border bg-card shadow-xs">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl text-primary shrink-0">
                  <Video className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-bold text-foreground">Immersive Hero &amp; Media Assets</CardTitle>
                  <CardInfoTooltip text="Embed welcome videos, poster frames, cover artwork, and brand insignia." />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 pt-0 space-y-6">
              {/* Feature Video & Poster Management */}
              <div className="space-y-4">
                <VideoUploader
                  value={{
                    videoUrl: watch('videoUrl') || '',
                    thumbnailUrl: watch('videoThumbnailUrl') || '',
                    title: watch('title') || '',
                    description: watch('videoCaption') || '',
                  }}
                  onChange={(val) => {
                    setValue('videoUrl', val.videoUrl, { shouldDirty: true });
                    setValue('videoThumbnailUrl', val.thumbnailUrl, { shouldDirty: true });
                    if (val.description) {
                      setValue('videoCaption', val.description, { shouldDirty: true });
                    }
                  }}
                  label="Introductory Feature Video & Poster Frame"
                  description="YouTube, Vimeo, or direct MP4 link with integrated poster frame and AI thumbnail designer"
                />

                {/* Video Call to Action text */}
                <Controller
                  name="videoCaption"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <MessageSquareText className="h-3.5 w-3.5 text-primary" /> Video Call-to-Action Text
                      </Label>
                      <Input
                        {...field}
                        value={field.value || ''}
                        placeholder="e.g. Watch Director's Welcome (0:45)"
                        className="h-11 rounded-xl bg-card border border-border/60"
                      />
                    </div>
                  )}
                />
              </div>

              <div className="h-px bg-border/50" />

              {/* Banner Cover Image (Fallback) */}
              <Controller
                name="bannerImageUrl"
                control={control}
                render={({ field }) => (
                  <ImageUploader
                    label="Cover Banner Image (Fallback)"
                    description="Header banner displayed when no intro video is configured"
                    value={field.value || ''}
                    onChange={field.onChange}
                    aspectRatio="video"
                  />
                )}
              />

              {/* Custom Brand Logo Override */}
              <Controller
                name="logoUrl"
                control={control}
                render={({ field }) => (
                  <ImageUploader
                    label="Custom Brand Logo Override"
                    description="Leave empty to use the associated entity's verified institutional logo"
                    value={field.value || ''}
                    onChange={field.onChange}
                    aspectRatio="square"
                  />
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: THEME & PALETTE */}
        <TabsContent value="palette" className="mt-4 space-y-6">
          <Card className="rounded-2xl border border-border bg-card shadow-xs">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl text-primary shrink-0">
                  <Palette className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-bold text-foreground">Visual Theme &amp; Aesthetics</CardTitle>
                  <CardInfoTooltip text="Customize background palettes, contrast ratios, and SVG geometry patterns." />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 pt-0 space-y-6">
              {/* Palette Presets + Custom Color Pickers with Contrast Safety */}
              <Controller
                name="backgroundColor"
                control={control}
                render={({ field: bgField }) => (
                  <Controller
                    name="patternColor"
                    control={control}
                    render={({ field: patternField }) => (
                      <ThemePalettePicker
                        backgroundColor={bgField.value || '#F8FAFC'}
                        patternColor={patternField.value || '#3B82F6'}
                        onBackgroundChange={bgField.onChange}
                        onPatternChange={patternField.onChange}
                      />
                    )}
                  />
                )}
              />

              <div className="h-px bg-border/50" />

              {/* Pattern Swatch Selector */}
              <Controller
                name="backgroundPattern"
                control={control}
                render={({ field }) => (
                  <PatternSwatchSelector
                    value={field.value || 'none'}
                    patternColor={watch('patternColor') || '#3B82F6'}
                    onChange={(pattern: SurveyBackgroundPattern) => field.onChange(pattern)}
                  />
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: LAYOUT & STEPPER */}
        <TabsContent value="layout" className="mt-4 space-y-6">
          <Card className="rounded-2xl border border-border bg-card shadow-xs">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl text-primary shrink-0">
                  <Sliders className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-bold text-foreground">Layout &amp; Progress Dynamics</CardTitle>
                  <CardInfoTooltip text="Configure question steppers, intro layout presentation, and branding display." />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 pt-0 space-y-6">
              {/* Visual Stepper Style Selector */}
              <Controller
                name="stepperVariant"
                control={control}
                render={({ field }) => (
                  <StepperStyleSelector
                    value={field.value || 'full'}
                    onChange={(val: SurveyStepperVariant) => field.onChange(val)}
                  />
                )}
              />

              <div className="h-px bg-border/50" />

              {/* Intro Presentation Switch */}
              <Controller
                name="showIntroAsPage"
                control={control}
                render={({ field }) => {
                  const isInlineActive = field.value === false;
                  return (
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border/70">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-bold text-foreground">
                          Inline Header Presentation
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          {isInlineActive
                            ? 'Shows survey title and intro directly above question 1'
                            : 'Shows a standalone landing screen with welcome video and Start button'}
                        </p>
                      </div>
                      <Switch
                        checked={isInlineActive}
                        onCheckedChange={(checked) => field.onChange(!checked)}
                      />
                    </div>
                  );
                }}
              />

              {/* Presentation Toggles */}
              <div className="space-y-3">
                <Controller
                  name="showBranding"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-card border border-border/60">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-bold">Show Institutional Logo</Label>
                        <p className="text-[10px] text-muted-foreground">Displays logo in survey header</p>
                      </div>
                      <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
                    </div>
                  )}
                />

                <Controller
                  name="showSurveyTitles"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-card border border-border/60">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-bold">Show Survey Title on Steps</Label>
                        <p className="text-[10px] text-muted-foreground">Keeps survey name visible throughout audit</p>
                      </div>
                      <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
                    </div>
                  )}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
