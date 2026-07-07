'use client';

import * as React from 'react';
import { useFormContext, useFieldArray, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus, GripVertical, Mail, Smartphone, Pencil, PlusCircle, ArrowUp, ShieldCheck, Tag, Zap } from 'lucide-react';
import type { SurveyResultPage, SenderProfile } from '@/lib/types';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { TemplateWorkshopSheet } from '@/app/admin/messaging/components/TemplateWorkshopSheet';
import { useParams } from 'next/navigation';
import { MessagingTemplateSelector } from '../../components/MessagingTemplateSelector';
import { useWorkspace } from '@/context/WorkspaceContext';

function SortableRuleItem({ 
    id, 
    index, 
    pages, 
    remove, 
    profiles, 
    automations, 
    _surveyId 
}: { 
    id: string; 
    index: number; 
    pages: SurveyResultPage[]; 
    remove: (i: number) => void; 
    profiles?: SenderProfile[]; 
    automations?: SurveyAutomationOption[]; 
    _surveyId?: string; 
}) {
    const { register, watch, setValue, control } = useFormContext();
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

    const [activeTemplateConfig, setActiveTemplateConfig] = React.useState<{ channel: 'email' | 'sms' | 'whatsapp'; templateId?: string } | null>(null);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const smsProfiles = profiles?.filter(p => p.channel === 'sms' && p.isActive);
    const emailProfiles = profiles?.filter(p => p.channel === 'email' && p.isActive);
    const whatsappProfiles = profiles?.filter(p => p.channel === 'whatsapp' && p.isActive);

    const selectedEmailId = watch(`resultRules.${index}.emailTemplateId`);
    const selectedSmsId = watch(`resultRules.${index}.smsTemplateId`);
    const selectedWhatsappId = watch(`resultRules.${index}.whatsappTemplateId`);
    const currentRulePageId = watch(`resultRules.${index}.pageId`);

    const tagEnabled = watch(`resultRules.${index}.tagEnabled`);
    const automationEnabled = watch(`resultRules.${index}.automationEnabled`);
    const messagingEnabled = watch(`resultRules.${index}.messagingEnabled`);

    return (
        <div ref={setNodeRef} style={style} className="flex flex-col gap-4 p-6 border-2 rounded-2xl bg-card group relative hover:border-primary/30 transition-all shadow-sm">
            <div {...attributes} {...listeners} className="absolute -left-2 top-1/2 -translate-y-1/2 cursor-grab p-2 bg-background border rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            
            <div className="flex flex-col gap-4 w-full">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-grow grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-1.5 md:col-span-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Logic Label</Label>
                            <Input placeholder="e.g. Qualified" {...register(`resultRules.${index}.label`)} className="h-10 font-bold bg-muted/30 border-none shadow-none focus:ring-1 focus:ring-primary/20" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Range Start</Label>
                            <Input type="number" {...register(`resultRules.${index}.minScore`, { valueAsNumber: true })} className="h-10 font-bold bg-muted/30 border-none shadow-none focus:ring-1 focus:ring-primary/20" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Range End</Label>
                            <Input type="number" {...register(`resultRules.${index}.maxScore`, { valueAsNumber: true })} className="h-10 font-bold bg-muted/30 border-none shadow-none focus:ring-1 focus:ring-primary/20" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-semibold text-primary ml-1">Resulting Page</Label>
                            <Controller
                                name={`resultRules.${index}.pageId`}
                                control={control}
                                render={({ field }) => (
                                    <Select 
                                        value={field.value} 
                                        onValueChange={(val) => {
                                            field.onChange(val);
                                            if (val === '__redirect__') {
                                                setValue(`resultRules.${index}.redirectEnabled`, true, { shouldDirty: true });
                                            } else {
                                                setValue(`resultRules.${index}.redirectEnabled`, false, { shouldDirty: true });
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="h-10 bg-primary/5 border-primary/20 text-primary font-semibold">
                                            <SelectValue placeholder="Select page..." />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            {pages.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                            <SelectItem value="__redirect__" className="text-primary font-semibold">🔗 Link to External Page</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive mt-5 hover:bg-destructive/10 rounded-xl" onClick={() => remove(index)}>
                        <Trash2 className="h-5 w-5" />
                    </Button>
                </div>

                {currentRulePageId === '__redirect__' && (
                    <div className="space-y-3 mt-1 p-4 rounded-xl border border-primary/10 bg-primary/5 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-slate-600 flex items-center gap-1.5">
                                🔗 Redirect Destination URL
                            </Label>
                            <Input 
                                placeholder="https://example.com/thanks?sub_id={{submission_id}}" 
                                {...register(`resultRules.${index}.redirectUrl`)} 
                                className="bg-card border border-border/50 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/20 rounded-xl h-10"
                            />
                        </div>
                        <div className="p-3 rounded-lg border border-dashed border-primary/20 bg-primary/5 text-[9px] text-slate-500/80 leading-relaxed">
                            <span className="font-bold text-primary">💡 Placeholders:</span>{" "}
                            <span className="font-mono font-bold select-all cursor-pointer">{"{{submission_id}}"}</span>,{" "}
                            <span className="font-mono font-bold select-all cursor-pointer">{"{{score}}"}</span>,{" "}
                            <span className="font-mono font-bold select-all cursor-pointer">{"{{max_score}}"}</span>,{" "}
                            <span className="font-mono font-bold select-all cursor-pointer">{"{{contact_name}}"}</span>,{" "}
                            <span className="font-mono font-bold select-all cursor-pointer">{"{{contact_email}}"}</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="pt-4 border-t border-dashed space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[8px] h-5 uppercase px-2 font-semibold">Outcome Actions</Badge>
                    <p className="text-[10px] font-bold text-muted-foreground tracking-tighter">Configure tag, workflow, and message automations</p>
                </div>

                {/* Toggles Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Tag Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20 hover:bg-muted/30 transition-all">
                        <Label htmlFor={`tag-toggle-${index}`} className="text-xs font-bold text-foreground flex items-center gap-1.5 cursor-pointer select-none">
                            <Tag className="h-3.5 w-3.5 text-primary/70" /> Apply Tag
                        </Label>
                        <Switch 
                            id={`tag-toggle-${index}`}
                            checked={!!tagEnabled} 
                            onCheckedChange={(val) => {
                                setValue(`resultRules.${index}.tagEnabled`, val, { shouldDirty: true });
                                if (!val) setValue(`resultRules.${index}.applyTag`, '', { shouldDirty: true });
                            }} 
                            className="scale-90 data-[state=checked]:bg-primary"
                        />
                    </div>

                    {/* Automation Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20 hover:bg-muted/30 transition-all">
                        <Label htmlFor={`auto-toggle-${index}`} className="text-xs font-bold text-foreground flex items-center gap-1.5 cursor-pointer select-none">
                            <Zap className="h-3.5 w-3.5 text-primary/70" /> Trigger Automation
                        </Label>
                        <Switch 
                            id={`auto-toggle-${index}`}
                            checked={!!automationEnabled} 
                            onCheckedChange={(val) => {
                                setValue(`resultRules.${index}.automationEnabled`, val, { shouldDirty: true });
                                if (!val) setValue(`resultRules.${index}.triggerAutomationId`, '', { shouldDirty: true });
                            }} 
                            className="scale-90 data-[state=checked]:bg-primary"
                        />
                    </div>

                    {/* Messaging Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20 hover:bg-muted/30 transition-all">
                        <Label htmlFor={`msg-toggle-${index}`} className="text-xs font-bold text-foreground flex items-center gap-1.5 cursor-pointer select-none">
                            <Mail className="h-3.5 w-3.5 text-primary/70" /> Respondent Messages
                        </Label>
                        <Switch 
                            id={`msg-toggle-${index}`}
                            checked={!!messagingEnabled} 
                            onCheckedChange={(val) => {
                                setValue(`resultRules.${index}.messagingEnabled`, val, { shouldDirty: true });
                                if (!val) {
                                    setValue(`resultRules.${index}.emailTemplateId`, '', { shouldDirty: true });
                                    setValue(`resultRules.${index}.smsTemplateId`, '', { shouldDirty: true });
                                    setValue(`resultRules.${index}.whatsappTemplateId`, '', { shouldDirty: true });
                                }
                            }} 
                            className="scale-90 data-[state=checked]:bg-primary"
                        />
                    </div>
                </div>

                {/* Configurations */}
                <div className="space-y-4">
                    {/* Tag Configuration */}
                    {tagEnabled && (
                        <div className="space-y-2 p-4 rounded-xl border bg-card shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                            <Label htmlFor={`tag-input-${index}`} className="text-xs font-bold text-slate-700">Contact Tag to Apply</Label>
                            <Input 
                                id={`tag-input-${index}`}
                                placeholder="e.g. Qualified_Lead" 
                                {...register(`resultRules.${index}.applyTag`)} 
                                className="h-10 rounded-xl bg-background border border-border/50 shadow-sm focus:ring-1 focus:ring-primary/20"
                            />
                            <p className="text-[9px] text-muted-foreground font-medium">Applied to the contact when their score falls in this range.</p>
                        </div>
                    )}

                    {/* Automation Configuration */}
                    {automationEnabled && (
                        <div className="space-y-2 p-4 rounded-xl border bg-card shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                            <Label className="text-xs font-bold text-slate-700">Select Workspace Automation Workflow</Label>
                            <Controller
                                name={`resultRules.${index}.triggerAutomationId`}
                                control={control}
                                render={({ field }) => (
                                    <Select value={field.value || 'none'} onValueChange={field.onChange}>
                                        <SelectTrigger className="h-10 bg-background border border-border/50 rounded-xl">
                                            <SelectValue placeholder="Choose automation workflow..." />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="none">No Automation</SelectItem>
                                            {(automations || []).map((a) => (
                                                <SelectItem key={a.id} value={a.id}>{a.name}{a.status === 'draft' || !a.isActive ? ' (Draft)' : ''}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            <p className="text-[9px] text-muted-foreground font-medium">Executes the chosen workflow automatically on outcome match.</p>
                        </div>
                    )}

                    {/* Messaging Configuration */}
                    {messagingEnabled && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4 rounded-xl border bg-card shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                            {/* Email Automation */}
                            <div className="p-4 rounded-xl border bg-blue-50/30 border-blue-100/70 dark:bg-blue-950/20 dark:border-blue-900/40 space-y-4">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                        <Mail className="h-4 w-4" />
                                        <span className="text-[10px] font-semibold ">Email Completion</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {selectedEmailId && selectedEmailId !== 'none' && (
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-blue-600 dark:text-blue-400 gap-1 rounded-lg hover:bg-blue-100/50 dark:hover:bg-blue-900/30 active:scale-[0.98] transition-transform"
                                                onClick={() => setActiveTemplateConfig({ channel: 'email', templateId: selectedEmailId })}
                                            >
                                                <Pencil className="h-3 w-3" /> Edit
                                            </Button>
                                        )}
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-blue-600 dark:text-blue-400 gap-1 rounded-lg hover:bg-blue-100/50 dark:hover:bg-blue-900/30 active:scale-[0.98] transition-transform"
                                            onClick={() => setActiveTemplateConfig({ channel: 'email' })}
                                        >
                                            <PlusCircle className="h-3 w-3" /> New
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <Controller
                                        name={`resultRules.${index}.emailTemplateId`}
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
                                            name={`resultRules.${index}.emailSenderProfileId`}
                                            control={control}
                                            render={({ field }) => (
                                                <Select value={field.value || 'none'} onValueChange={field.onChange}>
                                                    <SelectTrigger className="h-9 bg-card border-blue-200 dark:border-blue-900/50 text-[10px] font-bold text-blue-700/60 dark:text-blue-400/60 flex items-center gap-2">
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
                            <div className="p-4 rounded-xl border bg-orange-50/30 border-orange-100/70 dark:bg-orange-950/10 dark:border-orange-900/30 space-y-4">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                                        <Smartphone className="h-4 w-4" />
                                        <span className="text-[10px] font-semibold ">SMS Completion</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {selectedSmsId && selectedSmsId !== 'none' && (
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-orange-600 dark:text-orange-400 gap-1 rounded-lg hover:bg-orange-100/50 dark:hover:bg-orange-900/30 active:scale-[0.98] transition-transform"
                                                onClick={() => setActiveTemplateConfig({ channel: 'sms', templateId: selectedSmsId })}
                                            >
                                                <Pencil className="h-3 w-3" /> Edit
                                            </Button>
                                        )}
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-orange-600 dark:text-orange-400 gap-1 rounded-lg hover:bg-orange-100/50 dark:hover:bg-orange-900/30 active:scale-[0.98] transition-transform"
                                            onClick={() => setActiveTemplateConfig({ channel: 'sms' })}
                                        >
                                            <PlusCircle className="h-3 w-3" /> New
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <Controller
                                        name={`resultRules.${index}.smsTemplateId`}
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
                                            name={`resultRules.${index}.smsSenderProfileId`}
                                            control={control}
                                            render={({ field }) => (
                                                <Select value={field.value || 'none'} onValueChange={field.onChange}>
                                                    <SelectTrigger className="h-9 bg-card border-orange-200 dark:border-orange-900/50 text-[10px] font-bold text-orange-700/60 dark:text-orange-400/60 flex items-center gap-2">
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

                            {/* WhatsApp Automation */}
                            <div className="p-4 rounded-xl border bg-emerald-50/30 border-emerald-100/70 dark:bg-emerald-950/10 dark:border-emerald-900/30 space-y-4">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                        <Smartphone className="h-4 w-4" />
                                        <span className="text-[10px] font-semibold ">WhatsApp Completion</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {selectedWhatsappId && selectedWhatsappId !== 'none' && (
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-emerald-600 dark:text-emerald-400 gap-1 rounded-lg hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 active:scale-[0.98] transition-transform"
                                                onClick={() => setActiveTemplateConfig({ channel: 'whatsapp', templateId: selectedWhatsappId })}
                                            >
                                                <Pencil className="h-3 w-3" /> Edit
                                            </Button>
                                        )}
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-6 px-2 text-[9px] font-semibold tracking-tighter text-emerald-600 dark:text-emerald-400 gap-1 rounded-lg hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 active:scale-[0.98] transition-transform"
                                            onClick={() => setActiveTemplateConfig({ channel: 'whatsapp' })}
                                        >
                                            <PlusCircle className="h-3 w-3" /> New
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <Controller
                                        name={`resultRules.${index}.whatsappTemplateId`}
                                        control={control}
                                        render={({ field }) => (
                                            <MessagingTemplateSelector 
                                                category="surveys"
                                                recipientType="respondent"
                                                channel="whatsapp"
                                                value={field.value}
                                                onValueChange={field.onChange}
                                                placeholder="Choose WhatsApp blueprint..."
                                                compact
                                            />
                                        )}
                                    />
                                    {selectedWhatsappId && selectedWhatsappId !== 'none' && (
                                        <Controller
                                            name={`resultRules.${index}.whatsappSenderProfileId`}
                                            control={control}
                                            render={({ field }) => (
                                                <Select value={field.value || 'none'} onValueChange={field.onChange}>
                                                    <SelectTrigger className="h-9 bg-card border-emerald-200 dark:border-emerald-900/50 text-[10px] font-bold text-emerald-700/60 dark:text-emerald-400/60 flex items-center gap-2">
                                                        <ShieldCheck className="h-3 w-3" />
                                                        <SelectValue placeholder="Resolved From Identity" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Auto-Resolve (Default)</SelectItem>
                                                        {whatsappProfiles?.map(p => (
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
                    )}
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
                            setValue(`resultRules.${index}.emailTemplateId`, template.id, { shouldDirty: true });
                        } else if (activeTemplateConfig.channel === 'sms') {
                            setValue(`resultRules.${index}.smsTemplateId`, template.id, { shouldDirty: true });
                        } else {
                            setValue(`resultRules.${index}.whatsappTemplateId`, template.id, { shouldDirty: true });
                        }
                    }}
                />
            )}
        </div>
    );
}

interface SurveyAutomationOption {
    id: string;
    name: string;
    isActive?: boolean;
    status?: 'draft' | 'published' | 'archived';
}

export default function ResultRuleManager() {
    const { control, watch } = useFormContext();
    const params = useParams();
    const firestore = useFirestore();
    const { fields, append, remove, move } = useFieldArray({
        control,
        name: 'resultRules',
    });

    const surveyId = params?.id as string;
    const resultPages = watch('resultPages') || [];
    const sensors = useSensors(useSensor(PointerSensor));
    const { activeOrganization, activeWorkspaceId } = useWorkspace();

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

    const automationsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'automations'),
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('name', 'asc')
        );
    }, [firestore, activeWorkspaceId]);

    const { data: automations } = useCollection<SurveyAutomationOption>(automationsQuery);

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = fields.findIndex(f => f.id === active.id);
            const newIndex = fields.findIndex(f => f.id === over.id);
            move(oldIndex, newIndex);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-semibold tracking-tight text-foreground ">Threshold Architecture</h3>
                    <p className="text-sm text-muted-foreground font-medium">Map score ranges to visual outcomes and automated dispatches.</p>
                </div>
                <Button onClick={() => append({ id: `rule_${Date.now()}`, label: 'New Outcome', minScore: 0, maxScore: 100, priority: fields.length, pageId: '' })} variant="outline" className="h-11 rounded-xl font-bold border-2 border-primary/20 hover:bg-primary/5 transition-all shadow-sm">
                    <Plus className="h-4 w-4 mr-2" /> Add Logic Threshold
                </Button>
            </div>

            {fields.length > 0 ? (
                <div className="space-y-6">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                        <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-6">
                                {fields.map((field, index) => (
                                    <SortableRuleItem 
                                        key={field.id} 
                                        id={field.id} 
                                        index={index} 
                                        pages={resultPages} 
                                        remove={remove} 
                                        profiles={profiles || []}
                                        automations={automations || []}
                                        _surveyId={surveyId}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                    <div className="flex justify-end pt-2">
                        <Button 
                            onClick={() => append({ id: `rule_${Date.now()}`, label: 'New Outcome', minScore: 0, maxScore: 100, priority: fields.length, pageId: '' })} 
                            variant="outline" 
                            className="h-11 rounded-xl font-bold border-2 border-primary/20 hover:bg-primary/5 transition-all shadow-sm"
                        >
                            <Plus className="h-4 w-4 mr-2" /> Add Logic Threshold
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="text-center py-24 border-4 border-dashed rounded-[2.5rem] bg-background border-muted-foreground/10 flex flex-col items-center justify-center gap-4">
                    <div className="p-6 bg-card rounded-full shadow-inner"><ArrowUp className="h-10 w-10 text-muted-foreground/30 animate-bounce" /></div>
                    <div className="space-y-1">
                        <p className="text-muted-foreground font-semibold text-xs">No active logic thresholds</p>
                        <p className="text-[10px] font-medium text-muted-foreground/60 tracking-tighter">All respondents will view the default result page</p>
                    </div>
                </div>
            )}
        </div>
    );
}
