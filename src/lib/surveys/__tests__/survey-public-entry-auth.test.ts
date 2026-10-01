/**
 * Survey / form public entry points (agents_mcp N1 / FU-14).
 *
 * 1. The trusted survey/form runners (which take `workspaceId` from their caller and write CRM
 *    records) are no longer exported from `'use server'` modules, so they are not public endpoints.
 * 2. The results-page button endpoint, which anonymous respondents call, now takes only the button
 *    id: tags, automation and webhook come from the stored survey, the response must belong to the
 *    survey and be linked to the entity, and the webhook goes through the SSRF-safe fetch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Doc = Record<string, unknown>;

const h = vi.hoisted(() => ({
  surveys: new Map<string, Record<string, unknown>>(),
  responses: new Map<string, Record<string, unknown>>(),
  calls: [] as Array<{ fn: string; args: unknown[] }>,
}));

vi.mock('@/lib/firebase-admin', () => {
  const snap = (data: Doc | undefined, id: string) => ({ id, exists: Boolean(data), data: () => data, get: (f: string) => data?.[f] });
  return {
    adminDb: {
      collection: (name: string) => ({
        doc: (id: string) => ({
          get: async () => snap(name === 'surveys' ? h.surveys.get(id) : undefined, id),
          collection: () => ({
            doc: (rid: string) => ({ get: async () => snap(h.responses.get(`${id}/${rid}`), rid) }),
          }),
        }),
      }),
    },
  };
});
vi.mock('@/lib/crm/deal-core', async () => {
  const actual = await vi.importActual<typeof import('@/lib/crm/deal-core')>('@/lib/crm/deal-core');
  return {
    ...actual,
    resolveWorkspaceEntityRecord: vi.fn(async (ws: string, ent: string) => ({ id: `${ws}_${ent}`, displayName: 'Acme', primaryEmail: 'a@b.c' })),
  };
});
vi.mock('@/lib/tag-actions', () => ({ applyTagsAction: vi.fn(async (...args: unknown[]) => { h.calls.push({ fn: 'tags', args }); }) }));
vi.mock('@/lib/automation-processor', () => ({ runAutomationById: vi.fn(async (...args: unknown[]) => { h.calls.push({ fn: 'automation', args }); }), triggerAutomationProtocols: vi.fn() }));
vi.mock('@/lib/security/ssrf-guard', () => ({ safeUrlFetch: vi.fn(async (...args: unknown[]) => { h.calls.push({ fn: 'webhook', args }); return new Response(null); }) }));

import { executeSurveyResultButtonActions } from '@/lib/survey-actions';

const SRC = join(process.cwd(), 'src/lib');
const exportedFunctions = (file: string) =>
  [...readFileSync(join(SRC, file), 'utf8').matchAll(/^export async function (\w+)/gm)].map((m) => m[1]);
const isServerActionModule = (file: string) => /^\s*['"]use server['"]/.test(readFileSync(join(SRC, file), 'utf8'));

describe('survey/form trusted runners are not public endpoints', () => {
  it.each([
    ['survey-actions.ts', ['executeSurveyPipelineAndAutomations', 'addOrMoveEntityInPipeline']],
    ['surveys/survey-decision-engine.ts', ['executeSingleDecisionAction', 'executeSurveyDecisioningPipelineAction']],
    ['surveys/survey-crm-sync-actions.ts', ['executeSurveyCrmSyncAction']],
  ])('%s does not export them', (file, names) => {
    expect(isServerActionModule(file)).toBe(true);
    const exported = exportedFunctions(file);
    for (const name of names) expect(exported).not.toContain(name);
  });

  it.each(['forms/identity-resolution.ts', 'surveys/survey-decision-runner.ts', 'surveys/survey-crm-sync-runner.ts'])(
    '%s is not a Server Action module',
    (file) => expect(isServerActionModule(file)).toBe(false)
  );
});

describe('executeSurveyResultButtonActions (public)', () => {
  const button = { id: 'btn_1', type: 'button', addTagIds: ['tag_ok'], triggerAutomationId: 'auto_ok', fireWebhookEnabled: true, fireWebhookUrl: 'https://hooks.example.com/x' };
  const run = (over: Partial<{ surveyId: string; responseId: string; entityId: string; blockId: string }> = {}) =>
    executeSurveyResultButtonActions({ surveyId: 's1', responseId: 'r1', entityId: 'ent_1', blockId: 'btn_1', ...over });

  beforeEach(() => {
    h.calls.length = 0;
    h.surveys.clear();
    h.responses.clear();
    h.surveys.set('s1', { title: 'S', workspaceIds: ['ws_a'], organizationId: 'org_a', resultPages: [{ id: 'p', name: 'P', isDefault: true, blocks: [button] }] });
    h.responses.set('s1/r1', { entityId: 'ent_1' });
    h.responses.set('s1/r_other', { entityId: 'ent_2' });
  });

  it('runs only what the stored button configures', async () => {
    expect(await run()).toMatchObject({ success: true });
    expect(h.calls.map((c) => c.fn)).toEqual(['tags', 'automation', 'webhook']);
    expect(h.calls[0].args[2]).toEqual(['tag_ok']);
    expect(h.calls[1].args[0]).toBe('auto_ok');
    expect(h.calls[2].args[0]).toBe('https://hooks.example.com/x');
  });

  it('ignores browser-supplied actions (unknown button)', async () => {
    expect(await run({ blockId: 'btn_forged' })).toMatchObject({ success: false });
    expect(h.calls).toEqual([]);
  });

  it('refuses entities not linked to the response, and responses of other surveys', async () => {
    expect(await run({ entityId: 'victim_entity' })).toMatchObject({ success: false });
    expect(await run({ responseId: 'r_other' })).toMatchObject({ success: false });
    expect(await run({ responseId: 'missing' })).toMatchObject({ success: false });
    expect(h.calls).toEqual([]);
  });

  it('accepts the workspace-prefixed entity id form', async () => {
    expect(await run({ entityId: 'ws_a_ent_1' })).toMatchObject({ success: true });
  });
});
