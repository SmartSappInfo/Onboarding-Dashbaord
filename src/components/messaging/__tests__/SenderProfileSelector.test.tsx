import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { SenderProfileSelector } from '../SenderProfileSelector';
import type { SenderProfile } from '@/lib/types';

// Mock workspace context
const mockActiveOrg = {
  id: 'org_123',
  name: 'Acme Org',
  defaultSenderProfileIds: {
    email: 'profile_email_1',
    sms: 'profile_sms_1',
  },
};

const mockWorkspace = {
  id: 'ws_123',
  organizationId: 'org_123',
  name: 'Main Workspace',
};

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: vi.fn(() => ({
    activeOrganization: mockActiveOrg,
    activeWorkspace: mockWorkspace,
    activeWorkspaceId: 'ws_123',
    activeOrganizationId: 'org_123',
  })),
}));

// Mock Firebase hooks
const mockProfiles: SenderProfile[] = [
  {
    id: 'profile_email_1',
    organizationId: 'org_123',
    name: 'Acme Info',
    channel: 'email',
    identifier: 'info@acme.com',
    isDefault: true,
    isActive: true,
    workspaceIds: ['ws_123'],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'profile_email_2',
    organizationId: 'org_123',
    name: 'Acme Support',
    channel: 'email',
    identifier: 'support@acme.com',
    isDefault: false,
    isActive: true,
    workspaceIds: ['ws_123'],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'profile_sms_1',
    organizationId: 'org_123',
    name: 'Acme SMS Sender',
    channel: 'sms',
    identifier: 'AcmeCorp',
    isDefault: true,
    isActive: true,
    workspaceIds: ['ws_123'],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'profile_wa_1',
    organizationId: 'org_123',
    name: 'Acme WhatsApp Bot',
    channel: 'whatsapp',
    identifier: '+1234567890',
    isDefault: false,
    isActive: true,
    workspaceIds: ['ws_123'],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

let mockCollectionReturn: { data: SenderProfile[] | null; isLoading: boolean } = {
  data: mockProfiles,
  isLoading: false,
};

vi.mock('@/firebase', () => ({
  useFirestore: vi.fn(() => ({})),
  useMemoFirebase: vi.fn((fn: () => unknown) => fn()),
  useCollection: vi.fn(() => mockCollectionReturn),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

describe('SenderProfileSelector Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollectionReturn = {
      data: mockProfiles,
      isLoading: false,
    };
  });

  it('renders default active profile when value is "default" or empty', () => {
    const handleChange = vi.fn();
    render(
      <SenderProfileSelector
        channel="email"
        value="default"
        onChange={handleChange}
      />
    );

    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeDefined();
  });

  it('renders with custom defaultLabel and defaultSentinelValue for surveys (none)', () => {
    const handleChange = vi.fn();
    render(
      <SenderProfileSelector
        channel="email"
        value="none"
        defaultSentinelValue="none"
        defaultLabel="Auto-Resolve (Default)"
        onChange={handleChange}
      />
    );

    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeDefined();
  });

  it('renders with WhatsApp Business Account sentinel for campaigns', () => {
    const handleChange = vi.fn();
    render(
      <SenderProfileSelector
        channel="whatsapp"
        value="whatsapp"
        defaultSentinelValue="whatsapp"
        defaultLabel="WhatsApp Business Account"
        onChange={handleChange}
      />
    );

    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeDefined();
  });

  it('applies compact styling when compact is true', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <SenderProfileSelector
        channel="sms"
        value="default"
        onChange={handleChange}
        compact
      />
    );

    const trigger = container.querySelector('button');
    expect(trigger?.className).toContain('h-9');
    expect(trigger?.className).toContain('text-[11px]');
  });

  it('applies standard min-h-[44px] styling when compact is false', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <SenderProfileSelector
        channel="email"
        value="default"
        onChange={handleChange}
      />
    );

    const trigger = container.querySelector('button');
    expect(trigger?.className).toContain('min-h-[44px]');
  });

  it('renders disabled state properly', () => {
    const handleChange = vi.fn();
    render(
      <SenderProfileSelector
        channel="email"
        value="default"
        onChange={handleChange}
        disabled
      />
    );

    const trigger = screen.getByRole('combobox');
    expect(trigger.getAttribute('disabled')).not.toBeNull();
  });

  it('handles empty profile list gracefully without throwing', () => {
    mockCollectionReturn = {
      data: [],
      isLoading: false,
    };

    const handleChange = vi.fn();
    render(
      <SenderProfileSelector
        channel="whatsapp"
        value="default"
        onChange={handleChange}
      />
    );

    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeDefined();
  });

  it('filters out profiles belonging to foreign organizations or domains', () => {
    mockCollectionReturn = {
      data: [
        ...mockProfiles,
        {
          id: 'foreign_leaked_profile',
          organizationId: 'org_123',
          name: 'TechPatrons Leaked Profile',
          channel: 'email',
          identifier: 'support@techpatrons.com', // foreign domain!
          isDefault: false,
          isActive: true,
          workspaceIds: ['ws_123'],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ],
      isLoading: false,
    };

    const handleChange = vi.fn();
    const { queryByText } = render(
      <SenderProfileSelector
        channel="email"
        organizationId="org_123"
        value="profile_email_1"
        onChange={handleChange}
      />
    );

    // Foreign profile should never be rendered
    expect(queryByText('TechPatrons Leaked Profile')).toBeNull();
  });
});
