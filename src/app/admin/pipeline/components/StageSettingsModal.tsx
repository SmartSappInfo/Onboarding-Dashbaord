'use client';

/**
 * @fileoverview Comprehensive Stage Settings & Process Gate Modal
 *
 * ARCHITECTURAL POINTER (Phase 2 — Pipeline Engine & Process Enforcement):
 * Empowers pipeline administrators to configure deep stage behaviors:
 * - Win Probability (0–100%) for automated revenue forecasting.
 * - Stage SLA Target (Days) & Warning/Escalation thresholds.
 * - Terminal State Tagging ('none' | 'won' | 'lost' | 'abandoned').
 * - Required Entry Fields (Value, Close Date, Primary Contact, Decision Maker, Next Step).
 *
 * WORKSPACE RULES & COMPLIANCE:
 * - Strict typing: Zero 'any' or 'any[]'.
 * - Mobile-first ergonomics: Min 44px touch targets on mobile viewports.
 * - Actionable toasts: Displays feedback with relative navigation pointers.
 *
 * TESTABILITY POINTER:
 * Validated by unit tests in `src/lib/deals/__tests__/deal-stage-validation.test.ts`.
 */

import * as React from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { OnboardingStage, StageRequiredField, StageTerminalType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
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
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Settings2,
  Loader2,
  Percent,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Target,
  FileCheck,
  DollarSign,
  Calendar,
  Users,
  UserCheck,
  ArrowRight,
  Shield,
  Zap
} from 'lucide-react';
import { ONBOARDING_STAGE_COLORS } from '@/lib/colors';
import { cn } from '@/lib/utils';
import { STAGE_REQUIRED_FIELD_LABELS } from '@/lib/deals/deal-stage-validation';

interface StageSettingsModalProps {
  stage: OnboardingStage | null;
  isOpen: boolean;
  onClose: () => void;
}

const REQUIRED_FIELD_ICONS: Record<StageRequiredField, React.ReactNode> = {
  value: <DollarSign className="h-3.5 w-3.5 text-emerald-500" />,
  expectedCloseDate: <Calendar className="h-3.5 w-3.5 text-blue-500" />,
  primaryContact: <Users className="h-3.5 w-3.5 text-indigo-500" />,
  decisionMaker: <UserCheck className="h-3.5 w-3.5 text-purple-500" />,
  nextStep: <ArrowRight className="h-3.5 w-3.5 text-amber-500" />,
};

