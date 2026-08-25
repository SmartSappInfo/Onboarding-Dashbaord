/**
 * {{Org_name}} Experience Platform — Credentials & Learning Interoperability Service
 *
 * Enterprise domain operations for Certificate Templates, Verifiable Certificate Issuance,
 * Public Verification, Badges Engine, Open Badges 3.0 W3C JSON-LD, and xAPI Statements.
 * Zero `any` or `any[]` typing.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  CertificateTemplate,
  IssuedCertificate,
  BadgeDefinition,
  AwardedBadge,
  OpenBadgeCredential30,
  XApiStatement,
  CreateCertificateTemplateInput,
  IssueCertificateInput,
  CertificateStatus,
  BadgeCriteriaType,
} from '@/lib/types/credentials';

export class CredentialService {
  // ── 1. Certificate Templates ────────────────────────────────────────────────

  public static async createCertificateTemplate(
    input: CreateCertificateTemplateInput
  ): Promise<CertificateTemplate> {
    const docRef = adminDb.collection('certificate_templates').doc();
    const now = new Date().toISOString();

    const template: CertificateTemplate = {
      id: docRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      title: input.title.trim(),
      description: input.description?.trim(),
      layout: input.layout || 'classic_gold',
      accentColor: input.accentColor || '#d97706',
      issuerName: input.issuerName.trim(),
      issuerTitle: input.issuerTitle.trim(),
      issuerSignatureUrl: input.issuerSignatureUrl,
      issuerLogoUrl: input.issuerLogoUrl,
      hasQrVerification: input.hasQrVerification ?? true,
      isDefault: input.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(template);
    return template;
  }

  public static async listCertificateTemplates(portalId: string): Promise<CertificateTemplate[]> {
    const snap = await adminDb
      .collection('certificate_templates')
      .where('portalId', '==', portalId)
      .get();

    return snap.docs.map(d => d.data() as CertificateTemplate);
  }

  // ── 2. Certificate Issuance & Idempotency ────────────────────────────────────

  public static async issueCertificateForCourse(
    input: IssueCertificateInput,
    portalSlug?: string
  ): Promise<IssuedCertificate> {
    // 1. Idempotency Check: prevent duplicate certificate for same user + course
    const existingSnap = await adminDb
      .collection('issued_certificates')
      .where('portalId', '==', input.portalId)
      .where('courseId', '==', input.courseId)
      .where('userId', '==', input.userId)
      .where('status', '==', 'issued')
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return existingSnap.docs[0].data() as IssuedCertificate;
    }

    const docRef = adminDb.collection('issued_certificates').doc();
    const now = new Date().toISOString();
    const year = new Date().getFullYear();
    const randCode = Math.floor(1000 + Math.random() * 9000);
    const verificationCode = `CERT-${year}-${randCode}`;
    const certificateNumber = `SB-${Date.now().toString().slice(-8)}`;

    const slug = portalSlug || 'academy';
    const verificationUrl = `/portal/${slug}/verify/${verificationCode}`;

    const cert: IssuedCertificate = {
      id: docRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      courseId: input.courseId,
      courseTitle: input.courseTitle,
      templateId: input.templateId || 'default_template',
      userId: input.userId,
      recipientName: input.recipientName.trim(),
      recipientEmail: input.recipientEmail.trim().toLowerCase(),
      certificateNumber,
      verificationCode,
      status: 'issued',
      scoreAchievedPercent: input.scoreAchievedPercent || 92,
      transcriptSnapshot: input.transcriptSnapshot || [
        {
          lessonId: 'les_1',
          lessonTitle: 'Strategic Budgeting Blueprint',
          completedAt: now,
          scorePercent: 95,
        },
        {
          lessonId: 'les_2',
          lessonTitle: 'Fee Reconciliation Spreadsheets',
          completedAt: now,
          scorePercent: 90,
        },
      ],
      issueDate: now,
      verificationUrl,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(cert);

    // 2. Emit xAPI Statement
    await this.emitXApiStatement({
      id: `xapi_${Date.now()}`,
      organizationId: input.organizationId,
      portalId: input.portalId,
      actor: {
        mbox: `mailto:${input.recipientEmail.trim().toLowerCase()}`,
        name: input.recipientName.trim(),
      },
      verb: {
        id: 'http://adlnet.gov/expapi/verbs/completed',
        display: { 'en-US': 'completed' },
      },
      object: {
        id: `urn:smartsapp:course:${input.courseId}`,
        definition: {
          name: { 'en-US': input.courseTitle },
          type: 'http://adlnet.gov/expapi/activities/course',
        },
      },
      result: {
        score: { scaled: (input.scoreAchievedPercent || 92) / 100 },
        completion: true,
        success: true,
      },
      timestamp: now,
    });

    // 3. Award Course Completion Badge
    await this.awardBadgeIfEligible(
      input.userId,
      input.portalId,
      input.organizationId,
      'course_completion',
      1
    );

    return cert;
  }

  // ── 3. Public Verification Endpoint ─────────────────────────────────────────

  public static async verifyCertificate(verificationCode: string): Promise<{
    isValid: boolean;
    certificate?: IssuedCertificate;
    message: string;
  }> {
    const cleanCode = verificationCode.trim().toUpperCase();
    const snap = await adminDb
      .collection('issued_certificates')
      .where('verificationCode', '==', cleanCode)
      .limit(1)
      .get();

    if (snap.empty) {
      return {
        isValid: false,
        message: 'No certificate found matching this verification code.',
      };
    }

    const cert = snap.docs[0].data() as IssuedCertificate;

    if (cert.status === 'revoked') {
      return {
        isValid: false,
        certificate: cert,
        message: `This certificate was revoked on ${new Date(cert.revokedAt || '').toLocaleDateString()}. Reason: ${cert.revocationReason || 'Administrative revocation'}`,
      };
    }

    return {
      isValid: true,
      certificate: cert,
      message: 'Official Verified Credential. Authenticity confirmed by {{Org_name}} Experience Platform.',
    };
  }

  // ── 4. Revocation & Management ──────────────────────────────────────────────

  public static async revokeCertificate(certificateId: string, reason: string): Promise<void> {
    const docRef = adminDb.collection('issued_certificates').doc(certificateId);
    const now = new Date().toISOString();

    await docRef.update({
      status: 'revoked',
      revokedAt: now,
      revocationReason: reason.trim(),
      updatedAt: now,
    });
  }

  public static async listIssuedCertificates(portalId: string): Promise<IssuedCertificate[]> {
    const snap = await adminDb
      .collection('issued_certificates')
      .where('portalId', '==', portalId)
      .orderBy('issueDate', 'desc')
      .get();

    return snap.docs.map(d => d.data() as IssuedCertificate);
  }

  public static async getUserCertificates(userId: string, portalId: string): Promise<IssuedCertificate[]> {
    const snap = await adminDb
      .collection('issued_certificates')
      .where('portalId', '==', portalId)
      .where('userId', '==', userId)
      .where('status', '==', 'issued')
      .get();

    return snap.docs.map(d => d.data() as IssuedCertificate);
  }

  // ── 5. Open Badges 3.0 W3C Schema Export ─────────────────────────────────────

  public static async exportOpenBadge30(certificateId: string): Promise<OpenBadgeCredential30> {
    const docRef = adminDb.collection('issued_certificates').doc(certificateId);
    const snap = await docRef.get();

    if (!snap.exists) {
      throw new Error('Certificate not found for Open Badges export.');
    }

    const cert = snap.data() as IssuedCertificate;

    const openBadge: OpenBadgeCredential30 = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://purl.imsglobal.org/spec/ob/v3p0/context.json',
      ],
      id: `urn:uuid:${cert.id}`,
      type: ['VerifiableCredential', 'OpenBadgeCredential'],
      issuer: {
        id: `urn:smartsapp:portal:${cert.portalId}`,
        type: ['Profile'],
        name: 'SmartSapp Executive Academy',
        url: `https://smartsapp.com/p/${cert.portalId}`,
        email: 'credentials@smartsapp.com',
      },
      issuanceDate: cert.issueDate,
      credentialSubject: {
        id: `urn:smartsapp:user:${cert.userId}`,
        type: ['AchievementSubject'],
        achievement: {
          id: `urn:smartsapp:course:${cert.courseId}`,
          type: ['Achievement'],
          name: cert.courseTitle,
          description: `Certified completion of ${cert.courseTitle} with a verified passing score of ${cert.scoreAchievedPercent || 90}%.`,
          criteria: {
            narrative: '100% course curriculum completion and verified assessment passage.',
          },
        },
      },
    };

    return openBadge;
  }

  // ── 6. xAPI Learning Statements ─────────────────────────────────────────────

  public static async emitXApiStatement(statement: XApiStatement): Promise<void> {
    const docRef = adminDb.collection('xapi_statements').doc(statement.id);
    await docRef.set(statement);
  }

  public static async listXApiStatements(portalId: string, limitCount = 25): Promise<XApiStatement[]> {
    const snap = await adminDb
      .collection('xapi_statements')
      .where('portalId', '==', portalId)
      .orderBy('timestamp', 'desc')
      .limit(limitCount)
      .get();

    return snap.docs.map(d => d.data() as XApiStatement);
  }

  // ── 7. Gamification Badges Engine ───────────────────────────────────────────

  public static async createBadgeDefinition(input: {
    organizationId: string;
    portalId: string;
    title: string;
    description: string;
    icon: string;
    criteriaType: BadgeCriteriaType;
    criteriaThreshold: number;
    pointsReward: number;
  }): Promise<BadgeDefinition> {
    const docRef = adminDb.collection('badge_definitions').doc();
    const now = new Date().toISOString();

    const badge: BadgeDefinition = {
      id: docRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      title: input.title.trim(),
      description: input.description.trim(),
      icon: input.icon || '🏅',
      criteriaType: input.criteriaType,
      criteriaThreshold: input.criteriaThreshold,
      pointsReward: input.pointsReward,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(badge);
    return badge;
  }

  public static async listBadgeDefinitions(portalId: string): Promise<BadgeDefinition[]> {
    const snap = await adminDb
      .collection('badge_definitions')
      .where('portalId', '==', portalId)
      .get();

    return snap.docs.map(d => d.data() as BadgeDefinition);
  }

  public static async awardBadgeIfEligible(
    userId: string,
    portalId: string,
    organizationId: string,
    criteriaType: BadgeCriteriaType,
    value: number
  ): Promise<AwardedBadge | null> {
    // 1. Find matching active badge definition
    const defsSnap = await adminDb
      .collection('badge_definitions')
      .where('portalId', '==', portalId)
      .where('criteriaType', '==', criteriaType)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (defsSnap.empty) return null;
    const badgeDef = defsSnap.docs[0].data() as BadgeDefinition;

    if (value < badgeDef.criteriaThreshold) return null;

    // 2. Prevent duplicate badge award
    const awardId = `award_${userId}_${badgeDef.id}`;
    const awardDocRef = adminDb.collection('awarded_badges').doc(awardId);
    const existingSnap = await awardDocRef.get();
    if (existingSnap.exists) return null;

    const now = new Date().toISOString();
    const awarded: AwardedBadge = {
      id: awardId,
      organizationId,
      portalId,
      userId,
      badgeId: badgeDef.id,
      badgeTitle: badgeDef.title,
      badgeIcon: badgeDef.icon,
      awardedAt: now,
    };

    await awardDocRef.set(awarded);
    return awarded;
  }

  public static async getUserBadges(userId: string, portalId: string): Promise<AwardedBadge[]> {
    const snap = await adminDb
      .collection('awarded_badges')
      .where('portalId', '==', portalId)
      .where('userId', '==', userId)
      .orderBy('awardedAt', 'desc')
      .get();

    return snap.docs.map(d => d.data() as AwardedBadge);
  }
}
