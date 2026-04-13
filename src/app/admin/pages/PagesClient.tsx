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
            <Card className="group relative overflow-hidden border-border/50 hover:border-primary/30 hover:shadow-xl transition-all duration-500 rounded-2xl bg-card flex flex-col h-full text-left">
                <div className={cn("absolute top-0 left-0 w-1 h-full", page.status === 'published' ? 'bg-emerald-500' : 'bg-slate-400')} />
                <CardHeader className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-4">
                        <div className="p-2.5 rounded-xl bg-muted/20 border border-border/50 group-hover:bg-background transition-colors">
                            <Layout className={cn("h-5 w-5", page.status === 'published' ? 'text-emerald-500' : 'text-slate-500')} />
                        </div>
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {page.status === 'published' && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={(e) => handleCopy(e, publicPath)}>
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Copy URL</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>
                    </div>
                    <div className="mt-4 space-y-1">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-sm font-semibold truncate text-foreground group-hover:text-primary transition-colors leading-tight tracking-tight">
                                {page.name}
                            </CardTitle>
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground tracking-[0.15em] uppercase">
                            /{page.slug}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 mt-auto pt-4 space-y-3">
                    <div className="flex gap-2">
                        <Badge variant="outline" className={cn("text-[9px] font-semibold border-border/50")}>
                            {page.pageGoal?.replace('_', ' ')}
                        </Badge>
                    </div>

                    {/* Performance Stats Overlay */}
                    {/* Performance Stats */}
                    {page.stats && (
                        <div className="mt-4 pt-4 border-t flex items-center justify-between">
                            <div className="flex gap-4">
                                <div className="text-center">
                                    <p className="text-[10px] font-black text-slate-400 uppercase leading-none">{page.stats.views || 0}</p>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Views</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[10px] font-black text-emerald-600 uppercase leading-none">{page.stats.conversions || 0}</p>
                                    <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-tighter">Leads</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[10px] font-black text-indigo-600 uppercase leading-none">
                                        {page.stats.views ? ((page.stats.conversions || 0) / page.stats.views * 100).toFixed(1) : 0}%
                                    </p>
                                    <p className="text-[8px] font-bold text-indigo-600 uppercase tracking-tighter">CVR</p>
                                </div>
                            </div>
                            <Button asChild variant="ghost" size="sm" className="h-8 px-3 rounded-lg font-black text-[10px] uppercase tracking-wider text-slate-500 hover:text-primary hover:bg-primary/5 gap-2 group/btn">
                                <Link href={`/admin/pages/${page.id}/leads`}>
                                    View Leads
                                    <ArrowRight className="h-3 w-3 group-hover/btn:translate-x-0.5 transition-transform" />
                                </Link>
                            </Button>
                        </div>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                        <Button asChild variant="outline" className="flex-1 h-10 rounded-xl font-bold shadow-sm transition-all text-[10px] border-primary/20 text-primary">
                            <Link href={`/admin/pages/${page.id}/builder`}>
                                Builder
                            </Link>
                        </Button>
                        {page.status === 'published' && (
                            <Button asChild variant="secondary" className="h-10 w-10 p-0 rounded-xl">
                                <a href={publicPath} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                </a>
                            </Button>
                        )}
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-10 w-10 text-muted-foreground hover:text-primary transition-colors"
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

                </CardContent>
            </Card>
        );
    };

    return (
        <div className="h-full overflow-y-auto bg-background">
            <div className="space-y-12 pb-32 text-left">
                
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-semibold tracking-tighter flex items-center gap-4 text-foreground ">
                            <Layout className="h-10 w-10 text-primary" />
                            Campaign Pages
                        </h1>
                        <p className="text-muted-foreground font-medium text-lg mt-1">
                            Manage highly-converting public landing pages for your campaigns.
                        </p>
                    </div>
                    <div className="flex gap-4 w-full md:w-auto">
                        <div className="relative w-full md:w-[300px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                            <Input 
                                placeholder="Filter pages..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-11 h-12 rounded-2xl bg-muted/20 border-border/50 shadow-inner ring-1 ring-border focus:ring-primary/20 font-bold transition-all"
                            />
                        </div>
                        <Button asChild className="h-12 px-6 rounded-2xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20">
                            <Link href="/admin/pages/new">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                New Page
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
