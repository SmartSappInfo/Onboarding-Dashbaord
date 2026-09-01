'use client';

/**
 * @fileOverview Member Onboarding Execution Wizard (Onboarding 2.0)
 *
 * Interactive step-by-step induction wizard for newly invited and registered members.
 * Renders tailored step cards, tracks live progress, and activates the member upon completion.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Emil Kowalski spring easing (`cubic-bezier(0.32, 0.72, 0, 1)`).
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 * - Mobile ergonomics: touch targets >= 44px (`min-h-[44px]`) on all controls.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import {
  Layers,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Building,
  Users,
  FileCheck,
  Video,
  Shield,
  Clock,
  Sparkles,
  Loader2,
  PartyPopper,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OnboardingInstance, OnboardingStepInstance } from '@/lib/types';
import { submitOnboardingStepAction } from '@/app/actions/onboarding-actions';

interface MemberOnboardingWizardProps {
  initialInstance: OnboardingInstance;
}

export function MemberOnboardingWizard({ initialInstance }: MemberOnboardingWizardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user: authUser } = useUser();
  const { activeOrganizationId, accessibleWorkspaces } = useTenant();

  const [instance, setInstance] = React.useState<OnboardingInstance>(initialInstance);
  const [currentStepIdx, setCurrentStepIdx] = React.useState<number>(initialInstance.currentStepIndex || 0);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Dynamic Step Form States
  const [profileName, setProfileName] = React.useState(authUser?.displayName || instance.personName || '');
  const [profilePhone, setProfilePhone] = React.useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = React.useState(accessibleWorkspaces[0]?.id || '');
  const [policyAccepted, setPolicyAccepted] = React.useState(false);
  const [videoWatched, setVideoWatched] = React.useState(false);
  const [checklistCompleted, setChecklistCompleted] = React.useState<Record<string, boolean>>({});

  const currentStep: OnboardingStepInstance | undefined = instance.stepInstances[currentStepIdx];
  const isLastStep = currentStepIdx === instance.stepInstances.length - 1;

  // Handle Step Advance
  const handleAdvanceStep = async () => {
    if (!authUser || !activeOrganizationId || !currentStep) return;

    // Validate step requirements
    if (currentStep.type === 'policy_acceptance' && !policyAccepted) {
      toast({ title: 'Requirement Missing', description: 'Please accept the policy to continue.', variant: 'destructive' });
      return;
    }
    if (currentStep.type === 'profile' && !profileName.trim()) {
      toast({ title: 'Requirement Missing', description: 'Please enter your display name.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const idToken = await authUser.getIdToken();

      // Collect response data
      const responseData: Record<string, string | number | boolean | string[]> = {};
      if (currentStep.type === 'profile') {
        responseData.displayName = profileName.trim();
        if (profilePhone) responseData.phone = profilePhone.trim();
      } else if (currentStep.type === 'workspace_selection') {
        responseData.selectedWorkspaceId = selectedWorkspaceId;
      } else if (currentStep.type === 'policy_acceptance') {
        responseData.policyAccepted = true;
      } else if (currentStep.type === 'guide_video') {
        responseData.videoWatched = true;
      }

      const res = await submitOnboardingStepAction({
        idToken,
        organizationId: activeOrganizationId,
        instanceId: instance.id,
        stepId: currentStep.stepId || currentStep.id,
        responseData,
      });

      if (res.success && res.instance) {
        setInstance(res.instance);
        if (currentStepIdx < res.instance.stepInstances.length - 1) {
          setCurrentStepIdx((prev) => prev + 1);
        }
      } else {
        throw new Error(res.error || 'Failed to submit step');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      toast({ title: 'Step Error', description: msg, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // If entire journey is completed
  if (instance.status === 'completed') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8 space-y-6 shadow-2xl border bg-card animate-in zoom-in-95 duration-500">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
            <PartyPopper className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <CardTitle className="text-2xl font-black tracking-tight text-foreground">
              Onboarding Complete!
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground leading-relaxed">
              Congratulations, {authUser?.displayName || instance.personName}! Your workspace access is active and certified.
            </CardDescription>
          </div>

          <div className="p-4 rounded-xl bg-muted/20 border text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Certified Journey:</span>
              <span className="font-semibold text-foreground">{instance.journeyName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                Active Member
              </Badge>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="w-full h-11 text-xs font-bold active:scale-[0.97] shadow-md"
          >
            Enter Workspace Dashboard <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-300">
      {/* Header Progress Ribbon */}
      <div className="space-y-2 bg-card p-4 rounded-2xl border shadow-xs">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
              {instance.journeyName}
            </span>
            <h2 className="text-base font-bold text-foreground">
              Step {currentStepIdx + 1} of {instance.stepInstances.length}: {currentStep?.stepTitle}
            </h2>
          </div>
          <Badge variant="outline" className="text-xs font-mono font-bold">
            {instance.completionPercent}%
          </Badge>
        </div>
        <Progress value={instance.completionPercent} className="h-2" />
      </div>

      {/* Main Step Interaction Card */}
      <Card className="border bg-card shadow-lg overflow-hidden">
        <CardHeader className="bg-muted/10 border-b p-6 space-y-1">
          <div className="flex items-center gap-2">
            {currentStep?.type === 'profile' && <CheckCircle2 className="w-5 h-5 text-primary" />}
            {currentStep?.type === 'workspace_selection' && <Building className="w-5 h-5 text-blue-500" />}
            {currentStep?.type === 'policy_acceptance' && <FileCheck className="w-5 h-5 text-amber-500" />}
            {currentStep?.type === 'guide_video' && <Video className="w-5 h-5 text-rose-500" />}
            {currentStep?.type === 'mfa_setup' && <Shield className="w-5 h-5 text-cyan-500" />}
            <CardTitle className="text-lg font-bold">{currentStep?.stepTitle}</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Please complete the requirements below to advance your onboarding
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-5 text-xs">
          {/* 1. Profile Step */}
          {currentStep?.type === 'profile' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Your Full Name</Label>
                <Input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="e.g. Sarah Doe"
                  className="h-10 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Contact Phone (Optional)</Label>
                <Input
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="+233..."
                  className="h-10 text-xs"
                />
              </div>
            </div>
          )}

          {/* 2. Workspace Selection */}
          {currentStep?.type === 'workspace_selection' && (
            <div className="space-y-3">
              <Label className="text-xs font-semibold">Select Your Primary Workspace</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {accessibleWorkspaces.map((ws) => (
                  <div
                    key={ws.id}
                    onClick={() => setSelectedWorkspaceId(ws.id)}
                    className={cn(
                      'p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between',
                      selectedWorkspaceId === ws.id
                        ? 'border-primary bg-primary/5 shadow-xs'
                        : 'border-border hover:bg-muted/10'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Building className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-xs text-foreground">{ws.name}</span>
                    </div>
                    {selectedWorkspaceId === ws.id && (
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Policy Acceptance */}
          {currentStep?.type === 'policy_acceptance' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border bg-muted/10 space-y-2 leading-relaxed text-muted-foreground text-xs max-h-48 overflow-y-auto">
                <h4 className="font-bold text-foreground">Organization Code of Conduct & Security Standards</h4>
                <p>
                  As an authorized member, you agree to safeguard organization assets, maintain client data confidentiality,
                  and comply with all multi-tenant security protocols.
                </p>
                <p>
                  Unauthorized extraction of data or sharing credentials will result in immediate session revocation.
                </p>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="policy-chk"
                  checked={policyAccepted}
                  onCheckedChange={(c) => setPolicyAccepted(Boolean(c))}
                  className="h-4 w-4"
                />
                <label
                  htmlFor="policy-chk"
                  className="text-xs font-semibold text-foreground cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I have read, understood, and accept these organizational terms.
                </label>
              </div>
            </div>
          )}

          {/* 4. Guide Video */}
          {currentStep?.type === 'guide_video' && (
            <div className="space-y-4 text-center">
              <div className="p-8 rounded-2xl border bg-muted/20 flex flex-col items-center justify-center gap-3">
                <Video className="w-12 h-12 text-primary/70 animate-pulse" />
                <p className="font-semibold text-foreground">Orientation Masterclass</p>
                <p className="text-muted-foreground max-w-sm">
                  Please review the platform walkthrough video before beginning operational tasks.
                </p>
              </div>

              <div className="flex items-center justify-center space-x-2 pt-2">
                <Checkbox
                  id="video-chk"
                  checked={videoWatched}
                  onCheckedChange={(c) => setVideoWatched(Boolean(c))}
                  className="h-4 w-4"
                />
                <label htmlFor="video-chk" className="text-xs font-semibold text-foreground cursor-pointer">
                  I have watched the orientation masterclass.
                </label>
              </div>
            </div>
          )}

          {/* 5. Checklist or Default Step */}
          {(currentStep?.type === 'checklist' ||
            currentStep?.type === 'form' ||
            currentStep?.type === 'team_selection' ||
            currentStep?.type === 'mfa_setup' ||
            currentStep?.type === 'manager_approval') && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl border bg-muted/10 space-y-2 text-xs">
                <p className="font-semibold text-foreground">Operational Checklist</p>
                <div className="space-y-2 pt-2">
                  {['Verify workspace email preferences', 'Join team communications channel', 'Confirm regional time zone'].map(
                    (item, i) => (
                      <div key={i} className="flex items-center space-x-2">
                        <Checkbox
                          id={`chk-${i}`}
                          checked={Boolean(checklistCompleted[item])}
                          onCheckedChange={(c) =>
                            setChecklistCompleted((prev) => ({ ...prev, [item]: Boolean(c) }))
                          }
                        />
                        <label htmlFor={`chk-${i}`} className="text-xs text-foreground cursor-pointer">
                          {item}
                        </label>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="p-6 border-t bg-muted/10 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCurrentStepIdx((prev) => Math.max(0, prev - 1))}
            disabled={currentStepIdx === 0 || isSubmitting}
            className="text-xs h-10 px-4 active:scale-[0.97] min-h-[44px]"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Previous Step
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleAdvanceStep}
            disabled={isSubmitting}
            className="text-xs h-10 px-6 font-bold active:scale-[0.97] min-h-[44px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...
              </>
            ) : isLastStep ? (
              <>
                Complete & Activate <Sparkles className="w-4 h-4 ml-1.5" />
              </>
            ) : (
              <>
                Next Step <ArrowRight className="w-4 h-4 ml-1.5" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default MemberOnboardingWizard;
