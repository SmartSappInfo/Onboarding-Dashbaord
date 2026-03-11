'use client';

import * as React from 'react';
import Link from 'next/link';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { VariableDefinition, MessageTemplate, Survey, PDFForm } from '@/lib/types';
import { syncVariableRegistry, upsertConstantVariable, deleteVariable, updateVariableVisibility } from '@/lib/messaging-actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    RefreshCw, 
    Building, 
    Calendar, 
    ClipboardList, 
    FileText, 
    Search,
    Info,
    CheckCircle2,
    Zap,
    Tag,
    ShieldAlert,
    Loader2,
    Plus,
    X,
    Pencil,
    Trash2,
    Save,
    Globe,
    ChevronRight,
    EyeOff,
    Lock,
    LayoutList,
    AlertCircle,
    Banknote
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
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function VariableRegistryPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = React.useState('');
    const [isSyncing, setIsSyncing] = React.useState(false);
    
    // Filtering State
    const [selectedSurveyId, setSelectedSurveyId] = React.useState<string | null>('all');
    const [selectedPdfId, setSelectedPdfId] = React.useState<string | null>('all');

    // Constant Management State
    const [isAddingConstant, setIsAddingConstant] = React.useState(false);
    const [editingConst, setEditingConst] = React.useState<VariableDefinition | null>(null);
    const [constKey, setConstKey] = React.useState('');
    const [constLabel, setConstLabel] = React.useState('');
    const [constValue, setConstValue] = React.useState('');
    const [isSavingConst, setIsSavingConst] = React.useState(false);

    // Diagnostic State
    const [isBrokenModalOpen, setIsBrokenModalOpen] = React.useState(false);

    // Data Subscriptions
    const varsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'messaging_variables'), orderBy('category', 'asc'));
    }, [firestore]);

    const templatesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'message_templates'));
    }, [firestore]);

    const surveysQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'surveys'), where('status', '==', 'published'), orderBy('internalName', 'asc'));
    }, [firestore]);

    const pdfsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'pdfs'), where('status', '==', 'published'), orderBy('name', 'asc'));
    }, [firestore]);

    const { data: variables, isLoading: isVarsLoading } = useCollection<VariableDefinition>(varsQuery);
    const { data: templates, isLoading: isTemplatesLoading } = useCollection<MessageTemplate>(templatesQuery);
    const { data: surveys } = useCollection<Survey>(surveysQuery);
    const { data: pdfs } = useCollection<PDFForm>(pdfsQuery);

    const isLoading = isVarsLoading || isTemplatesLoading;

    const usageMap = React.useMemo(() => {
        const map = new Map<string, number>();
        if (!templates) return map;

        templates.forEach(t => {
            const contentForExtraction = `${t.subject || ''} ${t.body} ${JSON.stringify(t.blocks || [])}`;
            const matches = contentForExtraction.match(/\{\{(.*?)\}\}/g);
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

    const handleToggleVisibility = async (id: string, currentHidden: boolean) => {
        const result = await updateVariableVisibility(id, !currentHidden);
        if (result.success) {
            toast({ title: currentHidden ? 'Variable Restored' : 'Variable Hidden' });
        } else {
            toast({ variant: 'destructive', title: 'Visibility Update Failed' });
        }
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
        if (!confirm('Are you sure? Templates using this constant will break.')) return;
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

    const VariableRow = ({ v }: { v: VariableDefinition }) => {
        const usageCount = usageMap.get(v.key) || 0;
        const isConstant = v.source === 'constant';
        const isHidden = !!v.hidden;

        return (
            <TableRow className={cn("group hover:bg-muted/30 transition-colors", isHidden && "opacity-50 grayscale bg-muted/10")}>
                <TableCell className="pl-6 w-[350px]">
                    <div className="flex flex-col gap-0.5 text-left">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">{v.label}</span>
                            {isHidden && <Badge variant="secondary" className="h-4 text-[8px] uppercase px-1">Hidden</Badge>}
                        </div>
                        <code className="text-[10px] font-mono text-primary font-black opacity-60">{"{{" + v.key + "}}"}</code>
                    </div>
                </TableCell>
                <TableCell className="text-left">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{isConstant ? 'Global' : (v.sourceName || 'Registry')}</span>
                        <span className="text-[9px] text-muted-foreground/60 uppercase font-bold truncate max-w-[150px]">{isConstant ? 'Fixed Value' : `Path: ${v.path}`}</span>
                    </div>
                </TableCell>
                <TableCell className="text-center">
                    <Badge variant="outline" className="text-[9px] font-black uppercase h-5 bg-muted/20 border-border/50">{v.type}</Badge>
                </TableCell>
                <TableCell className="text-center">
                    {usageCount > 0 ? (
                        <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[9px] h-5 px-2 font-black uppercase">
                            Used in {usageCount}
                        </Badge>
                    ) : (
                        <span className="text-[10px] font-bold text-muted-foreground/30">—</span>
                    )}
                </TableCell>
                <TableCell className="text-right pr-6">
                    <div className="flex items-center justify-end gap-2">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-2 mr-2">
                                        <Switch 
                                            checked={!isHidden} 
                                            onCheckedChange={() => handleToggleVisibility(v.id, isHidden)}
                                            className="scale-75"
                                        />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>Visibility Toggle</TooltipContent>
                            </Tooltip>

                            {isConstant && (
                                <>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleEditConst(v)}><Pencil className="h-3.5 w-3.5" /></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => handleDeleteConst(v.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                </>
                            )}

                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-lg hover:text-primary"
                                onClick={() => {
                                    navigator.clipboard.writeText(`{{${v.key}}}`);
                                    toast({ title: 'Tag Copied' });
                                }}
                            >
                                <CheckCircle2 className="h-4 w-4" />
                            </Button>
                        </TooltipProvider>
                    </div>
                </TableCell>
            </TableRow>
        );
    };

    const VariableListView = ({ category, sourceId }: { category: VariableDefinition['category'], sourceId?: string | null }) => {
        const items = filteredVars.filter(v => {
            if (v.category !== category) return false;
            if (category === 'general' || category === 'meetings' || category === 'finance') return true; 
            
            if (sourceId && sourceId !== 'all') {
                return v.sourceId === sourceId || v.source === 'static'; 
            }
            return true;
        });
        
        if (items.length === 0) {
            return (
                <div className="py-24 text-center border-4 border-dashed rounded-[3rem] bg-muted/10 border-muted-foreground/10 flex flex-col items-center justify-center gap-4">
                    <div className="p-6 bg-white rounded-[2rem] shadow-inner">
                        <Tag className="h-12 w-12 text-muted-foreground/20" />
                    </div>
                    <p className="text-muted-foreground font-black uppercase tracking-widest text-xs opacity-40">No variable data in this context.</p>
                </div>
            );
        }

        return (
            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden ring-1 ring-border/50">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead className="pl-6 text-[10px] font-black uppercase tracking-widest py-4">Data Label & Technical Key</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Origin Hub</TableHead>
                            <TableHead className="text-center text-[10px] font-black uppercase tracking-widest py-4">Schema Type</TableHead>
                            <TableHead className="text-center text-[10px] font-black uppercase tracking-widest py-4">Studio Usage</TableHead>
                            <TableHead className="text-right pr-6 text-[10px] font-black uppercase tracking-widest py-4">Global Visibility</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((v) => <VariableRow key={v.id} v={v} />)}
                    </TableBody>
                </Table>
            </div>
        );
    };

    const healthMetrics = React.useMemo(() => {
        if (!variables || !templates) return { used: 0, unused: 0, broken: 0, brokenItems: [] };
        const usedKeys = new Set(usageMap.keys());
        const registryKeys = new Set(variables.map(v => v.key));
        
        const brokenItems: { key: string, templates: { id: string, name: string }[] }[] = [];
        const brokenMap = new Map<string, { id: string, name: string }[]>();

        templates.forEach(t => {
            const contentForExtraction = `${t.subject || ''} ${t.body} ${JSON.stringify(t.blocks || [])}`;
            const matches = contentForExtraction.match(/\{\{(.*?)\}\}/g);
            if (matches) {
                matches.forEach(match => {
                    const key = match.replace(/\{\{|\}\}/g, '').trim();
                    if (!registryKeys.has(key)) {
                        if (!brokenMap.has(key)) brokenMap.set(key, []);
                        const existing = brokenMap.get(key)!;
                        if (!existing.find(item => item.id === t.id)) {
                            existing.push({ id: t.id, name: t.name });
                        }
                    }
                });
            }
        });

        brokenMap.forEach((tmpls, key) => {
            brokenItems.push({ key, templates: tmpls });
        });

        return { 
            used: usedKeys.size, 
            unused: variables.length - usedKeys.size, 
            broken: brokenItems.length,
            brokenItems
        };
    }, [variables, templates, usageMap]);

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-end gap-4">
                    <div className="flex items-center gap-3">
                        <Button variant="outline" onClick={() => setIsAddingConstant(true)} className="rounded-xl font-black h-12 gap-2 shadow-sm border-primary/20 hover:bg-primary/5">
                            <Plus className="h-5 w-5" /> New Constant
                        </Button>
                        <Button 
                            onClick={handleSync} 
                            disabled={isSyncing || isLoading}
                            className="rounded-xl font-black h-12 gap-2 shadow-xl shadow-primary/20 bg-primary px-8 transition-all active:scale-95 text-white"
                        >
                            {isSyncing ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
                            Sync Data Hub
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <div className="space-y-6">
                        <Card className="rounded-[2.5rem] border-none ring-1 ring-border shadow-sm bg-white overflow-hidden">
                            <CardHeader className="bg-primary/5 border-b pb-4">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                    <Zap className="h-3 w-3" /> Operational Audit
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-end border-b pb-3 text-left">
                                        <span className="text-[10px] font-black uppercase text-muted-foreground opacity-60">Total Registry</span>
                                        <span className="text-2xl font-black tabular-nums">{variables?.length || 0}</span>
                                    </div>
                                    <div className="flex justify-between items-end border-b pb-3 text-left">
                                        <span className="text-[10px] font-black uppercase text-muted-foreground opacity-60">Active Usage</span>
                                        <span className="text-2xl font-black tabular-nums text-emerald-600">{healthMetrics.used}</span>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => healthMetrics.broken > 0 && setIsBrokenModalOpen(true)}
                                        className={cn(
                                            "w-full flex justify-between items-end transition-all rounded-lg p-1 -m-1",
                                            healthMetrics.broken > 0 ? "hover:bg-rose-50" : "cursor-default"
                                        )}
                                    >
                                        <span className="text-[10px] font-black uppercase text-muted-foreground opacity-60">Broken Contexts</span>
                                        <span className={cn("text-2xl font-black tabular-nums flex items-center gap-1", healthMetrics.broken > 0 ? "text-rose-600 animate-pulse" : "text-slate-300")}>
                                            {healthMetrics.broken}
                                            {healthMetrics.broken > 0 && <ChevronRight className="h-4 w-4" />}
                                        </span>
                                    </button>
                                </div>
                                
                                {healthMetrics.broken > 0 && (
                                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-start gap-3 shadow-sm text-left">
                                        <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-rose-900 uppercase tracking-tighter">Integrity Failure Detected</p>
                                            <p className="text-[9px] font-bold text-rose-800/70 leading-relaxed uppercase tracking-tighter text-left">
                                                {healthMetrics.broken} tag(s) exist in templates but are missing from your registry.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-3 shadow-sm text-left">
                                    <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                    <p className="text-[9px] font-bold text-blue-800 leading-relaxed uppercase tracking-tighter text-left">
                                        Hiding a variable removes it from design sidebars but preserves its logic in existing templates.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="space-y-2 px-1 text-left">
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
                                    <TabsTrigger value="finance" className="rounded-xl font-black uppercase text-[9px] tracking-widest px-6 gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                                        <Banknote className="h-3 w-3" /> Finance Hub
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
                                <TabsContent value="general" className="m-0"><VariableListView category="general" /></TabsContent>
                                <TabsContent value="finance" className="m-0"><VariableListView category="finance" /></TabsContent>
                                <TabsContent value="meetings" className="m-0"><VariableListView category="meetings" /></TabsContent>
                                
                                <TabsContent value="surveys" className="m-0 space-y-6">
                                    <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border shadow-sm">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0 ml-1">Source Record Filter:</Label>
                                        <Select value={selectedSurveyId || 'all'} onValueChange={setSelectedSurveyId}>
                                            <SelectTrigger className="h-10 w-[300px] rounded-xl bg-muted/20 border-none font-bold">
                                                <SelectValue placeholder="All Surveys" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="all">All Survey Blueprints</SelectItem>
                                                {surveys?.map(s => <SelectItem key={s.id} value={s.id}>{s.internalName || s.title}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <VariableListView category="surveys" sourceId={selectedSurveyId} />
                                </TabsContent>

                                <TabsContent value="forms" className="m-0 space-y-6">
                                    <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border shadow-sm">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0 ml-1">Source Record Filter:</Label>
                                        <Select value={selectedPdfId || 'all'} onValueChange={setSelectedPdfId}>
                                            <SelectTrigger className="h-10 w-[300px] rounded-xl bg-muted/20 border-none font-bold">
                                                <SelectValue placeholder="All Documents" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="all">All Form Templates</SelectItem>
                                                {pdfs?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <VariableListView category="forms" sourceId={selectedPdfId} />
                                </TabsContent>

                                <TabsContent value="constants" className="m-0">
                                    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden ring-1 ring-border/50">
                                        <Table>
                                            <TableHeader className="bg-muted/30">
                                                <TableRow>
                                                    <TableHead className="pl-6 text-[10px] font-black uppercase tracking-widest py-4">Manual Label & Technical Key</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Global Value</TableHead>
                                                    <TableHead className="text-center text-[10px] font-black uppercase tracking-widest py-4">Studio Usage</TableHead>
                                                    <TableHead className="text-right pr-6 text-[10px] font-black uppercase tracking-widest py-4">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredVars.filter(v => v.source === 'constant').map((v) => (
                                                    <VariableRow key={v.id} v={v} />
                                                ))}
                                                {filteredVars.filter(v => v.source === 'constant').length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="h-48 text-center">
                                                            <div className="flex flex-col items-center justify-center gap-2 opacity-30">
                                                                <Globe className="h-10 w-10" />
                                                                <p className="text-[10px] font-black uppercase tracking-widest">No Constants Defined</p>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </TabsContent>
                            </div>
                        </Tabs>
                    </div>
                </div>
            </div>

            {/* Broken Context Audit Dialog */}
            <Dialog open={isBrokenModalOpen} onOpenChange={setIsBrokenModalOpen}>
                <DialogContent className="sm:max-w-2xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
                    <DialogHeader className="p-8 bg-rose-50 border-b border-rose-100 shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-xl shadow-rose-200">
                                <ShieldAlert className="h-6 w-6" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black uppercase tracking-tight text-rose-900">Broken Registry Audit</DialogTitle>
                                <DialogDescription className="text-xs font-bold uppercase tracking-widest text-rose-700 opacity-70">Detecting technical tags missing from data hub</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-hidden flex flex-col bg-white">
                        <ScrollArea className="h-[400px]">
                            <div className="p-6">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 pl-6">Technical Tag</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Impact Scope</TableHead>
                                            <TableHead className="text-right pr-6 text-[10px] font-black uppercase tracking-widest py-4">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {healthMetrics.brokenItems.map((item) => (
                                            <TableRow key={item.key} className="group hover:bg-rose-50/30 transition-colors">
                                                <TableCell className="pl-6 py-4">
                                                    <code className="text-xs font-mono font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100">
                                                        {"{{" + item.key + "}}"}
                                                    </code>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1 text-left">
                                                        <span className="text-[10px] font-black uppercase text-muted-foreground">Used in {item.templates.length} templates:</span>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {item.templates.map(t => (
                                                                <Badge key={t.id} variant="outline" className="text-[8px] h-4 font-bold bg-white">{t.name}</Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <Button variant="ghost" size="sm" className="h-8 rounded-xl font-bold gap-2 text-[10px] uppercase hover:bg-primary/10 hover:text-primary transition-all" asChild>
                                                        <Link href="/admin/messaging/templates">
                                                            Fix in Studio <ChevronRight className="h-3 w-3" />
                                                        </Link>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </ScrollArea>
                    </div>

                    <DialogFooter className="p-6 bg-muted/30 border-t shrink-0">
                        <Button onClick={() => setIsBrokenModalOpen(false)} className="w-full h-12 rounded-xl font-black uppercase tracking-widest shadow-lg">Acknowledge Audit</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Constant Editor Dialog */}
            <Dialog open={isAddingConstant} onOpenChange={(o) => { if(!o) { setIsAddingConstant(false); setEditingConst(null); setConstKey(''); setConstLabel(''); setConstValue(''); } }}>
                <DialogContent className="sm:max-w-md rounded-[2rem]">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-primary/10 rounded-xl"><Globe className="h-5 w-5 text-primary" /></div>
                            <DialogTitle className="text-xl font-black uppercase tracking-tight">{editingConst ? 'Update Constant' : 'Create Global Constant'}</DialogTitle>
                        </div>
                        <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-left">Define a permanent schema-less data point.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4 text-left">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Variable Key (Tag Name)</Label>
                            <div className="flex h-11 border border-border/50 rounded-xl overflow-hidden bg-muted/20 focus-within:ring-1 focus-within:ring-primary/20 shadow-inner">
                                <div className="bg-muted px-3 flex items-center text-[10px] font-black uppercase text-muted-foreground/60 border-r">{"{{"}</div>
                                <Input 
                                    placeholder="e.g. support_phone" 
                                    value={constKey} 
                                    onChange={e => setConstKey(e.target.value.replace(/\s+/g, '_'))}
                                    className="border-none rounded-none shadow-none focus-visible:ring-0 h-full bg-transparent font-mono font-black" 
                                />
                                <div className="bg-muted px-3 flex items-center text-[10px] font-black uppercase text-muted-foreground/60 border-l">{"}}"}</div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Display Label</Label>
                            <Input value={constLabel} onChange={e => setConstLabel(e.target.value)} placeholder="e.g. Help WhatsApp Line" className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" />
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
