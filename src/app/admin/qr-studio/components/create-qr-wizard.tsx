'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Loader2, AlertCircle } from 'lucide-react';
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
  { id: 'mode', label: 'Static / Dynamic', number: 3 },
  { id: 'design', label: 'Design', number: 4 },
  { id: 'review', label: 'Review & Create', number: 5 },
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
      return { valid: true, errors: [], message: '' };
    }

    case 2: {
      if (!state.mode) return { valid: false, errors: ['mode'], message: 'Please select static or dynamic mode.' };
      if (state.mode === 'dynamic' && state.customShortPath) {
        if (!/^[a-zA-Z0-9-]+$/.test(state.customShortPath)) {
          return { valid: false, errors: ['customShortPath'], message: 'Custom shortlink can only contain letters, numbers, and hyphens.' };
        }
      }
      return { valid: true, errors: [], message: '' };
    }

    case 3:
      return { valid: true, errors: [], message: '' }; // Design is always valid

    case 4: {
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
    const reviewValidation = validateStep(4, state);
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
    <div className="w-full h-full flex flex-col space-y-8 pb-32">
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
            {currentStep === 1 && <StepDestination state={state} updateState={updateState} validationErrors={validationErrors} />}
            {currentStep === 2 && <StepMode state={state} updateState={updateState} validationErrors={validationErrors} />}
            {currentStep === 3 && (
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
            {currentStep === 4 && <StepReview state={state} updateState={updateState} validationErrors={validationErrors} />}
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
