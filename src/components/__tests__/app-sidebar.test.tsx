import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppSidebar } from '../app-sidebar';
import * as IndustryContext from '@/context/IndustryContext';
import type { IndustryContextType } from '@/context/IndustryContext';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/accounts',
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
    <div data-testid="sidebar-menu-button" data-active={isActive} data-tooltip={tooltip}>
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

describe('AppSidebar', () => {
  const mockUseIndustry = vi.spyOn(IndustryContext, 'useIndustry');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders SaaS industry sidebar items', () => {
    const mockContext: IndustryContextType = {
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
        { key: 'health', label: 'Health', icon: 'Heart', href: '/health' },
        { key: 'support', label: 'Support', icon: 'LifeBuoy', href: '/support' },
      ],
      contactTypes: ['Admin', 'Manager', 'User', 'Billing Contact'],
      isLoading: false,
    };

    mockUseIndustry.mockReturnValue(mockContext);

    render(<AppSidebar />);

    // Verify SaaS-specific items are rendered
    expect(screen.getByText('Accounts')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Trials')).toBeInTheDocument();
    expect(screen.getByText('Subscriptions')).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
  });

  it('renders School Enrollment industry sidebar items', () => {
    const mockContext: IndustryContextType = {
      industry: 'SchoolEnrollment',
      terminology: {
        entitySingular: 'School',
        entityPlural: 'Schools',
        personSingular: 'Student',
        personPlural: 'Students',
      },
      features: {
        trials: false,
        onboarding: false,
        subscriptions: false,
        healthScores: false,
        supportTickets: false,
        applications: true,
        enrollments: true,
        schoolVisits: true,
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
        name: 'Admissions Pipeline',
        stages: ['Enquiry', 'Application', 'Review', 'Accepted', 'Enrolled'],
      },
      sidebarItems: [
        { key: 'schools', label: 'Schools', icon: 'School', href: '/schools' },
        { key: 'families', label: 'Families', icon: 'Users', href: '/families' },
        { key: 'pipeline', label: 'Pipeline', icon: 'GitBranch', href: '/pipeline' },
        { key: 'admissions', label: 'Admissions', icon: 'FileText', href: '/admissions' },
        { key: 'enrollments', label: 'Enrollments', icon: 'UserCheck', href: '/enrollments' },
      ],
      contactTypes: ['Principal', 'Administrator', 'Accountant', 'School Owner'],
      isLoading: false,
    };

    mockUseIndustry.mockReturnValue(mockContext);

    render(<AppSidebar />);

    // Verify School Enrollment-specific items are rendered
    expect(screen.getByText('Schools')).toBeInTheDocument();
    expect(screen.getByText('Families')).toBeInTheDocument();
    expect(screen.getByText('Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Admissions')).toBeInTheDocument();
    expect(screen.getByText('Enrollments')).toBeInTheDocument();

    // Verify SaaS items are NOT rendered
    expect(screen.queryByText('Trials')).not.toBeInTheDocument();
    expect(screen.queryByText('Subscriptions')).not.toBeInTheDocument();
  });

  it('renders Law industry sidebar items', () => {
    const mockContext: IndustryContextType = {
      industry: 'Law',
      terminology: {
        entitySingular: 'Client',
        entityPlural: 'Clients',
        personSingular: 'Contact',
        personPlural: 'Contacts',
      },
      features: {
        trials: false,
        onboarding: false,
        subscriptions: false,
        healthScores: false,
        supportTickets: false,
        applications: false,
        enrollments: false,
        schoolVisits: false,
        matters: true,
        conflictChecks: true,
        timeTracking: true,
        courtDates: true,
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
        name: 'Legal Pipeline',
        stages: ['Intake', 'Conflict Check', 'Consultation', 'Engagement', 'Active', 'Closed'],
      },
      sidebarItems: [
        { key: 'clients', label: 'Clients', icon: 'Scale', href: '/clients' },
        { key: 'matters', label: 'Matters', icon: 'Briefcase', href: '/matters' },
        { key: 'intake', label: 'Intake', icon: 'FileText', href: '/intake' },
        { key: 'consultations', label: 'Consultations', icon: 'Users', href: '/consultations' },
        { key: 'deadlines', label: 'Deadlines', icon: 'Calendar', href: '/deadlines' },
        { key: 'time-tracking', label: 'Time Tracking', icon: 'Clock', href: '/time-tracking' },
      ],
      contactTypes: ['Individual Client', 'Corporate Client', 'Witness', 'Expert'],
      isLoading: false,
    };

    mockUseIndustry.mockReturnValue(mockContext);

    render(<AppSidebar />);

    // Verify Law-specific items are rendered
    expect(screen.getByText('Clients')).toBeInTheDocument();
    expect(screen.getByText('Matters')).toBeInTheDocument();
    expect(screen.getByText('Intake')).toBeInTheDocument();
    expect(screen.getByText('Consultations')).toBeInTheDocument();
    expect(screen.getByText('Deadlines')).toBeInTheDocument();
    expect(screen.getByText('Time Tracking')).toBeInTheDocument();
  });

  it('does not render navigation when loading', () => {
    const mockContext: IndustryContextType = {
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
      ],
      contactTypes: ['Admin', 'Manager', 'User', 'Billing Contact'],
      isLoading: true,
    };

    mockUseIndustry.mockReturnValue(mockContext);

    render(<AppSidebar />);

    // Verify navigation items are not rendered when loading
    expect(screen.queryByText('Accounts')).not.toBeInTheDocument();
  });

  it('renders all industry sidebar items correctly', () => {
    const industries: Array<{
      industry: IndustryContextType['industry'];
      expectedItems: string[];
    }> = [
      {
        industry: 'Marketing',
        expectedItems: ['Clients', 'Campaigns', 'Proposals', 'Deliverables', 'Reports'],
      },
      {
        industry: 'RealEstate',
        expectedItems: ['Clients', 'Properties', 'Viewings', 'Offers', 'Deals'],
      },
      {
        industry: 'Consultancy',
        expectedItems: ['Clients', 'Engagements', 'Proposals', 'Deliverables', 'Outcomes'],
      },
    ];

    industries.forEach(({ industry, expectedItems }) => {
      const mockContext: IndustryContextType = {
        industry,
        terminology: {
          entitySingular: 'Client',
          entityPlural: 'Clients',
          personSingular: 'Contact',
          personPlural: 'Contacts',
        },
        features: {
          trials: false,
          onboarding: false,
          subscriptions: false,
          healthScores: false,
          supportTickets: false,
          applications: false,
          enrollments: false,
          schoolVisits: false,
          matters: false,
          conflictChecks: false,
          timeTracking: false,
          courtDates: false,
          campaigns: industry === 'Marketing',
          proposals: industry === 'Marketing' || industry === 'Consultancy',
          deliverables: industry === 'Marketing' || industry === 'Consultancy',
          performanceMetrics: industry === 'Marketing',
          clientReports: industry === 'Marketing',
          properties: industry === 'RealEstate',
          viewings: industry === 'RealEstate',
          offers: industry === 'RealEstate',
          negotiations: industry === 'RealEstate',
          deals: industry === 'RealEstate',
          engagements: industry === 'Consultancy',
          discoveries: industry === 'Consultancy',
          milestones: industry === 'Consultancy',
          outcomes: industry === 'Consultancy',
          retainers: industry === 'Consultancy',
        },
        pipelineTemplate: {
          name: 'Pipeline',
          stages: [],
        },
        sidebarItems: expectedItems.map((label, index) => ({
          key: label.toLowerCase(),
          label,
          icon: 'Building2',
          href: `/${label.toLowerCase()}`,
        })),
        contactTypes: [],
        isLoading: false,
      };

      mockUseIndustry.mockReturnValue(mockContext);

      const { unmount } = render(<AppSidebar />);

      // Verify all expected items are rendered
      expectedItems.forEach((item) => {
        expect(screen.getByText(item)).toBeInTheDocument();
      });

      unmount();
    });
  });
});
