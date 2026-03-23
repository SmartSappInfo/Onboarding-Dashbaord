'use client';

import * as React from 'react';
import { 
    Zap, 
    Play, 
    Database, 
    Mail, 
    CheckSquare, 
    Building, 
    Clock, 
    Target, 
    ArrowRightLeft, 
    Timer, 
    Info, 
    Globe, 
    Copy, 
    Check, 
    Smartphone, 
    Layout, 
    Search, 
    BadgeAlert, 
    FlaskConical,
    PlusCircle
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { MessageTemplate, UserProfile, OnboardingStage, VariableDefinition } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useParams } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface NodeInspectorProps {
    node: any;
    onUpdate: (data: any) => void;
}

const TRIGGER_OPTIONS = [
    { value: 'SCHOOL_CREATED', label: 'Institutional Signup', icon: Building, desc: 'Fires when a new school joins the hub.' },
    { value: 'SCHOOL_STAGE_CHANGED', label: 'Workflow Progression', icon: Zap, desc: 'Fires when a hub moves across the Kanban board.' },
    { value: 'TASK_COMPLETED', label: 'Protocol Resolution', icon: CheckSquare, desc: 'Fires when an admin finishes a CRM task.' },
    { value: 'SURVEY_SUBMITTED', label: 'Intelligence Submission', icon: Database, desc: 'Fires upon survey form completion.' },
    { value: 'PDF_SIGNED', label: 'Agreement Execution', icon: Target, desc: 'Fires when a legal PDF is fully signed.' },
    { value: 'MEETING_CREATED', label: 'Session Initialization', icon: Play, desc: 'Fires when a new meeting is scheduled.' },
    { value: 'WEBHOOK_RECEIVED', label: 'External Ingress', icon: Globe, desc: 'Fires when data is POSTed to the hub endpoint.' },
];

const ACTION_TYPES = [
    { value: 'SEND_MESSAGE', label: 'Dispatch Message', icon: Mail, desc: 'Send an automated Email or SMS.' },
    { value: 'CREATE_TASK', label: 'Initialize Task', icon: Clock, desc: 'Add a new mission to the CRM registry.' },
    { value: 'UPDATE_SCHOOL', label: 'Mutate School Record', icon: Building, desc: 'Automatically advance stages or status.' },
];

