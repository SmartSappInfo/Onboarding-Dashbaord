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
import { Key, Loader2, Save, Eye, EyeOff, MessageCircle, ChevronRight, Mail, Smartphone } from 'lucide-react';
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
                    resendDomain: resendDomain.trim()
                },
                user.uid
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
        </div>
    );
}
