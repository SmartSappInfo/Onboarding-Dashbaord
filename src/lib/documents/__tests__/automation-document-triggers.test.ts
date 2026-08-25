import { describe, it, expect } from 'vitest';
import { resolveAutomationTrigger } from '@/lib/automation-trigger-map';
import { evaluateTriggerConfig } from '@/lib/automation-trigger-config';
import type { Automation } from '@/lib/types';

describe('Automation Document Triggers (Phase 10)', () => {
  it('resolves all 6 document activities to their corresponding automation triggers', () => {
    expect(resolveAutomationTrigger('document_opened')).toBe('DOCUMENT_OPENED');
    expect(resolveAutomationTrigger('document_completed')).toBe('DOCUMENT_COMPLETED');
    expect(resolveAutomationTrigger('document_hotspot_clicked')).toBe('DOCUMENT_HOTSPOT_CLICKED');
    expect(resolveAutomationTrigger('document_lead_captured')).toBe('DOCUMENT_LEAD_CAPTURED');
    expect(resolveAutomationTrigger('document_revisited')).toBe('DOCUMENT_REVISITED');
    expect(resolveAutomationTrigger('document_threshold_reached')).toBe('DOCUMENT_THRESHOLD_REACHED');
  });

  describe('evaluateTriggerConfig for Document Triggers', () => {
    const baseAutomation: Automation = {
      id: 'auto_1',
      name: 'Admissions Document Completed Workflow',
      workspaceIds: ['ws_1'],
      isActive: true,
      triggerTypes: ['DOCUMENT_COMPLETED'],
      triggers: [
        {
          id: 'trig_1',
          type: 'DOCUMENT_COMPLETED',
          config: { documentId: 'doc_prospectus_2026' },
        },
      ],
      nodes: [],
      edges: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      createdBy: 'usr_admin',
    };

    it('matches when documentId matches config.documentId', () => {
      const match = evaluateTriggerConfig(baseAutomation, {
        _firingTrigger: 'DOCUMENT_COMPLETED',
        documentId: 'doc_prospectus_2026',
      });
      expect(match).toBe(true);
    });

    it('denies when documentId does not match config.documentId', () => {
      const match = evaluateTriggerConfig(baseAutomation, {
        _firingTrigger: 'DOCUMENT_COMPLETED',
        documentId: 'doc_other_flyer',
      });
      expect(match).toBe(false);
    });

    it('evaluates hotspotId constraint for DOCUMENT_HOTSPOT_CLICKED', () => {
      const hotspotAutomation: Automation = {
        ...baseAutomation,
        triggerTypes: ['DOCUMENT_HOTSPOT_CLICKED'],
        triggers: [
          {
            id: 'trig_hotspot',
            type: 'DOCUMENT_HOTSPOT_CLICKED',
            config: { hotspotId: 'btn_apply_now' },
          },
        ],
      };

      // Match
      expect(
        evaluateTriggerConfig(hotspotAutomation, {
          _firingTrigger: 'DOCUMENT_HOTSPOT_CLICKED',
          elementId: 'btn_apply_now',
        })
      ).toBe(true);

      // Mismatch
      expect(
        evaluateTriggerConfig(hotspotAutomation, {
          _firingTrigger: 'DOCUMENT_HOTSPOT_CLICKED',
          elementId: 'btn_other_link',
        })
      ).toBe(false);
    });

    it('evaluates threshold constraint for DOCUMENT_THRESHOLD_REACHED', () => {
      const thresholdAutomation: Automation = {
        ...baseAutomation,
        triggerTypes: ['DOCUMENT_THRESHOLD_REACHED'],
        triggers: [
          {
            id: 'trig_threshold',
            type: 'DOCUMENT_THRESHOLD_REACHED',
            config: { threshold: 30 },
          },
        ],
      };

      // Score 35 >= 30 -> Pass
      expect(
        evaluateTriggerConfig(thresholdAutomation, {
          _firingTrigger: 'DOCUMENT_THRESHOLD_REACHED',
          engagementScore: 35,
        })
      ).toBe(true);

      // Score 20 < 30 -> Deny
      expect(
        evaluateTriggerConfig(thresholdAutomation, {
          _firingTrigger: 'DOCUMENT_THRESHOLD_REACHED',
          engagementScore: 20,
        })
      ).toBe(false);
    });
  });
});
