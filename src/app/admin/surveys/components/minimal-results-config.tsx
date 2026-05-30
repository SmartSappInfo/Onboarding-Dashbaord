'use client';

import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Mail, Smartphone, Pencil, PlusCircle, ShieldCheck, HeartHandshake, FileText } from 'lucide-react';
import { PageEditor } from './result-page-builder';
import { TemplateWorkshopSheet } from '@/app/admin/messaging/components/TemplateWorkshopSheet';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { SenderProfile } from '@/lib/types';
import { useParams } from 'next/navigation';
import { MessagingTemplateSelector } from '../../components/MessagingTemplateSelector';

export function MinimalRespondentMessage() {
    const { control, watch, setValue } = useFormContext();
    const params = useParams();
    const surveyId = params?.id as string;
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

    const profilesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'sender_profiles'), where('isActive', '==', true));
    }, [firestore]);

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
    const { watch, setValue } = useFormContext();
    const pages = watch('resultPages') || [];

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
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-xl shadow-inner">
                        <FileText className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                        <CardTitle className="text-sm font-semibold tracking-tight">Thank You Page</CardTitle>
                        <CardDescription className="text-xs">Customize the page respondents see after submitting the survey.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                <PageEditor pageIndex={0} />
            </CardContent>
        </Card>
    );
}
