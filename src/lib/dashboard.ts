import { collection, query, where, getDocs, orderBy, limit, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { School, Meeting, Survey, OnboardingStage, UserProfile } from '@/lib/types';
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
  ] = await Promise.all([
    getDocs(collection(db, 'schools')),
    getDocs(collection(db, 'meetings')),
    getDocs(collection(db, 'surveys')),
    getDocs(query(collection(db, 'onboardingStages'), orderBy('order'))),
    getDocs(query(collection(db, 'users'), where('isAuthorized', '==', true)))
  ].map(p => p.catch(e => e))); // Add error catching to prevent Promise.all from failing completely

  if (schoolsSnapshot instanceof Error || meetingsSnapshot instanceof Error || surveysSnapshot instanceof Error || stagesSnapshot instanceof Error || usersSnapshot instanceof Error) {
      console.error("Failed to fetch one or more dashboard data sources.");
      // Return a default/empty state to prevent the page from crashing
      return {
          metrics: { totalSchools: 0, upcomingMeetings: 0, publishedSurveys: 0, totalResponses: 0 },
          latestSurveys: [],
          recentSchools: [],
          upcomingMeetings: [],
          pipelineCounts: [],
          userAssignments: [],
          monthlySchools: [],
      };
  }


  const schools = schoolsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School));
  const now = startOfToday();
  
  // Card 0: Metrics
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(now.getDate() + 7);
  
  const upcomingMeetingsCount = meetingsSnapshot.docs.filter(doc => {
    const meetingTime = new Date(doc.data().meetingTime);
    return isAfter(meetingTime, now);
  }).length;

  const publishedSurveysCount = surveysSnapshot.docs.filter(doc => doc.data().status === 'published').length;
  
  const responseCountPromises = surveysSnapshot.docs.map(doc => getDocs(collection(db, 'surveys', doc.id, 'responses')).then(snap => snap.size));
  const totalResponsesCount = (await Promise.all(responseCountPromises)).reduce((sum, count) => sum + count, 0);

  const metrics = {
    totalSchools: schoolsSnapshot.size,
    upcomingMeetings: upcomingMeetingsCount,
    publishedSurveys: publishedSurveysCount,
    totalResponses: totalResponsesCount,
  };

  // Card 2: Recently Added Schools
  const recentSchools = schools
    .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
    })
    .slice(0, 5);

  // Card 3: Latest Surveys
  const surveyResponseCounts = await Promise.all(surveysSnapshot.docs.map(async (doc) => {
    const responsesSnapshot = await getDocs(collection(db, 'surveys', doc.id, 'responses'));
    return { id: doc.id, responseCount: responsesSnapshot.size };
  }));
  const surveyResponseCountMap = new Map(surveyResponseCounts.map(item => [item.id, item.responseCount]));
  const latestSurveys = surveysSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Survey))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3)
    .map(survey => ({
      ...survey,
      responseCount: surveyResponseCountMap.get(survey.id) || 0,
    }));

  // Card 4: Upcoming Meetings
  const upcomingMeetings = meetingsSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Meeting))
    .filter(meeting => new Date(meeting.meetingTime) >= now)
    .sort((a, b) => new Date(a.meetingTime).getTime() - new Date(b.meetingTime).getTime())
    .slice(0, 5)
    .map(meeting => ({
      ...meeting,
      date: format(new Date(meeting.meetingTime), 'MMM dd, yyyy'),
      status: 'Upcoming',
    }));

  // Card 5: Pipeline Pie Chart
  const stages = stagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OnboardingStage));
  const pipelineCounts = stages.map(stage => ({
    name: stage.name,
    count: schools.filter(school => school.stage?.id === stage.id).length,
    color: stage.color || '#cccccc'
  }));

  // Card 7: User Assignments
  const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
  const userAssignments = users.map(user => {
      const assignedSchools = schools.filter(s => s.assignedTo?.userId === user.id);
      const schoolsByStage = stages.map(stage => {
          const count = assignedSchools.filter(s => s.stage?.id === stage.id).length;
          return { name: stage.name, count, color: stage.color || '#cccccc' };
      });
      return {
          user,
          totalAssigned: assignedSchools.length,
          schoolsByStage
      };
  });

  // Card 8: Monthly School Additions
  const monthlySchools = schools.reduce((acc, school) => {
    if (school.createdAt) {
        const month = format(new Date(school.createdAt), 'MMM');
        acc[month] = (acc[month] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  const monthlySchoolsData = Object.entries(monthlySchools).map(([name, total]) => ({ name, total }));
  
  return {
    metrics,
    latestSurveys,
    recentSchools,
    upcomingMeetings,
    pipelineCounts,
    userAssignments,
    monthlySchools: monthlySchoolsData
  };
}