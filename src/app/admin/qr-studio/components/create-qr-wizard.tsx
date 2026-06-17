'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Loader2, AlertCircle, Edit3, BarChart3, Zap, Lock, Globe, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/firebase';
import { createQRCode } from '@/lib/qr-actions';
import { DEFAULT_QR_DESIGN } from '@/lib/qr-constants';
import type { QRCodeMode, QRCodeType, QRDesign, QRDestination, QRTracking } from '@/lib/types';

import StepType from './step-type';
import StepDestination from './step-destination';
import StepMode from './step-mode';
import StepReview from './step-review';
import QRDesigner from './designer/qr-designer';

export interface WizardState {
  type: QRCodeType;
  destination: QRDestination;
  mode: QRCodeMode;
  design: QRDesign;
  tracking: QRTracking;
  name: string;
  description: string;
  customShortPath?: string;
}

const INITIAL_STATE: WizardState = {
  type: 'url',
  destination: {},
  mode: 'dynamic',
  design: { ...DEFAULT_QR_DESIGN },
  tracking: { enabled: true },
  name: '',
  description: '',
};

const STEPS = [
  { id: 'type', label: 'QR Type', number: 1 },
  { id: 'destination', label: 'Destination', number: 2 },
  { id: 'design', label: 'Design', number: 3 },
  { id: 'review', label: 'Review & Create', number: 4 },
];

// ─────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────

interface StepValidation {
  valid: boolean;
  errors: string[];
  message: string;
}

function validateStep(step: number, state: WizardState): StepValidation {
  switch (step) {
    case 0:
      if (!state.type) return { valid: false, errors: ['type'], message: 'Please select a QR code type.' };
      return { valid: true, errors: [], message: '' };

    case 1: {
      const hasUrl = !!(state.destination.url || state.destination.resourceId);
      if (!hasUrl) return { valid: false, errors: ['url'], message: 'Please enter a destination URL or select a resource.' };
      if (!state.mode) return { valid: false, errors: ['mode'], message: 'Please select static or dynamic mode.' };
      if (state.mode === 'dynamic' && state.customShortPath) {
        if (!/^[a-zA-Z0-9-]+$/.test(state.customShortPath)) {
          return { valid: false, errors: ['customShortPath'], message: 'Custom shortlink can only contain letters, numbers, and hyphens.' };
        }
      }
      return { valid: true, errors: [], message: '' };
    }

    case 2:
      return { valid: true, errors: [], message: '' }; // Design is always valid

    case 3: {
      if (!state.name.trim()) return { valid: false, errors: ['name'], message: 'Please enter a name for your QR code.' };
      return { valid: true, errors: [], message: '' };
    }

    default:
      return { valid: false, errors: [], message: '' };
  }
}

