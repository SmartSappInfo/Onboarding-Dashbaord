'use client';

import * as React from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, RefreshCw, Mail, MessageSquare, Sparkles, Upload } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { seedSystemTemplates } from '@/lib/seed-templates';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useBackoffice } from '../../context/BackofficeProvider';
import { getGlobalAiKeys, saveGlobalAiKeys } from '@/lib/backoffice/backoffice-ai-actions';

export default function SystemDefaultsClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const confirm = useConfirm();
    const { profile } = useBackoffice();
    
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isReseeding, setIsReseeding] = React.useState(false);
    const [templates, setTemplates] = React.useState<any>(null);

    const [aiKeys, setAiKeys] = React.useState({
        geminiApiKey: '',
        claudeApiKey: '',
        openRouterApiKey: '',
    });
    const [aiKeysExist, setAiKeysExist] = React.useState({
        geminiApiKeyExists: false,
        claudeApiKeyExists: false,
        openRouterApiKeyExists: false,
    });

    React.useEffect(() => {
        const fetchTemplatesAndKeys = async () => {
            if (!firestore) return;
            try {
                // Fetch templates
                const snap = await getDoc(doc(firestore, 'system_settings', 'templates'));
                if (snap.exists()) {
                    setTemplates(snap.data());
                }

                // Fetch AI keys existence
                const keysRes = await getGlobalAiKeys();
                if (keysRes.success && keysRes.data) {
                    setAiKeysExist(keysRes.data);
                    setAiKeys({
                        geminiApiKey: keysRes.data.geminiApiKeyExists ? '••••••••' : '',
                        claudeApiKey: keysRes.data.claudeApiKeyExists ? '••••••••' : '',
                        openRouterApiKey: keysRes.data.openRouterApiKeyExists ? '••••••••' : '',
                    });
                }
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Fetch Error', description: error.message });
            } finally {
                setIsLoading(false);
            }
        };
        fetchTemplatesAndKeys();
    }, [firestore, toast]);

    const handleSave = async () => {
        if (!firestore || !templates) return;
        if (!profile?.id) {
            toast({ variant: 'destructive', title: 'Authentication Error', description: 'Admin authentication required.' });
            return;
        }
        setIsSaving(true);
        try {
            // Save templates
            await updateDoc(doc(firestore, 'system_settings', 'templates'), {
                ...templates,
                updatedAt: new Date().toISOString()
            });

            // Save global AI keys
            const actor = {
                userId: profile.id,
                name: profile.name || 'Unknown Admin',
                email: profile.email || '',
                role: profile.backofficeRoles?.[0] || 'super_admin'
            };

            const keysRes = await saveGlobalAiKeys({
                geminiApiKey: aiKeys.geminiApiKey,
                claudeApiKey: aiKeys.claudeApiKey,
                openRouterApiKey: aiKeys.openRouterApiKey,
            }, actor);

            if (!keysRes.success) {
                throw new Error(keysRes.error || 'Failed to save global AI keys');
            }

            // Refresh key states
            const freshKeysRes = await getGlobalAiKeys();
            if (freshKeysRes.success && freshKeysRes.data) {
                setAiKeysExist(freshKeysRes.data);
                setAiKeys({
                    geminiApiKey: freshKeysRes.data.geminiApiKeyExists ? '••••••••' : '',
                    claudeApiKey: freshKeysRes.data.claudeApiKeyExists ? '••••••••' : '',
                    openRouterApiKey: freshKeysRes.data.openRouterApiKeyExists ? '••••••••' : '',
                });
            }

            toast({ title: 'Settings Saved', description: 'System-wide templates and AI API keys have been updated.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleReseed = async () => {
        if (!firestore) return;
        if (!(await confirm({ title: 'Reset to factory defaults?', description: 'This will reset all system templates to factory defaults.', confirmText: 'Reset', variant: 'destructive' }))) return;
        setIsReseeding(true);
        try {
            await seedSystemTemplates(firestore);
            const snap = await getDoc(doc(firestore, 'system_settings', 'templates'));
            if (snap.exists()) setTemplates(snap.data());
            toast({ title: 'System Reset', description: 'Factory templates have been restored.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Reset Failed', description: error.message });
        } finally {
            setIsReseeding(false);
        }
    };

    if (isLoading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-32">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter flex items-center gap-4">
                        <Sparkles className="h-10 w-10 text-primary" />
                        System Defaults
                    </h1>
                    <p className="text-muted-foreground font-medium text-lg mt-1">
                        Global message templates and baseline configuration
                    </p>
                </div>
                <div className="flex gap-4">
                    <Button variant="outline" onClick={handleReseed} disabled={isReseeding} className="rounded-xl font-bold">
                        {isReseeding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                        Factory Reset
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="rounded-xl font-bold px-8 shadow-lg shadow-primary/20">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Changes
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {/* Invitation Template */}
                <Card className="rounded-[2rem] border-none shadow-sm ring-1 ring-border overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b p-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                                    <Mail className="h-6 w-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-bold">User Invitation</CardTitle>
                                    <CardDescription>Sent when a new member is invited to an organization.</CardDescription>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Badge variant="secondary">Email</Badge>
                                <Badge variant="secondary">SMS</Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email Subject</label>
                            <Input 
                                value={templates?.invitation?.subject || ''} 
                                onChange={(e) => setTemplates({ ...templates, invitation: { ...templates.invitation, subject: e.target.value } })}
                                className="rounded-xl h-11"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email Body (HTML Supported)</label>
                            <Textarea 
                                value={templates?.invitation?.emailHtml || ''} 
                                onChange={(e) => setTemplates({ ...templates, invitation: { ...templates.invitation, emailHtml: e.target.value } })}
                                className="rounded-xl min-h-[200px] font-mono text-sm"
                            />
                        </div>
                        <Separator />
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">SMS Message</label>
                            <Textarea 
                                value={templates?.invitation?.smsBody || ''} 
                                onChange={(e) => setTemplates({ ...templates, invitation: { ...templates.invitation, smsBody: e.target.value } })}
                                className="rounded-xl min-h-[100px]"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Password Reset Template */}
                <Card className="rounded-[2rem] border-none shadow-sm ring-1 ring-border overflow-hidden">
                    <CardHeader className="bg-warning/5 border-b p-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-warning/10 text-warning rounded-2xl">
                                    <MessageSquare className="h-6 w-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-bold">Password Reset</CardTitle>
                                    <CardDescription>Sent during administrative or phone-based password recovery.</CardDescription>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Badge variant="secondary">Email</Badge>
                                <Badge variant="secondary">SMS</Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email Subject</label>
                            <Input 
                                value={templates?.passwordReset?.subject || ''} 
                                onChange={(e) => setTemplates({ ...templates, passwordReset: { ...templates.passwordReset, subject: e.target.value } })}
                                className="rounded-xl h-11"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email Body (HTML Supported)</label>
                            <Textarea 
                                value={templates?.passwordReset?.emailHtml || ''} 
                                onChange={(e) => setTemplates({ ...templates, passwordReset: { ...templates.passwordReset, emailHtml: e.target.value } })}
                                className="rounded-xl min-h-[200px] font-mono text-sm"
                            />
                        </div>
                        <Separator />
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">SMS Message</label>
                            <Textarea 
                                value={templates?.passwordReset?.smsBody || ''} 
                                onChange={(e) => setTemplates({ ...templates, passwordReset: { ...templates.passwordReset, smsBody: e.target.value } })}
                                className="rounded-xl min-h-[100px]"
                            />
                        </div>
                    </CardContent>
                </Card>
                {/* Bulk Upload Completed Template */}
                <Card className="rounded-[2rem] border-none shadow-sm ring-1 ring-border overflow-hidden">
                    <CardHeader className="bg-violet-500/5 border-b p-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-violet-500/10 text-violet-500 rounded-2xl">
                                    <Upload className="h-6 w-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-bold">Bulk Upload Complete</CardTitle>
                                    <CardDescription>Sent when a bulk import finishes processing in the background.</CardDescription>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Badge variant="secondary">Email</Badge>
                                <Badge variant="secondary">SMS</Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email Subject</label>
                            <Input 
                                value={templates?.bulkUploadCompleted?.subject || ''} 
                                onChange={(e) => setTemplates({ ...templates, bulkUploadCompleted: { ...templates.bulkUploadCompleted, subject: e.target.value } })}
                                className="rounded-xl h-11"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email Body (HTML Supported)</label>
                            <Textarea 
                                value={templates?.bulkUploadCompleted?.emailHtml || ''} 
                                onChange={(e) => setTemplates({ ...templates, bulkUploadCompleted: { ...templates.bulkUploadCompleted, emailHtml: e.target.value } })}
                                className="rounded-xl min-h-[200px] font-mono text-sm"
                            />
                        </div>
                        <Separator />
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">SMS Message</label>
                            <Textarea 
                                value={templates?.bulkUploadCompleted?.smsBody || ''} 
                                onChange={(e) => setTemplates({ ...templates, bulkUploadCompleted: { ...templates.bulkUploadCompleted, smsBody: e.target.value } })}
                                className="rounded-xl min-h-[100px]"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Global AI API Keys Configuration */}
                <Card className="rounded-[2rem] border-none shadow-sm ring-1 ring-border overflow-hidden">
                    <CardHeader className="bg-emerald-500/5 border-b p-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl">
                                    <Sparkles className="h-6 w-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-bold">Global AI API Keys Configuration</CardTitle>
                                    <CardDescription>Configure system-wide fallback keys for Anthropic Claude, Google Gemini, and OpenRouter.</CardDescription>
                                </div>
                            </div>
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-none">Security Settings</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Anthropic Claude API Key (sk-ant-...)</label>
                            <Input 
                                type="password"
                                placeholder={aiKeysExist.claudeApiKeyExists ? '••••••••' : 'Enter Anthropic API Key'}
                                value={aiKeys.claudeApiKey} 
                                onChange={(e) => setAiKeys({ ...aiKeys, claudeApiKey: e.target.value })}
                                className="rounded-xl h-11"
                            />
                            <p className="text-[10px] text-muted-foreground">Primary default fallback key for Anthropic Claude models (e.g. claude-3-5-sonnet).</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Google Gemini API Key (AIzaSy...)</label>
                            <Input 
                                type="password"
                                placeholder={aiKeysExist.geminiApiKeyExists ? '••••••••' : 'Enter Gemini API Key'}
                                value={aiKeys.geminiApiKey} 
                                onChange={(e) => setAiKeys({ ...aiKeys, geminiApiKey: e.target.value })}
                                className="rounded-xl h-11"
                            />
                            <p className="text-[10px] text-muted-foreground">Used for fallback routing to Gemini models.</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">OpenRouter API Key (sk-or-...)</label>
                            <Input 
                                type="password"
                                placeholder={aiKeysExist.openRouterApiKeyExists ? '••••••••' : 'Enter OpenRouter API Key'}
                                value={aiKeys.openRouterApiKey} 
                                onChange={(e) => setAiKeys({ ...aiKeys, openRouterApiKey: e.target.value })}
                                className="rounded-xl h-11"
                            />
                            <p className="text-[10px] text-muted-foreground">Optional alternative provider key routing.</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Legend */}
                <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-primary mb-4">Supported Dynamic Variables</h4>
                    <div className="flex flex-wrap gap-2">
                        {['userName', 'email', 'orgName', 'tempPassword', 'loginLink', 'filename', 'successCount', 'duplicateCount', 'failedCount', 'totalCount', 'importLogLink'].map(v => (
                            <Badge key={v} variant="outline" className="bg-background font-mono text-[10px]">
                                {'{{'}{v}{'}}'}
                            </Badge>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
