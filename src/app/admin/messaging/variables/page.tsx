
'use client';

import * as React from 'react';
import Link from 'next/link';
import { collection, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { VariableDefinition, MessageTemplate } from '@/lib/types';
import { syncVariableRegistry, upsertConstantVariable, deleteVariable } from '@/lib/messaging-actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    ArrowLeft, 
    RefreshCw, 
    Code, 
    Building, 
    Calendar, 
    ClipboardList, 
    FileText, 
    Search,
    Info,
    CheckCircle2,
    Database,
    Zap,
    Tag,
    ListFilter,
    ShieldAlert,
    BarChart2,
    Link as LinkIcon,
    Loader2,
    Plus,
    X,
    Pencil,
    Trash2,
    Save,
    Globe,
    ChevronDown,
    Layers
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

export default function VariableRegistryPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = React.useState('');
    const [isSyncing, setIsSyncing] = React.useState(false);
    
    // Constant Management State
    const [isAddingConstant, setIsAddingConstant] = React.useState(false);
    const [editingConst, setEditingConst] = React.useState<VariableDefinition | null>(null);
    const [constKey, setConstKey] = React.useState('');
    const [constLabel, setConstLabel] = React.useState('');
    const [constValue, setConstValue] = React.useState('');
    const [isSavingConst, setIsSavingConst] = React.useState(false);

    const varsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'messaging_variables'), orderBy('category', 'asc'));
    }, [firestore]);

    const templatesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'message_templates'));
    }, [firestore]);

    const { data: variables, isLoading: isVarsLoading } = useCollection<VariableDefinition>(varsQuery);
    const { data: templates, isLoading: isTemplatesLoading } = useCollection<MessageTemplate>(templatesQuery);

    const isLoading = isVarsLoading || isTemplatesLoading;

    const usageMap = React.useMemo(() => {
        const map = new Map<string, number>();
        if (!templates) return map;

        templates.forEach(t => {
            const combinedContent = `${t.subject || ''} ${t.body}`;
            const matches = combinedContent.match(/\{\{(.*?)\}\}/g);
            if (matches) {
                matches.forEach(match => {
                    const key = match.replace(/\{\{|\}\}/g, '').trim();
                    map.set(key, (map.get(key) || 0) + 1);
                });
            }
        });
        return map;
    }, [templates]);

    const handleSync = async () => {
        setIsSyncing(true);
        const result = await syncVariableRegistry();
        if (result.success) {
            toast({ title: 'Registry Synchronized', description: 'Available variables updated from all platform modules.' });
        } else {
            toast({ variant: 'destructive', title: 'Sync Failed', description: result.error });
        }
        setIsSyncing(false);
    };

    const handleSaveConstant = async () => {
        if (!constKey || !constLabel || !constValue) return;
        setIsSavingConst(true);
        
        const result = await upsertConstantVariable({
            id: editingConst?.id,
            key: constKey.trim().toLowerCase().replace(/\s+/g, '_'),
            label: constLabel.trim(),
            constantValue: constValue.trim(),
        });

        if (result.success) {
            toast({ title: editingConst ? 'Constant Updated' : 'Constant Created' });
            setIsAddingConstant(false);
            setEditingConst(null);
            setConstKey('');
            setConstLabel('');
            setConstValue('');
        } else {
            toast({ variant: 'destructive', title: 'Failed to save constant' });
        }
        setIsSavingConst(false);
    };

    const handleEditConst = (v: VariableDefinition) => {
        setEditingConst(v);
        setConstKey(v.key);
        setConstLabel(v.label);
        setConstValue(v.constantValue || '');
        setIsAddingConstant(true);
    };

    const handleDeleteConst = async (id: string) => {
        if (!confirm('Are you sure you want to delete this constant? Templates using it will break.')) return;
        const result = await deleteVariable(id);
        if (result.success) toast({ title: 'Variable Removed' });
    };

    const filteredVars = React.useMemo(() => {
        if (!variables) return [];
        const s = searchTerm.toLowerCase();
        return variables.filter(v => 
            v.key.toLowerCase().includes(s) || 
            v.label.toLowerCase().includes(s) ||
            v.sourceName?.toLowerCase().includes(s)
        );
    }, [variables, searchTerm]);

    const VariableCard = ({ v }: { v: VariableDefinition }) => {
        const usageCount = usageMap.get(v.key) || 0;
        const isConstant = v.source === 'constant';
        return (
            <Card className="group border-border/50 hover:shadow-xl transition-all rounded-2xl bg-card overflow-hidden">
                <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase text-primary tracking-widest leading-none">
                                {isConstant ? 'Global Constant' : (v.sourceName || 'Core Schema')}
                            </p>
                            <p className="font-bold text-sm text-foreground line-clamp-1">{v.label}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <Badge variant="secondary" className="text-[8px] h-5 uppercase tracking-tighter bg-muted/50 font-black">{v.type}</Badge>
                            {usageCount > 0 && (
                                <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[8px] h-4 px-1 font-black uppercase tracking-tighter">
                                    Used in {usageCount}
                                </Badge>
                            )}
                        </div>
                    </div>
                    
                    <div className="relative group/copy">
                        <code className="block p-3 bg-muted/30 rounded-xl font-mono text-[11px] text-foreground/80 border border-transparent group-hover/copy:border-primary/20 transition-all select-all">
                            {"{{" + v.key + "}}"}
                        </code>
                        <TooltipProvider>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover/copy:opacity-100 transition-opacity">
                                {isConstant && (
                                    <>
                                        <button onClick={() => handleEditConst(v)} className="p-1.5 rounded-lg bg-white shadow-sm border hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => handleDeleteConst(v.id)} className="p-1.5 rounded-lg bg-white shadow-sm border hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                                    </>
                                )}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button 
                                            onClick={() => {
                                                navigator.clipboard.writeText(`{{${v.key}}}`);
                                                toast({ title: 'Tag Copied' });
                                            }}
                                            className="p-1.5 rounded-lg bg-white shadow-sm border hover:text-primary"
                                        >
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Copy Variable Tag</TooltipContent>
                                </Tooltip>
                            </div>
                        </TooltipProvider>
                    </div>
                    {isConstant && (
                        <div className="p-2 rounded-lg bg-primary/5 border border-primary/10">
                            <p className="text-[9px] font-black text-primary/60 uppercase mb-0.5">Resolved Value</p>
                            <p className="text-xs font-bold truncate">{v.constantValue}</p>
                        </div>
                    )}
                </div>
                <div className="bg-muted/30 px-4 py-2 border-t flex items-center justify-between text-[9px] font-bold uppercase tracking-tighter text-muted-foreground">
                    <span className="truncate max-w-[150px]">{isConstant ? 'Manual Entry' : `Path: ${v.path}`}</span>
                    <span className="opacity-40 shrink-0">{v.source}</span>
                </div>
            </Card>
        );
    };

    const VariableList = ({ category, source }: { category?: VariableDefinition['category'], source?: VariableDefinition['source'] }) => {
        const items = filteredVars.filter(v => 
            (category ? v.category === category : true) && 
            (source ? v.source === source : v.source !== 'constant')
        );
        
        if (items.length === 0) {
            return (
                <div className="py-20 text-center border-2 border-dashed rounded-[2.5rem] bg-muted/10">
                    <Tag className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">No variables found in this context.</p>
                </div>
            );
        }

        // Handle Grouping for Surveys and Forms
        if (category === 'surveys' || category === 'forms') {
            const grouped = items.reduce((acc, v) => {
                const sourceId = v.sourceId || 'default';
                if (!acc[sourceId]) {
                    acc[sourceId] = {
                        name: v.sourceName || 'Unknown Source',
                        vars: []
                    };
                }
                acc[sourceId].vars.push(v);
                return acc;
            }, {} as Record<string, { name: string, vars: VariableDefinition[] }>);

            return (
                <Accordion type="multiple" className="space-y-4">
                    {Object.entries(grouped).map(([sourceId, group]) => (
                        <AccordionItem key={sourceId} value={sourceId} className="border-none">
                            <Card className="border-border/50 overflow-hidden shadow-sm hover:shadow-md transition-shadow rounded-2xl">
                                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/10 transition-colors">
                                    <div className="flex items-center gap-4 text-left">
                                        <div className={cn(
                                            "p-2 rounded-xl shrink-0",
                                            category === 'surveys' ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                                        )}>
                                            {category === 'surveys' ? <ClipboardList className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                                        </div>
                                        <div>
                                            <p className="font-black text-base tracking-tight leading-none mb-1">{group.name}</p>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="h-4 text-[8px] px-1.5 uppercase font-black">{group.vars.length} Variables</Badge>
                                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Source Registry</span>
                                            </div>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-6 pt-2 bg-muted/5 border-t border-dashed">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {group.vars.map(v => <VariableCard key={v.id} v={v} />)}
                                    </div>
                                </AccordionContent>
                            </Card>
                        </AccordionItem>
                    ))}
                </Accordion>
            );
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((v) => <VariableCard key={v.id} v={v} />)}
            </div>
        );
    };

    const healthMetrics = React.useMemo(() => {
        if (!variables || !templates) return { used: 0, unused: 0, broken: 0 };
        const usedKeys = new Set(usageMap.keys());
        const registryKeys = new Set(variables.map(v => v.key));
        let broken = 0;
        templates.forEach(t => {
            const combinedContent = `${t.subject || ''} ${t.body}`;
            const matches = combinedContent.match(/\{\{(.*?)\}\}/g);
            if (matches) {
                if (matches.some(match => !registryKeys.has(match.replace(/\{\{|\}\}/g, '').trim()))) broken++;
            }
        });
        return { used: usedKeys.size, unused: variables.length - usedKeys.size, broken: broken };
    }, [variables, templates, usageMap]);

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <Button asChild variant="ghost" className="-ml-2 mb-2 text-muted-foreground hover:text-foreground font-black uppercase text-[10px] tracking-widest h-8">
                            <Link href="/admin/messaging">
                                <ArrowLeft className="mr-2 h-3 w-3" /> Back to Engine
                            </Link>
                        </Button>
                        <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                            <Database className="h-8 w-8 text-primary" />
                            Variable Registry
                        </h1>
                        <p className="text-muted-foreground font-medium">Manage and audit institutional data points available for messaging.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" onClick={() => setIsAddingConstant(true)} className="rounded-xl font-black h-12 gap-2 shadow-sm border-primary/20 hover:bg-primary/5">
                            <Plus className="h-5 w-5" /> New Constant
                        </Button>
                        <Button 
                            onClick={handleSync} 
                            disabled={isSyncing || isLoading}
                            className="rounded-xl font-black h-12 gap-2 shadow-xl shadow-primary/20 bg-primary px-8 transition-all active:scale-95"
                        >
                            {isSyncing ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
                            Sync Data Hub
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <div className="space-y-6">
                        <Card className="rounded-[2rem] border-none ring-1 ring-border shadow-sm bg-white overflow-hidden">
                            <CardHeader className="bg-primary/5 border-b pb-4">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                    <Zap className="h-3 w-3" /> Operational Audit
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-end border-b pb-3">
                                        <span className="text-[10px] font-black uppercase text-muted-foreground opacity-60">Total Registry</span>
                                        <span className="text-2xl font-black tabular-nums">{variables?.length || 0}</span>
                                    </div>
                                    <div className="flex justify-between items-end border-b pb-3">
                                        <span className="text-[10px] font-black uppercase text-muted-foreground opacity-60">Active Usage</span>
                                        <span className="text-2xl font-black tabular-nums text-emerald-600">{healthMetrics.used}</span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <span className="text-[10px] font-black uppercase text-muted-foreground opacity-60">Broken Contexts</span>
                                        <span className={cn("text-2xl font-black tabular-nums", healthMetrics.broken > 0 ? "text-rose-600 animate-pulse" : "text-slate-300")}>
                                            {healthMetrics.broken}
                                        </span>
                                    </div>
                                </div>
                                
                                {healthMetrics.broken > 0 && (
                                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-start gap-3">
                                        <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                                        <p className="text-[9px] font-bold text-rose-800 leading-relaxed uppercase tracking-tighter">
                                            Warning: {healthMetrics.broken} template(s) contain tags that no longer exist in the registry.
                                        </p>
                                    </div>
                                )}

                                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-3">
                                    <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                    <p className="text-[9px] font-bold text-blue-800 leading-relaxed uppercase tracking-tighter">
                                        Manual constants are preserved during sync. Auto-harvested variables are refreshed based on status.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="space-y-2 px-1">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Search Registry</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                                <Input 
                                    placeholder="Filter by key or label..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 h-11 rounded-xl bg-white border-none shadow-none ring-1 ring-border focus:ring-primary/20 font-bold"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-3">
                        <Tabs defaultValue="general" className="space-y-8">
                            <div className="bg-white p-1 rounded-2xl border shadow-sm ring-1 ring-border w-fit max-w-full overflow-x-auto no-scrollbar">
                                <TabsList className="bg-transparent h-10 gap-1">
                                    <TabsTrigger value="general" className="rounded-xl font-black uppercase text-[9px] tracking-widest px-6 gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                                        <Building className="h-3 w-3" /> Schools
                                    </TabsTrigger>
                                    <TabsTrigger value="meetings" className="rounded-xl font-black uppercase text-[9px] tracking-widest px-6 gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                                        <Calendar className="h-3 w-3" /> Meetings
                                    </TabsTrigger>
                                    <TabsTrigger value="surveys" className="rounded-xl font-black uppercase text-[9px] tracking-widest px-6 gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                                        <ClipboardList className="h-3 w-3" /> Surveys
                                    </TabsTrigger>
                                    <TabsTrigger value="forms" className="rounded-xl font-black uppercase text-[9px] tracking-widest px-6 gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                                        <FileText className="h-3 w-3" /> Doc Signing
                                    </TabsTrigger>
                                    <TabsTrigger value="constants" className="rounded-xl font-black uppercase text-[9px] tracking-widest px-6 gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                                        <Globe className="h-3 w-3" /> Constants
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <TabsContent value="general" className="m-0"><VariableList category="general" /></TabsContent>
                                <TabsContent value="meetings" className="m-0"><VariableList category="meetings" /></TabsContent>
                                <TabsContent value="surveys" className="m-0"><VariableList category="surveys" /></TabsContent>
                                <TabsContent value="forms" className="m-0"><VariableList category="forms" /></TabsContent>
                                <TabsContent value="constants" className="m-0"><VariableList source="constant" /></TabsContent>
                            </div>
                        </Tabs>
                    </div>
                </div>
            </div>

            {/* Constant Editor Dialog */}
            <Dialog open={isAddingConstant} onOpenChange={(o) => { if(!o) { setIsAddingConstant(false); setEditingConst(null); setConstKey(''); setConstLabel(''); setConstValue(''); } }}>
                <DialogContent className="sm:max-w-md rounded-[2rem]">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-primary/10 rounded-xl"><Globe className="h-5 w-5 text-primary" /></div>
                            <DialogTitle className="text-xl font-black uppercase tracking-tight">{editingConst ? 'Update Constant' : 'Create Global Constant'}</DialogTitle>
                        </div>
                        <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Define a permanent schema-less data point.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Variable Key (Tag Name)</Label>
                            <div className="flex h-11 border border-border/50 rounded-xl overflow-hidden bg-muted/20 focus-within:ring-1 focus-within:ring-primary/20 shadow-inner">
                                <div className="bg-muted px-3 flex items-center text-[10px] font-black uppercase text-muted-foreground/60 border-r">{"{{"}</div>
                                <Input 
                                    placeholder="e.g. support_phone" 
                                    value={constKey} 
                                    onChange={e => setConstKey(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                                    className="border-none rounded-none shadow-none focus-visible:ring-0 h-full bg-transparent font-mono font-black" 
                                />
                                <div className="bg-muted px-3 flex items-center text-[10px] font-black uppercase text-muted-foreground/60 border-l">{"}}"}</div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Display Label</Label>
                            <Input value={constLabel} onChange={e => setConstLabel(e.target.value)} placeholder="e.g. Help WhatsApp Line" className="h-11 rounded-xl bg-muted/20 border-none font-bold" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Fixed Value</Label>
                            <Textarea value={constValue} onChange={e => setConstValue(e.target.value)} placeholder="Enter the value to be resolved..." className="min-h-[80px] rounded-xl bg-muted/20 border-none p-4 font-medium" />
                        </div>
                    </div>
                    <DialogFooter className="bg-muted/30 p-4 -mx-6 -mb-6 mt-4">
                        <Button variant="ghost" onClick={() => setIsAddingConstant(false)} className="font-bold">Cancel</Button>
                        <Button onClick={handleSaveConstant} disabled={isSavingConst || !constKey || !constValue} className="rounded-xl font-bold px-8 shadow-lg min-w-[140px]">
                            {isSavingConst ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            {editingConst ? 'Update' : 'Commit Constant'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
