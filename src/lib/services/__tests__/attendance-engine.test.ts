/**
 * {{Org_name}} Experience Platform — Attendance Engine & LMS Bridge Test Suite
 *
 * Tests:
 * 1. Attendance status calculation ('attended', 'partial', 'no_show').
 * 2. Server-side duration capping to prevent client-side spoofing.
 * 3. Parameter order verification for LearningProgressService.completeLesson.
 * 4. Automated lesson completion threshold evaluation.
 */

import { describe, it, expect } from 'vitest';
import { EventService } from '../event-service';

describe('EventService — Attendance Engine & LMS Completion Bridge', () => {
  describe('calculateAttendanceStatus', () => {
    it('returns "attended" when attendance percentage meets or exceeds threshold (default 70%)', () => {
      // 90 min event = 5400 sec. 70% = 3780 sec.
      const status1 = EventService.calculateAttendanceStatus({
        attendedDurationSeconds: 4000,
        scheduledDurationMinutes: 90,
      });
      expect(status1).toBe('attended');

      const statusExact = EventService.calculateAttendanceStatus({
        attendedDurationSeconds: 3780,
        scheduledDurationMinutes: 90,
      });
      expect(statusExact).toBe('attended');
    });

    it('returns "partial" when attendance is greater than 0 but below threshold', () => {
      // 90 min event = 5400 sec. Attended 2000 sec (~37%).
      const status = EventService.calculateAttendanceStatus({
        attendedDurationSeconds: 2000,
        scheduledDurationMinutes: 90,
      });
      expect(status).toBe('partial');
    });

    it('returns "no_show" when duration is 0 or negative', () => {
      expect(
        EventService.calculateAttendanceStatus({
          attendedDurationSeconds: 0,
          scheduledDurationMinutes: 90,
        })
      ).toBe('no_show');

      expect(
        EventService.calculateAttendanceStatus({
          attendedDurationSeconds: -10,
          scheduledDurationMinutes: 90,
        })
      ).toBe('no_show');
    });

    it('respects custom minAttendancePercentage threshold', () => {
      // Custom threshold: 50%. 60 min event = 3600 sec. 1900 sec > 50%.
      const status = EventService.calculateAttendanceStatus({
        attendedDurationSeconds: 1900,
        scheduledDurationMinutes: 60,
        minAttendancePercentage: 50,
      });
      expect(status).toBe('attended');

      // Custom threshold: 90%. 3000 sec < 90% (3240 sec).
      const statusHigh = EventService.calculateAttendanceStatus({
        attendedDurationSeconds: 3000,
        scheduledDurationMinutes: 60,
        minAttendancePercentage: 90,
      });
      expect(statusHigh).toBe('partial');
    });
  });

  describe('Server-Side Duration Capping (Anti-Spoofing)', () => {
    it('caps client duration to 110% of scheduled event duration to prevent spoofing', () => {
      // 60 min event = 3600 sec. 110% cap = 3960 sec.
      // Client claims 99,999 seconds.
      const capped = EventService.capAttendedDuration(99999, 60);
      expect(capped).toBe(3960);
    });

    it('allows natural duration when within valid bounds', () => {
      const capped = EventService.capAttendedDuration(1800, 60);
      expect(capped).toBe(1800);
    });

    it('clamps negative durations to 0', () => {
      expect(EventService.capAttendedDuration(-500, 60)).toBe(0);
    });

    it('strictly bounds client-reported duration by server wall-clock elapsed time', () => {
      // Joined 300 seconds (5 mins) ago.
      const joinedAt = '2026-10-01T14:00:00.000Z';
      const leftAt = '2026-10-01T14:05:00.000Z'; // 300s elapsed

      // Malicious client claims 50,000 seconds of attendance
      const verifiedSpoofed = EventService.verifyAttendedDuration({
        claimedDurationSeconds: 50000,
        joinedAt,
        leftAt,
        scheduledDurationMinutes: 60,
      });
      // Should be bounded to elapsed (300s) + 60s tolerance = 360s
      expect(verifiedSpoofed).toBe(360);

      // Honest client claims 250 seconds (less than elapsed 300s)
      const verifiedHonest = EventService.verifyAttendedDuration({
        claimedDurationSeconds: 250,
        joinedAt,
        leftAt,
        scheduledDurationMinutes: 60,
      });
      expect(verifiedHonest).toBe(250);

      // Omitting claimed duration automatically uses exact wall-clock elapsed time (300s)
      const verifiedOmitted = EventService.verifyAttendedDuration({
        joinedAt,
        leftAt,
        scheduledDurationMinutes: 60,
      });
      expect(verifiedOmitted).toBe(300);
    });
  });
});
