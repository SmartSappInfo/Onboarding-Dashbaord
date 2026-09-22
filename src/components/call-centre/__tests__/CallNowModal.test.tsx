import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { CallNowModal } from '../CallNowModal';
import type { CallCampaign } from '@/lib/types';

// Mock workspace context
vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspaceId: 'ws_test',
    activeOrganizationId: 'org_test',
  }),
}));

// Mock user context
vi.mock('@/firebase', () => ({
  useUser: () => ({
    user: { uid: 'user_1', displayName: 'Agent Alex' },
  }),
  useFirestore: () => ({}),
  useCollection: () => ({ data: [], isLoading: false }),
  useMemoFirebase: (fn: () => unknown) => fn(),
}));

// Mock hooks
const mockCampaigns: CallCampaign[] = [
  {
    id: 'camp_1',
    organizationId: 'org_test',
    workspaceId: 'ws_test',
    name: 'Customer Support Callback',
    description: 'Callback campaign for inquiries.',
    scriptId: 's1',
    scriptSnapshot: JSON.stringify({
      nodes: [
        { id: '1', type: 'start', data: { label: 'Greeting', text: 'Hello, this is support.' } },
      ],
      edges: [],
    }),
    audienceDefinition: { mode: 'all' },
    outcomes: ['Resolved', 'Escalated'],
    automationRules: {},
    status: 'running',
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z',
    createdBy: 'user_1',
    progress: { total: 5, completed: 2, pending: 3, skipped: 0, callbacks: 0, deferred: 0 },
  },
];

vi.mock('@/lib/call-centre-hooks', () => ({
  useCallCampaigns: () => ({
    campaigns: mockCampaigns,
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('CallNowModal', () => {
  const mockParams = {
    entityId: 'ent_1',
    contactId: 'cnt_1',
    contactName: 'Jane Smith',
    phone: '+1234567890',
  };

  it('renders campaign script selector with proper thumbnails and exactly ONE close button in dialog header', () => {
    const handleClose = vi.fn();
    render(
      <CallNowModal
        isOpen={true}
        onClose={handleClose}
        params={mockParams}
      />
    );

    // Verify dialog title
    expect(screen.getByText('Choose Call Script')).toBeTruthy();

    // Verify campaign is listed using ScriptThumbnailCard
    expect(screen.getByText('Customer Support Callback')).toBeTruthy();
    expect(screen.getByText(/Hello, this is support\./i)).toBeTruthy();

    // Verify ONLY ONE close button exists in DialogContent portal
    // Previously, there were 2 overlapping close buttons (Radix DialogPrimitive.Close + manual button in DialogHeader)
    const portalCloseButtons = document.body.querySelectorAll('button:has(svg.lucide-x)');
    expect(portalCloseButtons.length).toBe(1);
    // Specifically verify there is no duplicate close button inside the DialogHeader
    const header = document.body.querySelector('[class*="border-b bg-background"]');
    const headerCloseButtons = header?.querySelectorAll('button:has(svg.lucide-x)');
    expect(headerCloseButtons?.length ?? 0).toBe(0); // Zero manual close buttons in header!
  });
});
