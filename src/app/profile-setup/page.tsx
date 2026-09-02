'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser, useAuth } from '@/firebase';
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
  Loader2, ArrowRight, ArrowLeft, LogOut, CheckCircle2, 
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
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeParam = searchParams.get('code');
  const { toast } = useToast();

  const [codeFromLink, setCodeFromLink] = React.useState(false);
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

  // Auto-validate a code arriving from the invite link (or stashed before auth).
  const autoValidatedRef = React.useRef(false);
  React.useEffect(() => {
    if (!user || autoValidatedRef.current) return;
    const code = codeParam || (typeof window !== 'undefined' ? sessionStorage.getItem('pendingJoinCode') : null);
    if (!code) return;
    autoValidatedRef.current = true;
    setJoinCode(code);
    setCodeFromLink(true);
    void runValidation(code, { advanceOnSuccess: true });
  }, [user, codeParam]);

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
    if (step === 2) setStep(1);
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
        toast({
          title: 'Profile Completed Successfully',
          description: validatedOrg.isConfigured
            ? 'Your registration is complete and awaiting administrator approval.'
            : "Profile setup complete. Let's configure your organization.",
        });
        if (!validatedOrg.isConfigured) {
          router.push('/onboarding/setup');
        } else {
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

  if (isUserLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-9 w-9 text-emerald-500 animate-spin" />
          <p className="text-sm font-medium text-zinc-400 animate-pulse">Initializing Onboarding Portal...</p>
        </div>
      </div>
    );
  }

  const activeChannelsCount = [notifEmail, notifSms, notifInApp, notifPush].filter(Boolean).length;
  const userInitials = fullName
    ? fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center bg-[#09090b] text-zinc-100 p-4 sm:p-6 selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Background Ambient Lighting */}
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

      {/* Top Header Utilities */}
      <header className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 flex items-center gap-2.5">
        <ThemeToggle />
        <Button
          variant="outline"
          size="sm"
          onClick={handleSignOut}
          className="rounded-xl border-zinc-800 bg-zinc-900/60 backdrop-blur-md text-zinc-300 hover:text-white hover:bg-zinc-800 gap-1.5 h-9 px-3 transition-all active:scale-[0.97]"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">Sign Out</span>
        </Button>
      </header>

      {/* Main Form Container */}
      <div className="w-full max-w-xl z-10 space-y-6 my-auto py-8">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-1 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            <span>SmartSapp Identity & Workforce</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Complete Your Profile
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
            Setup your organization link and member preferences to join your team workspace.
          </p>
        </div>

        {/* Stepper Progress Bar */}
        <div className="bg-zinc-950/60 border border-zinc-800/80 backdrop-blur-md rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
            {/* Step 1 Pill */}
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  step > 1
                    ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                    : step === 1
                    ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 ring-2 ring-emerald-500/20'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-600'
                }`}
              >
                {step > 1 ? <Check className="h-3.5 w-3.5" /> : '1'}
              </div>
              <span className={`hidden sm:inline ${step === 1 ? 'text-white font-semibold' : ''}`}>
                Organization
              </span>
            </div>

            {/* Track 1 */}
            <div className="flex-1 h-1 bg-zinc-800 mx-3 rounded-full overflow-hidden">
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
                    ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                    : step === 2
                    ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 ring-2 ring-emerald-500/20'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-600'
                }`}
              >
                {step > 2 ? <Check className="h-3.5 w-3.5" /> : '2'}
              </div>
              <span className={`hidden sm:inline ${step === 2 ? 'text-white font-semibold' : ''}`}>
                Profile
              </span>
            </div>

            {/* Track 2 */}
            <div className="flex-1 h-1 bg-zinc-800 mx-3 rounded-full overflow-hidden">
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
                    ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 ring-2 ring-emerald-500/20'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-600'
                }`}
              >
                3
              </div>
              <span className={`hidden sm:inline ${step === 3 ? 'text-white font-semibold' : ''}`}>
                Alerts
              </span>
            </div>
          </div>
        </div>

        {/* Main Step Card */}
        <Card className="rounded-3xl border-zinc-800/80 bg-zinc-950/80 backdrop-blur-2xl shadow-2xl shadow-emerald-950/20 relative overflow-hidden">
          {/* Glowing Top Ambient Accent */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />

          <CardHeader className="pt-7 pb-4 px-6 sm:px-8 text-center space-y-1.5">
            <CardTitle className="text-xl sm:text-2xl font-bold flex items-center justify-center gap-2 text-white">
              {step === 1 && (
                <>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <span>Step 1: Link Organization</span>
                </>
              )}
              {step === 2 && (
                <>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <User className="h-4 w-4" />
                  </div>
                  <span>Step 2: Profile Settings</span>
                </>
              )}
              {step === 3 && (
                <>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Bell className="h-4 w-4" />
                  </div>
                  <span>Step 3: Alert Channels</span>
                </>
              )}
            </CardTitle>
            <CardDescription className="text-zinc-400 text-xs sm:text-sm">
              {step === 1 && 'Enter your organization code to identify your company and link your workspace.'}
              {step === 2 && 'Fill in your name, contact phone number, and primary department.'}
              {step === 3 && 'Choose how and where you would like to receive notifications.'}
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
                      <Label htmlFor="joinCode" className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                        Organization Code or Token
                      </Label>
                      {codeFromLink && (
                        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10 py-0">
                          From Invite Link
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
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
                          className="rounded-xl border-zinc-700/80 bg-zinc-900/90 pl-10 text-white placeholder:text-zinc-500 h-12 text-sm font-medium tracking-wide focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500"
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={handleValidateCode}
                        disabled={isValidatingCode || !joinCode.trim()}
                        className="rounded-xl font-semibold bg-emerald-500 hover:bg-emerald-600 text-black shrink-0 px-6 h-12 transition-all active:scale-[0.98] disabled:opacity-50"
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
                      className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 backdrop-blur-sm space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-300 text-base">
                            {validatedOrg.name ? validatedOrg.name.charAt(0).toUpperCase() : 'O'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-white text-sm">{validatedOrg.name}</span>
                              <ShieldCheck className="h-4 w-4 text-emerald-400" />
                            </div>
                            <p className="text-[11px] text-zinc-400">Verified Organization Workspace</p>
                          </div>
                        </div>
                        <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 text-xs">
                          Ready to Link
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="text-[11px] text-zinc-400 mr-1">Available Departments:</span>
                        {(validatedOrg.departments || DEFAULT_DEPARTMENTS).slice(0, 4).map((dept) => (
                          <span key={dept} className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300">
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
                      className="flex items-start gap-2.5 p-3.5 rounded-xl border border-red-500/30 bg-red-950/20 text-red-300 text-xs"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                      <span>{codeError}</span>
                    </motion.div>
                  )}

                  {/* Helpful Info Accordion */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowHelp(!showHelp)}
                      className="text-xs text-zinc-400 hover:text-emerald-400 flex items-center gap-1.5 transition-colors focus:outline-none"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      <span>Where do I find my organization join code?</span>
                    </button>
                    {showHelp && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-2 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 space-y-1"
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
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-bold text-emerald-400 text-sm">
                      {userInitials}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-semibold text-white truncate">{user.email}</p>
                      <p className="text-[11px] text-zinc-400">Authenticated Member Account</p>
                    </div>
                  </div>

                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                      Full Name
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <Input
                        id="fullName"
                        placeholder="e.g. Jane Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="rounded-xl border-zinc-700/80 bg-zinc-900/90 pl-10 text-white placeholder:text-zinc-500 h-12 text-sm focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                      Phone Number
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="e.g. +233 24 123 4567"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="rounded-xl border-zinc-700/80 bg-zinc-900/90 pl-10 text-white placeholder:text-zinc-500 h-12 text-sm focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Department */}
                  <div className="space-y-1.5">
                    <Label htmlFor="department" className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                      Department
                    </Label>
                    <div className="relative">
                      <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 z-10 pointer-events-none" />
                      <Select value={department} onValueChange={setDepartment}>
                        <SelectTrigger className="rounded-xl border-zinc-700/80 bg-zinc-900/90 pl-10 text-white h-12 text-sm focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500">
                          <SelectValue placeholder="Select Department" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-zinc-800 bg-zinc-950 text-white shadow-2xl">
                          {orgDepartments.map((dept) => (
                            <SelectItem key={dept} value={dept} className="focus:bg-emerald-500/10 focus:text-emerald-300">
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
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">Alert Preferences</span>
                    <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                      {activeChannelsCount} Active Channels
                    </Badge>
                  </div>

                  {/* Email Channel */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900/90 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="space-y-0.5 text-left">
                        <Label className="text-sm font-semibold text-white cursor-pointer">Email Alerts</Label>
                        <p className="text-[11px] text-zinc-400">Invites, assignments, and summary digests</p>
                      </div>
                    </div>
                    <Switch checked={notifEmail} onCheckedChange={setNotifEmail} className="data-[state=checked]:bg-emerald-500" />
                  </div>

                  {/* SMS Channel */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900/90 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                        <MessageSquare className="h-4 w-4" />
                      </div>
                      <div className="space-y-0.5 text-left">
                        <Label className="text-sm font-semibold text-white cursor-pointer">SMS Alerts</Label>
                        <p className="text-[11px] text-zinc-400">Urgent mobile notifications and security alerts</p>
                      </div>
                    </div>
                    <Switch checked={notifSms} onCheckedChange={setNotifSms} className="data-[state=checked]:bg-emerald-500" />
                  </div>

                  {/* In-App Notifications */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900/90 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <Bell className="h-4 w-4" />
                      </div>
                      <div className="space-y-0.5 text-left">
                        <Label className="text-sm font-semibold text-white cursor-pointer">In-App Notifications</Label>
                        <p className="text-[11px] text-zinc-400">Live activity center in your admin topbar</p>
                      </div>
                    </div>
                    <Switch checked={notifInApp} onCheckedChange={setNotifInApp} className="data-[state=checked]:bg-emerald-500" />
                  </div>

                  {/* Browser Push */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900/90 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                        <Smartphone className="h-4 w-4" />
                      </div>
                      <div className="space-y-0.5 text-left">
                        <Label className="text-sm font-semibold text-white cursor-pointer">Browser Push</Label>
                        <p className="text-[11px] text-zinc-400">Instant background alerts across devices</p>
                      </div>
                    </div>
                    <Switch checked={notifPush} onCheckedChange={setNotifPush} className="data-[state=checked]:bg-emerald-500" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>

          <CardFooter className="pb-7 pt-4 px-6 sm:px-8 flex items-center justify-between border-t border-zinc-800/60">
            {step > 1 ? (
              <Button
                variant="outline"
                onClick={handleBackStep}
                className="rounded-xl border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:text-white hover:bg-zinc-800 gap-1.5 h-12 px-5 transition-all active:scale-[0.98]"
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
                className="rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-black gap-1.5 h-12 px-7 ml-auto shadow-lg shadow-emerald-500/10 transition-all active:scale-[0.98] disabled:opacity-40"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmitProfile}
                disabled={isSubmitting}
                className="rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-black gap-2 h-12 px-8 ml-auto shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Completing Registration...
                  </>
                ) : (
                  <>
                    Complete Registration <Check className="h-4 w-4" />
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
        <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-9 w-9 text-emerald-500 animate-spin" />
            <p className="text-sm font-medium text-zinc-400 animate-pulse">Loading Onboarding Portal...</p>
          </div>
        </div>
      }
    >
      <ProfileSetupContent />
    </React.Suspense>
  );
}
