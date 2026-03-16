'use client';

import { collection, query, where, getDocs, orderBy, limit, type Firestore } from 'firebase/firestore';
import type { School, Meeting, Survey, OnboardingStage, UserProfile, Module, Activity, Zone, MessageLog, Task } from '@/lib/types';
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
 * Optimized for Multi-Workspace Sharing logic using array-contains filters.
 */
export async function getDashboardData(db: Firestore, workspaceId: string = 'onboarding') {
  // 1. Fetch Master Data
  // We filter Schools by the new workspaceIds array. 
  // Tasks and Activities are already bound to a single workspaceId.
  const [
    schoolsSnapshot,
    meetingsSnapshot,
    surveysSnapshot,
    stagesSnapshot,
    usersSnapshot,
    modulesSnapshot,
    activitiesSnapshot,
    zonesSnapshot,
    logsSnapshot,
    tasksSnapshot
  ] = await Promise.all([
    safeGetDocs(query(collection(db, 'schools'), where('workspaceIds', 'array-contains', workspaceId))),
    safeGetDocs(collection(db, 'meetings')), 
    safeGetDocs(collection(db, 'surveys')),
    safeGetDocs(query(collection(db, 'onboardingStages'), orderBy('order'))),
    safeGetDocs(query(collection(db, 'users'), where('isAuthorized', '==', true))),
    safeGetDocs(query(collection(db, 'modules'))),
    safeGetDocs(query(collection(db, 'activities'), where('workspaceId', '==', workspaceId), orderBy('timestamp', 'desc'), limit(50))),
    safeGetDocs(collection(db, 'zones')),
    safeGetDocs(query(collection(db, 'message_logs'), orderBy('sentAt', 'desc'), limit(500))),
    safeGetDocs(query(collection(db, 'tasks'), where('workspaceId', '==', workspaceId))),
  ]); 

  // 2. Data Resolution
  const schools = schoolsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as School));
  const tasks = tasksSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Task));
  const activities = activitiesSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Activity));
  const zones = zonesSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Zone));
  const logs = logsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as MessageLog));
  
  const now = startOfToday();
  const totalSchools = schools.length;
  const totalStudents = schools.reduce((sum, school) => sum + (school.nominalRoll || 0), 0);
  
  // 3. Resolve Workspace-Authorized IDs for cross-referencing
  const filteredSchoolIds = new Set(schools.map(s => s.id));

  // 4. Meeting Intelligence (Filtered by Workspace Schools)
  const upcomingMeetings = meetingsSnapshot.docs
    .map((doc: any) => ({ id: doc.id, ...doc.data() } as Meeting))
    .filter(m => filteredSchoolIds.has(m.schoolId) && m.meetingTime && isAfter(new Date(m.meetingTime), now))
    .sort((a, b) => new Date(a.meetingTime).getTime() - new Date(b.meetingTime).getTime())
    .slice(0, 5)
    .map(meeting => ({
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
    .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
    })
    .slice(0, 3);

  // 5. Workflow Architecture
  const stages = stagesSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as OnboardingStage));
  const pipelineCounts = stages.map(stage => {
    const schoolsInStage = schools.filter(school => school.stage?.id === stage.id);
    const schoolCount = schoolsInStage.length;
    const studentCount = schoolsInStage.reduce((sum, school) => sum + (school.nominalRoll || 0), 0);
    return {
      name: stage.name,
      count: schoolCount,
      students: studentCount,
      color: stage.color || '#cccccc'
    };
  });

  // 6. User Load Balancing
  const users = usersSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as UserProfile));
  const userAssignments = users.map(user => {
      const assignedSchools = schools.filter(s => s.assignedTo?.userId === user.id);
      const totalAssigned = assignedSchools.length;
      const totalStudents = assignedSchools.reduce((acc, school) => acc + (school.nominalRoll || 0), 0);

      return {
          user,
          totalAssigned,
          totalStudents,
          assignmentPercentage: totalSchools > 0 ? (totalAssigned / totalSchools) * 100 : 0,
      };
  });
  
  const unassignedSchools = schools.filter(s => !s.assignedTo?.userId);
  const totalUnassigned = unassignedSchools.length;
  if (totalUnassigned > 0) {
      const unassignedStudents = unassignedSchools.reduce((acc, school) => acc + (school.nominalRoll || 0), 0);
      userAssignments.push({
          user: { id: 'unassigned', name: 'Unassigned' } as any,
          totalAssigned: totalUnassigned,
          totalStudents: unassignedStudents,
          assignmentPercentage: totalSchools > 0 ? (totalUnassigned / totalSchools) * 100 : 0,
      });
  }

  // 7. Time-Series Trends
  const monthlySchools = schools.reduce((acc, school) => {
    if (school.implementationDate) {
        try {
            const date = new Date(school.implementationDate);
            if (!isNaN(date.getTime())) {
                const month = format(date, 'MMM');
                acc[month] = (acc[month] || 0) + 1;
            }
        } catch (e) {}
    }
    return acc;
  }, {} as Record<string, number>);

  const monthlySchoolsData = Object.entries(monthlySchools).map(([name, total]) => ({ name, total }));
  
  const allModules = modulesSnapshot.docs.map((doc: any) => doc.data() as Module);
  const moduleNameMap = new Map(allModules.map(m => [m.abbreviation, m.name]));
  
  const moduleCounts: Record<string, { abbreviation: string, name: string, count: number }> = {};
  schools.forEach(school => {
      school.modules?.forEach(module => {
          if (!moduleCounts[module.abbreviation]) {
              moduleCounts[module.abbreviation] = {
                  abbreviation: module.abbreviation,
                  name: moduleNameMap.get(module.abbreviation) || module.name,
                  count: 0,
              };
          }
          moduleCounts[module.abbreviation].count++;
      });
  });
  const moduleImplementationData = Object.values(moduleCounts);

  const zoneDistribution = zones.map(zone => {
    const schoolsInZone = schools.filter(s => s.zone?.id === zone.id);
    return {
      name: zone.name,
      schoolCount: schoolsInZone.length,
      studentCount: schoolsInZone.reduce((sum, s) => sum + (s.nominalRoll || 0), 0)
    };
  });

  // 8. Workspace-Bound Messaging Analytics
  // Only include logs for schools visible in the current workspace
  const workspaceLogs = logs.filter(l => !l.schoolId || filteredSchoolIds.has(l.schoolId));
  const emailLogs = workspaceLogs.filter(l => l.channel === 'email');
  const smsLogs = workspaceLogs.filter(l => l.channel === 'sms');
  const emailSuccess = emailLogs.length > 0 ? (emailLogs.filter(l => l.status === 'sent').length / emailLogs.length) * 100 : 100;
  const smsSuccess = smsLogs.length > 0 ? (smsLogs.filter(l => l.status === 'sent').length / smsLogs.length) * 100 : 100;

  const messagingMetrics = {
    emailSuccess: Math.round(emailSuccess),
    smsSuccess: Math.round(smsSuccess),
    recentLogs: workspaceLogs.slice(0, 5)
  };

  // 9. Task Force Efficiency
  const taskPerformance = {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'done').length,
      overdue: tasks.filter(t => t.status !== 'done' && isAfter(new Date(), new Date(t.dueDate))).length
  };
  
  return {
    metrics,
    latestSurveys,
    upcomingMeetings,
    pipelineCounts,
    userAssignments,
    monthlySchools: monthlySchoolsData,
    moduleImplementations: moduleImplementationData,
    activities,
    allUsers: users,
    allSchools: schools,
    zoneDistribution,
    messagingMetrics,
    taskPerformance
  };
}