const CONDITION_OPERATORS = [
    { value: 'equals', label: 'Exactly Equals' },
    { value: 'not_equals', label: 'Does Not Equal' },
    { value: 'contains', label: 'Contains Keyword' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
];

export function NodeInspector({ node, onUpdate }: NodeInspectorProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const params = useParams();
    const automationId = params.id as string;
    const data = node.data || {};
    const config = data.config || {};

    const [hasCopied, setHasCopied] = React.useState(false);
    const [searchVar, setSearchVar] = React.useState('');

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

    const filteredVars = React.useMemo(() => {
        if (!variables) return [];
        return variables.filter(v => 
            !v.hidden && 
            (v.key.toLowerCase().includes(searchVar.toLowerCase()) || v.label.toLowerCase().includes(searchVar.toLowerCase()))
        );
    }, [variables, searchVar]);

    const updateConfig = (updates: any) => {
        onUpdate({ config: { ...config, ...updates } });
    };

    const webhookUrl = React.useMemo(() => {
        if (typeof window === 'undefined' || !automationId) return '';
        const base = window.location.origin;
        return `${base}/api/automations/webhook/${automationId}`;
    }, [automationId]);

    const copyWebhookUrl = () => {
        navigator.clipboard.writeText(webhookUrl);
        setHasCopied(true);
        toast({ title: 'Webhook Endpoint Copied' });
        setTimeout(() => setHasCopied(false), 2000);
    };

    const handleCopyTag = (key: string) => {
        navigator.clipboard.writeText(`{{${key}}}`);
        toast({ title: 'Tag Copied', description: `Injected {{${key}}} to clipboard.` });
    };

    return (
        <div className="flex flex-col h-full text-left min-h-0">
            {/* ScrollArea wraps the main configuration sections */}
            <ScrollArea className="flex-1 -mx-4 px-4">
                <div className="space-y-10 pb-32 pt-2">
                    {/* Node Header Context */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black text-[8px] uppercase h-5">Element Config</Badge>
                            <span className="text-[10px] font-black uppercase text-muted-foreground opacity-40">ID: {node.id.substring(0, 8)}</span>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Step Label</Label>
                            <Input 
                                value={data.label || ''} 
                                onChange={e => onUpdate({ label: e.target.value })} 
                                placeholder="Give this step a name..."
                                className="h-11 rounded-xl bg-muted/20 border-none font-bold shadow-inner"
                            />
                        </div>
                    </div>

                    <Separator className="opacity-50" />

                    {/* DYNAMIC NODE TYPE VIEWS */}
                    {node.type === 'triggerNode' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1 flex items-center gap-2">
                                    <Zap className="h-3 w-3" /> Event Protocol Entry
                                </Label>
                                <div className="grid grid-cols-1 gap-2.5">
                                    {TRIGGER_OPTIONS.map(trigger => (
                                        <button
                                            key={trigger.value}
                                            type="button"
                                            onClick={() => onUpdate({ trigger: trigger.value, label: trigger.label })}
                                            className={cn(
                                                "flex items-start gap-4 p-4 rounded-2xl border-2 transition-all text-left group",
                                                data.trigger === trigger.value ? "border-emerald-500 bg-emerald-50 shadow-md" : "border-transparent bg-muted/20 hover:bg-muted/40"
                                            )}
                                        >
                                            <div className={cn(
                                                "p-2.5 rounded-xl transition-all shadow-sm shrink-0",
                                                data.trigger === trigger.value ? "bg-emerald-500 text-white" : "bg-white text-muted-foreground"
                                            )}>
                                                <trigger.icon className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black text-xs uppercase tracking-tight leading-none mb-1">{trigger.label}</p>
                                                <p className="text-[9px] font-medium text-muted-foreground leading-relaxed">{trigger.desc}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {data.trigger === 'WEBHOOK_RECEIVED' && (
                                <div className="space-y-6 animate-in slide-in-from-top-2 duration-500 bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100 shadow-inner">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between px-1">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-2">
                                                <Globe className="h-3 w-3" /> Ingress Endpoint
                                            </Label>
                                            <Badge className="bg-blue-600 text-white border-none text-[8px] h-4">POST</Badge>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="flex-1 p-3 rounded-xl bg-slate-900 border border-white/10 shadow-inner overflow-hidden">
                                                <p className="text-[10px] font-mono text-blue-400 break-all select-all">{webhookUrl}</p>
                                            </div>
                                            <Button size="icon" variant="outline" className="h-10 w-10 shrink-0 rounded-xl bg-white shadow-lg" onClick={copyWebhookUrl}>
                                                {hasCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                        <p className="text-[9px] font-bold text-blue-800 leading-relaxed uppercase tracking-tighter">
                                            JSON keys from the POST body are automatically available as dynamic tags (e.g. &#123;&#123;key_name&#125;&#125;).
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {node.type === 'conditionNode' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1 flex items-center gap-2">
                                        <Database className="h-3 w-3" /> Targeted Data Point
                                    </Label>
                                    <Select value={config.field || ''} onValueChange={(v) => updateConfig({ field: v })}>
                                        <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none font-bold shadow-inner px-4">
                                            <SelectValue placeholder="Pick variable to evaluate..." />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px] overflow-y-auto">
                                            {variables?.filter(v => !v.hidden).map(v => (
                                                <SelectItem key={v.id} value={v.key} className="rounded-lg p-3">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-xs uppercase">{v.label}</span>
                                                        <span className="text-[9px] text-muted-foreground italic tracking-tighter">Tag: &#123;&#123;{v.key}&#125;&#125;</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1 flex items-center gap-2">
                                        <ArrowRightLeft className="h-3 w-3" /> Logical Operator
                                    </Label>
                                    <Select value={config.operator || ''} onValueChange={(v) => updateConfig({ operator: v })}>
                                        <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-bold px-4">
                                            <SelectValue placeholder="Select logic rule..." />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-none shadow-2xl">
                                            {/* Operators list is short, standard max-h applies */}
                                            {CONDITION_OPERATORS.map(op => (
                                                <SelectItem key={op.value} value={op.value} className="font-bold">{op.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Evaluation Value</Label>
                                    <Input 
                                        value={config.value || ''} 
                                        onChange={(e) => updateConfig({ value: e.target.value })}
                                        placeholder="Expected string or number..."
                                        className="h-12 rounded-xl bg-muted/20 border-none font-bold px-4 shadow-inner"
                                    />
                                </div>
                            </div>

                            <div className="p-5 rounded-[2rem] bg-amber-50 border border-amber-100 flex items-start gap-4 shadow-inner">
                                <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-[9px] font-bold text-amber-800 leading-relaxed uppercase tracking-tighter">
                                    If the rule matches, execution follows the **True** (Emerald) path. Otherwise, it follows the **False** (Rose) path.
                                </p>
                            </div>
                        </div>
                    )}

                    {node.type === 'delayNode' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 text-left">
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1 flex items-center gap-2">
                                        <Timer className="h-3 w-3" /> Wait Duration
                                    </Label>
                                    <div className="flex items-center gap-3">
                                        <Input 
                                            type="number"
                                            value={config.value || 5} 
                                            onChange={(e) => updateConfig({ value: parseInt(e.target.value, 10) })}
                                            className="h-14 w-24 rounded-2xl bg-muted/20 border-none font-black text-center text-3xl shadow-inner"
                                        />
                                        <Select value={config.unit || 'Minutes'} onValueChange={(v) => updateConfig({ unit: v })}>
                                            <SelectTrigger className="h-14 flex-1 rounded-2xl bg-muted/20 border-none font-black uppercase text-xs tracking-widest shadow-inner px-6">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-2xl border-none shadow-2xl">
                                                <SelectItem value="Minutes" className="font-black uppercase text-[10px]">Minutes</SelectItem>
                                                <SelectItem value="Hours" className="font-black uppercase text-[10px]">Hours</SelectItem>
                                                <SelectItem value="Days" className="font-black uppercase text-[10px]">Days</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 rounded-[2rem] bg-purple-50 border border-purple-100 flex items-start gap-4 shadow-inner">
                                <Clock className="h-6 w-6 text-purple-600 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-xs font-black text-purple-900 uppercase">Background Queuing</p>
                                    <p className="text-[9px] font-bold text-purple-800 leading-relaxed uppercase tracking-tighter">
                                        This protocol will pause and resume automatically. Ensure your **Logic Heartbeat** is pulsing in the dashboard.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {node.type === 'actionNode' && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1 flex items-center gap-2">
                                    <PlusCircle className="h-3 w-3" /> Execution Logic
                                </Label>
                                <Select 
                                    value={data.actionType || ''} 
                                    onValueChange={(val) => onUpdate({ actionType: val, label: ACTION_TYPES.find(a => a.value === val)?.label })}
                                >
                                    <SelectTrigger className="h-14 rounded-[1.25rem] bg-muted/20 border-none shadow-inner font-black text-lg px-6">
                                        <SelectValue placeholder="Select action type..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-none shadow-2xl p-2 max-h-[400px] overflow-y-auto">
                                        {ACTION_TYPES.map(action => (
                                            <SelectItem key={action.value} value={action.value} className="rounded-xl p-4 my-1">
                                                <div className="flex items-start gap-4">
                                                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary"><action.icon className="h-5 w-5" /></div>
                                                    <div className="flex flex-col text-left">
                                                        <span className="font-black text-xs uppercase tracking-tight leading-none mb-1">{action.label}</span>
                                                        <span className="text-[9px] font-medium text-muted-foreground leading-relaxed">{action.desc}</span>
                                                    </div>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <Separator className="opacity-50" />

                            <div className="space-y-10">
                                {data.actionType === 'SEND_MESSAGE' && (
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Master Template</Label>
                                            <Select value={config.templateId || ''} onValueChange={(v) => updateConfig({ templateId: v })}>
                                                <SelectTrigger className="h-12 rounded-xl bg-white border shadow-sm font-bold px-4">
                                                    <SelectValue placeholder="Choose blueprint..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl p-2 max-h-[300px] overflow-y-auto">
                                                    {templates?.map(t => (
                                                        <SelectItem key={t.id} value={t.id} className="rounded-lg py-2.5">
                                                            <div className="flex items-center gap-3">
                                                                {t.channel === 'email' ? <Mail className="h-3.5 w-3.5 text-blue-500" /> : <Smartphone className="h-3.5 w-3.5 text-orange-500" />}
                                                                <span className="font-bold text-xs uppercase">{t.name}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Dynamic Recipient</Label>
                                            <Select value={config.recipientType || 'manager'} onValueChange={(v) => updateConfig({ recipientType: v })}>
                                                <SelectTrigger className="h-12 rounded-xl bg-white border shadow-sm font-bold px-4">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="manager">Assigned Account Manager</SelectItem>
                                                    <SelectItem value="signatory">Campus Signatory</SelectItem>
                                                    <SelectItem value="respondent">Event Respondent</SelectItem>
                                                    <SelectItem value="fixed">Manual Identity Entry</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {config.recipientType === 'fixed' && (
                                            <div className="space-y-2 animate-in zoom-in-95 duration-300">
                                                <Label className="text-[10px] font-black uppercase text-primary ml-1">Static Target (Tag Supported)</Label>
                                                <Input 
                                                    placeholder="e.g. {{contact_email}}" 
                                                    value={config.recipient || ''} 
                                                    onChange={(e) => updateConfig({ recipient: e.target.value })} 
                                                    className="h-12 rounded-xl bg-muted/20 border-none font-mono text-sm px-4 shadow-inner"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {data.actionType === 'CREATE_TASK' && (
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Task Definition</Label>
                                            <Input 
                                                placeholder="e.g. Finalize enrollment for {{school_name}}" 
                                                value={config.title || ''} 
                                                onChange={(e) => updateConfig({ title: e.target.value })} 
                                                className="h-12 rounded-xl bg-white border shadow-sm font-bold"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Priority</Label>
                                                <Select value={config.priority || 'medium'} onValueChange={(v) => updateConfig({ priority: v })}>
                                                    <SelectTrigger className="h-10 rounded-xl bg-white shadow-sm font-black uppercase text-[10px]"><SelectValue /></SelectTrigger>
                                                    <SelectContent className="rounded-xl border-none shadow-2xl">
                                                        <SelectItem value="low" className="text-[10px] font-black uppercase">Low</SelectItem>
                                                        <SelectItem value="medium" className="text-[10px] font-black uppercase">Medium</SelectItem>
                                                        <SelectItem value="high" className="text-[10px] font-black uppercase text-orange-600">High</SelectItem>
                                                        <SelectItem value="urgent" className="text-[10px] font-black uppercase text-rose-600">Urgent</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">SLA Target</Label>
                                                <div className="flex items-center gap-2">
                                                    <Input 
                                                        type="number" 
                                                        value={config.dueOffsetDays || 3} 
                                                        onChange={(e) => updateConfig({ dueOffsetDays: parseInt(e.target.value, 10) || 0 })} 
                                                        className="h-10 rounded-xl bg-white text-center font-black w-16"
                                                    />
                                                    <span className="text-[9px] font-bold uppercase opacity-40">Days</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2 text-left">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Assigned Identity</Label>
                                            <Select value={config.assignedTo || 'auto'} onValueChange={(v) => updateConfig({ assignedTo: v })}>
                                                <SelectTrigger className="h-12 rounded-xl bg-white border shadow-sm font-bold">
                                                    <SelectValue placeholder="Auto-Resolve from School" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px] overflow-y-auto">
                                                    <SelectItem value="auto" className="font-black italic text-primary rounded-lg py-2.5">Auto-Resolve (Manager)</SelectItem>
                                                    {users?.map(u => (
                                                        <SelectItem key={u.id} value={u.id} className="rounded-lg py-2.5">{u.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}

                                {data.actionType === 'UPDATE_SCHOOL' && (
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Lifecycle State Mutation</Label>
                                            <Select value={config.updates?.lifecycleStatus || ''} onValueChange={(v) => updateConfig({ updates: { ...config.updates, lifecycleStatus: v } })}>
                                                <SelectTrigger className="h-12 rounded-xl bg-white border shadow-sm font-black uppercase text-xs"><SelectValue placeholder="No change" /></SelectTrigger>
                                                <SelectContent className="rounded-xl border-none shadow-2xl">
                                                    <SelectItem value="Onboarding" className="font-black">Onboarding</SelectItem>
                                                    <SelectItem value="Active" className="font-black text-emerald-600">Active</SelectItem>
                                                    <SelectItem value="Churned" className="font-black text-rose-600">Churned</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Workflow Phase Advancement</Label>
                                            <Select value={config.updates?.stage?.id || ''} onValueChange={(v) => {
                                                const stage = stages?.find(s => s.id === v);
                                                updateConfig({ updates: { ...config.updates, stage: { id: stage?.id, name: stage?.name, order: stage?.order, color: stage?.color } } });
                                            }}>
                                                <SelectTrigger className="h-12 rounded-xl bg-white border shadow-sm font-black uppercase text-xs"><SelectValue placeholder="No movement" /></SelectTrigger>
                                                <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px] overflow-y-auto">
                                                    {stages?.map(s => (
                                                        <SelectItem key={s.id} value={s.id} className="rounded-lg py-2.5">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                                                <span className="font-black text-xs uppercase">{s.name}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Variable Glossary Drawer - Pinned to bottom but doesn't overlap scroll content */}
            <div className="mt-auto border-t bg-muted/30 p-6 -mx-6 -mb-6 shrink-0 text-left">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                            <Database className="h-3 w-3" /> Variable Dictionary
                        </Label>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Badge variant="outline" className="bg-white border-primary/20 text-primary text-[8px] font-black h-5 uppercase px-2">{filteredVars.length} Tags</Badge>
                                </TooltipTrigger>
                                <TooltipContent>Available dynamic placeholders for this context.</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    
                    <div className="relative group mb-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground opacity-40 group-focus-within:text-primary transition-all" />
                        <Input 
                            value={searchVar} 
                            onChange={e => setSearchVar(e.target.value)} 
                            placeholder="Filter registry..." 
                            className="h-9 pl-9 rounded-xl bg-white border-primary/10 font-bold text-[10px] shadow-sm" 
                        />
                    </div>

                    <ScrollArea className="h-40 -mx-2 px-2">
                        <div className="grid grid-cols-1 gap-2 pr-2 pb-4">
                            {filteredVars.map(v => (
                                <button 
                                    key={v.id} 
                                    onClick={() => handleCopyTag(v.key)}
                                    className="flex items-center justify-between p-2 rounded-xl bg-white border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all text-left shadow-xs group/tag"
                                >
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-black uppercase text-foreground leading-none truncate">{v.label}</p>
                                        <code className="text-[8px] font-mono text-primary/60 mt-1 block">{"{{" + v.key + "}}"}</code>
                                    </div>
                                    <div className="shrink-0 opacity-0 group-hover/tag:opacity-100 transition-opacity">
                                        <Copy className="h-3 w-3 text-primary" />
                                    </div>
                                </button>
                            ))}
                            {filteredVars.length === 0 && (
                                <p className="text-[9px] font-bold text-muted-foreground text-center py-8 opacity-40 italic">No matching tags.</p>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </div>
    );
}
