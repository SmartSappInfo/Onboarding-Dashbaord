'use client';

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Survey, PDFForm, Meeting } from '@/lib/types';
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
    Building,
    PlusCircle,
    LayoutList,
    Activity,
    CheckCircle2,
    Target,
    GraduationCap,
    BarChart3
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
import { useTenant } from '@/context/TenantContext';

export default function PortalsClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { activeWorkspaceId } = useTenant();
    const [searchTerm, setSearchTerm] = React.useState('');

    // MULTI-TENANT QUERIES: Ensure workspace context is ready before execution
    const surveysQuery = useMemoFirebase(() => 
        firestore && activeWorkspaceId ? query(
            collection(firestore, 'surveys'), 
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            where('status', '==', 'published'), 
            orderBy('createdAt', 'desc')
        ) : null, 
    [firestore, activeWorkspaceId]);

    const pdfsQuery = useMemoFirebase(() => 
        firestore && activeWorkspaceId ? query(
            collection(firestore, 'pdfs'), 
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            where('status', '==', 'published'), 
            orderBy('createdAt', 'desc')
        ) : null, 
    [firestore, activeWorkspaceId]);

    const meetingsQuery = useMemoFirebase(() => 
        firestore && activeWorkspaceId ? query(
            collection(firestore, 'meetings'), 
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('meetingTime', 'desc')
        ) : null, 
    [firestore, activeWorkspaceId]);

    const { data: surveys, isLoading: isLoadingSurveys } = useCollection<Survey>(surveysQuery);
    const { data: pdfs, isLoading: isLoadingPdfs } = useCollection<PDFForm>(pdfsQuery);
    const { data: meetings, isLoading: isLoadingMeetings } = useCollection<Meeting>(meetingsQuery);

    const isLoading = isLoadingSurveys || isLoadingPdfs || isLoadingMeetings;

    const filteredSurveys = React.useMemo(() => surveys?.filter(s => 
        s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.entityName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.internalName?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [], [surveys, searchTerm]);

    const filteredPdfs = React.useMemo(() => pdfs?.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.publicTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.entityName?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [], [pdfs, searchTerm]);

    const filteredMeetings = React.useMemo(() => meetings?.filter(m => 
        m.entityName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        m.type?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [], [meetings, searchTerm]);

    const handleCopy = (path: string) => {
        if (typeof window === 'undefined') return;
        const url = `${window.location.origin}${path}`;
        navigator.clipboard.writeText(url);
        toast({ 
            title: 'Link Copied', 
            description: 'Public portal URL is ready to share.',
        });
    };

    const PortalCard = ({ title, school, path, icon: Icon, color }: { title: string, school?: string, path: string, icon: any, color: string }) => (
 <Card className="group relative overflow-hidden border-border/50 hover:border-primary/30 hover:shadow-xl transition-all duration-500 rounded-2xl bg-card flex flex-col h-full text-left">
 <div className={cn("absolute top-0 left-0 w-1 h-full", color)} />
 <CardHeader className="p-5 pb-3">
 <div className="flex items-start justify-between gap-4">
 <div className="p-2.5 rounded-xl bg-muted/20 border border-border/50 group-hover:bg-background transition-colors">
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
 <CardTitle className="text-sm font-semibold truncate text-foreground group-hover:text-primary transition-colors leading-tight tracking-tight">{title}</CardTitle>
 <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    </div>
                    {school && (
 <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground tracking-[0.15em]">
 <Building className="h-3 w-3" /> {school}
                        </div>
                    )}
                </div>
            </CardHeader>
 <CardContent className="px-5 pb-5 mt-auto pt-4">
 <Button asChild className="w-full h-10 rounded-xl font-bold gap-2 shadow-sm transition-all active:scale-95 text-[10px] ">
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
 <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
            </div>
            {badge !== undefined && <Badge variant="secondary" className="rounded-full h-6 px-3 font-semibold tabular-nums">{badge}</Badge>}
        </div>
    );

    const StatCard = ({ label, value, icon: Icon }: { label: string, value: number, icon: any }) => (
 <Card className="rounded-2xl border-none ring-1 ring-border shadow-md overflow-hidden bg-card/40 backdrop-blur-sm text-left transition-all hover:shadow-lg">
 <CardContent className="p-5 flex items-center gap-4">
 <div className="p-3 bg-muted/20 rounded-xl text-muted-foreground"><Icon className="h-5 w-5" /></div>
                <div>
 <p className="text-[9px] font-semibold text-muted-foreground leading-none mb-1.5">Total {label}</p>
 <p className="text-2xl font-semibold tabular-nums tracking-tighter">{isLoading ? '...' : value}</p>
                </div>
            </CardContent>
        </Card>
    );

    return (
 <div className="h-full overflow-y-auto  bg-background">
 <div className=" space-y-12 pb-32 text-left">
                
 <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
 <h1 className="text-4xl font-semibold tracking-tighter flex items-center gap-4 text-foreground ">
 <Globe className="h-10 w-10 text-primary" />
                            Public Launchpad
                        </h1>
 <p className="text-muted-foreground font-medium text-lg mt-1">
                            Live system entry points for the <strong>{activeWorkspaceId || 'global'}</strong> track.
                        </p>
                    </div>
 <div className="relative w-full md:w-[400px]">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                        <Input 
                            placeholder="Filter by school or portal title..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-11 h-12 rounded-2xl bg-muted/20 border-border/50 shadow-inner ring-1 ring-border focus:ring-primary/20 font-bold transition-all"
                        />
                    </div>
                </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Live Surveys" value={surveys?.length || 0} icon={ClipboardList} />
                    <StatCard label="Doc Portals" value={pdfs?.length || 0} icon={FileText} />
                    <StatCard label="Meeting Rooms" value={meetings?.length || 0} icon={Calendar} />
                    <StatCard label="Custom Pages" value={5} icon={Zap} />
                </div>

                {isLoading ? (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
                    </div>
                ) : (
                    <div className="space-y-16">
                        
                        {!searchTerm && (
                            <section>
                                <SectionHeader title="Core Custom Pages" icon={Zap} />
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <PortalCard title="Public Homepage" path="/" icon={SmartSappIcon} color="bg-slate-900" />
                                    {activeWorkspaceId === 'onboarding' && (
                                        <>
                                            <PortalCard title="Campaign Landing" path="/campaign/school-comparison" icon={Target} color="bg-primary" />
                                            <PortalCard title="Campaign Stats" path="/campaign/school-comparison/statistics" icon={BarChart3} color="bg-emerald-600" />
                                            <PortalCard title="Choice Selection Page" path="/campaign/school-comparison" icon={GraduationCap} color="bg-orange-500" />
                                            <PortalCard title="New School Signup" path="/register-new-signup" icon={PlusCircle} color="bg-emerald-600" />
                                            <PortalCard title="Shared Results Directory" path="/forms/results" icon={Activity} color="bg-primary" />
                                        </>
                                    )}
                                </div>
                            </section>
                        )}

                        {filteredSurveys.length > 0 && (
                            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <SectionHeader title="Intelligent Surveys" badge={filteredSurveys.length} icon={ClipboardList} />
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {filteredSurveys.map(s => (
                                        <PortalCard 
                                            key={s.id} 
                                            title={s.title} 
                                            school={s.entityName || 'SmartSapp'} 
                                            path={`/surveys/${s.slug}`} 
                                            icon={ClipboardList} 
                                            color="bg-blue-500" 
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        {filteredPdfs.length > 0 && (
 <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <SectionHeader title="Doc Signing Portals" badge={filteredPdfs.length} icon={FileText} />
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {filteredPdfs.map(p => (
                                        <PortalCard 
                                            key={p.id} 
                                            title={p.publicTitle || p.name} 
                                            school={p.entityName || 'SmartSapp'} 
                                            path={`/forms/${p.slug || p.id}`} 
                                            icon={FileText} 
                                            color="bg-orange-500" 
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        {filteredMeetings.length > 0 && (
 <section className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
                                <SectionHeader title="Meeting Session Rooms" badge={filteredMeetings.length} icon={Calendar} />
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {filteredMeetings.map(m => {
                                        const typeSlug = m.type?.slug || 'parent-engagement';
                                        return (
                                            <PortalCard 
                                                key={m.id} 
                                                title={m.type?.name || 'Session'} 
                                                school={m.entityName || undefined} 
                                                path={`/meetings/${typeSlug}/${m.entitySlug}`} 
                                                icon={Calendar} 
                                                color="bg-purple-500" 
                                            />
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {(searchTerm && filteredSurveys.length === 0 && filteredPdfs.length === 0 && filteredMeetings.length === 0) || 
                         (!isLoading && filteredSurveys.length === 0 && filteredPdfs.length === 0 && filteredMeetings.length === 0) ? (
 <div className="py-32 text-center border-4 border-dashed rounded-[4rem] bg-background flex flex-col items-center justify-center gap-4 opacity-40">
 <LayoutList className="h-16 w-16" />
 <p className="font-semibold text-lg">
                                    {searchTerm ? 'No portals matched your search' : `No active portals in the ${activeWorkspaceId} hub`}
                                </p>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
}