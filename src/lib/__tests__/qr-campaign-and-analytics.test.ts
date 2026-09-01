/**
 * @fileoverview Phase 5 Unit Test Suite: QR Campaign Lifecycle,
 * Safe Percent Helper, Telemetry Aggregation, and Funnel Attribution.
 */

import { describe, it, expect } from 'vitest';
import {
  safePercent,
  normalizeQRCampaign,
} from '@/lib/qr-helpers';
import type { QRCampaign } from '@/lib/types';

describe('QR Campaign Actions — Safe Calculation Utilities', () => {
  it('safely handles division by zero and NaN without throwing', () => {
    expect(safePercent(0, 0)).toBe(0);
    expect(safePercent(10, 0)).toBe(0);
    expect(safePercent(NaN, 10)).toBe(0);
    expect(safePercent(5, NaN)).toBe(0);
    expect(safePercent(-5, 10)).toBe(0);
  });

  it('calculates exact conversion percentages', () => {
    expect(safePercent(25, 100)).toBe(25);
    expect(safePercent(1, 3)).toBe(33.3);
    expect(safePercent(50, 200)).toBe(25);
    expect(safePercent(120, 100)).toBe(100); // capped at 100%
  });
});

describe('QR Campaign Model — Normalization & Default Safeguards', () => {
  it('normalizes raw document data with strict typed fallback defaults', () => {
    const rawData = {
      id: 'cmp_123',
      organizationId: 'org_abc',
      workspaceId: 'ws_xyz',
      name: 'Admissions Open Day 2026',
      objective: 'registration',
      status: 'active',
      qrCodeIds: ['qr_1', 'qr_2'],
      metrics: {
        totalScans: 500,
        uniqueVisitors: 420,
        leads: 100,
        conversions: 50,
      },
      createdBy: {
        userId: 'u_1',
        name: 'Jane Doe',
        email: 'jane@test.com',
      },
    };

    const campaign: QRCampaign = normalizeQRCampaign(rawData);

    expect(campaign.id).toBe('cmp_123');
    expect(campaign.name).toBe('Admissions Open Day 2026');
    expect(campaign.objective).toBe('registration');
    expect(campaign.status).toBe('active');
    expect(campaign.qrCodeIds).toEqual(['qr_1', 'qr_2']);
    expect(campaign.metrics.totalScans).toBe(500);
    expect(campaign.metrics.conversions).toBe(50);
    expect(campaign.metrics.conversionRate).toBe(10); // 50 / 500 = 10%
    expect(campaign.attributionConfig.model).toBe('last_touch');
  });

  it('handles empty or missing metrics gracefully without errors', () => {
    const rawData = {
      id: 'cmp_blank',
    };

    const campaign = normalizeQRCampaign(rawData);
    expect(campaign.id).toBe('cmp_blank');
    expect(campaign.name).toBe('Untitled Campaign');
    expect(campaign.objective).toBe('awareness');
    expect(campaign.status).toBe('active');
    expect(campaign.metrics.totalScans).toBe(0);
    expect(campaign.metrics.conversionRate).toBe(0);
    expect(campaign.qrCodeIds).toEqual([]);
  });
});

describe('Attribution Funnel & Conversion Attribution Step Calculations', () => {
  it('computes sequential funnel conversion stages', () => {
    const totalScans = 1000;
    const destinationVisits = Math.round(totalScans * 0.94); // 940
    const engagedSessions = Math.round(totalScans * 0.62); // 620
    const leads = 180;
    const conversions = 81;

    expect(destinationVisits).toBeLessThanOrEqual(totalScans);
    expect(engagedSessions).toBeLessThanOrEqual(destinationVisits);
    expect(leads).toBeLessThanOrEqual(engagedSessions);
    expect(conversions).toBeLessThanOrEqual(leads);

    const visitRate = safePercent(destinationVisits, totalScans);
    const leadRate = safePercent(leads, totalScans);
    const convRate = safePercent(conversions, totalScans);

    expect(visitRate).toBe(94);
    expect(leadRate).toBe(18);
    expect(convRate).toBe(8.1);
  });
});
