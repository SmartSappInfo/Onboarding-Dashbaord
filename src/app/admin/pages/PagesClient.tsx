'use client';

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { CampaignPage } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Layout, 
    Search, 
    ExternalLink, 
    Copy, 
    PlusCircle,
    ArrowRight,
    LayoutList,
    Activity,
    Settings2,
    Eye,
    MousePointerClick,
    Target,
    Loader2
} from 'lucide-react';
import { 
    TooltipProvider, 
    Tooltip, 
    TooltipTrigger, 
    TooltipContent 
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTenant } from '@/context/TenantContext';
import Link from 'next/link';
import { duplicatePageAction } from '@/lib/page-actions';
import { useUser } from '@/firebase';



export default function PagesClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { activeWorkspaceId } = useTenant();
    const { user } = useUser();
    const [searchTerm, setSearchTerm] = React.useState('');
    const [duplicatingId, setDuplicatingId] = React.useState<string | null>(null);


    const pagesQuery = useMemoFirebase(() => 
        firestore && activeWorkspaceId ? query(
            collection(firestore, 'campaign_pages'), 
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('createdAt', 'desc')
        ) : null, 
    [firestore, activeWorkspaceId]);

    const { data: pages, isLoading } = useCollection<CampaignPage>(pagesQuery);

    const filteredPages = React.useMemo(() => pages?.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.slug.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [], [pages, searchTerm]);

    const handleCopy = (e: React.MouseEvent, path: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window === 'undefined') return;
        const url = `${window.location.origin}${path}`;
        navigator.clipboard.writeText(url);
        toast({ 
            title: 'Link Copied', 
            description: 'Public page URL copied to clipboard.',
        });
    };

    const handleDuplicate = async (e: React.MouseEvent, pageId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) return;

        setDuplicatingId(pageId);
        try {
            const res = await duplicatePageAction(pageId, user.uid);
            if (res.success) {
                toast({ title: 'Page Duplicated', description: 'A draft copy has been created.' });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: res.error });
            }
        } finally {
            setDuplicatingId(null);
        }
    };


    const PageCard = ({ page }: { page: CampaignPage }) => {
        const publicPath = `/p/${page.slug}`;
        
        return (
            <Card className="group relative overflow-hidden border border-border bg-transparent shadow-sm hover:shadow-xl hover:ring-primary/20 transition-all duration-300 rounded-2xl flex flex-col h-full text-left ring-1 ring-border">
                <div className={cn("absolute top-0 left-0 w-1.5 h-full transition-all group-hover:w-2", page.status === 'published' ? 'bg-emerald-500/80 shadow-[2px_0_8px_rgba(16,185,129,0.1)]' : 'bg-slate-300')} />
                <CardHeader className="p-6 pb-2">
                    <div className="flex items-start justify-between gap-4">
                        <div className="p-3 rounded-2xl bg-primary/10 text-primary shrink-0 group-hover:scale-110 transition-transform ring-1 ring-primary/20">
                            <Layout className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0">
                            {page.status === 'published' && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={(e) => handleCopy(e, publicPath)}>
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Copy Public URL</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>
                    </div>
                    <div className="mt-4 space-y-1.5">
                        <CardTitle className="text-lg font-bold tracking-tight text-foreground group-hover:text-primary transition-colors leading-tight">
                            {page.name}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                             <div className="text-[10px] font-bold text-muted-foreground/60 tracking-widest uppercase bg-muted/30 px-2 py-0.5 rounded-md">
                                /{page.slug}
                            </div>
                            <Badge variant="outline" className={cn("text-[9px] font-bold uppercase tracking-widest bg-primary/5 text-primary border-primary/20 rounded-md px-2")}>
                                {page.pageGoal?.replace('_', ' ')}
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                
                <CardContent className="px-6 pb-6 mt-auto pt-6 space-y-4">
                    {/* Performance Stats */}
                    {page.stats && (
                        <div className="py-4 border-y border-border/50 bg-muted/5 rounded-xl px-3 -mx-1 grid grid-cols-3 gap-2">
                            <div className="text-left">
                                <p className="text-sm font-bold tracking-tight text-foreground leading-none">{page.stats.views || 0}</p>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Interactions</p>
                            </div>
                            <div className="text-left border-x border-border/50 px-2">
                                <p className="text-sm font-bold tracking-tight text-emerald-500 leading-none">{page.stats.conversions || 0}</p>
                                <p className="text-[9px] font-bold text-emerald-500/70 uppercase tracking-widest mt-1">Manifests</p>
                            </div>
                            <div className="text-left pl-1">
                                <p className="text-sm font-bold tracking-tight text-indigo-500 leading-none">
                                    {page.stats.views ? ((page.stats.conversions || 0) / page.stats.views * 100).toFixed(1) : 0}%
                                </p>
                                <p className="text-[9px] font-bold text-indigo-500/70 uppercase tracking-widest mt-1">Efficiency</p>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                        <Button asChild className="flex-1 h-11 rounded-xl font-bold shadow-md transition-all text-xs bg-primary hover:bg-primary/90 text-primary-foreground transform active:scale-[0.98]">
                            <Link href={`/admin/pages/${page.id}/builder`}>
                                Builder Hub
                            </Link>
                        </Button>
                        <div className="flex gap-1.5">
                            {page.status === 'published' && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button asChild variant="outline" className="h-11 w-11 p-0 rounded-xl bg-transparent ring-1 ring-border hover:bg-primary/5 hover:text-primary hover:ring-primary/30 transition-all shadow-sm">
                                                <a href={publicPath} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Open Live Page</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-11 w-11 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all ring-1 ring-transparent hover:ring-primary/20"
                                onClick={(e) => handleDuplicate(e, page.id)}
                                disabled={duplicatingId === page.id}
                            >
                                {duplicatingId === page.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                ) : (
                                    <Copy className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="h-full overflow-y-auto w-full">
            <div className="space-y-12 pb-32 text-left w-full">
                
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex flex-col items-start">
                        <h1 className="text-3xl font-bold text-foreground">
                            Campaign Hub
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Conversion-optimized landing architectural system
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
                        <div className="relative w-full sm:w-[240px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                            <Input 
                                placeholder="Filter pages..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-11 h-11 rounded-xl bg-background border-border shadow-sm ring-1 ring-border focus:ring-primary/20 font-bold transition-all text-sm"
                            />
                        </div>
                        <Button asChild className="h-11 px-8 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transform active:scale-95 transition-all text-sm w-full sm:w-auto">
                            <Link href="/admin/pages/new">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                New Blueprint
                            </Link>
                        </Button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
                    </div>
                ) : (
                    <div className="space-y-16">
                        {filteredPages.length > 0 ? (
                            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {filteredPages.map(page => (
                                        <PageCard key={page.id} page={page} />
                                    ))}
                                </div>
                            </section>
                        ) : (
                            <div className="py-32 text-center border-4 border-dashed rounded-[4rem] bg-background flex flex-col items-center justify-center gap-4 opacity-40">
                                <LayoutList className="h-16 w-16" />
                                <p className="font-semibold text-lg">
                                    {searchTerm ? 'No pages matched your search' : 'No campaign pages found'}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
