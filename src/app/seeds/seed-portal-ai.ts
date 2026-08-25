/**
 * {{Org_name}} Experience Platform — AI Experience & Intelligence Seeder
 *
 * Seeds AI Knowledge Chunks, sample AI Tutor sessions, and Pedagogy Diagnostics
 * for the flagship School Bursar Academy portal.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  AiKnowledgeChunk,
  AiTutorSession,
  AiPedagogyDiagnostic,
} from '@/lib/types/ai-experience';

export async function seedPortalAiExperience(
  portalId: string,
  organizationId: string
): Promise<void> {
  const now = new Date().toISOString();

  // 1. Seed AI Knowledge Chunk for Lesson Grounding
  const chunkRef = adminDb.collection('ai_knowledge_chunks').doc(`chunk_${portalId}_budgeting`);
  const chunk: AiKnowledgeChunk = {
    id: chunkRef.id,
    organizationId,
    portalId,
    resourceType: 'lesson',
    resourceId: 'lesson_1_strategic_budgeting',
    title: 'Executive Overview: School Budgeting Framework',
    contentChunk:
      'Strategic school fee collection requires early digital invoices, automated SMS reminders sent 3 days before due dates, and real-time reconciliation against bank statements. Eliminating paper receipt bottlenecks increases term fee collection from 64% to 92%.',
    createdAt: now,
  };
  await chunkRef.set(chunk, { merge: true });

  // 2. Seed Sample AI Tutor Session
  const sessionRef = adminDb.collection('ai_tutor_sessions').doc(`tutor_lesson_1_strategic_budgeting_demo`);
  const session: AiTutorSession = {
    id: sessionRef.id,
    organizationId,
    portalId,
    courseId: 'course_school_bursar',
    lessonId: 'lesson_1_strategic_budgeting',
    userId: 'user_seed_student_1',
    messages: [
      {
        id: 'msg_1',
        sender: 'user',
        text: 'Can you give me a real-world example of how automated reminders improve fee recovery?',
        timestamp: now,
      },
      {
        id: 'msg_2',
        sender: 'ai',
        text: 'A private school with 450 students sent SMS reminders 3 days before fee deadlines with a direct MoMo payment link. Within one academic term, on-time collection increased by 28%.',
        suggestedActions: ['Show me how to draft SMS templates', 'Take practice quiz', 'Next action steps'],
        timestamp: now,
      },
    ],
    summary: 'Discussion on automated parent SMS reminders and fee recovery rates.',
    createdAt: now,
    updatedAt: now,
  };
  await sessionRef.set(session, { merge: true });

  // 3. Seed Pedagogy Diagnostic
  const diagRef = adminDb.collection('ai_pedagogy_diagnostics').doc(`diag_course_school_bursar`);
  const diagnostic: AiPedagogyDiagnostic = {
    id: diagRef.id,
    organizationId,
    portalId,
    courseId: 'course_school_bursar',
    courseTitle: 'Strategic School Budgeting & Fee Collection',
    dropOffLessonId: 'lesson_2_reconciliations',
    dropOffLessonTitle: 'Financial Reconciliations & Audit Spreadsheets',
    dropOffRatePercent: 34,
    assessmentFailureRatePercent: 28,
    diagnosis:
      '34% of enrolled students drop off during Lesson 2.2 due to complex spreadsheet formulas.',
    actionableRecommendations: [
      'Add a 3-minute video walkthrough demonstrating spreadsheet formulas step-by-step.',
      'Provide a pre-filled Excel template with formula tooltips.',
      'Split Lesson 2.2 into two bite-sized 6-minute sub-lessons.',
    ],
    createdAt: now,
  };
  await diagRef.set(diagnostic, { merge: true });

  console.log(`[SEED] Successfully seeded AI Experience data for portal: ${portalId}`);
}