export default function CreateQRWizard() {
  const router = useRouter();
  const { toast } = useToast();
  const { activeOrganizationId, activeWorkspaceId } = useTenant();
  const { user } = useUser();

  const [currentStep, setCurrentStep] = React.useState(0);
  const [state, setState] = React.useState<WizardState>(INITIAL_STATE);
  const [creating, setCreating] = React.useState(false);
  const [validationErrors, setValidationErrors] = React.useState<string[]>([]);
  const [showValidationAlert, setShowValidationAlert] = React.useState(false);
  const [validationMessage, setValidationMessage] = React.useState('');

  const updateState = React.useCallback((patch: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...patch }));
    // Clear validation errors when user makes changes
    setValidationErrors([]);
    setShowValidationAlert(false);
  }, []);

  const validation = React.useMemo(() => validateStep(currentStep, state), [currentStep, state]);

  const handleNext = () => {
    if (!validation.valid) {
      // Show validation feedback
      setValidationErrors(validation.errors);
      setValidationMessage(validation.message);
      setShowValidationAlert(true);
      toast({
        variant: 'destructive',
        title: 'Missing information',
        description: validation.message,
      });
      return;
    }
    setValidationErrors([]);
    setShowValidationAlert(false);
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    setValidationErrors([]);
    setShowValidationAlert(false);
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    } else {
      router.push('/admin/qr-studio');
    }
  };

  const handleCreate = async () => {
    // Final validation
    const reviewValidation = validateStep(3, state);
    if (!reviewValidation.valid) {
      setValidationErrors(reviewValidation.errors);
      setValidationMessage(reviewValidation.message);
      setShowValidationAlert(true);
      toast({ variant: 'destructive', title: 'Missing information', description: reviewValidation.message });
      return;
    }

    if (!activeOrganizationId || !activeWorkspaceId || !user) return;
    setCreating(true);
    try {
      const result = await createQRCode({
        organizationId: activeOrganizationId,
        workspaceId: activeWorkspaceId,
        name: state.name,
        description: state.description || undefined,
        mode: state.mode,
        type: state.type,
        destination: state.destination,
        design: state.design,
        tracking: state.tracking,
        customShortPath: state.mode === 'dynamic' && state.customShortPath ? state.customShortPath : undefined,
        createdBy: {
          userId: user.uid,
          name: user.displayName || '',
          email: user.email || '',
        },
      });

      toast({
        title: 'QR Code created!',
        description: `${state.name} is ready. ${state.mode === 'dynamic' ? 'Scan tracking is enabled.' : ''}`,
      });

      router.push(`/admin/qr-studio/${result.id}`);
    } catch (err) {
      console.error('Failed to create QR code:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create QR code.' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="w-full space-y-8 pb-32 p-8">
      {/* Header */}
      <div>
        <Button variant="ghost" onClick={handleBack} className="rounded-xl mb-4 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {currentStep === 0 ? 'Back to QR Studio' : 'Previous Step'}
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Create QR Code</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep].label}
        </p>
      </div>

      {/* Progress Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((step, i) => {
          const isAccessible = i <= currentStep || validation.valid; // rough check, allow clicking if valid or going backward
          
          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                onClick={() => {
                  // Allow jumping back, or jumping forward if the current step is valid
                  if (i < currentStep || (i > currentStep && validation.valid)) {
                    setCurrentStep(i);
                  }
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
                  i === currentStep
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                    : i < currentStep
                    ? 'bg-primary/10 text-primary cursor-pointer hover:bg-primary/20'
                    : 'bg-muted text-muted-foreground cursor-pointer hover:bg-muted/80'
                } ${(!isAccessible && i > currentStep) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {i < currentStep ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span>{step.number}</span>
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 rounded-full transition-colors ${i < currentStep ? 'bg-primary/40' : 'bg-border'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Validation Alert */}
      <AnimatePresence>
        {showValidationAlert && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/20">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-sm font-medium text-destructive">{validationMessage}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step Content */}
      <Card className="rounded-2xl border-border bg-card p-6 sm:p-8 min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {currentStep === 0 && <StepType state={state} updateState={updateState} />}
            {currentStep === 1 && (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
                <div className="space-y-8">
                  <StepDestination state={state} updateState={updateState} validationErrors={validationErrors} />
                  <div className="border-t border-border pt-8">
                    <StepMode state={state} updateState={updateState} validationErrors={validationErrors} />
                  </div>
                </div>
                <DestinationSummary state={state} />
              </div>
            )}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Customize Design</h2>
                  <p className="text-sm text-muted-foreground mt-1">Style your QR code with colors, patterns, and a logo.</p>
                </div>
                <QRDesigner
                  data={state.destination.url || 'https://smartsapp.com'}
                  design={state.design}
                  onDesignChange={(design) => updateState({ design })}
                  orgId={activeOrganizationId!}
                  wsId={activeWorkspaceId!}
                />
              </div>
            )}
            {currentStep === 3 && <StepReview state={state} updateState={updateState} validationErrors={validationErrors} />}
          </motion.div>
        </AnimatePresence>
      </Card>

      {/* Footer Actions */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={handleBack} className="rounded-xl h-11">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {currentStep < STEPS.length - 1 ? (
          <Button
            onClick={handleNext}
            className="rounded-xl h-11 px-6 font-semibold shadow-lg shadow-primary/20"
          >
            Continue
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleCreate}
            disabled={creating}
            className="rounded-xl h-11 px-8 font-semibold shadow-lg shadow-primary/20"
          >
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Create QR Code
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Destination Summary Component
// ─────────────────────────────────────────────────

interface DestinationSummaryProps {
  state: WizardState;
}

const TYPE_LABELS: Record<string, string> = {
  url: 'External URL',
  survey: 'Survey',
  form: 'Form',
  landing_page: 'Landing Page',
  public_portal: 'Public Portal',
  doc_signing: 'Doc Signing',
  meeting: 'Meeting',
  invoice: 'Invoice',
  vcard: 'vCard',
  wifi: 'Wi-Fi',
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  text: 'Text',
  file: 'File',
};

function DestinationSummary({ state }: DestinationSummaryProps) {
  const isDynamic = state.mode === 'dynamic';

  return (
    <div className="p-5 rounded-2xl bg-muted/30 border border-border/80 space-y-5 lg:sticky lg:top-6">
      <div>
        <h3 className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Setup Summary</h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">Real-time overview of your configuration.</p>
      </div>

      {/* QR Code Type & Destination */}
      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground font-semibold">QR Type</span>
          <span className="font-bold text-foreground bg-primary/10 text-primary px-2.5 py-1 rounded-lg text-[9px] uppercase tracking-wider">
            {TYPE_LABELS[state.type] || state.type}
          </span>
        </div>

        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground font-semibold">Destination Details</span>
          <p className="text-xs font-mono bg-muted/65 p-2.5 rounded-xl border border-border/60 break-all text-foreground max-h-[120px] overflow-y-auto">
            {state.destination.url || 'Not configured yet'}
          </p>
        </div>
      </div>

      <div className="h-px bg-border/50" />

      {/* Mode & Implications */}
      <div className="space-y-3.5">
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground font-semibold">Routing Mode</span>
          <span className={`font-bold px-2.5 py-1 rounded-lg text-[9px] uppercase tracking-wider ${
            isDynamic 
              ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20' 
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
          }`}>
            {state.mode}
          </span>
        </div>

        <div className="space-y-2.5 pt-1">
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Routing Implications</p>
          
          {isDynamic ? (
            <div className="space-y-3">
              <div className="flex gap-2.5 text-xs items-start">
                <Edit3 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-foreground leading-tight text-[11px]">Editable Destination</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Change where this code scans to at any time, even after printing.</p>
                </div>
              </div>
              <div className="flex gap-2.5 text-xs items-start">
                <BarChart3 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-foreground leading-tight text-[11px]">Full Analytics</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Track total scans, unique visits, device browsers, and referral parameters.</p>
                </div>
              </div>
              <div className="flex gap-2.5 text-xs items-start">
                <Zap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-foreground leading-tight text-[11px]">Active Redirects</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Scans route securely through go.smartsapp.com before landing.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2.5 text-xs items-start">
                <Lock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-foreground leading-tight text-[11px]">Permanent Link</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">The link is hard-coded into the QR pattern. It can never be changed.</p>
                </div>
              </div>
              <div className="flex gap-2.5 text-xs items-start">
                <Globe className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-foreground leading-tight text-[11px]">Direct Routing</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Scans directly load the URL without any redirects. Works fully offline.</p>
                </div>
              </div>
              <div className="flex gap-2.5 text-xs items-start">
                <Shield className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-foreground leading-tight text-[11px]">Zero Analytics</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">No scan counts, visitor tracking, or device analytics will be captured.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
