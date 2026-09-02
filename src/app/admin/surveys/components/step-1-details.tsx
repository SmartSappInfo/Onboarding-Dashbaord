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
} from 'lucide-react';
import { useEntitySearch } from '@/hooks/use-entity-search';
import { useEntityResolver } from '@/context/EntityCacheContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { getSurveyProjectsAction } from '@/lib/surveys/survey-project-actions';
import type { SurveyProject, SurveyType, WorkspaceEntity } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ThemePalettePicker } from './inspector/ThemePalettePicker';
import { PatternSwatchSelector } from './inspector/PatternSwatchSelector';
import { StepperStyleSelector } from './inspector/StepperStyleSelector';
import { ImageUploader } from '@/components/shared/image-uploader';
import { VideoUploader } from '@/components/shared/video-uploader';
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

function VariableHelperPopover({ onInsert }: { onInsert: (token: string) => void }) {
  const { activeWorkspaceId } = useWorkspace() as { activeWorkspaceId: string | null };
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs font-semibold text-primary hover:text-primary/90 hover:bg-primary/10 gap-1.5 rounded-lg active:scale-[0.97]"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Insert Variable</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-3 rounded-2xl shadow-xl border-border bg-card">
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
            <span className="text-xs font-bold text-foreground">Personalization Variables</span>
            <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary bg-primary/10 border-0">
              Dynamic
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Insert inline variables that personalize dynamically. Add fallbacks via <code className="bg-muted px-1 rounded text-[10px]">{'{{key|fallback}}'}</code>.
          </p>
          <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
            {[
              { label: 'Entity / School Name', token: '{{entity.name}}', fallbackToken: '{{entity.name|SmartSapp}}' },
              { label: 'Recipient Contact Name', token: '{{contact.name}}', fallbackToken: '{{contact.name|Valued Respondent}}' },
              { label: 'Recipient Contact Email', token: '{{contact.email}}', fallbackToken: '{{contact.email}}' },
              { label: 'Recipient Contact Phone', token: '{{contact.phone}}', fallbackToken: '{{contact.phone}}' },
            ].map((v) => (
              <div key={v.label} className="p-2 rounded-xl bg-muted/30 hover:bg-muted/60 transition-colors flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-foreground">{v.label}</span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] font-mono font-medium rounded-md px-2 bg-background hover:bg-primary hover:text-primary-foreground active:scale-[0.97]"
                    onClick={() => {
                      onInsert(v.token);
                      setOpen(false);
                    }}
                  >
                    {v.token}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] font-mono font-medium rounded-md px-2 text-muted-foreground hover:text-foreground active:scale-[0.97]"
                    onClick={() => {
                      onInsert(v.fallbackToken);
                      setOpen(false);
                    }}
                    title="With Fallback"
                  >
                    + Fallback
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {activeWorkspaceId && (
            <div className="pt-2 border-t border-border/50">
              <span className="text-[10px] text-muted-foreground/70 block">
                Tip: Type <code className="bg-muted px-1 rounded text-[10px]">{'{{'}</code> in text to trigger inline variables.
              </span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function Step1Details(_props: Step1DetailsProps) {
  const { control, setValue, watch } = useFormContext();
  const { activeWorkspaceId } = useWorkspace() as { activeWorkspaceId: string | null };
  const [activeTab, setActiveTab] = React.useState<StudioInspectorTab>('identity');

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

  return (
    <div className="space-y-5">
      {/* 4-Tab Studio Inspector Navigation */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as StudioInspectorTab)} className="w-full">
        <TabsList className="w-full grid grid-cols-4 p-1 rounded-2xl bg-muted/50 border border-border/60 h-auto gap-1">
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
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <Building className="h-5 w-5" />
                </div>
                <div className="flex flex-col justify-center">
                  <CardTitle className="text-base font-bold text-foreground">Survey Identity & Scope</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Define administrative names, target entity binding, and public title.
                  </CardDescription>
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

              {/* Public Header Title & Prose */}
              <div className="space-y-4">
                <Controller
                  name="title"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Public Header Title</Label>
                        <VariableHelperPopover
                          onInsert={(token) => field.onChange((field.value ? field.value + ' ' : '') + token)}
                        />
                      </div>
                      <Input
                        {...field}
                        placeholder="e.g. Help Us Improve or {{entity.name|SmartSapp}}"
                        className="h-11 rounded-xl bg-card border border-border/60 focus-visible:ring-1 focus-visible:ring-primary/40"
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
                        <VariableHelperPopover
                          onInsert={(token) => field.onChange((field.value ? field.value + ' ' : '') + token)}
                        />
                      </div>
                      <Textarea
                        {...field}
                        placeholder="Explain why this survey matters to your community..."
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: MEDIA & HERO */}
        <TabsContent value="media" className="mt-4 space-y-6">
          <Card className="rounded-2xl border border-border bg-card shadow-xs">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <Video className="h-5 w-5" />
                </div>
                <div className="flex flex-col justify-center">
                  <CardTitle className="text-base font-bold text-foreground">Immersive Hero & Media Assets</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Embed welcome videos, poster frames, cover artwork, and brand insignia.
                  </CardDescription>
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
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <Palette className="h-5 w-5" />
                </div>
                <div className="flex flex-col justify-center">
                  <CardTitle className="text-base font-bold text-foreground">Visual Theme & Aesthetics</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Customize background palettes, contrast ratios, and SVG geometry patterns.
                  </CardDescription>
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
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <Sliders className="h-5 w-5" />
                </div>
                <div className="flex flex-col justify-center">
                  <CardTitle className="text-base font-bold text-foreground">Layout & Progress Dynamics</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Configure question steppers, intro layout presentation, and branding display.
                  </CardDescription>
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