export default function StageSettingsModal({ stage, isOpen, onClose }: StageSettingsModalProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [name, setName] = React.useState('');
  const [color, setColor] = React.useState('#6366f1');
  const [probability, setProbability] = React.useState<number>(50);
  const [slaDays, setSlaDays] = React.useState<number | ''>('');
  const [slaWarningDays, setSlaWarningDays] = React.useState<number | ''>('');
  const [slaEscalationDays, setSlaEscalationDays] = React.useState<number | ''>('');
  const [terminalType, setTerminalType] = React.useState<StageTerminalType>('none');
  const [requiredFields, setRequiredFields] = React.useState<StageRequiredField[]>([]);

  // Sync state when modal opens or stage changes
  React.useEffect(() => {
    if (stage) {
      setName(stage.name || '');
      setColor(stage.color || '#6366f1');
      setProbability(typeof stage.probability === 'number' ? stage.probability : 50);
      setSlaDays(typeof stage.slaDays === 'number' ? stage.slaDays : '');
      setSlaWarningDays(typeof stage.slaWarningDays === 'number' ? stage.slaWarningDays : '');
      setSlaEscalationDays(typeof stage.slaEscalationDays === 'number' ? stage.slaEscalationDays : '');
      
      if (stage.terminalType) {
        setTerminalType(stage.terminalType);
      } else if (stage.isWon) {
        setTerminalType('won');
      } else if (stage.isLost) {
        setTerminalType('lost');
      } else {
        setTerminalType('none');
      }

      setRequiredFields(Array.isArray(stage.requiredFields) ? stage.requiredFields : []);
    }
  }, [stage, isOpen]);

  const handleToggleRequiredField = (field: StageRequiredField) => {
    setRequiredFields(prev =>
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stage || !firestore) return;

    if (!name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Stage Name Required',
        description: 'Please provide a valid stage name.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const stageRef = doc(firestore, 'onboardingStages', stage.id);

      const isWon = terminalType === 'won';
      const isLost = terminalType === 'lost' || terminalType === 'abandoned';

      const updatePayload: Partial<OnboardingStage> & { updatedAt: string } = {
        name: name.trim(),
        color,
        probability: Math.min(100, Math.max(0, probability)),
        slaDays: typeof slaDays === 'number' && slaDays > 0 ? slaDays : undefined,
        slaWarningDays: typeof slaWarningDays === 'number' && slaWarningDays > 0 ? slaWarningDays : undefined,
        slaEscalationDays: typeof slaEscalationDays === 'number' && slaEscalationDays > 0 ? slaEscalationDays : undefined,
        terminalType,
        isWon,
        isLost,
        requiredFields,
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(stageRef, updatePayload);

      toast({
        title: 'Stage Configuration Saved',
        description: `Successfully updated process gates for "${name.trim()}".`,
      });

      onClose();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update stage configuration';
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: errorMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!stage) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl rounded-3xl p-6 bg-background border border-border shadow-2xl overflow-y-auto max-h-[90vh]">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-extrabold flex items-center gap-2 text-foreground">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Settings2 className="h-4 w-4" />
              </div>
              <span>Configure Stage: {stage.name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define win probabilities, SLA milestones, process entry gates, and terminal outcomes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Stage Name & Color */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Stage Name *</Label>
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Technical Proposal"
                  className="min-h-[44px] sm:min-h-[40px] text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Stage Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-12 min-h-[44px] sm:min-h-[40px] p-1 rounded-xl cursor-pointer border border-border"
                  />
                  <div
                    className="flex-1 min-h-[44px] sm:min-h-[40px] rounded-xl border border-border flex items-center justify-center text-xs font-mono font-bold"
                    style={{ backgroundColor: `${color}15`, color }}
                  >
                    {color}
                  </div>
                </div>
              </div>
            </div>

            {/* Win Probability */}
            <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Percent className="h-3.5 w-3.5 text-primary" />
                  <span>Stage Win Probability</span>
                </Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={probability}
                    onChange={(e) => setProbability(Number(e.target.value))}
                    className="w-16 h-8 text-xs font-bold text-center rounded-lg border-border"
                  />
                  <span className="text-xs font-bold text-muted-foreground">%</span>
                </div>
              </div>

              <Slider
                value={[probability]}
                min={0}
                max={100}
                step={5}
                onValueChange={([val]) => setProbability(val)}
                className="py-1"
              />
              <p className="text-[11px] text-muted-foreground">
                Deals in this stage will inherit this win probability to drive the weighted revenue forecasting matrix.
              </p>
            </div>

            {/* SLA Target & Warning Thresholds */}
            <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-3">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                <span>Stage Duration SLA & Escalations</span>
              </Label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground">Target SLA (Days)</span>
                  <Input
                    type="number"
                    min={1}
                    value={slaDays}
                    onChange={(e) => setSlaDays(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 5"
                    className="min-h-[44px] sm:min-h-[38px] text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Warning (Days)</span>
                  <Input
                    type="number"
                    min={1}
                    value={slaWarningDays}
                    onChange={(e) => setSlaWarningDays(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 4"
                    className="min-h-[44px] sm:min-h-[38px] text-xs rounded-xl border-amber-500/30"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-destructive">Escalation (Days)</span>
                  <Input
                    type="number"
                    min={1}
                    value={slaEscalationDays}
                    onChange={(e) => setSlaEscalationDays(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 7"
                    className="min-h-[44px] sm:min-h-[38px] text-xs rounded-xl border-destructive/30"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Feeds automated stage health calculation (&apos;healthy&apos;, &apos;at_risk&apos;, &apos;stalled&apos;) and manager attention badges.
              </p>
            </div>

            {/* Terminal Outcome Classification */}
            <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-3">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-indigo-500" />
                <span>Stage Lifecycle Classification</span>
              </Label>

              <Select value={terminalType} onValueChange={(val: StageTerminalType) => setTerminalType(val)}>
                <SelectTrigger className="min-h-[44px] sm:min-h-[40px] text-xs rounded-xl">
                  <SelectValue placeholder="Select classification" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="none" className="text-xs py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <span>Active Pipeline Stage (Open Deals)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="won" className="text-xs py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span>Closed Won (Terminal Won Outcome)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="lost" className="text-xs py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                      <span>Closed Lost (Prompts for Lost Reason)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="abandoned" className="text-xs py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-slate-500" />
                      <span>Abandoned / Cancelled</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Entry Process Gates (Required Fields) */}
            <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  <span>Stage Entry Criteria &amp; Required Fields</span>
                </Label>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  {requiredFields.length} selected
                </span>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Deals must satisfy all checked conditions before operators can move them into this stage:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {(Object.keys(STAGE_REQUIRED_FIELD_LABELS) as StageRequiredField[]).map((field) => {
                  const isChecked = requiredFields.includes(field);
                  return (
                    <div
                      key={field}
                      onClick={() => handleToggleRequiredField(field)}
                      className={cn(
                        "flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none",
                        isChecked
                          ? "bg-primary/5 border-primary/30 text-foreground"
                          : "bg-background/60 border-border/60 text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      <Checkbox
                        id={`req-${field}`}
                        checked={isChecked}
                        onCheckedChange={() => handleToggleRequiredField(field)}
                        className="rounded-md"
                      />
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {REQUIRED_FIELD_ICONS[field]}
                        <span className="text-xs font-semibold truncate">
                          {STAGE_REQUIRED_FIELD_LABELS[field]}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stage Automations Linkage (Phase 5) */}
            <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  <span>Stage Automations &amp; Event Protocols</span>
                </Label>
                {stage?.pipelineId && stage?.id && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-8 min-h-[44px] sm:min-h-[32px] px-3 rounded-lg text-xs font-semibold text-primary border-primary/20 bg-primary/5 hover:bg-primary/10 active:scale-[0.97]"
                  >
                    <a
                      href={`/admin/automations/new?trigger=DEAL_STAGE_CHANGED&pipelineId=${stage.pipelineId}&stageId=${stage.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1"
                    >
                      <Zap className="h-3 w-3" />
                      Add Automation
                    </a>
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Trigger email alerts, task creation, webhook dispatches, and SLA escalation rules whenever deals enter this stage.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="min-h-[44px] sm:min-h-[40px] text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] sm:min-h-[40px] text-xs rounded-xl font-bold bg-primary text-primary-foreground gap-1.5 shadow-md"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Save Stage Configuration
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
