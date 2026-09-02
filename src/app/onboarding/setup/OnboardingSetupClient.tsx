'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth } from '@/firebase';
import { completeOrganizationOnboardingAction, getOnboardingSetupStateAction } from '@/app/actions/onboarding-actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Building2, Palette, Sparkles, Languages, Globe, Wallet, 
  CheckCircle2, Loader2, ArrowRight, ArrowLeft, LogOut, Check
} from 'lucide-react';
import LightRays from '@/components/LightRays';
import { ThemeToggle } from '@/components/theme-toggle';
import { ImageUploader } from '@/components/shared/image-uploader';
import { motion, AnimatePresence } from 'framer-motion';

const PRESET_COLORS = [
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Amber', hex: '#f59e0b' },
];

export default function OnboardingSetupClient() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = React.useState<4 | 5>(4);
  const [orgData, setOrgData] = React.useState<{ id: string; name: string } | null>(null);
  const [isInitializing, setIsInitializing] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // --- Step 4 States ---
  const [websiteUrl, setWebsiteUrl] = React.useState('');
  const [isScraping, setIsScraping] = React.useState(false);
  const [scrapeStep, setScrapeStep] = React.useState('');
  
  const [primaryColor, setPrimaryColor] = React.useState('#10b981');
  const [secondaryColor, setSecondaryColor] = React.useState('#3b82f6');
  const [fontFamily, setFontFamily] = React.useState('Inter');
  const [logoUrl, setLogoUrl] = React.useState('');
  
  const [defaultLanguage, setDefaultLanguage] = React.useState('en');
  const [timezone, setTimezone] = React.useState('UTC');
  const [currency, setCurrency] = React.useState('USD');

  // --- Step 5 States ---
  const [workspaceName, setWorkspaceName] = React.useState('');
  const [contactScope, setContactScope] = React.useState<'institution' | 'family' | 'person'>('person');
  const [industry, setIndustry] = React.useState<'SaaS' | 'SchoolEnrollment' | 'Law' | 'Marketing' | 'RealEstate' | 'Consultancy'>('Consultancy');

  // Load user and org status on mount
  React.useEffect(() => {
    if (isUserLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    const checkStatus = async () => {
      try {
        const res = await getOnboardingSetupStateAction(user.uid);

        if (!res.success) {
          toast({ variant: 'destructive', title: 'Setup Error', description: res.error || 'Could not load setup state.' });
          return;
        }

        if (res.state === 'no-profile') {
          router.push('/profile-setup');
          return;
        }

        if (res.state === 'already-configured') {
          router.push('/admin');
          return;
        }

        if (res.state === 'ready' && res.org) {
          setOrgData(res.org);
          setWorkspaceName(`${res.org.name} Workspace`);
        }
      } catch (err) {
        console.error('Failed to initialize onboarding setup:', err);
        const errorMessage = err instanceof Error ? err.message : 'Initialization failed.';
        toast({ variant: 'destructive', title: 'Setup Error', description: errorMessage });
      } finally {
        setIsInitializing(false);
      }
    };

    checkStatus();
  }, [user, isUserLoading, router]);

  // AI Seeding Assistant Simulation
  const handleAISeedBranding = async () => {
    if (!websiteUrl.trim()) {
      toast({ variant: 'destructive', title: 'Seeding Error', description: 'Please enter your organization domain or URL first.' });
      return;
    }

    setIsScraping(true);
    
    const steps = [
      'Resolving domain DNS...',
      'Extracting HTML metadata & tags...',
      'Analyzing stylesheets for primary brand colors...',
      'Detecting favicon & logo assets...',
      'Synthesizing workspace suggestions...'
    ];

    for (let i = 0; i < steps.length; i++) {
      setScrapeStep(steps[i]);
      await new Promise(r => setTimeout(r, 600));
    }

    try {
      const cleanDomain = websiteUrl.replace(/^https?:\/\//, '').split('/')[0];
      setLogoUrl(`https://logo.clearbit.com/${cleanDomain}`);
      setPrimaryColor('#10b981');
      setSecondaryColor('#3b82f6');
      
      toast({
        title: 'Brand Assets Extracted!',
        description: 'Generated brand styling from domain scan.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Seeding Warning',
        description: 'Could not automatically resolve brand logo. You can upload manually.',
      });
    } finally {
      setIsScraping(false);
      setScrapeStep('');
    }
  };

  const handleNextStep = () => {
    if (step === 4) setStep(5);
  };

  const handleBackStep = () => {
    if (step === 5) setStep(4);
  };

  const handleSubmitSetup = async () => {
    if (!orgData) return;

    if (!workspaceName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please enter a name for your initial workspace.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await completeOrganizationOnboardingAction({
        organizationId: orgData.id,
        branding: {
          primaryColor,
          secondaryColor,
          fontFamily,
          logoUrl,
        },
        localization: {
          defaultLanguage,
          timezone,
          currency,
        },
        workspace: {
          name: workspaceName,
          contactScope,
          industry,
        }
      });

      if (result.success) {
        toast({
          title: 'Organization Ready!',
          description: 'Branding and workspace initialized. Welcome to your admin dashboard.',
        });
        router.push('/admin');
      } else if (result.code === 'ALREADY_CONFIGURED') {
        toast({
          variant: 'destructive',
          title: 'Already Configured',
          description: 'Another administrator has already completed the organization setup. Redirecting you to awaiting approval.',
        });
        router.push('/awaiting-approval');
      } else {
        toast({
          variant: 'destructive',
          title: 'Setup Failed',
          description: result.error || 'Failed to complete organization onboarding.',
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred during onboarding completion.';
      toast({
        variant: 'destructive',
        title: 'System Error',
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await auth.signOut();
    router.push('/login');
  };

  if (isUserLoading || isInitializing || !orgData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-9 w-9 text-emerald-500 animate-spin" />
          <p className="text-sm font-medium text-zinc-400 animate-pulse">Initializing Organization Setup Wizard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center bg-[#09090b] text-zinc-100 p-4 sm:p-6 selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Background Ambient Glow */}
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

      <div className="w-full max-w-xl z-10 space-y-6 my-auto py-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-1 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Organization Provisioning</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Setup Organization Settings</h1>
          <p className="text-xs sm:text-sm text-zinc-400">Configure <strong>{orgData.name}</strong> and provision your primary workspace.</p>
        </div>

        {/* Wizard Stepper Progress */}
        <div className="bg-zinc-950/60 border border-zinc-800/80 backdrop-blur-md rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step > 4
                    ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                    : step === 4
                    ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 ring-2 ring-emerald-500/20'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-600'
                }`}
              >
                {step > 4 ? <Check className="h-3.5 w-3.5" /> : '1'}
              </div>
              <span className={step === 4 ? 'text-white font-semibold' : ''}>Branding & Localization</span>
            </div>

            <div className="flex-1 h-1 bg-zinc-800 mx-4 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-emerald-500"
                initial={{ width: '0%' }}
                animate={{ width: step === 5 ? '100%' : '0%' }}
                transition={{ duration: 0.3 }}
              />
            </div>

            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step === 5
                    ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 ring-2 ring-emerald-500/20'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-600'
                }`}
              >
                2
              </div>
              <span className={step === 5 ? 'text-white font-semibold' : ''}>Workspace Configuration</span>
            </div>
          </div>
        </div>

        <Card className="rounded-3xl border-zinc-800/80 bg-zinc-950/80 backdrop-blur-2xl shadow-2xl shadow-emerald-950/20 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
          
          <CardHeader className="pt-7 pb-4 px-6 sm:px-8 space-y-1.5">
            <CardTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-white">
              {step === 4 ? (
                <>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Palette className="h-4 w-4" />
                  </div>
                  <span>Branding & Localization</span>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <span>Workspace Configuration</span>
                </>
              )}
            </CardTitle>
            <CardDescription className="text-zinc-400 text-xs sm:text-sm">
              {step === 4 
                ? 'Set up your company details, logo, colors, and standard presets.' 
                : 'Configure the name, scope, and industry configuration of your primary workspace.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 px-6 sm:px-8 min-h-[300px]">
            <AnimatePresence mode="wait">
              {step === 4 && (
                <motion.div
                  key="org-step-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  {/* AI Seeding Assistant Card */}
                  <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm space-y-3">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-400">
                      <Sparkles className="h-4 w-4" />
                      <span>AI Seeding Assistant</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-normal">
                      Enter your organization website to scan and auto-configure logo assets, brand colors, and details instantly.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g. acme.com or https://acme-corp.com"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        className="rounded-xl border-zinc-700/80 bg-zinc-900/90 text-white placeholder:text-zinc-500 h-11 text-xs focus-visible:ring-emerald-500/30"
                        disabled={isScraping}
                      />
                      <Button
                        type="button"
                        onClick={handleAISeedBranding}
                        disabled={isScraping}
                        className="rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-black shrink-0 px-5 h-11 transition-all active:scale-[0.98]"
                      >
                        {isScraping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Scrape'}
                      </Button>
                    </div>
                    {isScraping && (
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-emerald-400 animate-pulse">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>{scrapeStep}</span>
                      </div>
                    )}
                  </div>

                  {/* Logo and Brand Color Pickers */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-zinc-300">Brand Logo</Label>
                      <ImageUploader
                        value={logoUrl || ''}
                        onChange={(url) => setLogoUrl(url)}
                        maxSizeMB={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-zinc-300">Primary Accent Color</Label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Input
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            className="rounded-xl border-zinc-700/80 bg-zinc-900/90 text-white h-11 text-xs pl-9 focus-visible:ring-emerald-500/30"
                          />
                          <div 
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-md border border-white/20 cursor-pointer overflow-hidden shadow-sm"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <input
                              type="color"
                              value={primaryColor}
                              onChange={(e) => setPrimaryColor(e.target.value)}
                              className="absolute opacity-0 inset-0 w-full h-full cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Preset Accent Colors */}
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">Preset Palettes</Label>
                    <div className="flex flex-wrap gap-2">
                      {PRESET_COLORS.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => setPrimaryColor(preset.hex)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                            primaryColor.toLowerCase() === preset.hex.toLowerCase()
                              ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400 shadow-sm shadow-emerald-500/20'
                              : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-900'
                          }`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: preset.hex }} />
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font and Presets Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1">
                        <Languages className="h-3.5 w-3.5 text-zinc-400" /> Language
                      </Label>
                      <Select value={defaultLanguage} onValueChange={setDefaultLanguage}>
                        <SelectTrigger className="rounded-xl border-zinc-700/80 bg-zinc-900/90 text-white h-11 text-xs">
                          <SelectValue placeholder="Select Language" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-zinc-800 text-white rounded-xl text-xs">
                          <SelectItem value="en">English (US)</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                          <SelectItem value="de">German</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1">
                        <Globe className="h-3.5 w-3.5 text-zinc-400" /> Timezone
                      </Label>
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger className="rounded-xl border-zinc-700/80 bg-zinc-900/90 text-white h-11 text-xs">
                          <SelectValue placeholder="Select Timezone" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-zinc-800 text-white rounded-xl text-xs">
                          <SelectItem value="UTC">UTC / GMT</SelectItem>
                          <SelectItem value="America/New_York">EST (New York)</SelectItem>
                          <SelectItem value="America/Los_Angeles">PST (Los Angeles)</SelectItem>
                          <SelectItem value="Europe/London">GMT+1 (London)</SelectItem>
                          <SelectItem value="Africa/Accra">GMT (Accra)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1">
                        <Wallet className="h-3.5 w-3.5 text-zinc-400" /> Currency
                      </Label>
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger className="rounded-xl border-zinc-700/80 bg-zinc-900/90 text-white h-11 text-xs">
                          <SelectValue placeholder="Select Currency" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-zinc-800 text-white rounded-xl text-xs">
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="EUR">EUR (€)</SelectItem>
                          <SelectItem value="GBP">GBP (£)</SelectItem>
                          <SelectItem value="GHS">GHS (₵)</SelectItem>
                          <SelectItem value="NGN">NGN (₦)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 5 && (
                <motion.div
                  key="org-step-5"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <Label htmlFor="workspaceName" className="text-xs font-bold uppercase tracking-wider text-zinc-300">Workspace Name *</Label>
                    <Input
                      id="workspaceName"
                      placeholder="e.g. Primary Workspace, Campus A"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      className="rounded-xl border-zinc-700/80 bg-zinc-900/90 text-white h-12 text-sm focus-visible:ring-emerald-500/30"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-zinc-300">Contact Scope Policy</Label>
                      <Select value={contactScope} onValueChange={(val) => setContactScope(val as 'institution' | 'family' | 'person')}>
                        <SelectTrigger className="rounded-xl border-zinc-700/80 bg-zinc-900/90 text-white h-12 text-xs">
                          <SelectValue placeholder="Select Contact Scope" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-zinc-800 text-white rounded-xl text-xs">
                          <SelectItem value="person">Person (Individuals)</SelectItem>
                          <SelectItem value="institution">Institution (Schools / Entities)</SelectItem>
                          <SelectItem value="family">Family (Household Groups)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-zinc-400 leading-normal mt-1">
                        Governs primary entity contact requirements across workflows.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-zinc-300">Industry Vertical</Label>
                      <Select value={industry} onValueChange={(val) => setIndustry(val as 'SaaS' | 'SchoolEnrollment' | 'Law' | 'Marketing' | 'RealEstate' | 'Consultancy')}>
                        <SelectTrigger className="rounded-xl border-zinc-700/80 bg-zinc-900/90 text-white h-12 text-xs">
                          <SelectValue placeholder="Select Industry" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-zinc-800 text-white rounded-xl text-xs">
                          <SelectItem value="SchoolEnrollment">School Enrollment</SelectItem>
                          <SelectItem value="SaaS">SaaS & Software</SelectItem>
                          <SelectItem value="Law">Law & Legal</SelectItem>
                          <SelectItem value="Marketing">Marketing Agency</SelectItem>
                          <SelectItem value="RealEstate">Real Estate</SelectItem>
                          <SelectItem value="Consultancy">Consultancy</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-zinc-400 leading-normal mt-1">
                        Scopes default workflows and terminology.
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-zinc-300 bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-start gap-2.5">
                    <Sparkles className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      Completing this step will configure <strong>{orgData.name}</strong>, create the <strong>{workspaceName}</strong> workspace, approve your account as <strong>Administrator</strong>, and open your command dashboard.
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>

          <CardFooter className="pb-7 pt-4 px-6 sm:px-8 flex items-center justify-between border-t border-zinc-800/60">
            {step === 5 ? (
              <Button 
                variant="outline" 
                onClick={handleBackStep} 
                disabled={isSubmitting}
                className="rounded-xl border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:text-white hover:bg-zinc-800 gap-1.5 h-12 px-5 transition-all active:scale-[0.98]"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            ) : (
              <div />
            )}

            {step === 4 ? (
              <Button 
                onClick={handleNextStep}
                className="rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-black gap-1.5 h-12 px-7 ml-auto shadow-lg shadow-emerald-500/10 transition-all active:scale-[0.98]"
              >
                Configure Workspace <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button 
                onClick={handleSubmitSetup}
                disabled={isSubmitting}
                className="rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-black gap-2 h-12 px-8 ml-auto shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Provisioning Workspace...
                  </>
                ) : (
                  <>
                    Complete Organization Setup <Check className="h-4 w-4" />
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
