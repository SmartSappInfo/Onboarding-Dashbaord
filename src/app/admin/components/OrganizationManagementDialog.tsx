'use client';

import * as React from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import type { Organization, AISeedResult } from '@/lib/types';
import { 
    Building, 
    Plus, 
    Trash2, 
    Pencil, 
    Loader2, 
    Upload,
    X,
    Globe,
    Mail,
    Phone,
    MapPin,
    Eye,
    EyeOff,
    Briefcase,
    Settings,
    Palette,
    Key,
    ChevronRight,
    ChevronLeft,
    Check,
    Sparkles,
    RefreshCw,
    XCircle,
    Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { saveOrganizationAction } from '@/lib/organization-actions';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import MediaSelectorTrigger from './MediaSelectorTrigger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AISeedPreview, ensureContrastReady } from './AISeedPreview';

// Flags and display names for languages
const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' }
];

// Flags and full names for countries
const COUNTRIES = [
  { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' }
];

const IANA_TIMEZONES: string[] = (() => {
    try {
        return Intl.supportedValuesOf('timeZone');
    } catch {
        return ['UTC', 'Africa/Accra', 'Africa/Lagos', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney'];
    }
})();

const getBrowserTimezone = (): string => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        return 'UTC';
    }
};

interface OrganizationManagementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    organization?: Organization | null;
}

type StepId = 'identity' | 'settings' | 'branding' | 'integrations';

