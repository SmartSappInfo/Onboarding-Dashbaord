'use client';

import * as React from 'react';
import { useUser } from '@/firebase';
import type { Organization } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { saveOrganizationAction } from '@/lib/organization-actions';
import { 
    Key, 
    Loader2, 
    Save, 
    Eye, 
    EyeOff, 
    MessageCircle, 
    ChevronRight, 
    Mail, 
    Smartphone, 
    Calendar,
    CheckCircle,
    Copy,
    Check,
    ExternalLink,
    ShieldCheck,
    Video,
    Sliders,
    Lock
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { OAuthCredentialsModal, type OAuthProvider } from '@/components/integrations/OAuthCredentialsModal';
import Link from 'next/link';

interface OrganizationIntegrationsTabProps {
    organization: Organization;
}

export default function OrganizationIntegrationsTab({ organization }: OrganizationIntegrationsTabProps) {
    const { user } = useUser();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = React.useState(false);

    // AI Keys State
    const [showAiKeys, setShowAiKeys] = React.useState(false);
    const [aiKeyMode, setAiKeyMode] = React.useState<'platform' | 'custom'>(organization.aiKeyMode || 'platform');
    const [geminiApiKey, setGeminiApiKey] = React.useState(organization.geminiApiKey || '');
    const [openRouterApiKey, setOpenRouterApiKey] = React.useState(organization.openRouterApiKey || '');
    const [openaiApiKey, setOpenaiApiKey] = React.useState(organization.openaiApiKey || '');
    const [claudeApiKey, setClaudeApiKey] = React.useState(organization.claudeApiKey || '');

    // SMS Keys State
    const [showSmsKeys, setShowSmsKeys] = React.useState(false);
    const [smsKeyMode, setSmsKeyMode] = React.useState<'platform' | 'custom'>(organization.smsKeyMode || 'platform');
    const [mnotifyApiKey, setMnotifyApiKey] = React.useState(organization.mnotifyApiKey || '');

    // Email Keys State
    const [showEmailKeys, setShowEmailKeys] = React.useState(false);
    const [emailKeyMode, setEmailKeyMode] = React.useState<'platform' | 'custom'>(organization.emailKeyMode || 'platform');
    const [resendApiKey, setResendApiKey] = React.useState(organization.resendApiKey || '');
    const [resendDomain, setResendDomain] = React.useState(organization.resendDomain || '');

    // Calendar & Conferencing State
    const [showOauthKeys, setShowOauthKeys] = React.useState(false);
    const [googleClientId, setGoogleClientId] = React.useState(organization.googleClientId || '');
    const [googleClientSecret, setGoogleClientSecret] = React.useState(organization.googleClientSecret || '');
    const [zoomClientId, setZoomClientId] = React.useState(organization.zoomClientId || '');
    const [zoomClientSecret, setZoomClientSecret] = React.useState(organization.zoomClientSecret || '');
    const [microsoftClientId, setMicrosoftClientId] = React.useState(organization.microsoftClientId || '');
    const [microsoftClientSecret, setMicrosoftClientSecret] = React.useState(organization.microsoftClientSecret || '');
    const [microsoftTenantId, setMicrosoftTenantId] = React.useState(organization.microsoftTenantId || '');
    const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

    // Studio Modal State
    const [studioModalOpen, setStudioModalOpen] = React.useState(false);
    const [studioProvider, setStudioProvider] = React.useState<OAuthProvider>('google_calendar');

    const appOrigin = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || 'https://smartsapp.com');
    const redirectUris = React.useMemo(() => ({
        google: `${appOrigin}/api/integrations/google/callback`,
        microsoft: `${appOrigin}/api/integrations/microsoft/callback`,
        zoom: `${appOrigin}/api/integrations/zoom/callback`,
    }), [appOrigin]);

    const handleCopyUri = async (uri: string, key: string) => {
        try {
            await navigator.clipboard.writeText(uri);
            setCopiedKey(key);
            toast({
                title: 'Redirect URI Copied',
                description: 'Paste this into your authorized redirect URIs in the developer console.',
            });
            setTimeout(() => setCopiedKey(null), 2500);
        } catch {
            toast({
                variant: 'destructive',
                title: 'Copy Failed',
                description: 'Please copy the URI manually.',
            });
        }
    };

    const isGoogleConfigured = !!(googleClientId && (googleClientSecret || organization.googleClientSecret));
    const isMicrosoftConfigured = !!(microsoftClientId && (microsoftClientSecret || organization.microsoftClientSecret));
    const isZoomConfigured = !!(zoomClientId && (zoomClientSecret || organization.zoomClientSecret));

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            const result = await saveOrganizationAction(
                organization.id,
                {
                    aiKeyMode,
                    geminiApiKey: geminiApiKey.trim(),
                    openRouterApiKey: openRouterApiKey.trim(),
                    openaiApiKey: openaiApiKey.trim(),
                    claudeApiKey: claudeApiKey.trim(),
                    smsKeyMode,
                    mnotifyApiKey: mnotifyApiKey.trim(),
                    emailKeyMode,
                    resendApiKey: resendApiKey.trim(),
                    resendDomain: resendDomain.trim(),
                    googleClientId: googleClientId.trim(),
                    googleClientSecret: googleClientSecret.trim(),
                    zoomClientId: zoomClientId.trim(),
                    zoomClientSecret: zoomClientSecret.trim(),
                    microsoftClientId: microsoftClientId.trim(),
                    microsoftClientSecret: microsoftClientSecret.trim(),
                    microsoftTenantId: microsoftTenantId.trim(),
                }
            );

            if (result.success) {
                toast({ title: 'Credentials Updated', description: 'Custom integration credentials saved.' });
            } else {
                toast({ variant: 'destructive', title: 'Update Failed', description: result.error });
            }
        } catch (error: unknown) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8 pb-12">
            {/* 1. AI Services Card */}
            <Card className="rounded-[2rem] border border-border shadow-sm bg-transparent overflow-hidden">
                <CardHeader className="p-8 border-b">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <Key className="h-5 w-5 text-primary" />
                                AI Services & API Keys
                            </CardTitle>
                            <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                                Provision credentials for Gemini, OpenRouter, OpenAI, and Claude
                            </CardDescription>
                        </div>
                        {aiKeyMode === 'custom' && (
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setShowAiKeys(!showAiKeys)}
                                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                            >
                                {showAiKeys ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                                {showAiKeys ? 'Hide Keys' : 'Show Keys'}
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Gemini API Key</Label>
                                <Input 
                                    value={geminiApiKey} 
                                    onChange={e => setGeminiApiKey(e.target.value)} 
                                    placeholder="AIza..." 
                                    type={showAiKeys ? "text" : "password"}
                                    className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">OpenRouter Key</Label>
                                <Input 
                                    value={openRouterApiKey} 
                                    onChange={e => setOpenRouterApiKey(e.target.value)} 
                                    placeholder="sk-or-v1-..." 
                                    type={showAiKeys ? "text" : "password"}
                                    className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">OpenAI API Key</Label>
                                <Input 
                                    value={openaiApiKey} 
                                    onChange={e => setOpenaiApiKey(e.target.value)} 
                                    placeholder="sk-..." 
                                    type={showAiKeys ? "text" : "password"}
                                    className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Anthropic Key (Claude)</Label>
                                <Input 
                                    value={claudeApiKey} 
                                    onChange={e => setClaudeApiKey(e.target.value)} 
                                    placeholder="sk-ant-..." 
                                    type={showAiKeys ? "text" : "password"}
                                    className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 2. SMS Gateway (mNotify) Card */}
            <Card className="rounded-[2rem] border border-border shadow-sm bg-transparent overflow-hidden">
                <CardHeader className="p-8 border-b">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <Smartphone className="h-5 w-5 text-primary" />
                                SMS Gateway (mNotify)
                            </CardTitle>
                            <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                                Configure credentials to route SMS dispatches through your own mNotify gateway
                            </CardDescription>
                        </div>
                        {smsKeyMode === 'custom' && (
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setShowSmsKeys(!showSmsKeys)}
                                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                            >
                                {showSmsKeys ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                                {showSmsKeys ? 'Hide Key' : 'Show Key'}
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
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
                        <div className="pt-4 border-t border-border/50">
                            <div className="space-y-2 max-w-md">
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
                </CardContent>
            </Card>

            {/* 3. Email Gateway (Resend) Card */}
            <Card className="rounded-[2rem] border border-border shadow-sm bg-transparent overflow-hidden">
                <CardHeader className="p-8 border-b">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <Mail className="h-5 w-5 text-primary" />
                                Email Gateway (Resend)
                            </CardTitle>
                            <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                                Configure credentials to route email dispatches through your own Resend account
                            </CardDescription>
                        </div>
                        {emailKeyMode === 'custom' && (
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setShowEmailKeys(!showEmailKeys)}
                                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                            >
                                {showEmailKeys ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                                {showEmailKeys ? 'Hide Key' : 'Show Key'}
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
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
                </CardContent>
            </Card>

            {/* 4. Calendar & Conferencing Credentials Override Card */}
            <Card className="rounded-[2rem] border border-border shadow-sm bg-transparent overflow-hidden">
                <CardHeader className="p-8 border-b">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-primary" />
                                Calendar & Conferencing Developer Apps
                            </CardTitle>
                            <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                                Set organization-wide OAuth developer credentials. Workspaces without individual overrides will automatically inherit these defaults.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                onClick={() => {
                                    setStudioProvider('google_calendar');
                                    setStudioModalOpen(true);
                                }}
                                className="h-8 rounded-xl text-xs font-semibold gap-1.5 active:scale-[0.97]"
                            >
                                <Sliders className="w-3.5 h-3.5 text-primary" />
                                Open Setup Studio
                            </Button>
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setShowOauthKeys(!showOauthKeys)}
                                className="h-8 rounded-xl text-xs text-muted-foreground hover:text-foreground active:scale-[0.97]"
                            >
                                {showOauthKeys ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                                {showOauthKeys ? 'Hide Keys' : 'Show Keys'}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                    {/* Google OAuth Section */}
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-red-500/10 text-red-500">
                                    <Calendar className="w-4 h-4" />
                                </div>
                                <h4 className="text-sm font-bold">Google Calendar App</h4>
                            </div>
                            <div className="flex items-center gap-2">
                                {isGoogleConfigured ? (
                                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] border-none flex items-center gap-1">
                                        <CheckCircle className="h-3 w-3" /> Global Default Active
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground border-border bg-muted/20">
                                        Not Configured
                                    </Badge>
                                )}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setStudioProvider('google_calendar');
                                        setStudioModalOpen(true);
                                    }}
                                    className="h-7 text-[11px] font-semibold text-primary hover:text-primary/80"
                                >
                                    Guided Setup <ChevronRight className="w-3 h-3 ml-0.5" />
                                </Button>
                            </div>
                        </div>

                        {/* Redirect URI Bar */}
                        <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/60 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3 text-emerald-500" /> Authorized Redirect URI
                                </span>
                                <a
                                    href="https://console.cloud.google.com/apis/credentials"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1"
                                >
                                    Google Cloud Console <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                            <div className="flex items-center gap-2">
                                <code className="text-xs font-mono bg-background border border-border px-3 py-2 rounded-xl flex-1 truncate select-all">
                                    {redirectUris.google}
                                </code>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCopyUri(redirectUris.google, 'google')}
                                    className="min-h-[38px] px-3 rounded-xl gap-1.5 active:scale-[0.97]"
                                >
                                    {copiedKey === 'google' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                    <span className="text-xs font-semibold">{copiedKey === 'google' ? 'Copied' : 'Copy'}</span>
                                </Button>
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <span>Scopes: <code className="font-mono">calendar.events</code>, <code className="font-mono">calendar.readonly</code></span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Google Client ID</Label>
                                <Input 
                                    value={googleClientId} 
                                    onChange={e => setGoogleClientId(e.target.value)} 
                                    placeholder="xxxx-xxxxxxxx.apps.googleusercontent.com" 
                                    type="text"
                                    className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-mono text-xs px-4" 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Google Client Secret</Label>
                                    {organization.googleClientSecret && (
                                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                            <Lock className="w-2.5 h-2.5" /> Encrypted in Firestore
                                        </span>
                                    )}
                                </div>
                                <Input 
                                    value={googleClientSecret} 
                                    onChange={e => setGoogleClientSecret(e.target.value)} 
                                    placeholder={organization.googleClientSecret ? '••••••••••••••••••••••••' : 'Enter Google Client Secret...'} 
                                    type={showOauthKeys ? "text" : "password"}
                                    className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-mono text-xs px-4" 
                                />
                            </div>
                        </div>
                    </div>

                    {/* Microsoft (Teams & Outlook) Section */}
                    <div className="space-y-4 pt-4 border-t">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                                    <Video className="w-4 h-4" />
                                </div>
                                <h4 className="text-sm font-bold">Microsoft Teams & Outlook App</h4>
                            </div>
                            <div className="flex items-center gap-2">
                                {isMicrosoftConfigured ? (
                                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] border-none flex items-center gap-1">
                                        <CheckCircle className="h-3 w-3" /> Global Default Active
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground border-border bg-muted/20">
                                        Not Configured
                                    </Badge>
                                )}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setStudioProvider('microsoft_teams');
                                        setStudioModalOpen(true);
                                    }}
                                    className="h-7 text-[11px] font-semibold text-primary hover:text-primary/80"
                                >
                                    Guided Setup <ChevronRight className="w-3 h-3 ml-0.5" />
                                </Button>
                            </div>
                        </div>

                        {/* Redirect URI Bar */}
                        <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/60 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3 text-emerald-500" /> Authorized Redirect URI
                                </span>
                                <a
                                    href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1"
                                >
                                    Azure Portal (App Registrations) <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                            <div className="flex items-center gap-2">
                                <code className="text-xs font-mono bg-background border border-border px-3 py-2 rounded-xl flex-1 truncate select-all">
                                    {redirectUris.microsoft}
                                </code>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCopyUri(redirectUris.microsoft, 'microsoft')}
                                    className="min-h-[38px] px-3 rounded-xl gap-1.5 active:scale-[0.97]"
                                >
                                    {copiedKey === 'microsoft' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                    <span className="text-xs font-semibold">{copiedKey === 'microsoft' ? 'Copied' : 'Copy'}</span>
                                </Button>
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <span>Graph Scopes: <code className="font-mono">Calendars.ReadWrite</code>, <code className="font-mono">OnlineMeetings.ReadWrite</code>, <code className="font-mono">offline_access</code></span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Application (Client) ID</Label>
                                <Input 
                                    value={microsoftClientId} 
                                    onChange={e => setMicrosoftClientId(e.target.value)} 
                                    placeholder="e.g. 00000000-0000-0000-0000-000000000000" 
                                    type="text"
                                    className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-mono text-xs px-4" 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Client Secret Value</Label>
                                    {organization.microsoftClientSecret && (
                                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                            <Lock className="w-2.5 h-2.5" /> Encrypted
                                        </span>
                                    )}
                                </div>
                                <Input 
                                    value={microsoftClientSecret} 
                                    onChange={e => setMicrosoftClientSecret(e.target.value)} 
                                    placeholder={organization.microsoftClientSecret ? '••••••••••••••••••••••••' : 'Enter Client Secret...'} 
                                    type={showOauthKeys ? "text" : "password"}
                                    className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-mono text-xs px-4" 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Tenant ID (Optional)</Label>
                                <Input 
                                    value={microsoftTenantId} 
                                    onChange={e => setMicrosoftTenantId(e.target.value)} 
                                    placeholder="common (default)" 
                                    type="text"
                                    className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-mono text-xs px-4" 
                                />
                            </div>
                        </div>
                    </div>

                    {/* Zoom OAuth Section */}
                    <div className="space-y-4 pt-4 border-t">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
                                    <Video className="w-4 h-4" />
                                </div>
                                <h4 className="text-sm font-bold">Zoom Meeting App</h4>
                            </div>
                            <div className="flex items-center gap-2">
                                {isZoomConfigured ? (
                                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] border-none flex items-center gap-1">
                                        <CheckCircle className="h-3 w-3" /> Global Default Active
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground border-border bg-muted/20">
                                        Not Configured
                                    </Badge>
                                )}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setStudioProvider('zoom');
                                        setStudioModalOpen(true);
                                    }}
                                    className="h-7 text-[11px] font-semibold text-primary hover:text-primary/80"
                                >
                                    Guided Setup <ChevronRight className="w-3 h-3 ml-0.5" />
                                </Button>
                            </div>
                        </div>

                        {/* Redirect URI Bar */}
                        <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/60 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3 text-emerald-500" /> OAuth Redirect URL
                                </span>
                                <a
                                    href="https://marketplace.zoom.us/develop/create"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1"
                                >
                                    Zoom App Marketplace <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                            <div className="flex items-center gap-2">
                                <code className="text-xs font-mono bg-background border border-border px-3 py-2 rounded-xl flex-1 truncate select-all">
                                    {redirectUris.zoom}
                                </code>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCopyUri(redirectUris.zoom, 'zoom')}
                                    className="min-h-[38px] px-3 rounded-xl gap-1.5 active:scale-[0.97]"
                                >
                                    {copiedKey === 'zoom' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                    <span className="text-xs font-semibold">{copiedKey === 'zoom' ? 'Copied' : 'Copy'}</span>
                                </Button>
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <span>Scopes: <code className="font-mono">meeting:write</code>, <code className="font-mono">meeting:read</code>, <code className="font-mono">user:read</code></span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Zoom Client ID</Label>
                                <Input 
                                    value={zoomClientId} 
                                    onChange={e => setZoomClientId(e.target.value)} 
                                    placeholder="Enter Zoom Client ID..." 
                                    type="text"
                                    className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-mono text-xs px-4" 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Zoom Client Secret</Label>
                                    {organization.zoomClientSecret && (
                                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                            <Lock className="w-2.5 h-2.5" /> Encrypted in Firestore
                                        </span>
                                    )}
                                </div>
                                <Input 
                                    value={zoomClientSecret} 
                                    onChange={e => setZoomClientSecret(e.target.value)} 
                                    placeholder={organization.zoomClientSecret ? '••••••••••••••••••••••••' : 'Enter Zoom Client Secret...'} 
                                    type={showOauthKeys ? "text" : "password"}
                                    className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-mono text-xs px-4" 
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Save Buttons and WhatsApp Link */}
            <div className="flex items-center justify-between gap-4 pt-4">
                <Link
                    href="/admin/settings/whatsapp"
                    className="flex-1 rounded-2xl border-none ring-1 ring-border shadow-sm bg-card overflow-hidden hover:ring-primary/20 hover:shadow-md transition-all duration-200"
                >
                    <div className="px-5 py-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-primary/5 text-primary animate-pulse">
                                <MessageCircle className="h-5 w-5" />
                            </div>
                            <h3 className="text-sm font-bold tracking-tight">WhatsApp Business (Meta Cloud API)</h3>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary shrink-0">
                            Configure <ChevronRight className="h-4 w-4" />
                        </span>
                    </div>
                </Link>

                <Button 
                    onClick={handleSave} 
                    disabled={isSaving} 
                    className="rounded-2xl font-bold h-14 px-10 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shrink-0"
                >
                    {isSaving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
                    Save All Configurations
                </Button>
            </div>

            {/* Dual-Scope OAuth Credentials Studio Modal */}
            <OAuthCredentialsModal
                open={studioModalOpen}
                onOpenChange={setStudioModalOpen}
                scope="organization"
                organizationId={organization.id}
                defaultProvider={studioProvider}
                onCredentialsSaved={() => {
                    toast({
                        title: 'Studio Synchronized',
                        description: 'Developer app credentials saved to organization defaults.',
                    });
                }}
            />
        </div>
    );
}
