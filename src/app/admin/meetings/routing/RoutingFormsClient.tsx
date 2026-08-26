'use client';

import * as React from 'react';
import Link from 'next/link';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { MeetingsNavigation } from '../components/MeetingsNavigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TagSelector } from '@/components/tags/TagSelector';
import {
  GitFork,
  Plus,
  Trash2,
  Copy,
  CopyCheck,
  ExternalLink,
  Edit2,
  RefreshCw,
  HelpCircle,
  ArrowRight,
  Split,
  Tag,
} from 'lucide-react';
import {
  getRoutingFormsAction,
  createOrUpdateRoutingFormAction,
  deleteRoutingFormAction,
} from '@/app/actions/routing-form-actions';
import { getEventTypesAction } from '@/app/actions/event-type-actions';
import type {
  RoutingForm,
  RoutingRule,
  RoutingCondition,
  RoutingDestination,
  RoutingConditionOperator,
} from '@/lib/meetings/types/routing';
import type { BookingQuestion, EventType } from '@/lib/types';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export default function RoutingFormsClient() {
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [forms, setForms] = React.useState<RoutingForm[]>([]);
  const [eventTypes, setEventTypes] = React.useState<EventType[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [copiedSlug, setCopiedSlug] = React.useState<string | null>(null);

  // Editor Dialog State
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [editingForm, setEditingForm] = React.useState<Partial<RoutingForm> | null>(null);

  const fetchFormsAndEventTypes = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const [formsRes, etRes] = await Promise.all([
        getRoutingFormsAction(activeWorkspaceId),
        getEventTypesAction(activeWorkspaceId),
      ]);

      if (formsRes.success && formsRes.forms) {
        setForms(formsRes.forms);
      }
      if (etRes.success && etRes.eventTypes) {
        setEventTypes(etRes.eventTypes);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error loading routing forms',
        description: getErrorMessage(err),
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, toast]);

  React.useEffect(() => {
    fetchFormsAndEventTypes();
  }, [fetchFormsAndEventTypes]);

  const handleCopyLink = (slug: string) => {
    const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://smartsapp.com';
    const link = `${appUrl}/book/route/${slug}`;
    navigator.clipboard.writeText(link);
    setCopiedSlug(slug);
    toast({ title: 'Routing link copied to clipboard' });
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const handleOpenCreate = () => {
    setEditingForm({
      name: '',
      slug: '',
      headline: 'Find the right session for you',
      subheadline: 'Answer a few quick questions to match with the best expert.',
      fields: [
        {
          id: 'q_role',
          label: 'What is your primary role?',
          type: 'dropdown',
          required: true,
          options: ['School Principal / Administrator', 'Teacher / Educator', 'Parent / Guardian', 'Other'],
        },
        {
          id: 'q_size',
          label: 'How many students/members are in your organization?',
          type: 'text',
          required: true,
          placeholder: 'e.g. 500',
        },
      ],
      rules: [],
      fallbackDestination: {
        type: 'event_type',
        eventTypeId: eventTypes[0]?.id || '',
        eventTypeName: eventTypes[0]?.name || 'Standard Consultation',
      },
      autoTagIds: [],
    });
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (form: RoutingForm) => {
    setEditingForm(JSON.parse(JSON.stringify(form)));
    setIsEditorOpen(true);
  };

  const handleDelete = async (form: RoutingForm) => {
    if (!activeWorkspaceId) return;
    const ok = await confirm({
      title: 'Delete Routing Form?',
      description: `Are you sure you want to delete "${form.name}"? Existing routing links will stop functioning.`,
      confirmText: 'Delete Form',
      variant: 'destructive',
    });

    if (!ok) return;

    try {
      const res = await deleteRoutingFormAction(form.id, activeWorkspaceId);
      if (res.success) {
        setForms(prev => prev.filter(f => f.id !== form.id));
        toast({ title: 'Routing Form Deleted' });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: getErrorMessage(err),
      });
    }
  };

  const handleSaveForm = async () => {
    if (!activeWorkspaceId || !editingForm) return;
    if (!editingForm.name?.trim()) {
      toast({ variant: 'destructive', title: 'Name required', description: 'Please provide a form name.' });
      return;
    }
    if (!editingForm.slug?.trim()) {
      toast({ variant: 'destructive', title: 'Slug required', description: 'Please provide a public slug.' });
      return;
    }

    setIsSaving(true);
    try {
      const payload: Partial<RoutingForm> & { workspaceId: string; name: string; slug: string } = {
        ...editingForm,
        workspaceId: activeWorkspaceId,
        organizationId: activeOrganizationId,
        name: editingForm.name.trim(),
        slug: editingForm.slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
      };

      const res = await createOrUpdateRoutingFormAction(payload);
      if (res.success) {
        toast({ title: editingForm.id ? 'Routing Form Updated' : 'Routing Form Created' });
        setIsEditorOpen(false);
        fetchFormsAndEventTypes();
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: getErrorMessage(err),
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Helper methods for editing questions & rules
  const handleAddQuestion = () => {
    if (!editingForm) return;
    const newQ: BookingQuestion = {
      id: `q_${Date.now()}`,
      label: 'New Question',
      type: 'text',
      required: true,
      options: [],
    };
    setEditingForm({
      ...editingForm,
      fields: [...(editingForm.fields || []), newQ],
    });
  };

  const handleRemoveQuestion = (idx: number) => {
    if (!editingForm) return;
    const updated = [...(editingForm.fields || [])];
    updated.splice(idx, 1);
    setEditingForm({ ...editingForm, fields: updated });
  };

  const handleAddRule = () => {
    if (!editingForm) return;
    const firstField = editingForm.fields?.[0];
    const newRule: RoutingRule = {
      id: `r_${Date.now()}`,
      name: `Rule ${(editingForm.rules?.length || 0) + 1}`,
      conditionLogic: 'and',
      conditions: firstField
        ? [{ id: `c_${Date.now()}`, fieldId: firstField.id, operator: 'equals', value: '' }]
        : [],
      destination: {
        type: 'event_type',
        eventTypeId: eventTypes[0]?.id || '',
        eventTypeName: eventTypes[0]?.name || '',
      },
      autoTagIds: [],
    };
    setEditingForm({
      ...editingForm,
      rules: [...(editingForm.rules || []), newRule],
    });
  };

  const handleRemoveRule = (idx: number) => {
    if (!editingForm) return;
    const updated = [...(editingForm.rules || [])];
    updated.splice(idx, 1);
    setEditingForm({ ...editingForm, rules: updated });
  };

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Smart Routing Forms
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Qualify incoming leads and dynamically route prospects to the optimal event type and team host.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleOpenCreate}
            className="rounded-xl min-h-[44px] gap-2 shadow-sm active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
            Create Routing Form
          </Button>
        </div>
      </div>

      {/* Roster of Routing Forms */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      ) : forms.length === 0 ? (
        <Card className="rounded-2xl border-dashed p-12 text-center">
          <GitFork className="h-12 w-12 mx-auto text-muted-foreground opacity-30 mb-3" />
          <h3 className="text-base font-semibold text-foreground">No routing forms yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
            Create intake question workflows to qualify prospects and route them directly to the right calendar.
          </p>
          <Button onClick={handleOpenCreate} className="rounded-xl gap-2 active:scale-[0.97]">
            <Plus className="h-4 w-4" />
            Create Your First Routing Form
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {forms.map(form => (
            <Card
              key={form.id}
              className="rounded-2xl border shadow-sm ring-1 ring-border/50 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-semibold line-clamp-1">{form.name}</CardTitle>
                    <p className="text-xs font-mono text-muted-foreground">/book/route/{form.slug}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-bold uppercase shrink-0">
                    {form.rules?.length || 0} Rules
                  </Badge>
                </div>
                {form.description && (
                  <CardDescription className="text-xs line-clamp-2 mt-2">
                    {form.description}
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="pt-0 space-y-4">
                <div className="p-3 rounded-xl bg-muted/40 text-xs flex items-center justify-between">
                  <span className="text-muted-foreground">Submissions</span>
                  <span className="font-bold text-foreground">{form.totalSubmissions || 0}</span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t text-xs">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyLink(form.slug)}
                      className="rounded-lg h-8 gap-1.5 text-xs active:scale-[0.97]"
                    >
                      {copiedSlug === form.slug ? (
                        <CopyCheck className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      Copy Link
                    </Button>
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                      <Link href={`/book/route/${form.slug}`} target="_blank">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEdit(form)}
                      className="h-8 w-8 rounded-lg"
                    >
                      <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(form)}
                      className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Visual Routing Form Builder Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {editingForm?.id ? 'Edit Routing Form' : 'Create Routing Form'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Define qualifying questions, conditional branches, and automated CRM tags.
            </DialogDescription>
          </DialogHeader>

          {editingForm && (
            <div className="space-y-6 py-4">
              {/* Basic Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="form-name" className="text-xs font-semibold">
                    Form Name *
                  </Label>
                  <Input
                    id="form-name"
                    value={editingForm.name || ''}
                    onChange={e => setEditingForm({ ...editingForm, name: e.target.value })}
                    placeholder="e.g. Sales Intake Qualification"
                    className="rounded-xl min-h-[44px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="form-slug" className="text-xs font-semibold">
                    Public Slug (/book/route/:slug) *
                  </Label>
                  <Input
                    id="form-slug"
                    value={editingForm.slug || ''}
                    onChange={e => setEditingForm({ ...editingForm, slug: e.target.value })}
                    placeholder="e.g. sales-qualification"
                    className="rounded-xl min-h-[44px]"
                  />
                </div>
              </div>

              {/* Questions Builder */}
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Intake Questions</h4>
                    <p className="text-xs text-muted-foreground">Questions presented to the prospect.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddQuestion}
                    className="rounded-xl text-xs gap-1.5 h-8"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Question
                  </Button>
                </div>

                <div className="space-y-3">
                  {(editingForm.fields || []).map((field, idx) => (
                    <div key={field.id} className="p-3.5 rounded-xl border bg-muted/20 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <Input
                          value={field.label}
                          onChange={e => {
                            const updated = [...(editingForm.fields || [])];
                            updated[idx].label = e.target.value;
                            setEditingForm({ ...editingForm, fields: updated });
                          }}
                          placeholder="Question Label"
                          className="font-medium text-xs rounded-lg min-h-[38px]"
                        />
                        <Select
                          value={field.type}
                          onValueChange={val => {
                            const updated = [...(editingForm.fields || [])];
                            updated[idx].type = val as BookingQuestion['type'];
                            setEditingForm({ ...editingForm, fields: updated });
                          }}
                        >
                          <SelectTrigger className="w-36 text-xs rounded-lg h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text / Number</SelectItem>
                            <SelectItem value="dropdown">Dropdown Choice</SelectItem>
                            <SelectItem value="radio">Radio Buttons</SelectItem>
                            <SelectItem value="textarea">Long Text</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveQuestion(idx)}
                          className="h-8 w-8 text-rose-500 shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {(field.type === 'dropdown' || field.type === 'radio') && (
                        <div className="space-y-1.5 pl-2">
                          <Label className="text-[10px] text-muted-foreground uppercase font-bold">
                            Options (comma-separated)
                          </Label>
                          <Input
                            value={field.options?.join(', ') || ''}
                            onChange={e => {
                              const updated = [...(editingForm.fields || [])];
                              updated[idx].options = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                              setEditingForm({ ...editingForm, fields: updated });
                            }}
                            placeholder="Option 1, Option 2, Option 3"
                            className="text-xs rounded-lg h-8"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Conditional Routing Rules */}
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Routing Logic & Branches</h4>
                    <p className="text-xs text-muted-foreground">Evaluated top-to-bottom on submission.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddRule}
                    className="rounded-xl text-xs gap-1.5 h-8"
                  >
                    <Split className="h-3.5 w-3.5" />
                    Add Branch Rule
                  </Button>
                </div>

                <div className="space-y-4">
                  {(editingForm.rules || []).map((rule, rIdx) => (
                    <div key={rule.id} className="p-4 rounded-xl border bg-card space-y-3">
                      <div className="flex items-center justify-between">
                        <Input
                          value={rule.name}
                          onChange={e => {
                            const updated = [...(editingForm.rules || [])];
                            updated[rIdx].name = e.target.value;
                            setEditingForm({ ...editingForm, rules: updated });
                          }}
                          placeholder="Rule Name (e.g. Enterprise Match)"
                          className="font-semibold text-xs rounded-lg h-8 w-60"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveRule(rIdx)}
                          className="h-8 w-8 text-rose-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Rule Conditions */}
                      <div className="space-y-2 pl-2">
                        {rule.conditions.map((cond, cIdx) => (
                          <div key={cond.id} className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-muted-foreground">{cIdx === 0 ? 'IF' : 'AND'}</span>
                            <Select
                              value={cond.fieldId}
                              onValueChange={val => {
                                const updated = [...(editingForm.rules || [])];
                                updated[rIdx].conditions[cIdx].fieldId = val;
                                setEditingForm({ ...editingForm, rules: updated });
                              }}
                            >
                              <SelectTrigger className="w-48 text-xs h-8">
                                <SelectValue placeholder="Select Question" />
                              </SelectTrigger>
                              <SelectContent>
                                {(editingForm.fields || []).map(f => (
                                  <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Select
                              value={cond.operator}
                              onValueChange={val => {
                                const updated = [...(editingForm.rules || [])];
                                updated[rIdx].conditions[cIdx].operator = val as RoutingConditionOperator;
                                setEditingForm({ ...editingForm, rules: updated });
                              }}
                            >
                              <SelectTrigger className="w-32 text-xs h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="equals">equals</SelectItem>
                                <SelectItem value="contains">contains</SelectItem>
                                <SelectItem value="greater_than">greater than</SelectItem>
                                <SelectItem value="less_than">less than</SelectItem>
                              </SelectContent>
                            </Select>

                            <Input
                              value={String(cond.value || '')}
                              onChange={e => {
                                const updated = [...(editingForm.rules || [])];
                                updated[rIdx].conditions[cIdx].value = e.target.value;
                                setEditingForm({ ...editingForm, rules: updated });
                              }}
                              placeholder="Target Value"
                              className="text-xs h-8 flex-1"
                            />
                          </div>
                        ))}
                      </div>

                      {/* Rule Destination */}
                      <div className="pt-2 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-semibold text-foreground">Redirect to:</span>
                          <Select
                            value={rule.destination.eventTypeId || ''}
                            onValueChange={val => {
                              const et = eventTypes.find(t => t.id === val);
                              const updated = [...(editingForm.rules || [])];
                              updated[rIdx].destination = {
                                type: 'event_type',
                                eventTypeId: val,
                                eventTypeName: et?.name || '',
                                eventTypeSlug: et?.slug || '',
                              };
                              setEditingForm({ ...editingForm, rules: updated });
                            }}
                          >
                            <SelectTrigger className="w-56 text-xs h-8">
                              <SelectValue placeholder="Select Event Type" />
                            </SelectTrigger>
                            <SelectContent>
                              {eventTypes.map(et => (
                                <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* TagSelector draft mode for rule */}
                        <div className="w-full sm:w-64">
                          <TagSelector
                            currentTagIds={rule.autoTagIds || []}
                            onTagsChange={tagIds => {
                              const updated = [...(editingForm.rules || [])];
                              updated[rIdx].autoTagIds = tagIds;
                              setEditingForm({ ...editingForm, rules: updated });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fallback Destination */}
              <div className="space-y-2 pt-4 border-t">
                <Label className="text-xs font-semibold">Fallback Event Type (if no rules match)</Label>
                <Select
                  value={editingForm.fallbackDestination?.eventTypeId || ''}
                  onValueChange={val => {
                    const et = eventTypes.find(t => t.id === val);
                    setEditingForm({
                      ...editingForm,
                      fallbackDestination: {
                        type: 'event_type',
                        eventTypeId: val,
                        eventTypeName: et?.name || '',
                        eventTypeSlug: et?.slug || '',
                      },
                    });
                  }}
                >
                  <SelectTrigger className="text-xs rounded-xl min-h-[44px]">
                    <SelectValue placeholder="Select Fallback Event Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypes.map(et => (
                      <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsEditorOpen(false)}
              disabled={isSaving}
              className="rounded-xl min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveForm}
              disabled={isSaving}
              className="rounded-xl min-h-[44px] px-6 active:scale-[0.97]"
            >
              {isSaving ? 'Saving...' : 'Save Routing Form'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
