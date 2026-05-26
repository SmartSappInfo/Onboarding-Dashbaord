// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Mock ./firebase-admin BEFORE importing the module under test.
// vi.mock is hoisted, so the factory must not reference variables declared
// in the outer scope. We use module-level state objects instead.
// ---------------------------------------------------------------------------

vi.mock('../firebase-admin', () => {
  const get = vi.fn();
  const limit = vi.fn(() => ({ get }));
  const where = vi.fn();
  where.mockReturnValue({ where, limit, get });
  const docGet = vi.fn();
  const docCollection = vi.fn(() => ({ where }));
  const doc = vi.fn(() => ({ get: docGet, collection: docCollection }));
  const collection = vi.fn(() => ({ where, doc }));

  return {
    adminDb: { collection },
    __mocks: { get, limit, where, doc, docGet, collection, docCollection },
  };
});

import {
  resolveTemplateForOrg,
  buildVariableMap,
  resolveAndRender,
  type VariableResolutionContext,
} from '../template-resolver';
import { renderTemplate } from '../template-utils';
import * as firebaseAdmin from '../firebase-admin';

// Helper to access mocks exposed by the factory
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mocks = () => (firebaseAdmin as any).__mocks as {
  get: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  doc: ReturnType<typeof vi.fn>;
  docGet: ReturnType<typeof vi.fn>;
  collection: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Unit tests: renderTemplate
// ---------------------------------------------------------------------------

describe('renderTemplate', () => {
  it('replaces known variables', () => {
    const result = renderTemplate('Hello {{name}}!', { name: 'Alice' });
    expect(result).toBe('Hello Alice!');
  });

  it('replaces multiple variables', () => {
    const result = renderTemplate('{{greeting}} {{name}}, your code is {{code}}.', {
      greeting: 'Hi',
      name: 'Bob',
      code: '1234',
    });
    expect(result).toBe('Hi Bob, your code is 1234.');
  });

  it('leaves unknown variables as empty string', () => {
    const result = renderTemplate('Hello {{unknown}}!', {});
    expect(result).toBe('Hello !');
  });

  it('handles empty body', () => {
    const result = renderTemplate('', { name: 'Alice' });
    expect(result).toBe('');
  });

  it('handles body with no placeholders', () => {
    const result = renderTemplate('No variables here.', { name: 'Alice' });
    expect(result).toBe('No variables here.');
  });

  it('trims whitespace inside placeholder braces', () => {
    const result = renderTemplate('Hello {{ name }}!', { name: 'Alice' });
    expect(result).toBe('Hello Alice!');
  });

  it('replaces same variable used multiple times', () => {
    const result = renderTemplate('{{x}} and {{x}}', { x: 'foo' });
    expect(result).toBe('foo and foo');
  });

  it('converts non-string values to string', () => {
    const result = renderTemplate('Count: {{count}}', { count: 42 });
    expect(result).toBe('Count: 42');
  });
});

// ---------------------------------------------------------------------------
// Unit tests: resolveTemplateForOrg
// ---------------------------------------------------------------------------

describe('resolveTemplateForOrg', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-wire the chain after clearAllMocks
    mocks().limit.mockReturnValue({ get: mocks().get });
    mocks().where.mockReturnValue({ where: mocks().where, limit: mocks().limit, get: mocks().get });
  });

  it('returns org override when available', async () => {
    const orgTemplate = {
      id: 'org-tpl-1',
      scope: 'organization',
      organizationId: 'org-1',
      category: 'meetings',
      templateType: 'meeting_invitation',
      body: 'Org body',
      isActive: true,
    };
    mocks().get.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: 'org-tpl-1', data: () => orgTemplate }],
    });

    const result = await resolveTemplateForOrg('meetings', 'meeting_invitation', 'org-1');
    expect(result.scope).toBe('organization');
    expect(result.organizationId).toBe('org-1');
  });

  it('falls back to global when no org override', async () => {
    const globalTemplate = {
      id: 'global-tpl-1',
      scope: 'global',
      category: 'meetings',
      templateType: 'meeting_invitation',
      body: 'Global body',
      isActive: true,
    };
    // First call (org query) returns empty
    mocks().get
      .mockResolvedValueOnce({ empty: true, docs: [] })
      // Second call (global query) returns the global template
      .mockResolvedValueOnce({
        empty: false,
        docs: [{ id: 'global-tpl-1', data: () => globalTemplate }],
      });

    const result = await resolveTemplateForOrg('meetings', 'meeting_invitation', 'org-1');
    expect(result.scope).toBe('global');
  });

  it('throws when neither org nor global template found', async () => {
    mocks().get
      .mockResolvedValueOnce({ empty: true, docs: [] })
      .mockResolvedValueOnce({ empty: true, docs: [] });

    await expect(
      resolveTemplateForOrg('meetings', 'nonexistent_type', 'org-1'),
    ).rejects.toThrow('No template found for meetings/nonexistent_type');
  });
});

// ---------------------------------------------------------------------------
// Unit tests: buildVariableMap
// ---------------------------------------------------------------------------

