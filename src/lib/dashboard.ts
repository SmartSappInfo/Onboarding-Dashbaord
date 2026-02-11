
import { collection, query, where, getDocs, orderBy, limit, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { School, Meeting, Survey, OnboardingStage, UserProfile, Module } from '@/lib/types';
import { format, isAfter, startOfToday } from 'date-fns';

function getDb() {
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
  return getFirestore(getApp());
}

export async function getDashboardData() {
  const db = getDb();

  const [
    schoolsSnapshot,
    meetingsSnapshot,
    surveysSnapshot,
    stagesSnapshot,
    usersSnapshot,
    modulesSnapshot,
  ] = await Promise.all([
    getDocs(collection(db, 'schools')),
    getDocs(collection(db, 'meetings')),
    getDocs(collection(db, 'surveys')),
    getDocs(query(collection(db, 'onboardingStages'), orderBy('order'))),
    getDocs(query(collection(db, 'users'), where('isAuthorized', '==', true))),
    getDocs(query(collection(db, 'modules'))),
  ].map(p => p.catch(e => {
    console.error("Dashboard data fetching error:", e);
    // In case of an error with one fetch, return it to be handled below
    return e;
  }))); 

  // Gracefully handle cases where one of the fetches might fail
  if (schoolsSnapshot instanceof Error || meetingsSnapshot instanceof Error || surveysSnapshot instanceof Error || stagesSnapshot instanceof Error || usersSnapshot instanceof Error || modulesSnapshot instanceof Error) {
      console.error("Failed to fetch one or more dashboard data sources.");
      // Return a default, empty state for the dashboard
      return {
          metrics: { totalSchools: 0, upcomingMeetings: 0, publishedSurveys: 0, totalResponses: 0 },
          latestSurveys: [],
          upcomingMeetings: [],
          pipelineCounts: [],
          userAssignments: [],
          monthlySchools: [],
          moduleImplementations: [],
      };
  }


  const schools = schoolsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School));
  const now = startOfToday();
  const totalSchools = schools.length;
  
  const upcomingMeetingsCount = meetingsSnapshot.docs.filter(doc => {
    const meetingTime = doc.data().meetingTime;
    return meetingTime && isAfter(new Date(meetingTime), now);
  }).length;

  const publishedSurveysCount = surveysSnapshot.docs.filter(doc => doc.data().status === 'published').length;
  
  const responseCountPromises = surveysSnapshot.docs.map(doc => getDocs(collection(db, 'surveys', doc.id, 'responses')).then(snap => snap.size));
  const totalResponsesCount = (await Promise.all(responseCountPromises)).reduce((sum, count) => sum + count, 0);

  const metrics = {
    totalSchools: totalSchools,
    upcomingMeetings: upcomingMeetingsCount,
    publishedSurveys: publishedSurveysCount,
    totalResponses: totalResponsesCount,
  };

  const surveyResponseCounts = await Promise.all(surveysSnapshot.docs.map(async (doc) => {
    const responsesSnapshot = await getDocs(collection(db, 'surveys', doc.id, 'responses'));
    return { id: doc.id, responseCount: responsesSnapshot.size };
  }));
  const surveyResponseCountMap = new Map(surveyResponseCounts.map(item => [item.id, item.responseCount]));
  const latestSurveys = surveysSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Survey))
    .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
    })
    .slice(0, 3)
    .map(survey => ({
      ...survey,
      responseCount: surveyResponseCountMap.get(survey.id) || 0,
    }));

  const upcomingMeetings = meetingsSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Meeting))
    .filter(meeting => meeting.meetingTime && new Date(meeting.meetingTime) >= now)
    .sort((a, b) => new Date(a.meetingTime).getTime() - new Date(b.meetingTime).getTime())
    .slice(0, 5)
    .map(meeting => ({
      ...meeting,
      date: format(new Date(meeting.meetingTime), 'MMM dd, yyyy'),
      status: 'Upcoming',
    }));

  const stages = stagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OnboardingStage));
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

  const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
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
  
  // Account for unassigned schools
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

  const monthlySchools = schools.reduce((acc, school) => {
    if (school.implementationDate) {
        try {
            const date = new Date(school.implementationDate);
            // Check if the date is valid
            if (!isNaN(date.getTime())) {
                const month = format(date, 'MMM');
                acc[month] = (acc[month] || 0) + 1;
            }
        } catch (e) {
            // Ignore schools with invalid implementationDate
        }
    }
    return acc;
  }, {} as Record<string, number>);

  const monthlySchoolsData = Object.entries(monthlySchools).map(([name, total]) => ({ name, total }));
  
  const allModules = modulesSnapshot.docs.map(doc => doc.data() as Module);
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
  
  return {
    metrics,
    latestSurveys,
    upcomingMeetings,
    pipelineCounts,
    userAssignments,
    monthlySchools: monthlySchoolsData,
    moduleImplementations: moduleImplementationData
  };
}
