'use client';

import { collection, query, where, getDocs, orderBy, limit, type Firestore } from 'firebase/firestore';
import type { School, Meeting, Survey, OnboardingStage, UserProfile, Activity, Zone, MessageLog, Task } from '@/lib/types';
import { format, isAfter, startOfToday } from 'date-fns';

/**
 * Resilient fetcher that returns an empty array if a collection is missing or restricted.
 */
async function safeGetDocs(q: any) {
    try {
        return await getDocs(q);
    } catch (e) {
        console.warn(`Dashboard: Skipping source due to error:`, e);
        return { docs: [], size: 0, empty: true } as any;
    }
}

/**
 * @fileOverview Intelligence Hub Data Aggregator.
 * STRICT PARTITIONING: All data is resolved relative to the activeWorkspaceId.
 * 
 * MIGRATION NOTE: Updated to use entityId references and workspace_entities collection
 * for contact counts while maintaining backward compatibility with legacy schools.
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
export async function getDashboardData(db: Firestore, workspaceId: string) {
  // 1. Fetch Partitioned Data
  const [
    workspaceEntitiesSnapshot,
    meetingsSnapshot,
    surveysSnapshot,
    stagesSnapshot,
    usersSnapshot,
    activitiesSnapshot,
    zonesSnapshot,
    logsSnapshot,
    tasksSnapshot
  ] = await Promise.all([
    // Query workspace_entities for unified contacts (Requirement 6.1)
    safeGetDocs(query(collection(db, 'workspace_entities'), where('workspaceId', '==', workspaceId))),
    safeGetDocs(query(collection(db, 'meetings'), where('workspaceIds', 'array-contains', workspaceId))), 
    safeGetDocs(query(collection(db, 'surveys'), where('workspaceIds', 'array-contains', workspaceId))),
    safeGetDocs(query(collection(db, 'onboardingStages'), orderBy('order'))), 
    safeGetDocs(query(collection(db, 'users'), where('isAuthorized', '==', true))),
    // Activities now use entityId references (Requirement 6.2)
    safeGetDocs(query(collection(db, 'activities'), where('workspaceId', '==', workspaceId), orderBy('timestamp', 'desc'), limit(50))),
    safeGetDocs(collection(db, 'zones')),
    safeGetDocs(query(collection(db, 'message_logs'), where('workspaceIds', 'array-contains', workspaceId), orderBy('sentAt', 'desc'), limit(120))),
    // Tasks now use entityId references (Requirement 6.3)
    safeGetDocs(query(collection(db, 'tasks'), where('workspaceId', '==', workspaceId))),
  ]); 

  // 2. Data Resolution
  const workspaceEntities = workspaceEntitiesSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as any));
  const tasks = tasksSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Task));
  const activities = activitiesSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Activity));
  const zones = zonesSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Zone));
  const logs = logsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as MessageLog));
  
  const now = startOfToday();
  
  // Unified Entity Counts (Phasing out legacy schools)
  const activeEntities = workspaceEntities.filter((we: any) => we.status !== 'archived');
  const totalEntities = activeEntities.length;
  
  // Calculate total secondary metric (e.g. Students/Nominal Roll) from workspace_entities
  const totalStudents = activeEntities.reduce((sum: number, we: any) => sum + (we.nominalRoll || 0), 0);
  
  // 3. Meeting Intelligence
  const upcomingMeetings = meetingsSnapshot.docs
    .map((doc: any) => ({ id: doc.id, ...doc.data() } as Meeting))
    .filter((m: Meeting) => m.meetingTime && isAfter(new Date(m.meetingTime), now))
    .sort((a: Meeting, b: Meeting) => new Date(a.meetingTime).getTime() - new Date(b.meetingTime).getTime())
    .slice(0, 5)
    .map((meeting: Meeting) => ({
      ...meeting,
      date: format(new Date(meeting.meetingTime), 'MMM dd, yyyy'),
      status: 'Upcoming',
    }));

  const publishedSurveysCount = surveysSnapshot.docs.filter((doc: any) => doc.data().status === 'published').length;
  
  const metrics = {
    totalEntities: totalEntities,
    totalSchools: totalEntities, // Alias for backward compatibility during migration
    totalStudents: totalStudents,
    upcomingMeetings: upcomingMeetings.length,
    publishedSurveys: publishedSurveysCount,
  };

  const latestSurveys = surveysSnapshot.docs
    .map((doc: any) => ({ id: doc.id, ...doc.data() } as Survey))
    .sort((a: Survey, b: Survey) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
    })
    .slice(0, 3);

  // 4. Workflow Architecture
  const stages = stagesSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as OnboardingStage));
  const aggregatedStages: Record<string, { count: number; students: number; color: string; order: number }> = {};
  
  stages.forEach((stage: OnboardingStage) => {
      const entitiesInStage = activeEntities.filter((we: any) => we.stageId === stage.id);
      const count = entitiesInStage.length;
      const studentCount = entitiesInStage.reduce((sum: number, we: any) => sum + (we.nominalRoll || 0), 0);
      
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

  const pipelineCounts = Object.entries(aggregatedStages)
    .map(([name, data]: [string, { count: number; students: number; color: string; order: number }]) => ({
        name,
        count: data.count,
        students: data.students,
        color: data.color,
        order: data.order
    }))
    .sort((a: { order: number }, b: { order: number }) => a.order - b.order);

  // 5. User Assignments
  const users = usersSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as UserProfile));
  const userAssignments = users.map((user: UserProfile) => {
      const assignedEntities = activeEntities.filter((we: any) => we.assignedTo?.userId === user.id);
      const totalAssigned = assignedEntities.length;
      const totalStudentsAssigned = assignedEntities.reduce((acc: number, we: any) => acc + (we.nominalRoll || 0), 0);

      return {
          user,
          totalAssigned,
          totalStudents: totalStudentsAssigned,
          assignmentPercentage: totalEntities > 0 ? (totalAssigned / totalEntities) * 100 : 0,
      };
  }).filter((ua: { totalAssigned: number }) => ua.totalAssigned > 0);
  
  // 6. Regional Distribution
  const zoneDistribution = zones.map((zone: Zone) => {
    const entitiesInZone = activeEntities.filter((we: any) => we.zone?.id === zone.id);
    const totalCount = entitiesInZone.length;
    const studentCount = entitiesInZone.reduce((sum: number, we: any) => sum + (we.nominalRoll || 0), 0);
    
    return {
      name: zone.name,
      schoolCount: totalCount,
      studentCount: studentCount
    };
  }).filter((zd: { schoolCount: number }) => zd.schoolCount > 0);

  // 7. Monthly Trends (New!)
  const monthlyTrends: Record<string, number> = {};
  activeEntities.forEach((we: any) => {
    if (!we.createdAt) return;
    const date = new Date(we.createdAt);
    const month = format(date, 'MMM');
    monthlyTrends[month] = (monthlyTrends[month] || 0) + 1;
  });

  const monthlyData = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ].map(month => ({
    name: month,
    total: monthlyTrends[month] || 0
  }));

  // 8. Module Implementations
  // Note: Migration of module storage for entities should be handled here
  const moduleCounts: Record<string, { abbreviation: string; name: string; count: number }> = {};
  activeEntities.forEach((we: any) => {
    we.modules?.forEach((m: { id: string; name: string; abbreviation: string }) => {
        if (!moduleCounts[m.id]) {
            moduleCounts[m.id] = { name: m.name, abbreviation: m.abbreviation, count: 0 };
        }
        moduleCounts[m.id].count++;
    });
  });
  const moduleImplementations = Object.values(moduleCounts);

  // 9. Messaging Metrics
  const emailLogs = logs.filter((l: MessageLog) => l.channel === 'email');
  const smsLogs = logs.filter((l: MessageLog) => l.channel === 'sms');
  const emailSuccess = emailLogs.length > 0 ? (emailLogs.filter((l: MessageLog) => l.status === 'sent').length / emailLogs.length) * 100 : 100;
  const smsSuccess = smsLogs.length > 0 ? (smsLogs.filter((l: MessageLog) => l.status === 'sent').length / smsLogs.length) * 100 : 100;

  const messagingMetrics = {
    emailSuccess: Math.round(emailSuccess),
    smsSuccess: Math.round(smsSuccess),
    recentLogs: logs.slice(0, 5)
  };

  const activityUserIds = new Set(
    activities
      .map((a: Activity) => a.userId)
      .filter((id: string | null | undefined): id is string => Boolean(id))
  );
  
  const activityEntityIds = new Set(
    activities
      .map((a: Activity) => a.entityId)
      .filter((id: string | null | undefined): id is string => Boolean(id))
  );
  
  const recentActivityUsers = users.filter((u: UserProfile) => activityUserIds.has(u.id));
  const recentActivityEntities = activeEntities.filter((we: any) => activityEntityIds.has(we.entityId));

  return {
    metrics,
    latestSurveys,
    upcomingMeetings,
    pipelineCounts,
    pipelinesByPipeline: buildPerPipelineData(stages, activeEntities, []), // Legacy schools array empty now
    userAssignments,
    activities,
    recentActivityUsers,
    recentActivityEntities, 
    recentActivitySchools: [], // Legcay schools cleared
    zoneDistribution,
    messagingMetrics,
    moduleImplementations,
    monthlySchools: monthlyData 
  };
}

/**
 * Builds per-pipeline stage distribution data for individual pipeline dashboard widgets.
 * Returns a map: pipelineId → array of { name, count, students, color }
 */
