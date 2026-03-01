'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { School, FocalPerson } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    ArrowLeft, 
    Calendar, 
    Globe, 
    Mail, 
    MapPin, 
    Phone, 
    Users, 
    PenSquare, 
    Workflow, 
    User, 
    Send,
    ShieldCheck,
    MessageSquarePlus,
    Activity,
    UserCheck,
    Contact
} from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const ActivityTimeline = dynamic(() => import('../../components/ActivityTimeline'), {
    loading: () => <div className="p-8 space-y-4"><Skeleton className="h-4 w-32"/><Skeleton className="h-20 w-full"/><Skeleton className="h-20 w-full"/></div>,
});

const LogActivityModal = dynamic(() => import('../components/LogActivityModal'), { ssr: false });

const getStatusBadgeVariant = (status: School['status']) => {
    switch (status) {
        case 'Active': return 'default';
        case 'Inactive': return 'secondary';
        case 'Archived': return 'outline';
        default: return 'secondary';
    }
}

const getInitials = (name?: string | null) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '?';

export default function SchoolDetailPage() {
    const params = useParams();
    const router = useRouter();
    const schoolId = params.id as string;
    const firestore = useFirestore();
    const [isLogModalOpen, setIsLogModalOpen] = React.useState(false);

    const schoolDocRef = useMemoFirebase(() => {
        if (!firestore || !schoolId) return null;
        return doc(firestore, 'schools', schoolId);
    }, [firestore, schoolId]);

    const { data: school, isLoading } = useDoc<School>(schoolDocRef);

    if (isLoading) return <div className="p-8 space-y-8"><Skeleton className="h-48 w-full rounded-[2.5rem]"/><Skeleton className="h-96 w-full rounded-[2.5rem]"/></div>;
    if (!school) return <div className="flex flex-col items-center justify-center py-20 text-center space-y-4"><h2 className="text-xl font-bold">School Not Found</h2><Button variant="outline" onClick={() => router.push('/admin/schools')}>Back to List</Button></div>;

    const DetailItem = ({ icon: Icon, label, value, href, children }: { icon: any, label: string, value?: any, href?: string, children?: any }) => (
        <div className="flex items-start gap-4">
            <div className="p-2 bg-muted rounded-lg shrink-0 mt-0.5 border border-border/50"><Icon className="h-4 w-4 text-muted-foreground" /></div>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1.5">{label}</p>
                {href ? <a href={href} className="text-base font-bold text-foreground hover:text-primary truncate block underline-offset-4 hover:underline">{String(value)}</a> : value && <p className="text-base font-bold text-foreground leading-tight">{String(value)}</p>}
                {children}
            </div>
        </div>
    );

    return (
        <div className="h-full overflow-y-auto bg-muted/10 pb-32">
            <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <Button variant="ghost" className="-ml-2 text-muted-foreground hover:text-foreground font-bold" onClick={() => router.push('/admin/schools')}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Schools</Button>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="rounded-xl font-bold h-10 px-4" onClick={() => setIsLogModalOpen(true)}><MessageSquarePlus className="mr-2 h-4 w-4 text-primary" /> Log Interaction</Button>
                        <Button className="rounded-xl font-black shadow-lg h-10 px-6" onClick={() => router.push(`/admin/schools/${school.id}/edit`)}><PenSquare className="mr-2 h-4 w-4" /> Edit Profile</Button>
                    </div>
                </div>

                <Card className="border-none shadow-2xl overflow-hidden bg-white rounded-[2.5rem]">
                    <div className="h-48 bg-slate-900 relative">
                        {school.heroImageUrl && <Image src={school.heroImageUrl} alt="banner" fill className="object-cover opacity-40 grayscale group-hover:grayscale-0 transition-all duration-700" />}
                        <div className="absolute bottom-6 right-8 flex gap-3">
                             <Badge variant={getStatusBadgeVariant(school.status)} className="h-10 px-6 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-2xl border-none ring-4 ring-white/10 backdrop-blur-md">{school.status}</Badge>
                             <Badge className="h-10 px-6 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-2xl border-none text-white ring-4 ring-white/10 backdrop-blur-md" style={{ backgroundColor: school.stage?.color || '#3B5FFF' }}>{school.stage?.name || 'Welcome'}</Badge>
                        </div>
                    </div>
                    <CardContent className="px-8 pb-10 -mt-16 relative z-10 flex flex-col md:flex-row items-end md:items-center gap-8">
                        <div className="relative h-44 w-44 rounded-[3rem] bg-white p-3 shadow-2xl ring-8 ring-white overflow-hidden border border-border/50 shrink-0">
                            {school.logoUrl ? <Image src={school.logoUrl} alt={school.name} fill className="object-contain p-6" /> : <div className="h-full w-full flex items-center justify-center bg-primary/5 text-primary text-5xl font-black">{school.initials || school.name.substring(0, 2)}</div>}
                        </div>
                        <div className="flex-1 space-y-2 pt-4">
                            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground leading-tight">{school.name}</h1>
                            <div className="flex items-center gap-3">
                                <Badge variant="outline" className="font-black border-2 text-primary border-primary/20 bg-primary/5">{school.initials}</Badge>
                                <Separator orientation="vertical" className="h-4" />
                                <span className="text-muted-foreground font-bold flex items-center gap-1.5 text-sm uppercase tracking-widest"><MapPin className="h-3.5 w-3.5" /> {school.zone?.name}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <Card className="lg:col-span-2 border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                        <CardHeader className="border-b bg-muted/10 pb-5 px-8 pt-8">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Contact className="h-4 w-4" /> Staff Focal Directory</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-border/50">
                                {school.focalPersons && school.focalPersons.length > 0 ? (
                                    school.focalPersons.map((person, idx) => (
                                        <div key={idx} className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group hover:bg-muted/5 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center font-black text-primary border shadow-sm group-hover:bg-primary group-hover:text-white transition-colors">{getInitials(person.name)}</div>
                                                <div>
                                                    <p className="font-black text-base">{person.name}</p>
                                                    <Badge variant="outline" className="mt-1 text-[8px] font-black uppercase tracking-tighter h-5">{person.type}</Badge>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 w-full sm:w-auto">
                                                <Button variant="outline" size="sm" asChild className="h-9 rounded-xl flex-1 sm:flex-none border-border/50"><a href={`mailto:${person.email}`}><Mail className="h-3.5 w-3.5 mr-2" /> Email</a></Button>
                                                <Button variant="outline" size="sm" asChild className="h-9 rounded-xl flex-1 sm:flex-none border-border/50"><a href={`tel:${person.phone}`}><Phone className="h-3.5 w-3.5 mr-2" /> Call</a></Button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-12 text-center text-muted-foreground font-medium italic">No staff directory initialized for this campus.</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                        <CardHeader className="border-b bg-muted/10 pb-5 px-8 pt-8">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Account Metrics</CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            <div className="flex items-center justify-between p-5 rounded-[1.5rem] bg-primary/5 border border-primary/10 shadow-inner">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase text-primary/60 tracking-widest">Active Roll</p>
                                    <p className="text-3xl font-black tabular-nums tracking-tighter text-primary">{school.nominalRoll?.toLocaleString() || '0'}</p>
                                </div>
                                <div className="p-3 bg-white rounded-2xl shadow-sm border border-primary/10"><Users className="h-6 w-6 text-primary" /></div>
                            </div>
                            <div className="space-y-6">
                                <DetailItem icon={ShieldCheck} label="Account Manager" value={school.assignedTo?.name || 'Unassigned'} />
                                <DetailItem icon={Calendar} label="Implementation Date" value={school.implementationDate ? format(new Date(school.implementationDate), 'PPP') : 'Pending'} />
                                <Separator />
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Activated Modules</p>
                                    <div className="flex flex-wrap gap-2">{school.modules?.map(m => <Badge key={m.id} style={{backgroundColor: m.color}} className="text-white border-none font-bold text-[9px] uppercase">{m.abbreviation}</Badge>)}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="bg-card rounded-[2.5rem] p-6 sm:p-10 shadow-sm ring-1 ring-border min-h-[400px]">
                    <div className="mb-10 flex items-center gap-3">
                        <div className="flex flex-col">
                            <Badge variant="outline" className="w-fit bg-background font-black text-[10px] uppercase tracking-widest px-3 py-1 border-primary/20 text-primary mb-1">Live Feed</Badge>
                            <h3 className="text-2xl font-black tracking-tight">Campus Audit Trail</h3>
                        </div>
                        <div className="h-px flex-1 bg-gradient-to-r from-primary/20 to-transparent" />
                    </div>
                    <ActivityTimeline schoolId={school.id} limit={20} />
                </div>
            </div>
            <LogActivityModal school={school} open={isLogModalOpen} onOpenChange={setIsLogModalOpen} />
        </div>
    );
}
