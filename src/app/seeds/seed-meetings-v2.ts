/**
 * @fileoverview Idempotent Meetings 2.0 Demonstration Seeding Engine.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Uses deterministic entity IDs to allow safe re-execution without duplicate pollution.
 * - Zero 'any' policy strictly enforced.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  EventType,
  AvailabilityProfile,
  Booking,
  MeetingTranscript,
  MeetingIntelligence,
  MeetingPoll,
  OfficeHoursRoom,
  MeetingRoomResource,
} from '@/lib/meetings/types';
import type { SpeechCoachingScorecard } from '@/lib/meetings/types/speech-coach';
import type { AIActionItemDraft } from '@/lib/meetings/types/ai-assistant';

export interface SeedMeetingsResult {
  workspaceId: string;
  eventTypesSeeded: number;
  bookingsSeeded: number;
  resourcesSeeded: number;
  intelligenceSeeded: number;
  pollsSeeded: number;
  queuesSeeded: number;
  timestamp: string;
}

/**
 * Seeds a complete, realistic demonstration environment for SmartSapp Meetings 2.0.
 */
export async function seedMeetingsV2(
  workspaceId: string,
  organizationId = 'org_default',
  hostUserId = 'host_default'
): Promise<SeedMeetingsResult> {
  const now = new Date();
  const nowIso = now.toISOString();
  const batch = adminDb.batch();

  // ── 1. Availability Profile ─────────────────────────────────────────
  const availId = `seed_avail_${workspaceId}`;
  const availRef = adminDb.collection('availability_profiles').doc(availId);
  const availabilityProfile: AvailabilityProfile = {
    id: availId,
    workspaceId,
    organizationId,
    name: 'Standard Working Hours (9 AM – 5 PM)',
    description: 'Monday through Friday business hours with 15-min buffers',
    timezone: 'UTC',
    isDefault: true,
    weeklyRules: [1, 2, 3, 4, 5].map(day => ({
      dayOfWeek: day,
      isAvailable: true,
      intervals: [{ start: '09:00', end: '17:00' }],
    })),
    overrides: [],
    minimumNoticeMinutes: 120,
    maximumBookingHorizonDays: 30,
    defaultBufferBeforeMinutes: 0,
    defaultBufferAfterMinutes: 15,
    status: 'active',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  batch.set(availRef, availabilityProfile);

  // ── 2. Event Types ──────────────────────────────────────────────────
  const eventTypesToSeed: EventType[] = [
    {
      id: `seed_et_demo_${workspaceId}`,
      workspaceId,
      organizationId,
      name: 'Sales Demo & Product Walkthrough',
      slug: `sales-demo-${workspaceId.slice(0, 4)}`,
      description: 'A 30-minute tailored walkthrough of platform features, pricing, and live Q&A.',
      purpose: 'sales',
      format: 'one_to_one',
      durationMinutes: 30,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 15,
      minimumNoticeMinutes: 120,
      maximumBookingHorizonDays: 30,
      locationType: 'google_meet',
      color: '#3b82f6',
      status: 'active',
      customQuestions: [
        { id: 'q1', key: 'role', type: 'text', label: 'What is your current role?', required: true },
        { id: 'q2', key: 'usecase', type: 'textarea', label: 'Primary business challenge?', required: true },
      ],
      confirmationMessage: 'We look forward to meeting with you!',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: `seed_et_consultation_${workspaceId}`,
      workspaceId,
      organizationId,
      name: 'Strategic Advisory Consultation',
      slug: `consultation-${workspaceId.slice(0, 4)}`,
      description: 'An in-depth 45-minute consultation to evaluate organizational requirements.',
      purpose: 'consultation',
      format: 'one_to_one',
      durationMinutes: 45,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 15,
      minimumNoticeMinutes: 120,
      maximumBookingHorizonDays: 30,
      locationType: 'zoom',
      color: '#10b981',
      status: 'active',
      confirmationMessage: 'Your strategic advisory session is confirmed.',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: `seed_et_onboarding_${workspaceId}`,
      workspaceId,
      organizationId,
      name: 'Client Success & Platform Onboarding',
      slug: `onboarding-${workspaceId.slice(0, 4)}`,
      description: 'A 60-minute technical setup and platform onboarding session.',
      purpose: 'training',
      format: 'collective',
      durationMinutes: 60,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 15,
      minimumNoticeMinutes: 120,
      maximumBookingHorizonDays: 30,
      locationType: 'teams',
      color: '#8b5cf6',
      status: 'active',
      confirmationMessage: 'Welcome aboard! Our customer success team is ready to assist.',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: `seed_et_webinar_${workspaceId}`,
      workspaceId,
      organizationId,
      name: 'Executive Masterclass & Live Webinar',
      slug: `masterclass-${workspaceId.slice(0, 4)}`,
      description: 'Interactive broadcast masterclass with backstage Q&A and hand raises.',
      purpose: 'webinar',
      format: 'group',
      durationMinutes: 60,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 15,
      minimumNoticeMinutes: 120,
      maximumBookingHorizonDays: 30,
      locationType: 'custom',
      color: '#f59e0b',
      status: 'active',
      confirmationMessage: 'You are registered for the masterclass!',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  for (const et of eventTypesToSeed) {
    const ref = adminDb.collection('eventTypes').doc(et.id);
    batch.set(ref, et);
  }

  // ── 3. Realistic Bookings ───────────────────────────────────────────
  const tomorrow = new Date(now.getTime() + 86400000);
  const nextWeek = new Date(now.getTime() + 86400000 * 7);
  const yesterday = new Date(now.getTime() - 86400000);

  const bookingsToSeed: Booking[] = [
    {
      id: `seed_bkg_upcoming_1_${workspaceId}`,
      workspaceId,
      organizationId,
      eventTypeId: `seed_et_demo_${workspaceId}`,
      eventTypeName: 'Sales Demo & Product Walkthrough',
      bookingSource: 'booking_page',
      locationType: 'google_meet',
      status: 'confirmed',
      startAt: new Date(tomorrow.setHours(10, 0, 0, 0)).toISOString(),
      endAt: new Date(tomorrow.setHours(10, 30, 0, 0)).toISOString(),
      timezone: 'UTC',
      hostUserId,
      booker: {
        firstName: 'Sarah',
        lastName: 'Jenkins',
        email: 'sarah.jenkins@acme-corp.com',
        phone: '+1-555-019-2834',
        notes: 'Interested in enterprise multi-workspace migration.',
      },
      joinUrl: 'https://meet.google.com/abc-defg-hij',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: `seed_bkg_upcoming_2_${workspaceId}`,
      workspaceId,
      organizationId,
      eventTypeId: `seed_et_consultation_${workspaceId}`,
      eventTypeName: 'Strategic Advisory Consultation',
      bookingSource: 'booking_page',
      locationType: 'zoom',
      status: 'confirmed',
      startAt: new Date(nextWeek.setHours(14, 0, 0, 0)).toISOString(),
      endAt: new Date(nextWeek.setHours(14, 45, 0, 0)).toISOString(),
      timezone: 'UTC',
      hostUserId,
      booker: {
        firstName: 'Marcus',
        lastName: 'Sterling',
        email: 'm.sterling@globaled.org',
        notes: 'Curriculum optimization review.',
      },
      joinUrl: 'https://zoom.us/j/9876543210',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: `seed_bkg_completed_1_${workspaceId}`,
      workspaceId,
      organizationId,
      eventTypeId: `seed_et_demo_${workspaceId}`,
      eventTypeName: 'Sales Demo & Product Walkthrough',
      bookingSource: 'booking_page',
      locationType: 'google_meet',
      status: 'completed',
      startAt: new Date(yesterday.setHours(11, 0, 0, 0)).toISOString(),
      endAt: new Date(yesterday.setHours(11, 30, 0, 0)).toISOString(),
      timezone: 'UTC',
      hostUserId,
      booker: {
        firstName: 'Elena',
        lastName: 'Rostova',
        email: 'elena@novatech.io',
      },
      joinUrl: 'https://meet.google.com/xyz-uvwx-rst',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: `seed_bkg_cancelled_1_${workspaceId}`,
      workspaceId,
      organizationId,
      eventTypeId: `seed_et_demo_${workspaceId}`,
      eventTypeName: 'Sales Demo & Product Walkthrough',
      bookingSource: 'booking_page',
      locationType: 'google_meet',
      status: 'cancelled',
      startAt: new Date(tomorrow.setHours(16, 0, 0, 0)).toISOString(),
      endAt: new Date(tomorrow.setHours(16, 30, 0, 0)).toISOString(),
      timezone: 'UTC',
      hostUserId,
      booker: {
        firstName: 'David',
        lastName: 'Kim',
        email: 'dkim@finscale.co',
      },
      cancellationReason: 'Internal schedule conflict with board meeting.',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  for (const bkg of bookingsToSeed) {
    const ref = adminDb.collection('bookings').doc(bkg.id);
    batch.set(ref, bkg);
  }

  // ── 4. Intelligence & Transcript for Completed Meeting ───────────────
  const completedMeetingId = `seed_bkg_completed_1_${workspaceId}`;
  const transcriptRef = adminDb.collection('meeting_transcripts').doc(`tr_${completedMeetingId}`);
  const transcriptData: MeetingTranscript = {
    id: `tr_${completedMeetingId}`,
    workspaceId,
    organizationId,
    meetingId: completedMeetingId,
    language: 'en',
    wordCount: 420,
    status: 'completed',
    speakers: [
      { id: 'spk_1', name: 'Alex Rivera (Host)', isHost: true },
      { id: 'spk_2', name: 'Elena Rostova', isHost: false },
    ],
    segments: [
      { id: 'seg_1', speakerId: 'spk_1', speakerName: 'Alex Rivera (Host)', startMs: 0, endMs: 15000, text: 'Hello Elena! Welcome to today\'s session. What goals are top of mind for NovaTech?' },
      { id: 'seg_2', speakerId: 'spk_2', speakerName: 'Elena Rostova', startMs: 15000, endMs: 45000, text: 'We are expanding to 500 team members and need automated onboarding pipelines. We will send over the procurement specs today, we are ready to buy.' },
      { id: 'seg_3', speakerId: 'spk_1', speakerName: 'Alex Rivera (Host)', startMs: 45000, endMs: 75000, text: 'Fantastic! I will follow up with the enterprise security and architecture brief asap.' },
    ],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  batch.set(transcriptRef, transcriptData);

  const intelligenceRef = adminDb.collection('meeting_intelligence').doc(`intel_${completedMeetingId}`);
  const intelligenceData: MeetingIntelligence = {
    id: `intel_${completedMeetingId}`,
    workspaceId,
    organizationId,
    meetingId: completedMeetingId,
    status: 'completed',
    executiveSummary: 'Executive demonstration of SmartSapp Meetings & Onboarding Platform for NovaTech.',
    keyTopics: ['Enterprise Onboarding', 'Seat Expansion', 'Security Whitepaper'],
    keyDecisions: ['Procurement specs to be delivered by end of week'],
    actionItems: [
      {
        id: `act_${completedMeetingId}_1`,
        text: 'Send Enterprise Security Whitepaper & Architecture Specs',
        assigneeName: 'Alex Rivera',
        priority: 'high',
        status: 'open',
      },
    ],
    buyingSignals: [
      { topic: 'Budget & Procurement', quote: 'We will send over the procurement specs today, we are ready to buy.', strength: 'strong' },
    ],
    objections: [],
    dealRisks: [],
    sentiment: {
      category: 'positive',
      score: 0.88,
      explanation: 'Client was highly engaged and ready to proceed with contract procurement.',
    },
    recommendedFollowUp: 'Send Enterprise Security Whitepaper and schedule contract review.',
    generatedAt: nowIso,
    updatedAt: nowIso,
  };
  batch.set(intelligenceRef, intelligenceData);

  // AI Speech Coaching
  const coachingRef = adminDb.collection('meeting_speech_coaching').doc(completedMeetingId);
  const coachingData: SpeechCoachingScorecard = {
    meetingId: completedMeetingId,
    workspaceId,
    overallCoachScore: 92,
    talkToListenRatio: {
      hostPercentage: 50,
      attendeesPercentage: 50,
      evaluation: 'optimal',
    },
    pacingEvaluation: {
      avgWordsPerMinute: 135,
      verdict: 'ideal',
    },
    monologueAlerts: [],
    questionsDetectedCount: 2,
    strengths: [
      'Balanced talk-to-listen ratio (50% host vs 50% client).',
      'Optimal speech cadence at 135 WPM.',
      'Zero uninterrupted monologues detected.',
    ],
    tacticalRecommendations: [
      'Maintain strong discovery pacing on subsequent contract review calls.',
    ],
    createdAt: nowIso,
  };
  batch.set(coachingRef, coachingData);

  // AI Action Items
  const actionItemRef = adminDb.collection('meeting_action_items').doc(`act_${completedMeetingId}_1`);
  const actionItemData: AIActionItemDraft = {
    id: `act_${completedMeetingId}_1`,
    meetingId: completedMeetingId,
    workspaceId,
    title: 'Send Enterprise Security Whitepaper & Architecture Specs',
    suggestedAssigneeName: 'Alex Rivera',
    priority: 'high',
    isApproved: true,
    syncedToCRM: false,
    buyingSignalDetected: 'Procurement specs requested',
    createdAt: nowIso,
  };
  batch.set(actionItemRef, actionItemData);

  // ── 5. Meeting Poll ─────────────────────────────────────────────────
  const pollId = `seed_poll_${workspaceId}`;
  const pollRef = adminDb.collection('meeting_polls').doc(pollId);
  const pollData: MeetingPoll = {
    id: pollId,
    workspaceId,
    organizationId,
    title: 'Q4 Product Roadmap & Architecture Sync',
    slug: `q4-roadmap-${workspaceId.slice(0, 4)}`,
    description: 'Please vote on preferred times for our executive roadmap alignment.',
    durationMinutes: 45,
    hostUserId,
    hostName: 'Alex Rivera',
    proposedSlots: [
      { id: 'slot_1', startAt: new Date(nextWeek.setHours(9, 0, 0, 0)).toISOString(), endAt: new Date(nextWeek.setHours(9, 45, 0, 0)).toISOString(), votesYes: 3, votesMaybe: 0, votesNo: 0 },
      { id: 'slot_2', startAt: new Date(nextWeek.setHours(13, 0, 0, 0)).toISOString(), endAt: new Date(nextWeek.setHours(13, 45, 0, 0)).toISOString(), votesYes: 5, votesMaybe: 0, votesNo: 0 },
      { id: 'slot_3', startAt: new Date(nextWeek.setHours(16, 0, 0, 0)).toISOString(), endAt: new Date(nextWeek.setHours(16, 45, 0, 0)).toISOString(), votesYes: 2, votesMaybe: 1, votesNo: 0 },
    ],
    status: 'open',
    totalVotersCount: 5,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  batch.set(pollRef, pollData);

  // ── 6. Drop-In Office Hours Room ────────────────────────────────────
  const queueId = `seed_queue_${workspaceId}`;
  const queueRef = adminDb.collection('office_hours_queues').doc(queueId);
  const queueData: OfficeHoursRoom = {
    id: queueId,
    workspaceId,
    organizationId,
    hostUserId,
    hostName: 'Alex Rivera',
    title: 'Weekly Student & Client Open Office Hours',
    slug: `office-hours-${workspaceId.slice(0, 4)}`,
    status: 'available',
    maxQueueSize: 20,
    conferenceProvider: 'google_meet',
    joinUrl: 'https://meet.google.com/office-hours-live',
    activeVisitorsCount: 2,
    averageCallDurationMinutes: 15,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  batch.set(queueRef, queueData);

  // ── 7. Physical Resources ───────────────────────────────────────────
  const roomRef = adminDb.collection('meeting_resources').doc(`seed_room_${workspaceId}`);
  const roomData: MeetingRoomResource = {
    id: `seed_room_${workspaceId}`,
    workspaceId,
    name: 'Executive Boardroom Alpha',
    type: 'room',
    capacity: 14,
    floorBuilding: 'Building B, Floor 3',
    amenities: ['4K Screen', 'Video Conferencing Pod', 'Whiteboard'],
    isActive: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  batch.set(roomRef, roomData);

  const gearRef = adminDb.collection('meeting_resources').doc(`seed_gear_${workspaceId}`);
  const gearData: MeetingRoomResource = {
    id: `seed_gear_${workspaceId}`,
    workspaceId,
    name: 'Sony 4K Studio Streaming Cam',
    type: 'equipment',
    capacity: 1,
    floorBuilding: 'Media Equipment Room',
    amenities: ['Tripod', 'USB-C Capture Card'],
    isActive: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  batch.set(gearRef, gearData);

  await batch.commit();

  return {
    workspaceId,
    eventTypesSeeded: eventTypesToSeed.length,
    bookingsSeeded: bookingsToSeed.length,
    resourcesSeeded: 2,
    intelligenceSeeded: 1,
    pollsSeeded: 1,
    queuesSeeded: 1,
    timestamp: nowIso,
  };
}
