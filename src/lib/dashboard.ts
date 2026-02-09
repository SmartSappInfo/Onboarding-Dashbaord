import { collection, query, where, getDocs, orderBy, limit, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { School, Meeting, Survey, OnboardingStage } from '@/lib/types';
import { format, formatDistanceToNow } from 'date-fns';

function getDb() {
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
  return getFirestore(getApp());
}

export async function getDashboardData() {
  const db = getDb();

  // Parallel fetching
  const schoolsQuery = getDocs(collection(db, 'schools'));
  const meetingsQuery = getDocs(collection(db, 'meetings'));
  const surveysQuery = getDocs(collection(db, 'surveys'));
  const stagesQuery = getDocs(query(collection(db, 'onboardingStages'), orderBy('order')));

  const [
    schoolsSnapshot,
    meetingsSnapshot,
    surveysSnapshot,
    stagesSnapshot,
  ] = await Promise.all([schoolsQuery, meetingsQuery, surveysQuery, stagesQuery]);

  // Process Metrics
  const now = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(now.getDate() + 7);

  const upcomingMeetingsCount = meetingsSnapshot.docs.filter(doc => {
    const meetingTime = new Date(doc.data().meetingTime);
    return meetingTime >= now && meetingTime <= sevenDaysFromNow;
  }).length;
  
  const publishedSurveysCount = surveysSnapshot.docs.filter(doc => doc.data().status === 'published').length;

  const responseCountPromises = surveysSnapshot.docs.map(doc => 
    getDocs(collection(db, 'surveys', doc.id, 'responses')).then(snap => snap.size)
  );
  const responseCounts = await Promise.all(responseCountPromises);
  const totalResponsesCount = responseCounts.reduce((sum, count) => sum + count, 0);

  const metrics = {
    totalSchools: schoolsSnapshot.size,
    upcomingMeetings: upcomingMeetingsCount,
    publishedSurveys: publishedSurveysCount,
    totalResponses: totalResponsesCount,
  };

  // Process Upcoming Meetings
  const upcomingMeetingsList = meetingsSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Meeting))
    .filter(meeting => new Date(meeting.meetingTime) >= now)
    .sort((a, b) => new Date(a.meetingTime).getTime() - new Date(b.meetingTime).getTime())
    .slice(0, 5)
    .map(meeting => ({
      id: meeting.id,
      schoolName: meeting.schoolName,
      type: meeting.type.name,
      date: format(new Date(meeting.meetingTime), 'MMM dd, yyyy'),
      status: 'Upcoming',
    }));

  // Process Pipeline Snapshot
  const schools = schoolsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School));
  const stages = stagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OnboardingStage));
  
  const pipeline = stages.map(stage => ({
    name: stage.name,
    count: schools.filter(school => school.stage?.id === stage.id).length,
  }));
  
  // Process Recent Activity
  const recentActivity = schools
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .map(school => ({
        id: school.id,
        name: school.name,
        createdAt: school.createdAt
    }));


  return {
    metrics,
    meetings: upcomingMeetingsList,
    pipeline,
    activity: recentActivity,
  };
}
