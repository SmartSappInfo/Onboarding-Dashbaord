
'use client';

import * as React from 'react';
import { 
    Zap, 
    Play, 
    Database, 
    Mail, 
    Smartphone, 
    CheckSquare, 
    Building, 
    Clock, 
    ShieldAlert,
    Target,
    Users,
    ArrowRight,
    ArrowRightLeft,
    Timer,
    Info,
    Layout
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { MessageTemplate, SenderProfile, UserProfile, OnboardingStage, VariableDefinition } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface NodeInspectorProps {
    node: any;
    onUpdate: (data: any) => void;
}

const TRIGGER_OPTIONS = [
    { value: 'SCHOOL_CREATED', label: 'Institutional Signup', icon: Building },
    { value: 'SCHOOL_STAGE_CHANGED', label: 'Workflow Progression', icon: Zap },
    { value: 'TASK_COMPLETED', label: 'Protocol Resolution', icon: CheckSquare },
    { value: 'SURVEY_SUBMITTED', label: 'Intelligence Submission', icon: Database },
    { value: 'PDF_SIGNED', label: 'Agreement Execution', icon: Target },
];

const ACTION_TYPES = [
    { value: 'SEND_MESSAGE', label: 'Dispatch Message', icon: Mail },
    { value: 'CREATE_TASK', label: 'Initialize Task', icon: Clock },
    { value: 'UPDATE_SCHOOL', label: 'Mutate School Record', icon: Building },
];

const CONDITION_OPERATORS = [
    { value: 'equals', label: 'Exactly Equals' },
    { value: 'not_equals', label: 'Does Not Equal' },
    { value: 'contains', label: 'Contains Keyword' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
];

/**
 * @fileOverview Phase 6: Logic & Temporal Binding Inspector.
 * Upgraded to support Condition and Delay nodes.
 */
export function NodeInspector({ node, onUpdate }: NodeInspectorProps) {
    const firestore = useFirestore();
    const data = node.data || {};
    const config = data.config || {};

    // Data Loaders
    const templatesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'message_templates'), where('isActive', '==', true)) : null, 
    [firestore]);
    
    const usersQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'users'), where('isAuthorized', '==', true), orderBy('name', 'asc')) : null, 
    [firestore]);

    const stagesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'onboardingStages'), orderBy('order')) : null, 
    [firestore]);

    const varsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'messaging_variables')) : null, 
    [firestore]);

    const { data: templates } = useCollection<MessageTemplate>(templatesQuery);
    const { data: users } = useCollection<UserProfile>(usersQuery);
    const { data: stages } = useCollection<OnboardingStage>(stagesQuery);
    const { data: variables } = useCollection<VariableDefinition>(varsQuery);

    const updateConfig = (updates: any) => {
        onUpdate({ config: { ...config, ...updates } });
    };

    if (node.type === 'triggerNode') {
        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Event Protocol</Label>
                    <div className="grid grid-cols-1 gap-2">
                        {TRIGGER_OPTIONS.map(trigger => (
                            <button
                                key={trigger.value}
                                type="button"
                                onClick={() => onUpdate({ trigger: trigger.value, label: trigger.label })}
                                className={cn(
                                    "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left",
                                    data.trigger === trigger.value ? "border-emerald-500 bg-emerald-50 shadow-md" : "border-transparent bg-muted/20 hover:bg-muted/40"
                                )}
                            >
                                <div className={cn(
                                    "p-2.5 rounded-xl transition-all",
                                    data.trigger === trigger.value ? "bg-emerald-500 text-white" : "bg-white text-muted-foreground shadow-sm"
                                )}>
                                    <trigger.icon className="h-4 w-4" />
                                </div>
                                <span className="font-black text-xs uppercase tracking-tight">{trigger.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (node.type === 'conditionNode') {
        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Target Data Point</Label>
                        <Select value={config.field || ''} onValueChange={(v) => updateConfig({ field: v })}>
                            <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none font-bold">
                                <SelectValue placeholder="Pick variable..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-2xl">
                                {variables?.filter(v => !v.hidden).map(v => (
                                    <SelectItem key={v.id} value={v.key}>{v.label} ({v.key})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Operator</Label>
                        <Select value={config.operator || ''} onValueChange={(v) => updateConfig({ operator: v })}>
                            <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none font-bold">
                                <SelectValue placeholder="Logical rule..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-2xl">
                                {CONDITION_OPERATORS.map(op => (
                                    <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Comparison Value</Label>
                        <Input 
                            value={config.value || ''} 
                            onChange={(e) => updateConfig({ value: e.target.value })}
                            placeholder="Threshold or keyword..."
                            className="h-11 rounded-xl bg-muted/20 border-none font-bold px-4"
                        />
                    </div>
                </div>

                <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex items-start gap-3">
                    <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[9px] font-bold text-amber-800 leading-relaxed uppercase tracking-tighter">
                        Condition nodes evaluate the trigger payload. If the rule matches, the "True" handle path is executed.
                    </p>
                </div>
            </div>
        );
    }

    if (node.type === 'delayNode') {
        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Wait Duration</Label>
                        <div className="flex items-center gap-3">
                            <Input 
                                type="number"
                                value={config.value || 5} 
                                onChange={(e) => updateConfig({ value: parseInt(e.target.value, 10) })}
                                className="h-12 w-24 rounded-xl bg-muted/20 border-none font-black text-center text-lg"
                            />
                            <Select value={config.unit || 'Minutes'} onValueChange={(v) => updateConfig({ unit: v })}>
                                <SelectTrigger className="h-12 flex-1 rounded-xl bg-muted/20 border-none font-black uppercase text-[10px] tracking-widest">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-2xl">
                                    <SelectItem value="Minutes">Minutes</SelectItem>
                                    <SelectItem value="Hours">Hours</SelectItem>
                                    <SelectItem value="Days">Days</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <div className="p-4 rounded-xl bg-purple-50 border border-purple-100 flex items-start gap-3">
                    <Timer className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                    <p className="text-[9px] font-bold text-purple-800 leading-relaxed uppercase tracking-tighter">
                        This node will pause the protocol execution and queue the next steps for the specified time.
                    </p>
                </div>
            </div>
        );
    }

    if (node.type === 'actionNode') {
        return (
            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Execution Logic</Label>
                    <Select 
                        value={data.actionType || ''} 
                        onValueChange={(val) => onUpdate({ actionType: val, label: ACTION_TYPES.find(a => a.value === val)?.label })}
                    >
                        <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none font-bold shadow-inner px-4">
                            <SelectValue placeholder="Select action type..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                            {ACTION_TYPES.map(action => (
                                <SelectItem key={action.value} value={action.value} className="rounded-lg p-3">
                                    <div className="flex items-center gap-3">
                                        <action.icon className="h-4 w-4 text-primary" />
                                        <span className="font-black text-xs uppercase">{action.label}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Separator className="bg-border/50" />

                <div className="space-y-8 pb-10">
                    {data.actionType === 'SEND_MESSAGE' && (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Master Template</Label>
                                <Select value={config.templateId || ''} onValueChange={(v) => updateConfig({ templateId: v })}>
                                    <SelectTrigger className="h-11 rounded-xl bg-white border shadow-sm font-bold">
                                        <SelectValue placeholder="Choose template..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {templates?.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.name} ({t.channel})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Target Recipient Logic</Label>
                                <Select value={config.recipientType || 'manager'} onValueChange={(v) => updateConfig({ recipientType: v })}>
                                    <SelectTrigger className="h-11 rounded-xl bg-white border shadow-sm font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="manager">Assigned Account Manager</SelectItem>
                                        <SelectItem value="signatory">Campus Signatory</SelectItem>
                                        <SelectItem value="respondent">Event Respondent</SelectItem>
                                        <SelectItem value="fixed">Fixed Identity (Manual)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {config.recipientType === 'fixed' && (
                                <Input 
                                    placeholder="e.g. director@school.com" 
                                    value={config.recipient || ''} 
                                    onChange={(e) => updateConfig({ recipient: e.target.value })} 
                                    className="h-11 rounded-xl bg-white font-mono text-xs"
                                />
                            )}
                        </div>
                    )}

                    {data.actionType === 'CREATE_TASK' && (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Task Identification</Label>
                                <Input 
                                    placeholder="e.g. Call school for verification" 
                                    value={config.title || ''} 
                                    onChange={(e) => updateConfig({ title: e.target.value })} 
                                    className="h-11 rounded-xl bg-white font-bold"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Priority</Label>
                                    <Select value={config.priority || 'medium'} onValueChange={(v) => updateConfig({ priority: v })}>
                                        <SelectTrigger className="h-10 rounded-xl bg-white border shadow-sm font-black uppercase text-[10px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="low">Low</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                            <SelectItem value="urgent">Urgent</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Deadline Offset</Label>
                                    <div className="flex items-center gap-2">
                                        <Input 
                                            type="number" 
                                            value={config.dueOffsetDays || 3} 
                                            onChange={(e) => updateConfig({ dueOffsetDays: parseInt(e.target.value, 10) })} 
                                            className="h-10 rounded-xl bg-white text-center font-black"
                                        />
                                        <span className="text-[9px] font-bold uppercase text-muted-foreground opacity-40">Days</span>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Assigned Identity</Label>
                                <Select value={config.assignedTo || 'auto'} onValueChange={(v) => updateConfig({ assignedTo: v })}>
                                    <SelectTrigger className="h-11 rounded-xl bg-white border shadow-sm font-bold">
                                        <SelectValue placeholder="Auto-Resolve from School" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auto">Auto-Resolve (Manager)</SelectItem>
                                        {users?.map(u => (
                                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {data.actionType === 'UPDATE_SCHOOL' && (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Target Lifecycle State</Label>
                                <Select value={config.updates?.lifecycleStatus || ''} onValueChange={(v) => updateConfig({ updates: { ...config.updates, lifecycleStatus: v } })}>
                                    <SelectTrigger className="h-11 rounded-xl bg-white border shadow-sm font-black uppercase text-xs"><SelectValue placeholder="No change" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Onboarding">Onboarding</SelectItem>
                                        <SelectItem value="Active">Active</SelectItem>
                                        <SelectItem value="Churned">Churned</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Workflow Phase Advancement</Label>
                                <Select value={config.updates?.stage?.id || ''} onValueChange={(v) => {
                                    const stage = stages?.find(s => s.id === v);
                                    updateConfig({ updates: { ...config.updates, stage } });
                                }}>
                                    <SelectTrigger className="h-11 rounded-xl bg-white border shadow-sm font-black uppercase text-xs"><SelectValue placeholder="No movement" /></SelectTrigger>
                                    <SelectContent>
                                        {stages?.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return null;
}
