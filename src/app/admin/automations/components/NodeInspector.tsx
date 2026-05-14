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
    PlusCircle,
    Tag,
    X
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { MessageTemplate, UserProfile, OnboardingStage, VariableDefinition, Tag as TagType } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useParams } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessagingTemplateSelector } from '../../components/MessagingTemplateSelector';

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

    // Data Loaders
    const usersQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'users'), where('isAuthorized', '==', true), orderBy('name', 'asc')) : null, 
    [firestore]);

    const stagesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'onboardingStages'), orderBy('order')) : null, 
    [firestore]);

    const varsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'messaging_variables')) : null, 
    [firestore]);

    const tagsQuery = useMemoFirebase(() =>
        firestore ? query(collection(firestore, 'tags'), orderBy('name', 'asc')) : null,
    [firestore]);

    const { data: users } = useCollection<UserProfile>(usersQuery);
    const { data: stages } = useCollection<OnboardingStage>(stagesQuery);
    const { data: variables } = useCollection<VariableDefinition>(varsQuery);
    const { data: allTags } = useCollection<TagType>(tagsQuery);

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

    // Helper to determine template category based on trigger
    const inferredCategory = React.useMemo(() => {
        const trigger = data.trigger;
        if (trigger === 'SURVEY_SUBMITTED') return 'surveys';
        if (trigger === 'SCHOOL_CREATED' || trigger === 'SCHOOL_STAGE_CHANGED') return 'onboarding';
        if (trigger === 'WEBHOOK_RECEIVED') return 'forms'; // Often used for forms
        return 'onboarding'; // Default to onboarding as it's the largest category
    }, [data.trigger]);

    return (
        <div className="flex flex-col h-full text-left min-h-0">
            <ScrollArea className="flex-1 -mx-4 px-4">
                <div className="space-y-10 pb-32 pt-2">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-semibold text-[8px] uppercase h-5">Element Config</Badge>
                            <span className="text-[10px] font-semibold text-muted-foreground opacity-40">ID: {node.id.substring(0, 8)}</span>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Step Label</Label>
                            <Input 
                                value={data.label || ''} 
                                onChange={e => onUpdate({ label: e.target.value })} 
                                placeholder="Give this step a name..."
                                className="h-11 rounded-xl bg-background border-none font-bold shadow-inner"
                            />
                        </div>
                    </div>

                    <Separator className="opacity-50" />

                    {node.type === 'triggerNode' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="space-y-4">
                                <Label className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-2">
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
                                                data.trigger === trigger.value ? "border-emerald-500 bg-emerald-500/10 shadow-md" : "border-transparent bg-background hover:bg-card/50"
                                            )}
                                        >
                                            <div className={cn(
                                                "p-2.5 rounded-xl transition-all shadow-sm shrink-0",
                                                data.trigger === trigger.value ? "bg-emerald-500 text-white" : "bg-card text-muted-foreground"
                                            )}>
                                                <trigger.icon className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-xs tracking-tight leading-none mb-1">{trigger.label}</p>
                                                <p className="text-[9px] font-medium text-muted-foreground leading-relaxed">{trigger.desc}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {data.trigger === 'WEBHOOK_RECEIVED' && (
                                <div className="space-y-6 animate-in slide-in-from-top-2 duration-500 bg-blue-500/5 p-6 rounded-[2rem] border border-blue-500/20 shadow-inner">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between px-1">
                                            <Label className="text-[10px] font-semibold text-blue-500 flex items-center gap-2">
                                                <Globe className="h-3 w-3" /> Ingress Endpoint
                                            </Label>
                                            <Badge className="bg-blue-500 text-white border-none text-[8px] h-4">POST</Badge>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="flex-1 p-3 rounded-xl bg-slate-950/50 border border-white/5 shadow-inner overflow-hidden">
                                                <p className="text-[10px] font-mono text-blue-500 break-all select-all">{webhookUrl}</p>
                                            </div>
                                            <Button size="icon" variant="outline" className="h-10 w-10 shrink-0 rounded-xl bg-card shadow-lg" onClick={copyWebhookUrl}>
                                                {hasCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {(data.trigger === 'TAG_ADDED' || data.trigger === 'TAG_REMOVED') && (
                                <div className="space-y-6 animate-in slide-in-from-top-2 duration-500 bg-emerald-500/5 p-6 rounded-[2rem] border border-emerald-500/20 shadow-inner">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-emerald-600 flex items-center gap-2">
                                                <Tag className="h-3 w-3" /> Filter by Tags
                                            </Label>
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                {(config.tagIds || []).map((id: string) => {
                                                    const tag = allTags?.find((t: TagType) => t.id === id);
                                                    return (
                                                        <Badge key={id} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1 rounded-lg bg-emerald-500/10 text-emerald-600 border-none group">
                                                            <span className="text-[10px] font-bold tracking-tight">{tag?.name || id}</span>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-4 w-4 rounded-md hover:bg-emerald-500/20"
                                                                onClick={() => updateConfig({ tagIds: config.tagIds.filter((t: string) => t !== id) })}
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        </Badge>
                                                    );
                                                })}
                                            </div>
                                            <Select 
                                                value="" 
                                                onValueChange={(v) => {
                                                    const current = config.tagIds || [];
                                                    if (!current.includes(v)) {
                                                        updateConfig({ tagIds: [...current, v] });
                                                    }
                                                }}
                                            >
                                                <SelectTrigger className="h-10 rounded-xl bg-background border-none font-bold shadow-inner px-4">
                                                    <SelectValue placeholder="Add tags to watch..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px] overflow-y-auto">
                                                    {(allTags || []).map((tag: TagType) => (
                                                        <SelectItem key={tag.id} value={tag.id} className="rounded-lg p-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                                                                <span className="font-bold text-xs">{tag.name}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {node.type === 'actionNode' && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="space-y-4">
                                <Label className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-2">
                                    <PlusCircle className="h-3 w-3" /> Execution Logic
                                </Label>
                                <Select 
                                    value={data.actionType || ''} 
                                    onValueChange={(val) => onUpdate({ actionType: val, label: ACTION_TYPES.find(a => a.value === val)?.label })}
                                >
                                    <SelectTrigger className="h-14 rounded-[1.25rem] bg-background border-none shadow-inner font-semibold text-lg px-6">
                                        <SelectValue placeholder="Select action type..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-none shadow-2xl p-2 max-h-[400px] overflow-y-auto">
                                        {ACTION_TYPES.map(action => (
                                            <SelectItem key={action.value} value={action.value} className="rounded-xl p-4 my-1">
                                                <div className="flex items-start gap-4">
                                                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary"><action.icon className="h-5 w-5" /></div>
                                                    <div className="flex flex-col text-left">
                                                        <span className="font-semibold text-xs tracking-tight leading-none mb-1">{action.label}</span>
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
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Master Template</Label>
                                            <MessagingTemplateSelector 
                                                category={inferredCategory as any}
                                                channel="email"
                                                recipientType={config.recipientType || 'manager'}
                                                value={config.templateId}
                                                onValueChange={(v) => updateConfig({ templateId: v })}
                                                placeholder="Choose blueprint..."
                                                className="h-12 rounded-xl bg-card border shadow-sm font-bold px-4 text-xs"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Dynamic Recipient</Label>
                                            <Select value={config.recipientType || 'manager'} onValueChange={(v) => updateConfig({ recipientType: v })}>
                                                <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold px-4">
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
                                                <Label className="text-[10px] font-semibold text-primary ml-1">Static Target (Tag Supported)</Label>
                                                <Input 
                                                    placeholder="e.g. {{contact_email}}" 
                                                    value={config.recipient || ''} 
                                                    onChange={(e) => updateConfig({ recipient: e.target.value })} 
                                                    className="h-12 rounded-xl bg-card border font-mono text-sm px-4 shadow-sm"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {data.actionType === 'CREATE_TASK' && (
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Task Definition</Label>
                                            <Input 
                                                placeholder="e.g. Finalize enrollment for {{school_name}}" 
                                                value={config.title || ''} 
                                                onChange={(e) => updateConfig({ title: e.target.value })} 
                                                className="h-12 rounded-xl bg-card border shadow-sm font-bold"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Priority</Label>
                                                <Select value={config.priority || 'medium'} onValueChange={(v) => updateConfig({ priority: v })}>
                                                    <SelectTrigger className="h-10 rounded-xl bg-card shadow-sm font-semibold text-[10px]"><SelectValue /></SelectTrigger>
                                                    <SelectContent className="rounded-xl border-none shadow-2xl">
                                                        <SelectItem value="low" className="text-[10px] font-semibold ">Low</SelectItem>
                                                        <SelectItem value="medium" className="text-[10px] font-semibold ">Medium</SelectItem>
                                                        <SelectItem value="high" className="text-[10px] font-semibold text-orange-500">High</SelectItem>
                                                        <SelectItem value="urgent" className="text-[10px] font-semibold text-rose-500">Urgent</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">SLA Target</Label>
                                                <div className="flex items-center gap-2">
                                                    <Input 
                                                        type="number" 
                                                        value={config.dueOffsetDays || 3} 
                                                        onChange={(e) => updateConfig({ dueOffsetDays: parseInt(e.target.value, 10) || 0 })} 
                                                        className="h-10 rounded-xl bg-card text-center font-semibold w-16"
                                                    />
                                                    <span className="text-[9px] font-bold opacity-40">Days</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2 text-left">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Assigned Identity</Label>
                                            <Select value={config.assignedTo || 'auto'} onValueChange={(v) => updateConfig({ assignedTo: v })}>
                                                <SelectTrigger className="h-12 rounded-xl bg-card border shadow-sm font-bold">
                                                    <SelectValue placeholder="Auto-Resolve from School" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px] overflow-y-auto">
                                                    <SelectItem value="auto" className="font-semibold italic text-primary rounded-lg py-2.5">Auto-Resolve (Manager)</SelectItem>
                                                    {users?.map(u => (
                                                        <SelectItem key={u.id} value={u.id} className="rounded-lg py-2.5">{u.name}</SelectItem>
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
        </div>
    );
}
