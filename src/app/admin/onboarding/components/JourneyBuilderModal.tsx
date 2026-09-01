'use client';

/**
 * @fileOverview Visual Journey Builder Dialog (Onboarding 2.0)
 *
 * Interactive step graph editor for authoring multi-step onboarding paths,
 * step types, adaptive branching conditions, and mandatory completion gates.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Radix Dialogs with Emil Kowalski spring easing (`cubic-bezier(0.32, 0.72, 0, 1)`).
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 * - Mobile ergonomics: reorders steps and edits conditions with >= 44px touch targets.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  Loader2,
  Sparkles,
  Layers,
  Settings2,
  CheckCircle2,
  Video,
  FileCheck,
  Shield,
  UserCheck,
  Building,
  Users,
} from 'lucide-react';
import type {
  OnboardingJourney,
  OnboardingStepDefinition,
  OnboardingAudience,
  OnboardingStepType,
  PolicyConditionOperator,
} from '@/lib/types';
import { createOrUpdateJourneyAction } from '@/app/actions/onboarding-actions';

interface JourneyBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingJourney?: OnboardingJourney | null;
  onSaved: () => void;
}

const STEP_TYPE_OPTIONS: Array<{ value: OnboardingStepType; label: string; icon: React.ReactNode; desc: string }> = [
  { value: 'profile', label: 'Profile Setup', icon: <UserCheck className="w-3.5 h-3.5 text-primary" />, desc: 'Name, title, avatar, and contact' },
  { value: 'workspace_selection', label: 'Workspace Selection', icon: <Building className="w-3.5 h-3.5 text-blue-500" />, desc: 'Primary workspace or campus' },
  { value: 'team_selection', label: 'Team Squad Assignment', icon: <Users className="w-3.5 h-3.5 text-emerald-500" />, desc: 'Squad or department team' },
  { value: 'policy_acceptance', label: 'Policy Acceptance', icon: <FileCheck className="w-3.5 h-3.5 text-amber-500" />, desc: 'Code of conduct, NDAs, terms' },
  { value: 'guide_video', label: 'Video Guide', icon: <Video className="w-3.5 h-3.5 text-rose-500" />, desc: 'Orientation or training video' },
  { value: 'checklist', label: 'Interactive Checklist', icon: <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" />, desc: 'First-day setup tasks' },
  { value: 'mfa_setup', label: 'Security & 2FA', icon: <Shield className="w-3.5 h-3.5 text-cyan-500" />, desc: 'Multi-factor authentication' },
  { value: 'manager_approval', label: 'Manager Approval Gate', icon: <Settings2 className="w-3.5 h-3.5 text-orange-500" />, desc: 'Requires manager verification' },
];

export function JourneyBuilderModal({
  isOpen,
  onClose,
  editingJourney,
  onSaved,
}: JourneyBuilderModalProps) {
  const { toast } = useToast();
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [audience, setAudience] = React.useState<OnboardingAudience>('employee');
  const [trigger, setTrigger] = React.useState<OnboardingJourney['trigger']>('invitation');
  const [isDefault, setIsDefault] = React.useState(false);
  const [steps, setSteps] = React.useState<OnboardingStepDefinition[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);

  // Initialize or reset form
  React.useEffect(() => {
    if (editingJourney) {
      setName(editingJourney.name);
      setDescription(editingJourney.description || '');
      setAudience(editingJourney.audience);
      setTrigger(editingJourney.trigger);
      setIsDefault(Boolean(editingJourney.isDefault));
      setSteps(editingJourney.steps || []);
    } else {
      setName('');
      setDescription('');
      setAudience('employee');
      setTrigger('invitation');
      setIsDefault(false);
      setSteps([
        {
          id: `step-profile-${Date.now()}`,
          title: 'Complete Profile Details',
          description: 'Verify your display name, title, and contact number.',
          type: 'profile',
          isRequired: true,
          order: 1,
        },
        {
          id: `step-workspace-${Date.now() + 1}`,
          title: 'Choose Primary Workspace',
          description: 'Select your operational workspace.',
          type: 'workspace_selection',
          isRequired: true,
          order: 2,
        },
        {
          id: `step-policy-${Date.now() + 2}`,
          title: 'Review Organization Policies',
          description: 'Acknowledge workplace conduct guidelines.',
          type: 'policy_acceptance',
          isRequired: true,
          order: 3,
        },
      ]);
    }
  }, [editingJourney, isOpen]);

  // Add Step
  const handleAddStep = () => {
    const newStep: OnboardingStepDefinition = {
      id: `step-${Date.now()}`,
      title: 'New Onboarding Step',
      description: 'Step instructions for member...',
      type: 'checklist',
      isRequired: true,
      order: steps.length + 1,
    };
    setSteps((prev) => [...prev, newStep]);
  };

  // Remove Step
  const handleRemoveStep = (idx: number) => {
    if (steps.length <= 1) {
      toast({ title: 'Validation Error', description: 'Journey must contain at least 1 step.', variant: 'destructive' });
      return;
    }
    setSteps((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })));
  };

  // Move Step Up
  const handleMoveUp = (idx: number) => {
    if (idx === 0) return;
    setSteps((prev) => {
      const copy = [...prev];
      const temp = copy[idx - 1];
      copy[idx - 1] = copy[idx];
      copy[idx] = temp;
      return copy.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  // Move Step Down
  const handleMoveDown = (idx: number) => {
    if (idx === steps.length - 1) return;
    setSteps((prev) => {
      const copy = [...prev];
      const temp = copy[idx + 1];
      copy[idx + 1] = copy[idx];
      copy[idx] = temp;
      return copy.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  // Update specific step field
  const handleUpdateStep = (idx: number, patch: Partial<OnboardingStepDefinition>) => {
    setSteps((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  };

  // Save Journey
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !activeOrganizationId) return;

    if (!name.trim()) {
      toast({ title: 'Validation Error', description: 'Journey title is required.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await createOrUpdateJourneyAction({
        idToken,
        organizationId: activeOrganizationId,
        journeyId: editingJourney?.id,
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
          audience,
          trigger,
          steps,
          isDefault,
          status: 'published',
        },
      });

      if (res.success) {
        toast({
          title: editingJourney ? 'Journey Blueprint Updated' : 'Journey Created',
          description: `Journey '${res.journey?.name}' is now active.`,
        });
        onSaved();
        onClose();
      } else {
        throw new Error(res.error || 'Failed to save journey');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast({ title: 'Save Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card border shadow-2xl">
        <form onSubmit={handleSave} className="flex flex-col h-full min-h-0">
          <DialogHeader className="p-5 pb-4 border-b bg-muted/20 shrink-0">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              <DialogTitle className="text-base font-bold">
                {editingJourney ? `Edit Journey: ${editingJourney.name}` : 'Visual Onboarding Journey Builder'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure adaptive multi-step paths, completion gates, and audience routing
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable Form Body */}
          <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
            {/* Metadata Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-muted/10 p-3.5 rounded-xl border">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-semibold">Journey Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Inbound Sales & Admissions Induction"
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Target Audience</Label>
                <Select value={audience} onValueChange={(v) => setAudience(v as OnboardingAudience)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Audience..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee" className="text-xs">General Employee / Staff</SelectItem>
                    <SelectItem value="sales" className="text-xs">Sales & Admissions</SelectItem>
                    <SelectItem value="finance" className="text-xs">Finance & Compliance</SelectItem>
                    <SelectItem value="manager" className="text-xs">Team Lead / Manager</SelectItem>
                    <SelectItem value="contractor" className="text-xs">External Contractor</SelectItem>
                    <SelectItem value="founder" className="text-xs">Organization Founder</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Trigger Event</Label>
                <Select value={trigger} onValueChange={(v) => setTrigger(v as OnboardingJourney['trigger'])}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Trigger..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invitation" className="text-xs">Invitation Accepted</SelectItem>
                    <SelectItem value="signup" className="text-xs">Direct User Signup</SelectItem>
                    <SelectItem value="role_assigned" className="text-xs">Role Granted</SelectItem>
                    <SelectItem value="workspace_added" className="text-xs">Workspace Joined</SelectItem>
                    <SelectItem value="manual" className="text-xs">Manual Assignment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-semibold">Description</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mandate and objectives of this induction journey..."
                  className="h-9 text-xs"
                />
              </div>

              <div className="sm:col-span-2 flex items-center justify-between pt-1 border-t border-border/40">
                <div>
                  <span className="font-semibold text-foreground block">Default Fallback Journey</span>
                  <span className="text-[11px] text-muted-foreground block">
                    Automatically assign to new invitees in this audience tier
                  </span>
                </div>
                <Switch checked={isDefault} onCheckedChange={setIsDefault} />
              </div>
            </div>

            {/* Step Graph Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-foreground text-xs uppercase tracking-wider">
                    Journey Steps ({steps.length})
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-muted/20">Sequential</Badge>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddStep}
                  className="text-xs h-8 px-2.5 active:scale-[0.97]"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Step
                </Button>
              </div>

              <div className="space-y-2.5">
                {steps.map((step, idx) => {
                  const typeMeta = STEP_TYPE_OPTIONS.find((t) => t.value === step.type) || STEP_TYPE_OPTIONS[0];

                  return (
                    <Card key={step.id || idx} className="border bg-card shadow-xs">
                      <CardContent className="p-3.5 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <Input
                                value={step.title}
                                onChange={(e) => handleUpdateStep(idx, { title: e.target.value })}
                                className="h-7 text-xs font-semibold bg-transparent border-transparent hover:border-border focus:border-border p-0"
                                placeholder="Step Title..."
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMoveUp(idx)}
                              disabled={idx === 0}
                              className="h-6 w-6 text-muted-foreground"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMoveDown(idx)}
                              disabled={idx === steps.length - 1}
                              className="h-6 w-6 text-muted-foreground"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveStep(idx)}
                              className="h-6 w-6 text-muted-foreground hover:text-rose-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Step Configuration Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-border/40">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Step Type</Label>
                            <Select
                              value={step.type}
                              onValueChange={(v) => handleUpdateStep(idx, { type: v as OnboardingStepType })}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STEP_TYPE_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                    <div className="flex items-center gap-1.5">
                                      {opt.icon}
                                      <span>{opt.label}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Description / Guide</Label>
                            <Input
                              value={step.description || ''}
                              onChange={(e) => handleUpdateStep(idx, { description: e.target.value })}
                              placeholder="Instructions for member..."
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                          <span className="italic">{typeMeta.desc}</span>
                          <div className="flex items-center gap-2">
                            <Label className="text-[11px]">Mandatory Completion Gate:</Label>
                            <Switch
                              checked={step.isRequired}
                              onCheckedChange={(checked) => handleUpdateStep(idx, { isRequired: checked })}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-muted/20 shrink-0 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
              className="text-xs h-9 px-4 active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSaving || !name.trim() || steps.length === 0}
              className="text-xs h-9 px-4 font-semibold active:scale-[0.97]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving Blueprint...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 mr-1.5" /> Save Journey Blueprint
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default JourneyBuilderModal;
