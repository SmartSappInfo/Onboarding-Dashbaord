'use client';

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Survey, PDFForm, Meeting, School } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Globe, 
    Search, 
    ExternalLink, 
    Copy, 
    ClipboardList, 
    FileText, 
    Calendar, 
    Zap, 
    LayoutList,
    Building,
    CheckCircle2,
    PlusCircle
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
import { SmartSappIcon } from '@/components/icons';

export default function PublicPortalsPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = React.useState('');

    // Dynamic Data Aggregation
    const surveysQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'surveys'), where('status', '==', 'published'), orderBy('createdAt', 'desc')) : null, 
    [firestore]);

    const pdfsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'pdfs'), where('status', '==', 'published'), orderBy('createdAt', 'desc')) : null, 
    [firestore]);

    const meetingsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'meetings'), orderBy('meetingTime', 'desc')) : null, 
    [firestore]);

    const { data: surveys, isLoading: isLoadingSurveys } = useCollection<Survey>(surveysQuery);
    const { data: pdfs, isLoading: isLoadingPdfs } = useCollection<PDFForm>(pdfsQuery);
    const { data: meetings, isLoading: isLoadingMeetings } = useCollection<Meeting>(meetingsQuery);

    const isLoading = isLoadingSurveys || isLoadingPdfs || isLoadingMeetings;

    // Filter Logic
    const filteredSurveys = React.useMemo(() => surveys?.filter(s => 
        s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.schoolName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.internalName?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [], [surveys, searchTerm]);

    const filteredPdfs = React.useMemo(() => pdfs?.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.publicTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.schoolName?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [], [pdfs, searchTerm]);

    const filteredMeetings = React.useMemo(() => meetings?.filter(m => 
        m.schoolName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        m.type?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [], [meetings, searchTerm]);

    const handleCopy = (path: string) => {
        if (typeof window === 'undefined') return;
        const url = `${window.location.origin}${path}`;
        navigator.clipboard.writeText(url);
        toast({ title: 'Link Copied', description: 'Public portal URL is ready to share.' });
    };

    const PortalCard = ({ title, school, path, icon: Icon, color }: { title: string, school?: string, path: string, icon: any, color: string }) => (
        <Card className="group relative overflow-hidden border-border/50 hover:border-primary/30 hover:shadow-xl transition-all duration-500 rounded-2xl bg-card flex flex-col h-full">
            <div className={cn("absolute top-0 left-0 w-1 h-full", color)} />
            <CardHeader className="p-5 pb-3">
                <div className="flex items-start justify-between gap-4">
                    <div className="p-2.5 rounded-xl bg-muted/50 border border-border/50 group-hover:bg-background transition-colors">
                        <Icon className={cn("h-5 w-5", color.replace('bg-', 'text-'))} />
                    </div>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleCopy(path)}>
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copy URL</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>
                <div className="mt-4 space-y-1">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-black truncate text-foreground group-hover:text-primary transition-colors leading-tight">{title}</CardTitle>
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    </div>
                    {school && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            <Building className="h-3 w-3" /> {school}
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 mt-auto pt-4">
                <Button asChild className="w-full h-10 rounded-xl font-bold gap-2 shadow-sm transition-all active:scale-95">
                    <a href={path} target="_blank" rel="noopener noreferrer">
                        Launch Portal <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                </Button>
            </CardContent>
        </Card>
    );

    const SectionHeader = ({ title, badge, icon: Icon }: { title: string, badge?: number, icon: any }) => (
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl text-primary"><Icon className="h-5 w-5" /></div>
                <h2 className="text-xl font-black uppercase tracking-tight text-foreground">{title}</h2>
            </div>
            {badge !== undefined && <Badge variant="secondary" className="rounded-full h-6 px-3 font-black tabular-nums">{badge}</Badge>}
        </div>
    );

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
            <div className="max-w-7xl mx-auto space-y-12 pb-32">
                
                {/* Header Control Hub */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-black tracking-tight flex items-center gap-4 text-foreground uppercase">
                            <Globe className="h-10 w-10 text-primary" />
                            Launchpad Registry
                        </h1>
                        <p className="text-muted-foreground font-medium text-lg mt-1">Single source of truth for all live public portals.</p>
                    </div>
                    <div className="relative w-full md:w-[400px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                        <Input 
                            placeholder="Filter by school or portal title..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-11 h-12 rounded-2xl bg-white border-none shadow-xl ring-1 ring-border focus:ring-primary/20 font-bold"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
                    </div>
                ) : (
                    <div className="space-y-16">
                        
                        {/* 1. Core Infrastructure */}
                        {!searchTerm && (
                            <section>
                                <SectionHeader title="Core System Nodes" icon={Zap} />
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <PortalCard title="Public Home & Welcome" path="/" icon={SmartSappIcon} color="bg-slate-900" />
                                    <PortalCard title="New School Onboarding" path="/register-new-signup" icon={PlusCircle} color="bg-emerald-600" />
                                </div>
                            </section>
                        )}

                        {/* 2. Intelligent Surveys */}
                        {filteredSurveys.length > 0 && (
                            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <SectionHeader title="Intelligent Surveys" badge={filteredSurveys.length} icon={ClipboardList} />
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {filteredSurveys.map(s => (
                                        <PortalCard key={s.id} title={s.title} school={s.schoolName || 'SmartSapp'} path={`/surveys/${s.slug}`} icon={ClipboardList} color="bg-blue-500" />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* 3. Document Signing */}
                        {filteredPdfs.length > 0 && (
                            <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <SectionHeader title="Doc Signing Portals" badge={filteredPdfs.length} icon={FileText} />
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {filteredPdfs.map(p => (
                                        <PortalCard key={p.id} title={p.publicTitle || p.name} school={p.schoolName || 'SmartSapp'} path={`/forms/${p.slug || p.id}`} icon={FileText} color="bg-orange-500" />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* 4. Meeting Rooms */}
                        {filteredMeetings.length > 0 && (
                            <section className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
                                <SectionHeader title="Session Meeting Rooms" badge={filteredMeetings.length} icon={Calendar} />
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {filteredMeetings.map(m => {
                                        const typeSlug = m.type?.slug || 'parent-engagement';
                                        return (
                                            <PortalCard 
                                                key={m.id} 
                                                title={m.type?.name || 'Session'} 
                                                school={m.schoolName} 
                                                path={`/meetings/${typeSlug}/${m.schoolSlug}`} 
                                                icon={Calendar} 
                                                color="bg-purple-600" 
                                            />
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {/* Empty Search State */}
                        {searchTerm && filteredSurveys.length === 0 && filteredPdfs.length === 0 && filteredMeetings.length === 0 && (
                            <div className="py-32 text-center border-4 border-dashed rounded-[4rem] bg-muted/10 flex flex-col items-center justify-center gap-4 opacity-40">
                                <LayoutList className="h-16 w-16" />
                                <p className="font-black uppercase tracking-widest text-lg">No portals matched your search</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}