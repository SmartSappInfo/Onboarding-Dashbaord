'use client';

import * as React from 'react';
import { useFormContext, Controller, useFieldArray } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Zap, Users, ShieldCheck, Database, Tags, Bell, ArrowRight, Table as TableIcon, Plus, Trash2, ListTree } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';
import { MultiSelect } from '@/components/ui/multi-select';
import { type SurveyQuestion, type SurveyElement, type MessageTemplate } from '@/lib/types';
import { Mail, Smartphone } from 'lucide-react';

export default function SubmissionBehaviorStep() {
    const { control, watch, setValue } = useFormContext();
    const firestore = useFirestore();
    const { activeWorkspaceId } = useWorkspace();

    const elements = watch('elements') || [];
    const questions: SurveyQuestion[] = elements.filter((el: SurveyElement): el is SurveyQuestion => 'isRequired' in el);

    const { fields, append, remove } = useFieldArray({
        control,
        name: "entityMapping.additionalMappings"
    });

    const TARGET_FIELDS = [
        { label: 'Nominal Roll (Institution)', value: 'institutionData.nominalRoll' },
        { label: 'Website (Institution)', value: 'institutionData.website' },
        { label: 'Slogan (Institution)', value: 'institutionData.slogan' },
        { label: 'Initials (Institution)', value: 'institutionData.initials' },
        { label: 'Billing Address (Institution)', value: 'institutionData.billingAddress' },
        { label: 'Company (Person)', value: 'personData.company' },
        { label: 'Job Title (Person)', value: 'personData.jobTitle' },
        { label: 'Lead Source (Person)', value: 'personData.leadSource' },
    ];

    const createEntity = watch('createEntity');
    const assignmentEnabled = watch('assignmentEnabled');

    // Fetch data for selections
    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('isAuthorized', '==', true), orderBy('name', 'asc'));
    }, [firestore]);
    const { data: users } = useCollection<any>(usersQuery);

    const tagsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(collection(firestore, 'tags'), where('workspaceId', '==', activeWorkspaceId), orderBy('name', 'asc'));
    }, [firestore, activeWorkspaceId]);
    const { data: tags } = useCollection<any>(tagsQuery);

    const automationsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(collection(firestore, 'automations'), where('workspaceId', '==', activeWorkspaceId), where('status', '==', 'active'), orderBy('name', 'asc'));
    }, [firestore, activeWorkspaceId]);
    const { data: automations } = useCollection<any>(automationsQuery);

    const templatesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'message_templates'), where('isActive', '==', true));
    }, [firestore]);
    const { data: templates } = useCollection<MessageTemplate>(templatesQuery);

    const emailTemplates = templates?.filter(t => t.channel === 'email');
    const smsTemplates = templates?.filter(t => t.channel === 'sms');

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500 text-left pb-12">
            {/* Entity Mapping Card */}
            <Card className="shadow-sm border-none ring-1 ring-border rounded-2xl overflow-hidden">
                <CardHeader className="bg-muted/30 border-b pb-6 px-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-xl">
                                <Database className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                                <CardTitle className="text-sm font-semibold tracking-tight">Lead Generation & Entity Mapping</CardTitle>
                                <CardDescription className="text-[10px] font-bold text-muted-foreground/60">Automatically create CRM records from submissions.</CardDescription>
                            </div>
                        </div>
                        <Controller
                            name="createEntity"
                            control={control}
                            render={({ field }) => (
                                <div className="flex items-center gap-2 bg-emerald-500/5 px-3 py-1.5 rounded-xl border border-emerald-500/10">
                                    <span className={cn("text-[10px] font-black uppercase tracking-tight", field.value ? "text-emerald-600" : "text-muted-foreground/40")}>
                                        {field.value ? 'Active' : 'Disabled'}
                                    </span>
                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                </div>
                            )}
                        />
                    </div>
                </CardHeader>
                <CardContent className={cn("p-6 space-y-6 transition-all duration-500", !createEntity && "opacity-40 grayscale pointer-events-none select-none overflow-hidden h-[80px]")}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Mapping Fields */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[9px] font-bold uppercase">Identity Mapping</Badge>
                                <div className="h-px flex-1 bg-border/50" />
                            </div>

                            <Controller
                                name="entityMapping.entityNameFieldId"
                                control={control}
                                render={({ field }) => (
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Entity Name Question</Label>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none font-bold">
                                                <SelectValue placeholder="Select question for Entity Name..." />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                {questions.map(q => (
                                                    <SelectItem key={q.id} value={q.id} className="font-medium">{q.title}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[9px] font-bold text-muted-foreground/60 italic ml-1 leading-tight">Usually "Business Name" or "Organization".</p>
                                    </div>
                                )}
                            />

                            <Controller
                                name="entityMapping.contactNameFieldId"
                                control={control}
                                render={({ field }) => (
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Primary Contact Name</Label>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none font-bold">
                                                <SelectValue placeholder="Select question for Contact Name..." />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                {questions.map(q => (
                                                    <SelectItem key={q.id} value={q.id} className="font-medium">{q.title}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            />
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[9px] font-bold uppercase">Contact Info Mapping</Badge>
                                <div className="h-px flex-1 bg-border/50" />
                            </div>

                            <Controller
                                name="entityMapping.contactEmailFieldId"
                                control={control}
                                render={({ field }) => (
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Primary Email</Label>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none font-bold">
                                                <SelectValue placeholder="Select question for Email..." />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                {questions.filter(q => q.type === 'email' || q.type === 'text').map(q => (
                                                    <SelectItem key={q.id} value={q.id} className="font-medium">{q.title}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            />

                            <Controller
                                name="entityMapping.contactPhoneFieldId"
                                control={control}
                                render={({ field }) => (
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Primary Phone</Label>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none font-bold">
                                                <SelectValue placeholder="Select question for Phone..." />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                {questions.filter(q => q.type === 'phone' || q.type === 'text').map(q => (
                                                    <SelectItem key={q.id} value={q.id} className="font-medium">{q.title}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            />
                        </div>
                    </div>

                    {/* Advanced Property Mapping */}
                    <div className="space-y-4 pt-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-purple-500/5 text-purple-600 border-purple-500/20 text-[9px] font-bold uppercase">Advanced Property Mapping</Badge>
                                <div className="h-px w-24 bg-border/50" />
                            </div>
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                className="h-7 text-[9px] font-black uppercase tracking-tight rounded-lg border-purple-500/20 text-purple-600 hover:bg-purple-50"
                                onClick={() => append({ questionId: '', targetField: '' })}
                            >
                                <Plus className="h-3 w-3 mr-1.5" />
                                Add Mapping
                            </Button>
                        </div>

                        {fields.length > 0 ? (
                            <div className="space-y-3">
                                {fields.map((field, index) => (
                                    <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-card/40 p-3 rounded-xl border border-border/50 shadow-sm animate-in zoom-in-95 duration-200">
                                        <div className="md:col-span-5 space-y-1.5">
                                            <Label className="text-[9px] font-bold text-muted-foreground ml-1">Survey Question</Label>
                                            <Controller
                                                name={`entityMapping.additionalMappings.${index}.questionId` as const}
                                                control={control}
                                                render={({ field: qField }) => (
                                                    <Select onValueChange={qField.onChange} value={qField.value}>
                                                        <SelectTrigger className="h-9 rounded-lg bg-background border-none shadow-sm text-xs font-semibold">
                                                            <SelectValue placeholder="Select question..." />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl">
                                                            {questions.map(q => (
                                                                <SelectItem key={q.id} value={q.id} className="text-xs">{q.title}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            />
                                        </div>
                                        <div className="md:col-span-2 flex justify-center pb-2.5">
                                            <ArrowRight className="h-4 w-4 text-muted-foreground/30" />
                                        </div>
                                        <div className="md:col-span-4 space-y-1.5">
                                            <Label className="text-[9px] font-bold text-muted-foreground ml-1">CRM Property</Label>
                                            <Controller
                                                name={`entityMapping.additionalMappings.${index}.targetField` as const}
                                                control={control}
                                                render={({ field: tField }) => (
                                                    <Select onValueChange={tField.onChange} value={tField.value}>
                                                        <SelectTrigger className="h-9 rounded-lg bg-background border-none shadow-sm text-xs font-semibold">
                                                            <SelectValue placeholder="Select target..." />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl">
                                                            {TARGET_FIELDS.map(target => (
                                                                <SelectItem key={target.value} value={target.value} className="text-xs font-bold">{target.label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            />
                                        </div>
                                        <div className="md:col-span-1 flex justify-end pb-1">
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/5"
                                                onClick={() => remove(index)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-8 bg-muted/20 border border-dashed rounded-2xl opacity-40">
                                <ListTree className="h-8 w-8 mb-2 text-muted-foreground" />
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">No Custom Mappings Defined</p>
                                <p className="text-[9px] font-medium text-muted-foreground/60 italic">Map additional questions to specific CRM properties.</p>
                            </div>
                        )}
                    </div>

                    <div className="pt-4 flex items-start gap-4 p-4 bg-muted/30 rounded-2xl border border-dashed text-left">
                        <div className="p-2 bg-amber-500/10 rounded-lg shrink-0">
                            <ShieldCheck className="h-4 w-4 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-tight text-amber-600 mb-0.5">Workspace Enforcement</p>
                            <p className="text-[10px] font-bold text-muted-foreground/70 leading-relaxed italic">
                                Entities will be automatically created within the active workspace using the established scope. 
                                <span className="text-amber-700 ml-1">The system will prevent duplicates by matching Entity Name & Email.</span>
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* User Attribution Card */}
            <Card className="shadow-sm border-none ring-1 ring-border rounded-2xl overflow-hidden">
                <CardHeader className="bg-muted/30 border-b pb-6 px-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-xl">
                                <Users className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <CardTitle className="text-sm font-semibold tracking-tight">Assignment & Attribution</CardTitle>
                                <CardDescription className="text-[10px] font-bold text-muted-foreground/60">Track which representative shared the survey.</CardDescription>
                            </div>
                        </div>
                        <Controller
                            name="assignmentEnabled"
                            control={control}
                            render={({ field }) => (
                                <div className="flex items-center gap-2 bg-blue-500/5 px-3 py-1.5 rounded-xl border border-blue-500/10">
                                    <span className={cn("text-[10px] font-black uppercase tracking-tight", field.value ? "text-blue-600" : "text-muted-foreground/40")}>
                                        {field.value ? 'Enabled' : 'Disabled'}
                                    </span>
                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                </div>
                            )}
                        />
                    </div>
                </CardHeader>
                <CardContent className={cn("p-6 space-y-6 transition-all duration-500", !assignmentEnabled && "opacity-40 grayscale pointer-events-none select-none overflow-hidden h-[80px]")}>
                    <div className="space-y-6">
                        <Controller
                            name="assignedUsers"
                            control={control}
                            render={({ field }) => (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Allowed Representatives</Label>
                                    <MultiSelect
                                        options={users?.map(u => ({ label: u.name || u.email, value: u.id })) || []}
                                        onChange={field.onChange}
                                        value={field.value || []}
                                        placeholder="Select users who can be assigned..."
                                        className="rounded-xl border-none bg-muted/20 min-h-11 shadow-none"
                                    />
                                    <p className="text-[9px] font-bold text-muted-foreground/60 italic ml-1">These users will appear in the attribution dropdown on the Share page.</p>
                                </div>
                            )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <Controller
                                    name="notifyAssignedUsers.email"
                                    control={control}
                                    render={({ field }) => (
                                        <div className="flex items-center justify-between p-4 bg-muted/20 rounded-xl border border-transparent hover:border-blue-500/20 transition-all">
                                            <div className="flex items-center gap-3">
                                                <Mail className="h-4 w-4 text-blue-500" />
                                                <span className="text-[11px] font-bold">Email Notifications</span>
                                            </div>
                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        </div>
                                    )}
                                />
                                {watch('notifyAssignedUsers.email') && (
                                    <Controller
                                        name="notifyAssignedUsers.emailTemplateId"
                                        control={control}
                                        render={({ field }) => (
                                            <div className="space-y-2 px-1">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Team Alert Template (Email)</Label>
                                                <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                                    <SelectTrigger className="h-10 rounded-xl bg-card border-none shadow-sm font-bold">
                                                        <SelectValue placeholder="Select template..." />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        <SelectItem value="none">Choose template...</SelectItem>
                                                        {emailTemplates?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                    />
                                )}
                            </div>

                            <div className="space-y-4">
                                <Controller
                                    name="notifyAssignedUsers.sms"
                                    control={control}
                                    render={({ field }) => (
                                        <div className="flex items-center justify-between p-4 bg-muted/20 rounded-xl border border-transparent hover:border-blue-500/20 transition-all">
                                            <div className="flex items-center gap-3">
                                                <Smartphone className="h-4 w-4 text-blue-500" />
                                                <span className="text-[11px] font-bold">SMS Notifications</span>
                                            </div>
                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        </div>
                                    )}
                                />
                                {watch('notifyAssignedUsers.sms') && (
                                    <Controller
                                        name="notifyAssignedUsers.smsTemplateId"
                                        control={control}
                                        render={({ field }) => (
                                            <div className="space-y-2 px-1">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Team Alert Template (SMS)</Label>
                                                <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                                    <SelectTrigger className="h-10 rounded-xl bg-card border-none shadow-sm font-bold">
                                                        <SelectValue placeholder="Select template..." />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        <SelectItem value="none">Choose template...</SelectItem>
                                                        {smsTemplates?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Automation Card */}
            <Card className="shadow-sm border-none ring-1 ring-border rounded-2xl overflow-hidden">
                <CardHeader className="bg-muted/30 border-b pb-6 px-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-xl">
                            <Zap className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-semibold tracking-tight">Auto-Pilot Triggers</CardTitle>
                            <CardDescription className="text-[10px] font-bold text-muted-foreground/60">Trigger workflows immediately upon submission.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <Controller
                            name="autoTags"
                            control={control}
                            render={({ field }) => (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1 flex items-center gap-1.5">
                                        <Tags className="h-3 w-3" /> Apply Tags
                                    </Label>
                                    <MultiSelect
                                        options={tags?.map(t => ({ label: t.name, value: t.name })) || []}
                                        onValueChange={field.onChange}
                                        defaultValue={field.value || []}
                                        placeholder="Add tags to new entities..."
                                        className="rounded-xl border-none bg-muted/20 min-h-11 shadow-none"
                                    />
                                </div>
                            )}
                        />

                        <Controller
                            name="autoAutomations"
                            control={control}
                            render={({ field }) => (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1 flex items-center gap-1.5">
                                        <Zap className="h-3 w-3" /> Trigger Automations
                                    </Label>
                                    <MultiSelect
                                        options={automations?.map(a => ({ label: a.name, value: a.id })) || []}
                                        onValueChange={field.onChange}
                                        defaultValue={field.value || []}
                                        placeholder="Start workflows..."
                                        className="rounded-xl border-none bg-muted/20 min-h-11 shadow-none"
                                    />
                                </div>
                            )}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
