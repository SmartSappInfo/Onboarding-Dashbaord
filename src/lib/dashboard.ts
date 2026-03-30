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
    schoolsSnapshot,
    meetingsSnapshot,
    surveysSnapshot,
    stagesSnapshot,
    usersSnapshot,
    activitiesSnapshot,
    zonesSnapshot,
    logsSnapshot,
    tasksSnapshot
  ] = await Promise.all([
    // Query workspace_entities for migrated contacts (Requirement 6.1)
    safeGetDocs(query(collection(db, 'workspace_entities'), where('workspaceId', '==', workspaceId))),
    // Query legacy schools for backward compatibility
    safeGetDocs(query(collection(db, 'schools'), where('workspaceIds', 'array-contains', workspaceId))),
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
  const schools = schoolsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as School));
  const tasks = tasksSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Task));
  const activities = activitiesSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Activity));
  const zones = zonesSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Zone));
  const logs = logsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as MessageLog));
  
  const now = startOfToday();
  
  // Contact counts now use workspace_entities for migrated contacts + legacy schools (Requirement 6.1)
  const migratedContactsCount = workspaceEntities.filter((we: any) => we.status !== 'archived').length;
  const legacySchoolsCount = schools.filter((s: School) => 
    s.migrationStatus !== 'migrated' && s.status !== 'archived'
  ).length;
  const totalSchools = migratedContactsCount + legacySchoolsCount;
  
  // Calculate total students from both migrated and legacy contacts
  const migratedStudents = workspaceEntities.reduce((sum: number, we: any) => {
    // For migrated contacts, we need to look up the entity to get nominalRoll
    // For now, we'll use denormalized data if available
    return sum + (we.nominalRoll || 0);
  }, 0);
  const legacyStudents = schools
    .filter((s: School) => s.migrationStatus !== 'migrated')
    .reduce((sum: number, school: School) => sum + (school.nominalRoll || 0), 0);
  const totalStudents = migratedStudents + legacyStudents;
  
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
    totalSchools: totalSchools,
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

  // 4. Workflow Architecture - AGGREGATED BY NAME
  const stages = stagesSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as OnboardingStage));
  
  // Create logical buckets by name to handle duplicate stage names across multiple pipelines
  const aggregatedStages: Record<string, { count: number; students: number; color: string; order: number }> = {};
  
  // Count contacts in each stage from workspace_entities (migrated) and schools (legacy)
  stages.forEach((stage: OnboardingStage) => {
      // Count migrated contacts in this stage
      const migratedInStage = workspaceEntities.filter((we: any) => we.stageId === stage.id);
      const migratedCount = migratedInStage.length;
      const migratedStudentCount = migratedInStage.reduce((sum: number, we: any) => sum + (we.nominalRoll || 0), 0);
      
      // Count legacy schools in this stage
      const schoolsInStage = schools.filter((school: School) => 
        school.migrationStatus !== 'migrated' && school.stage?.id === stage.id
      );
      const schoolCount = schoolsInStage.length;
      const schoolStudentCount = schoolsInStage.reduce((sum: number, school: School) => sum + (school.nominalRoll || 0), 0);
      
      const totalCount = migratedCount + schoolCount;
      const totalStudentCount = migratedStudentCount + schoolStudentCount;
      
      const key = stage.name;
      if (!aggregatedStages[key]) {
          aggregatedStages[key] = {
              count: totalCount,
              students: totalStudentCount,
              color: stage.color || '#cccccc',
              order: stage.order
          };
      } else {
          aggregatedStages[key].count += totalCount;
          aggregatedStages[key].students += totalStudentCount;
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
      // Count assignments from both workspace_entities (migrated) and schools (legacy)
      const assignedMigrated = workspaceEntities.filter((we: any) => we.assignedTo?.userId === user.id);
      const assignedSchools = schools.filter((s: School) => 
        s.migrationStatus !== 'migrated' && s.assignedTo?.userId === user.id
      );
      
      const totalAssigned = assignedMigrated.length + assignedSchools.length;
      const migratedStudents = assignedMigrated.reduce((acc: number, we: any) => acc + (we.nominalRoll || 0), 0);
      const legacyStudents = assignedSchools.reduce((acc: number, school: School) => acc + (school.nominalRoll || 0), 0);
      const totalStudents = migratedStudents + legacyStudents;

      return {
          user,
          totalAssigned,
          totalStudents,
          assignmentPercentage: totalSchools > 0 ? (totalAssigned / totalSchools) * 100 : 0,
      };
  }).filter((ua: { totalAssigned: number }) => ua.totalAssigned > 0);
  
  // 6. Regional Distribution
  const zoneDistribution = zones.map((zone: Zone) => {
    // Count contacts in this zone from both workspace_entities and schools
    const migratedInZone = workspaceEntities.filter((we: any) => we.zone?.id === zone.id);
    const schoolsInZone = schools.filter((s: School) => 
      s.migrationStatus !== 'migrated' && s.zone?.id === zone.id
    );
    
    const totalCount = migratedInZone.length + schoolsInZone.length;
    const migratedStudents = migratedInZone.reduce((sum: number, we: any) => sum + (we.nominalRoll || 0), 0);
    const legacyStudents = schoolsInZone.reduce((sum: number, s: School) => sum + (s.nominalRoll || 0), 0);
    
    return {
      name: zone.name,
      schoolCount: totalCount,
      studentCount: migratedStudents + legacyStudents
    };
  }).filter((zd: { schoolCount: number }) => zd.schoolCount > 0);

  // 7. Module Implementations
  const moduleCounts: Record<string, { abbreviation: string; name: string; count: number }> = {};
  
  // Count modules from legacy schools only (migrated contacts store modules differently)
  schools
    .filter((s: School) => s.migrationStatus !== 'migrated')
    .forEach((school: School) => {
      school.modules?.forEach((m: { id: string; name: string; abbreviation: string }) => {
          if (!moduleCounts[m.id]) {
              moduleCounts[m.id] = { name: m.name, abbreviation: m.abbreviation, count: 0 };
          }
          moduleCounts[m.id].count++;
      });
    });
  const moduleImplementations = Object.values(moduleCounts);

  // 8. Messaging Metrics
  const emailLogs = logs.filter((l: MessageLog) => l.channel === 'email');
  const smsLogs = logs.filter((l: MessageLog) => l.channel === 'sms');
  const emailSuccess = emailLogs.length > 0 ? (emailLogs.filter((l: MessageLog) => l.status === 'sent').length / emailLogs.length) * 100 : 100;
  const smsSuccess = smsLogs.length > 0 ? (smsLogs.filter((l: MessageLog) => l.status === 'sent').length / smsLogs.length) * 100 : 100;

  const messagingMetrics = {
    emailSuccess: Math.round(emailSuccess),
    smsSuccess: Math.round(smsSuccess),
    recentLogs: logs.slice(0, 5)
  };

  /** 
   * Only users/entities referenced by the recent activity feed (limits payload size vs. full collections).
   * Activities now use entityId references (Requirement 6.2, 6.4)
   */
  const activityUserIds = new Set(
    activities
      .map((a: Activity) => a.userId)
      .filter((id: string | null | undefined): id is string => Boolean(id))
  );
  
  // Support both entityId (new) and schoolId (legacy) references in activities
  const activityEntityIds = new Set(
    activities
      .map((a: Activity) => a.entityId)
      .filter((id: string | null | undefined): id is string => Boolean(id))
  );
  const activitySchoolIds = new Set(
    activities
      .map((a: Activity) => a.schoolId)
      .filter((id: string | null | undefined): id is string => Boolean(id))
  );
  
  const recentActivityUsers = users.filter((u: UserProfile) => activityUserIds.has(u.id));
  
  // For activities with entityId, resolve from workspace_entities
  const recentActivityEntities = workspaceEntities.filter((we: any) => activityEntityIds.has(we.entityId));
  
  // For activities with schoolId (legacy), resolve from schools
  const recentActivitySchools = schools.filter((s: School) => activitySchoolIds.has(s.id));

  return {
    metrics,
    latestSurveys,
    upcomingMeetings,
    pipelineCounts,
    userAssignments,
    activities,
    recentActivityUsers,
    recentActivityEntities, // New: workspace_entities for migrated contacts
    recentActivitySchools, // Legacy: schools for backward compatibility
    zoneDistribution,
    messagingMetrics,
    moduleImplementations,
    monthlySchools: [] 
  };
}
