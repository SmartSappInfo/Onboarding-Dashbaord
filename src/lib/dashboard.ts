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
 * STRICT PARTITIONING: All data is resolved relative to the activeWorkspaceId.
 */
export async function getDashboardData(db: Firestore, workspaceId: string) {
  // 1. Fetch Partitioned Data
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
    safeGetDocs(query(collection(db, 'meetings'), where('workspaceIds', 'array-contains', workspaceId))), 
    safeGetDocs(query(collection(db, 'surveys'), where('workspaceIds', 'array-contains', workspaceId))),
    safeGetDocs(query(collection(db, 'onboardingStages'), orderBy('order'))), 
    safeGetDocs(query(collection(db, 'users'), where('isAuthorized', '==', true))),
    safeGetDocs(collection(db, 'modules')),
    safeGetDocs(query(collection(db, 'activities'), where('workspaceId', '==', workspaceId), orderBy('timestamp', 'desc'), limit(50))),
    safeGetDocs(collection(db, 'zones')),
    safeGetDocs(query(collection(db, 'message_logs'), where('workspaceIds', 'array-contains', workspaceId), orderBy('sentAt', 'desc'), limit(500))),
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
  
  // 3. Meeting Intelligence
  const upcomingMeetings = meetingsSnapshot.docs
    .map((doc: any) => ({ id: doc.id, ...doc.data() } as Meeting))
    .filter(m => m.meetingTime && isAfter(new Date(m.meetingTime), now))
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

  // 4. Workflow Architecture - AGGREGATED BY NAME
  const stages = stagesSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as OnboardingStage));
  
  // Create logical buckets by name to handle duplicate stage names across multiple pipelines
  const aggregatedStages: Record<string, { count: number; students: number; color: string; order: number }> = {};
  
  stages.forEach(stage => {
      const schoolsInStage = schools.filter(school => school.stage?.id === stage.id);
      const schoolCount = schoolsInStage.length;
      const studentCount = schoolsInStage.reduce((sum, school) => sum + (school.nominalRoll || 0), 0);
      
      const key = stage.name;
      if (!aggregatedStages[key]) {
          aggregatedStages[key] = {
              count: schoolCount,
              students: studentCount,
              color: stage.color || '#cccccc',
              order: stage.order
          };
      } else {
          aggregatedStages[key].count += schoolCount;
          aggregatedStages[key].students += studentCount;
          if (stage.order < aggregatedStages[key].order) {
              aggregatedStages[key].order = stage.order;
              aggregatedStages[key].color = stage.color || aggregatedStages[key].color;
          }
      }
  });

  const pipelineCounts = Object.entries(aggregatedStages)
    .map(([name, data]) => ({
        name,
        count: data.count,
        students: data.students,
        color: data.color,
        order: data.order
    }))
    .sort((a, b) => a.order - b.order);

  // 5. User Assignments
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
  }).filter(ua => ua.totalAssigned > 0);
  
  // 6. Regional Distribution
  const zoneDistribution = zones.map(zone => {
    const schoolsInZone = schools.filter(s => s.zone?.id === zone.id);
    return {
      name: zone.name,
      schoolCount: schoolsInZone.length,
      studentCount: schoolsInZone.reduce((sum, s) => sum + (s.nominalRoll || 0), 0)
    };
  }).filter(zd => zd.schoolCount > 0);

  // 7. Module Implementations
  const moduleCounts: Record<string, { abbreviation: string; name: string; count: number }> = {};
  schools.forEach(school => {
      school.modules?.forEach(m => {
          if (!moduleCounts[m.id]) {
              moduleCounts[m.id] = { name: m.name, abbreviation: m.abbreviation, count: 0 };
          }
          moduleCounts[m.id].count++;
      });
  });
  const moduleImplementations = Object.values(moduleCounts);

  // 8. Messaging Metrics
  const emailLogs = logs.filter(l => l.channel === 'email');
  const smsLogs = logs.filter(l => l.channel === 'sms');
  const emailSuccess = emailLogs.length > 0 ? (emailLogs.filter(l => l.status === 'sent').length / emailLogs.length) * 100 : 100;
  const smsSuccess = smsLogs.length > 0 ? (smsLogs.filter(l => l.status === 'sent').length / smsLogs.length) * 100 : 100;

  const messagingMetrics = {
    emailSuccess: Math.round(emailSuccess),
    smsSuccess: Math.round(smsSuccess),
    recentLogs: logs.slice(0, 5)
  };

  return {
    metrics,
    latestSurveys,
    upcomingMeetings,
    pipelineCounts,
    userAssignments,
    activities,
    allUsers: users,
    allSchools: schools,
    zoneDistribution,
    messagingMetrics,
    moduleImplementations,
    monthlySchools: [] 
  };
}
