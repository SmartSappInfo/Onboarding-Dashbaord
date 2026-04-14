import { adminDb } from './firebase-admin';
import { cache } from 'react';
import type { Workspace, DashboardLayout, OnboardingStage, Entity, WorkspaceEntity, Meeting, Survey, Task, Activity, MessageLog, Zone, UserProfile, Pipeline } from './types';
import { startOfToday, format, isAfter } from 'date-fns';

/**
 * Shared fetcher for the active workspace.
 */
export const getActiveWorkspace = cache(async (workspaceId: string): Promise<Workspace | null> => {
    const snap = await adminDb.collection('workspaces').doc(workspaceId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() } as Workspace;
});

/**
 * Shared fetcher for the dashboard layout.
 */
export const getDashboardLayout = cache(async (workspaceId: string): Promise<DashboardLayout | null> => {
    const docId = `workspace_${workspaceId}`;
    const snap = await adminDb.collection('dashboardLayouts').doc(docId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() } as unknown as DashboardLayout;
});

/**
 * Shared fetcher for workspace entities.
 */
export const getWorkspaceEntities = cache(async (workspaceId: string) => {
    const snap = await adminDb.collection('workspace_entities')
        .where('workspaceId', '==', workspaceId)
        .where('status', '!=', 'archived')
        .get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkspaceEntity));
});

/**
 * Shared fetcher for onboarding stages.
 */
export const getOnboardingStages = cache(async () => {
    const snap = await adminDb.collection('onboardingStages').orderBy('order').get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as OnboardingStage));
});

/**
 * Fetch stats for the metrics widgets.
 */
export const getMetricStats = async (workspaceId: string) => {
    const entities = await getWorkspaceEntities(workspaceId);
    const totalStudents = entities.reduce((sum, we) => sum + (we.nominalRoll || 0), 0);
    
    // For meetings and surveys, we do separate quick counts
    const meetingsSnap = await adminDb.collection('meetings')
        .where('workspaceIds', 'array-contains', workspaceId)
        .get();
    
    const surveysSnap = await adminDb.collection('surveys')
        .where('workspaceIds', 'array-contains', workspaceId)
        .where('status', '==', 'published')
        .get();

    return {
        totalEntities: entities.length,
        totalStudents,
        upcomingMeetings: meetingsSnap.size, // This is a rough count, filtering by date usually happens in logic
        publishedSurveys: surveysSnap.size,
    };
};

/**
 * Fetch data for the pipeline chart.
 */
export const getPipelineStats = async (workspaceId: string) => {
    const [entities, stages] = await Promise.all([
        getWorkspaceEntities(workspaceId),
        getOnboardingStages(),
    ]);

    const aggregatedStages: Record<string, { count: number; students: number; color: string; order: number }> = {};
    
    stages.forEach((stage) => {
        const entitiesInStage = entities.filter((we) => we.stageId === stage.id);
        const count = entitiesInStage.length;
        const studentCount = entitiesInStage.reduce((sum, we) => sum + (we.nominalRoll || 0), 0);
        
        const key = stage.name;
        if (!aggregatedStages[key]) {
            aggregatedStages[key] = {
                count: count,
                students: studentCount,
                color: stage.color || '#cccccc',
                order: stage.order
            };
        } else {
            aggregatedStages[key].count += count;
            aggregatedStages[key].students += studentCount;
            if (stage.order < aggregatedStages[key].order) {
                aggregatedStages[key].order = stage.order;
                aggregatedStages[key].color = stage.color || aggregatedStages[key].color;
            }
        }
    });

    return Object.entries(aggregatedStages)
        .map(([name, data]) => ({
            name,
            count: data.count,
            students: data.students,
            color: data.color,
            order: data.order
        }))
        .sort((a, b) => a.order - b.order);
};

/**
 * Fetch upcoming meetings for the meetings widget.
 */
export const getUpcomingMeetings = async (workspaceId: string) => {
    const now = startOfToday();
    const snap = await adminDb.collection('meetings')
        .where('workspaceIds', 'array-contains', workspaceId)
        .orderBy('meetingTime', 'desc')
        .limit(20) // Get recent/future meetings
        .get();

    return snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Meeting))
        .filter(m => m.meetingTime && isAfter(new Date(m.meetingTime), now))
        .sort((a, b) => new Date(a.meetingTime).getTime() - new Date(b.meetingTime).getTime())
        .slice(0, 5)
        .map(meeting => ({
            ...meeting,
            date: format(new Date(meeting.meetingTime), 'MMM dd, yyyy'),
            status: 'Upcoming',
        }));
};

/**
 * Fetch latest surveys.
 */
