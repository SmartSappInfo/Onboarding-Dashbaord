import { describe, it, expect } from 'vitest';
import {
  computeTotalAttendanceSeconds,
  validateRsvpTransition,
  validateAttendanceTransition,
  hashParticipantToken,
  generateSecureJoinToken,
  formatAttendanceDuration,
  getParticipantRoleMeta,
} from '../participant-service';

describe('Participant Domain Service', () => {
  describe('computeTotalAttendanceSeconds', () => {
    it('should return previous seconds if no joinedAt provided', () => {
      expect(computeTotalAttendanceSeconds(undefined, undefined, 120)).toBe(120);
    });

    it('should compute exact duration between joinedAt and leftAt', () => {
      const joinedAt = '2026-06-20T10:00:00.000Z';
      const leftAt = '2026-06-20T10:35:00.000Z';
      const duration = computeTotalAttendanceSeconds(joinedAt, leftAt, 0);
      expect(duration).toBe(35 * 60); // 2100 seconds
    });

    it('should accumulate duration with previousSeconds', () => {
      const joinedAt = '2026-06-20T11:00:00.000Z';
      const leftAt = '2026-06-20T11:10:00.000Z';
      const duration = computeTotalAttendanceSeconds(joinedAt, leftAt, 500);
      expect(duration).toBe(500 + 600); // 1100 seconds
    });
  });

  describe('validateRsvpTransition', () => {
    it('should allow valid transitions', () => {
      expect(validateRsvpTransition('pending', 'accepted')).toBe(true);
      expect(validateRsvpTransition('pending', 'declined')).toBe(true);
      expect(validateRsvpTransition('accepted', 'declined')).toBe(true);
      expect(validateRsvpTransition('declined', 'accepted')).toBe(true);
      expect(validateRsvpTransition('accepted', 'accepted')).toBe(true);
    });
  });

  describe('validateAttendanceTransition', () => {
    it('should allow valid check-in / check-out cycles', () => {
      expect(validateAttendanceTransition('not_joined', 'joined')).toBe(true);
      expect(validateAttendanceTransition('joined', 'left')).toBe(true);
      expect(validateAttendanceTransition('left', 'joined')).toBe(true);
      expect(validateAttendanceTransition('not_joined', 'no_show')).toBe(true);
    });
  });

  describe('Token Hashing & Generation', () => {
    it('should generate consistent SHA-256 hashes', () => {
      const token = 'sample-magic-token-xyz';
      const hash1 = hashParticipantToken(token);
      const hash2 = hashParticipantToken(token);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex length
    });

    it('should generate secure high-entropy token pairs', () => {
      const pair = generateSecureJoinToken();
      expect(pair.rawToken).toHaveLength(48); // 24 bytes hex
      expect(pair.tokenHash).toHaveLength(64);
      expect(hashParticipantToken(pair.rawToken)).toBe(pair.tokenHash);
    });
  });

  describe('formatAttendanceDuration', () => {
    it('should format seconds into readable strings', () => {
      expect(formatAttendanceDuration(0)).toBe('0s');
      expect(formatAttendanceDuration(45)).toBe('45s');
      expect(formatAttendanceDuration(180)).toBe('3m');
      expect(formatAttendanceDuration(3660)).toBe('1h 1m');
    });
  });

  describe('getParticipantRoleMeta', () => {
    it('should return correct role badges and labels', () => {
      expect(getParticipantRoleMeta('host').label).toBe('Host');
      expect(getParticipantRoleMeta('facilitator').label).toBe('Facilitator');
      expect(getParticipantRoleMeta('attendee').label).toBe('Attendee');
    });
  });
});
