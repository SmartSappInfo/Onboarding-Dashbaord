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
  Upload, CheckCircle2, Loader2, ArrowRight, ArrowLeft, LogOut, Check
} from 'lucide-react';
import LightRays from '@/components/LightRays';
import { ThemeToggle } from '@/components/theme-toggle';

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
        // Server action (Admin SDK) — avoids client-SDK reads on this critical
        // path, which fail for pending users under security rules and whenever
        // the client cannot reach the Firestore backend (offline mode).
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
          // Set default workspace name based on org name
          setWorkspaceName(`${res.org.name} Workspace`);
        }
      } catch (err: any) {
        console.error('Failed to initialize onboarding setup:', err);
        toast({ variant: 'destructive', title: 'Setup Error', description: err.message || 'Initialization failed.' });
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
      'Seeding brand styling configurations...'
    ];

    for (let i = 0; i < steps.length; i++) {
      setScrapeStep(steps[i]);
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    // Generate responsive colors based on website url contents
    const cleanUrl = websiteUrl.toLowerCase();
    let seededPrimary = '#8b5cf6'; // default Violet
    let seededSecondary = '#3b82f6'; // default Blue

    if (cleanUrl.includes('google')) {
      seededPrimary = '#4285f4';
      seededSecondary = '#ea4335';
    } else if (cleanUrl.includes('vercel')) {
      seededPrimary = '#000000';
      seededSecondary = '#666666';
    } else if (cleanUrl.includes('github')) {
      seededPrimary = '#24292e';
      seededSecondary = '#2c974b';
    } else if (cleanUrl.includes('acme')) {
      seededPrimary = '#10b981'; // Emerald
      seededSecondary = '#f59e0b'; // Amber
    } else {
      // Pick a random preset
      const randomPreset = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
      seededPrimary = randomPreset.hex;
    }

    setPrimaryColor(seededPrimary);
    setSecondaryColor(seededSecondary);
    setFontFamily('Outfit');
    setIsScraping(false);
    setScrapeStep('');

    toast({
      title: 'AI Seeding Complete',
      description: 'We extracted brand guidelines from your website. You can customize them below.',
    });
  };

  // Handle Logo Upload (Base64)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File size too large', description: 'Logo size must be less than 2MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setLogoUrl(reader.result);
        toast({ title: 'Logo Uploaded', description: 'Your brand logo has been updated successfully.' });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleNextStep = () => {
    if (step === 4) {
      setStep(5);
    }
  };

  const handleBackStep = () => {
    if (step === 5) {
      setStep(4);
    }
  };

  const handleSubmitSetup = async () => {
    if (!user || !orgData) return;

    if (!workspaceName.trim()) {
      toast({ variant: 'destructive', title: 'Workspace Settings Required', description: 'Please enter a name for your first workspace.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await completeOrganizationOnboardingAction({
        userId: user.uid,
        organizationId: orgData.id,
        branding: {
          primaryColor,
          secondaryColor,
          logoUrl,
          fontFamily,
          settings: {
            defaultLanguage,
            timezone,
            currency,
          }
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
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'System Error',
        description: err.message || 'An error occurred during onboarding completion.',
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
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 text-[#10b981] animate-spin" />
          <p className="text-sm font-semibold text-muted-foreground animate-pulse">Initializing Setup Wizard...</p>
        </div>
      </div>
    );
  }

  const monogram = orgData.name ? orgData.name.charAt(0).toUpperCase() : 'S';

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

      <div className="w-full max-w-xl z-10 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight">Setup Organization Settings</h1>
          <p className="text-sm text-muted-foreground">Configure {orgData.name} and provision the first workspace.</p>
        </div>

        {/* Wizard Stepper Progress */}
        <div className="flex items-center justify-between px-16 text-xs font-semibold text-muted-foreground">
          <div className="flex flex-col items-center space-y-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
              step >= 4 ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-border'
            }`}>
              {step > 4 ? <Check className="h-4 w-4" /> : '4'}
            </div>
            <span className={step === 4 ? 'text-white font-bold' : ''}>Branding & Details</span>
          </div>
          <div className="flex-1 h-0.5 bg-border mx-2 relative">
            <div className="absolute inset-0 bg-emerald-500 transition-all duration-300" style={{
              width: step === 5 ? '100%' : '0%'
            }} />
          </div>
          <div className="flex flex-col items-center space-y-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
              step >= 5 ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-border'
            }`}>
              '5'
            </div>
            <span className={step === 5 ? 'text-white font-bold' : ''}>Workspace Configuration</span>
          </div>
        </div>

        <Card className="rounded-2xl border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-emerald-500/20 via-emerald-500 to-emerald-500/20" />
          
          <CardHeader className="pt-8">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              {step === 4 ? <Palette className="h-5 w-5 text-emerald-400" /> : <Building2 className="h-5 w-5 text-emerald-400" />}
              {step === 4 ? 'Step 4: Branding & Localization' : 'Step 5: Setup First Workspace'}
            </CardTitle>
            <CardDescription className="text-white/60">
              {step === 4 
                ? 'Set up your company details, logo, colors, and standard presets.' 
                : 'Configure the name, scope, and industry configuration of your primary workspace.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 min-h-[300px]">
            {step === 4 && (
              <div className="space-y-5">
                {/* AI Seeding Assistant Card */}
                <div className="p-4 rounded-xl border border-white/5 bg-white/5 space-y-3">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-400">
                    <Sparkles className="h-4 w-4" />
                    <span>AI Seeding Assistant</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    Enter your organization website to scan and auto-configure logo assets, brand colors, and details instantly.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. acme.com or https://acme-corp.com"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      className="rounded-xl border-white/10 bg-white/5 text-white h-10 text-xs focus-visible:ring-emerald-500/30"
                      disabled={isScraping}
                    />
                    <Button
                      type="button"
                      onClick={handleAISeedBranding}
                      disabled={isScraping}
                      className="rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 px-4 h-10"
                    >
                      {isScraping ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Scrape'}
                    </Button>
                  </div>
                  {isScraping && (
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-emerald-400 animate-pulse">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>{scrapeStep}</span>
                    </div>
                  )}
                </div>

                {/* Logo and Brand Color Pickers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Brand Logo</Label>
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-14 h-14 rounded-xl border border-white/10 flex items-center justify-center text-xl font-bold bg-white/5 overflow-hidden shrink-0 relative"
                        style={{ borderColor: primaryColor }}
                      >
                        {logoUrl ? (
                          <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                          <span style={{ color: primaryColor }}>{monogram}</span>
                        )}
                      </div>
                      <div className="relative flex-1">
                        <input
                          type="file"
                          id="logo-upload-input"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          onClick={() => document.getElementById('logo-upload-input')?.click()}
                          variant="outline"
                          className="w-full rounded-xl border-white/10 bg-transparent text-white hover:bg-white/5 text-xs h-10 gap-1.5"
                        >
                          <Upload className="h-3.5 w-3.5" /> Upload Image
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Primary Accent Color</Label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Input
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="rounded-xl border-white/10 bg-white/5 text-white h-10 text-xs pl-8 focus-visible:ring-emerald-500/30"
                        />
                        <div 
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded border border-white/10 cursor-pointer overflow-hidden"
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
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Select Preset Color</Label>
                  <div className="flex gap-2">
                    {PRESET_COLORS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => setPrimaryColor(preset.hex)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-semibold transition-all ${
                          primaryColor.toLowerCase() === preset.hex.toLowerCase()
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                            : 'border-white/5 bg-white/5 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.hex }} />
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font and Presets Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Languages className="h-3 w-3" /> Language
                    </Label>
                    <Select value={defaultLanguage} onValueChange={setDefaultLanguage}>
                      <SelectTrigger className="rounded-xl border-white/10 bg-white/5 text-white h-9 text-xs">
                        <SelectValue placeholder="Select Language" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white rounded-xl text-xs">
                        <SelectItem value="en">English (US)</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Globe className="h-3 w-3" /> Timezone
                    </Label>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger className="rounded-xl border-white/10 bg-white/5 text-white h-9 text-xs">
                        <SelectValue placeholder="Select Timezone" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white rounded-xl text-xs">
                        <SelectItem value="UTC">UTC / GMT</SelectItem>
                        <SelectItem value="America/New_York">EST (New York)</SelectItem>
                        <SelectItem value="America/Los_Angeles">PST (Los Angeles)</SelectItem>
                        <SelectItem value="Europe/London">GMT+1 (London)</SelectItem>
                        <SelectItem value="Africa/Accra">GMT (Accra)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Wallet className="h-3 w-3" /> Currency
                    </Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="rounded-xl border-white/10 bg-white/5 text-white h-9 text-xs">
                        <SelectValue placeholder="Select Currency" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white rounded-xl text-xs">
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="GHS">GHS (₵)</SelectItem>
                        <SelectItem value="NGN">NGN (₦)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="workspaceName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Workspace Name *</Label>
                  <Input
                    id="workspaceName"
                    placeholder="e.g. Primary Workspace, Campus A"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    className="rounded-xl border-white/10 bg-white/5 text-white h-11 focus-visible:ring-emerald-500/30"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contact Scope Policy</Label>
                    <Select value={contactScope} onValueChange={(val: any) => setContactScope(val)}>
                      <SelectTrigger className="rounded-xl border-white/10 bg-white/5 text-white h-11 text-xs">
                        <SelectValue placeholder="Select Contact Scope" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white rounded-xl text-xs">
                        <SelectItem value="person">Person (Individuals)</SelectItem>
                        <SelectItem value="institution">Institution (Schools / Entities)</SelectItem>
                        <SelectItem value="family">Family (Household Groups)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground leading-normal mt-1">
                      Governs which primary entity contacts are required during creation and workflow triggers.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Industry Vertical</Label>
                    <Select value={industry} onValueChange={(val: any) => setIndustry(val)}>
                      <SelectTrigger className="rounded-xl border-white/10 bg-white/5 text-white h-11 text-xs">
                        <SelectValue placeholder="Select Industry" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white rounded-xl text-xs">
                        <SelectItem value="SchoolEnrollment">School Enrollment</SelectItem>
                        <SelectItem value="SaaS">SaaS & Software</SelectItem>
                        <SelectItem value="Law">Law & Legal</SelectItem>
                        <SelectItem value="Marketing">Marketing Agency</SelectItem>
                        <SelectItem value="RealEstate">Real Estate</SelectItem>
                        <SelectItem value="Consultancy">Consultancy</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground leading-normal mt-1">
                      Scopes workflows and default terms dynamically. Once locked, this cannot be changed.
                    </p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground bg-emerald-500/5 border border-emerald-500/10 p-3.5 rounded-xl flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">📢 Setup Summary:</span>
                  <span>
                    Completing this step will configure {orgData.name}, create the <strong>{workspaceName}</strong> workspace, approve your user account, promote you to **Administrator**, and redirect you to the main control panel.
                  </span>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="pb-8 pt-4 flex items-center justify-between">
            {step === 5 ? (
              <Button 
                variant="outline" 
                onClick={handleBackStep} 
                disabled={isSubmitting}
                className="rounded-xl border-white/10 bg-transparent text-white hover:bg-white/5 gap-1.5 h-11 px-5"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            ) : (
              <div /> // Spacer
            )}

            {step === 4 ? (
              <Button 
                onClick={handleNextStep}
                className="rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-11 px-6 ml-auto"
              >
                Configure Workspace <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button 
                onClick={handleSubmitSetup}
                disabled={isSubmitting}
                className="rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-black gap-1.5 h-11 px-8 ml-auto"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Provisioning...
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