function buildPerPipelineData(
  stages: OnboardingStage[],
  workspaceEntities: any[],
  schools: School[]
): Record<string, { name: string; count: number; students: number; color: string }[]> {
  const result: Record<string, { name: string; count: number; students: number; color: string }[]> = {};

  // Group stages by pipeline
  const stagesByPipeline: Record<string, OnboardingStage[]> = {};
  stages.forEach(stage => {
    if (!stage.pipelineId) return;
    if (!stagesByPipeline[stage.pipelineId]) stagesByPipeline[stage.pipelineId] = [];
    stagesByPipeline[stage.pipelineId].push(stage);
  });

  // For each pipeline, compute per-stage counts
  for (const [pipelineId, pipelineStages] of Object.entries(stagesByPipeline)) {
    const sortedStages = pipelineStages.sort((a, b) => a.order - b.order);

    result[pipelineId] = sortedStages.map(stage => {
      const migratedInStage = workspaceEntities.filter((we: any) => we.stageId === stage.id);
      const migratedCount = migratedInStage.length;
      const migratedStudents = migratedInStage.reduce((sum: number, we: any) => sum + (we.nominalRoll || 0), 0);

      const schoolsInStage = schools.filter(
        (s: School) => s.migrationStatus !== 'migrated' && s.stage?.id === stage.id
      );
      const schoolCount = schoolsInStage.length;
      const schoolStudents = schoolsInStage.reduce((sum: number, s: School) => sum + (s.nominalRoll || 0), 0);

      return {
        name: stage.name,
        count: migratedCount + schoolCount,
        students: migratedStudents + schoolStudents,
        color: stage.color || '#cccccc',
      };
    });
  }

  return result;
}
