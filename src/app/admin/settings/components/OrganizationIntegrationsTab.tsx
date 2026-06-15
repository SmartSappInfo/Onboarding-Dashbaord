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
import { Key, Loader2, Save, Eye, EyeOff } from 'lucide-react';
import WhatsAppSettings from './WhatsAppSettings';

interface OrganizationIntegrationsTabProps {
    organization: Organization;
}

export default function OrganizationIntegrationsTab({ organization }: OrganizationIntegrationsTabProps) {
    const { user } = useUser();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = React.useState(false);
    const [showApiKeys, setShowApiKeys] = React.useState(false);

    const [aiKeyMode, setAiKeyMode] = React.useState<'platform' | 'custom'>(organization.aiKeyMode || 'platform');
    const [geminiApiKey, setGeminiApiKey] = React.useState(organization.geminiApiKey || '');
    const [openRouterApiKey, setOpenRouterApiKey] = React.useState(organization.openRouterApiKey || '');
    const [openaiApiKey, setOpenaiApiKey] = React.useState(organization.openaiApiKey || '');
    const [claudeApiKey, setClaudeApiKey] = React.useState(organization.claudeApiKey || '');

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
                    claudeApiKey: claudeApiKey.trim()
                },
                user.uid
            );

            if (result.success) {
                toast({ title: 'Keys Updated', description: 'Custom integration credentials saved.' });
            } else {
                toast({ variant: 'destructive', title: 'Update Failed', description: result.error });
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8">
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
                            onClick={() => setShowApiKeys(!showApiKeys)}
                            className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        >
                            {showApiKeys ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                            {showApiKeys ? 'Hide Keys' : 'Show Keys'}
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

                <div className="flex justify-end pt-4">
                    <Button onClick={handleSave} disabled={isSaving} className="rounded-xl font-bold h-11 px-8 shadow-lg shadow-primary/10">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Credentials
                    </Button>
                </div>
            </CardContent>
        </Card>

        <WhatsAppSettings organizationId={organization.id} />
        </div>
    );
}
