'use client';

import * as React from 'react';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useBackofficeToken } from '@/hooks/use-backoffice-token';
import { getErrorMessage } from '@/lib/backoffice/backoffice-errors';

// Shape of the system_settings/templates document edited on this screen.
interface MessageTemplate {
    subject?: string;
    emailHtml?: string;
    smsBody?: string;
}
interface SystemTemplates {
    invitation?: MessageTemplate;
    passwordReset?: MessageTemplate;
    bulkUploadCompleted?: MessageTemplate;
    updatedAt?: string;
}
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, RefreshCw, Mail, MessageSquare, Sparkles, Upload, Shield, PlusCircle, X, Check, Lock, ShieldAlert, Info } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { seedSystemTemplates } from '@/lib/seed-templates';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { getGlobalAiKeys, saveGlobalAiKeys, getGlobalAiConfig, saveGlobalAiConfig, rotateAllSecretsAction } from '@/lib/backoffice/backoffice-ai-actions';
import type { WorkspaceStatus, IndustryVertical, LeadScoringSettings, EmailVerificationRule, PhoneVerificationRule } from '@/lib/types';
import { INDUSTRY_STATUS_DEFAULTS } from '@/lib/industry-defaults';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ONBOARDING_STAGE_COLORS } from '@/lib/colors';
import { cn } from '@/lib/utils';

const ENGAGEMENT_TRIGGER_LABELS: Record<string, string> = {
  'survey_completed': 'Survey Completed',
  'email_opened': 'Email Opened',
  'email_clicked': 'Email Clicked',
  'meeting_attended': 'Meeting Attended',
  'reply_received': 'Reply Received',
  'outbound_call': 'Outbound Call Made',
  'email_bounced': 'Email Bounced',
  'sms_failed': 'SMS Delivery Failed',
  'page_visited': 'Viewed Page',
  'button_clicked': 'Clicked Button on Page',
  'survey_started': 'Started Survey',
  'sms_link_clicked': 'Link Clicked from SMS',
  'document_signed': 'Document Signed',
  'call_outcome_positive': 'Positive Call Outcome'
};

