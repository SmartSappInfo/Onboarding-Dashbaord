import { describe, it, expect } from 'vitest';
import type { WorkspaceEntity } from '@/lib/types';
import { enrichDealData, type AutomatedDealFERCandidate } from '../automated-deal-fer-actions';

/**
 * Unit test suite verifying the ENRICH stage logic of the Automated Deal FER Protocol.
 */
describe('Automated Deal FER Protocol', () => {
  const mockEntity: WorkspaceEntity = {
    id: 'ent_999',
    entityId: 'ent_999',
    workspaceId: 'ws_test',
    organizationId: 'org_test',
    displayName: 'St. Jude International Academy',
    entityType: 'institution',
    status: 'active',
    workspaceTags: [],
    addedAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    entityContacts: [
      {
        id: 'cnt_primary',
        name: 'Dr. Evelyn Vance',
        typeKey: 'headmaster',
        typeLabel: 'Headmaster',
        email: 'evelyn@stjude.edu',
        phone: '+15559988',
        isPrimary: true,
        isSignatory: true,
        order: 1,
      },
      {
        id: 'cnt_secondary',
        name: 'Marcus Brody',
        typeKey: 'bursar',
        typeLabel: 'Bursar',
        email: 'marcus@stjude.edu',
        phone: '+15559977',
        isPrimary: false,
        isSignatory: false,
        order: 2,
      },
    ],
  };

  const mockCandidate: AutomatedDealFERCandidate = {
    dealId: 'deal_001',
    workspaceId: 'ws_test',
    entityId: 'ent_999',
    currentName: 'Automated Event Deal',
    currentDescription: null,
  };

  it('should enrich generic deal name with entity displayName', () => {
    const enriched = enrichDealData(mockCandidate, mockEntity);
    expect(enriched.newName).toBe('St. Jude International Academy - Opened Email');
  });

  it('should resolve primary contact from entity.entityContacts into focalContacts', () => {
    const enriched = enrichDealData(mockCandidate, mockEntity);
    expect(enriched.focalContacts).toBeDefined();
    expect(enriched.focalContacts).toHaveLength(1);
    expect(enriched.focalContacts?.[0].id).toBe('cnt_primary');
    expect(enriched.focalContacts?.[0].name).toBe('Dr. Evelyn Vance');
    expect(enriched.focalContacts?.[0].role).toBe('Headmaster');
  });

  it('should populate engagement summary in description if description was empty', () => {
    const enriched = enrichDealData(mockCandidate, mockEntity);
    expect(enriched.description).toBe('Opened Email: "Automated Email Engagement"');
  });

  it('should preserve existing description if present', () => {
    const candidateWithDesc: AutomatedDealFERCandidate = {
      ...mockCandidate,
      currentDescription: 'Existing custom deal notes',
    };
    const enriched = enrichDealData(candidateWithDesc, mockEntity);
    expect(enriched.description).toBe('Existing custom deal notes');
  });
});
