import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppSidebar } from '../app-sidebar';
import * as IndustryContext from '@/context/IndustryContext';
import type { IndustryContextType } from '@/context/IndustryContext';

// Mock Next.js navigation with different pathnames
const mockUsePathname = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

// Mock the sidebar UI components
vi.mock('@/components/ui/sidebar', () => ({
  Sidebar: ({ children, ...props }: any) => <div data-testid="sidebar" {...props}>{children}</div>,
  SidebarContent: ({ children }: any) => <div data-testid="sidebar-content">{children}</div>,
  SidebarFooter: ({ children }: any) => <div data-testid="sidebar-footer">{children}</div>,
  SidebarHeader: ({ children }: any) => <div data-testid="sidebar-header">{children}</div>,
  SidebarRail: () => <div data-testid="sidebar-rail" />,
  SidebarGroup: ({ children }: any) => <div data-testid="sidebar-group">{children}</div>,
  SidebarGroupLabel: ({ children }: any) => <div data-testid="sidebar-group-label">{children}</div>,
  SidebarMenu: ({ children }: any) => <ul data-testid="sidebar-menu">{children}</ul>,
  SidebarMenuItem: ({ children }: any) => <li data-testid="sidebar-menu-item">{children}</li>,
  SidebarMenuButton: ({ children, isActive, tooltip, asChild }: any) => (
    <div 
      data-testid="sidebar-menu-button" 
      data-active={isActive ? 'true' : 'false'} 
      data-tooltip={tooltip}
    >
      {children}
    </div>
  ),
}));

// Mock other components
vi.mock('@/components/nav-user', () => ({
  NavUser: () => <div data-testid="nav-user">User</div>,
}));

vi.mock('@/components/team-switcher', () => ({
  TeamSwitcher: () => <div data-testid="team-switcher">Teams</div>,
}));

describe('AppSidebar - Active Route Highlighting', () => {
  const mockUseIndustry = vi.spyOn(IndustryContext, 'useIndustry');

  const mockSaaSContext: IndustryContextType = {
    industry: 'SaaS',
    terminology: {
      entitySingular: 'Account',
      entityPlural: 'Accounts',
      personSingular: 'User',
      personPlural: 'Users',
    },
    features: {
      trials: true,
      onboarding: true,
      subscriptions: true,
      healthScores: true,
      supportTickets: true,
      applications: false,
      enrollments: false,
      schoolVisits: false,
      matters: false,
      conflictChecks: false,
      timeTracking: false,
      courtDates: false,
      campaigns: false,
      proposals: false,
      deliverables: false,
      performanceMetrics: false,
      clientReports: false,
      properties: false,
      viewings: false,
      offers: false,
      negotiations: false,
      deals: false,
      engagements: false,
      discoveries: false,
      milestones: false,
      outcomes: false,
      retainers: false,
    },
    pipelineTemplate: {
      name: 'Customer Pipeline',
      stages: ['Lead', 'Trial', 'Onboarding', 'Active', 'Renewal', 'Churned'],
    },
    sidebarItems: [
      { key: 'accounts', label: 'Accounts', icon: 'Building2', href: '/accounts' },
      { key: 'users', label: 'Users', icon: 'Users', href: '/users' },
      { key: 'trials', label: 'Trials', icon: 'TestTube', href: '/trials' },
      { key: 'subscriptions', label: 'Subscriptions', icon: 'CreditCard', href: '/subscriptions' },
    ],
    contactTypes: ['Admin', 'Manager', 'User', 'Billing Contact'],
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIndustry.mockReturnValue(mockSaaSContext);
  });

  it('highlights the active route when pathname matches exactly', () => {
    mockUsePathname.mockReturnValue('/accounts');

    const { container } = render(<AppSidebar />);

    const buttons = container.querySelectorAll('[data-testid="sidebar-menu-button"]');
    const accountsButton = Array.from(buttons).find(
      (btn) => btn.textContent?.includes('Accounts')
    );
    const usersButton = Array.from(buttons).find(
      (btn) => btn.textContent?.includes('Users')
    );

    expect(accountsButton?.getAttribute('data-active')).toBe('true');
    expect(usersButton?.getAttribute('data-active')).toBe('false');
  });

  it('highlights the active route when pathname starts with route path', () => {
    mockUsePathname.mockReturnValue('/accounts/123/edit');

    const { container } = render(<AppSidebar />);

    const buttons = container.querySelectorAll('[data-testid="sidebar-menu-button"]');
    const accountsButton = Array.from(buttons).find(
      (btn) => btn.textContent?.includes('Accounts')
    );
    const trialsButton = Array.from(buttons).find(
      (btn) => btn.textContent?.includes('Trials')
    );

    expect(accountsButton?.getAttribute('data-active')).toBe('true');
    expect(trialsButton?.getAttribute('data-active')).toBe('false');
  });

  it('highlights subscriptions route correctly', () => {
    mockUsePathname.mockReturnValue('/subscriptions');

    const { container } = render(<AppSidebar />);

    const buttons = container.querySelectorAll('[data-testid="sidebar-menu-button"]');
    const subscriptionsButton = Array.from(buttons).find(
      (btn) => btn.textContent?.includes('Subscriptions')
    );
    const accountsButton = Array.from(buttons).find(
      (btn) => btn.textContent?.includes('Accounts')
    );

    expect(subscriptionsButton?.getAttribute('data-active')).toBe('true');
    expect(accountsButton?.getAttribute('data-active')).toBe('false');
  });

  it('highlights nested routes correctly', () => {
    mockUsePathname.mockReturnValue('/trials/active/details');

    const { container } = render(<AppSidebar />);

    const buttons = container.querySelectorAll('[data-testid="sidebar-menu-button"]');
    const trialsButton = Array.from(buttons).find(
      (btn) => btn.textContent?.includes('Trials')
    );
    const usersButton = Array.from(buttons).find(
      (btn) => btn.textContent?.includes('Users')
    );

    expect(trialsButton?.getAttribute('data-active')).toBe('true');
    expect(usersButton?.getAttribute('data-active')).toBe('false');
  });

  it('does not highlight any route when pathname does not match', () => {
    mockUsePathname.mockReturnValue('/settings');

    const { container } = render(<AppSidebar />);

    const buttons = container.querySelectorAll('[data-testid="sidebar-menu-button"]');
    
    buttons.forEach((button) => {
      expect(button.getAttribute('data-active')).toBe('false');
    });
  });

  it('works correctly with different industry routes', () => {
    const mockSchoolContext: IndustryContextType = {
      ...mockSaaSContext,
      industry: 'SchoolEnrollment',
      sidebarItems: [
        { key: 'schools', label: 'Schools', icon: 'School', href: '/schools' },
        { key: 'families', label: 'Families', icon: 'Users', href: '/families' },
        { key: 'admissions', label: 'Admissions', icon: 'FileText', href: '/admissions' },
      ],
    };

    mockUseIndustry.mockReturnValue(mockSchoolContext);
    mockUsePathname.mockReturnValue('/schools/123');

    const { container } = render(<AppSidebar />);

    const buttons = container.querySelectorAll('[data-testid="sidebar-menu-button"]');
    const schoolsButton = Array.from(buttons).find(
      (btn) => btn.textContent?.includes('Schools')
    );
    const familiesButton = Array.from(buttons).find(
      (btn) => btn.textContent?.includes('Families')
    );

    expect(schoolsButton?.getAttribute('data-active')).toBe('true');
    expect(familiesButton?.getAttribute('data-active')).toBe('false');
  });
});
