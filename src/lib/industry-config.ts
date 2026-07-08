import type { IndustryVertical } from '@/lib/types';

export const INDUSTRY_LABELS: Record<IndustryVertical, string> = {
  SaaS: 'SaaS Product',
  SchoolEnrollment: 'School Admissions',
  Marketing: 'Marketing Agency',
  Law: 'Law Practice',
  RealEstate: 'Real Estate',
  Consultancy: 'Consultancy',
};

// ─────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────

export interface TerminologyMap {
  entitySingular: string;
  entityPlural: string;
  personSingular: string;
  personPlural: string;
  dealSingular?: string;
  dealPlural?: string;
}

export interface FeatureGate {
  // SaaS features
  trials: boolean;
  onboarding: boolean;
  subscriptions: boolean;
  healthScores: boolean;
  supportTickets: boolean;
  // School Enrollment features
  applications: boolean;
  enrollments: boolean;
  schoolVisits: boolean;
  // Law features
  matters: boolean;
  conflictChecks: boolean;
  timeTracking: boolean;
  courtDates: boolean;
  // Marketing features
  campaigns: boolean;
  proposals: boolean;
  deliverables: boolean;
  performanceMetrics: boolean;
  clientReports: boolean;
  // Real Estate features
  properties: boolean;
  viewings: boolean;
  offers: boolean;
  negotiations: boolean;
  deals: boolean;
  // Consultancy features
  engagements: boolean;
  discoveries: boolean;
  milestones: boolean;
  outcomes: boolean;
  retainers: boolean;
}

export interface PipelineTemplate {
  name: string;
  stages: string[];
}

export interface SidebarItem {
  key: string;
  label: string;
  icon: string;
  href: string;
}

export interface IndustryContext {
  industry: IndustryVertical;
  terminology: TerminologyMap;
  features: FeatureGate;
  pipelineTemplate: PipelineTemplate;
  contactTypes: string[];
  sidebarItems: SidebarItem[];
  defaultAutomations?: { name: string; trigger: string; action: string; }[];
}

// ─────────────────────────────────────────────────
// Industry Configuration Registry
// ─────────────────────────────────────────────────

