/**
 * {{Org_name}} Experience Platform — Seed Portal Courses & Curriculum
 *
 * Seeds flagship masterclasses with modules, video lessons, and interactive
 * quiz assessments into the Academy portal.
 *
 * Usage:
 *   npx tsx src/app/seeds/seed-portal-courses.ts [orgId]
 */

import { adminDb } from '@/lib/firebase-admin';
import { CourseService } from '@/lib/services/course-service';

async function seedPortalCourses(targetOrgId: string = 'smartsapp-hq') {
  console.log(`\n🚀 [SEED] Starting Portal Courses & Curriculum seed for org: ${targetOrgId}...`);

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
  const workspaceIds = academyPortal.workspaceIds || ['onboarding'];

  // 1. Course 1: Invoicing & Fee Recovery Masterclass
  const course1Title = 'Invoicing & Fee Recovery Masterclass';
  const course1Slug = 'invoicing-fee-recovery';

  let course1 = await CourseService.getCourseBySlug(portalId, course1Slug);
  if (!course1) {
    course1 = await CourseService.createCourse(
      {
        organizationId: targetOrgId,
        portalId,
        workspaceIds,
        title: course1Title,
        slug: course1Slug,
        summary: 'Learn automated WhatsApp tuition reminders and structured fee recovery workflows.',
        description: 'Complete hands-on curriculum guiding bursars and school heads through multi-channel tuition invoicing.',
        instructorName: 'Dr. Kwame Mensah',
        instructorTitle: 'Head of Bursary Automation',
        level: 'intermediate',
        category: 'Finance & Bursary',
        estimatedDurationMinutes: 90,
        status: 'published',
        certificateEnabled: true,
        order: 1,
        featured: true,
      },
      'system_seeder'
    );
    console.log(`✅ [SEED] Created Course: "${course1.title}" (ID: ${course1.id})`);

    // Module 1: Foundations
    const mod1 = await CourseService.createModule({
      organizationId: targetOrgId,
      portalId,
      courseId: course1.id,
      title: 'Module 1: Fee Recovery Foundations',
      description: 'Understanding root causes of overdue tuition and establishing standard operating procedures.',
      order: 1,
    });

    // Lesson 1.1
    await CourseService.createLesson({
      organizationId: targetOrgId,
      portalId,
      courseId: course1.id,
      moduleId: mod1.id,
      title: 'The Psychology of Tuition Delays',
      slug: 'psychology-of-tuition-delays',
      contentType: 'video',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoDurationSeconds: 600,
      summary: 'Analyze why parents delay payments and how transparent billing schedules change behavior.',
      content: `### Core Principles of Tuition Collection\n\n1. **Predictability:** Parents prioritize bills with clear, repeated deadlines.\n2. **Ease of Payment:** Direct mobile money and card links yield 3x faster settlement.\n3. **Empathetic Urgency:** Professional, respectful reminders protect the school's relationship with families.`,
      order: 1,
      isPreview: true,
    });

    // Lesson 1.2 with Quiz
    const lesson12 = await CourseService.createLesson({
      organizationId: targetOrgId,
      portalId,
      courseId: course1.id,
      moduleId: mod1.id,
      title: 'Setting Up 3-Touch Reminder Sequences',
      slug: 'setting-up-reminder-sequences',
      contentType: 'quiz',
      summary: 'Master the 7-day, 3-day, and due-date reminder cadences.',
      content: 'Review the reminder timeline before taking the knowledge check below.',
      order: 2,
    });

    // Seed Quiz for Lesson 1.2
    await adminDb.collection('course_assessments').doc(`assessment_${lesson12.id}`).set({
      id: `assessment_${lesson12.id}`,
      organizationId: targetOrgId,
      portalId,
      courseId: course1.id,
      lessonId: lesson12.id,
      title: 'Fee Recovery Knowledge Check',
      passingScore: 70,
      questions: [
        {
          id: 'q1',
          questionText: 'When should the first gentle payment reminder be dispatched?',
          type: 'multiple_choice',
          points: 1,
          options: [
            { id: 'opt1', text: '30 days after due date', isCorrect: false },
            { id: 'opt2', text: '7 days before due date', isCorrect: true },
            { id: 'opt3', text: 'On the exact due date only', isCorrect: false },
          ],
          explanation: 'Proactive reminders 7 days ahead allow families to plan their cash flow.',
        },
        {
          id: 'q2',
          questionText: 'Which channel has the highest immediate open rate for billing notifications?',
          type: 'multiple_choice',
          points: 1,
          options: [
            { id: 'opt1', text: 'WhatsApp Direct Messaging', isCorrect: true },
            { id: 'opt2', text: 'Printed Letters Sent Home with Students', isCorrect: false },
            { id: 'opt3', text: 'Notice Board Flyers', isCorrect: false },
          ],
          explanation: 'WhatsApp delivers over 98% open rates within the first 15 minutes.',
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  console.log(`\n✨ [SEED] Portal Courses seeding complete!\n`);
}

// Execute if run directly
if (process.argv[1]?.includes('seed-portal-courses')) {
  const orgArg = process.argv[2] || 'smartsapp-hq';
  seedPortalCourses(orgArg)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ [SEED] Error seeding courses:', err);
      process.exit(1);
    });
}