export default function SystemDefaultsClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const confirm = useConfirm();
    const getToken = useBackofficeToken();

    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isReseeding, setIsReseeding] = React.useState(false);
    const [templates, setTemplates] = React.useState<SystemTemplates>({});
    const [aiConfig, setAiConfig] = React.useState({
        defaultProvider: 'googleai',
        defaultModelId: 'gemini-3.5-flash',
    });

    const [industryLifecycles, setIndustryLifecycles] = React.useState<Record<string, WorkspaceStatus[]>>({});
    const [selectedIndustryTab, setSelectedIndustryTab] = React.useState<IndustryVertical>('SaaS');

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
    const [isRotating, setIsRotating] = React.useState(false);

    // Lead Scoring Defaults States & Helpers
    const [leadScoring, setLeadScoring] = React.useState<LeadScoringSettings>({
        emailVerificationRules: [],
        phoneVerificationRules: [],
        engagementRules: {},
        callCampaignPositiveOutcomes: [],
        callCampaignDefaultPoints: 0
    });
    const [newOutcome, setNewOutcome] = React.useState('');

    const handleAddEmailRule = () => {
        setLeadScoring(prev => {
            const rules = [...(prev.emailVerificationRules || [])];
            return {
                ...prev,
                emailVerificationRules: [...rules, { minScore: 50, scoreValue: 5 }]
            };
        });
    };

    const handleUpdateEmailRule = (idx: number, updates: Partial<EmailVerificationRule>) => {
        setLeadScoring(prev => {
            const rules = [...(prev.emailVerificationRules || [])];
            if (rules[idx]) {
                rules[idx] = { ...rules[idx], ...updates };
            }
            return {
                ...prev,
                emailVerificationRules: rules
            };
        });
    };

    const handleRemoveEmailRule = (idx: number) => {
        setLeadScoring(prev => ({
            ...prev,
            emailVerificationRules: (prev.emailVerificationRules || []).filter((_, i) => i !== idx)
        }));
    };

    const handleAddPhoneRule = () => {
        setLeadScoring(prev => {
            const rules = [...(prev.phoneVerificationRules || [])];
            return {
                ...prev,
                phoneVerificationRules: [...rules, { minScore: 50, scoreValue: 5 }]
            };
        });
    };

    const handleUpdatePhoneRule = (idx: number, updates: Partial<PhoneVerificationRule>) => {
        setLeadScoring(prev => {
            const rules = [...(prev.phoneVerificationRules || [])];
            if (rules[idx]) {
                rules[idx] = { ...rules[idx], ...updates };
            }
            return {
                ...prev,
                phoneVerificationRules: rules
            };
        });
    };

    const handleRemovePhoneRule = (idx: number) => {
        setLeadScoring(prev => ({
            ...prev,
            phoneVerificationRules: (prev.phoneVerificationRules || []).filter((_, i) => i !== idx)
        }));
    };

    const handleAddOutcome = () => {
        if (!newOutcome.trim()) return;
        setLeadScoring(prev => {
            const outcomes = [...(prev.callCampaignPositiveOutcomes || [])];
            if (outcomes.includes(newOutcome.trim())) return prev;
            return {
                ...prev,
                callCampaignPositiveOutcomes: [...outcomes, newOutcome.trim()]
            };
        });
        setNewOutcome('');
    };

    const handleRemoveOutcome = (outcome: string) => {
        setLeadScoring(prev => ({
            ...prev,
            callCampaignPositiveOutcomes: (prev.callCampaignPositiveOutcomes || []).filter(o => o !== outcome)
        }));
    };

    const handleRotateSecrets = async () => {
        const token = await getToken();
        if (!token) {
            toast({ variant: 'destructive', title: 'Authentication Failed', description: 'Could not obtain verification credentials.' });
            return;
        }

        const proceed = await confirm({
            title: 'Rotate Encryption Keys',
            description: 'This will re-encrypt all stored global AI keys under the current active master key. Are you sure you want to proceed?',
            confirmText: 'Rotate Secrets',
            cancelText: 'Cancel'
        });

        if (!proceed) return;

        setIsRotating(true);
        try {
            const res = await rotateAllSecretsAction(token);
            if (res.success) {
                toast({
                    title: 'Secrets Rotated Successfully',
                    description: `Re-encrypted ${res.rotatedCount} keys under the active master key.`
                });
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Rotation Failed',
                    description: res.error || 'An unknown error occurred.'
                });
            }
        } catch (error: unknown) {
            const err = error as { message?: string };
            toast({
                variant: 'destructive',
                title: 'Rotation Failed',
                description: err.message || 'Rotation failed.'
            });
        } finally {
            setIsRotating(false);
        }
    };


    const handleAddStatusForIndustry = (ind: IndustryVertical) => {
        setIndustryLifecycles(prev => {
            const currentList = prev[ind] || [];
            return {
                ...prev,
                [ind]: [...currentList, { value: 'New Status', label: 'New Status', color: '#64748b', description: '' }]
            };
        });
    };

    const handleUpdateStatusForIndustry = (ind: IndustryVertical, index: number, updates: Partial<WorkspaceStatus>) => {
        setIndustryLifecycles(prev => {
            const currentList = [...(prev[ind] || [])];
            if (currentList[index]) {
                currentList[index] = { ...currentList[index], ...updates };
            }
            return {
                ...prev,
                [ind]: currentList
            };
        });
    };

    const handleRemoveStatusForIndustry = (ind: IndustryVertical, index: number) => {
        setIndustryLifecycles(prev => {
            const currentList = (prev[ind] || []).filter((_, i) => i !== index);
            return {
                ...prev,
                [ind]: currentList
            };
        });
    };

    React.useEffect(() => {
        const fetchTemplatesAndKeys = async () => {
            if (!firestore) return;
            try {
                const idToken = await getToken();

                // Fetch global AI config defaults
                const configRes = await getGlobalAiConfig(idToken);
                if (configRes.success && configRes.data) {
                    setAiConfig({
                        defaultProvider: configRes.data.defaultProvider,
                        defaultModelId: configRes.data.defaultModelId,
                    });
                }
                const snap = await getDoc(doc(firestore, 'system_settings', 'templates'));
                if (snap.exists()) {
                    setTemplates(snap.data() as SystemTemplates);
                }

                // Fetch industry lifecycle defaults
                const lifecyclesSnap = await getDoc(doc(firestore, 'system_settings', 'industries_lifecycle'));
                if (lifecyclesSnap.exists()) {
                    setIndustryLifecycles(lifecyclesSnap.data() as Record<string, WorkspaceStatus[]>);
                } else {
                    setIndustryLifecycles(INDUSTRY_STATUS_DEFAULTS);
                }

                // Fetch global lead scoring defaults
                const leadScoringSnap = await getDoc(doc(firestore, 'system_settings', 'lead_scoring'));
                if (leadScoringSnap.exists()) {
                    setLeadScoring(leadScoringSnap.data() as LeadScoringSettings);
                }

                // Fetch AI keys existence
                const keysRes = await getGlobalAiKeys(idToken);
                if (keysRes.success && keysRes.data) {
                    setAiKeysExist(keysRes.data);
                    setAiKeys({
                        geminiApiKey: keysRes.data.geminiApiKeyExists ? '••••••••' : '',
                        claudeApiKey: keysRes.data.claudeApiKeyExists ? '••••••••' : '',
                        openRouterApiKey: keysRes.data.openRouterApiKeyExists ? '••••••••' : '',
                    });
                }
            } catch (error: unknown) {
                toast({ variant: 'destructive', title: 'Fetch Error', description: getErrorMessage(error) });
            } finally {
                setIsLoading(false);
            }
        };
        fetchTemplatesAndKeys();
    }, [firestore, toast, getToken]);

    const handleSave = async () => {
        if (!firestore || !templates) return;
        setIsSaving(true);
        try {
            const idToken = await getToken();

            // Save templates
            await updateDoc(doc(firestore, 'system_settings', 'templates'), {
                ...templates,
                updatedAt: new Date().toISOString()
            });

            // Save industry lifecycle defaults
            await updateDoc(doc(firestore, 'system_settings', 'industries_lifecycle'), {
                ...industryLifecycles,
                updatedAt: new Date().toISOString()
            });

            // Save global AI config defaults (server verifies token + settings:edit)
            const configRes = await saveGlobalAiConfig({
                defaultProvider: aiConfig.defaultProvider as 'googleai' | 'anthropic' | 'openrouter',
                defaultModelId: aiConfig.defaultModelId,
            }, idToken);

            if (!configRes.success) {
                throw new Error(configRes.error || 'Failed to save global AI defaults');
            }

            const keysRes = await saveGlobalAiKeys({
                geminiApiKey: aiKeys.geminiApiKey,
                claudeApiKey: aiKeys.claudeApiKey,
                openRouterApiKey: aiKeys.openRouterApiKey,
            }, idToken);

            if (!keysRes.success) {
                throw new Error(keysRes.error || 'Failed to save global AI keys');
            }

            // Refresh key states
            const freshKeysRes = await getGlobalAiKeys(idToken);
            if (freshKeysRes.success && freshKeysRes.data) {
                setAiKeysExist(freshKeysRes.data);
                setAiKeys({
                    geminiApiKey: freshKeysRes.data.geminiApiKeyExists ? '••••••••' : '',
                    claudeApiKey: freshKeysRes.data.claudeApiKeyExists ? '••••••••' : '',
                    openRouterApiKey: freshKeysRes.data.openRouterApiKeyExists ? '••••••••' : '',
                });
            }

            // Save global lead scoring defaults
            await setDoc(doc(firestore, 'system_settings', 'lead_scoring'), {
                ...leadScoring,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            toast({ title: 'Settings Saved', description: 'System-wide templates, AI API keys, industry lifecycles, and global lead scoring defaults have been updated.' });
        } catch (error: unknown) {
            toast({ variant: 'destructive', title: 'Save Failed', description: getErrorMessage(error) });
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
            if (snap.exists()) setTemplates(snap.data() as SystemTemplates);
            toast({ title: 'System Reset', description: 'Factory templates have been restored.' });
        } catch (error: unknown) {
            toast({ variant: 'destructive', title: 'Reset Failed', description: getErrorMessage(error) });
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

                {/* Global Default AI Model Configuration */}
                <Card className="rounded-[2rem] border-none shadow-sm ring-1 ring-border overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b p-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                                    <Sparkles className="h-6 w-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-bold">Global AI Defaults</CardTitle>
                                    <CardDescription>Configure the default model and provider for all AI assistance across the platform.</CardDescription>
                                </div>
                            </div>
                            <Badge variant="secondary" className="bg-primary/10 text-primary border-none">AI Control Plane</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Default AI Provider</label>
                                <select
                                    value={aiConfig.defaultProvider}
                                    onChange={(e) => setAiConfig({ ...aiConfig, defaultProvider: e.target.value })}
                                    className="w-full rounded-xl h-11 border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <option value="googleai">Google Gemini (googleai)</option>
                                    <option value="anthropic">Anthropic Claude (anthropic)</option>
                                    <option value="openrouter">OpenRouter (openrouter)</option>
                                </select>
                                <p className="text-[10px] text-muted-foreground">Select the primary default provider for the entire application.</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Default Model ID</label>
                                <Input
                                    value={aiConfig.defaultModelId}
                                    onChange={(e) => setAiConfig({ ...aiConfig, defaultModelId: e.target.value })}
                                    className="rounded-xl h-11"
                                    placeholder="e.g. gemini-3.5-flash, claude-3-5-sonnet"
                                />
                                <p className="text-[10px] text-muted-foreground">The model ID matching the chosen provider (e.g. <code>gemini-3.5-flash</code> or <code>claude-3-5-sonnet</code>).</p>
                            </div>
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

                {/* Industry Lifecycle Defaults */}
                <Card className="rounded-[2rem] border-none shadow-sm ring-1 ring-border overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b p-8">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4 text-left">
                                <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                                    <ShieldAlert className="h-6 w-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-bold">Industry Lifecycle Defaults</CardTitle>
                                    <CardDescription>Configure baseline lifecycle statuses to seed automatically for new workspaces.</CardDescription>
                                </div>
                            </div>
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleAddStatusForIndustry(selectedIndustryTab)}
                                className="h-9 rounded-xl font-bold border-dashed border-2 text-xs active:scale-[0.97]"
                            >
                                <PlusCircle className="h-4 w-4 mr-2" /> Add Status Node
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        {/* Industry Switcher Tabs */}
                        <div className="flex flex-wrap gap-1.5 p-1 bg-muted/50 rounded-2xl border">
                            {(['SaaS', 'Marketing', 'SchoolEnrollment', 'Consultancy', 'RealEstate', 'Law'] as IndustryVertical[]).map((ind) => {
                                const isActive = selectedIndustryTab === ind;
                                return (
                                    <button
                                        key={ind}
                                        type="button"
                                        onClick={() => setSelectedIndustryTab(ind)}
                                        className={cn(
                                            "flex-1 min-w-[100px] py-2 px-3 rounded-xl font-bold text-xs transition-all active:scale-[0.97]",
                                            isActive
                                                ? "bg-background text-foreground shadow-sm ring-1 ring-black/5"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        {ind === 'SchoolEnrollment' ? 'School Enrollment' : ind === 'RealEstate' ? 'Real Estate' : ind}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Status List */}
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                            {(!industryLifecycles[selectedIndustryTab] || industryLifecycles[selectedIndustryTab].length === 0) ? (
                                <p className="text-xs text-muted-foreground text-center py-8">No status nodes defined. Add one to start.</p>
                            ) : (
                                industryLifecycles[selectedIndustryTab].map((status, idx) => (
                                    <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 p-3 rounded-2xl bg-card border group animate-in fade-in duration-100">
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                                            <div className="flex items-center gap-3">
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button 
                                                            type="button" 
                                                            className="w-8 h-8 rounded-lg shadow-sm border shrink-0 active:scale-[0.9]" 
                                                            style={{ backgroundColor: status.color }} 
                                                        />
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-2 bg-card border-none shadow-2xl z-[100]">
                                                        <div className="grid grid-cols-6 gap-1">
                                                            {ONBOARDING_STAGE_COLORS.map(c => (
                                                                <button 
                                                                    key={c} 
                                                                    type="button" 
                                                                    onClick={() => handleUpdateStatusForIndustry(selectedIndustryTab, idx, { color: c })} 
                                                                    className="w-5 h-5 rounded shadow-sm hover:scale-105 active:scale-[0.9] transition-all" 
                                                                    style={{ backgroundColor: c }} 
                                                                />
                                                            ))}
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                                <Input 
                                                    value={status.label} 
                                                    onChange={e => handleUpdateStatusForIndustry(selectedIndustryTab, idx, { label: e.target.value, value: e.target.value })} 
                                                    className="h-9 bg-background font-bold text-xs" 
                                                />
                                            </div>
                                            <Input 
                                                value={status.description || ''} 
                                                onChange={e => handleUpdateStatusForIndustry(selectedIndustryTab, idx, { description: e.target.value })} 
                                                placeholder="Short behavioral description..."
                                                className="h-9 bg-background font-medium text-[10px]" 
                                            />
                                        </div>
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => handleRemoveStatusForIndustry(selectedIndustryTab, idx)}
                                            disabled={industryLifecycles[selectedIndustryTab].length === 1}
                                            className="h-9 w-9 rounded-xl text-destructive active:scale-[0.9]"
                                        >
                                            <X size={16} />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3 text-left">
                            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                                <p className="text-[10px] font-semibold text-blue-900 ">Dynamic Seeding Notice</p>
                                <p className="text-[9px] font-medium text-blue-800/70 leading-relaxed">
                                    New workspaces created under {selectedIndustryTab === 'SchoolEnrollment' ? 'School Enrollment' : selectedIndustryTab === 'RealEstate' ? 'Real Estate' : selectedIndustryTab} will clone these defaults immediately. Existing active workspaces will retain their custom configuration and will not be affected.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Global Lead Scoring Defaults */}
                <Card className="rounded-[2rem] border-none shadow-sm ring-1 ring-border overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b p-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                                    <Sparkles className="h-6 w-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-bold">Global Lead Scoring Defaults</CardTitle>
                                    <CardDescription>Configure baseline defaults for verification thresholds, negative scoring delta rules, and engagement points.</CardDescription>
                                </div>
                            </div>
                            <Badge variant="secondary" className="bg-primary/10 text-primary border-none">Scoring Defaults</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8">
                        
                        {/* Email Verification Rules */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Email Verification Score Mapping</h3>
                                <Button type="button" variant="outline" size="sm" onClick={handleAddEmailRule} className="rounded-lg text-xs gap-1.5 h-8 font-bold">
                                    <PlusCircle size={14} /> Add Threshold Rule
                                </Button>
                            </div>
                            <div className="space-y-3">
                                {(leadScoring.emailVerificationRules || []).map((rule, idx) => (
                                    <div key={idx} className="flex items-center gap-3 bg-card p-3 rounded-xl border border-border/50">
                                        <div className="flex-1 grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Min Validation Score (%)</label>
                                                <Input 
                                                    type="number"
                                                    value={rule.minScore}
                                                    onChange={e => handleUpdateEmailRule(idx, { minScore: Number(e.target.value) })}
                                                    className="h-9 rounded-lg"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Score Points Delta (+/-)</label>
                                                <Input 
                                                    type="number"
                                                    value={rule.scoreValue}
                                                    onChange={e => handleUpdateEmailRule(idx, { scoreValue: Number(e.target.value) })}
                                                    className="h-9 rounded-lg"
                                                />
                                            </div>
                                        </div>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveEmailRule(idx)} className="h-9 w-9 text-destructive rounded-xl shrink-0 mt-4">
                                            <X size={16} />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Separator />

                        {/* Phone Verification Rules */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Phone Verification Score Mapping</h3>
                                <Button type="button" variant="outline" size="sm" onClick={handleAddPhoneRule} className="rounded-lg text-xs gap-1.5 h-8 font-bold">
                                    <PlusCircle size={14} /> Add Threshold Rule
                                </Button>
                            </div>
                            <div className="space-y-3">
                                {(leadScoring.phoneVerificationRules || []).map((rule, idx) => (
                                    <div key={idx} className="flex items-center gap-3 bg-card p-3 rounded-xl border border-border/50">
                                        <div className="flex-1 grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Min Validation Score (%)</label>
                                                <Input 
                                                    type="number"
                                                    value={rule.minScore}
                                                    onChange={e => handleUpdatePhoneRule(idx, { minScore: Number(e.target.value) })}
                                                    className="h-9 rounded-lg"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Score Points Delta (+/-)</label>
                                                <Input 
                                                    type="number"
                                                    value={rule.scoreValue}
                                                    onChange={e => handleUpdatePhoneRule(idx, { scoreValue: Number(e.target.value) })}
                                                    className="h-9 rounded-lg"
                                                />
                                            </div>
                                        </div>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => handleRemovePhoneRule(idx)} className="h-9 w-9 text-destructive rounded-xl shrink-0 mt-4">
                                            <X size={16} />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Separator />

                        {/* Engagement Triggers Score Mapping */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Engagement Activities Defaults</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.keys(ENGAGEMENT_TRIGGER_LABELS).map((triggerKey) => (
                                    <div key={triggerKey} className="flex flex-col gap-1.5 p-3.5 rounded-2xl border border-border/50 bg-card">
                                        <label className="text-xs font-semibold text-muted-foreground">
                                            {ENGAGEMENT_TRIGGER_LABELS[triggerKey]}
                                        </label>
                                        <Input 
                                            type="number"
                                            value={leadScoring.engagementRules?.[triggerKey] ?? 0}
                                            onChange={e => {
                                                const val = Number(e.target.value);
                                                setLeadScoring(prev => ({
                                                    ...prev,
                                                    engagementRules: {
                                                        ...(prev.engagementRules || {}),
                                                        [triggerKey]: val
                                                    }
                                                }));
                                            }}
                                            className="h-9 rounded-lg"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Separator />

                        {/* Call Campaign Outcomes Defaults */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Call Campaign Outcomes Defaults</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Positive Call Outcomes</label>
                                    <div className="flex gap-2 mb-3">
                                        <Input 
                                            value={newOutcome}
                                            onChange={e => setNewOutcome(e.target.value)}
                                            placeholder="e.g. Agreed"
                                            className="h-9 rounded-lg"
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddOutcome(); } }}
                                        />
                                        <Button type="button" onClick={handleAddOutcome} className="h-9 rounded-lg px-4 font-bold text-xs bg-primary text-primary-foreground hover:bg-primary/90">
                                            Add
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {(leadScoring.callCampaignPositiveOutcomes || []).length === 0 ? (
                                            <span className="text-[10px] text-muted-foreground italic">No default positive outcomes defined.</span>
                                        ) : (
                                            (leadScoring.callCampaignPositiveOutcomes || []).map(o => (
                                                <Badge key={o} variant="secondary" className="gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-muted text-muted-foreground">
                                                    {o}
                                                    <button type="button" onClick={() => handleRemoveOutcome(o)} className="text-muted-foreground hover:text-foreground">
                                                        <X size={10} />
                                                    </button>
                                                </Badge>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Default Positive Points</label>
                                    <Input 
                                        type="number"
                                        value={leadScoring.callCampaignDefaultPoints ?? 0}
                                        onChange={e => setLeadScoring(prev => ({ ...prev, callCampaignDefaultPoints: Number(e.target.value) }))}
                                        className="h-9 rounded-lg"
                                    />
                                    <p className="text-[9px] text-muted-foreground leading-normal">Points awarded automatically when a call outcome matches one of the positive outcomes listed.</p>
                                </div>
                            </div>
                        </div>

                    </CardContent>
                </Card>

                <Card className="rounded-3xl border-border/80 shadow-sm overflow-hidden">
                    <CardHeader>
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <Shield className="h-4 w-4 text-primary" /> Key Rotation & Security
                        </CardTitle>
                        <CardDescription>Verify vault encryption alignment and trigger envelope re-keying.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            If you rotated the master key envelope environment parameters (`WHATSAPP_ENCRYPTION_KEY` / `WHATSAPP_ENCRYPTION_KEY_ID`), click below to re-encrypt stored secrets with the current key.
                        </p>
                        <Button 
                            type="button"
                            variant="outline" 
                            disabled={isRotating}
                            onClick={handleRotateSecrets}
                            className="w-full rounded-xl flex items-center justify-center gap-2 text-xs font-semibold"
                        >
                            {isRotating ? (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : (
                                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                            )}
                            Rotate Encrypted Secrets
                        </Button>
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
