'use client';

import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Smartphone, Pencil, PlusCircle, ShieldCheck, HeartHandshake, FileText, Link2, Eye } from 'lucide-react';
import { PageEditor, PagePreviewModal } from './result-page-builder';
import { TemplateWorkshopSheet } from '@/app/admin/messaging/components/TemplateWorkshopSheet';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { SenderProfile } from '@/lib/types';
import { MessagingTemplateSelector } from '../../components/MessagingTemplateSelector';
import { useWorkspace } from '@/context/WorkspaceContext';

export function MinimalRespondentMessage() {
    const { control, watch, setValue } = useFormContext();
    const firestore = useFirestore();

    const [activeTemplateConfig, setActiveTemplateConfig] = React.useState<{ channel: 'email' | 'sms', templateId?: string } | null>(null);

    // Ensure at least one resultRule exists for minimal messaging
    const rules = watch('resultRules') || [];
    React.useEffect(() => {
        if (rules.length === 0) {
            setValue('resultRules', [{ 
                id: `rule_minimal_${Date.now()}`, 
                label: 'All Respondents', 
                minScore: 0, 
                maxScore: 100, 
                priority: 0, 
                pageId: '' 
            }], { shouldDirty: true });
        }
    }, [rules.length, setValue]);

    const { activeOrganization } = useWorkspace();
    const profilesQuery = useMemoFirebase(() => {
        const orgId = activeOrganization?.id;
        if (!firestore || !orgId) return null;
        return query(
            collection(firestore, 'sender_profiles'),
            where('organizationId', '==', orgId),
            where('isActive', '==', true),
        );
    }, [firestore, activeOrganization?.id]);

    const { data: profiles } = useCollection<SenderProfile>(profilesQuery);

    const smsProfiles = profiles?.filter(p => p.channel === 'sms' && p.isActive);
    const emailProfiles = profiles?.filter(p => p.channel === 'email' && p.isActive);

    const selectedEmailId = watch(`resultRules.0.emailTemplateId`);
    const selectedSmsId = watch(`resultRules.0.smsTemplateId`);

    return (
        <Card className="rounded-2xl border border-border bg-card overflow-hidden">
            <CardHeader className="bg-muted/10 border-b py-5 px-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-xl shadow-inner">
                        <HeartHandshake className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <CardTitle className="text-sm font-semibold tracking-tight">Respondent Message</CardTitle>
                        <CardDescription className="text-xs">Send an automated message to all respondents upon completion.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Email Automation */}
                    <div className="p-4 rounded-xl border bg-blue-50/30 border-blue-100 space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 text-blue-600">
                                <Mail className="h-4 w-4" />
                                <span className="text-[10px] font-semibold">Email Completion</span>
                            </div>
                            <div className="flex items-center gap-1">
                                {selectedEmailId && selectedEmailId !== 'none' && (
                                    <Button 
                                        type="button" 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-blue-600 gap-1 rounded-lg hover:bg-blue-100"
                                        onClick={() => setActiveTemplateConfig({ channel: 'email', templateId: selectedEmailId })}
                                    >
                                        <Pencil className="h-3 w-3" /> Edit
                                    </Button>
                                )}
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-blue-600 gap-1 rounded-lg hover:bg-blue-100"
                                    onClick={() => setActiveTemplateConfig({ channel: 'email' })}
                                >
                                    <PlusCircle className="h-3 w-3" /> New
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <Controller
                                name={`resultRules.0.emailTemplateId`}
                                control={control}
                                render={({ field }) => (
                                    <MessagingTemplateSelector 
                                        category="surveys"
                                        recipientType="respondent"
                                        channel="email"
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        placeholder="Choose email blueprint..."
                                        compact
                                    />
                                )}
                            />
                            {selectedEmailId && selectedEmailId !== 'none' && (
                                <Controller
                                    name={`resultRules.0.emailSenderProfileId`}
                                    control={control}
                                    render={({ field }) => (
                                        <Select value={field.value || 'none'} onValueChange={field.onChange}>
                                            <SelectTrigger className="h-9 bg-card border-blue-200 text-[10px] font-bold text-blue-700/60 flex items-center gap-2">
                                                <ShieldCheck className="h-3 w-3" />
                                                <SelectValue placeholder="Resolved From Identity" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Auto-Resolve (Default)</SelectItem>
                                                {emailProfiles?.map(p => (
                                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            )}
                        </div>
                    </div>

                    {/* SMS Automation */}
                    <div className="p-4 rounded-xl border bg-orange-50/30 border-orange-100 space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 text-orange-600">
                                <Smartphone className="h-4 w-4" />
                                <span className="text-[10px] font-semibold">SMS Completion</span>
                            </div>
                            <div className="flex items-center gap-1">
                                {selectedSmsId && selectedSmsId !== 'none' && (
                                    <Button 
                                        type="button" 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-orange-600 gap-1 rounded-lg hover:bg-orange-100"
                                        onClick={() => setActiveTemplateConfig({ channel: 'sms', templateId: selectedSmsId })}
                                    >
                                        <Pencil className="h-3 w-3" /> Edit
                                    </Button>
                                )}
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-orange-600 gap-1 rounded-lg hover:bg-orange-100"
                                    onClick={() => setActiveTemplateConfig({ channel: 'sms' })}
                                >
                                    <PlusCircle className="h-3 w-3" /> New
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <Controller
                                name={`resultRules.0.smsTemplateId`}
                                control={control}
                                render={({ field }) => (
                                    <MessagingTemplateSelector 
                                        category="surveys"
                                        recipientType="respondent"
                                        channel="sms"
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        placeholder="Choose SMS blueprint..."
                                        compact
                                    />
                                )}
                            />
                            {selectedSmsId && selectedSmsId !== 'none' && (
                                <Controller
                                    name={`resultRules.0.smsSenderProfileId`}
                                    control={control}
                                    render={({ field }) => (
                                        <Select value={field.value || 'none'} onValueChange={field.onChange}>
                                            <SelectTrigger className="h-9 bg-card border-orange-200 text-[10px] font-bold text-orange-700/60 flex items-center gap-2">
                                                <ShieldCheck className="h-3 w-3" />
                                                <SelectValue placeholder="Resolved From Identity" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Auto-Resolve (Default)</SelectItem>
                                                {smsProfiles?.map(p => (
                                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {activeTemplateConfig && (
                    <TemplateWorkshopSheet 
                        open={!!activeTemplateConfig}
                        onOpenChange={(o) => !o && setActiveTemplateConfig(null)}
                        templateId={activeTemplateConfig.templateId}
                        initialContext={{
                            channel: activeTemplateConfig.channel,
                            category: "surveys",
                            recipientType: "respondent"
                        }}
                        onCreated={(template) => {
                            if (activeTemplateConfig.channel === 'email') {
                                setValue(`resultRules.0.emailTemplateId`, template.id, { shouldDirty: true });
                            } else {
                                setValue(`resultRules.0.smsTemplateId`, template.id, { shouldDirty: true });
                            }
                        }}
                    />
                )}
            </CardContent>
        </Card>
    );
}

export function MinimalThankYouPage() {
    const { watch, setValue, register, control } = useFormContext();
    const pages = watch('resultPages') || [];
    const redirectEnabled = watch('thankYouRedirectEnabled');
    const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);

    // Ensure at least one resultPage exists and seed with default content if missing
    React.useEffect(() => {
        if (pages.length === 0) {
            setValue('resultPages', [{
                id: `pg_default_${Date.now()}`,
                name: 'Thank You Page',
                isDefault: true,
                blocks: [
                    {
                        id: `blk_title_${Date.now()}`,
                        type: 'heading',
                        title: 'Thank You!',
                        variant: 'h1',
                        style: { textAlign: 'center' }
                    },
                    {
                        id: `blk_text_${Date.now()}`,
                        type: 'text',
                        content: 'Your response has been successfully recorded. We appreciate your time.',
                        style: { textAlign: 'center' }
                    }
                ]
            }], { shouldDirty: true });
        }
    }, [pages.length, setValue]);

    if (pages.length === 0) return null;

    return (
        <Card className="rounded-2xl border border-border bg-card overflow-hidden">
            <CardHeader className="bg-muted/10 border-b py-5 px-6">
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-xl shadow-inner">
                            <FileText className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-semibold tracking-tight">Post-Submission Experience</CardTitle>
                            <CardDescription className="text-xs">Customize what respondents see or where they go after submitting.</CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button 
                            type="button" 
                            variant="outline" 
                            className="h-9 px-4 gap-2 font-bold text-xs rounded-xl shadow-sm hover:bg-muted"
                            onClick={() => setIsPreviewOpen(true)}
                        >
                            <Eye className="h-4 w-4 text-muted-foreground" /> Preview
                        </Button>
                        <div className="flex items-center gap-2">
                            <Label htmlFor="redirect-toggle" className="text-xs font-semibold text-slate-500">Redirect URL</Label>
                            <Switch 
                                id="redirect-toggle" 
                                checked={!!redirectEnabled} 
                                onCheckedChange={(val) => setValue('thankYouRedirectEnabled', val, { shouldDirty: true })} 
                                className="scale-90 data-[state=checked]:bg-emerald-500"
                            />
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
                {redirectEnabled ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="space-y-2">
                            <Label htmlFor="redirect-url-input" className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                                <Link2 className="h-3.5 w-3.5 text-primary" /> Redirect Destination URL
                            </Label>
                            <Input 
                                id="redirect-url-input" 
                                placeholder="https://yourwebsite.com/welcome?submission_id={{submission_id}}" 
                                {...register('thankYouRedirectUrl')} 
                                className="bg-card border border-border/50 shadow-sm focus-visible:ring-1 focus-visible:ring-emerald-500/30 rounded-xl h-11"
                            />
                        </div>
                        <Controller
                            name="embedRedirectMode"
                            control={control}
                            render={({ field }) => (
                                <div className="space-y-2 pt-2">
                                    <Label className="text-xs font-bold text-slate-600">Redirect Target (Embedded Mode)</Label>
                                    <div className="grid grid-cols-2 gap-2 bg-muted/20 p-1 rounded-xl border border-border/50">
                                        <button
                                            type="button"
                                            onClick={() => field.onChange('modal')}
                                            className={cn(
                                                "h-9 rounded-lg font-semibold text-xs transition-all duration-200 ease-out flex items-center justify-center gap-2",
                                                (field.value || 'modal') === 'modal' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            Show in Modal
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => field.onChange('parent')}
                                            className={cn(
                                                "h-9 rounded-lg font-semibold text-xs transition-all duration-200 ease-out flex items-center justify-center gap-2",
                                                field.value === 'parent' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            Reload Parent Page
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                                        Choose whether to load the redirect page inside the modal iframe, or reload/refresh the top-level parent page.
                                    </p>
                                </div>
                            )}
                        />
                        <div className="p-4 rounded-xl border border-dashed border-emerald-200/50 bg-emerald-50/20 text-xs text-emerald-700/80 leading-relaxed space-y-2">
                            <p className="font-bold text-emerald-800">💡 Personalize the Redirect URL:</p>
                            <p>You can embed respondent inputs and submission details using placeholders:</p>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                <span className="px-2 py-0.5 bg-emerald-100/50 border border-emerald-200 rounded font-mono text-[10px] text-emerald-800 font-bold select-all cursor-pointer">{"{{submission_id}}"}</span>
                                <span className="px-2 py-0.5 bg-emerald-100/50 border border-emerald-200 rounded font-mono text-[10px] text-emerald-800 font-bold select-all cursor-pointer">{"{{survey_title}}"}</span>
                                <span className="px-2 py-0.5 bg-emerald-100/50 border border-emerald-200 rounded font-mono text-[10px] text-emerald-800 font-bold select-all cursor-pointer">{"{{contact_name}}"}</span>
                                <span className="px-2 py-0.5 bg-emerald-100/50 border border-emerald-200 rounded font-mono text-[10px] text-emerald-800 font-bold select-all cursor-pointer">{"{{contact_email}}"}</span>
                                <span className="px-2 py-0.5 bg-emerald-100/50 border border-emerald-200 rounded font-mono text-[10px] text-emerald-800 font-bold select-all cursor-pointer">{"{{contact_phone}}"}</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <PageEditor pageIndex={0} />
                )}
            </CardContent>
            <PagePreviewModal 
                open={isPreviewOpen} 
                onOpenChange={setIsPreviewOpen} 
                page={pages[0]} 
            />
        </Card>
    );
}
