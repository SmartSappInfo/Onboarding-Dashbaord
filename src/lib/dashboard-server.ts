import { adminDb } from './firebase-admin';
import { cache } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase-admin/firestore';
import type { Workspace, DashboardLayout, OnboardingStage, Entity, WorkspaceEntity, Meeting, Survey, Task, Activity, MessageLog, Zone, UserProfile } from './types';
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
    return { id: snap.id, ...snap.data() } as DashboardLayout;
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
