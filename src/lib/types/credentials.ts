/**
 * {{Org_name}} Experience Platform — Credentials & Learning Interoperability Domain Types
 *
 * Strict TypeScript models for Certificate Templates, Issued Certificates, Badges,
 * Open Badges 3.0 W3C Verifiable Credentials, and xAPI Statements.
 * Zero `any` or `any[]` typing.
 */

export type CertificateLayout = 'classic_gold' | 'modern_minimal' | 'executive_navy' | 'academic_crest';

export type CertificateStatus = 'eligible' | 'issuing' | 'issued' | 'revoked';

export type BadgeCriteriaType =
  | 'course_completion'
  | 'assessment_perfection'
  | 'community_contributor'
  | 'event_attendance'
  | 'points_milestone';

export type XApiVerb = 'viewed' | 'attempted' | 'passed' | 'failed' | 'completed' | 'attended' | 'posted';

export interface TranscriptItem {
  lessonId: string;
  lessonTitle: string;
  moduleTitle?: string;
  scorePercent?: number;
  completedAt: string;
}

export interface CertificateTemplate {
  id: string;
  organizationId: string;
  portalId: string;
  title: string;
  description?: string;
  layout: CertificateLayout;
  accentColor: string;
  issuerName: string;
  issuerTitle: string;
  issuerSignatureUrl?: string;
  issuerLogoUrl?: string;
  hasQrVerification: boolean;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IssuedCertificate {
  id: string;
  organizationId: string;
  portalId: string;
  courseId: string;
  courseTitle: string;
  templateId: string;
  userId: string;
  recipientName: string;
  recipientEmail: string;
  certificateNumber: string;
  verificationCode: string;
  status: CertificateStatus;
  scoreAchievedPercent?: number;
  transcriptSnapshot: TranscriptItem[];
  issueDate: string;
  revokedAt?: string;
  revocationReason?: string;
  qrCodeUrl?: string;
  verificationUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BadgeDefinition {
  id: string;
  organizationId: string;
  portalId: string;
  title: string;
  description: string;
  icon: string;
  criteriaType: BadgeCriteriaType;
  criteriaThreshold: number;
  pointsReward: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AwardedBadge {
  id: string;
  organizationId: string;
  portalId: string;
  userId: string;
  badgeId: string;
  badgeTitle: string;
  badgeIcon: string;
  awardedAt: string;
  evidenceUrl?: string;
}

/**
 * 1EdTech Open Badges 3.0 / W3C Verifiable Credential Schema
 */
export interface OpenBadgeCredential30 {
  '@context': string[];
  id: string;
  type: string[];
  issuer: {
    id: string;
    type: string[];
    name: string;
    url: string;
    email?: string;
  };
  issuanceDate: string;
  credentialSubject: {
    id: string;
    type: string[];
    achievement: {
      id: string;
      type: string[];
      name: string;
      description: string;
      criteria?: {
        narrative?: string;
      };
    };
  };
}

/**
 * xAPI / Experience API (Tin Can) Statement Schema
 */
export interface XApiStatement {
  id: string;
  organizationId: string;
  portalId: string;
  actor: {
    mbox?: string;
    name: string;
    account?: {
      homePage: string;
      name: string;
    };
  };
  verb: {
    id: string;
    display: {
      [locale: string]: string;
    };
  };
  object: {
    id: string;
    definition: {
      name: {
        [locale: string]: string;
      };
      description?: {
        [locale: string]: string;
      };
      type: string;
    };
  };
  result?: {
    score?: {
      scaled: number; // 0.0 to 1.0
      raw?: number;
      min?: number;
      max?: number;
    };
    success?: boolean;
    completion?: boolean;
  };
  timestamp: string;
}

// ── Input Payloads ──────────────────────────────────────────────────────────

export interface CreateCertificateTemplateInput {
  organizationId: string;
  portalId: string;
  title: string;
  description?: string;
  layout?: CertificateLayout;
  accentColor?: string;
  issuerName: string;
  issuerTitle: string;
  issuerSignatureUrl?: string;
  issuerLogoUrl?: string;
  hasQrVerification?: boolean;
  isDefault?: boolean;
}

export interface IssueCertificateInput {
  organizationId: string;
  portalId: string;
  courseId: string;
  courseTitle: string;
  templateId?: string;
  userId: string;
  recipientName: string;
  recipientEmail: string;
  scoreAchievedPercent?: number;
  transcriptSnapshot?: TranscriptItem[];
}
