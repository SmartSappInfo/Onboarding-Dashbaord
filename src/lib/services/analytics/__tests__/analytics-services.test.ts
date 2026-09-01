/**
 * @fileOverview Unit Tests for Analytics 2.0 Services
 */

import { describe, it, expect } from 'vitest';
import { PlatformEventService } from '../platform-event-service';
import { SavedDirectoryViewService } from '../saved-directory-view-service';

describe('PlatformEventService Sanitization', () => {
  it('redacts sensitive keys from metadata payloads', () => {
    const raw = {
      userEmail: 'user@example.com',
      authToken: 'secret_12345',
      passwordHash: 'sha256_hash',
      page: '/admin/users',
    };

    const sanitized = PlatformEventService.sanitizeMetadata(raw);
    expect(sanitized).toBeDefined();
    expect(sanitized?.userEmail).toBe('user@example.com');
    expect(sanitized?.authToken).toBe('[REDACTED]');
    expect(sanitized?.passwordHash).toBe('[REDACTED]');
    expect(sanitized?.page).toBe('/admin/users');
  });
});

describe('SavedDirectoryViewService Presets', () => {
  it('provides 7 canonical preset views', () => {
    const presets = SavedDirectoryViewService.getPresetViews();
    expect(presets.length).toBe(7);
    expect(presets.map((p) => p.name)).toEqual([
      'All People',
      'Pending Approval',
      'Recently Joined',
      'Inactive 30+ Days',
      'Administrators',
      'Finance Access',
      'High Risk / SoD',
    ]);
  });
});
