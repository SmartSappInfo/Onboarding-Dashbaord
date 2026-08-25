import { describe, it, expect } from 'vitest';
import { PortalInvitationService } from '../portal-invitation-service';

describe('PortalInvitationService', () => {
  describe('Token Generation', () => {
    it('generates secure hex tokens of expected length', () => {
      const token1 = PortalInvitationService.generateToken();
      const token2 = PortalInvitationService.generateToken();

      expect(token1).toBeDefined();
      expect(typeof token1).toBe('string');
      expect(token1.length).toBe(48); // 24 bytes in hex
      expect(token1).not.toBe(token2);
    });
  });
});
