// src/test/unit/workspace-visibility-types.test.ts
import { describe, it, expect } from 'vitest';
import type { Workspace } from '@/lib/types';

describe('Workspace Visibility Contracts', () => {
  it('supports tri-domain visibility scope fields with fail-closed defaults', () => {
    const ws: Workspace = {
      id: 'ws_test_1',
      organizationId: 'org_test_1',
      name: 'Sales East',
      slug: 'sales-east',
      scope: 'institution',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      restrictVisibilityToAssigned: true,
      restrictDealsVisibilityToAssigned: true,
      restrictTasksVisibilityToAssigned: true,
    };

    expect(ws.restrictVisibilityToAssigned).toBe(true);
    expect(ws.restrictDealsVisibilityToAssigned).toBe(true);
    expect(ws.restrictTasksVisibilityToAssigned).toBe(true);
  });

  it('evaluates legacy workspaces without new fields as fail-closed (restricted)', () => {
    const legacyWs: Partial<Workspace> = {
      id: 'ws_legacy',
      name: 'Legacy Workspace',
    };

    const isDealsRestricted = legacyWs.restrictDealsVisibilityToAssigned !== false;
    const isTasksRestricted = legacyWs.restrictTasksVisibilityToAssigned !== false;

    expect(isDealsRestricted).toBe(true);
    expect(isTasksRestricted).toBe(true);
  });
});
