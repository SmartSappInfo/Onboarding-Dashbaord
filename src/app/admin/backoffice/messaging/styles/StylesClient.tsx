'use client';

import * as React from 'react';
import { collection, query, orderBy, addDoc, doc, deleteDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { MessageStyle, MessageTemplate } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
    Palette, 
    Plus, 
    Trash2, 
    Code,
    Eye,
    X,
    Loader2,
    Sparkles,
    Check,
    Pencil,
    Save,
    Layout,
    ShieldAlert,
    ShieldCheck,
    ChevronDown,
    Building,
    Globe,
    Filter,
    BarChart3,
    FileText,
    Search,
    Layers,
    AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PageContainerFluid } from '@/components/ui/page-container';
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateVisualStyle } from '@/ai/flows/generate-visual-style-flow';
import { MediaSelect } from '../../../entities/components/media-select';
import { RainbowButton } from '@/components/ui/rainbow-button';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── Filter Type ─────────────────────────────────────────────────────────────
type ScopeFilter = 'all' | 'global' | 'organization';

export default function StylesClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    const router = useRouter();
    
    // Deletion prevention state
    const [styleInUseToDelete, setStyleInUseToDelete] = React.useState<MessageStyle | null>(null);
    
    // ─── UI State ────────────────────────────────────────────────────────────
    const [isAdding, setIsAdding] = React.useState(false);
    const [isAiGenerating, setIsAiGenerating] = React.useState(false);
    const [previewStyle, setPreviewStyle] = React.useState<MessageStyle | null>(null);
    const [scopeFilter, setScopeFilter] = React.useState<ScopeFilter>('all');
    const [searchQuery, setSearchQuery] = React.useState('');
    
    // Edit State
    const [editingStyle, setEditingStyle] = React.useState<MessageStyle | null>(null);
    const [editName, setEditName] = React.useState('');
    const [editHtml, setEditHtml] = React.useState('');
    const [isUpdating, setIsUpdating] = React.useState(false);

    // Manual Create State
    const [name, setName] = React.useState('');
    const [htmlWrapper, setHtmlWrapper] = React.useState('<html>\n  <body style="font-family: sans-serif; padding: 20px; background: #f8fafc;">\n    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">\n      <div style="padding: 24px; border-bottom: 1px solid #e2e8f0;">\n        <img src="{{org_logo_url}}" alt="{{org_name}}" style="height: 40px; width: auto;" />\n      </div>\n      <div style="padding: 32px;">\n        {{content}}\n      </div>\n      <div style="padding: 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8;">\n        <p style="margin: 0;">© {{current_year}} {{org_name}}</p>\n        <p style="margin: 4px 0 0;">{{org_address}}</p>\n      </div>\n    </div>\n  </body>\n</html>');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // AI Generation State
    const [aiName, setAiName] = React.useState('');
    const [aiPrompt, setAiPrompt] = React.useState('');
    const [aiInspirationUrl, setAiInspirationUrl] = React.useState('');
    const [isAiProcessing, setIsAiProcessing] = React.useState(false);
    const [generatedHtml, setGeneratedHtml] = React.useState<string | null>(null);

    // ─── QUERY 1: All Styles (Global + Organization) ─────────────────────────
    // Fetches every document from message_styles, ordered by name.
    // The backoffice needs a platform-wide view of all styles.
    const allStylesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'message_styles'), 
            orderBy('name', 'asc')
        );
    }, [firestore]);

    const { data: allStyles, isLoading: isLoadingAll } = useCollection<MessageStyle>(allStylesQuery);

    // ─── Derived Global / Org Styles ─────────────────────────────────────────
    // System blueprints are styled wrapper templates that do not target a specific workspace
    // or have scope='global'. Org overrides target specific organizations/workspaces.
    const globalStyles = React.useMemo(() => {
        if (!allStyles) return [];
        return allStyles.filter(s => 
            s.scope === 'global' || 
            !s.organizationId || 
            s.organizationId === '' || 
            !s.workspaceIds || 
            s.workspaceIds.length === 0
        );
    }, [allStyles]);

    const orgStyles = React.useMemo(() => {
        if (!allStyles) return [];
        return allStyles.filter(s => 
            s.scope === 'organization' || 
            (s.organizationId && s.organizationId !== '') || 
            (s.workspaceIds && s.workspaceIds.length > 0)
        );
    }, [allStyles]);

    // ─── QUERY 4: Template References (Usage Tracking) ───────────────────────
    // Fetches all templates that reference a styleId, so we can display
    // usage counts for each style (how many templates use this style).
    const templatesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'message_templates'),
            orderBy('createdAt', 'desc')
        );
    }, [firestore]);

    const { data: allTemplates } = useCollection<MessageTemplate>(templatesQuery);

    // ─── Derived Data ────────────────────────────────────────────────────────

    // Build a map of styleId -> number of templates referencing it
    const styleUsageMap = React.useMemo(() => {
        const map = new Map<string, number>();
        if (!allTemplates) return map;
        for (const tmpl of allTemplates) {
            const sid = tmpl.styleId;
            if (sid) {
                map.set(sid, (map.get(sid) || 0) + 1);
            }
        }
        return map;
    }, [allTemplates]);

    const styleInUseTemplates = React.useMemo(() => {
        if (!styleInUseToDelete || !allTemplates) return [];
        return allTemplates.filter(t => t.styleId === styleInUseToDelete.id);
    }, [styleInUseToDelete, allTemplates]);

    // Build a map of organizationId -> count of styles for stats
    const orgStyleCountMap = React.useMemo(() => {
        const map = new Map<string, number>();
        if (!orgStyles) return map;
        for (const style of orgStyles) {
            const oid = style.organizationId || 'unknown';
            map.set(oid, (map.get(oid) || 0) + 1);
        }
        return map;
    }, [orgStyles]);

    // Stats for KPI cards
    const stats = React.useMemo(() => ({
        totalStyles: allStyles?.length ?? 0,
        globalCount: globalStyles?.length ?? 0,
        orgCount: orgStyles?.length ?? 0,
        orgsWithStyles: orgStyleCountMap.size,
        defaultCount: allStyles?.filter(s => s.isDefault).length ?? 0,
    }), [allStyles, globalStyles, orgStyles, orgStyleCountMap]);

    // Filtered styles based on active scope tab + search query
    const filteredStyles = React.useMemo(() => {
        let source: MessageStyle[] = [];
        switch (scopeFilter) {
            case 'global':
                source = globalStyles ?? [];
                break;
            case 'organization':
                source = orgStyles ?? [];
                break;
            default:
                source = allStyles ?? [];
        }

        if (!searchQuery.trim()) return source;

        const q = searchQuery.toLowerCase().trim();
        return source.filter(s => 
            s.name.toLowerCase().includes(q) ||
            (s.organizationId && s.organizationId.toLowerCase().includes(q)) ||
            (s.scope && s.scope.toLowerCase().includes(q))
        );
    }, [scopeFilter, allStyles, globalStyles, orgStyles, searchQuery]);

    const isLoading = isLoadingAll;

    // ─── Handlers ────────────────────────────────────────────────────────────

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !name || !htmlWrapper) return;
        
        if (!htmlWrapper.includes('{{content}}')) {
            toast({ variant: 'destructive', title: 'Invalid Wrapper', description: 'HTML must include the {{content}} placeholder.' });
            return;
        }

        setIsSubmitting(true);
        try {
            await addDoc(collection(firestore, 'message_styles'), {
                name: name.trim(),
                htmlWrapper: htmlWrapper.trim(),
                workspaceIds: [],
                organizationId: '',
                scope: 'global',
                isDefault: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            setName('');
            setIsAdding(false);
            toast({ title: 'Global Style Blueprint Initialized' });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditClick = (style: MessageStyle) => {
        setEditingStyle(style);
        setEditName(style.name);
        setEditHtml(style.htmlWrapper || '');
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !editingStyle || !editName || !editHtml) return;

        if (!editHtml.includes('{{content}}')) {
            toast({ variant: 'destructive', title: 'Invalid Wrapper', description: 'HTML must include the {{content}} placeholder.' });
            return;
        }

        setIsUpdating(true);
        try {
            await updateDoc(doc(firestore, 'message_styles', editingStyle.id), {
                name: editName.trim(),
                htmlWrapper: editHtml.trim(),
                updatedAt: new Date().toISOString(),
            });
            setEditingStyle(null);
            toast({ title: 'Style Updated' });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: err.message });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleAiGenerate = async () => {
        if (!aiName || !aiPrompt) return;
        setIsAiProcessing(true);
        try {
            let photoDataUri = undefined;
            if (aiInspirationUrl) {
                const response = await fetch(aiInspirationUrl);
                const blob = await response.blob();
                photoDataUri = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
            }

            const result = await generateVisualStyle({
                name: aiName,
                prompt: aiPrompt,
                photoDataUri
            });

            setGeneratedHtml(result.htmlWrapper);
            toast({ title: 'AI Style Generated', description: result.explanation });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'AI Generation Failed', description: err.message });
        } finally {
            setIsAiProcessing(false);
        }
    };

    const handleSaveGenerated = async () => {
        if (!firestore || !aiName || !generatedHtml) return;
        setIsSubmitting(true);
        try {
            await addDoc(collection(firestore, 'message_styles'), {
                name: aiName.trim(),
                htmlWrapper: generatedHtml.trim(),
                workspaceIds: [],
                organizationId: '',
                scope: 'global',
                isDefault: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            setGeneratedHtml(null);
            setIsAiGenerating(false);
            toast({ title: 'AI Global Style Created' });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!firestore) return;
        const style = allStyles?.find(s => s.id === id);
        if (!style) return;

        // Check if style is in use
        const templatesUsingStyle = allTemplates?.filter(t => t.styleId === id) || [];
        if (templatesUsingStyle.length > 0) {
            setStyleInUseToDelete(style);
            return;
        }

        if (!confirm('Permanently purge this global blueprint? All workspaces adopting it will retain their local overrides, but new workspaces cannot adopt it.')) return;
        await deleteDoc(doc(firestore, 'message_styles', id));
        toast({ title: 'Global Blueprint Purged' });
    };

    const handleSetDefault = async (style: MessageStyle) => {
        if (!firestore) return;
        const targetValue = !style.isDefault;
        try {
            const batch = writeBatch(firestore);
            if (targetValue && globalStyles) {
                globalStyles.forEach(s => {
                    if (s.isDefault && s.id !== style.id) {
                        batch.update(doc(firestore, 'message_styles', s.id), { isDefault: false });
                    }
                });
            }
            batch.update(doc(firestore, 'message_styles', style.id), { isDefault: targetValue });
            await batch.commit();
            toast({
                title: targetValue ? 'Global Default Style Set' : 'Global Default Style Removed',
                description: targetValue
                    ? `"${style.name}" is now the default system blueprint.`
                    : `"${style.name}" is no longer the default system blueprint.`
            });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Action Failed', description: err.message });
        }
    };

    // ─── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="h-full overflow-y-auto text-left">
            <PageContainerFluid>
                <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="space-y-1">
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold uppercase tracking-widest text-[9px] px-3 py-1">
                        Control Plane
                    </Badge>
                    <h1 className="text-3xl font-bold tracking-tight">Global Style Blueprints</h1>
                    <p className="text-muted-foreground text-sm">
                        Manage system-wide template wrappers, email card defaults, and header/footer configurations.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <RainbowButton onClick={() => setIsAiGenerating(true)} className="h-11 px-6 gap-2 font-semibold text-[10px] shadow-xl">
                        <Sparkles className="h-4 w-4" /> AI Style Generator
                    </RainbowButton>
                    <Button onClick={() => router.push('/admin/backoffice/messaging/styles/new')} variant="outline" className="h-11 rounded-xl font-bold border-primary/20 text-primary bg-background/50 hover:bg-muted">
                        <Plus className="mr-2 h-4 w-4" /> Create Global Style
                    </Button>
                </div>
            </div>

            {/* KPI Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="rounded-2xl border-none ring-1 ring-border bg-card">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="p-3 bg-indigo-500/10 rounded-xl">
                            <Layers className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold tracking-tight">{isLoading ? '—' : stats.totalStyles}</p>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total Styles</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-none ring-1 ring-border bg-card">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="p-3 bg-purple-500/10 rounded-xl">
                            <Globe className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold tracking-tight">{isLoading ? '—' : stats.globalCount}</p>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Global Blueprints</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-none ring-1 ring-border bg-card">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="p-3 bg-emerald-500/10 rounded-xl">
                            <Building className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold tracking-tight">{isLoading ? '—' : stats.orgCount}</p>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Org Overrides</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-none ring-1 ring-border bg-card">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="p-3 bg-amber-500/10 rounded-xl">
                            <BarChart3 className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold tracking-tight">{isLoading ? '—' : stats.orgsWithStyles}</p>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Orgs with Styles</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Warning Banner */}
            <div className="bg-amber-50/50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                    <h4 className="text-sm font-bold text-amber-900">System Blueprint Governance</h4>
                    <p className="text-xs text-amber-800/80 mt-1 leading-relaxed">
                        These styles are available platform-wide. Organizations can adopt and clone these blueprints, making local overrides unique to their tenant context. Editing blueprints here will not corrupt existing organization overrides.
                    </p>
                </div>
            </div>

            {/* Scope Filter Tabs + Search */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <Tabs value={scopeFilter} onValueChange={(val) => setScopeFilter(val as ScopeFilter)}>
                    <TabsList className="bg-background border p-1 h-10 rounded-xl shadow-sm">
                        <TabsTrigger 
                            value="all"
                            className={cn(
                                "text-[10px] font-semibold px-4 rounded-lg gap-1.5 h-8 transition-all",
                                scopeFilter === 'all' && "bg-primary text-primary-foreground shadow-md"
                            )}
                        >
                            <Layers className="h-3.5 w-3.5" /> All ({stats.totalStyles})
                        </TabsTrigger>
                        <TabsTrigger 
                            value="global"
                            className={cn(
                                "text-[10px] font-semibold px-4 rounded-lg gap-1.5 h-8 transition-all",
                                scopeFilter === 'global' && "bg-primary text-primary-foreground shadow-md"
                            )}
                        >
                            <Globe className="h-3.5 w-3.5" /> Global ({stats.globalCount})
                        </TabsTrigger>
                        <TabsTrigger 
                            value="organization"
                            className={cn(
                                "text-[10px] font-semibold px-4 rounded-lg gap-1.5 h-8 transition-all",
                                scopeFilter === 'organization' && "bg-primary text-primary-foreground shadow-md"
                            )}
                        >
                            <Building className="h-3.5 w-3.5" /> Organization ({stats.orgCount})
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search styles by name..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="h-10 pl-10 w-64 rounded-xl bg-muted/20 border-none shadow-inner font-medium text-sm"
                    />
                </div>
            </div>

            {/* Styles Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-20">
                {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => <Card key={i} className="h-64 animate-pulse bg-muted rounded-[2rem]" />)
                ) : filteredStyles.length ? (
                    filteredStyles.map((style) => {
                        const isGlobal = style.scope === 'global' || (!style.workspaceIds || style.workspaceIds.length === 0);
                        const usageCount = styleUsageMap.get(style.id) || 0;
                        return (
                            <Card key={style.id} className="group relative overflow-hidden border-none ring-1 ring-border hover:ring-primary/20 hover:shadow-xl transition-all duration-500 rounded-[1.5rem] bg-card flex flex-col h-[230px] w-full">
                                {/* Preview / Iframe Area */}
                                <div className="relative flex-1 bg-slate-50 overflow-hidden">
                                    <ResponsiveIframePreview 
                                        srcDoc={(style.htmlWrapper || '').replace('{{content}}', '<div style="height: 100px; background: #f1f5f9; border: 2px dashed #cbd5e1; padding: 40px; text-align: center; color: #64748b; font-family: sans-serif; font-size: 12px; border-radius: 12px; margin: 20px;">[ Content Gateway ]</div>')}
                                        className="pointer-events-none border-none opacity-85 group-hover:opacity-95 transition-opacity"
                                        title={`Preview of ${style.name}`}
                                    />
                                    <div className="absolute inset-0 bg-transparent" />
                                    
                                    {/* Default Pill (when not hovered) */}
                                    {style.isDefault && (
                                        <div className="absolute top-2 left-2 group-hover:opacity-0 transition-opacity">
                                            <Badge className="bg-emerald-500 text-white border-none text-[8px] font-bold uppercase h-5 shadow-sm">
                                                <Check className="h-2.5 w-2.5 mr-0.5" /> Default
                                            </Badge>
                                        </div>
                                    )}

                                    {/* Overlay on Hover */}
                                    <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                                        <div className="flex items-center gap-1 bg-background/95 backdrop-blur-md p-1 rounded-xl border shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                            {isGlobal && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className={cn("h-7 w-7 rounded-lg transition-colors", style.isDefault ? "text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20" : "text-muted-foreground hover:bg-muted")} 
                                                    onClick={() => handleSetDefault(style)}
                                                    title={style.isDefault ? "System Default" : "Set Default"}
                                                >
                                                    <Check className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" 
                                                onClick={() => setPreviewStyle(style)}
                                                title="Preview"
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" 
                                                onClick={() => router.push(`/admin/backoffice/messaging/styles/${style.id}`)}
                                                title="Edit"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            {isGlobal && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-lg" 
                                                    onClick={() => handleDelete(style.id)}
                                                    title="Delete"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Info Footer */}
                                <div className="px-4 py-3 bg-card border-t flex items-center justify-between shrink-0 h-14">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-foreground truncate pr-2" title={style.name}>{style.name}</p>
                                        <p className="text-[9px] text-muted-foreground font-semibold mt-0.5">
                                            {isGlobal ? 'System Blueprint' : `Org Override`}
                                        </p>
                                    </div>
                                    <Badge variant="secondary" className="text-[8px] font-bold h-5 px-2 bg-muted/50 border-none shrink-0">
                                        {usageCount} template{usageCount !== 1 ? 's' : ''}
                                    </Badge>
                                </div>
                            </Card>
                        );
                    })
                ) : (
                    <div className="col-span-full py-32 text-center border-4 border-dashed rounded-[4rem] flex flex-col items-center justify-center gap-4 opacity-30">
                        <Palette className="h-16 w-16" />
                        <p className="font-semibold text-xs">
                            {searchQuery ? `No styles matching "${searchQuery}"` : 'No style blueprints defined.'}
                        </p>
                    </div>
                )}
            </div>

            {/* AI Generator Dialog */}
            <Dialog open={isAiGenerating} onOpenChange={setIsAiGenerating}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem]">
                    <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-primary/10 rounded-xl"><Sparkles size={24} className="text-primary" /></div>
                            <div className="text-left">
                                <DialogTitle className="text-xl font-semibold tracking-tight">AI Global Style Generator</DialogTitle>
                                <DialogDescription className="text-xs font-bold opacity-60">Generate responsive blueprints via AI</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                        <div className="w-full lg:w-1/2 p-8 border-r flex flex-col gap-8 overflow-y-auto bg-muted/10">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Identity Label</Label>
                                <Input value={aiName} onChange={e => setAiName(e.target.value)} placeholder="e.g. Modern Campus Dark Theme" className="h-12 rounded-xl bg-card border-primary/10 shadow-sm font-bold" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Design Directives</Label>
                                <Textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="e.g. Create a clean design with a deep blue header, centered white logo, and a minimal footer." className="min-h-[180px] rounded-2xl text-sm leading-relaxed bg-card border-primary/10 shadow-inner p-4" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Visual Inspiration (Optional)</Label>
                                <MediaSelect value={aiInspirationUrl} onValueChange={setAiInspirationUrl} filterType="image" className="rounded-2xl" />
                            </div>
                            <RainbowButton onClick={handleAiGenerate} disabled={isAiProcessing} className="h-14 w-full font-semibold text-lg gap-2 shadow-2xl">
                                {isAiProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                                {isAiProcessing ? 'Generating…' : 'Generate Global Style'}
                            </RainbowButton>
                        </div>

                        <div className="w-full lg:w-1/2 p-8 flex flex-col bg-card">
                            <div className="flex items-center justify-between mb-6">
                                <Label className="text-[10px] font-semibold text-primary flex items-center gap-2"><Eye className="h-3 w-3" /> Live Render</Label>
                                {generatedHtml && <Badge className="bg-emerald-50 text-emerald-600 border-none font-semibold text-[8px] uppercase ">Logic Verified</Badge>}
                            </div>
                            <div className="flex-1 rounded-[2.5rem] bg-muted/10 border-2 border-dashed border-border flex items-center justify-center relative overflow-hidden shadow-inner p-4">
                                {generatedHtml ? (
                                    <div className="w-full h-full bg-card rounded-2xl shadow-xl overflow-hidden" dangerouslySetInnerHTML={{ __html: generatedHtml.replace('{{content}}', '<div style="background: #f1f5f9; border: 2px dashed #cbd5e1; padding: 40px; text-align: center; color: #64748b; font-weight: 900; border-radius: 12px; margin: 20px;">[ PROTOTYPE CONTENT ]</div>') }} />
                                ) : (
                                    <div className="text-center space-y-4 opacity-20">
                                        <Palette size={64} className="mx-auto" />
                                        <p className="text-[10px] font-semibold tracking-[0.3em]">Awaiting Simulation</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-muted/30 border-t shrink-0 flex justify-between items-center sm:justify-between">
                        <Button variant="ghost" onClick={() => setIsAiGenerating(false)} className="font-bold rounded-xl h-12 px-8">Discard</Button>
                        <Button onClick={handleSaveGenerated} disabled={!generatedHtml || isSubmitting} className="rounded-xl font-semibold px-12 shadow-2xl h-12 text-xs active:scale-95 transition-all">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Commit AI Style
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Standard Preview Dialog */}
            <Dialog open={!!previewStyle} onOpenChange={() => setPreviewStyle(null)}>
                <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem] bg-background">
                    <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl"><Eye className="h-5 w-5 text-primary" /></div>
                            <div>
                                <DialogTitle className="text-xl font-semibold tracking-tight">Style Preview</DialogTitle>
                                <DialogDescription className="text-xs font-bold flex items-center gap-2">
                                    {previewStyle?.name}
                                    {previewStyle && (
                                        <Badge variant="secondary" className="text-[8px] font-semibold uppercase h-4 px-1.5">
                                            {previewStyle.scope === 'global' ? 'Global' : 'Organization'}
                                        </Badge>
                                    )}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden relative bg-background flex justify-center">
                        <ScrollArea className="h-full w-full">
                            <div className="w-full max-w-[650px] mx-auto p-6">
                                {previewStyle && (
                                    <div dangerouslySetInnerHTML={{ __html: (previewStyle.htmlWrapper || '').replace('{{content}}', '<div style="background: #f8fafc; border: 2px dashed #cbd5e1; padding: 60px; text-align: center; color: #64748b; font-family: sans-serif; border-radius: 12px; margin: 20px 0;"><p style="margin: 0; font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">Resolved Template Payload</p></div>') }} />
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                    <DialogFooter className="p-4 bg-card border-t shrink-0 flex items-center justify-end gap-2">
                        <Button variant="outline" onClick={() => setPreviewStyle(null)} className="rounded-xl h-11 px-6 text-xs font-semibold">
                            Close
                        </Button>
                        {previewStyle && (
                            <Button 
                                onClick={() => {
                                    const styleToEdit = previewStyle;
                                    setPreviewStyle(null);
                                    router.push(`/admin/backoffice/messaging/styles/${styleToEdit.id}`);
                                }} 
                                className="rounded-xl h-11 px-6 text-xs font-semibold shadow-lg shadow-primary/20"
                            >
                                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Style
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Blocked Dialog */}
            <AlertDialog open={!!styleInUseToDelete} onOpenChange={(o) => !o && setStyleInUseToDelete(null)}>
                <AlertDialogContent className="rounded-[2.5rem] max-w-md p-8 border-none shadow-2xl bg-card text-left">
                    <AlertDialogHeader className="space-y-4">
                        <div className="mx-auto p-4 bg-amber-500/10 text-amber-500 rounded-full w-fit">
                            <AlertCircle size={32} />
                        </div>
                        <div className="space-y-2 text-center">
                            <AlertDialogTitle className="font-semibold text-lg tracking-tight">Deletion Blocked</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
                                The style blueprint <span className="font-bold text-foreground">"{styleInUseToDelete?.name}"</span> is currently being used by <span className="font-bold text-foreground">{styleInUseTemplates.length} template{styleInUseTemplates.length !== 1 ? 's' : ''}</span>. 
                                To delete this style blueprint, you must first change the style wrapper of those templates.
                            </AlertDialogDescription>
                        </div>
                    </AlertDialogHeader>
                    
                    {/* Templates List */}
                    <div className="my-6 max-h-48 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                        {styleInUseTemplates.map((tmpl) => (
                            <div key={tmpl.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors">
                                <span className="text-xs font-bold truncate max-w-[200px] text-foreground">{tmpl.name}</span>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-8 rounded-lg text-[10px] font-semibold flex items-center gap-1.5"
                                    onClick={() => {
                                        setStyleInUseToDelete(null);
                                        // Router push to backoffice templates page with edit search param
                                        router.push(`/admin/backoffice/messaging/templates?edit=${tmpl.id}`);
                                    }}
                                >
                                    <Pencil size={12} /> Edit Template
                                </Button>
                            </div>
                        ))}
                    </div>
                    
                    <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel className="w-full rounded-xl font-bold border-none bg-muted/65 hover:bg-muted text-foreground">
                            Close
                        </AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
                </div>
            </PageContainerFluid>
        </div>
    );
}

