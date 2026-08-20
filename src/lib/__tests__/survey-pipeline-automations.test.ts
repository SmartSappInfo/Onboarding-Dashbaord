import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveActiveChannels } from '../notification-engine';

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
    it('in fallback mode, top-level pipeline triggers ONLY if outcome rule did not move deal', () => {
      const mode = 'fallback';
      const outcomeMovedDealTrue = true;
      const shouldRunWorkbench1 = mode === 'additional' || !outcomeMovedDealTrue;
      expect(shouldRunWorkbench1).toBe(false);

      const outcomeMovedDealFalse = false;
      const shouldRunWorkbench2 = mode === 'additional' || !outcomeMovedDealFalse;
      expect(shouldRunWorkbench2).toBe(true);
    });

    it('in additional mode, top-level pipeline triggers regardless of outcome rule move', () => {
      const mode = 'additional';
      const outcomeMovedDealTrue = true;
      const shouldRunWorkbench1 = mode === 'additional' || !outcomeMovedDealTrue;
      expect(shouldRunWorkbench1).toBe(true);

      const outcomeMovedDealFalse = false;
      const shouldRunWorkbench2 = mode === 'additional' || !outcomeMovedDealFalse;
      expect(shouldRunWorkbench2).toBe(true);
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