export const INDUSTRY_CONFIG: Record<IndustryVertical, IndustryContext> = {
  SaaS: {
    industry: 'SaaS',
    terminology: {
      entitySingular: 'Account',
      entityPlural: 'Accounts',
      personSingular: 'User',
      personPlural: 'Users',
      dealSingular: 'Deal',
      dealPlural: 'Deals',
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
    contactTypes: ['Admin', 'Manager', 'User', 'Billing Contact'],
    sidebarItems: [
      { key: 'accounts', label: 'Accounts', icon: 'Building2', href: '/accounts' },
      { key: 'users', label: 'Users', icon: 'Users', href: '/users' },
      { key: 'trials', label: 'Trials', icon: 'TestTube', href: '/trials' },
      { key: 'subscriptions', label: 'Subscriptions', icon: 'CreditCard', href: '/subscriptions' },
      { key: 'health', label: 'Health', icon: 'Heart', href: '/health' },
      { key: 'support', label: 'Support', icon: 'LifeBuoy', href: '/support' },
    ],
    defaultAutomations: [
      { name: 'Create Deal on Account Creation', trigger: 'ENTITY_CREATED', action: 'CREATE_DEAL' }
    ],
  },

  SchoolEnrollment: {
    industry: 'SchoolEnrollment',
    terminology: {
      entitySingular: 'School',
      entityPlural: 'Schools',
      personSingular: 'Student',
      personPlural: 'Students',
      dealSingular: 'Deal',
      dealPlural: 'Deals',
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
    contactTypes: ['Principal', 'Administrator', 'Accountant', 'School Owner'],
    sidebarItems: [
      { key: 'schools', label: 'Schools', icon: 'School', href: '/schools' },
      { key: 'families', label: 'Families', icon: 'Users', href: '/families' },
      { key: 'pipeline', label: 'Pipeline', icon: 'GitBranch', href: '/pipeline' },
      { key: 'admissions', label: 'Admissions', icon: 'FileText', href: '/admissions' },
      { key: 'enrollments', label: 'Enrollments', icon: 'UserCheck', href: '/enrollments' },
    ],
    defaultAutomations: [
      { name: 'Create Deal on School Creation', trigger: 'ENTITY_CREATED', action: 'CREATE_DEAL' }
    ],
  },

  Law: {
    industry: 'Law',
    terminology: {
      entitySingular: 'Client',
      entityPlural: 'Clients',
      personSingular: 'Contact',
      personPlural: 'Contacts',
      dealSingular: 'Deal',
      dealPlural: 'Deals',
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
    contactTypes: ['Individual Client', 'Corporate Client', 'Witness', 'Expert'],
    sidebarItems: [
      { key: 'clients', label: 'Clients', icon: 'Scale', href: '/clients' },
      { key: 'matters', label: 'Matters', icon: 'Briefcase', href: '/matters' },
      { key: 'intake', label: 'Intake', icon: 'FileText', href: '/intake' },
      { key: 'consultations', label: 'Consultations', icon: 'Users', href: '/consultations' },
      { key: 'deadlines', label: 'Deadlines', icon: 'Calendar', href: '/deadlines' },
      { key: 'time-tracking', label: 'Time Tracking', icon: 'Clock', href: '/time-tracking' },
    ],
    defaultAutomations: [
      { name: 'Create Deal on Client Creation', trigger: 'ENTITY_CREATED', action: 'CREATE_DEAL' }
    ],
  },

  Marketing: {
    industry: 'Marketing',
    terminology: {
      entitySingular: 'Client',
      entityPlural: 'Clients',
      personSingular: 'Contact',
      personPlural: 'Contacts',
      dealSingular: 'Deal',
      dealPlural: 'Deals',
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
      campaigns: true,
      proposals: true,
      deliverables: true,
      performanceMetrics: true,
      clientReports: true,
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
      name: 'Agency Pipeline',
      stages: ['Discovery', 'Proposal', 'Planning', 'Execution', 'Reporting', 'Retention'],
    },
    contactTypes: ['Decision Maker', 'Influencer', 'User', 'Billing Contact'],
    sidebarItems: [
      { key: 'clients', label: 'Clients', icon: 'Building2', href: '/clients' },
      { key: 'campaigns', label: 'Campaigns', icon: 'Megaphone', href: '/campaigns' },
      { key: 'proposals', label: 'Proposals', icon: 'FileText', href: '/proposals' },
      { key: 'deliverables', label: 'Deliverables', icon: 'Target', href: '/deliverables' },
      { key: 'reports', label: 'Reports', icon: 'BarChart', href: '/reports' },
    ],
    defaultAutomations: [
      { name: 'Create Deal on Client Creation', trigger: 'ENTITY_CREATED', action: 'CREATE_DEAL' }
    ],
  },

  RealEstate: {
    industry: 'RealEstate',
    terminology: {
      entitySingular: 'Client',
      entityPlural: 'Clients',
      personSingular: 'Contact',
      personPlural: 'Contacts',
      dealSingular: 'Deal',
      dealPlural: 'Deals',
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
      campaigns: false,
      proposals: false,
      deliverables: false,
      performanceMetrics: false,
      clientReports: false,
      properties: true,
      viewings: true,
      offers: true,
      negotiations: true,
      deals: true,
      engagements: false,
      discoveries: false,
      milestones: false,
      outcomes: false,
      retainers: false,
    },
    pipelineTemplate: {
      name: 'Property Pipeline',
      stages: ['Enquiry', 'Viewing', 'Offer', 'Negotiation', 'Documentation', 'Closed'],
    },
    contactTypes: ['Buyer', 'Seller', 'Tenant', 'Landlord', 'Investor'],
    sidebarItems: [
      { key: 'clients', label: 'Clients', icon: 'Users', href: '/clients' },
      { key: 'properties', label: 'Properties', icon: 'Home', href: '/properties' },
      { key: 'viewings', label: 'Viewings', icon: 'Eye', href: '/viewings' },
      { key: 'offers', label: 'Offers', icon: 'Handshake', href: '/offers' },
      { key: 'deals', label: 'Deals', icon: 'TrendingUp', href: '/deals' },
    ],
    defaultAutomations: [
      { name: 'Create Deal on Client Creation', trigger: 'ENTITY_CREATED', action: 'CREATE_DEAL' }
    ],
  },

  Consultancy: {
    industry: 'Consultancy',
    terminology: {
      entitySingular: 'Client',
      entityPlural: 'Clients',
      personSingular: 'Contact',
      personPlural: 'Contacts',
      dealSingular: 'Deal',
      dealPlural: 'Deals',
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
      engagements: true,
      discoveries: true,
      milestones: true,
      outcomes: true,
      retainers: true,
    },
    pipelineTemplate: {
      name: 'Consulting Pipeline',
      stages: ['Enquiry', 'Discovery', 'Proposal', 'Engagement', 'Delivery', 'Outcome'],
    },
    contactTypes: ['Decision Maker', 'Influencer', 'User', 'Sponsor'],
    sidebarItems: [
      { key: 'clients', label: 'Clients', icon: 'Building2', href: '/clients' },
      { key: 'engagements', label: 'Engagements', icon: 'Briefcase', href: '/engagements' },
      { key: 'proposals', label: 'Proposals', icon: 'FileText', href: '/proposals' },
      { key: 'deliverables', label: 'Deliverables', icon: 'Target', href: '/deliverables' },
      { key: 'outcomes', label: 'Outcomes', icon: 'TrendingUp', href: '/outcomes' },
    ],
    defaultAutomations: [
      { name: 'Create Deal on Client Creation', trigger: 'ENTITY_CREATED', action: 'CREATE_DEAL' }
    ],
  },
};


// ─────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────

export function getSidebarItemsForIndustry(industry: IndustryVertical): SidebarItem[] {
  return INDUSTRY_CONFIG[industry].sidebarItems;
}

export function getEnabledIndustries(): IndustryVertical[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const featureFlags = require('@/lib/feature-flags');
    if (typeof featureFlags.getEnabledIndustries === 'function') {
      return featureFlags.getEnabledIndustries() as IndustryVertical[];
    }
  } catch {
    // feature-flags.ts not yet implemented (task 4) — fall back to all industries
  }
  return ['SaaS', 'SchoolEnrollment', 'Law', 'Marketing', 'RealEstate', 'Consultancy'];
}
