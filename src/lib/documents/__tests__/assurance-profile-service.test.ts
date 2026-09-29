import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getWorkspaceAssuranceProfiles,
  getAssuranceProfileById,
  createWorkspaceAssuranceProfile,
  validateEnvelopeAssuranceCompliance,
  verifyRecipientAuthEligibility,
} from '@/lib/documents/assurance-profile-service';
import { AssuranceProfile } from '@/lib/types/document-signing';

// Mock Firestore
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((collPath: string) => {
      mockCollection(collPath);
      return {
        doc: vi.fn((docId: string) => {
          mockDoc(docId);
          return {
            get: mockGet,
            set: mockSet,
          };
        }),
        get: mockGet,
      };
    }),
  },
}));

describe('Assurance Profile & Jurisdictional Policy Service', () => {
  const workspaceId = 'ws_legal_ops';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Built-in profiles and lookup', () => {
    it('returns built-in profiles (SES, AES, QES) when no custom profiles exist', async () => {
      mockGet.mockResolvedValueOnce({
        empty: true,
        docs: [],
      });

      const profiles = await getWorkspaceAssuranceProfiles(workspaceId);
      expect(profiles.length).toBeGreaterThanOrEqual(3);

      const ses = profiles.find((p) => p.level === 'simple');
      const aes = profiles.find((p) => p.level === 'advanced');
      const qes = profiles.find((p) => p.level === 'qualified');

      expect(ses?.name).toContain('SES');
      expect(aes?.name).toContain('AES');
      expect(qes?.name).toContain('QES');
    });

    it('resolves built-in profile by ID (e.g. built-in SES)', async () => {
      mockGet.mockResolvedValueOnce({
        exists: false,
      });

      const profile = await getAssuranceProfileById(workspaceId, 'profile_ses_standard');
      expect(profile).not.toBeNull();
      expect(profile?.level).toBe('simple');
      expect(profile?.requiredAuth).toContain('email_link');
    });

    it('enforces tenant isolation and rejects cross-workspace profile lookup', async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: 'custom_prof_99',
          workspaceId: 'other_workspace_evil',
          name: 'Compromised Profile',
          level: 'simple',
          requiredAuth: ['email_link'],
          certificateStandard: 'standard',
          requireSignatureBiometrics: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });

      const profile = await getAssuranceProfileById(workspaceId, 'custom_prof_99');
      expect(profile).toBeNull();
    });
  });

  describe('Envelope Assurance Compliance Validation', () => {
    const sesProfile: AssuranceProfile = {
      id: 'profile_ses_standard',
      workspaceId: 'system',
      name: 'Standard SES',
      level: 'simple',
      requiredAuth: ['email_link'],
      requireSignatureBiometrics: false,
      certificateStandard: 'standard',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const aesProfile: AssuranceProfile = {
      id: 'profile_aes_standard',
      workspaceId: 'system',
      name: 'Advanced AES',
      level: 'advanced',
      requiredAuth: ['sms_otp'],
      requireSignatureBiometrics: true,
      certificateStandard: 'pki_x509',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('approves compliant envelope recipients for SES', () => {
      const recipients = [
        { id: 'r1', role: 'signer', email: 'alice@corp.com' },
        { id: 'r2', role: 'countersigner', email: 'bob@corp.com' },
      ];

      const result = validateEnvelopeAssuranceCompliance(sesProfile, recipients);
      expect(result.compliant).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails compliance if a signer lacks a phone number under an SMS OTP required profile', () => {
      const recipients = [
        { id: 'r1', role: 'signer', email: 'alice@corp.com', phone: '+15551234567' },
        { id: 'r2', role: 'signer', email: 'charlie@corp.com' }, // Missing phone!
      ];

      const result = validateEnvelopeAssuranceCompliance(aesProfile, recipients);
      expect(result.compliant).toBe(false);
      expect(result.errors[0]).toContain('phone number is required for SMS OTP');
    });

    it('ignores non-signing viewers when enforcing signature assurance rules', () => {
      const recipients = [
        { id: 'r1', role: 'signer', email: 'alice@corp.com', phone: '+15551234567' },
        { id: 'r2', role: 'viewer', email: 'legal-observer@corp.com' }, // Viewer doesn't sign
      ];

      const result = validateEnvelopeAssuranceCompliance(aesProfile, recipients);
      expect(result.compliant).toBe(true);
    });
  });

  describe('verifyRecipientAuthEligibility', () => {
    it('verifies that all required authentication methods are completed', () => {
      const qesProfile: AssuranceProfile = {
        id: 'profile_qes_standard',
        workspaceId: 'system',
        name: 'Qualified QES',
        level: 'qualified',
        requiredAuth: ['id_verification', 'sms_otp'],
        requireSignatureBiometrics: true,
        certificateStandard: 'qualified_trust',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(verifyRecipientAuthEligibility(qesProfile, ['sms_otp'])).toBe(false);
      expect(verifyRecipientAuthEligibility(qesProfile, ['id_verification'])).toBe(false);
      expect(verifyRecipientAuthEligibility(qesProfile, ['sms_otp', 'id_verification'])).toBe(true);
      expect(verifyRecipientAuthEligibility(qesProfile, ['sms_otp', 'id_verification', 'email_link'])).toBe(true);
    });
  });

  describe('createWorkspaceAssuranceProfile', () => {
    it('persists a new custom assurance profile with schema validation', async () => {
      mockSet.mockResolvedValueOnce(undefined);

      const created = await createWorkspaceAssuranceProfile(workspaceId, {
        name: 'Custom High-Assurance Profile',
        level: 'advanced',
        description: 'Requires SMS and biometrics',
        requiredAuth: ['sms_otp', 'email_otp'],
        requireSignatureBiometrics: true,
        certificateStandard: 'pki_x509',
      });

      expect(created.id).toContain('prof_');
      expect(created.workspaceId).toBe(workspaceId);
      expect(created.level).toBe('advanced');
      expect(mockSet).toHaveBeenCalledTimes(1);
    });
  });
});
