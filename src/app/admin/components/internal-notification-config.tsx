'use client';

import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { UserProfile, TemplateCategory } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Users, Mail, Smartphone, MessageCircle, Info, PlusCircle, Pencil, Bell, UserCheck, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MultiSelect } from '@/components/ui/multi-select';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { TemplateWorkshopSheet } from '@/app/admin/messaging/components/TemplateWorkshopSheet';
import { useTenant } from '@/context/TenantContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { MessagingTemplateSelector } from './MessagingTemplateSelector';
import AiSurveyMessagingModal from '@/app/admin/surveys/components/ai-survey-messaging-modal';
import { generateSurveyMessagingTemplatesAction } from '@/lib/survey-ai-messaging-actions';
import type { GenerateSurveyMessagingOutput } from '@/ai/schemas/survey-messaging-schemas';
import type { SurveyQuestion, SurveyElement } from '@/lib/types';

/**
 * Reusable configuration component for Internal Team Notifications.
 * Hooks directly into react-hook-form context.
 */
export default function InternalNotificationConfig({ prefix = "adminAlert", category = "surveys" }: { prefix?: string, category?: TemplateCategory }) {
    const { control, watch, setValue } = useFormContext();
    const firestore = useFirestore();
    const { activeOrganizationId } = useTenant();

    const enabled = watch(`${prefix}sEnabled`);
    const rawChannel = watch(`${prefix}Channel`);
    const rawChannels = watch(`${prefix}Channels`);

    // Parse active channels supporting both new array and legacy string format
    const activeChannels = React.useMemo<Array<'email' | 'sms' | 'whatsapp'>>(() => {
        if (Array.isArray(rawChannels) && rawChannels.length > 0) {
            return rawChannels.filter((c): c is 'email' | 'sms' | 'whatsapp' => ['email', 'sms', 'whatsapp'].includes(c));
        }
        if (rawChannel === 'both') return ['email', 'sms'];
        if (rawChannel === 'all') return ['email', 'sms', 'whatsapp'];
        if (rawChannel === 'sms') return ['sms'];
        if (rawChannel === 'whatsapp') return ['whatsapp'];
        return ['email'];
    }, [rawChannels, rawChannel]);

    const handleToggleChannel = (c: 'email' | 'sms' | 'whatsapp') => {
        let next: Array<'email' | 'sms' | 'whatsapp'>;
        if (activeChannels.includes(c)) {
            if (activeChannels.length <= 1) return; // Keep at least one channel active
            next = activeChannels.filter(x => x !== c);
        } else {
            next = [...activeChannels, c];
        }
        setValue(`${prefix}Channels`, next, { shouldDirty: true });
        
        // Sync legacy channel field for backwards compatibility
        if (next.includes('email') && next.includes('sms') && next.includes('whatsapp')) {
            setValue(`${prefix}Channel`, 'all', { shouldDirty: true });
        } else if (next.includes('email') && next.includes('sms')) {
            setValue(`${prefix}Channel`, 'both', { shouldDirty: true });
        } else if (next.length === 1) {
            setValue(`${prefix}Channel`, next[0], { shouldDirty: true });
        } else {
            setValue(`${prefix}Channel`, next.includes('whatsapp') ? 'all' : 'both', { shouldDirty: true });
        }
    };

    const { activeWorkspaceId } = useWorkspace();
    const { user } = useUser();
    const { toast } = useToast();
    const [quickCreateState, setQuickCreateState] = React.useState<{ channel: 'email' | 'sms', open: boolean, templateId?: string } | null>(null);
    const [isAiModalOpen, setIsAiModalOpen] = React.useState(false);
    const [isGeneratingAi, setIsGeneratingAi] = React.useState(false);
    const [aiOutput, setAiOutput] = React.useState<GenerateSurveyMessagingOutput | null>(null);
    const [savedTemplateIds, setSavedTemplateIds] = React.useState<{ emailTemplateId?: string; smsTemplateId?: string; whatsappTemplateId?: string } | undefined>(undefined);

    const handleGenerateAi = async () => {
        if (!activeWorkspaceId || !activeOrganizationId) return;
        setIsGeneratingAi(true);
        setIsAiModalOpen(true);

        try {
            const title = watch('title') || watch('internalName') || 'Survey';
            const description = watch('description') || '';
            const scoringEnabled = !!watch('scoringEnabled');
            const maxScore = watch('maxScore') || 100;
            const elements: SurveyElement[] = watch('elements') || [];
            const questions: Array<{ id: string; title: string; type: string }> = elements
                .filter((el): el is SurveyQuestion => 'isRequired' in el)
                .map((q) => ({ id: q.id, title: String(q.title || ''), type: q.type }));

            const res = await generateSurveyMessagingTemplatesAction({
                workspaceId: activeWorkspaceId,
                organizationId: activeOrganizationId,
                userId: user?.uid,
                surveyTitle: title,
                surveyDescription: description,
                target: 'internal_team_alert',
                channels: activeChannels,
                keyQuestions: questions,
                scoringEnabled,
                maxScore,
                autoSave: true,
            });

            if (res.success && res.output) {
                setAiOutput(res.output);
                setSavedTemplateIds(res.savedTemplateIds);
            } else {
                toast({
                    variant: 'destructive',
                    title: 'AI Generation Failed',
                    description: res.error || 'Could not generate team alert templates.',
                });
                setIsAiModalOpen(false);
            }
        } catch (err: unknown) {
            toast({
                variant: 'destructive',
                title: 'AI Generation Error',
                description: err instanceof Error ? err.message : 'Unknown error during AI generation.',
            });
            setIsAiModalOpen(false);
        } finally {
            setIsGeneratingAi(false);
        }
    };

    const handleApplyAiTemplates = (ids: { emailTemplateId?: string; smsTemplateId?: string; whatsappTemplateId?: string }) => {
        if (ids.emailTemplateId) {
            setValue(`${prefix}EmailTemplateId`, ids.emailTemplateId, { shouldDirty: true });
        }
        if (ids.smsTemplateId) {
            setValue(`${prefix}SmsTemplateId`, ids.smsTemplateId, { shouldDirty: true });
        }
        if (ids.whatsappTemplateId) {
            setValue(`${prefix}WhatsappTemplateId`, ids.whatsappTemplateId, { shouldDirty: true });
        }
    };

    const usersQuery = useMemoFirebase(() => {
        if (!firestore || !activeOrganizationId) return null;
        return query(
            collection(firestore, 'users'), 
            where('organizationId', '==', activeOrganizationId),
            where('isAuthorized', '==', true), 
            orderBy('name', 'asc')
        );
    }, [firestore, activeOrganizationId]);

    const { data: users } = useCollection<UserProfile>(usersQuery);

    const userOptions = React.useMemo(() => 
        users?.map(u => ({ label: u.name, value: u.id })) || [], 
    [users]);

    return (
        <div className="space-y-4">
            <div className={cn(
                "rounded-[2rem] border-2 transition-all duration-500",
                enabled ? "border-primary/20 bg-primary/5 shadow-xl shadow-primary/5" : "border-border/50 bg-background"
            )}>
                <div className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-4">
                        <div className={cn(
                            "p-3 rounded-2xl transition-all duration-500", 
                            enabled ? "bg-primary text-white shadow-lg shadow-primary/20 rotate-3" : "bg-muted text-muted-foreground"
                        )}>
                            <Bell className="h-6 w-6" />
                        </div>
                        <div className="space-y-0.5">
                            <Label className="text-base font-semibold tracking-tight">Internal Team Alerts</Label>
                            <p className="text-[10px] text-muted-foreground font-semibold tracking-tighter">Notify your team on completion</p>
                        </div>
                    </div>
                    <Controller
                        name={`${prefix}sEnabled`}
                        control={control}
                        render={({ field }) => (
                            <Switch 
                                checked={!!field.value} 
                                onCheckedChange={field.onChange} 
                                className="scale-125"
                            />
                        )}
                    />
                </div>

                {enabled && (
                    <div className="p-6 pt-0 space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                        <Separator className="bg-primary/10" />
                        
                        {/* Routing Logic */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <Label className="text-[10px] font-semibold text-primary ml-1">1. Recipient Intelligence</Label>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-4 bg-card rounded-2xl border border-primary/10 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary/10 rounded-lg text-primary"><UserCheck className="h-4 w-4" /></div>
                                            <span className="text-xs font-bold tracking-tight">Notify Assigned Manager</span>
                                        </div>
                                        <Controller
                                             name={`${prefix}NotifyManager`}
                                            control={control}
                                            render={({ field }) => <Switch checked={!!field.value} onCheckedChange={field.onChange} />}
                                        />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Users className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-[10px] font-semibold text-muted-foreground">Additional Subscribers</span>
                                        </div>
                                        <Controller
                                            name={`${prefix}SpecificUserIds`}
                                            control={control}
                                            render={({ field }) => (
                                                <MultiSelect 
                                                    options={userOptions}
                                                    value={field.value || []}
                                                    onChange={field.onChange}
                                                    placeholder="Select team members..."
                                                />
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-semibold text-primary ml-1">2. Delivery Medium (Multi-Select)</Label>
                                    <span className="text-[9px] text-muted-foreground font-medium">Toggle any combination</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 bg-muted/30 p-1.5 rounded-2xl border">
                                    {([
                                        { key: 'email' as const, label: 'Email', icon: Mail },
                                        { key: 'sms' as const, label: 'SMS', icon: Smartphone },
                                        { key: 'whatsapp' as const, label: 'WhatsApp', icon: MessageCircle },
                                    ]).map(({ key: c, label, icon: Icon }) => {
                                        const isSelected = activeChannels.includes(c);
                                        return (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => handleToggleChannel(c)}
                                                className={cn(
                                                    "h-11 rounded-xl font-bold uppercase text-[10px] flex items-center justify-center gap-1.5 transition-all min-h-[44px] active:scale-[0.97]",
                                                    isSelected 
                                                        ? "bg-card shadow-md text-primary border border-primary/20 ring-1 ring-primary/20" 
                                                        : "text-muted-foreground opacity-60 hover:opacity-100 hover:bg-card/50"
                                                )}
                                                aria-pressed={isSelected}
                                            >
                                                <Icon className="h-3.5 w-3.5 shrink-0" />
                                                <span>{label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3">
                                    <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                    <p className="text-[9px] font-bold text-blue-800 leading-relaxed tracking-tighter">
                                        Alerts use professional internal templates across all toggled channels to maintain team context.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Template Selection */}
                        <div className="pt-4 border-t border-primary/10 space-y-4">
                            <div className="flex items-center justify-between px-1">
                                <div>
                                    <Label className="text-[10px] font-bold text-primary tracking-wider uppercase">2. Alert Template Configuration</Label>
                                    <p className="text-[10px] text-muted-foreground font-semibold">Assign or generate templates for active channels</p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleGenerateAi}
                                    disabled={isGeneratingAi}
                                    className="h-8 px-3 text-[11px] font-bold gap-1.5 text-primary border-primary/30 hover:bg-primary/5 rounded-xl active:scale-[0.97] transition-all shadow-sm"
                                >
                                    <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />
                                    AI Generate Team Alerts
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {activeChannels.includes('email') && (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center px-1">
                                        <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-2">
                                            <Mail className="h-3 w-3" /> Internal Email Template
                                        </Label>
                                        <div className="flex items-center gap-1">
                                            <Controller
                                                name={`${prefix}EmailTemplateId`}
                                                control={control}
                                                render={({ field }) => (
                                                    <>
                                                        {field.value && field.value !== 'none' ? (
                                                            <Button 
                                                                type="button" 
                                                                variant="ghost" 
                                                                className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-primary gap-1 rounded-lg"
                                                                onClick={() => setQuickCreateState({ channel: 'email', open: true, templateId: field.value })}
                                                            >
                                                                <Pencil className="h-3 w-3" /> Edit
                                                            </Button>
                                                        ) : null}
                                                    </>
                                                )}
                                            />
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-primary gap-1 rounded-lg"
                                                onClick={() => setQuickCreateState({ channel: 'email', open: true })}
                                            >
                                                <PlusCircle className="h-3 w-3" /> New
                                            </Button>
                                        </div>
                                    </div>
                                    <Controller
                                        name={`${prefix}EmailTemplateId`}
                                        control={control}
                                        render={({ field }) => (
                                            <MessagingTemplateSelector 
                                                category={category}
                                                recipientType="internal_alert"
                                                channel="email"
                                                value={field.value}
                                                onValueChange={field.onChange}
                                                placeholder="Select email template..."
                                                compact
                                            />
                                        )}
                                    />
                                </div>
                            )}

                            {activeChannels.includes('sms') && (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center px-1">
                                        <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-2">
                                            <Smartphone className="h-3 w-3" /> Internal SMS Alert
                                        </Label>
                                        <div className="flex items-center gap-1">
                                            <Controller
                                                name={`${prefix}SmsTemplateId`}
                                                control={control}
                                                render={({ field }) => (
                                                    <>
                                                        {field.value && field.value !== 'none' ? (
                                                            <Button 
                                                                type="button" 
                                                                variant="ghost" 
                                                                className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-primary gap-1 rounded-lg"
                                                                onClick={() => setQuickCreateState({ channel: 'sms', open: true, templateId: field.value })}
                                                            >
                                                                <Pencil className="h-3 w-3" /> Edit
                                                            </Button>
                                                        ) : null}
                                                    </>
                                                )}
                                            />
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-primary gap-1 rounded-lg"
                                                onClick={() => setQuickCreateState({ channel: 'sms', open: true })}
                                            >
                                                <PlusCircle className="h-3 w-3" /> New
                                            </Button>
                                        </div>
                                    </div>
                                    <Controller
                                        name={`${prefix}SmsTemplateId`}
                                        control={control}
                                        render={({ field }) => (
                                            <MessagingTemplateSelector 
                                                category={category}
                                                recipientType="internal_alert"
                                                channel="sms"
                                                value={field.value}
                                                onValueChange={field.onChange}
                                                placeholder="Select SMS alert..."
                                                compact
                                            />
                                        )}
                                    />
                                </div>
                            )}

                            {activeChannels.includes('whatsapp') && (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-2 px-1">
                                        <MessageCircle className="h-3 w-3" /> Internal WhatsApp Template
                                    </Label>
                                    <Controller
                                        name={`${prefix}WhatsappTemplateId`}
                                        control={control}
                                        render={({ field }) => (
                                            <MessagingTemplateSelector
                                                category={category}
                                                recipientType="internal_alert"
                                                channel="whatsapp"
                                                value={field.value}
                                                onValueChange={field.onChange}
                                                placeholder="Select approved WhatsApp template..."
                                                compact
                                            />
                                        )}
                                    />
                                    <p className="text-[9px] font-semibold text-muted-foreground px-1">
                                        Only approved templates send. Adopt one from Messaging → Templates.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>

            {quickCreateState && (
                <TemplateWorkshopSheet 
                    open={quickCreateState.open}
                    onOpenChange={(o) => !o && setQuickCreateState(null)}
                    templateId={quickCreateState.templateId}
                    initialContext={{
                        channel: quickCreateState.channel,
                        category: category,
                        recipientType: "internal_alert"
                    }}
                    onCreated={(template) => {
                        if (quickCreateState.channel === 'email') {
                            setValue(`${prefix}EmailTemplateId`, template.id, { shouldDirty: true });
                        } else {
                            setValue(`${prefix}SmsTemplateId`, template.id, { shouldDirty: true });
                        }
                    }}
                />
            )}

            <AiSurveyMessagingModal
                open={isAiModalOpen}
                onOpenChange={setIsAiModalOpen}
                title="AI Generated Team Alerts"
                targetDescription="Auto-generated alert templates for internal team members and assigned managers."
                generatedOutput={aiOutput}
                savedTemplateIds={savedTemplateIds}
                isLoading={isGeneratingAi}
                onApply={handleApplyAiTemplates}
                onRegenerate={handleGenerateAi}
            />
        </div>
    );
}