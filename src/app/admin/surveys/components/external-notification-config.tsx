'use client';

import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import type { TemplateCategory } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Users, Mail, Smartphone, MessageCircle, PlusCircle, Pencil, Filter, Sparkles, Eye } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TagInput } from '@/components/ui/tag-input';
import { Button } from '@/components/ui/button';
import { TemplateWorkshopSheet } from '@/app/admin/messaging/components/TemplateWorkshopSheet';
import { useTenant } from '@/context/TenantContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { MessagingTemplateSelector } from '../../components/MessagingTemplateSelector';
import AiSurveyMessagingModal from './ai-survey-messaging-modal';
import { generateSurveyMessagingTemplatesAction } from '@/lib/survey-ai-messaging-actions';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import type { GenerateSurveyMessagingOutput } from '@/ai/schemas/survey-messaging-schemas';
import type { SurveyQuestion, SurveyElement } from '@/lib/types';

export default function ExternalNotificationConfig({ prefix = "externalAlert", category = "surveys" }: { prefix?: string, category?: TemplateCategory }) {
    const { control, watch, setValue } = useFormContext();
    const { activeWorkspaceId } = useWorkspace();
    const { activeOrganizationId } = useTenant();
    const { user } = useUser();
    const { toast } = useToast();

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

    const [quickCreateState, setQuickCreateState] = React.useState<{ channel: 'email' | 'sms', open: boolean, templateId?: string } | null>(null);
    const [isAiModalOpen, setIsAiModalOpen] = React.useState(false);
    const [isGeneratingAi, setIsGeneratingAi] = React.useState(false);
    const [aiOutput, setAiOutput] = React.useState<GenerateSurveyMessagingOutput | null>(null);
    const [savedTemplateIds, setSavedTemplateIds] = React.useState<{ emailTemplateId?: string; smsTemplateId?: string; whatsappTemplateId?: string } | undefined>(undefined);

    const handleGenerateAi = async (userPromptInstructions?: string) => {
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
                target: 'external_stakeholder_alert',
                channels: activeChannels,
                keyQuestions: questions,
                scoringEnabled,
                maxScore,
                userPromptInstructions,
                autoSave: false,
            });

            if (res.success && res.output) {
                setAiOutput(res.output);
                setSavedTemplateIds(res.savedTemplateIds || {});
            } else {
                toast({
                    variant: 'destructive',
                    title: 'AI Generation Failed',
                    description: res.error || 'Could not generate stakeholder alert templates.',
                    actionConfig: {
                        label: 'Check AI Settings',
                        path: '/admin/settings?tab=ai',
                    },
                });
                setIsAiModalOpen(false);
            }
        } catch (err: unknown) {
            toast({
                variant: 'destructive',
                title: 'AI Generation Error',
                description: err instanceof Error ? err.message : 'Unknown error during AI generation.',
                actionConfig: {
                    label: 'Check AI Settings',
                    path: '/admin/settings?tab=ai',
                },
            });
            setIsAiModalOpen(false);
        } finally {
            setIsGeneratingAi(false);
        }
    };

    const handleApplyAiTemplates = (ids: { emailTemplateId?: string; smsTemplateId?: string; whatsappTemplateId?: string }) => {
        setValue(`${prefix}EmailTemplateId`, ids.emailTemplateId || '', { shouldDirty: true });
        setValue(`${prefix}SmsTemplateId`, ids.smsTemplateId || '', { shouldDirty: true });
        setValue(`${prefix}WhatsappTemplateId`, ids.whatsappTemplateId || '', { shouldDirty: true });
        setSavedTemplateIds(ids);

        const nextChannels: ('email' | 'sms' | 'whatsapp')[] = [];
        if (ids.emailTemplateId) nextChannels.push('email');
        if (ids.smsTemplateId) nextChannels.push('sms');
        if (ids.whatsappTemplateId) nextChannels.push('whatsapp');
        if (nextChannels.length > 0) {
            setValue(`${prefix}Channels`, nextChannels, { shouldDirty: true });
            if (nextChannels.includes('email') && nextChannels.includes('sms') && nextChannels.includes('whatsapp')) {
                setValue(`${prefix}Channel`, 'all', { shouldDirty: true });
            } else if (nextChannels.includes('email') && nextChannels.includes('sms')) {
                setValue(`${prefix}Channel`, 'both', { shouldDirty: true });
            } else if (nextChannels.length === 1) {
                setValue(`${prefix}Channel`, nextChannels[0], { shouldDirty: true });
            } else {
                setValue(`${prefix}Channel`, nextChannels.includes('whatsapp') ? 'all' : 'both', { shouldDirty: true });
            }
        }
    };

    return (
        <div className="space-y-4">
            <Card className={cn(
                "rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs transition-all duration-300",
                !enabled && "hover:border-border"
            )}>
                <CardHeader className={cn(
                    "bg-muted/20 py-3.5 px-5 sm:px-6 transition-all duration-300",
                    enabled ? "border-b border-border/60" : ""
                )}>
                    <div className="w-full flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold shrink-0">
                                <Users className="h-4.5 w-4.5" />
                            </div>
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm sm:text-base font-bold text-foreground">
                                    External Contact Alerts
                                </CardTitle>
                                <CardInfoTooltip text="Notify external stakeholders or campus contacts automatically upon survey response submission." />
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2.5 shrink-0 ml-auto">
                            <Label htmlFor={`${prefix}s-master-toggle`} className="text-xs font-semibold cursor-pointer select-none text-muted-foreground">
                                {enabled ? 'Enabled' : 'Disabled'}
                            </Label>
                            <Controller
                                name={`${prefix}sEnabled`}
                                control={control}
                                render={({ field }) => (
                                    <Switch 
                                        id={`${prefix}s-master-toggle`}
                                        checked={!!field.value} 
                                        onCheckedChange={field.onChange} 
                                    />
                                )}
                            />
                        </div>
                    </div>
                </CardHeader>

                <AnimatePresence initial={false}>
                    {enabled && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                            className="overflow-hidden"
                        >
                            <CardContent className="p-5 sm:p-6 space-y-6">
                                {/* Stakeholder Contacts / Roles */}
                                <div className="space-y-2.5">
                                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                        <Filter className="h-3.5 w-3.5 text-primary" />
                                        <span>Alert External Contacts &amp; Roles</span>
                                    </Label>
                                    <Controller
                                        name={`${prefix}ContactTypes`}
                                        control={control}
                                        render={({ field }) => (
                                            <TagInput 
                                                value={field.value || []}
                                                onChange={field.onChange}
                                                placeholder="Enter emails, phones, or roles (press enter)..."
                                            />
                                        )}
                                    />
                                </div>

                                {/* Channels & Templates with AI Assistance */}
                                <div className="space-y-4 pt-2 border-t border-border/50">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        {/* Icon-only Channel Toggles */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-muted-foreground">Channels:</span>
                                            <div className="inline-flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/60">
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
                                                            title={label}
                                                            aria-label={label}
                                                            aria-pressed={isSelected}
                                                            className={cn(
                                                                "h-9 w-9 rounded-lg flex items-center justify-center transition-all min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] active:scale-[0.97]",
                                                                isSelected 
                                                                    ? "bg-primary/10 text-primary border border-primary/30 shadow-xs ring-1 ring-primary/20" 
                                                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent"
                                                            )}
                                                        >
                                                            <Icon className="h-4 w-4 shrink-0" />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* AI Generate & Review Draft Buttons */}
                                        <div className="flex items-center gap-2">
                                            {aiOutput && (
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => setIsAiModalOpen(true)}
                                                    className="min-h-[44px] sm:min-h-[36px] h-auto sm:h-9 px-3.5 text-xs font-semibold gap-1.5 text-foreground border border-border/80 hover:bg-muted/80 rounded-xl active:scale-[0.97] transition-all shadow-xs shrink-0 self-start sm:self-auto"
                                                >
                                                    <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                    <span>Review AI Draft</span>
                                                </Button>
                                            )}
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleGenerateAi()}
                                                disabled={isGeneratingAi}
                                                className="min-h-[44px] sm:min-h-[36px] h-auto sm:h-9 px-3.5 text-xs font-semibold gap-1.5 text-primary border-primary/30 hover:bg-primary/5 rounded-xl active:scale-[0.97] transition-all shadow-xs shrink-0 self-start sm:self-auto"
                                            >
                                                <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary shrink-0" />
                                                <span>AI Generate Stakeholder Alerts</span>
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Active Channel Template Selectors */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                                        {activeChannels.includes('email') && (
                                            <div className="space-y-2 p-3.5 rounded-xl border border-border/70 bg-card shadow-xs animate-in fade-in zoom-in-95 duration-200">
                                                <div className="flex justify-between items-center px-0.5">
                                                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                                        <Mail className="h-3.5 w-3.5 text-primary" /> External Email Template
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
                                                                            className="h-6 px-2 text-[10px] font-semibold text-primary gap-1 rounded-lg"
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
                                                            className="h-6 px-2 text-[10px] font-semibold text-primary gap-1 rounded-lg"
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
                                                            recipientType="external_alert"
                                                            channel="email"
                                                            value={field.value}
                                                            onValueChange={field.onChange}
                                                            placeholder="Select email blueprint..."
                                                            compact
                                                        />
                                                    )}
                                                />
                                            </div>
                                        )}

                                        {activeChannels.includes('sms') && (
                                            <div className="space-y-2 p-3.5 rounded-xl border border-border/70 bg-card shadow-xs animate-in fade-in zoom-in-95 duration-200">
                                                <div className="flex justify-between items-center px-0.5">
                                                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                                        <Smartphone className="h-3.5 w-3.5 text-primary" /> External SMS Template
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
                                                                            className="h-6 px-2 text-[10px] font-semibold text-primary gap-1 rounded-lg"
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
                                                            className="h-6 px-2 text-[10px] font-semibold text-primary gap-1 rounded-lg"
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
                                                            recipientType="external_alert"
                                                            channel="sms"
                                                            value={field.value}
                                                            onValueChange={field.onChange}
                                                            placeholder="Select SMS blueprint..."
                                                            compact
                                                        />
                                                    )}
                                                />
                                            </div>
                                        )}

                                        {activeChannels.includes('whatsapp') && (
                                            <div className="space-y-2 p-3.5 rounded-xl border border-border/70 bg-card shadow-xs animate-in fade-in zoom-in-95 duration-200">
                                                <div className="flex justify-between items-center px-0.5">
                                                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                                        <MessageCircle className="h-3.5 w-3.5 text-primary" /> External WhatsApp Template
                                                    </Label>
                                                </div>
                                                <Controller
                                                    name={`${prefix}WhatsappTemplateId`}
                                                    control={control}
                                                    render={({ field }) => (
                                                        <MessagingTemplateSelector 
                                                            category={category}
                                                            recipientType="external_alert"
                                                            channel="whatsapp"
                                                            value={field.value}
                                                            onValueChange={field.onChange}
                                                            placeholder="Select approved WhatsApp template..."
                                                            compact
                                                        />
                                                    )}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Card>

            {quickCreateState && (
                <TemplateWorkshopSheet 
                    open={quickCreateState.open}
                    onOpenChange={(o) => !o && setQuickCreateState(null)}
                    templateId={quickCreateState.templateId}
                    initialContext={{
                        channel: quickCreateState.channel,
                        category: category,
                        recipientType: prefix === 'externalAlert' ? 'external_alert' : 'internal_alert'
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
                title="AI Generated Stakeholder Alerts"
                targetDescription="Auto-generated alert templates for campus-level leadership and designated external emails."
                surveyTitle={watch('title') || watch('internalName') || 'Survey'}
                target="external_stakeholder_alert"
                generatedOutput={aiOutput}
                savedTemplateIds={savedTemplateIds}
                isLoading={isGeneratingAi}
                workspaceId={activeWorkspaceId || undefined}
                organizationId={activeOrganizationId || undefined}
                userId={user?.uid}
                onApply={handleApplyAiTemplates}
                onRegenerate={handleGenerateAi}
                onUpdateOutput={setAiOutput}
            />
        </div>
    );
}