interface ResponsiveIframePreviewProps {
    srcDoc: string;
    className?: string;
    title?: string;
}

function ResponsiveIframePreview({ 
    srcDoc, 
    className, 
    title = "Preview" 
}: ResponsiveIframePreviewProps) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [scale, setScale] = React.useState(0.25);
    const [dimensions, setDimensions] = React.useState({ width: 800, height: 600 });
    const [isMeasured, setIsMeasured] = React.useState(false);

    React.useEffect(() => {
        if (!containerRef.current) return;
        const container = containerRef.current;
        
        const observer = new ResizeObserver((entries) => {
            if (!entries || entries.length === 0) return;
            const entry = entries[0];
            const { width, height } = entry.contentRect;
            if (width <= 0 || height <= 0) return;
            
            const virtualWidth = 800;
            const newScale = width / virtualWidth;
            setScale(newScale);
            setDimensions({ width: virtualWidth, height: height / newScale });
            setIsMeasured(true);
        });
        
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={containerRef} className="w-full h-full overflow-hidden relative bg-slate-50 flex items-center justify-center">
            <iframe 
                srcDoc={srcDoc}
                style={{
                    width: `${dimensions.width}px`,
                    height: `${dimensions.height}px`,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                }}
                className={cn(
                    "pointer-events-none border-none transition-opacity duration-300",
                    isMeasured ? "opacity-100" : "opacity-0",
                    className
                )}
                title={title}
                loading="lazy"
            />
        </div>
    );
}

