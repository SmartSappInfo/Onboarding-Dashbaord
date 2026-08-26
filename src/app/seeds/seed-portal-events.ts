/**
 * {{Org_name}} Experience Platform — Seed Portal Live Events & Cohorts
 *
 * Seeds live webinars, workshops, coaching clinics, and student cohorts into the Academy portal.
 *
 * Usage:
 *   npx tsx src/app/seeds/seed-portal-events.ts [orgId]
 */

import { adminDb } from '@/lib/firebase-admin';
import { EventService } from '@/lib/services/event-service';

export async function seedPortalEvents(targetOrgId: string = 'smartsapp-hq') {
  console.log(`\n🚀 [SEED] Starting Portal Live Events & Cohorts seed for org: ${targetOrgId}...`);

  // Find Academy portal
  const academySnap = await adminDb
    .collection('portals')
    .where('organizationId', '==', targetOrgId)
    .where('slug', '==', 'academy')
    .limit(1)
    .get();

  if (academySnap.empty) {
    console.log('ℹ️ [SEED] Academy portal not found. Please run seed-experience-portals.ts first.');
    return;
  }

  const academyPortal = academySnap.docs[0].data();
  const portalId = academyPortal.id;
  const workspaceIds = academyPortal.workspaceIds || ['events'];

  // 1. Seed Live Webinar (Upcoming) with Deterministic ID
  const now = Date.now();
  const event1Ref = adminDb.collection('live_events').doc(`event_${portalId}_whatsapp_fee_recovery`);
  const event1 = {
    id: event1Ref.id,
    organizationId: targetOrgId,
    portalId,
    workspaceIds,
    title: 'Live Masterclass: 3-Touch WhatsApp Fee Recovery Blueprint',
    slug: 'whatsapp-fee-recovery-masterclass',
    description: 'Dr. Kwame Mensah demonstrates the exact automation triggers, overdue aging brackets, and payment link sequences used by top schools to collect 98% of term tuition.',
    type: 'webinar',
    instructorName: 'Dr. Kwame Mensah',
    instructorTitle: 'Lead Bursary & Automation Specialist',
    instructorAvatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    meetingProvider: 'zoom',
    meetingUrl: 'https://zoom.us/j/9876543210',
    meetingId: '987 654 3210',
    meetingPasscode: '882019',
    scheduledStartTime: new Date(now + 2 * 24 * 60 * 60 * 1000).toISOString(),
    scheduledEndTime: new Date(now + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
    durationMinutes: 60,
    maxAttendees: 150,
    registeredUserIds: [],
    attendedUserIds: [],
    status: 'scheduled',
    isPublic: true,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };
  await event1Ref.set(event1, { merge: true });
  console.log(`✅ [SEED] Seeded Live Webinar: "${event1.title}"`);

  // 2. Seed Past Event with Replay & AI Summary
  const event2Ref = adminDb.collection('live_events').doc(`event_${portalId}_school_fee_auditing_replay`);
  const event2 = {
    id: event2Ref.id,
    organizationId: targetOrgId,
    portalId,
    workspaceIds,
    title: 'Workshop Replay: School Fee Auditing & Aged Debt Recovery',
    slug: 'school-fee-auditing-workshop-replay',
    description: 'A deep-dive workshop on reconciling term invoices against bank deposits.',
    type: 'workshop',
    instructorName: 'Sarah Jenkins',
    instructorTitle: 'Senior Financial Controller',
    instructorAvatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    meetingProvider: 'zoom',
    meetingUrl: 'https://zoom.us/j/1234567890',
    scheduledStartTime: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
    scheduledEndTime: new Date(now - 3 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000).toISOString(),
    durationMinutes: 90,
    registeredUserIds: [],
    attendedUserIds: [],
    status: 'completed',
    recordingUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    recordingDurationSeconds: 5400,
    aiSummary: 'This workshop breaks down the 4 stages of school tuition reconciliation. Instructors demonstrated how to extract aging reports from Excel ledgers, verify direct bank deposits, and resolve billing discrepancies before term finals.',
    keyTakeaways: [
      'Segment debtors into 0-30 days, 31-60 days, and 60+ days overdue buckets.',
      'Automate WhatsApp notification touchpoints 7 days prior to due dates.',
      'Provide instant mobile payment links directly in statement messages.',
      'Conduct weekly bursary reconciliations to prevent term-end backlog.',
    ],
    isPublic: true,
    createdAt: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };
  await event2Ref.set(event2, { merge: true });
  console.log(`✅ [SEED] Seeded Event Replay: "${event2.title}"`);

  // 3. Seed Course Cohort
  const cohortRef = adminDb.collection('student_cohorts').doc(`cohort_${portalId}_term1_intensive`);
  const cohort = {
    id: cohortRef.id,
    organizationId: targetOrgId,
    portalId,
    courseId: 'all',
    workspaceIds,
    name: 'Term 1 School Leaders & Bursars Intensive',
    slug: 'term-1-intensive-cohort',
    description: 'A 6-week structured intensive for school administrators accelerating their digital transition.',
    instructorName: 'Dr. Kwame Mensah',
    startDate: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(now + 49 * 24 * 60 * 60 * 1000).toISOString(),
    maxCapacity: 75,
    enrolledUserIds: [],
    status: 'enrolling',
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };
  await cohortRef.set(cohort, { merge: true });
  console.log(`✅ [SEED] Seeded Student Cohort: "${cohort.name}"`);

  console.log(`\n✨ [SEED] Portal Live Events & Cohorts seeding complete!\n`);
}

// Execute if run directly
if (process.argv[1]?.includes('seed-portal-events')) {
  const orgArg = process.argv[2] || 'smartsapp-hq';
  seedPortalEvents(orgArg)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ [SEED] Error seeding events:', err);
      process.exit(1);
    });
}
