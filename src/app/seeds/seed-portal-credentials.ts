/**
 * {{Org_name}} Experience Platform — Credentials & Badges Seeder
 *
 * Seeds Certificate Templates, sample issued certificates, gamification badges,
 * and initial xAPI statements for the flagship School Bursar Academy portal.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  CertificateTemplate,
  IssuedCertificate,
  BadgeDefinition,
  AwardedBadge,
  XApiStatement,
} from '@/lib/types/credentials';

export async function seedPortalCredentials(
  portalId: string,
  organizationId: string
): Promise<void> {
  const now = new Date().toISOString();

  // 1. Seed Certificate Template
  const tmplRef = adminDb.collection('certificate_templates').doc(`template_${portalId}_executive`);
  const template: CertificateTemplate = {
    id: tmplRef.id,
    organizationId,
    portalId,
    title: 'Executive Bursar Certification Template',
    description: 'Official credential template for the Strategic School Budgeting & Fee Collection programme.',
    layout: 'classic_gold',
    accentColor: '#d97706',
    issuerName: 'Dr. Kwabena Asante',
    issuerTitle: 'Dean of Executive School Administration',
    hasQrVerification: true,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };
  await tmplRef.set(template, { merge: true });

  // 2. Seed Sample Issued Certificate
  const certRef = adminDb.collection('issued_certificates').doc(`cert_${portalId}_sample_graduate`);
  const cert: IssuedCertificate = {
    id: certRef.id,
    organizationId,
    portalId,
    courseId: 'course_school_bursar',
    courseTitle: 'Strategic School Budgeting & Fee Collection',
    templateId: tmplRef.id,
    userId: 'user_seed_student_1',
    recipientName: 'Kofi Owusu-Ansah',
    recipientEmail: 'kofi.owusu@school.edu.gh',
    certificateNumber: 'SB-88910024',
    verificationCode: 'CERT-2026-8891',
    status: 'issued',
    scoreAchievedPercent: 94,
    transcriptSnapshot: [
      {
        lessonId: 'les_1',
        lessonTitle: 'Strategic School Budgeting Blueprint',
        completedAt: now,
        scorePercent: 96,
      },
      {
        lessonId: 'les_2',
        lessonTitle: 'Fee Reconciliation Spreadsheets & Audits',
        completedAt: now,
        scorePercent: 92,
      },
      {
        lessonId: 'les_3',
        lessonTitle: 'Parent Communication & Digital MoMo Billing',
        completedAt: now,
        scorePercent: 95,
      },
    ],
    issueDate: now,
    verificationUrl: `/portal/bursar-academy/verify/CERT-2026-8891`,
    createdAt: now,
    updatedAt: now,
  };
  await certRef.set(cert, { merge: true });

  // 3. Seed Gamification Badges
  const badges: BadgeDefinition[] = [
    {
      id: `badge_${portalId}_course_master`,
      organizationId,
      portalId,
      title: 'Certified School Bursar',
      description: 'Awarded for 100% completion of the Executive School Bursar Certification.',
      icon: '🎓',
      criteriaType: 'course_completion',
      criteriaThreshold: 1,
      pointsReward: 150,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `badge_${portalId}_perfect_audit`,
      organizationId,
      portalId,
      title: 'Master Auditor',
      description: 'Scored 100% on the Fee Reconciliation checkpoint exam.',
      icon: '⚡',
      criteriaType: 'assessment_perfection',
      criteriaThreshold: 100,
      pointsReward: 100,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `badge_${portalId}_top_peer`,
      organizationId,
      portalId,
      title: 'Community Guide',
      description: 'Published 10+ helpful answers and contributions in community discussion spaces.',
      icon: '🌟',
      criteriaType: 'community_contributor',
      criteriaThreshold: 10,
      pointsReward: 75,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const b of badges) {
    await adminDb.collection('badge_definitions').doc(b.id).set(b, { merge: true });
  }

  // 4. Seed Initial xAPI Statement
  const xapiRef = adminDb.collection('xapi_statements').doc(`xapi_${portalId}_sample_complete`);
  const xapi: XApiStatement = {
    id: xapiRef.id,
    organizationId,
    portalId,
    actor: {
      mbox: 'mailto:kofi.owusu@school.edu.gh',
      name: 'Kofi Owusu-Ansah',
    },
    verb: {
      id: 'http://adlnet.gov/expapi/verbs/completed',
      display: { 'en-US': 'completed' },
    },
    object: {
      id: 'urn:smartsapp:course:course_school_bursar',
      definition: {
        name: { 'en-US': 'Strategic School Budgeting & Fee Collection' },
        type: 'http://adlnet.gov/expapi/activities/course',
      },
    },
    result: {
      score: { scaled: 0.94 },
      completion: true,
      success: true,
    },
    timestamp: now,
  };
  await xapiRef.set(xapi, { merge: true });

  console.log(`[SEED] Successfully seeded Credentials & Badges data for portal: ${portalId}`);
}
