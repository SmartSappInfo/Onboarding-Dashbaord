'use client';

import * as React from 'react';
import ActivityTimeline from '../components/ActivityTimeline';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { collection, query, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { School, UserProfile, Activity, Zone } from '@/lib/types';
import { Filter, X, History, Building, User, Tag, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const ACTIVITY_TYPES: { value: Activity['type']; label: string }[] = [
    { value: 'note', label: 'Internal Notes' },
    { value: 'call', label: 'Phone Calls' },
    { value: 'visit', label: 'Campus Visits' },
    { value: 'email', label: 'Emails' },
    { value: 'school_created', label: 'School Onboarding' },
    { value: 'school_assigned', label: 'Ownership Changes' },
    { value: 'meeting_created', label: 'Meetings Scheduled' },
    { value: 'pipeline_stage_changed', label: 'Pipeline Progression' },
    { value: 'notification_sent', label: 'Messaging Events' },
    { value: 'pdf_form_submitted', label: 'Doc Submissions' },
    { value: 'pdf_status_changed', label: 'Doc Status' },
];

export default function ActivitiesClient() {
    const firestore = useFirestore();
    const [schoolId, setSchoolId] = React.useState<string | null>('all');
    const [userId, setUserId] = React.useState<string | null>('all');
    const [type, setType] = React.useState<string | null>('all');
    const [zoneId, setZoneId] = React.useState<string | null>('all');

    const schoolsCol = useMemoFirebase(() => firestore ? query(collection(firestore, 'schools'), orderBy('name')) : null, [firestore]);
    const usersCol = useMemoFirebase(() => firestore ? query(collection(firestore, 'users'), orderBy('name')) : null, [firestore]);
    const zonesCol = useMemoFirebase(() => firestore ? query(collection(firestore, 'zones'), orderBy('name')) : null, [firestore]);

    const { data: schools } = useCollection<School>(schoolsCol);
    const { data: users } = useCollection<UserProfile>(usersCol);
    const { data: zones } = useCollection<Zone>(zonesCol);

    const hasActiveFilters = schoolId !== 'all' || userId !== 'all' || type !== 'all' || zoneId !== 'all';

    const clearFilters = () => {
        setSchoolId('all');
        setUserId('all');
        setType('all');
        setZoneId('all');
    };

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
            <div className="max-w-5xl mx-auto space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-6">
                    <div className="flex justify-end shrink-0">
                        {hasActiveFilters && (
                            <Button variant="ghost" onClick={clearFilters} className="text-xs font-black uppercase tracking-widest gap-2 h-8 rounded-xl bg-primary/5 text-primary hover:bg-primary/10 transition-all">
                                <X className="h-3 w-3" /> Clear All Filters
                            </Button>
                        )}
                    </div>
                </div>

                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden bg-white">
                    <CardContent className="p-4 sm:p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 ml-1">
                                    <MapPin className="h-3 w-3" /> Geographic Zone
                                </Label>
                                <Select value={zoneId || 'all'} onValueChange={setZoneId}>
                                    <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold transition-all">
                                        <SelectValue placeholder="All Zones" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="all">All Zones</SelectItem>
                                        {zones?.map(z => (
                                            <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 ml-1">
                                    <Building className="h-3 w-3" /> School Context
                                </Label>
                                <Select value={schoolId || 'all'} onValueChange={setSchoolId}>
                                    <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold transition-all">
                                        <SelectValue placeholder="All Schools" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="all">All Schools</SelectItem>
                                        {schools?.filter(s => zoneId === 'all' || s.zone?.id === zoneId).map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 ml-1">
                                    <User className="h-3 w-3" /> Performed By
                                </Label>
                                <Select value={userId || 'all'} onValueChange={setUserId}>
                                    <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold transition-all">
                                        <SelectValue placeholder="All Members" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="all">All Team Members</SelectItem>
                                        {users?.map(u => (
                                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 ml-1">
                                    <Tag className="h-3 w-3" /> Event Category
                                </Label>
                                <Select value={type || 'all'} onValueChange={setType}>
                                    <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold transition-all">
                                        <SelectValue placeholder="All Categories" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="all">All Categories</SelectItem>
                                        {ACTIVITY_TYPES.map(t => (
                                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="bg-card rounded-[2rem] p-6 sm:p-10 shadow-sm ring-1 ring-border min-h-[600px]">
                    <div className="mb-8 flex items-center gap-3">
                        <Badge variant="outline" className="bg-background font-black text-[10px] uppercase tracking-widest px-3 py-1 border-primary/20 text-primary">Live Timeline</Badge>
                        <div className="h-px flex-1 bg-gradient-to-r from-primary/20 to-transparent" />
                    </div>
                    <ActivityTimeline 
                        schoolId={schoolId} 
                        userId={userId} 
                        type={type} 
                        zoneId={zoneId}
                    />
                </div>
            </div>
        </div>
    );
}
