/**
 * @fileOverview Unit tests for SmartSapp Messaging Dashboard — Quick Action & Feature Directory Manifest
 * 
 * Conforms to:
 * - Rule 1 (Best Practices & Testability)
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 (Safe Relative Navigation: all routes start with a single '/')
 * - Rule 14 (Immutable manifest, anti-tampering)
 */

import { describe, it, expect } from 'vitest';
import {
  PRIMARY_QUICK_ACTIONS,
  ALL_MESSAGING_FEATURES,
  isValidRelativeRoute,
} from '../quick-action-constants';

describe('quick-action-constants', () => {
  describe('PRIMARY_QUICK_ACTIONS', () => {
    it('defines exactly 4 primary quick action cards matching mockup', () => {
      expect(PRIMARY_QUICK_ACTIONS).toHaveLength(4);
      const ids = PRIMARY_QUICK_ACTIONS.map((a) => a.id);
      expect(ids).toEqual(['new_campaign', 'start_message', 'message_templates', 'manage_queue']);
    });

    it('ensures all primary action routes are strictly relative paths (Rule 8)', () => {
      PRIMARY_QUICK_ACTIONS.forEach((action) => {
        expect(action.href.startsWith('/')).toBe(true);
        expect(action.href.startsWith('//')).toBe(false);
        expect(isValidRelativeRoute(action.href)).toBe(true);
      });
    });

    it('defines non-empty labels, descriptions, and valid accents for all primary actions', () => {
      PRIMARY_QUICK_ACTIONS.forEach((action) => {
        expect(action.title.trim().length).toBeGreaterThan(0);
        expect(action.description.trim().length).toBeGreaterThan(0);
        expect(['purple', 'blue', 'emerald', 'orange']).toContain(action.accentColor);
        expect(['Megaphone', 'Send', 'FileText', 'Clock']).toContain(action.iconName);
      });
    });
  });

  describe('isValidRelativeRoute', () => {
    it('validates genuine internal relative routes', () => {
      expect(isValidRelativeRoute('/admin/messaging/composer')).toBe(true);
      expect(isValidRelativeRoute('/admin/settings?tab=billing')).toBe(true);
      expect(isValidRelativeRoute('/admin/messaging/campaigns/new')).toBe(true);
    });

    it('rejects external URLs, protocol schemes, protocol-relative URLs, and invalid paths (Rule 8)', () => {
      expect(isValidRelativeRoute('https://evil.com')).toBe(false);
      expect(isValidRelativeRoute('http://evil.com')).toBe(false);
      expect(isValidRelativeRoute('//evil.com')).toBe(false);
      expect(isValidRelativeRoute('javascript:alert(1)')).toBe(false);
      expect(isValidRelativeRoute('data:text/html,...')).toBe(false);
      expect(isValidRelativeRoute('/\\evil.com')).toBe(false);
      expect(isValidRelativeRoute('')).toBe(false);
      // @ts-expect-error Testing invalid type input
      expect(isValidRelativeRoute(null)).toBe(false);
      // @ts-expect-error Testing invalid type input
      expect(isValidRelativeRoute(undefined)).toBe(false);
    });
  });

  describe('ALL_MESSAGING_FEATURES', () => {
    it('organizes all messaging features into 3 coherent clusters', () => {
      expect(ALL_MESSAGING_FEATURES).toHaveLength(3);
      const clusterIds = ALL_MESSAGING_FEATURES.map((c) => c.clusterId);
      expect(clusterIds).toEqual(['outbound', 'inbound', 'operations']);
    });

    it('validates that every feature in the directory has safe relative route and non-empty metadata', () => {
      ALL_MESSAGING_FEATURES.forEach((cluster) => {
        expect(cluster.title.length).toBeGreaterThan(0);
        expect(cluster.description.length).toBeGreaterThan(0);
        expect(cluster.items.length).toBeGreaterThan(0);
        cluster.items.forEach((item) => {
          expect(isValidRelativeRoute(item.href)).toBe(true);
          expect(item.title.length).toBeGreaterThan(0);
          expect(item.description.length).toBeGreaterThan(0);
          expect(item.iconName.length).toBeGreaterThan(0);
        });
      });
    });
  });
});
