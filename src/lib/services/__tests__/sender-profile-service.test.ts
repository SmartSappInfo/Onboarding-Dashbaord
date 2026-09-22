import { describe, it, expect } from 'vitest';
import { SenderProfileService } from '../sender-profile-service';
import type { SenderProfile } from '@/lib/types';

describe('SenderProfileService', () => {
  const mockSmartSappEmail: SenderProfile = {
    id: 'sp-smartsapp-email',
    organizationId: 'smartsapp-hq',
    name: 'SmartSapp Alerts',
    channel: 'email',
    identifier: 'notifications@smartsapp.com',
    workspaceIds: ['ws-main'],
    isActive: true,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockSmartSappSms: SenderProfile = {
    id: 'sp-smartsapp-sms',
    organizationId: 'smartsapp-hq',
    name: 'SmartSapp SMS',
    channel: 'sms',
    identifier: 'SmartSapp',
    workspaceIds: ['ws-main'],
    isActive: true,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Contaminated / Leaked profile: labeled TechPatrons or Campus-Supply under smartsapp-hq
  const mockLeakedEmail: SenderProfile = {
    id: 'hHxhuqR1krALkfCxFM2Q',
    organizationId: 'smartsapp-hq',
    name: 'Campus-Supply',
    channel: 'email',
    identifier: 'info@techpatrons.com', // foreign domain!
    workspaceIds: ['ws-main'],
    isActive: true,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockLeakedSms: SenderProfile = {
    id: 'I2zCXvxIRWsus0RdWHhL',
    organizationId: 'smartsapp-hq',
    name: 'TechPatrons',
    channel: 'sms',
    identifier: 'TechPatrons', // foreign SMS identity!
    workspaceIds: ['ws-main'],
    isActive: true,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockTechPatronsProfile: SenderProfile = {
    id: 'sp-tp-1',
    organizationId: 'techpatrons-36c2',
    name: 'TechPatrons Support',
    channel: 'email',
    identifier: 'support@techpatrons.com',
    workspaceIds: ['ws-tp'],
    isActive: true,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe('normalizeSentinel & isSentinel', () => {
    it('correctly handles sentinel strings', () => {
      expect(SenderProfileService.isSentinel('default')).toBe(true);
      expect(SenderProfileService.isSentinel('none')).toBe(true);
      expect(SenderProfileService.isSentinel('whatsapp')).toBe(true);
      expect(SenderProfileService.isSentinel('')).toBe(true);
      expect(SenderProfileService.isSentinel(null)).toBe(true);
      expect(SenderProfileService.isSentinel(undefined)).toBe(true);
      expect(SenderProfileService.isSentinel('sp-123')).toBe(false);

      expect(SenderProfileService.normalizeSentinel('default')).toBeNull();
      expect(SenderProfileService.normalizeSentinel('  none  ')).toBeNull();
      expect(SenderProfileService.normalizeSentinel('sp-valid')).toBe('sp-valid');
      expect(SenderProfileService.normalizeSentinel(null)).toBeNull();
    });
  });

  describe('extractDomain', () => {
    it('extracts clean lowercase domains', () => {
      expect(SenderProfileService.extractDomain('hello@smartsapp.com')).toBe('smartsapp.com');
      expect(SenderProfileService.extractDomain('User@Sub.TechPatrons.COM')).toBe('sub.techpatrons.com');
      expect(SenderProfileService.extractDomain('invalid-email')).toBe('');
      expect(SenderProfileService.extractDomain('test@')).toBe('');
    });
  });

  describe('isDomainAllowedForOrg', () => {
    it('rejects foreign tenant domains for smartsapp-hq', () => {
      const allowed = SenderProfileService.isDomainAllowedForOrg('info@techpatrons.com', {
        id: 'smartsapp-hq',
        resendDomain: 'smartsapp.com',
      });
      expect(allowed).toBe(false);
    });

    it('rejects campus-supply.com for smartsapp-hq', () => {
      const allowed = SenderProfileService.isDomainAllowedForOrg('alerts@campus-supply.com', {
        id: 'smartsapp-hq',
        resendDomain: 'smartsapp.com',
      });
      expect(allowed).toBe(false);
    });

    it('allows verified org domain and subdomains', () => {
      const allowed = SenderProfileService.isDomainAllowedForOrg('mail@smartsapp.com', {
        id: 'smartsapp-hq',
        resendDomain: 'smartsapp.com',
      });
      expect(allowed).toBe(true);

      const subAllowed = SenderProfileService.isDomainAllowedForOrg('notify@mail.smartsapp.com', {
        id: 'smartsapp-hq',
        resendDomain: 'smartsapp.com',
      });
      expect(subAllowed).toBe(true);
    });

    it('allows techpatrons.com for techpatrons-36c2 org', () => {
      const allowed = SenderProfileService.isDomainAllowedForOrg('info@techpatrons.com', {
        id: 'techpatrons-36c2',
        resendDomain: 'techpatrons.com',
      });
      expect(allowed).toBe(true);
    });
  });

  describe('isSmsSenderAllowedForOrg', () => {
    it('rejects TechPatrons SMS sender ID for smartsapp-hq', () => {
      expect(SenderProfileService.isSmsSenderAllowedForOrg('TechPatrons', 'smartsapp-hq')).toBe(false);
    });

    it('allows TechPatrons SMS sender ID for techpatrons-36c2', () => {
      expect(SenderProfileService.isSmsSenderAllowedForOrg('TechPatrons', 'techpatrons-36c2')).toBe(true);
    });

    it('rejects SmartSapp SMS sender ID for other orgs', () => {
      expect(SenderProfileService.isSmsSenderAllowedForOrg('SmartSapp', 'techpatrons-36c2')).toBe(false);
    });

    it('allows non-colliding generic SMS sender IDs', () => {
      expect(SenderProfileService.isSmsSenderAllowedForOrg('MyCompany', 'org-123')).toBe(true);
    });
  });

  describe('filterProfilesForOrganization', () => {
    const allProfiles = [
      mockSmartSappEmail,
      mockSmartSappSms,
      mockLeakedEmail,
      mockLeakedSms,
      mockTechPatronsProfile,
    ];

    it('strictly isolates profiles and filters out contaminated foreign tenant profiles', () => {
      const smartSappProfiles = SenderProfileService.filterProfilesForOrganization(
        allProfiles,
        'smartsapp-hq',
        {
          orgDoc: { id: 'smartsapp-hq', resendDomain: 'smartsapp.com' },
        }
      );

      // Should include SmartSapp Email and SmartSapp SMS
      expect(smartSappProfiles.map((p) => p.id)).toEqual(['sp-smartsapp-email', 'sp-smartsapp-sms']);

      // Must NEVER include the leaked profiles even though their organizationId field in DB was 'smartsapp-hq'
      expect(smartSappProfiles.some((p) => p.id === mockLeakedEmail.id)).toBe(false);
      expect(smartSappProfiles.some((p) => p.id === mockLeakedSms.id)).toBe(false);

      // Must NEVER include TechPatrons legitimate profile
      expect(smartSappProfiles.some((p) => p.id === mockTechPatronsProfile.id)).toBe(false);
    });

    it('filters by channel correctly', () => {
      const emailOnly = SenderProfileService.filterProfilesForOrganization(
        allProfiles,
        'smartsapp-hq',
        {
          channel: 'email',
          orgDoc: { id: 'smartsapp-hq', resendDomain: 'smartsapp.com' },
        }
      );
      expect(emailOnly.map((p) => p.id)).toEqual(['sp-smartsapp-email']);

      const smsOnly = SenderProfileService.filterProfilesForOrganization(
        allProfiles,
        'smartsapp-hq',
        {
          channel: 'sms',
        }
      );
      expect(smsOnly.map((p) => p.id)).toEqual(['sp-smartsapp-sms']);
    });

    it('filters by workspace correctly when filterByWorkspace is true', () => {
      const scopedProfiles: SenderProfile[] = [
        { ...mockSmartSappEmail, id: 'sp-ws-1', name: 'Profile A', workspaceIds: ['ws-1'] },
        { ...mockSmartSappEmail, id: 'sp-ws-2', name: 'Profile B', workspaceIds: ['ws-2'] },
        { ...mockSmartSappEmail, id: 'sp-global', name: 'Profile Global', workspaceIds: [] },
      ];

      const ws1Profiles = SenderProfileService.filterProfilesForOrganization(
        scopedProfiles,
        'smartsapp-hq',
        {
          workspaceId: 'ws-1',
          filterByWorkspace: true,
          orgDoc: { id: 'smartsapp-hq', resendDomain: 'smartsapp.com' },
        }
      );

      // Profile A (explicit ws-1) and Profile Global (empty workspaceIds means all) should be present
      expect(ws1Profiles.map((p) => p.id)).toContain('sp-ws-1');
      expect(ws1Profiles.map((p) => p.id)).toContain('sp-global');
      expect(ws1Profiles.map((p) => p.id)).not.toContain('sp-ws-2');
    });

    it('returns empty array when orgId is missing or empty', () => {
      expect(SenderProfileService.filterProfilesForOrganization(allProfiles, null)).toEqual([]);
      expect(SenderProfileService.filterProfilesForOrganization(allProfiles, '')).toEqual([]);
      expect(SenderProfileService.filterProfilesForOrganization(null, 'smartsapp-hq')).toEqual([]);
    });
  });

  describe('resolveDefaultProfile', () => {
    it('prioritizes orgDoc default pointer', () => {
      const profiles = [mockSmartSappEmail, mockSmartSappSms];
      const orgDoc = {
        defaultSenderProfileIds: {
          email: 'sp-smartsapp-email',
          sms: 'sp-smartsapp-sms',
        },
      };

      const defaultEmail = SenderProfileService.resolveDefaultProfile(profiles, orgDoc, 'email');
      expect(defaultEmail?.id).toBe('sp-smartsapp-email');

      const defaultSms = SenderProfileService.resolveDefaultProfile(profiles, orgDoc, 'sms');
      expect(defaultSms?.id).toBe('sp-smartsapp-sms');
    });

    it('falls back to isDefault flag if orgDoc has no pointer', () => {
      const profiles = [mockSmartSappEmail, mockSmartSappSms];
      const defaultEmail = SenderProfileService.resolveDefaultProfile(profiles, null, 'email');
      expect(defaultEmail?.id).toBe('sp-smartsapp-email');
    });

    it('falls back to first active profile if no default flag is present', () => {
      const nonDefaultProfiles: SenderProfile[] = [
        { ...mockSmartSappSms, isDefault: false },
      ];
      const resolved = SenderProfileService.resolveDefaultProfile(nonDefaultProfiles, null, 'sms');
      expect(resolved?.id).toBe('sp-smartsapp-sms');
    });
  });

  describe('resolveDefaultSenderId', () => {
    it('creates a safe alphanumeric SMS sender id max 11 characters', () => {
      expect(SenderProfileService.resolveDefaultSenderId({ name: 'Acme Logistics Ltd' }, 'sms')).toBe('AcmeLogisti');
      expect(SenderProfileService.resolveDefaultSenderId({ name: 'TechPatrons' }, 'sms')).toBe('TechPatrons');
      expect(SenderProfileService.resolveDefaultSenderId(null, 'sms')).toBe('Notify');
    });
  });

  describe('validateSenderAuthorization', () => {
    it('returns valid for legitimate profile matching org and channel', () => {
      const result = SenderProfileService.validateSenderAuthorization(
        mockSmartSappEmail,
        'smartsapp-hq',
        'email',
        { id: 'smartsapp-hq', resendDomain: 'smartsapp.com' }
      );
      expect(result.valid).toBe(true);
      expect(result.reason).toBe('valid');
    });

    it('returns foreign_organization when organizationId does not match', () => {
      const result = SenderProfileService.validateSenderAuthorization(
        mockTechPatronsProfile,
        'smartsapp-hq',
        'email'
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('foreign_organization');
    });

    it('returns foreign_domain when profile email domain belongs to another known tenant', () => {
      const result = SenderProfileService.validateSenderAuthorization(
        mockLeakedEmail,
        'smartsapp-hq',
        'email',
        { id: 'smartsapp-hq', resendDomain: 'smartsapp.com' }
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('foreign_domain');
    });

    it('returns foreign_sms_sender when SMS ID belongs to another known tenant', () => {
      const result = SenderProfileService.validateSenderAuthorization(
        mockLeakedSms,
        'smartsapp-hq',
        'sms'
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('foreign_sms_sender');
    });

    it('returns channel_mismatch when profile channel differs', () => {
      const result = SenderProfileService.validateSenderAuthorization(
        mockSmartSappEmail,
        'smartsapp-hq',
        'sms'
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('channel_mismatch');
    });

    it('returns inactive when profile isActive is false', () => {
      const inactive = { ...mockSmartSappEmail, isActive: false };
      const result = SenderProfileService.validateSenderAuthorization(
        inactive,
        'smartsapp-hq',
        'email'
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('inactive');
    });
  });
});
