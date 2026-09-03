'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { validateJoinCodeAction, submitOnboardingProfileAction } from '@/app/actions/onboarding-actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Building2, User, Phone, Briefcase, Bell, Check, 
  Loader2, ArrowRight, ArrowLeft, LogOut, 
  AlertCircle, Mail, MessageSquare, Smartphone, HelpCircle,
  Sparkles, ShieldCheck
} from 'lucide-react';
import LightRays from '@/components/LightRays';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';

const DEFAULT_DEPARTMENTS = ['General', 'Operations', 'Sales', 'Engineering', 'Customer Success'];

interface ValidatedOrg {
  id: string;
  name: string;
  isConfigured: boolean;
  departments?: string[];
  logoUrl?: string;
}

function ProfileSetupContent() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeParam = searchParams.get('code');
  const { toast } = useToast();

  const [codeFromLink, setCodeFromLink] = React.useState(false);
  const [isPreAssociatedOrg, setIsPreAssociatedOrg] = React.useState(false);
  const [isResolvingOrg, setIsResolvingOrg] = React.useState(true);
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form State
  const [joinCode, setJoinCode] = React.useState('');
  const [isValidatingCode, setIsValidatingCode] = React.useState(false);
  const [validatedOrg, setValidatedOrg] = React.useState<ValidatedOrg | null>(null);
  const [codeError, setCodeError] = React.useState('');
  const [showHelp, setShowHelp] = React.useState(false);

  const [fullName, setFullName] = React.useState('');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [department, setDepartment] = React.useState('');
  const [orgDepartments, setOrgDepartments] = React.useState<string[]>(DEFAULT_DEPARTMENTS);
  const [assignedWorkspaces, setAssignedWorkspaces] = React.useState<{ id: string; name: string }[]>([]);

  const [notifEmail, setNotifEmail] = React.useState(true);
  const [notifSms, setNotifSms] = React.useState(false);
  const [notifInApp, setNotifInApp] = React.useState(true);
  const [notifPush, setNotifPush] = React.useState(false);

  React.useEffect(() => {
    document.title = 'Complete Profile - Onboarding Workspace';
  }, []);

  // Pre-fill name and email if available from Auth
  React.useEffect(() => {
    if (user) {
      if (user.displayName && !fullName) {
        setFullName(user.displayName);
      }
      if (user.phoneNumber && !phoneNumber) {
        setPhoneNumber(user.phoneNumber);
      }
    }
  }, [user, fullName, phoneNumber]);

  // Auth Redirect Guard — preserve the invite code across the auth boundary.
  React.useEffect(() => {
    if (isUserLoading || user) return;
    const code = codeParam || (typeof window !== 'undefined' ? sessionStorage.getItem('pendingJoinCode') : null);
    if (code) {
      if (typeof window !== 'undefined') sessionStorage.setItem('pendingJoinCode', code);
      const dest = `/profile-setup?code=${encodeURIComponent(code)}`;
      router.push(`/signup?redirect=${encodeURIComponent(dest)}`);
    } else {
      router.push('/login');
    }
  }, [user, isUserLoading, codeParam, router]);

  // Auto-resolve organization: checks user's Firestore profile first (for invited users),
  // then falls back to invite link query param or sessionStorage.
  const orgResolvedRef = React.useRef(false);
  React.useEffect(() => {
    if (!user || isUserLoading || orgResolvedRef.current) return;

    let isMounted = true;
    async function resolveOrganizationContext() {
      setIsResolvingOrg(true);
      try {
        let targetOrgId = '';
        let preassignedDept = '';

        // 1. Check if user document already has an organizationId (Invited members)
        if (firestore && user?.uid) {
          try {
            const userSnap = await getDoc(doc(firestore, 'users', user.uid));
            if (userSnap.exists()) {
              const uData = userSnap.data();
              if (uData.organizationId) {
                targetOrgId = uData.organizationId;
                if (uData.name && !fullName) setFullName(uData.name);
                if (uData.phone && !phoneNumber) setPhoneNumber(uData.phone);
                if (uData.department) {
                  preassignedDept = uData.department;
                  setDepartment(uData.department);
                }

                // Load assigned workspace details if provisioned
                if (Array.isArray(uData.workspaceIds) && uData.workspaceIds.length > 0) {
                  try {
                    const wsDocs = await Promise.all(
                      uData.workspaceIds.map((wsId: string) => getDoc(doc(firestore, 'workspaces', wsId)))
                    );
                    const loadedWorkspaces: { id: string; name: string }[] = [];
                    wsDocs.forEach((snap, idx) => {
                      if (snap.exists()) {
                        loadedWorkspaces.push({ id: snap.id, name: snap.data()?.name || 'Workspace' });
                      } else {
                        loadedWorkspaces.push({ id: uData.workspaceIds[idx], name: `Workspace ${idx + 1}` });
                      }
                    });
                    if (isMounted) {
                      setAssignedWorkspaces(loadedWorkspaces);
                    }
                  } catch (wsErr) {
                    console.warn('[ProfileSetup] Workspace lookup warning:', wsErr);
                  }
                }
              }
            }
          } catch (fetchErr) {
            console.warn('[ProfileSetup] User doc org check warning:', fetchErr);
          }
        }

        // 2. If no direct org on user doc, check invite code from link or sessionStorage
        if (!targetOrgId) {
          const code = codeParam || (typeof window !== 'undefined' ? sessionStorage.getItem('pendingJoinCode') : null);
          if (code) {
            targetOrgId = code;
            setCodeFromLink(true);
            setJoinCode(code);
          }
        }

        // 3. If an organization was found, validate and hydrate it
        if (targetOrgId) {
          orgResolvedRef.current = true;
          const result = await validateJoinCodeAction(targetOrgId);
          if (result.success && result.organizationId && result.organizationName && isMounted) {
            const orgInfo: ValidatedOrg = {
              id: result.organizationId,
              name: result.organizationName,
              isConfigured: !!result.isConfigured,
              departments: result.departments || DEFAULT_DEPARTMENTS,
              logoUrl: result.logoUrl,
            };
            setValidatedOrg(orgInfo);
            const baseDepts = result.departments || DEFAULT_DEPARTMENTS;
            const validDepts = preassignedDept && !baseDepts.includes(preassignedDept)
              ? [preassignedDept, ...baseDepts]
              : baseDepts;
            setOrgDepartments(validDepts);
            if (preassignedDept) {
              setDepartment(preassignedDept);
            } else if (!validDepts.includes(department)) {
              setDepartment(validDepts[0] || 'General');
            }
            setIsPreAssociatedOrg(true);
            setStep(2); // Skip Step 1 and proceed directly to Step 2 (Profile)!
            setIsResolvingOrg(false);
            return;
          }
        }
      } catch (err) {
        console.error('[ProfileSetup] Error resolving organization:', err);
      } finally {
        if (isMounted) setIsResolvingOrg(false);
      }
    }

    resolveOrganizationContext();
    return () => {
      isMounted = false;
    };
  }, [user, isUserLoading, firestore, codeParam, fullName, phoneNumber, department]);

  const runValidation = async (
    codeToValidate: string,
    opts?: { advanceOnSuccess?: boolean }
  ) => {
    const trimmed = codeToValidate.trim();
    if (!trimmed) {
      setCodeError('Please enter an organization join code or slug.');
      return;
    }

    setIsValidatingCode(true);
    setCodeError('');
    setValidatedOrg(null);

    try {
      const result = await validateJoinCodeAction(trimmed);
      if (result.success && result.organizationId && result.organizationName) {
        const orgInfo: ValidatedOrg = {
          id: result.organizationId,
          name: result.organizationName,
          isConfigured: !!result.isConfigured,
          departments: result.departments || DEFAULT_DEPARTMENTS,
          logoUrl: result.logoUrl,
        };
        setValidatedOrg(orgInfo);
        const validDepts = result.departments || DEFAULT_DEPARTMENTS;
        setOrgDepartments(validDepts);
        if (!validDepts.includes(department)) {
          setDepartment(validDepts[0] || 'General');
        }
        toast({
          title: 'Organization Verified',
          description: `Linked to ${result.organizationName}`,
        });
        if (opts?.advanceOnSuccess) {
          setStep(2);
        }
      } else {
        setCodeError(result.error || 'Invalid join code. Please check with your administrator.');
        if (opts?.advanceOnSuccess) {
          setCodeFromLink(false);
          if (typeof window !== 'undefined') sessionStorage.removeItem('pendingJoinCode');
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'An error occurred during validation.';
      setCodeError(msg);
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleValidateCode = () => runValidation(joinCode);

  const handleKeyDownValidate = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleValidateCode();
    }
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!validatedOrg) {
        toast({
          variant: 'destructive',
          title: 'Organization Required',
          description: 'Please enter and validate your join code to continue.',
        });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!fullName.trim()) {
        toast({
          variant: 'destructive',
          title: 'Full Name Required',
          description: 'Please enter your full name.',
        });
        return;
      }
      if (!phoneNumber.trim()) {
        toast({
          variant: 'destructive',
          title: 'Phone Number Required',
          description: 'Please enter a contact phone number.',
        });
        return;
      }
      if (!department) {
        toast({
          variant: 'destructive',
          title: 'Department Required',
          description: 'Please select your department.',
        });
        return;
      }
      setStep(3);
    }
  };

  const handleBackStep = () => {
    if (step === 2 && !isPreAssociatedOrg) setStep(1);
    if (step === 3) setStep(2);
  };

  const handleSubmitProfile = async () => {
    if (!user || !validatedOrg) return;

    setIsSubmitting(true);
    try {
      const result = await submitOnboardingProfileAction({
        userId: user.uid,
        name: fullName.trim(),
        phone: phoneNumber.trim(),
        department: department || 'General',
        organizationId: validatedOrg.id,
        notificationPreferences: {
          email: notifEmail,
          sms: notifSms,
          inApp: notifInApp,
          push: notifPush,
        },
      });

      if (result.success) {
        if (typeof window !== 'undefined') sessionStorage.removeItem('pendingJoinCode');
        if (result.isAuthorized) {
          toast({
            title: `Welcome to ${validatedOrg.name}!`,
            description: 'Your profile has been saved and your account is active.',
          });
          if (result.isConfigured === false) {
            router.push('/onboarding/setup');
          } else {
            router.push('/admin');
          }
        } else {
          toast({
            title: 'Profile Submitted Successfully',
            description: 'Your registration is complete and awaiting administrator approval.',
          });
          router.push('/awaiting-approval');
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Submission Failed',
          description: result.error || 'Failed to submit profile.',
        });
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'An unexpected error occurred.';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await auth.signOut();
    router.push('/login');
  };

  if (isUserLoading || !user || isResolvingOrg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-9 w-9 text-emerald-500 animate-spin" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Initializing Onboarding Portal...</p>
        </div>
      </div>
    );
  }

  const activeChannelsCount = [notifEmail, notifSms, notifInApp, notifPush].filter(Boolean).length;
  const userInitials = fullName
    ? fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center bg-background text-foreground p-4 sm:p-6 selection:bg-emerald-500/30 selection:text-emerald-700 dark:selection:text-emerald-300 transition-colors duration-300">
      {/* Background Ambient Lighting (Glow for dark, subtle tint for light) */}
      <div className="dark:block hidden">
        <LightRays
          raysOrigin="top-center"
          raysColor="#10b981"
          raysSpeed={1.0}
          lightSpread={0.7}
          rayLength={2.8}
          followMouse={false}
          pulsating
          fadeDistance={1.2}
          className="!absolute inset-0 opacity-40 pointer-events-none"
        />
      </div>
      <div className="dark:hidden block">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/70 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Top Header Utilities */}
      <header className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 flex items-center gap-2.5">
        <ThemeToggle />
        <Button
          variant="outline"
          size="sm"
          onClick={handleSignOut}
          className="rounded-xl border-border bg-card/70 backdrop-blur-md text-foreground hover:bg-accent gap-1.5 h-9 px-3 transition-all active:scale-[0.97]"
        >
          <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Sign Out</span>
        </Button>
      </header>

      {/* Main Form Container */}
      <div className="w-full max-w-xl z-10 space-y-6 my-auto py-8">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-1 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            <span>SmartSapp Identity & Workforce</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Complete Your Profile
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
            Setup your organization link and member preferences to join your team workspace.
          </p>
        </div>

        {/* Stepper Progress Bar */}
        <div className="bg-card/85 border border-border backdrop-blur-md rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            {/* Step 1 Pill */}
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  step > 1
                    ? 'bg-emerald-500 text-white dark:text-black shadow-md shadow-emerald-500/20'
                    : step === 1
                    ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/20'
                    : 'bg-muted border border-border text-muted-foreground'
                }`}
              >
                {step > 1 ? <Check className="h-3.5 w-3.5" /> : '1'}
              </div>
              <span className={`hidden sm:inline ${step === 1 ? 'text-foreground font-semibold' : ''}`}>
                Organization
              </span>
            </div>

            {/* Track 1 */}
            <div className="flex-1 h-1 bg-muted mx-3 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-emerald-500"
                initial={{ width: '0%' }}
                animate={{ width: step >= 2 ? '100%' : '0%' }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Step 2 Pill */}
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  step > 2
                    ? 'bg-emerald-500 text-white dark:text-black shadow-md shadow-emerald-500/20'
                    : step === 2
                    ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/20'
                    : 'bg-muted border border-border text-muted-foreground'
                }`}
              >
                {step > 2 ? <Check className="h-3.5 w-3.5" /> : '2'}
              </div>
              <span className={`hidden sm:inline ${step === 2 ? 'text-foreground font-semibold' : ''}`}>
                Profile
              </span>
            </div>

            {/* Track 2 */}
            <div className="flex-1 h-1 bg-muted mx-3 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-emerald-500"
                initial={{ width: '0%' }}
                animate={{ width: step >= 3 ? '100%' : '0%' }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Step 3 Pill */}
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  step === 3
                    ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/20'
                    : 'bg-muted border border-border text-muted-foreground'
                }`}
              >
                3
              </div>
              <span className={`hidden sm:inline ${step === 3 ? 'text-foreground font-semibold' : ''}`}>
                Alerts
              </span>
            </div>
          </div>
        </div>

        {/* Main Step Card */}
        <Card className="rounded-3xl border-border bg-card/90 backdrop-blur-2xl shadow-2xl dark:shadow-emerald-950/20 relative overflow-hidden">
          {/* Glowing Top Ambient Accent */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />

          <CardHeader className="pt-7 pb-4 px-6 sm:px-8 text-center space-y-1.5">
            {isPreAssociatedOrg && validatedOrg && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium mx-auto mb-1">
                <Building2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Linked Organization: <strong className="text-foreground font-semibold">{validatedOrg.name}</strong></span>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
            )}

            <CardTitle className="text-xl sm:text-2xl font-bold flex items-center justify-center gap-2 text-foreground">
              {step === 1 && (
                <>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <span>Step 1: Link Organization</span>
                </>
              )}
              {step === 2 && (
                <>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <User className="h-4 w-4" />
                  </div>
                  <span>{isPreAssociatedOrg ? 'Configure Profile Details' : 'Step 2: Profile Settings'}</span>
                </>
              )}
              {step === 3 && (
                <>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Bell className="h-4 w-4" />
                  </div>
                  <span>{isPreAssociatedOrg ? 'Configure Alerts & Notifications' : 'Step 3: Alert Channels'}</span>
                </>
              )}
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs sm:text-sm">
              {step === 1 && 'Enter your organization code to identify your company and link your workspace.'}
              {step === 2 && (isPreAssociatedOrg ? `Verify your member profile details and department for ${validatedOrg?.name || 'your workspace'}.` : 'Fill in your name, contact phone number, and primary department.')}
              {step === 3 && 'Choose how and where you would like to receive workspace notifications.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 px-6 sm:px-8 min-h-[260px]">
            <AnimatePresence mode="wait">
              {/* STEP 1: ORGANIZATION LINK */}
              {step === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="joinCode" className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Organization Code or Token
                      </Label>
                      {codeFromLink && (
                        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 py-0">
                          From Invite Link
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="joinCode"
                          placeholder="e.g. smartsapp-hq, acme-corp, ORG-JOIN-CODE"
                          value={joinCode}
                          readOnly={codeFromLink && isValidatingCode}
                          onChange={(e) => {
                            setJoinCode(e.target.value);
                            setValidatedOrg(null);
                            setOrgDepartments(DEFAULT_DEPARTMENTS);
                            setCodeError('');
                          }}
                          onKeyDown={handleKeyDownValidate}
                          className="rounded-xl border-input bg-background pl-10 text-foreground placeholder:text-muted-foreground h-12 text-sm font-medium tracking-wide focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500"
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={handleValidateCode}
                        disabled={isValidatingCode || !joinCode.trim()}
                        className="rounded-xl font-semibold bg-emerald-500 hover:bg-emerald-600 text-white dark:text-black shrink-0 px-6 h-12 transition-all active:scale-[0.98] disabled:opacity-50"
                      >
                        {isValidatingCode ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                            Validating
                          </>
                        ) : (
                          'Validate'
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Validated Organization Preview Card */}
                  {validatedOrg && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 backdrop-blur-sm space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-600 dark:text-emerald-300 text-base">
                            {validatedOrg.name ? validatedOrg.name.charAt(0).toUpperCase() : 'O'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-foreground text-sm">{validatedOrg.name}</span>
                              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <p className="text-[11px] text-muted-foreground">Verified Organization Workspace</p>
                          </div>
                        </div>
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20 text-xs">
                          Ready to Link
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="text-[11px] text-muted-foreground mr-1">Available Departments:</span>
                        {(validatedOrg.departments || DEFAULT_DEPARTMENTS).slice(0, 4).map((dept) => (
                          <span key={dept} className="px-2 py-0.5 rounded-md bg-muted border border-border text-[10px] text-foreground">
                            {dept}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Error State */}
                  {codeError && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-2.5 p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300 text-xs"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                      <span>{codeError}</span>
                    </motion.div>
                  )}

                  {/* Helpful Info Accordion */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowHelp(!showHelp)}
                      className="text-xs text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1.5 transition-colors focus:outline-none"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      <span>Where do I find my organization join code?</span>
                    </button>
                    {showHelp && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-2 p-3 rounded-xl bg-muted/60 border border-border text-xs text-muted-foreground space-y-1"
                      >
                        <p>Your team administrator provides the join code or invite link in your onboarding email.</p>
                        <p>If your organization is new, your admin can find the token in <strong>Admin &gt; Settings &gt; Organizations</strong>.</p>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* STEP 2: PROFILE DETAILS */}
              {step === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {/* Mini Avatar Profile Banner */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/60 border border-border">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {userInitials}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-semibold text-foreground truncate">{user.email}</p>
                      <p className="text-[11px] text-muted-foreground">Authenticated Member Account</p>
                    </div>
                  </div>

                  {/* Assigned Workspaces Review Banner */}
                  {assignedWorkspaces.length > 0 && (
                    <div className="p-3.5 rounded-2xl border border-border bg-card/60 backdrop-blur-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          Assigned Workspaces
                        </span>
                        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 py-0">
                          {assignedWorkspaces.length} {assignedWorkspaces.length === 1 ? 'Workspace' : 'Workspaces'}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {assignedWorkspaces.map((ws) => (
                          <span
                            key={ws.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 border border-border text-xs font-medium text-foreground"
                          >
                            <Building2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            {ws.name}
                          </span>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Your administrator has provisioned your institutional access to the workspace(s) above.
                      </p>
                    </div>
                  )}

                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Full Name
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="fullName"
                        placeholder="e.g. Jane Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="rounded-xl border-input bg-background pl-10 text-foreground placeholder:text-muted-foreground h-12 text-sm focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Phone Number
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="e.g. +233 24 123 4567"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="rounded-xl border-input bg-background pl-10 text-foreground placeholder:text-muted-foreground h-12 text-sm focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Department */}
                  <div className="space-y-1.5">
                    <Label htmlFor="department" className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Department
                    </Label>
                    <div className="relative">
                      <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
                      <Select value={department} onValueChange={setDepartment}>
                        <SelectTrigger className="rounded-xl border-input bg-background pl-10 text-foreground h-12 text-sm focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500">
                          <SelectValue placeholder="Select Department" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border bg-popover text-popover-foreground shadow-2xl">
                          {orgDepartments.map((dept) => (
                            <SelectItem key={dept} value={dept} className="focus:bg-emerald-500/10 focus:text-emerald-600 dark:focus:text-emerald-300">
                              {dept}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: NOTIFICATIONS & PREFERENCES */}
              {step === 3 && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3 pt-1"
                >
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">Alert Preferences</span>
                    <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                      {activeChannelsCount} Active Channels
                    </Badge>
                  </div>

                  {/* Email Channel */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border bg-card hover:bg-accent/40 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="space-y-0.5 text-left">
                        <Label className="text-sm font-semibold text-foreground cursor-pointer">Email Alerts</Label>
                        <p className="text-[11px] text-muted-foreground">Invites, assignments, and summary digests</p>
                      </div>
                    </div>
                    <Switch checked={notifEmail} onCheckedChange={setNotifEmail} className="data-[state=checked]:bg-emerald-500" />
                  </div>

                  {/* SMS Channel */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border bg-card hover:bg-accent/40 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                        <MessageSquare className="h-4 w-4" />
                      </div>
                      <div className="space-y-0.5 text-left">
                        <Label className="text-sm font-semibold text-foreground cursor-pointer">SMS Alerts</Label>
                        <p className="text-[11px] text-muted-foreground">Urgent mobile notifications and security alerts</p>
                      </div>
                    </div>
                    <Switch checked={notifSms} onCheckedChange={setNotifSms} className="data-[state=checked]:bg-emerald-500" />
                  </div>

                  {/* In-App Notifications */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border bg-card hover:bg-accent/40 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <Bell className="h-4 w-4" />
                      </div>
                      <div className="space-y-0.5 text-left">
                        <Label className="text-sm font-semibold text-foreground cursor-pointer">In-App Notifications</Label>
                        <p className="text-[11px] text-muted-foreground">Live activity center in your admin topbar</p>
                      </div>
                    </div>
                    <Switch checked={notifInApp} onCheckedChange={setNotifInApp} className="data-[state=checked]:bg-emerald-500" />
                  </div>

                  {/* Browser Push */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border bg-card hover:bg-accent/40 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                        <Smartphone className="h-4 w-4" />
                      </div>
                      <div className="space-y-0.5 text-left">
                        <Label className="text-sm font-semibold text-foreground cursor-pointer">Browser Push</Label>
                        <p className="text-[11px] text-muted-foreground">Instant background alerts across devices</p>
                      </div>
                    </div>
                    <Switch checked={notifPush} onCheckedChange={setNotifPush} className="data-[state=checked]:bg-emerald-500" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>

          <CardFooter className="pb-7 pt-4 px-6 sm:px-8 flex items-center justify-between border-t border-border">
            {step > 1 && !(step === 2 && isPreAssociatedOrg) ? (
              <Button
                variant="outline"
                onClick={handleBackStep}
                className="rounded-xl border-border bg-card text-foreground hover:bg-accent gap-1.5 h-12 px-5 transition-all active:scale-[0.98]"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <Button
                onClick={handleNextStep}
                disabled={step === 1 && (!validatedOrg || isValidatingCode)}
                className="rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white dark:text-black gap-1.5 h-12 px-7 ml-auto shadow-lg shadow-emerald-500/10 transition-all active:scale-[0.98] disabled:opacity-40"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmitProfile}
                disabled={isSubmitting}
                className="rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white dark:text-black gap-2 h-12 px-8 ml-auto shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving Profile...
                  </>
                ) : (
                  <>
                    {isPreAssociatedOrg ? 'Complete Profile & Enter Dashboard' : 'Complete Registration'} <Check className="h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function ProfileSetupPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-9 w-9 text-emerald-500 animate-spin" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading Onboarding Portal...</p>
          </div>
        </div>
      }
    >
      <ProfileSetupContent />
    </React.Suspense>
  );
}
