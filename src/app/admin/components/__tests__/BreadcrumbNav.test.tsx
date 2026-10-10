import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BreadcrumbNav } from '../BreadcrumbNav';

let mockPathname = '/admin';
let mockSearchParams = new URLSearchParams();
const mockPush = vi.fn();
let mockIsMobile = false;
let mockCustomLabels: Record<string, string> = {};

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock('@/context/NavigationContext', () => ({
  useNavigation: () => ({
    customLabels: mockCustomLabels,
    setCustomLabel: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => mockIsMobile,
}));

vi.mock('@/hooks/use-terminology', () => ({
  useTerminology: () => ({
    singular: 'Entity',
    plural: 'Entities',
  }),
}));

let mockActiveWorkspace: { id: string; name: string } | undefined = { id: 'ws_alpha', name: 'Alpha Academy' };

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspace: mockActiveWorkspace,
    activeWorkspaceId: mockActiveWorkspace?.id,
  }),
}));

describe('BreadcrumbNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveWorkspace = { id: 'ws_alpha', name: 'Alpha Academy' };
    mockPathname = '/admin';
    mockSearchParams = new URLSearchParams();
    mockIsMobile = false;
    mockCustomLabels = {};
  });

  it('renders "System Dashboard" fallback when exactly at root /admin', () => {
    mockPathname = '/admin';
    render(<BreadcrumbNav />);
    expect(screen.getByText('System Dashboard')).toBeDefined();
    expect(screen.queryByLabelText('Go back')).toBeNull();
  });

  it('renders "System Dashboard" fallback when at root /admin with trailing slash', () => {
    mockPathname = '/admin/';
    render(<BreadcrumbNav />);
    expect(screen.getByText('System Dashboard')).toBeDefined();
    expect(screen.queryByLabelText('Go back')).toBeNull();
  });

  it('hides "Dashboard" in breadcrumbs on subpages such as /admin/workforce/crm', () => {
    mockPathname = '/admin/workforce/crm';
    render(<BreadcrumbNav />);

    // Dashboard must not be present in the breadcrumbs
    expect(screen.queryByText('Dashboard')).toBeNull();
    expect(screen.queryByText('System Dashboard')).toBeNull();

    // Functional segments must be present
    expect(screen.getByText('AI Workforce')).toBeDefined();
    expect(screen.getByText('CRM')).toBeDefined();
  });

  it('hides "Dashboard" even when query parameters like ?track=... are present', () => {
    mockPathname = '/admin/workforce/crm';
    mockSearchParams = new URLSearchParams({ track: 'ai-workforce' });
    render(<BreadcrumbNav />);

    expect(screen.queryByText('Dashboard')).toBeNull();
    expect(screen.getByText('AI Workforce')).toBeDefined();
    expect(screen.getByText('CRM')).toBeDefined();

    // The AI Workforce link should retain track query
    const workforceLink = screen.getByRole('link', { name: 'AI Workforce' });
    expect(workforceLink.getAttribute('href')).toBe('/admin/workforce?track=ai-workforce');
  });

  it('navigates to the parent route when back button is clicked', () => {
    mockPathname = '/admin/workforce/crm';
    render(<BreadcrumbNav />);

    const backButton = screen.getByLabelText('Go back');
    fireEvent.click(backButton);

    expect(mockPush).toHaveBeenCalledWith('/admin/workforce');
  });

  it('navigates to /admin when back button is clicked on a first-level page', () => {
    mockPathname = '/admin/workforce';
    render(<BreadcrumbNav />);

    const backButton = screen.getByLabelText('Go back');
    fireEvent.click(backButton);

    expect(mockPush).toHaveBeenCalledWith('/admin');
  });

  it('renders custom labels for technical IDs or dynamic entities', () => {
    mockPathname = '/admin/entities/ent-12345';
    mockCustomLabels = {
      '/admin/entities/ent-12345': 'Acme Global Corp',
    };

    render(<BreadcrumbNav />);

    expect(screen.queryByText('Dashboard')).toBeNull();
    expect(screen.getByText('Entities Contacts')).toBeDefined();
    expect(screen.getByText('Acme Global Corp')).toBeDefined();
  });

  it('collapses intermediate breadcrumbs on mobile when trail exceeds 3 items', () => {
    mockIsMobile = true;
    mockPathname = '/admin/messaging/templates/categories/new';

    render(<BreadcrumbNav />);

    expect(screen.queryByText('Dashboard')).toBeNull();
    expect(screen.getByText('Messaging')).toBeDefined();
    expect(screen.getByLabelText('More segments')).toBeDefined();
    expect(screen.getByText('New')).toBeDefined();
  });

  it('renders "{Workspace Name} Pipeline" for /admin/pipeline route', () => {
    mockPathname = '/admin/pipeline';
    render(<BreadcrumbNav />);

    expect(screen.queryByText('Dashboard')).toBeNull();
    expect(screen.queryByText('Onboarding Pipeline')).toBeNull();
    expect(screen.getByText('Alpha Academy Pipeline')).toBeDefined();
  });

  it('renders "{Workspace Name} Pipeline" for /admin/deals/[id] route', () => {
    mockPathname = '/admin/deals/deal-999';
    mockCustomLabels = {
      '/admin/deals/deal-999': 'St. Peter International Deal',
    };
    render(<BreadcrumbNav />);

    expect(screen.queryByText('Onboarding Pipeline')).toBeNull();
    expect(screen.getByText('Alpha Academy Pipeline')).toBeDefined();
    expect(screen.getByText('St. Peter International Deal')).toBeDefined();
  });

  it('avoids duplicating "Pipeline" if workspace name already ends with Pipeline', () => {
    mockActiveWorkspace = { id: 'ws_beta', name: 'Sales Pipeline' };
    mockPathname = '/admin/pipeline';
    render(<BreadcrumbNav />);

    expect(screen.queryByText('Onboarding Pipeline')).toBeNull();
    expect(screen.getByText('Sales Pipeline')).toBeDefined();
    expect(screen.queryByText('Sales Pipeline Pipeline')).toBeNull();
  });

  it('falls back to "Pipeline" if workspace name is not available', () => {
    mockActiveWorkspace = undefined;
    mockPathname = '/admin/pipeline';
    render(<BreadcrumbNav />);

    expect(screen.queryByText('Onboarding Pipeline')).toBeNull();
    expect(screen.getByText('Pipeline')).toBeDefined();
  });
});

