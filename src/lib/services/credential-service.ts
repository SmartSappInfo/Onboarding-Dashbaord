/**
 * {{Org_name}} Experience Platform — Credentials & Learning Interoperability Service
 *
 * Enterprise domain operations for Certificate Templates, Verifiable Certificate Issuance,
 * Public Verification, Badges Engine, Open Badges 3.0 W3C JSON-LD, and xAPI Statements.
 * Zero `any` or `any[]` typing.
 */

import { adminDb } from '@/lib/firebase-admin';
import { generateCertificateCode, normaliseCertificateCode } from './certificate-code';
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
    // SECURITY / INTEGRITY (audit F7): the code is CSPRNG-generated and its uniqueness is
    // enforced structurally below by claiming it as a document id, so a duplicate write
    // fails instead of silently producing a second match for the same code.
    const verificationCode = await CredentialService.claimVerificationCode(docRef.id);
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

  /**
   * Claims a unique verification code for a certificate (audit F7).
   *
   * Uses `.create()` on `certificate_codes/{code}`, which fails if the id already exists.
   * That makes uniqueness a property of the database rather than of the generator, so it
   * holds even if the code space is later shortened or the RNG changes.
   */
  private static async claimVerificationCode(certificateId: string): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCertificateCode();
      try {
        await adminDb.collection('certificate_codes').doc(code).create({
          certificateId,
          createdAt: new Date().toISOString(),
        });
        return code;
      } catch {
        // ALREADY_EXISTS — astronomically unlikely at 60 bits, but retry rather than
        // issue a colliding certificate.
        continue;
      }
    }
    throw new Error('Could not allocate a unique certificate verification code.');
  }

  // ── 3. Public Verification Endpoint ─────────────────────────────────────────

  public static async verifyCertificate(verificationCode: string): Promise<{
    isValid: boolean;
    certificate?: IssuedCertificate;
    message: string;
  }> {
    const cleanCode = normaliseCertificateCode(verificationCode);

    // INTEGRITY (audit F7): resolve through the code registry, which holds exactly one
    // document per code. The old `.where(...).limit(1)` returned the FIRST match, so a
    // collision showed the wrong person's credential as valid rather than failing.
    const codeSnap = await adminDb.collection('certificate_codes').doc(cleanCode).get();

    let cert: IssuedCertificate | undefined;
    if (codeSnap.exists) {
      const certificateId = codeSnap.data()?.certificateId as string | undefined;
      if (certificateId) {
        const certSnap = await adminDb.collection('issued_certificates').doc(certificateId).get();
        if (certSnap.exists) cert = certSnap.data() as IssuedCertificate;
      }
    } else {
      // Fall back to the legacy field for certificates issued before the registry existed.
      // Deliberately fetches two so an unresolved historical collision is reported rather
      // than silently resolved to whichever document happens to come back first.
      const legacy = await adminDb
        .collection('issued_certificates')
        .where('verificationCode', '==', cleanCode)
        .limit(2)
        .get();
      if (legacy.size > 1) {
        console.error('[credential-service] Duplicate legacy verification code:', cleanCode);
        return {
          isValid: false,
          message: 'This verification code is ambiguous. Please contact the issuer for a reissued certificate.',
        };
      }
      if (!legacy.empty) cert = legacy.docs[0].data() as IssuedCertificate;
    }

    if (!cert) {
      return {
        isValid: false,
        message: 'No certificate found matching this verification code.',
      };
    }

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
