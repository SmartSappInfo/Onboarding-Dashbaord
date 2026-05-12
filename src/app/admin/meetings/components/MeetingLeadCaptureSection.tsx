'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MultiSelect } from '@/components/ui/multi-select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Database,
  Tags,
  Zap,
  Plus,
  Trash2,
  ArrowRight,
  UserPlus,
  Link2,
  Mail,
  Phone,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { createTagAction } from '@/lib/tag-actions';
import { saveAutomationAction } from '@/lib/automation-actions';
import type { MeetingRegistrationField } from '@/lib/types';

// ─── Types ───────────────────────────────────────────────────────

interface MeetingLeadCaptureSectionProps {
  /** The registration fields configured for this meeting */
  registrationFields: MeetingRegistrationField[];
}

// ─── Component ───────────────────────────────────────────────────

export default function MeetingLeadCaptureSection({ registrationFields }: MeetingLeadCaptureSectionProps) {
  const { watch, setValue } = useFormContext();
  const firestore = useFirestore();
  const { activeWorkspaceId, activeOrganizationId, activeWorkspace } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const entityTerminology = activeWorkspace?.terminology?.singular || 'Contact';
  const createEntity = watch('createEntity');

  // ── Data Fetching (workspace-scoped) ──
  const tagsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'tags'), where('workspaceId', '==', activeWorkspaceId), orderBy('name', 'asc'));
  }, [firestore, activeWorkspaceId]);
  const { data: tags } = useCollection<any>(tagsQuery);

  const automationsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'automations'),
      where('workspaceIds', 'array-contains', activeWorkspaceId),
      orderBy('name', 'asc')
    );
  }, [firestore, activeWorkspaceId]);
  const { data: automations } = useCollection<any>(automationsQuery);

  // ── Derived data: field options for mapping dropdowns ──
  const fieldOptions = React.useMemo(() => {
    return registrationFields
      .map(f => ({ label: f.label, value: f.id }));
  }, [registrationFields]);

  const tagOptions = React.useMemo(() => {
    return (tags || []).map((t: any) => ({ label: t.name, value: t.id }));
  }, [tags]);

  const automationOptions = React.useMemo(() => {
    return (automations || []).map((a: any) => ({ label: a.name, value: a.id }));
  }, [automations]);

  // ── Entity Mapping state ──
  const entityMapping = watch('entityMapping') || {};
  const additionalMappings = entityMapping.additionalMappings || [];

  // ── Dialog states ──
  const [isCreateTagOpen, setIsCreateTagOpen] = React.useState(false);
  const [isCreateAutomationOpen, setIsCreateAutomationOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // ── Handlers ──
  const handleAddMapping = React.useCallback(() => {
    const current = additionalMappings;
    setValue('entityMapping.additionalMappings', [
      ...current,
      { sourceField: '', targetProperty: '' },
    ]);
  }, [additionalMappings, setValue]);

  const handleRemoveMapping = React.useCallback((index: number) => {
    const current = [...additionalMappings];
    current.splice(index, 1);
    setValue('entityMapping.additionalMappings', current);
  }, [additionalMappings, setValue]);

  const handleUpdateMapping = React.useCallback((index: number, key: string, value: string) => {
    const current = [...additionalMappings];
    current[index] = { ...current[index], [key]: value };
    setValue('entityMapping.additionalMappings', current);
  }, [additionalMappings, setValue]);

  return (
    <div className="space-y-6">
      {/* ── Card 1: Entity Mapping ── */}
      <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
        <CardHeader className="bg-muted/30 border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-xl">
                <Database className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold tracking-tight">Lead Capture & CRM Integration</CardTitle>
                <CardDescription className="text-[10px] font-medium text-left">
                  Automatically create {entityTerminology.toLowerCase()} records from registrations.
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={createEntity ?? false}
              onCheckedChange={(checked) => setValue('createEntity', checked)}
            />
          </div>
        </CardHeader>

        {createEntity ? (
          <CardContent className="p-6 space-y-6 bg-background animate-in fade-in slide-in-from-top-2">
            {/* Identity Bridge */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <UserPlus className="h-3.5 w-3.5 text-primary" />
                <h4 className="text-xs font-bold tracking-tight">Identity Bridge</h4>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Map registration fields to {entityTerminology.toLowerCase()} identity.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold text-muted-foreground/60 flex items-center gap-1.5">
                    <User className="h-3 w-3" /> {entityTerminology} Name
                  </Label>
                  <Select
                    value={entityMapping.nameField || ''}
                    onValueChange={(v) => setValue('entityMapping.nameField', v)}
                  >
                    <SelectTrigger className="h-10 rounded-xl bg-muted/20 border-none text-xs font-bold">
                      <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {fieldOptions.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold text-muted-foreground/60 flex items-center gap-1.5">
                    <User className="h-3 w-3" /> Focal Person <span className="text-primary/50">(optional)</span>
                  </Label>
                  <Select
                    value={entityMapping.focalPersonField || ''}
                    onValueChange={(v) => setValue('entityMapping.focalPersonField', v)}
                  >
                    <SelectTrigger className="h-10 rounded-xl bg-muted/20 border-none text-xs font-bold">
                      <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="__none__"><span className="text-muted-foreground italic">None</span></SelectItem>
                      {fieldOptions.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator className="bg-border/50" />

            {/* Connectivity Path */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5 text-primary" />
                <h4 className="text-xs font-bold tracking-tight">Connectivity Path</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold text-muted-foreground/60 flex items-center gap-1.5">
                    <Mail className="h-3 w-3" /> Email Field
                  </Label>
                  <Select
                    value={entityMapping.emailField || ''}
                    onValueChange={(v) => setValue('entityMapping.emailField', v)}
                  >
                    <SelectTrigger className="h-10 rounded-xl bg-muted/20 border-none text-xs font-bold">
                      <SelectValue placeholder="Select email field..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="__none__"><span className="text-muted-foreground italic">None</span></SelectItem>
                      {fieldOptions.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold text-muted-foreground/60 flex items-center gap-1.5">
                    <Phone className="h-3 w-3" /> Phone Field
                  </Label>
                  <Select
                    value={entityMapping.phoneField || ''}
                    onValueChange={(v) => setValue('entityMapping.phoneField', v)}
                  >
                    <SelectTrigger className="h-10 rounded-xl bg-muted/20 border-none text-xs font-bold">
                      <SelectValue placeholder="Select phone field..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="__none__"><span className="text-muted-foreground italic">None</span></SelectItem>
                      {fieldOptions.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator className="bg-border/50" />

            {/* Custom Field Mapping */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-3.5 w-3.5 text-primary" />
                  <h4 className="text-xs font-bold tracking-tight">Custom Field Mapping</h4>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddMapping}
                  className="h-7 px-2 text-[10px] font-bold gap-1 rounded-lg"
                >
                  <Plus className="h-3 w-3" /> Add Row
                </Button>
              </div>

              {additionalMappings.length > 0 ? (
                <div className="space-y-2">
                  {additionalMappings.map((mapping: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-muted/20 rounded-xl border">
                      <Select
                        value={mapping.sourceField || ''}
                        onValueChange={(v) => handleUpdateMapping(index, 'sourceField', v)}
                      >
                        <SelectTrigger className="h-8 rounded-lg bg-card border text-[10px] font-bold flex-1">
                          <SelectValue placeholder="Registration field..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {fieldOptions.map((f) => (
                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />

                      <Input
                        value={mapping.targetProperty || ''}
                        onChange={(e) => handleUpdateMapping(index, 'targetProperty', e.target.value)}
                        placeholder="e.g. personData.grade"
                        className="h-8 rounded-lg text-[10px] font-bold bg-card border flex-1"
                      />

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMapping(index)}
                        className="h-7 w-7 p-0 shrink-0 text-destructive/60 hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground/50 italic py-2">
                  No custom mappings configured. Click &quot;Add Row&quot; to map additional fields.
                </p>
              )}
            </div>
          </CardContent>
        ) : (
          <CardContent className="p-8 flex flex-col items-center justify-center text-center opacity-40">
            <Database className="h-10 w-10 mb-3" />
            <p className="text-xs font-bold">CRM Integration Off</p>
            <p className="text-[10px] font-medium">Enable to auto-create {entityTerminology.toLowerCase()} records from registrations.</p>
          </CardContent>
        )}
      </Card>

      {/* ── Card 2: Tags & Automations (visible when createEntity ON) ── */}
      {createEntity && (
        <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <CardHeader className="bg-muted/30 border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-500/10 rounded-xl">
                <Zap className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold tracking-tight">Post-Capture Automations</CardTitle>
                <CardDescription className="text-[10px] font-medium text-left">
                  Tags and workflows applied to new {entityTerminology.toLowerCase()} records.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6 bg-background">
            {/* Auto-Apply Tags */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tags className="h-3.5 w-3.5 text-primary" />
                  <h4 className="text-xs font-bold tracking-tight">Auto-Apply Tags</h4>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreateTagOpen(true)}
                  className="h-7 px-2 text-[10px] font-bold gap-1 rounded-lg"
                >
                  <Plus className="h-3 w-3" /> New Tag
                </Button>
              </div>
              <MultiSelect
                options={tagOptions}
                value={watch('autoTags') || []}
                onChange={(val) => setValue('autoTags', val)}
                placeholder="Select tags to apply..."
                className="rounded-xl"
              />
              {(watch('autoTags') || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(watch('autoTags') || []).map((tagId: string) => {
                    const tag = tags?.find((t: any) => t.id === tagId);
                    return tag ? (
                      <Badge key={tagId} variant="secondary" className="text-[9px] font-bold rounded-full px-2.5 py-0.5">
                        {tag.name}
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            <Separator className="bg-border/50" />

            {/* Executive Workflows */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  <h4 className="text-xs font-bold tracking-tight">Executive Workflows</h4>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreateAutomationOpen(true)}
                  className="h-7 px-2 text-[10px] font-bold gap-1 rounded-lg"
                >
                  <Plus className="h-3 w-3" /> New Automation
                </Button>
              </div>
              <MultiSelect
                options={automationOptions}
                value={watch('autoAutomations') || []}
                onChange={(val) => setValue('autoAutomations', val)}
                placeholder="Select automations to trigger..."
                className="rounded-xl"
              />
              <p className="text-[10px] text-muted-foreground/60 italic">
                Automations run only for newly created {entityTerminology.toLowerCase()} records, not duplicates.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Create Tag Dialog ── */}
      <CreateTagDialog
        open={isCreateTagOpen}
        onOpenChange={setIsCreateTagOpen}
        workspaceId={activeWorkspaceId}
        organizationId={activeOrganizationId}
        userId={user?.uid || ''}
        isSubmitting={isSubmitting}
        setIsSubmitting={setIsSubmitting}
        toast={toast}
      />

      {/* ── Create Automation Dialog ── */}
      <CreateAutomationDialog
        open={isCreateAutomationOpen}
        onOpenChange={setIsCreateAutomationOpen}
        workspaceId={activeWorkspaceId}
        organizationId={activeOrganizationId}
        userId={user?.uid || ''}
        isSubmitting={isSubmitting}
        setIsSubmitting={setIsSubmitting}
        toast={toast}
      />
    </div>
  );
}

// ─── Sub-Components (hoisted per rerender-no-inline-components) ───

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  organizationId: string;
  userId: string;
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
  toast: ReturnType<typeof useToast>['toast'];
}

function CreateTagDialog({ open, onOpenChange, workspaceId, organizationId, userId, isSubmitting, setIsSubmitting, toast }: DialogProps) {
  const [newTagName, setNewTagName] = React.useState('');

  const handleCreate = async () => {
    if (!newTagName.trim()) return;
    setIsSubmitting(true);
    try {
      await createTagAction({
        name: newTagName.trim(),
        workspaceId,
        organizationId,
        category: 'general' as any,
        color: '#6366f1',
        userId,
      });
      toast({ title: 'Tag created', description: `"${newTagName}" is now available.` });
      setNewTagName('');
      onOpenChange(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Create Tag</DialogTitle>
          <DialogDescription className="text-xs">Quick-create a tag to apply to leads from this meeting.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <Label className="text-[10px] font-semibold text-muted-foreground/60">Tag Name</Label>
          <Input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="e.g. Q3 Webinar Lead"
            className="h-11 rounded-xl"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); }}}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
          <Button type="button" onClick={handleCreate} disabled={isSubmitting || !newTagName.trim()} className="rounded-xl gap-1">
            <Tags className="h-3.5 w-3.5" /> Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateAutomationDialog({ open, onOpenChange, workspaceId, organizationId, userId, isSubmitting, setIsSubmitting, toast }: DialogProps) {
  const [newAutoName, setNewAutoName] = React.useState('');

  const handleCreate = async () => {
    if (!newAutoName.trim()) return;
    setIsSubmitting(true);
    try {
      await saveAutomationAction(null, {
        name: newAutoName.trim(),
        workspaceIds: [workspaceId],
        organizationId,
        status: 'draft',
        isActive: false,
        trigger: 'manual',
        actions: [],
      } as any, userId);
      toast({ title: 'Automation created', description: `"${newAutoName}" saved as draft.` });
      setNewAutoName('');
      onOpenChange(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Create Automation</DialogTitle>
          <DialogDescription className="text-xs">Quick-create an automation workflow for meeting leads.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <Label className="text-[10px] font-semibold text-muted-foreground/60">Automation Name</Label>
          <Input
            value={newAutoName}
            onChange={(e) => setNewAutoName(e.target.value)}
            placeholder="e.g. Welcome Sequence"
            className="h-11 rounded-xl"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); }}}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
          <Button type="button" onClick={handleCreate} disabled={isSubmitting || !newAutoName.trim()} className="rounded-xl gap-1">
            <Zap className="h-3.5 w-3.5" /> Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
