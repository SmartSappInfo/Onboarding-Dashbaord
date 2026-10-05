import { describe, it, expect } from 'vitest';

describe('Backoffice Workspace Governance', () => {
  it('correctly maps scope status payloads for backoffice operator toggles', () => {
    const payload = {
      restrictVisibilityToAssigned: false,
      restrictDealsVisibilityToAssigned: true,
      restrictTasksVisibilityToAssigned: true,
    };

    expect(payload.restrictVisibilityToAssigned).toBe(false);
    expect(payload.restrictDealsVisibilityToAssigned).toBe(true);
    expect(payload.restrictTasksVisibilityToAssigned).toBe(true);
  });
});