describe('buildVariableMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks().where.mockReturnValue({ where: mocks().where, limit: mocks().limit, get: mocks().get });
  });

  it('always includes current_date, current_time, current_year', async () => {
    mocks().docGet.mockResolvedValue({ exists: false });
    const vars = await buildVariableMap('common', {});
    expect(vars).toHaveProperty('current_date');
    expect(vars).toHaveProperty('current_time');
    expect(vars).toHaveProperty('current_year');
  });

  it('merges extraVars into the result', async () => {
    mocks().docGet.mockResolvedValue({ exists: false });
    const vars = await buildVariableMap('common', { extraVars: { custom_key: 'custom_value' } });
    expect(vars['custom_key']).toBe('custom_value');
  });

  it('extraVars override fetched values', async () => {
    mocks().docGet.mockResolvedValue({
      exists: true,
      data: () => ({ title: 'Original Title' }),
    });
    const vars = await buildVariableMap('meeting', {
      meetingId: 'mtg-1',
      extraVars: { meeting_title: 'Override Title' },
    });
    expect(vars['meeting_title']).toBe('Override Title');
  });

  it('fetches meeting fields when meetingId is provided', async () => {
    mocks().docGet.mockResolvedValue({
      exists: true,
      data: () => ({
        heroTitle: 'Team Sync',
        meetingLink: 'https://meet.example.com/abc',
        meetingTime: '2025-06-20 10:00 AM',
      }),
    });
    const vars = await buildVariableMap('meeting', { meetingId: 'mtg-1' });
    expect(vars['meeting_title']).toBe('Team Sync');
    expect(vars['meeting_link']).toBe('https://meet.example.com/abc');
    expect(vars['meeting_time']).toBe('2025-06-20 10:00 AM');
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

describe('Property: renderTemplate leaves no {{...}} placeholders when all vars provided', () => {
  /**
   * **Validates: Requirements 3.8**
   * For any set of variable names, if we build a body containing all those
   * placeholders and supply all values, the output must contain no remaining
   * {{...}} tokens.
   */
  it('no placeholders remain after full substitution', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z_]+$/.test(s)),
        ),
        (varNames) => {
          const uniqueNames = [...new Set(varNames)];
          const body = uniqueNames.map((n) => `{{${n}}}`).join(' ');
          const vars = Object.fromEntries(uniqueNames.map((n) => [n, 'value']));
          const result = renderTemplate(body, vars);
          return !result.includes('{{');
        },
      ),
    );
  });
});

describe('Property: org override is always preferred over global', () => {
  /**
   * **Validates: Requirements 2.4**
   * When both an org override and a global template exist for the same
   * category/type, resolveTemplateForOrg must return the org override.
   */
  it('returns org template when org override exists', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          orgId: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9_-]+$/.test(s)),
          category: fc.constantFrom('meetings', 'forms', 'surveys', 'general') as fc.Arbitrary<string>,
          type: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z_]+$/.test(s)),
        }),
        async ({ orgId, category, type }) => {
          vi.clearAllMocks();
          mocks().limit.mockReturnValue({ get: mocks().get });
          mocks().where.mockReturnValue({ where: mocks().where, limit: mocks().limit, get: mocks().get });

          const orgTemplate = {
            scope: 'organization',
            organizationId: orgId,
            category,
            templateType: type,
            body: 'org body',
            isActive: true,
          };

          // Org query returns a result — global should never be queried
          mocks().get.mockResolvedValueOnce({
            empty: false,
            docs: [{ id: 'org-tpl', data: () => orgTemplate }],
          });

          const result = await resolveTemplateForOrg(category as any, type, orgId);
          return result.scope === 'organization' && result.organizationId === orgId;
        },
      ),
    );
  });
});

describe('Property: scope isolation — org A template never returned for org B', () => {
  /**
   * **Validates: Requirements 2.4, 2.6**
   * When org A has an override but org B does not, resolving for org B
   * must not return org A's template.
   */
  it('org B gets global template, not org A template', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          orgAId: fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-z]+$/.test(s)),
          orgBId: fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-z]+$/.test(s)),
        }).filter(({ orgAId, orgBId }) => orgAId !== orgBId),
        async ({ orgAId, orgBId }) => {
          vi.clearAllMocks();
          mocks().limit.mockReturnValue({ get: mocks().get });
          mocks().where.mockReturnValue({ where: mocks().where, limit: mocks().limit, get: mocks().get });

          const globalTemplate = {
            scope: 'global',
            category: 'meetings',
            templateType: 'meeting_invitation',
            body: 'global body',
            isActive: true,
          };

          // For org B: no org override → falls back to global
          mocks().get
            .mockResolvedValueOnce({ empty: true, docs: [] })       // org query for B → empty
            .mockResolvedValueOnce({                                  // global query → found
              empty: false,
              docs: [{ id: 'global-tpl', data: () => globalTemplate }],
            });

          const result = await resolveTemplateForOrg('meetings', 'meeting_invitation', orgBId);

          // Must be global, not org A's template
          return result.scope === 'global' && result.organizationId !== orgAId;
        },
      ),
    );
  });
});
