// @vitest-environment node
/**
 * @fileOverview Tests for the inventory analysis helpers (round-2 blocker R5).
 * Pins the misclassifications found in review so they cannot regress.
 */

import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import {
  analyzeNode,
  classifyByName,
  classifyHttpMethod,
  duplicateSignature,
  extractCatalogToolNames,
  matchScore,
  parseCatalogTool,
  routeKindFor,
  tokenize,
} from '../analysis';

const parse = (code: string) => ts.createSourceFile('x.ts', code, ts.ScriptTarget.Latest, true);

describe('classifyByName', () => {
  it('reads "getLeadSettings" as a read, not a "set" mutation', () => {
    expect(tokenize('getLeadSettingsAction')).toEqual(['get', 'lead', 'settings']);
    expect(classifyByName('getLeadSettingsAction')).toMatchObject({ operation: 'read', riskLevel: 'L0_READ' });
  });

  it('does not rate an execute as a read', () => {
    expect(classifyByName('executeAiRecommendationAction').riskLevel).not.toBe('L0_READ');
  });

  it('escalates destructive and external verbs', () => {
    expect(classifyByName('bulkDeleteContactsAction').riskLevel).toBe('L4_PRIVILEGED_DESTRUCTIVE');
    expect(classifyByName('sendCampaignEmailAction').riskLevel).toBe('L3_EXTERNAL_COMMUNICATION_FINANCE');
    expect(classifyByName('getSendHistory').riskLevel).toBe('L0_READ'); // read verb wins
  });

  it('defaults unknown verbs to a low-confidence mutation, never to L0', () => {
    expect(classifyByName('frobnicateWidgets')).toEqual({ operation: 'execute', riskLevel: 'L2_STATE_MUTATION', confidence: 'low' });
  });
});

describe('routes', () => {
  it('classifies route kinds and methods', () => {
    expect(routeKindFor('webhooks/whatsapp')).toBe('webhook');
    expect(routeKindFor('cron/social-publisher')).toBe('cron');
    expect(routeKindFor('tasks/agent-step')).toBe('task_worker');
    expect(classifyHttpMethod('GET', 'cron').riskLevel).toBe('L2_STATE_MUTATION');
    expect(classifyHttpMethod('GET', 'api').riskLevel).toBe('L0_READ');
    expect(classifyHttpMethod('DELETE', 'api').riskLevel).toBe('L4_PRIVILEGED_DESTRUCTIVE');
  });
});

describe('analyzeNode', () => {
  it('scopes facts to the function, not the whole file', () => {
    const sf = parse(`
      export async function getA(ws: string) { await requireWorkspace(ws); return adminDb.collection('a').get(); }
      export async function getB() { return adminDb.collection('b').get(); }
    `);
    const [a, b] = sf.statements;
    expect(analyzeNode(a, sf)).toMatchObject({ collections: ['a'], authChecks: ['requireWorkspace'] });
    expect(analyzeNode(b, sf)).toMatchObject({ collections: ['b'], authChecks: [] });
  });

  it('records permission ids and coarse levels only when literally passed to a guard', () => {
    const sf = parse(`
      export async function f(u: string, ws: string, p: string) {
        await verifyPermission(u, 'edit', ws);
        await checkWorkspacePermission(u, ws, 'contacts.update');
        await checkWorkspacePermission(u, ws, p);
      }
    `);
    expect(analyzeNode(sf.statements[0], sf).permissionsRequired).toEqual(['contacts.update', 'verifyPermission:edit']);
  });

  it('detects client-SDK collection() calls and webhook signatures', () => {
    const sf = parse(`export async function POST(req) { const wh = new Webhook(s); wh.verify(b, h); return getDocs(collection(db, 'matters')); }`);
    expect(analyzeNode(sf.statements[0], sf)).toMatchObject({ collections: ['matters'], authChecks: ['webhookSignature'] });
  });
});

describe('catalog reconciliation', () => {
  it('matches verbs by synonym and nouns by singular form', () => {
    const tool = parseCatalogTool('crm.entity.add_tag');
    expect(tool).toEqual({ name: 'crm.entity.add_tag', verb: 'add', nouns: ['entity', 'tag'] });
    expect(matchScore(tool, 'addEntityTagsAction')).toBeGreaterThan(0);
    expect(matchScore(tool, 'removeEntityTagAction')).toBe(0);
    expect(matchScore(parseCatalogTool('task.create'), 'createTaskAction')).toBeGreaterThan(0);
  });

  it('extracts only the catalog section tool names', () => {
    const md = 'intro `not.this`\n# 2. The complete tool catalog\n`task.create` `crm.deal.get`\n# 3. The tools that are easy to miss\n`policy.evaluate`';
    expect(extractCatalogToolNames(md)).toEqual(['crm.deal.get', 'task.create']);
  });

  it('builds duplicate signatures across synonyms', () => {
    expect(duplicateSignature('createContactAction')).toBe(duplicateSignature('addContact'));
    expect(duplicateSignature('getThing')).not.toBe(duplicateSignature('deleteThing'));
  });
});

describe('inline route guards', () => {
  it('recognizes inline cron secrets and signature headers', () => {
    const sf = parse(`
      export async function GET(req) { if (req.headers.get('authorization') !== \`Bearer \${process.env.CRON_SECRET}\`) return; }
      export async function POST(req) { const sig = req.headers.get('x-resend-signature'); }
    `);
    expect(analyzeNode(sf.statements[0], sf).authChecks).toEqual(['cronSecret']);
    expect(analyzeNode(sf.statements[1], sf).authChecks).toEqual(['webhookSignature']);
  });
});

describe('input validation detection', () => {
  it('counts schema parsing but not JSON.parse or Date.parse', () => {
    const sf = parse(`
      export function a(raw) { return JSON.parse(raw); }
      export function b(raw) { return Date.parse(raw); }
      export function c(raw) { return Schema.safeParse(raw); }
      export function d(raw) { return schema.parse(raw); }
    `);
    expect(sf.statements.map((st) => analyzeNode(st, sf).validatesInput)).toEqual([false, false, true, true]);
  });
});
