
'use client';

import * as React from 'react';
import Link from 'next/link';
import { collection, query, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { VariableDefinition } from '@/lib/types';
import { syncVariableRegistry } from '@/lib/messaging-actions';
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
    ListFilter
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function VariableRegistryPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = React.useState('');
    const [isSyncing, setIsSyncing] = React.useState(false);

    const varsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'messaging_variables'), orderBy('category', 'asc'));
    }, [firestore]);

    const { data: variables, isLoading } = useCollection<VariableDefinition>(varsQuery);

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

    const filteredVars = React.useMemo(() => {
        if (!variables) return [];
        const s = searchTerm.toLowerCase();
        return variables.filter(v => 
            v.key.toLowerCase().includes(s) || 
            v.label.toLowerCase().includes(s) ||
            v.sourceName?.toLowerCase().includes(s)
        );
    }, [variables, searchTerm]);

    const VariableList = ({ category }: { category: VariableDefinition['category'] }) => {
        const items = filteredVars.filter(v => v.category === category);
        
        if (items.length === 0) {
            return (
                <div className="py-20 text-center border-2 border-dashed rounded-[2rem] bg-muted/10">
                    <Tag className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">No variables found in this context.</p>
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((v) => (
                    <Card key={v.id} className="group border-border/50 hover:shadow-lg transition-all rounded-2xl bg-card overflow-hidden">
                        <div className="p-4 space-y-3">
                            <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase text-primary tracking-widest leading-none">{v.sourceName || 'Core Schema'}</p>
                                    <p className="font-bold text-sm text-foreground line-clamp-1">{v.label}</p>
                                </div>
                                <Badge variant="secondary" className="text-[8px] h-5 uppercase tracking-tighter bg-muted/50 font-black">{v.type}</Badge>
                            </div>
                            
                            <div className="relative group/copy">
                                <code className="block p-3 bg-muted/30 rounded-xl font-mono text-[11px] text-foreground/80 border border-transparent group-hover/copy:border-primary/20 transition-all select-all">
                                    {"{{" + v.key + "}}"}
                                </code>
                                <button 
                                    onClick={() => {
                                        navigator.clipboard.writeText(`{{${v.key}}}`);
                                        toast({ title: 'Tag Copied', description: `{{${v.key}}} ready to paste.` });
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white shadow-sm border opacity-0 group-hover/copy:opacity-100 transition-opacity hover:text-primary"
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                        <div className="bg-muted/30 px-4 py-2 border-t flex items-center justify-between text-[9px] font-bold uppercase tracking-tighter text-muted-foreground">
                            <span>Path: {v.path}</span>
                            <span className="opacity-40">{v.source}</span>
                        </div>
                    </Card>
                ))}
            </div>
        );
    };

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
                        <p className="text-muted-foreground font-medium">Map platform entities to dynamic message placeholders.</p>
                    </div>
                    <Button 
                        onClick={handleSync} 
                        disabled={isSyncing || isLoading}
                        className="rounded-xl font-black h-12 gap-2 shadow-xl shadow-primary/20 bg-primary px-8"
                    >
                        {isSyncing ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
                        Sync Schema Hub
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Insights Sidebar */}
                    <div className="space-y-6">
                        <Card className="rounded-[2rem] border-none ring-1 ring-border shadow-sm bg-white overflow-hidden">
                            <CardHeader className="bg-primary/5 border-b pb-4">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                    <Zap className="h-3 w-3" /> Registry Audit
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-end border-b pb-3">
                                        <span className="text-[10px] font-black uppercase text-muted-foreground opacity-60">Total Tags</span>
                                        <span className="text-2xl font-black tabular-nums">{variables?.length || 0}</span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <span className="text-[10px] font-black uppercase text-muted-foreground opacity-60">Sources Active</span>
                                        <span className="text-2xl font-black tabular-nums">4</span>
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-3">
                                    <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                    <p className="text-[9px] font-bold text-blue-800 leading-relaxed uppercase tracking-tighter">
                                        Dynamic variables are harvested from published surveys and PDF forms. Re-sync whenever you publish a new template.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="space-y-2">
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

                    {/* Main Registry Explorer */}
                    <div className="lg:col-span-3">
                        <Tabs defaultValue="general" className="space-y-8">
                            <div className="bg-white p-1 rounded-2xl border shadow-sm ring-1 ring-border w-fit max-w-full overflow-x-auto no-scrollbar">
                                <TabsList className="bg-transparent h-10 gap-1">
                                    <TabsTrigger value="general" className="rounded-xl font-black uppercase text-[9px] tracking-widest px-6 gap-2">
                                        <Building className="h-3 w-3" /> Schools
                                    </TabsTrigger>
                                    <TabsTrigger value="meetings" className="rounded-xl font-black uppercase text-[9px] tracking-widest px-6 gap-2">
                                        <Calendar className="h-3 w-3" /> Meetings
                                    </TabsTrigger>
                                    <TabsTrigger value="surveys" className="rounded-xl font-black uppercase text-[9px] tracking-widest px-6 gap-2">
                                        <ClipboardList className="h-3 w-3" /> Surveys
                                    </TabsTrigger>
                                    <TabsTrigger value="forms" className="rounded-xl font-black uppercase text-[9px] tracking-widest px-6 gap-2">
                                        <FileText className="h-3 w-3" /> Doc Signing
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            {isLoading ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <Skeleton key={i} className="h-32 w-full rounded-2xl" />
                                    ))}
                                </div>
                            ) : (
                                <>
                                    <TabsContent value="general" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        <VariableList category="general" />
                                    </TabsContent>
                                    <TabsContent value="meetings" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        <VariableList category="meetings" />
                                    </TabsContent>
                                    <TabsContent value="surveys" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        <VariableList category="surveys" />
                                    </TabsContent>
                                    <TabsContent value="forms" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        <VariableList category="forms" />
                                    </TabsContent>
                                </>
                            )}
                        </Tabs>
                    </div>
                </div>
            </div>
        </div>
    );
}
