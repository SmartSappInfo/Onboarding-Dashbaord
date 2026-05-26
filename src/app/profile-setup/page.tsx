'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
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
  Loader2, ArrowRight, ArrowLeft, LogOut, CheckCircle2, XCircle
} from 'lucide-react';
import LightRays from '@/components/LightRays';
import { ThemeToggle } from '@/components/theme-toggle';

const DEFAULT_DEPARTMENTS = ['General'];

export default function ProfileSetupPage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form State
  const [joinCode, setJoinCode] = React.useState('');
  const [isValidatingCode, setIsValidatingCode] = React.useState(false);
  const [validatedOrg, setValidatedOrg] = React.useState<{ id: string; name: string } | null>(null);
  const [codeError, setCodeError] = React.useState('');

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

  // Pre-fill name and email if available
  React.useEffect(() => {
    if (user) {
      if (user.displayName && !fullName) {
        setFullName(user.displayName);
      }
      if (user.phoneNumber && !phoneNumber) {
        setPhoneNumber(user.phoneNumber);
      }
    }
  }, [user]);

  // Auth Redirect Guard
  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const handleValidateCode = async () => {
    if (!joinCode.trim()) {
      setCodeError('Please enter a Join Code / Organization slug.');
      return;
    }

    setIsValidatingCode(true);
    setCodeError('');
    setValidatedOrg(null);

    try {
      const result = await validateJoinCodeAction(joinCode);
      if (result.success && result.organizationId && result.organizationName) {
        setValidatedOrg({
          id: result.organizationId,
          name: result.organizationName
        });
        const validDepts = result.departments || DEFAULT_DEPARTMENTS;
        setOrgDepartments(validDepts);
        if (!validDepts.includes(department)) {
          setDepartment('');
        }
        toast({
          title: 'Organization Found',
          description: `You are requesting to join: ${result.organizationName}`,
        });
      } else {
        setCodeError(result.error || 'Invalid code.');
      }
    } catch (e: any) {
      setCodeError(e.message || 'An error occurred during validation.');
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!validatedOrg) {
        toast({
          variant: 'destructive',
          title: 'Organization Required',
          description: 'Please validate your Join Code before proceeding.',
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
          description: 'Please enter your phone number.',
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
        name: fullName,
        phone: phoneNumber,
        department: department,
        organizationId: validatedOrg.id,
        notificationPreferences: {
          email: notifEmail,
          sms: notifSms,
          inApp: notifInApp,
          push: notifPush
        }
      });

      if (result.success) {
        toast({
          title: 'Profile Updated Successfully',
          description: 'Your registration is complete and awaiting administrator approval.',
        });
        router.push('/admin'); // Redirect to admin; guard will send them to /awaiting-approval
      } else {
        toast({
          variant: 'destructive',
          title: 'Submission Failed',
          description: result.error || 'Failed to submit profile.',
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'An error occurred.',
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
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm font-semibold text-muted-foreground animate-pulse">Loading Onboarding Wizard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center bg-[#09090b] text-white p-4">
      {/* Background Ambient Glow */}
      <LightRays
        raysOrigin="top-center"
        raysColor="#10b981"
        raysSpeed={1.2}
        lightSpread={0.6}
        rayLength={2.5}
        followMouse={false}
        pulsating
        fadeDistance={1}
        className="!absolute inset-0 opacity-40 pointer-events-none"
      />

      <div className="absolute top-4 right-4 z-20 flex items-center gap-3">
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out" className="rounded-xl text-muted-foreground hover:text-white hover:bg-white/5">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>

      <div className="w-full max-w-lg z-10 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight">Onboarding Registration</h1>
          <p className="text-sm text-muted-foreground">Setup your profile settings to join your school team</p>
        </div>

        {/* Stepper Progress */}
        <div className="flex items-center justify-between px-8 text-xs font-semibold text-muted-foreground">
          <div className="flex flex-col items-center space-y-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
              step >= 1 ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-border'
            }`}>
              {step > 1 ? <Check className="h-4 w-4" /> : '1'}
            </div>
            <span className={step === 1 ? 'text-white' : ''}>Organization</span>
          </div>
          <div className="flex-1 h-0.5 bg-border mx-2 relative">
            <div className="absolute inset-0 bg-emerald-500 transition-all duration-300" style={{
              width: step === 2 ? '50%' : step === 3 ? '100%' : '0%'
            }} />
          </div>
          <div className="flex flex-col items-center space-y-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
              step >= 2 ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-border'
            }`}>
              {step > 2 ? <Check className="h-4 w-4" /> : '2'}
            </div>
            <span className={step === 2 ? 'text-white' : ''}>Profile Details</span>
          </div>
          <div className="flex-1 h-0.5 bg-border mx-2 relative">
            <div className="absolute inset-0 bg-emerald-500 transition-all duration-300" style={{
              width: step === 3 ? '100%' : '0%'
            }} />
          </div>
          <div className="flex flex-col items-center space-y-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
              step >= 3 ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-border'
            }`}>
              '3'
            </div>
            <span className={step === 3 ? 'text-white' : ''}>Notifications</span>
          </div>
        </div>

        <Card className="rounded-2xl border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-emerald-500/20 via-emerald-500 to-emerald-500/20" />
          
          <CardHeader className="pt-8">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              {step === 1 && <Building2 className="h-5 w-5 text-emerald-500" />}
              {step === 2 && <User className="h-5 w-5 text-emerald-500" />}
              {step === 3 && <Bell className="h-5 w-5 text-emerald-500" />}
              {step === 1 && 'Step 1: Link Organization'}
              {step === 2 && 'Step 2: Profile Settings'}
              {step === 3 && 'Step 3: Alert Channels'}
            </CardTitle>
            <CardDescription className="text-white/60">
              {step === 1 && 'Enter your organization code or slug to identify your company.'}
              {step === 2 && 'Fill in your name, contact phone, and department.'}
              {step === 3 && 'Toggle how you would like to receive messages.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 min-h-[220px]">
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="joinCode" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Organization Code or Token</Label>
                  <div className="flex gap-2">
                    <Input
                      id="joinCode"
                      placeholder="e.g. smartsapp-hq, acme-corp, ORG-JOIN-CODE"
                      value={joinCode}
                      onChange={(e) => {
                        setJoinCode(e.target.value);
                        setValidatedOrg(null);
                        setOrgDepartments(DEFAULT_DEPARTMENTS);
                        setCodeError('');
                      }}
                      className="rounded-xl border-white/10 bg-white/5 text-white h-11 focus-visible:ring-emerald-500/30"
                    />
                    <Button 
                      type="button" 
                      onClick={handleValidateCode} 
                      disabled={isValidatingCode}
                      className="rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 px-6 h-11"
                    >
                      {isValidatingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Validate'}
                    </Button>
                  </div>
                </div>

                {validatedOrg && (
                  <div className="flex items-center gap-2 p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-sm">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <span>Linked to: <strong>{validatedOrg.name}</strong></span>
                  </div>
                )}

                {codeError && (
                  <div className="flex items-center gap-2 p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm">
                    <XCircle className="h-5 w-5 shrink-0" />
                    <span>{codeError}</span>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      placeholder="Jane Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="rounded-xl border-white/10 bg-white/5 pl-10 text-white h-11 focus-visible:ring-emerald-500/30"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+233XXXXXXXXX"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="rounded-xl border-white/10 bg-white/5 pl-10 text-white h-11 focus-visible:ring-emerald-500/30"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Department</Label>
                  <div className="relative">
                    <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
                    <Select value={department} onValueChange={setDepartment}>
                      <SelectTrigger className="rounded-xl border-white/10 bg-white/5 pl-10 text-white h-11 focus-visible:ring-emerald-500/30">
                        <SelectValue placeholder="Select Department" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-white/10 bg-slate-900 text-white">
                        {orgDepartments.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-white/5">
                  <div className="space-y-0.5 text-left">
                    <Label className="text-sm font-semibold">Email Alerts</Label>
                    <p className="text-[10px] text-muted-foreground">Receive workspace invites and updates via email</p>
                  </div>
                  <Switch checked={notifEmail} onCheckedChange={setNotifEmail} className="data-[state=checked]:bg-emerald-500" />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-white/5">
                  <div className="space-y-0.5 text-left">
                    <Label className="text-sm font-semibold">SMS Alerts</Label>
                    <p className="text-[10px] text-muted-foreground">Receive critical, instant mobile SMS notifications</p>
                  </div>
                  <Switch checked={notifSms} onCheckedChange={setNotifSms} className="data-[state=checked]:bg-emerald-500" />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-white/5">
                  <div className="space-y-0.5 text-left">
                    <Label className="text-sm font-semibold">In-App Notifications</Label>
                    <p className="text-[10px] text-muted-foreground">Render alerts in the navigation bar notifications center</p>
                  </div>
                  <Switch checked={notifInApp} onCheckedChange={setNotifInApp} className="data-[state=checked]:bg-emerald-500" />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-white/5">
                  <div className="space-y-0.5 text-left">
                    <Label className="text-sm font-semibold">Browser Push Notifications</Label>
                    <p className="text-[10px] text-muted-foreground">Allow instant system alerts in your browser</p>
                  </div>
                  <Switch checked={notifPush} onCheckedChange={setNotifPush} className="data-[state=checked]:bg-emerald-500" />
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="pb-8 pt-4 flex items-center justify-between">
            {step > 1 ? (
              <Button 
                variant="outline" 
                onClick={handleBackStep} 
                className="rounded-xl border-white/10 bg-transparent text-white hover:bg-white/5 gap-1.5 h-11 px-5"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            ) : (
              <div /> // Spacer
            )}

            {step < 3 ? (
              <Button 
                onClick={handleNextStep}
                className="rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-11 px-6 ml-auto"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button 
                onClick={handleSubmitProfile}
                disabled={isSubmitting}
                className="rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-black gap-1.5 h-11 px-8 ml-auto"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
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
