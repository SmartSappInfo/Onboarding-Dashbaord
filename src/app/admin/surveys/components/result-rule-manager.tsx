
'use client';

import * as React from 'react';
import { useFormContext, useFieldArray, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, GripVertical, AlertCircle, Mail, Smartphone, Send, MessageSquareText, PlusCircle } from 'lucide-react';
import type { SurveyResultRule, SurveyResultPage, MessageTemplate, SenderProfile } from '@/lib/types';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import QuickTemplateDialog from '@/app/admin/messaging/components/quick-template-dialog';
import { useParams } from 'next/navigation';

function SortableRuleItem({ id, index, pages, remove, templates, profiles, surveyId }: { id: string, index: number, pages: SurveyResultPage[], remove: (i: number) => void, templates?: MessageTemplate[], profiles?: SenderProfile[], surveyId?: string }) {
    const { register, watch, setValue, control } = useFormContext();
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

    const [quickCreateChannel, setQuickCreateChannel] = React.useState<'email' | 'sms' | null>(null);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const smsTemplates = templates?.filter(t => t.channel === 'sms' && t.isActive);
    const emailTemplates = templates?.filter(t => t.channel === 'email' && t.isActive);
    const smsProfiles = profiles?.filter(p => p.channel === 'sms' && p.isActive);
    const emailProfiles = profiles?.filter(p => p.channel === 'email' && p.isActive);

    return (
        <div ref={setNodeRef} style={style} className="flex flex-col gap-4 p-6 border-2 rounded-2xl bg-card group relative hover:border-primary/30 transition-all shadow-sm">
            <div {...attributes} {...listeners} className="absolute -left-2 top-1/2 -translate-y-1/2 cursor-grab p-2 bg-background border rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            
            <div className="flex items-start justify-between gap-4">
                <div className="flex-grow grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1.5 md:col-span-1">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Logic Label</Label>
                        <Input placeholder="e.g. Qualified" {...register(`resultRules.${index}.label`)} className="h-10 font-bold bg-muted/30 border-none shadow-none focus:ring-1 focus:ring-primary/20" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Range Start</Label>
                        <Input type="number" {...register(`resultRules.${index}.minScore`, { valueAsNumber: true })} className="h-10 font-bold bg-muted/30 border-none shadow-none focus:ring-1 focus:ring-primary/20" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Range End</Label>
                        <Input type="number" {...register(`resultRules.${index}.maxScore`, { valueAsNumber: true })} className="h-10 font-bold bg-muted/30 border-none shadow-none focus:ring-1 focus:ring-primary/20" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Resulting Page</Label>
                        <Controller
                            name={`resultRules.${index}.pageId`}
                            control={control}
                            render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger className="h-10 bg-primary/5 border-primary/20 text-primary font-black">
                                        <SelectValue placeholder="Select page..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {pages.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
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

            <div className="pt-4 border-t border-dashed space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[8px] h-5 uppercase px-2 font-black tracking-widest">Outcome Automations</Badge>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Messages sent to respondent</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Email Automation */}
                    <div className="p-4 rounded-xl border bg-blue-50/30 border-blue-100 space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 text-blue-600">
                                <Mail className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Email Completion</span>
                            </div>
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 px-2 text-[9px] font-black uppercase tracking-tighter text-blue-600 gap-1 rounded-lg"
                                onClick={() => setQuickCreateChannel('email')}
                            >
                                <PlusCircle className="h-3 w-3" /> New Template
                            </Button>
                        </div>
                        <div className="space-y-3">
                            <Controller
                                name={`resultRules.${index}.emailTemplateId`}
                                control={control}
                                render={({ field }) => (
                                    <Select value={field.value || 'none'} onValueChange={field.onChange}>
                                        <SelectTrigger className="h-9 bg-white border-blue-200 text-xs font-bold shadow-sm">
                                            <SelectValue placeholder="Choose email template..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No Email Automation</SelectItem>
                                            {emailTemplates?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            {watch(`resultRules.${index}.emailTemplateId`) && watch(`resultRules.${index}.emailTemplateId`) !== 'none' && (
                                <Controller
                                    name={`resultRules.${index}.emailSenderProfileId`}
                                    control={control}
                                    render={({ field }) => (
                                        <Select value={field.value || 'none'} onValueChange={field.onChange}>
                                            <SelectTrigger className="h-9 bg-white border-blue-200 text-xs font-medium italic">
                                                <SelectValue placeholder="Select sender..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Default Sender</SelectItem>
                                                {emailProfiles?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
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
                                <span className="text-[10px] font-black uppercase tracking-widest">SMS Completion</span>
                            </div>
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 px-2 text-[9px] font-black uppercase tracking-tighter text-orange-600 gap-1 rounded-lg"
                                onClick={() => setQuickCreateChannel('sms')}
                            >
                                <PlusCircle className="h-3 w-3" /> New Template
                            </Button>
                        </div>
                        <div className="space-y-3">
                            <Controller
                                name={`resultRules.${index}.smsTemplateId`}
                                control={control}
                                render={({ field }) => (
                                    <Select value={field.value || 'none'} onValueChange={field.onChange}>
                                        <SelectTrigger className="h-9 bg-white border-orange-200 text-xs font-bold shadow-sm">
                                            <SelectValue placeholder="Choose SMS template..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No SMS Automation</SelectItem>
                                            {smsTemplates?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            {watch(`resultRules.${index}.smsTemplateId`) && watch(`resultRules.${index}.smsTemplateId`) !== 'none' && (
                                <Controller
                                    name={`resultRules.${index}.smsSenderProfileId`}
                                    control={control}
                                    render={({ field }) => (
                                        <Select value={field.value || 'none'} onValueChange={field.onChange}>
                                            <SelectTrigger className="h-9 bg-white border-orange-200 text-xs font-medium italic">
                                                <SelectValue placeholder="Select sender..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Default Sender</SelectItem>
                                                {smsProfiles?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <QuickTemplateDialog 
                open={!!quickCreateChannel}
                onOpenChange={(o) => !o && setQuickCreateChannel(null)}
                channel={quickCreateChannel || 'email'}
                category="surveys"
                fixedSourceId={surveyId}
                onCreated={(id) => {
                    if (quickCreateChannel === 'email') {
                        setValue(`resultRules.${index}.emailTemplateId`, id, { shouldDirty: true });
                    } else {
                        setValue(`resultRules.${index}.smsTemplateId`, id, { shouldDirty: true });
                    }
                }}
            />
        </div>
    );
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

    const templatesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'message_templates'), where('category', '==', 'surveys'));
    }, [firestore]);

    const profilesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'sender_profiles'), where('isActive', '==', true));
    }, [firestore]);

    const { data: templates } = useCollection<MessageTemplate>(templatesQuery);
    const { data: profiles } = useCollection<SenderProfile>(profilesQuery);

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
                    <h3 className="text-xl font-black tracking-tight text-foreground uppercase">Threshold Architecture</h3>
                    <p className="text-sm text-muted-foreground font-medium">Map score ranges to visual outcomes and automated dispatches.</p>
                </div>
                <Button onClick={() => append({ id: `rule_${Date.now()}`, label: 'New Outcome', minScore: 0, maxScore: 100, priority: fields.length, pageId: '' })} variant="outline" className="h-11 rounded-xl font-bold border-2 border-primary/20 hover:bg-primary/5 transition-all shadow-sm">
                    <Plus className="h-4 w-4 mr-2" /> Add Logic Threshold
                </Button>
            </div>

            {fields.length > 0 ? (
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
                                    templates={templates || []}
                                    profiles={profiles || []}
                                    surveyId={surveyId}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            ) : (
                <div className="text-center py-24 border-4 border-dashed rounded-[2.5rem] bg-muted/10 border-muted-foreground/10 flex flex-col items-center justify-center gap-4">
                    <div className="p-6 bg-white rounded-full shadow-inner"><AlertCircle className="h-10 w-10 text-muted-foreground/30" /></div>
                    <div className="space-y-1">
                        <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">No active logic thresholds</p>
                        <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-tighter">All respondents will view the default result page</p>
                    </div>
                </div>
            )}
        </div>
    );
}