export default function OrganizationManagementDialog({ 
    open, 
    onOpenChange, 
    organization 
}: OrganizationManagementDialogProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    const { activeWorkspaceId } = useTenant();
    
    const [isSaving, setIsSaving] = React.useState(false);
    const [currentStep, setCurrentStep] = React.useState<StepId>('identity');

    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [logoUrl, setLogoUrl] = React.useState('');
    const [website, setWebsite] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [phone, setPhone] = React.useState('');
    const [address, setAddress] = React.useState('');
    
    // Aesthetic Branding Customizations
    const [unsubscribeCopy, setUnsubscribeCopy] = React.useState('');
    const [brandPrimaryColor, setBrandPrimaryColor] = React.useState('#3B5FFF');
    const [brandSecondaryColor, setBrandSecondaryColor] = React.useState('#8B5CF6');
    const [brandFontFamily, setBrandFontFamily] = React.useState('Figtree');

    // AI Keys
    const [aiKeyMode, setAiKeyMode] = React.useState<'platform' | 'custom'>('platform');
    const [geminiApiKey, setGeminiApiKey] = React.useState('');
    const [openRouterApiKey, setOpenRouterApiKey] = React.useState('');
    const [openaiApiKey, setOpenaiApiKey] = React.useState('');
    const [claudeApiKey, setClaudeApiKey] = React.useState('');
    
    // SMS and Email Keys
    const [smsKeyMode, setSmsKeyMode] = React.useState<'platform' | 'custom'>('platform');
    const [mnotifyApiKey, setMnotifyApiKey] = React.useState('');
    const [emailKeyMode, setEmailKeyMode] = React.useState<'platform' | 'custom'>('platform');
    const [resendApiKey, setResendApiKey] = React.useState('');
    const [resendDomain, setResendDomain] = React.useState('');
    const [showSmsKeys, setShowSmsKeys] = React.useState(false);
    const [showEmailKeys, setShowEmailKeys] = React.useState(false);
    
    // UI State
    const [roles, setRoles] = React.useState<{ id: string; name: string }[]>([]);
    const [defaultRoleId, setDefaultRoleId] = React.useState('');
    const [showApiKeys, setShowApiKeys] = React.useState(false);

    // Settings
    const [defaultCurrency, setDefaultCurrency] = React.useState('USD');
    const [defaultTimezone, setDefaultTimezone] = React.useState('UTC');
    const [defaultLanguage, setDefaultLanguage] = React.useState('en');
    const [defaultCountryCode, setDefaultCountryCode] = React.useState('GH');

    // Departments Config
    const [departments, setDepartments] = React.useState<string[]>(['General']);
    const [newDept, setNewDept] = React.useState('');

    // AI Seeding states
    const [seedUrl, setSeedUrl] = React.useState('');
    const [isScraping, setIsScraping] = React.useState(false);
    const [seedResult, setSeedResult] = React.useState<AISeedResult | null>(null);
    const [scrapeError, setScrapeError] = React.useState<string | null>(null);
    const [logoUploading, setLogoUploading] = React.useState(false);

    const handleScrape = async () => {
        if (!seedUrl.trim()) return;
        setIsScraping(true);
        setSeedResult(null);
        setScrapeError(null);

        try {
            const response = await fetch('/api/organizations/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: seedUrl.trim() }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                setScrapeError(data.error || 'Extraction failed. Please try a different URL or enter details manually.');
                return;
            }

            setSeedResult(data.result as AISeedResult);
        } catch (err: any) {
            setScrapeError('Network error. Please check your connection and try again.');
        } finally {
            setIsScraping(false);
        }
    };

    const handleApplySeed = () => {
        if (!seedResult) return;

        // Apply fields atomically
        setName(prev => prev || seedResult.name);
        setDescription(prev => prev || seedResult.description);
        
        if (seedResult.brandPrimaryColor) {
            setBrandPrimaryColor(ensureContrastReady(seedResult.brandPrimaryColor));
        }
        if (seedResult.brandSecondaryColor) {
            setBrandSecondaryColor(ensureContrastReady(seedResult.brandSecondaryColor));
        }
        
        if (seedResult.country) {
            setDefaultCountryCode(seedResult.country.toUpperCase());
        }
        if (seedResult.language) {
            setDefaultLanguage(seedResult.language.toLowerCase());
        }

        // Set logo URL optimistically
        setLogoUrl(seedResult.logoUrl);

        // Check if logo needs proxy upload
        if (seedResult.logoUrl && seedResult.logoUrl.startsWith('http')) {
            setLogoUploading(true);
            const targetOrgId = organization?.id || 'pending';
            fetch('/api/organizations/upload-logo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: seedResult.logoUrl, organizationId: targetOrgId }),
            })
            .then(res => res.json())
            .then(data => {
                if (data.success && data.storageUrl) {
                    setLogoUrl(data.storageUrl);
                }
            })
            .catch(err => {
                console.warn('Background logo upload failed:', err);
            })
            .finally(() => {
                setLogoUploading(false);
            });
        }

        toast({
            title: '✨ AI Seeding Applied',
            description: 'Brand colors and organization details have been pre-filled from your website.',
        });
        setSeedResult(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleScrape();
        }
    };

    const handleAddDepartment = () => {
        const cleanDept = newDept.trim();
        if (!cleanDept) return;

        if (cleanDept.length > 50) {
            toast({
                variant: 'destructive',
                title: 'Department Name Too Long',
                description: 'Department name must be 50 characters or less.'
            });
            return;
        }

        if (departments.some(d => d.toLowerCase() === cleanDept.toLowerCase())) {
            toast({
                variant: 'destructive',
                title: 'Duplicate Department',
                description: `"${cleanDept}" already exists in the departments list.`
            });
            return;
        }

        setDepartments([...departments, cleanDept]);
        setNewDept('');
    };

    const handleRemoveDepartment = (deptToRemove: string) => {
        setDepartments(departments.filter(d => d !== deptToRemove));
    };

    React.useEffect(() => {
        setCurrentStep('identity');
        setSeedUrl('');
        setSeedResult(null);
        setScrapeError(null);
        setLogoUploading(false);
        if (organization) {
            setName(organization.name);
            setDescription(organization.description || '');
            setLogoUrl(organization.logoUrl || '');
            setWebsite(organization.website || '');
            setEmail(organization.email || '');
            setPhone(organization.phone || '');
            setAddress(organization.address || '');
            setDefaultCurrency(organization.settings?.defaultCurrency || 'USD');
            setDefaultTimezone(organization.settings?.defaultTimezone || 'UTC');
            setDefaultLanguage(organization.settings?.defaultLanguage || 'en');
            setDefaultCountryCode(organization.defaultCountryCode || 'GH');
            
            // Aesthetic customizations
            setUnsubscribeCopy(organization.unsubscribeCopy || '');
            setBrandPrimaryColor(organization.brandPrimaryColor || '#3B5FFF');
            setBrandSecondaryColor(organization.brandSecondaryColor || '#8B5CF6');
            setBrandFontFamily(organization.brandFontFamily || 'Figtree');

            setAiKeyMode(organization.aiKeyMode || 'platform');
            setGeminiApiKey(organization.geminiApiKey || '');
            setOpenRouterApiKey(organization.openRouterApiKey || '');
            setOpenaiApiKey(organization.openaiApiKey || '');
            setClaudeApiKey(organization.claudeApiKey || '');
            setSmsKeyMode(organization.smsKeyMode || 'platform');
            setMnotifyApiKey(organization.mnotifyApiKey || '');
            setEmailKeyMode(organization.emailKeyMode || 'platform');
            setResendApiKey(organization.resendApiKey || '');
            setResendDomain(organization.resendDomain || '');
            setDefaultRoleId(organization.defaultRoleId || '');
            setDepartments(organization.departments && organization.departments.length > 0 ? organization.departments : ['General']);
        } else {
            // Reset for new organization
            setName('');
            setDescription('');
            setLogoUrl('');
            setWebsite('');
            setEmail('');
            setPhone('');
            setAddress('');
            setDefaultCurrency('USD');
            setDefaultTimezone(getBrowserTimezone());
            setDefaultLanguage('en');
            setDefaultCountryCode('GH');
            setDefaultRoleId('');
            setDepartments(['General']);
            setNewDept('');

            // Reset aesthetic customizations
            setUnsubscribeCopy('');
            setBrandPrimaryColor('#3B5FFF');
            setBrandSecondaryColor('#8B5CF6');
            setBrandFontFamily('Figtree');

            setAiKeyMode('platform');
            setGeminiApiKey('');
            setOpenRouterApiKey('');
            setOpenaiApiKey('');
            setClaudeApiKey('');
            setSmsKeyMode('platform');
            setMnotifyApiKey('');
            setEmailKeyMode('platform');
            setResendApiKey('');
            setResendDomain('');
        }
    }, [organization, open]);

    // Load Organization Roles
    React.useEffect(() => {
        async function loadRoles() {
            if (!firestore || !organization?.id || !open) return;
            try {
                const q = query(collection(firestore, 'roles'), where('organizationId', '==', organization.id));
                const snap = await getDocs(q);
                const roleList = snap.docs.map(d => ({ id: d.id, name: d.data().name }));
                setRoles(roleList);
            } catch (err) {
                console.error('Error loading roles for settings:', err);
            }
        }
        loadRoles();
    }, [firestore, organization?.id, open]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !name.trim()) return;
        setIsSaving(true);

        const result = await saveOrganizationAction(
            organization?.id || null,
            { 
                name: name.trim(), 
                description: description.trim(),
                logoUrl: logoUrl.trim(),
                website: website.trim(),
                email: email.trim(),
                phone: phone.trim(),
                address: address.trim(),
                settings: {
                    defaultCurrency,
                    defaultTimezone,
                    defaultLanguage,
                },
                defaultCountryCode,
                defaultRoleId,
                departments: departments.length > 0 ? departments : ['General'],
                unsubscribeCopy: unsubscribeCopy.trim(),
                brandPrimaryColor: brandPrimaryColor.trim(),
                brandSecondaryColor: brandSecondaryColor.trim(),
                brandFontFamily: brandFontFamily.trim(),
                aiKeyMode,
                geminiApiKey: geminiApiKey.trim(),
                openRouterApiKey: openRouterApiKey.trim(),
                openaiApiKey: openaiApiKey.trim(),
                claudeApiKey: claudeApiKey.trim(),
                smsKeyMode,
                mnotifyApiKey: mnotifyApiKey.trim(),
                emailKeyMode,
                resendApiKey: resendApiKey.trim(),
                resendDomain: resendDomain.trim()
            },
            user.uid
        );

        if (result.success) {
            toast({ 
                title: organization ? 'Organization Updated' : 'Organization Created', 
                description: 'Organization saved successfully.' 
            });
            onOpenChange(false);
        } else {
            toast({ variant: 'destructive', title: 'Save Failed', description: result.error });
        }
        setIsSaving(false);
    };

    const steps = [
        { id: 'identity', label: 'Profile', icon: Building },
        { id: 'settings', label: 'Regional settings', icon: Settings },
        { id: 'branding', label: 'Branding', icon: Palette },
        { id: 'integrations', label: 'Integrations', icon: Key }
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem]">
                <form onSubmit={handleSave} className="flex flex-col h-full text-left">
                    <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary text-white rounded-2xl shadow-xl">
                                    <Building className="h-6 w-6" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-semibold tracking-tight">
                                        {organization ? 'Edit Organization' : 'New Organization'}
                                    </DialogTitle>
                                    <DialogDescription className="text-xs font-bold text-muted-foreground">
                                        Configure organization profile, regional configs, and API keys.
                                    </DialogDescription>
                                </div>
                            </div>
                        </div>

                        {/* Stepper Progress bar */}
                        <div className="flex items-center justify-between mt-6 px-1.5 select-none">
                            {steps.map((s, idx) => {
                                const Icon = s.icon;
                                const isActive = currentStep === s.id;
                                const isPast = steps.findIndex(x => x.id === currentStep) > idx;
                                return (
                                    <React.Fragment key={s.id}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (name.trim() || s.id === 'identity') {
                                                    setCurrentStep(s.id as StepId);
                                                }
                                            }}
                                            className="flex flex-col items-center gap-2 cursor-pointer outline-none group"
                                        >
                                            <div className={`h-8 w-8 rounded-xl flex items-center justify-center transition-all duration-300 border-2 ${
                                                isActive 
                                                    ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-105' 
                                                    : isPast 
                                                        ? 'bg-primary/10 border-primary/20 text-primary' 
                                                        : 'bg-muted/50 border-muted text-muted-foreground'
                                            }`}>
                                                {isPast ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                                            </div>
                                            <span className={`text-[10px] font-bold tracking-wider ${isActive ? 'text-primary' : 'text-muted-foreground/60'}`}>
                                                {s.label}
                                            </span>
                                        </button>
                                        {idx < steps.length - 1 && (
                                            <div className={`flex-1 h-0.5 mx-2 rounded transition-all duration-300 ${
                                                steps.findIndex(x => x.id === currentStep) > idx ? 'bg-primary' : 'bg-muted'
                                            }`} />
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-hidden relative bg-background">
                        <ScrollArea className="h-full">
                            <div className="p-8 space-y-8 animate-fade-in">
                                {currentStep === 'identity' && (
                                    <div className="space-y-6">
                                        <h4 className="text-xs font-semibold text-primary uppercase tracking-widest">Organization Profile</h4>
                                        
                                        {/* AI Website Seeding Assistant */}
                                        <Card className="rounded-[2rem] border border-violet-200 dark:border-violet-800/50 shadow-sm overflow-hidden bg-gradient-to-br from-violet-50/50 to-indigo-50/30 dark:from-violet-950/20 dark:to-indigo-950/10">
                                            <CardHeader className="p-6 pb-4 border-b border-violet-200/60 dark:border-violet-800/40">
                                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                                    <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/60">
                                                        <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                                                    </div>
                                                    AI Seeding Assistant
                                                    <span className="ml-auto text-[9px] font-black text-violet-500 uppercase tracking-widest bg-violet-100 dark:bg-violet-900/50 px-2 py-0.5 rounded-full">
                                                        Beta
                                                    </span>
                                                </CardTitle>
                                                <CardDescription className="text-xs text-muted-foreground/80 flex items-start gap-1.5">
                                                    <Info className="h-3 w-3 mt-0.5 flex-shrink-0 text-violet-400" />
                                                    Enter your organization's website URL and let AI automatically extract your brand colors, logo, and localization settings.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="p-6 space-y-4">
                                                {/* URL Input row */}
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
                                                        <Input
                                                            type="url"
                                                            value={seedUrl}
                                                            onChange={(e) => setSeedUrl(e.target.value)}
                                                            onKeyDown={handleKeyDown}
                                                            placeholder="https://yourcompany.com"
                                                            className="h-11 pl-10 rounded-xl bg-background/70 border-violet-200 dark:border-violet-800/60 font-medium text-sm shadow-inner text-foreground"
                                                            disabled={isScraping}
                                                        />
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        onClick={handleScrape}
                                                        disabled={isScraping || !seedUrl.trim()}
                                                        className="h-11 px-5 rounded-xl font-bold text-sm gap-2 bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20 transition-all shrink-0"
                                                    >
                                                        {isScraping ? (
                                                            <>
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                Extracting…
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Sparkles className="h-4 w-4" />
                                                                Extract Assets
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>

                                                {/* Error state */}
                                                {scrapeError && !isScraping && (
                                                    <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-destructive/8 border border-destructive/20 text-xs text-destructive font-medium animate-in fade-in slide-in-from-top-1 duration-200">
                                                        <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                                        <span>{scrapeError}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setScrapeError(null)}
                                                            className="ml-auto text-destructive/60 hover:text-destructive transition-colors animate-none"
                                                            aria-label="Dismiss error"
                                                        >
                                                            <RefreshCw className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Loading skeleton */}
                                                {isScraping && (
                                                    <div className="rounded-2xl border border-violet-200/60 p-5 space-y-3 animate-pulse">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-14 h-14 rounded-xl bg-muted/60" />
                                                            <div className="flex-1 space-y-2">
                                                                <div className="h-3 bg-muted/60 rounded-full w-1/3" />
                                                                <div className="h-2.5 bg-muted/40 rounded-full w-2/3" />
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-3">
                                                            <div className="h-7 w-28 bg-muted/50 rounded-lg" />
                                                            <div className="h-7 w-28 bg-muted/50 rounded-lg" />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Seed preview */}
                                                {seedResult && !isScraping && (
                                                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                        <AISeedPreview
                                                            seed={seedResult}
                                                            onApply={handleApplySeed}
                                                            onDismiss={() => setSeedResult(null)}
                                                        />
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>

                                        {logoUploading && (
                                            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl text-xs font-semibold text-muted-foreground animate-pulse">
                                                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                                Uploading brand assets securely to Firebase Storage...
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                                    Organization Name *
                                                </Label>
                                                <Input 
                                                    value={name} 
                                                    onChange={e => setName(e.target.value)} 
                                                    placeholder="e.g. Acme Corporation" 
                                                    className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-bold text-lg px-4" 
                                                    required 
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                                    Organization Logo
                                                </Label>
                                                <MediaSelectorTrigger 
                                                    value={logoUrl}
                                                    onSelect={setLogoUrl}
                                                    label="Upload Organization Logo"
                                                    workspaceId={activeWorkspaceId}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                                Description
                                            </Label>
                                            <Textarea 
                                                value={description} 
                                                onChange={e => setDescription(e.target.value)} 
                                                placeholder="Brief description of the organization..." 
                                                className="min-h-[90px] rounded-2xl bg-muted/20 border-none shadow-inner p-4 font-medium leading-relaxed animate-none" 
                                            />
                                        </div>

                                        <Separator className="opacity-50" />

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1 flex items-center gap-1.5">
                                                    <Globe className="h-3 w-3" /> Website
                                                </Label>
                                                <Input 
                                                    value={website} 
                                                    onChange={e => setWebsite(e.target.value)} 
                                                    placeholder="https://example.com" 
                                                    type="url"
                                                    className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1 flex items-center gap-1.5">
                                                    <Mail className="h-3 w-3" /> Email Address
                                                </Label>
                                                <Input 
                                                    value={email} 
                                                    onChange={e => setEmail(e.target.value)} 
                                                    placeholder="contact@example.com" 
                                                    type="email"
                                                    className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1 flex items-center gap-1.5">
                                                    <Phone className="h-3 w-3" /> Support Phone
                                                </Label>
                                                <Input 
                                                    value={phone} 
                                                    onChange={e => setPhone(e.target.value)} 
                                                    placeholder="+1 (555) 123-4567" 
                                                    type="tel"
                                                    className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1 flex items-center gap-1.5">
                                                    <MapPin className="h-3 w-3" /> Headquarters Address
                                                </Label>
                                                <Input 
                                                    value={address} 
                                                    onChange={e => setAddress(e.target.value)} 
                                                    placeholder="123 Main St, City, Country" 
                                                    className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {currentStep === 'settings' && (
                                    <div className="space-y-6">
                                        <h4 className="text-xs font-semibold text-primary uppercase tracking-widest">Regional Config & Defaults</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                                    Default Language
                                                </Label>
                                                <select
                                                    value={defaultLanguage}
                                                    onChange={e => setDefaultLanguage(e.target.value)}
                                                    className="h-11 w-full rounded-xl bg-muted/20 border-none shadow-inner font-semibold px-4 text-sm"
                                                >
                                                    {LANGUAGES.map(lang => (
                                                        <option key={lang.code} value={lang.code}>
                                                            {lang.flag} {lang.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                                    Default Country
                                                </Label>
                                                <select 
                                                    value={defaultCountryCode}
                                                    onChange={e => setDefaultCountryCode(e.target.value)}
                                                    className="h-11 w-full rounded-xl bg-muted/20 border-none shadow-inner font-semibold px-4 text-sm"
                                                >
                                                    {COUNTRIES.map(c => (
                                                        <option key={c.code} value={c.code}>
                                                            {c.flag} {c.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                                    Currency
                                                </Label>
                                                <Input 
                                                    value={defaultCurrency} 
                                                    onChange={e => setDefaultCurrency(e.target.value)} 
                                                    placeholder="USD" 
                                                    className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-semibold px-4" 
                                                />
                                            </div>

                                            <div className="space-y-2 md:col-span-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                                    Timezone
                                                </Label>
                                                <select 
                                                    value={defaultTimezone}
                                                    onChange={e => setDefaultTimezone(e.target.value)}
                                                    className="h-11 w-full rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4 text-sm"
                                                >
                                                    {IANA_TIMEZONES.map(tz => (
                                                        <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <Separator className="opacity-50" />

                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                                Default Provisioning Role (New Invites)
                                            </Label>
                                            <select 
                                                value={defaultRoleId}
                                                onChange={e => setDefaultRoleId(e.target.value)}
                                                className="h-11 w-full rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4 text-sm"
                                            >
                                                <option value="">No Default (Manual Selection Required)</option>
                                                {roles.map(r => (
                                                    <option key={r.id} value={r.id}>{r.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <Separator className="opacity-50" />

                                        {/* Departments config */}
                                        <div className="space-y-4">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Onboarding Departments</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    value={newDept}
                                                    onChange={e => setNewDept(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleAddDepartment();
                                                        }
                                                    }}
                                                    placeholder="Add department (e.g. Sales, Marketing)..."
                                                    className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4 flex-1 animate-none"
                                                />
                                                <Button
                                                    type="button"
                                                    onClick={handleAddDepartment}
                                                    className="h-11 rounded-xl font-semibold bg-primary text-white hover:bg-primary/90 px-5 shrink-0"
                                                >
                                                    Add
                                                </Button>
                                            </div>

                                            <div className="flex flex-wrap gap-2 p-4 rounded-2xl bg-muted/10 border border-border/50 min-h-[60px]">
                                                {departments.length === 0 ? (
                                                    <span className="text-xs text-muted-foreground italic">No custom departments configured. Defaults to General.</span>
                                                ) : (
                                                    departments.map((dept, idx) => (
                                                        <Badge
                                                            key={dept}
                                                            variant="secondary"
                                                            className="pl-3 pr-2 py-1 bg-muted/50 border border-border rounded-xl text-xs font-semibold flex items-center gap-1.5 group hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-all animate-fade-in duration-300"
                                                            style={{ animationDelay: `${idx * 40}ms` }}
                                                        >
                                                            {dept}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveDepartment(dept)}
                                                                className="w-4 h-4 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </Badge>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {currentStep === 'branding' && (
                                    <div className="space-y-6">
                                        <h4 className="text-xs font-semibold text-primary uppercase tracking-widest">Brand Styling & Layouts</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                                    Primary Accent Color
                                                </Label>
                                                <div className="flex gap-2">
                                                    <Input 
                                                        type="color" 
                                                        value={brandPrimaryColor} 
                                                        onChange={e => setBrandPrimaryColor(e.target.value)} 
                                                        className="w-12 h-11 p-1 bg-muted/20 border-none cursor-pointer rounded-xl" 
                                                    />
                                                    <Input 
                                                        value={brandPrimaryColor} 
                                                        onChange={e => setBrandPrimaryColor(e.target.value)} 
                                                        placeholder="#3B5FFF" 
                                                        className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4 flex-1" 
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                                    Secondary Accent Color
                                                </Label>
                                                <div className="flex gap-2">
                                                    <Input 
                                                        type="color" 
                                                        value={brandSecondaryColor} 
                                                        onChange={e => setBrandSecondaryColor(e.target.value)} 
                                                        className="w-12 h-11 p-1 bg-muted/20 border-none cursor-pointer rounded-xl" 
                                                    />
                                                    <Input 
                                                        value={brandSecondaryColor} 
                                                        onChange={e => setBrandSecondaryColor(e.target.value)} 
                                                        placeholder="#8B5CF6" 
                                                        className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4 flex-1" 
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                                    Typography Font Family
                                                </Label>
                                                <select 
                                                    value={brandFontFamily}
                                                    onChange={e => setBrandFontFamily(e.target.value)}
                                                    className="h-11 w-full rounded-xl bg-muted/20 border-none shadow-inner font-semibold px-4 text-sm"
                                                >
                                                    <option value="Figtree">Figtree</option>
                                                    <option value="Inter">Inter</option>
                                                    <option value="Roboto">Roboto</option>
                                                    <option value="Outfit">Outfit</option>
                                                    <option value="Montserrat">Montserrat</option>
                                                </select>
                                            </div>
                                        </div>

                                        <Separator className="opacity-50" />

                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                                Unsubscribe compliance text (Max 300 characters)
                                            </Label>
                                            <Textarea 
                                                value={unsubscribeCopy} 
                                                onChange={e => {
                                                    if (e.target.value.length <= 300) {
                                                        setUnsubscribeCopy(e.target.value);
                                                    }
                                                }} 
                                                placeholder="You are receiving this email because you registered on our platform..." 
                                                className="min-h-[80px] rounded-2xl bg-muted/20 border-none shadow-inner p-4 font-medium leading-relaxed animate-none" 
                                            />
                                            <div className="text-[9px] text-muted-foreground text-right font-bold">
                                                {unsubscribeCopy.length}/300 characters
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {currentStep === 'integrations' && (
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-semibold text-primary uppercase tracking-widest">AI Services & API Keys</h4>
                                            {aiKeyMode === 'custom' && (
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    onClick={() => setShowApiKeys(!showApiKeys)}
                                                    className="h-6 text-xs text-muted-foreground hover:text-foreground"
                                                >
                                                    {showApiKeys ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                                                    {showApiKeys ? 'Hide Keys' : 'Show Keys'}
                                                </Button>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                                AI Key Routing Mode
                                            </Label>
                                            <select 
                                                value={aiKeyMode}
                                                onChange={e => setAiKeyMode(e.target.value as 'platform' | 'custom')}
                                                className="h-11 w-full rounded-xl bg-muted/20 border-none shadow-inner font-semibold px-4 text-sm"
                                            >
                                                <option value="platform">System Defaults (Shared Account Billing)</option>
                                                <option value="custom">Custom Keys (Deduct from local tenant keys)</option>
                                            </select>
                                        </div>

                                        {aiKeyMode === 'custom' && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-border/50">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Gemini API Key</Label>
                                                    <Input 
                                                        value={geminiApiKey} 
                                                        onChange={e => setGeminiApiKey(e.target.value)} 
                                                        placeholder="AIza..." 
                                                        type={showApiKeys ? "text" : "password"}
                                                        className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">OpenRouter Key</Label>
                                                    <Input 
                                                        value={openRouterApiKey} 
                                                        onChange={e => setOpenRouterApiKey(e.target.value)} 
                                                        placeholder="sk-or-v1-..." 
                                                        type={showApiKeys ? "text" : "password"}
                                                        className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">OpenAI API Key</Label>
                                                    <Input 
                                                        value={openaiApiKey} 
                                                        onChange={e => setOpenaiApiKey(e.target.value)} 
                                                        placeholder="sk-..." 
                                                        type={showApiKeys ? "text" : "password"}
                                                        className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Anthropic Key (Claude)</Label>
                                                    <Input 
                                                        value={claudeApiKey} 
                                                        onChange={e => setClaudeApiKey(e.target.value)} 
                                                        placeholder="sk-ant-..." 
                                                        type={showApiKeys ? "text" : "password"}
                                                        className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* SMS Integrations */}
                                        <div className="pt-6 border-t border-border/40 space-y-6">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-semibold text-orange-500 uppercase tracking-widest">SMS Gateway (mNotify)</h4>
                                                {smsKeyMode === 'custom' && (
                                                    <Button 
                                                        type="button" 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        onClick={() => setShowSmsKeys(!showSmsKeys)}
                                                        className="h-6 text-xs text-muted-foreground hover:text-foreground"
                                                    >
                                                        {showSmsKeys ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                                                        {showSmsKeys ? 'Hide Key' : 'Show Key'}
                                                    </Button>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                                    SMS Key Routing Mode
                                                </Label>
                                                <select 
                                                    value={smsKeyMode}
                                                    onChange={e => setSmsKeyMode(e.target.value as 'platform' | 'custom')}
                                                    className="h-11 w-full rounded-xl bg-muted/20 border-none shadow-inner font-semibold px-4 text-sm"
                                                >
                                                    <option value="platform">System Defaults (Shared Account Billing)</option>
                                                    <option value="custom">Custom Keys (Deduct from local tenant keys)</option>
                                                </select>
                                            </div>

                                            {smsKeyMode === 'custom' && (
                                                <div className="pt-2 border-t border-border/50">
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">mNotify API Key</Label>
                                                        <Input 
                                                            value={mnotifyApiKey} 
                                                            onChange={e => setMnotifyApiKey(e.target.value)} 
                                                            placeholder="Enter your mNotify API key..." 
                                                            type={showSmsKeys ? "text" : "password"}
                                                            className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Email Integrations */}
                                        <div className="pt-6 border-t border-border/40 space-y-6">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-semibold text-blue-500 uppercase tracking-widest">Email Gateway (Resend)</h4>
                                                {emailKeyMode === 'custom' && (
                                                    <Button 
                                                        type="button" 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        onClick={() => setShowEmailKeys(!showEmailKeys)}
                                                        className="h-6 text-xs text-muted-foreground hover:text-foreground"
                                                    >
                                                        {showEmailKeys ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                                                        {showEmailKeys ? 'Hide Key' : 'Show Key'}
                                                    </Button>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                                    Email Key Routing Mode
                                                </Label>
                                                <select 
                                                    value={emailKeyMode}
                                                    onChange={e => setEmailKeyMode(e.target.value as 'platform' | 'custom')}
                                                    className="h-11 w-full rounded-xl bg-muted/20 border-none shadow-inner font-semibold px-4 text-sm"
                                                >
                                                    <option value="platform">System Defaults (Shared Account Billing)</option>
                                                    <option value="custom">Custom Keys (Deduct from local tenant keys)</option>
                                                </select>
                                            </div>

                                            {emailKeyMode === 'custom' && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-border/50">
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Resend API Key</Label>
                                                        <Input 
                                                            value={resendApiKey} 
                                                            onChange={e => setResendApiKey(e.target.value)} 
                                                            placeholder="sk_..." 
                                                            type={showEmailKeys ? "text" : "password"}
                                                            className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Verified Sending Domain</Label>
                                                        <Input 
                                                            value={resendDomain} 
                                                            onChange={e => setResendDomain(e.target.value)} 
                                                            placeholder="e.g. mydomain.com" 
                                                            type="text"
                                                            className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    <DialogFooter className="p-6 bg-muted/30 border-t shrink-0 flex items-center justify-between">
                        <Button 
                            type="button" 
                            variant="ghost" 
                            onClick={() => onOpenChange(false)} 
                            className="rounded-xl font-bold px-6 h-11"
                        >
                            Cancel
                        </Button>

                        <div className="flex items-center gap-2">
                            {steps.findIndex(x => x.id === currentStep) > 0 && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        const idx = steps.findIndex(x => x.id === currentStep);
                                        setCurrentStep(steps[idx - 1].id as StepId);
                                    }}
                                    className="rounded-xl font-bold px-5 h-11 border-2"
                                >
                                    <ChevronLeft className="h-4 w-4 mr-2" /> Back
                                </Button>
                            )}

                            {steps.findIndex(x => x.id === currentStep) < steps.length - 1 ? (
                                <Button
                                    type="button"
                                    onClick={() => {
                                        if (!name.trim()) {
                                            toast({ variant: 'destructive', title: 'Validation Required', description: 'Please enter an Organization name before proceeding.' });
                                            return;
                                        }
                                        const idx = steps.findIndex(x => x.id === currentStep);
                                        setCurrentStep(steps[idx + 1].id as StepId);
                                    }}
                                    className="rounded-xl font-bold px-6 h-11"
                                >
                                    Next <ChevronRight className="h-4 w-4 ml-2" />
                                </Button>
                            ) : (
                                <Button 
                                    type="submit" 
                                    disabled={isSaving || !name.trim()} 
                                    className="rounded-xl font-semibold px-8 h-11 shadow-lg bg-primary text-white text-xs"
                                >
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                                    <span>{organization ? 'Save Changes' : 'Create Organization'}</span>
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
