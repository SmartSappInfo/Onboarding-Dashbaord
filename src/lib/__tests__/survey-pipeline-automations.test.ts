import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveActiveChannels } from '../notification-channel-utils';

describe('Survey Multi-Channel & Pipeline Automations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveActiveChannels', () => {
    it('returns empty array when no channel is configured', () => {
      expect(resolveActiveChannels()).toEqual([]);
      expect(resolveActiveChannels(undefined, [])).toEqual([]);
    });

    it('correctly parses object options with channels array', () => {
      expect(resolveActiveChannels({ channels: ['email', 'whatsapp'] })).toEqual(['email', 'whatsapp']);
      expect(resolveActiveChannels({ channels: ['sms'] })).toEqual(['sms']);
      expect(resolveActiveChannels({ channel: 'email', channels: ['whatsapp'] })).toEqual(['whatsapp']);
      expect(resolveActiveChannels({ channel: 'all' })).toEqual(['email', 'sms', 'whatsapp']);
    });

    it('correctly maps legacy single string channel', () => {
      expect(resolveActiveChannels('email')).toEqual(['email']);
      expect(resolveActiveChannels('sms')).toEqual(['sms']);
      expect(resolveActiveChannels('whatsapp')).toEqual(['whatsapp']);
      expect(resolveActiveChannels('both')).toEqual(['email', 'sms']);
      expect(resolveActiveChannels('all')).toEqual(['email', 'sms', 'whatsapp']);
    });

    it('prioritizes explicit channels array when provided', () => {
      expect(resolveActiveChannels('email', ['sms', 'whatsapp'])).toEqual(['sms', 'whatsapp']);
      expect(resolveActiveChannels(undefined, ['email', 'whatsapp'])).toEqual(['email', 'whatsapp']);
      expect(resolveActiveChannels(undefined, ['email', 'sms', 'whatsapp'])).toEqual(['email', 'sms', 'whatsapp']);
    });

    it('falls back to single channel if channels array is empty', () => {
      expect(resolveActiveChannels('whatsapp', [])).toEqual(['whatsapp']);
      expect(resolveActiveChannels('both', [])).toEqual(['email', 'sms']);
    });

    it('deduplicates channels', () => {
      expect(resolveActiveChannels(undefined, ['email', 'email', 'sms'])).toEqual(['email', 'sms']);
    });
  });

  describe('Execution Strategy Logic: Fallback vs Additional', () => {
    const shouldExecuteWorkbench = (mode: 'fallback' | 'additional', outcomeMovedDeal: boolean): boolean => {
      return mode === 'additional' || !outcomeMovedDeal;
    };

    it('in fallback mode, top-level pipeline triggers ONLY if outcome rule did not move deal', () => {
      expect(shouldExecuteWorkbench('fallback', true)).toBe(false);
      expect(shouldExecuteWorkbench('fallback', false)).toBe(true);
    });

    it('in additional mode, top-level pipeline triggers regardless of outcome rule move', () => {
      expect(shouldExecuteWorkbench('additional', true)).toBe(true);
      expect(shouldExecuteWorkbench('additional', false)).toBe(true);
    });
  });

  describe('Entity ID Normalization', () => {
    it('cleans workspace prefix from entityId to prevent double prefixing', () => {
      const workspaceId = 'ws_123';
      const entityIdWithPrefix = 'ws_123_school_456';
      const cleanEntityId = entityIdWithPrefix.startsWith(`${workspaceId}_`)
        ? entityIdWithPrefix.slice(workspaceId.length + 1)
        : entityIdWithPrefix;

      expect(cleanEntityId).toBe('school_456');

      const bareEntityId = 'school_456';
      const cleanBareId = bareEntityId.startsWith(`${workspaceId}_`)
        ? bareEntityId.slice(workspaceId.length + 1)
        : bareEntityId;

      expect(cleanBareId).toBe('school_456');
    });
  });
});
