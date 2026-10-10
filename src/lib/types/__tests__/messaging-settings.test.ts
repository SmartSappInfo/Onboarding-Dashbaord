import { describe, it, expect } from 'vitest';
import {
  WorkspaceMessagingSettingsSchema,
  DEFAULT_MESSAGING_SETTINGS,
  type WorkspaceMessagingSettings,
} from '../messaging-settings';

describe('WorkspaceMessagingSettingsSchema', () => {
  it('validates a valid messaging settings configuration with versioning', () => {
    const validData: WorkspaceMessagingSettings = {
      version: 1,
      lowBalanceThreshold: 150,
      quickTemplateIds: ['tpl_welcome', 'tpl_fee'],
      aiPromptStarters: ['Draft an end-of-term congratulations message'],
      channelKillSwitches: {
        sms: false,
        whatsapp: false,
        email: false,
      },
      allowViewingAllMessages: true,
    };

    const parsed = WorkspaceMessagingSettingsSchema.safeParse(validData);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.version).toBe(1);
      expect(parsed.data.lowBalanceThreshold).toBe(150);
      expect(parsed.data.quickTemplateIds).toHaveLength(2);
    }
  });

  it('populates default values when given an empty object', () => {
    const parsed = WorkspaceMessagingSettingsSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.version).toBe(1);
      expect(parsed.data.lowBalanceThreshold).toBe(100);
      expect(parsed.data.quickTemplateIds).toEqual(DEFAULT_MESSAGING_SETTINGS.quickTemplateIds);
      expect(parsed.data.channelKillSwitches.sms).toBe(false);
      expect(parsed.data.allowViewingAllMessages).toBe(true);
    }
  });

  it('allows disabling allowViewingAllMessages', () => {
    const parsed = WorkspaceMessagingSettingsSchema.safeParse({
      allowViewingAllMessages: false,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.allowViewingAllMessages).toBe(false);
    }
  });

  it('rejects negative low balance thresholds', () => {
    const parsed = WorkspaceMessagingSettingsSchema.safeParse({
      lowBalanceThreshold: -25,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects oversized prompt starters (> 120 chars)', () => {
    const parsed = WorkspaceMessagingSettingsSchema.safeParse({
      aiPromptStarters: ['A'.repeat(121)],
    });
    expect(parsed.success).toBe(false);
  });
});