export const getLatestSurveys = async (workspaceId: string) => {
    const snap = await adminDb.collection('surveys')
        .where('workspaceIds', 'array-contains', workspaceId)
        .orderBy('createdAt', 'desc')
        .limit(3)
        .get();

    return snap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        responseCount: 0
    } as unknown as Survey));
};

/**
 * Fetch monthly registration trends.
 */
export const getMonthlyTrend = async (workspaceId: string) => {
    const entities = await getWorkspaceEntities(workspaceId);
    const monthlyTrends: Record<string, number> = {};
    
    entities.forEach((we: any) => {
        if (!we.addedAt && !we.createdAt) return;
        const date = new Date(we.addedAt || we.createdAt);
        const month = format(date, 'MMM');
        monthlyTrends[month] = (monthlyTrends[month] || 0) + 1;
    });

    return [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ].map(month => ({
        name: month,
        total: monthlyTrends[month] || 0
    }));
};

/**
 * Fetch workspace pipelines.
 */
export const getWorkspacePipelines = async (workspaceId: string) => {
    const snap = await adminDb.collection('pipelines')
        .where('workspaceIds', 'array-contains', workspaceId)
        .orderBy('createdAt', 'desc')
        .get();

    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pipeline));
};

/**
 * Fetch module implementation footprint.
 */
export const getModuleFootprint = async (workspaceId: string) => {
    const entities = await getWorkspaceEntities(workspaceId);
    const moduleCounts: Record<string, { abbreviation: string; name: string; count: number }> = {};
    
    entities.forEach((we: any) => {
        we.modules?.forEach((m: { id: string; name: string; abbreviation: string }) => {
            if (!moduleCounts[m.id]) {
                moduleCounts[m.id] = { name: m.name, abbreviation: m.abbreviation, count: 0 };
            }
            moduleCounts[m.id].count++;
        });
    });
    
    return Object.values(moduleCounts);
};

/**
 * Fetch zone distribution metrics.
 */
export const getZoneDistribution = async (workspaceId: string) => {
    const snap = await adminDb.collection('zones').get();
    const zones = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Zone));
    const entities = await getWorkspaceEntities(workspaceId);
    
    return zones.map((zone: Zone) => {
        const entitiesInZone = entities.filter((we: any) => we.zone?.id === zone.id);
        const totalCount = entitiesInZone.length;
        const studentCount = entitiesInZone.reduce((sum: number, we: any) => sum + (we.nominalRoll || 0), 0);
        
        return {
          name: zone.name,
          schoolCount: totalCount,
          studentCount: studentCount
        };
    }).filter((zd: any) => zd.schoolCount > 0);
};

/**
 * Fetch authorized users.
 */
export const getAuthorizedUsers = cache(async () => {
    const snap = await adminDb.collection('users')
        .where('isAuthorized', '==', true)
        .get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
});

/**
 * Fetch user assignments.
 */
export const getUserAssignments = async (workspaceId: string) => {
    const [entities, users] = await Promise.all([
        getWorkspaceEntities(workspaceId),
        getAuthorizedUsers()
    ]);

    const totalEntities = entities.length;

    return users.map((user: UserProfile) => {
        const assignedEntities = entities.filter((we: any) => we.assignedTo?.userId === user.id);
        const totalAssigned = assignedEntities.length;
        const totalStudentsAssigned = assignedEntities.reduce((acc: number, we: any) => acc + (we.nominalRoll || 0), 0);

        return {
            user,
            totalAssigned,
            totalStudents: totalStudentsAssigned,
            assignmentPercentage: totalEntities > 0 ? (totalAssigned / totalEntities) * 100 : 0,
        };
    }).filter((ua: any) => ua.totalAssigned > 0);
};

/**
 * Fetch messaging metrics.
 */
export const getMessagingMetrics = async (workspaceId: string) => {
    const snap = await adminDb.collection('message_logs')
        .where('workspaceIds', 'array-contains', workspaceId)
        .orderBy('sentAt', 'desc')
        .limit(100)
        .get();
    
    const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MessageLog));
    const emailLogs = logs.filter(l => l.channel === 'email');
    const smsLogs = logs.filter(l => l.channel === 'sms');
    
    const emailSuccess = emailLogs.length > 0 ? (emailLogs.filter(l => l.status === 'sent').length / emailLogs.length) * 100 : 100;
    const smsSuccess = smsLogs.length > 0 ? (smsLogs.filter(l => l.status === 'sent').length / smsLogs.length) * 100 : 100;

    return {
        emailSuccess: Math.round(emailSuccess),
        smsSuccess: Math.round(smsSuccess),
        recentLogs: logs.slice(0, 5)
    };
};

/**
 * Fetch recent activities.
 */
export const getRecentActivities = async (workspaceId: string) => {
    const snap = await adminDb.collection('activities')
        .where('workspaceId', '==', workspaceId)
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();
    
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
};

// Add other fetchers as needed...
