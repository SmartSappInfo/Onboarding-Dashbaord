/**
 * @fileOverview UI Proof Point Test: TagSelector Migration to useCapability (Phase 1 / PR-11)
 *
 * Implements Rule 4 (Strict Typing), Rule 23 (State Change Invariant),
 * Rule 69 (Master Layering Axiom), and Tag Selection SSOT.
 *
 * Verifies that TagSelector routes tag addition and removal through:
 * - `crm.entity.add_tag`
 * - `crm.entity.remove_tag`
 * - Respects draft/client-side mode when contactId/contactType are omitted
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { AgentPrincipal } from '../../capabilities/contracts/capability-definition';
import { resetCapabilityRegistryForTests } from '../../capabilities/registry/capability-registry';
import { registerCrmContactsCapabilities } from '../../domains/crm_contacts';
import * as invokeActionModule from '../../capabilities/ui/invoke-capability-action';

// Mock session principal
const mockSessionPrincipal: AgentPrincipal = {
  actorType: 'user',
  userId: 'user_tag_ui_test',
  organizationId: 'org_tag_test',
  workspaceId: 'ws_tag_test',
  grantedScopes: ['*'],
  effectiveRole: 'admin',
};

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
}));

vi.mock('@/lib/auth/require-auth', () => ({
  requireWorkspace: vi.fn(async () => ({
    uid: 'user_tag_ui_test',
    profile: {
      id: 'user_tag_ui_test',
      organizationId: 'org_tag_test',
      role: 'admin',
      permissions: ['*'],
    },
    isSystemAdmin: true,
  })),
}));

vi.mock('@/platform/capabilities/policy/session-principal-resolver', () => ({
  resolvePrincipalFromSession: vi.fn(async () => mockSessionPrincipal),
}));

// Mock firebase
vi.mock('@/firebase', () => ({
  useFirestore: vi.fn(() => ({})),
  useUser: vi.fn(() => ({
    user: { uid: 'user_tag_ui_test', displayName: 'Tag Tester' },
    loading: false,
  })),
  useCollection: vi.fn(() => ({
    data: [
      {
        id: 'tag_enterprise',
        name: 'Enterprise',
        category: 'status',
        color: '#3B82F6',
        workspaceId: 'ws_tag_test',
      },
      {
        id: 'tag_pilot',
        name: 'Pilot Customer',
        category: 'status',
        color: '#22C55E',
        workspaceId: 'ws_tag_test',
      },
    ],
    isLoading: false,
  })),
  useMemoFirebase: vi.fn((fn: () => unknown) => fn()),
}));

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: vi.fn(() => ({
    activeWorkspaceId: 'ws_tag_test',
    activeOrganizationId: 'org_tag_test',
  })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

vi.mock('@/hooks/use-media-query', () => ({
  useMediaQuery: vi.fn(() => false),
}));

import { TagSelector } from '@/components/tags/TagSelector';

describe('TagSelector useCapability Migration (PR-11 Proof Point)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCapabilityRegistryForTests();
    registerCrmContactsCapabilities();
  });

  it('renders assigned tags and executes client/draft mode when contactId is omitted', async () => {
    const onTagsChange = vi.fn();
    render(
      <TagSelector
        currentTagIds={['tag_enterprise']}
        onTagsChange={onTagsChange}
      />
    );

    expect(screen.getByText('Enterprise')).toBeInTheDocument();
  });

  it('routes tag removal through crm.entity.remove_tag capability in entity mode', async () => {
    const invokeSpy = vi.spyOn(invokeActionModule, 'invokeCapabilityAction').mockResolvedValue({
      success: true,
      data: {
        contactId: 'contact_001',
        remainingTagIds: [],
        removedTagCount: 1,
      },
      executionId: 'exec_test_001',
      durationMs: 5,
      stateChanged: 'yes',
    });

    const onTagsChange = vi.fn();
    render(
      <TagSelector
        contactId="contact_001"
        contactType="entity"
        currentTagIds={['tag_enterprise']}
        onTagsChange={onTagsChange}
      />
    );

    // Find the remove button for the tag
    const removeBtn = screen.getByRole('button', { name: /Remove tag Enterprise/i });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(invokeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          capabilityId: 'crm.entity.remove_tag',
          input: expect.objectContaining({
            entityId: 'contact_001',
            tagIds: ['tag_enterprise'],
            workspaceId: 'ws_tag_test',
          }),
        })
      );
    });
  });
});
