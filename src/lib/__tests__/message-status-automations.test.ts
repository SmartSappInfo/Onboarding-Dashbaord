import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeMessageNodeConfig, type MessageStatusRule } from '../types';

describe('normalizeMessageNodeConfig & Message Status Automations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('safely normalizes legacy node configs missing statusRules', () => {
    const legacyConfig = {
      templateId: 'tpl_123',
      subject: 'Hello World',
    };

    const normalized = normalizeMessageNodeConfig(legacyConfig);
    expect(normalized.templateId).toBe('tpl_123');
    expect(normalized.subject).toBe('Hello World');
    expect(Array.isArray(normalized.statusRules)).toBe(true);
    expect(normalized.statusRules.length).toBe(0);
  });

  it('preserves existing statusRules when defined', () => {
    const existingRules: MessageStatusRule[] = [
      {
        id: 'rule_opened_1',
        event: 'opened',
        enabled: true,
        actions: [
          {
            id: 'act_1',
            type: 'add_tags',
            tagIds: ['tag_engaged'],
          },
        ],
      },
    ];

    const config = {
      subject: 'Welcome',
      statusRules: existingRules,
    };

    const normalized = normalizeMessageNodeConfig(config);
    expect(normalized.statusRules.length).toBe(1);
    expect(normalized.statusRules[0].event).toBe('opened');
    expect(normalized.statusRules[0].actions[0].type).toBe('add_tags');
  });
});
