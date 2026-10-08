'use client';

/**
 * @fileOverview Standardized Evaluation Incident Management & Emergency Dead-Man Modal (Phase 15 Milestone 5)
 *
 * Implements theme.md Section 8 (Standardized Modal & Dialog System Architecture):
 * - Surface & Geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
 * - Demarcated Header: `<DialogHeader demarcated>` with `min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4`
 * - Single-Circle Info Tooltip: `<CardInfoTooltip text="..." />` alongside title at `z-[10050]`
 * - Zero Raw Descriptions: `<DialogDescription className="sr-only">`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5`
 * - Tactile mechanical feedback: `rounded-xl active:scale-[0.97]` with `min-h-[44px]` touch targets
 *
 * Rules Enforced:
 * - Rule 4: Strict Typing Protocol (Zero `any` or `any[]`).
 * - Rule 7: Mobile-first responsive touch targets >= 44px, tactile feedback.
 * - Rule 8 & 47: Anti-IDOR multi-tenant validation.
 * - Rule 10: Inline Architectural Documentation.
 * - Rule 17: Non-Delegable Human Gate (`actor.type === 'user'`).
 * - Rule 60: Emergency Dead-Man Switch Evaluation (`agent_execution_paused`, `model_routing_paused`, `dynamic_discovery_paused`).
 * - Rule 61: Mandatory Operator Justification (>= 5 chars) with live character counter.
 * - Rule 63: Incident Management & Root Cause Tracking.
 * - `.agents/AGENTS.md`: Actionable toast navigation with relative paths.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ShieldAlert,
  AlertTriangle,
  Radio,
  Power,
  Cpu,
  Route,
  Compass,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  INCIDENT_SEVERITIES,
  type IncidentSeverity,
  type EvaluationIncidentTicket,
} from '@/platform/evaluation/ui/evaluation-ui-types';
import {
  createIncidentTicketAction,
  toggleEmergencyDeadManAction,
} from '@/app/actions/evaluation-ui-actions';

export interface IncidentManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  deadManSwitches: Record<string, boolean>;
  onIncidentCreated?: (incident: EvaluationIncidentTicket) => void;
  onSwitchToggled?: (switchName: string, state: boolean) => void;
  createAction?: typeof createIncidentTicketAction;
  toggleAction?: typeof toggleEmergencyDeadManAction;
}

interface SwitchInfo {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const EMERGENCY_SWITCHES: readonly SwitchInfo[] = [
  {
    id: 'agent_execution_paused',
    label: 'Master Agent Execution Freeze',
    description: 'Instant platform-wide halt on all autonomous agent step executions.',
    icon: Power,
  },
  {
    id: 'model_routing_paused',
    label: 'Dynamic Model Routing Freeze',
    description: 'Forces all LLM requests to Tier 1 default baseline models without speculative routing.',
    icon: Route,
  },
  {
    id: 'dynamic_discovery_paused',
    label: 'Progressive Discovery Fallback',
    description: 'Bypasses progressive capability stubbing; falls back to static hardcoded schemas.',
    icon: Compass,
  },
] as const;

export function IncidentManagementModal({
  open,
  onOpenChange,
  organizationId,
  deadManSwitches,
  onIncidentCreated,
  onSwitchToggled,
  createAction = createIncidentTicketAction,
  toggleAction = toggleEmergencyDeadManAction,
}: IncidentManagementModalProps): React.JSX.Element {
  const [activeTab, setActiveTab] = React.useState<'switches' | 'ticket'>('switches');

  // Kill Switch State
  const [selectedSwitch, setSelectedSwitch] = React.useState<string | null>(null);
  const [switchJustification, setSwitchJustification] = React.useState<string>('');
  const [isToggling, setIsToggling] = React.useState<boolean>(false);

  // Ticket Form State
  const [title, setTitle] = React.useState<string>('');
  const [severity, setSeverity] = React.useState<IncidentSeverity>('P2_MEDIUM');
  const [personaId, setPersonaId] = React.useState<string>('');
  const [capabilityId, setCapabilityId] = React.useState<string>('');
  const [ticketJustification, setTicketJustification] = React.useState<string>('');
  const [isSubmittingTicket, setIsSubmittingTicket] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (open) {
      setSelectedSwitch(null);
      setSwitchJustification('');
      setTitle('');
      setSeverity('P2_MEDIUM');
      setPersonaId('');
      setCapabilityId('');
      setTicketJustification('');
      setIsToggling(false);
      setIsSubmittingTicket(false);
    }
  }, [open]);

  const isSwitchJustificationValid = switchJustification.trim().length >= 5;
  const isTicketValid = title.trim().length > 0 && ticketJustification.trim().length >= 5;

  const handleToggleSwitch = async (): Promise<void> => {
    if (!selectedSwitch || !isSwitchJustificationValid || isToggling) return;

    try {
      setIsToggling(true);
      const currentActive = deadManSwitches[selectedSwitch] ?? false;
      const targetState = !currentActive;

      const res = await toggleAction({
        organizationId,
        switchName: selectedSwitch,
        state: targetState,
        justification: switchJustification.trim(),
      });

      if (!res.success) {
        toast({
          title: 'Switch Toggle Failed',
          description: res.error?.message || 'Could not toggle emergency kill switch.',
          variant: 'destructive',
          duration: 10000,
          actionConfig: {
            path: '/admin/intelligence/evaluation',
            label: 'View Evaluation Center',
          },
        });
        return;
      }

      toast({
        title: targetState ? 'Kill Switch Activated' : 'Kill Switch Deactivated',
        description: `Switch '${selectedSwitch}' is now ${targetState ? 'ACTIVE (Paused)' : 'INACTIVE (Running)'}.`,
        duration: 8000,
        actionConfig: {
          path: '/admin/intelligence/evaluation',
          label: 'View Evaluation Center',
        },
      });

      if (onSwitchToggled) {
        onSwitchToggled(selectedSwitch, targetState);
      }
      setSelectedSwitch(null);
      setSwitchJustification('');
    } catch (err) {
      toast({
        title: 'Unexpected Error',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
        duration: 10000,
        actionConfig: {
          path: '/admin/intelligence/evaluation',
          label: 'View Evaluation Center',
        },
      });
    } finally {
      setIsToggling(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!isTicketValid || isSubmittingTicket) return;

    try {
      setIsSubmittingTicket(true);
      const res = await createAction({
        organizationId,
        title: title.trim(),
        severity,
        personaId: personaId.trim() || undefined,
        capabilityId: capabilityId.trim() || undefined,
        justification: ticketJustification.trim(),
      });

      if (!res.success || !res.data) {
        toast({
          title: 'Ticket Creation Failed',
          description: res.error?.message || 'Could not record incident ticket.',
          variant: 'destructive',
          duration: 10000,
          actionConfig: {
            path: '/admin/intelligence/evaluation',
            label: 'View Evaluation Center',
          },
        });
        return;
      }

      toast({
        title: 'Incident Ticket Recorded',
        description: `Incident #${res.data.id} filed with severity ${res.data.severity}.`,
        duration: 8000,
        actionConfig: {
          path: '/admin/intelligence/evaluation',
          label: 'View Evaluation Center',
        },
      });

      if (onIncidentCreated) {
        onIncidentCreated(res.data);
      }
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Unexpected Error',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
        duration: 10000,
        actionConfig: {
          path: '/admin/intelligence/evaluation',
          label: 'View Evaluation Center',
        },
      });
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-2xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl"
      >
        {/* DEMARCATED HEADER (theme.md §8) */}
        <DialogHeader demarcated>
          <div className="flex flex-row items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4 text-destructive" />
            </div>
            <div className="flex flex-col text-left truncate">
              <DialogTitle className="text-base font-semibold truncate">
                Evaluation Incident & Control Plane
              </DialogTitle>
              <span className="text-[11px] text-muted-foreground font-mono truncate">
                Rule 60 Dead-Man Kill Switches & Rule 63 Incident Triage
              </span>
            </div>
            <CardInfoTooltip text="Manage emergency platform dead-man kill switches and record audited incident tickets. All actions require >= 5 characters justification." />
          </div>
          <DialogDescription className="sr-only">
            Evaluation Incident Management and Backoffice Dead-Man Switch Control
          </DialogDescription>
        </DialogHeader>

        {/* TAB CONTROLS */}
        <div className="flex border-b border-border/80 bg-muted/20 px-6 pt-2 gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setActiveTab('switches')}
            className={cn(
              'px-4 py-2 text-xs font-semibold rounded-t-lg rounded-b-none border-b-2 transition-all min-h-[40px]',
              activeTab === 'switches'
                ? 'border-primary text-primary bg-card shadow-sm'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Radio className="w-3.5 h-3.5 mr-1.5" />
            Emergency Dead-Man Controls
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setActiveTab('ticket')}
            className={cn(
              'px-4 py-2 text-xs font-semibold rounded-t-lg rounded-b-none border-b-2 transition-all min-h-[40px]',
              activeTab === 'ticket'
                ? 'border-primary text-primary bg-card shadow-sm'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
            Create Incident Ticket
          </Button>
        </div>

        {/* BODY CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-sm">
          {activeTab === 'switches' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl border border-destructive/20 bg-destructive/5 text-xs text-destructive flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block mb-0.5">Rule 60 Fail-Closed Safety Protocol</span>
                  Emergency switches immediately pause agent workflows in-flight. Toggling requires
                  an authenticated human operator and a mandatory audit note of at least 5 characters.
                </div>
              </div>

              <div className="space-y-3">
                {EMERGENCY_SWITCHES.map((sw) => {
                  const Icon = sw.icon;
                  const isPaused = deadManSwitches[sw.id] ?? false;
                  const isSelected = selectedSwitch === sw.id;

                  return (
                    <div
                      key={sw.id}
                      className={cn(
                        'p-4 rounded-xl border transition-all text-xs flex flex-col gap-3',
                        isPaused
                          ? 'border-destructive/40 bg-destructive/10'
                          : 'border-border/80 bg-card hover:border-primary/40'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={cn(
                              'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border',
                              isPaused
                                ? 'bg-destructive/20 border-destructive/30 text-destructive'
                                : 'bg-muted/40 border-border/80 text-muted-foreground'
                            )}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col text-left truncate">
                            <span className="font-semibold text-foreground text-xs truncate">
                              {sw.label}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-mono truncate">
                              {sw.id}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] font-mono',
                              isPaused
                                ? 'border-destructive/30 text-destructive bg-destructive/10'
                                : 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10'
                            )}
                          >
                            {isPaused ? 'PAUSED' : 'ACTIVE'}
                          </Badge>
                          <Button
                            type="button"
                            size="sm"
                            variant={isPaused ? 'outline' : 'destructive'}
                            onClick={() => {
                              setSelectedSwitch(isSelected ? null : sw.id);
                              setSwitchJustification('');
                            }}
                            className="rounded-xl active:scale-[0.97] min-h-[36px] text-xs"
                          >
                            {isPaused ? 'Resume' : 'Halt'}
                          </Button>
                        </div>
                      </div>

                      <p className="text-[11px] text-muted-foreground">{sw.description}</p>

                      {/* Confirmation & Justification Drawer */}
                      {isSelected && (
                        <div className="pt-3 border-t border-border/60 space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <Label className="font-medium text-foreground">
                              Audit Justification Note (Rule 61)
                            </Label>
                            <span
                              className={cn(
                                'font-mono text-[10px]',
                                isSwitchJustificationValid
                                  ? 'text-emerald-500'
                                  : 'text-muted-foreground'
                              )}
                            >
                              {switchJustification.trim().length}/5 chars min
                            </span>
                          </div>
                          <Textarea
                            placeholder={`Explain why you are ${
                              isPaused ? 'resuming' : 'halting'
                            } ${sw.label}...`}
                            value={switchJustification}
                            onChange={(e) => setSwitchJustification(e.target.value)}
                            className="text-xs min-h-[64px] rounded-xl resize-none"
                          />
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedSwitch(null);
                                setSwitchJustification('');
                              }}
                              className="rounded-xl active:scale-[0.97] min-h-[36px] text-xs"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={!isSwitchJustificationValid || isToggling}
                              onClick={handleToggleSwitch}
                              variant={isPaused ? 'default' : 'destructive'}
                              className="rounded-xl active:scale-[0.97] min-h-[36px] text-xs"
                            >
                              {isToggling && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                              Confirm {isPaused ? 'Resume' : 'Halt'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'ticket' && (
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="incident-title" className="text-xs font-semibold">
                  Incident Title *
                </Label>
                <Input
                  id="incident-title"
                  placeholder="e.g. Model Hallucination on Invoice Extraction"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="rounded-xl min-h-[44px] text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Severity</Label>
                  <Select
                    value={severity}
                    onValueChange={(val: IncidentSeverity) => setSeverity(val)}
                  >
                    <SelectTrigger className="rounded-xl min-h-[44px] text-xs">
                      <SelectValue placeholder="Select severity" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {INCIDENT_SEVERITIES.map((sev) => (
                        <SelectItem key={sev} value={sev} className="text-xs">
                          {sev}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="persona-id" className="text-xs font-semibold">
                    Target Persona (Optional)
                  </Label>
                  <Input
                    id="persona-id"
                    placeholder="e.g. billing_analyst"
                    value={personaId}
                    onChange={(e) => setPersonaId(e.target.value)}
                    className="rounded-xl min-h-[44px] text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="capability-id" className="text-xs font-semibold">
                    Capability (Optional)
                  </Label>
                  <Input
                    id="capability-id"
                    placeholder="e.g. finance.invoice.extract"
                    value={capabilityId}
                    onChange={(e) => setCapabilityId(e.target.value)}
                    className="rounded-xl min-h-[44px] text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <Label htmlFor="ticket-justification" className="font-semibold">
                    Operational Justification & Context (Rule 61) *
                  </Label>
                  <span
                    className={cn(
                      'font-mono text-[10px]',
                      ticketJustification.trim().length >= 5
                        ? 'text-emerald-500'
                        : 'text-muted-foreground'
                    )}
                  >
                    {ticketJustification.trim().length}/5 chars min
                  </span>
                </div>
                <Textarea
                  id="ticket-justification"
                  placeholder="Provide technical root cause, observed regression, or anomalous behavior details..."
                  value={ticketJustification}
                  onChange={(e) => setTicketJustification(e.target.value)}
                  className="rounded-xl min-h-[96px] text-xs resize-none"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  disabled={!isTicketValid || isSubmittingTicket}
                  className="rounded-xl active:scale-[0.97] min-h-[44px] px-6 text-xs font-semibold"
                >
                  {isSubmittingTicket && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Record Incident Ticket
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* DEMARCATED FOOTER (theme.md §8) */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl active:scale-[0.97] min-h-[44px]"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
