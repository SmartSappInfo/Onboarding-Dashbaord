'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { School } from '@/lib/types';
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
    MessageSquarePlus, 
    Send,
    History,
    ShieldCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';
import NotesSection from '../../components/NotesSection';
import LogActivityModal from '../components/LogActivityModal';
import { cn } from '@/lib/utils';

export default function SchoolDetailPage() {
    const params = useParams();
    const router = useRouter();
    const schoolId = params.id as string;
    const firestore = useFirestore();
    const { user } = useUser();
    const [isLogActivityModalOpen, setIsLogActivityModalOpen] = React.useState(false);

    const schoolDocRef = useMemoFirebase(() => {
        if (!firestore || !schoolId) return null;
        return doc(firestore, 'schools', schoolId);
    }, [firestore, schoolId]);

    const { data: school, isLoading } = useDoc<School>(schoolDocRef);

    if (isLoading) {
        return (
            <div className="p-4 sm:p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-48 w-full rounded-[2rem]" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
                    <Skeleton className="md:col-span-2 h-64 w-full rounded-2xl" />
                    <Skeleton className="h-64 w-full rounded-2xl" />
                </div>
            </div>
        );
    }

    if (!school) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-muted/50 rounded-full mb-4">
                    <History className="h-12 w-12 text-muted-foreground opacity-20" />
                </div>
                <h2 className="text-xl font-bold tracking-tight">School Record Not Found</h2>
                <p className="text-muted-foreground mt-2 max-w-xs mx-auto">The school you are looking for does not exist or has been archived.</p>
                <Button variant="outline" className="mt-8 rounded-xl font-bold" onClick={() => router.push('/admin/schools')}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
                </Button>
            </div>
        );
    }

    const DetailItem = ({ icon: Icon, label, value, children, href }: { 
        icon: React.ElementType, 
        label: string, 
        value?: string | number | null, 
        children?: React.ReactNode,
        href?: string
    }) => {
        if (!value && !children) return null;
        return (
            <div className="flex items-start gap-4">
                <div className="p-2 bg-muted rounded-lg shrink-0 mt-0.5 shadow-xs border border-border/50">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1.5">{label}</p>
                    {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-base font-bold text-foreground hover:text-primary transition-colors hover:underline block truncate">
                            {String(value)}
                        </a>
                    ) : value ? (
                        <p className="text-base font-bold text-foreground leading-tight">{String(value)}</p>
                    ) : null}
                    {children}
                </div>
            </div>
        );
    };

    return (
        <div className="h-full overflow-y-auto bg-muted/10">
            <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto space-y-8 pb-32">
                {/* Header Navigation */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <Button variant="ghost" className="-ml-2 text-muted-foreground hover:text-foreground font-bold" onClick={() => router.push('/admin/schools')}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Schools
                    </Button>
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <Button variant="outline" size="sm" className="rounded-xl font-bold shadow-sm h-10 px-4" onClick={() => setIsLogActivityModalOpen(true)}>
                            <MessageSquarePlus className="mr-2 h-4 w-4 text-primary" /> Log
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-xl font-bold shadow-sm h-10 px-4" asChild>
                            <Link href={`/admin/messaging/composer?recipient=${school.email || ''}&var_school_name=${encodeURIComponent(school.name)}&var_contact_name=${encodeURIComponent(school.contactPerson || '')}`}>
                                <Send className="mr-2 h-4 w-4 text-primary" /> Message
                            </Link>
                        </Button>
                        <Button className="rounded-xl font-black shadow-lg h-10 px-6" onClick={() => router.push(`/admin/schools/${school.id}/edit`)}>
                            <PenSquare className="mr-2 h-4 w-4" /> Edit Details
                        </Button>
                    </div>
                </div>

                {/* Identity Hero Card */}
                <Card className="border-none shadow-2xl overflow-hidden bg-white rounded-[2rem]">
                    <div className="h-40 bg-slate-900 relative">
                        {school.heroImageUrl ? (
                            <Image src={school.heroImageUrl} alt="banner" fill className="object-cover opacity-40 grayscale group-hover:grayscale-0 transition-all duration-700" />
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-primary to-purple-600 opacity-10" />
                        )}
                        <div className="absolute bottom-4 right-8">
                             <Badge 
                                className="h-10 px-6 text-xs font-black uppercase tracking-widest rounded-xl shadow-2xl border-none text-white ring-4 ring-white/10 backdrop-blur-md" 
                                style={{ backgroundColor: school.stage?.color || '#3B5FFF' }}
                            >
                                {school.stage?.name || 'Welcome'}
                            </Badge>
                        </div>
                    </div>
                    <CardContent className="px-8 pb-10 -mt-16 relative z-10">
                        <div className="flex flex-col md:flex-row items-end md:items-center gap-8">
                            <div className="relative h-40 w-40 rounded-[3rem] bg-white p-3 shadow-[0_20px_50px_rgba(0,0,0,0.15)] ring-8 ring-white overflow-hidden border border-border/50 shrink-0">
                                {school.logoUrl ? (
                                    <Image src={school.logoUrl} alt={school.name} fill className="object-contain p-6" />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center bg-primary/5 text-primary text-5xl font-black">
                                        {school.initials || school.name.substring(0, 2)}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 space-y-2 pt-4">
                                <div className="flex items-center gap-4 flex-wrap">
                                    <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground leading-none">{school.name}</h1>
                                    <Badge variant="outline" className="font-black border-2 px-3 py-1 rounded-lg text-primary border-primary/20 bg-primary/5">{school.initials}</Badge>
                                </div>
                                <p className="text-xl text-muted-foreground font-medium italic leading-relaxed max-w-2xl">{school.slogan || 'Empowering the next generation through digital innovation.'}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Information Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Contact & Personnel */}
                    <Card className="lg:col-span-2 border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                        <CardHeader className="border-b bg-muted/10 pb-5 px-8 pt-8">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                <Users className="h-4 w-4" /> Point of Contact & Campus Info
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/50">
                                <div className="p-8 space-y-8">
                                    <DetailItem icon={User} label="Primary Admin" value={school.contactPerson} />
                                    <DetailItem 
                                        icon={Mail} 
                                        label="Official Correspondence" 
                                        value={school.email} 
                                        href={school.email ? `mailto:${school.email}` : undefined} 
                                    />
                                    <DetailItem 
                                        icon={Phone} 
                                        label="Direct Phone Line" 
                                        value={school.phone} 
                                        href={school.phone ? `tel:${school.phone.replace(/[\s-()]/g, '')}` : undefined} 
                                    />
                                </div>
                                <div className="p-8 space-y-8">
                                    <DetailItem 
                                        icon={MapPin} 
                                        label="Physical Campus" 
                                        value={school.location} 
                                        href={school.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(school.name + ' ' + school.location)}` : undefined} 
                                    />
                                    <DetailItem icon={Globe} label="Referral Source" value={school.referee || 'Direct Registration'} />
                                    <DetailItem icon={ShieldCheck} label="Account Manager" value={school.assignedTo?.name || 'Unassigned'} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Operational Stats */}
                    <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                        <CardHeader className="border-b bg-muted/10 pb-5 px-8 pt-8">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                <Workflow className="h-4 w-4" /> Implementation Profile
                            </CardTitle>
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
                                <DetailItem icon={Calendar} label="Target Go-Live" value={school.implementationDate ? format(new Date(school.implementationDate), 'PPP') : 'Schedule Pending'} />
                                <Separator className="opacity-50" />
                                <div className="space-y-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Requested Modules</p>
                                    <div className="flex flex-wrap gap-2">
                                        {school.modules && school.modules.length > 0 ? (
                                            school.modules.map((module) => (
                                                <Badge key={module.id} style={{ backgroundColor: module.color, color: 'white' }} className="border-none px-3.5 py-1.5 font-bold text-[10px] uppercase shadow-md transition-transform hover:scale-105 active:scale-95">
                                                    {module.name}
                                                </Badge>
                                            ))
                                        ) : (
                                            <p className="text-xs text-muted-foreground font-medium italic px-1">Initial discovery in progress.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Timeline & Interactions Section */}
                <div className="pt-4">
                    <NotesSection schoolId={school.id} />
                </div>
            </div>

            <LogActivityModal school={school} open={isLogActivityModalOpen} onOpenChange={setIsLogActivityModalOpen} />
        </div>
    );
}
