/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Assurance Profile & Jurisdictional Policy Engine (Phase 6):
 * 1. Single Source of Truth for E-Signature Legal Levels:
 *    Governs Simple (SES), Advanced (AES), and Qualified (QES) e-signature
 *    profiles according to eIDAS / ESIGN / UETA legal assurances.
 * 2. Tenant Isolation & Precedence:
 *    System built-in profiles are provided globally ('profile_ses_standard',
 *    'profile_aes_standard', 'profile_qes_standard'), while workspace-specific
 *    custom profiles are stored in `workspaces/{workspaceId}/assurance_profiles`.
 * 3. Pre-Dispatch Compliance Validation:
 *    Before an envelope is dispatched, `validateEnvelopeAssuranceCompliance`
 *    verifies all signers and countersigners provide required verification
 *    channels (e.g., SMS phone number for SMS OTP).
 * 4. Zero Tolerance Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { adminDb } from '@/lib/firebase-admin';
import {
  AssuranceProfile,
  AssuranceProfileSchema,
  AssuranceAuthMethod,
} from '@/lib/types/document-signing';
import { randomUUID } from 'crypto';

export const BUILT_IN_ASSURANCE_PROFILES: readonly AssuranceProfile[] = [
  {
    id: 'profile_ses_standard',
    workspaceId: 'system',
    name: 'Standard Electronic Signature (SES)',
    level: 'simple',
    description: 'Basic e-signature verified via secure email access link. Suitable for routine commercial contracts and NDAs.',
    requiredAuth: ['email_link'],
    requireSignatureBiometrics: false,
    certificateStandard: 'standard',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'profile_aes_standard',
    workspaceId: 'system',
    name: 'Advanced Electronic Signature (AES)',
    level: 'advanced',
    description: 'Enhanced e-signature requiring dual-factor OTP (Email or SMS) and biometric signature stroke telemetry.',
    requiredAuth: ['sms_otp'],
    requireSignatureBiometrics: true,
    certificateStandard: 'pki_x509',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'profile_qes_standard',
    workspaceId: 'system',
    name: 'Qualified Electronic Signature (QES / Witnessed)',
    level: 'qualified',
    description: 'Maximum legal assurance under eIDAS Article 25. Requires official government ID verification or licensed witness.',
    requiredAuth: ['id_verification', 'sms_otp'],
    requireSignatureBiometrics: true,
    certificateStandard: 'qualified_trust',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
] as const;

export interface RecipientComplianceInput {
  id: string;
  role: string;
  email?: string;
  phone?: string;
  authMethods?: string[];
}

export interface AssuranceValidationResult {
  compliant: boolean;
  errors: string[];
}

/**
 * Retrieves all assurance profiles applicable to a workspace (built-ins + custom).
 */
export async function getWorkspaceAssuranceProfiles(
  workspaceId: string
): Promise<AssuranceProfile[]> {
  const customSnapshot = await adminDb
    .collection(`workspaces/${workspaceId}/assurance_profiles`)
    .get();

  const customProfiles: AssuranceProfile[] = [];
  for (const doc of customSnapshot.docs) {
    const parsed = AssuranceProfileSchema.safeParse(doc.data());
    if (parsed.success && parsed.data.workspaceId === workspaceId) {
      customProfiles.push(parsed.data);
    }
  }

  return [...BUILT_IN_ASSURANCE_PROFILES, ...customProfiles];
}

/**
 * Retrieves an assurance profile by ID with strict workspace tenant boundary checking.
 */
export async function getAssuranceProfileById(
  workspaceId: string,
  profileId: string
): Promise<AssuranceProfile | null> {
  // 1. Check built-ins first
  const builtIn = BUILT_IN_ASSURANCE_PROFILES.find((p) => p.id === profileId);
  if (builtIn) {
    return builtIn;
  }

  // 2. Check workspace-scoped custom collection
  const docRef = adminDb.collection(`workspaces/${workspaceId}/assurance_profiles`).doc(profileId);
  const snap = await docRef.get();
  if (!snap.exists) {
    return null;
  }

  const data = snap.data();
  const parsed = AssuranceProfileSchema.safeParse(data);
  if (!parsed.success) {
    return null;
  }

  // Strict tenant isolation guard
  if (parsed.data.workspaceId !== workspaceId) {
    return null;
  }

  return parsed.data;
}

/**
 * Creates and persists a custom assurance profile for a workspace.
 */
export async function createWorkspaceAssuranceProfile(
  workspaceId: string,
  input: Omit<AssuranceProfile, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>
): Promise<AssuranceProfile> {
  const profileId = `prof_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date().toISOString();

  const profileData: AssuranceProfile = {
    ...input,
    id: profileId,
    workspaceId,
    createdAt: now,
    updatedAt: now,
  };

  const validated = AssuranceProfileSchema.parse(profileData);

  await adminDb
    .collection(`workspaces/${workspaceId}/assurance_profiles`)
    .doc(profileId)
    .set(validated);

  return validated;
}

/**
 * Validates that all active signing recipients meet the identity & channel requirements
 * defined by the selected Assurance Profile. Non-signing recipients (e.g. viewers) are excluded.
 */
export function validateEnvelopeAssuranceCompliance(
  profile: AssuranceProfile,
  recipients: RecipientComplianceInput[]
): AssuranceValidationResult {
  const errors: string[] = [];

  const signingRoles = new Set(['signer', 'countersigner', 'approver']);
  const activeSigners = recipients.filter((r) => signingRoles.has(r.role));

  for (const recipient of activeSigners) {
    // Check Email Link / Email OTP requirements
    if (
      profile.requiredAuth.includes('email_link') ||
      profile.requiredAuth.includes('email_otp')
    ) {
      if (!recipient.email || recipient.email.trim().length === 0) {
        errors.push(
          `Recipient ${recipient.id} (${recipient.role}): Valid email address is required for email assurance.`
        );
      }
    }

    // Check SMS OTP requirements
    if (profile.requiredAuth.includes('sms_otp')) {
      if (!recipient.phone || recipient.phone.trim().length === 0) {
        errors.push(
          `Recipient ${recipient.id} (${recipient.role}): Verified phone number is required for SMS OTP authentication.`
        );
      }
    }
  }

  return {
    compliant: errors.length === 0,
    errors,
  };
}

/**
 * Evaluates whether a signer has completed all authentication steps required by an assurance profile.
 */
export function verifyRecipientAuthEligibility(
  profile: AssuranceProfile,
  completedAuthMethods: string[]
): boolean {
  const completedSet = new Set(completedAuthMethods);
  return profile.requiredAuth.every((method: AssuranceAuthMethod) => completedSet.has(method));
}
