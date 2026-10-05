// @vitest-environment node
/**
 * @fileOverview Tenant AI data policy + audio routing (Phase 11 M1 · T4.0; Rules 32, 57, 58).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FakeFirestore } from '../helpers/fake-firestore';
import {
  assertProviderAllowed,
  DataPolicyDeniedError,
  providersAllowedFor,
  resolveAiDataPolicy,
} from '../../policy/ai-data-policy';
import { AiModelRegistry } from '@/lib/ai/model-registry';

let db: FakeFirestore;
beforeEach(() => {
  db = new FakeFirestore();
});

describe('ai data policy', () => {
  it('defaults to today\'s behaviour: every provider allowed when nothing is stored', async () => {
    const policy = await resolveAiDataPolicy(db.asFirestore(), { organizationId: 'org-1', workspaceId: 'ws-a' });
    expect(providersAllowedFor(policy, 'personal').sort()).toEqual(['anthropic', 'googleai', 'openrouter']);
    await expect(assertProviderAllowed(db.asFirestore(), { organizationId: 'org-1', workspaceId: 'ws-a', provider: 'googleai', dataClass: 'personal' })).resolves.toBeUndefined();
  });

  it('workspace override beats organization default; personal data can be restricted separately', async () => {
    db.write('organizations/org-1', { aiDataPolicy: { allowedProviders: ['googleai', 'anthropic'] } });
    db.write('ai_data_policies/ws-a', { blockedForPersonalData: ['googleai'] });
    const policy = await resolveAiDataPolicy(db.asFirestore(), { organizationId: 'org-1', workspaceId: 'ws-a' });
    expect(providersAllowedFor(policy, 'internal')).toEqual(['googleai', 'anthropic']);
    expect(providersAllowedFor(policy, 'personal')).toEqual(['anthropic']);
    await expect(assertProviderAllowed(db.asFirestore(), { organizationId: 'org-1', workspaceId: 'ws-a', provider: 'googleai', dataClass: 'personal' })).rejects.toBeInstanceOf(DataPolicyDeniedError);
  });

  it('a malformed stored policy is the most restrictive, not "allow all"', async () => {
    db.write('ai_data_policies/ws-a', { allowedProviders: 'everything' });
    const policy = await resolveAiDataPolicy(db.asFirestore(), { workspaceId: 'ws-a' });
    expect(providersAllowedFor(policy, 'internal')).toEqual([]);
  });

  it('the global switch blocks all audio egress', async () => {
    db.write('platform_config/meeting_controls', { blockAudioEgress: true });
    await expect(assertProviderAllowed(db.asFirestore(), { workspaceId: 'ws-a', provider: 'googleai', dataClass: 'personal', audio: true })).rejects.toThrow('paused by an administrator');
  });
});

describe('audio model routing (Rule 58)', () => {
  it('only returns audio-capable models from allowed providers', () => {
    const all = AiModelRegistry.getAudioCapableModels();
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((m) => AiModelRegistry.supportsAudio(m) && !m.isDeprecated)).toBe(true);
    expect(AiModelRegistry.getAudioCapableModels(['anthropic'])).toEqual([]);
    expect(all[0].tier).toBe('default');
  });
});
