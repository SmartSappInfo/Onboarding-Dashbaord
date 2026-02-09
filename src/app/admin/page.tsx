
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, School, Calendar, Workflow } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { School as SchoolType, Meeting, UserProfile, OnboardingStage } from '@/lib/types';
import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useGlobalFilter } from '@/context/GlobalFilterProvider';

function StatCard({ title, value, icon: Icon, description, isLoading }: { title: string, value: string | number, icon: React.ElementType, description?: string, isLoading: boolean }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <>
                        <Skeleton className="h-8 w-1/4 mt-1" />
                        <Skeleton className="h-4 w-1/2 mt-2" />
                    </>
                ) : (
                    <>
                        <div className="text-3xl font-bold">{value}</div>
                        {description && <p className="text-xs text-muted-foreground">{description}</p>}
                    </>
                )}
            </CardContent>
        </Card>
    )
}


export default function AdminDashboardPage() {
    const firestore = useFirestore();
    const { assignedUserId, isLoading: isLoadingFilter } = useGlobalFilter();

    const schoolsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'schools') : null, [firestore]);
    const meetingsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'meetings'), orderBy('meetingTime', 'desc')) : null, [firestore]);
    const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
    const stagesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'onboardingStages'), orderBy('order')) : null, [firestore]);

    const { data: allSchools, isLoading: isLoadingSchools } = useCollection<SchoolType>(schoolsQuery);
    const { data: allMeetings, isLoading: isLoadingMeetings } = useCollection<Meeting>(meetingsQuery);
    const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);
    const { data: stages, isLoading: isLoadingStages } = useCollection<OnboardingStage>(stagesQuery);

    const isLoading = isLoadingSchools || isLoadingMeetings || isLoadingUsers || isLoadingStages || isLoadingFilter;

    const filteredSchools = React.useMemo(() => {
        if (!allSchools) return [];
        if (!assignedUserId) return allSchools;
        if (assignedUserId === 'unassigned') {
            return allSchools.filter(school => !school.assignedTo?.userId);
        }
        return allSchools.filter(school => school.assignedTo?.userId === assignedUserId);
    }, [allSchools, assignedUserId]);

    const filteredMeetings = React.useMemo(() => {
        if (!allMeetings || !filteredSchools) return [];
        if (!assignedUserId) return allMeetings;

        const filteredSchoolIds = new Set(filteredSchools.map(s => s.id));
        return allMeetings.filter(meeting => filteredSchoolIds.has(meeting.schoolId));
    }, [allMeetings, filteredSchools, assignedUserId]);

    const stats = React.useMemo(() => {
        const totalSchools = filteredSchools?.length ?? 0;

        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        const upcomingMeetings = filteredMeetings?.filter(m => {
            const meetingDate = new Date(m.meetingTime);
            return meetingDate > new Date() && meetingDate <= sevenDaysFromNow;
        }).length ?? 0;

        const activeAdmins = users?.filter(u => u.isAuthorized).length ?? 0;

        return { totalSchools, upcomingMeetings, activeAdmins };
    }, [filteredSchools, filteredMeetings, users]);

    const pipelineStats = React.useMemo(() => {
        if (!stages || !filteredSchools) return [];
        return stages.map(stage => {
            const count = filteredSchools.filter(school => school.stage?.id === stage.id).length;
            return { name: stage.name, count };
        });
    }, [stages, filteredSchools]);


    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <StatCard
                    title="Total Schools"
                    value={stats.totalSchools}
                    icon={School}
                    isLoading={isLoading}
                />
                <StatCard
                    title="Upcoming Meetings"
                    value={stats.upcomingMeetings}
                    icon={Calendar}
                    description="in the next 7 days"
                    isLoading={isLoading}
                />
                <StatCard
                    title="Active Admins"
                    value={stats.activeAdmins}
                    icon={Users}
                    isLoading={isLoading}
                />
                <Card className="xl:col-span-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Onboarding Pipeline</CardTitle>
                        <Workflow className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-2 mt-1">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-2/3" />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {pipelineStats.length > 0 ? pipelineStats.map(stat => (
                                    <div key={stat.name} className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">{stat.name}</span>
                                        <span className="font-bold">{stat.count}</span>
                                    </div>
                                )) : <p className="text-xs text-muted-foreground text-center py-4">No pipeline stages found. Seed them in settings.</p>}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
