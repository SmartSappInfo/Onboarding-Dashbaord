import { AppField, EntityType, IndustryVertical } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Icon Resolution
// ─────────────────────────────────────────────────────────────────────────────

const ICON_KEYWORD_MAP: Record<string, string> = {
  identity: 'Building',
  contact: 'UserCheck',
  lead: 'UserPlus',
  finance: 'Banknote',
  billing: 'CreditCard',
  pipeline: 'Workflow',
  deal: 'HandCoins',
  attribution: 'BarChart3',
  meeting: 'Calendar',
  survey: 'ClipboardList',
  property: 'Home',
  legal: 'Scale',
  case: 'Briefcase',
  campaign: 'Megaphone',
  client: 'Users',
  engagement: 'Handshake',
  deliverable: 'PackageCheck',
  listing: 'MapPin',
  transaction: 'ArrowLeftRight',
  company: 'Building2',
  signatory: 'PenTool',
};

/**
 * Resolves an appropriate Lucide icon name based on the group name keywords.
 */
export function resolveGroupIcon(groupName: string): string {
  const lower = groupName.toLowerCase();
  for (const [keyword, icon] of Object.entries(ICON_KEYWORD_MAP)) {
    if (lower.includes(keyword)) return icon;
  }
  return 'Database'; // Default fallback
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface IndustryFieldDef {
  name: string; // Internal name / label
  variableName: string;
  type: AppField['type'];
  compatibilityScope: AppField['compatibilityScope'];
  helpText?: string;
  placeholder?: string;
  defaultValue?: any;
  options?: { value: string; label: string }[];
  validationRules?: AppField['validationRules'];
}

export interface IndustryGroupDef {
  slug: string;
  name: string;
  description: string;
  entityTypes: EntityType[];
  order: number;
  fields: IndustryFieldDef[];
}

export interface IndustryMetadata {
  id: IndustryVertical;
  name: string;
  icon: string;
  description: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export const INDUSTRY_METADATA: Record<IndustryVertical, IndustryMetadata> = {
  SchoolEnrollment: {
    id: 'SchoolEnrollment',
    name: 'Education & Schools',
    icon: 'School',
    description: 'Optimized for admissions, student enrollment, and parent engagement.'
  },
  SaaS: {
    id: 'SaaS',
    name: 'Software & SaaS',
    icon: 'Cpu',
    description: 'Track deals, lead sources, and subscription lifecycles.'
  },
  Law: {
    id: 'Law',
    name: 'Legal & Law Firms',
    icon: 'Scale',
    description: 'Manage cases, client retainers, and filing deadlines.'
  },
  Marketing: {
    id: 'Marketing',
    name: 'Marketing Agency',
    icon: 'Megaphone',
    description: 'Track campaign spend, leads generated, and client performance.'
  },
  RealEstate: {
    id: 'RealEstate',
    name: 'Real Estate',
    icon: 'Home',
    description: 'Manage property listings, buyer/seller contacts, and escrow.'
  },
  Consultancy: {
    id: 'Consultancy',
    name: 'Consultancy',
    icon: 'Briefcase',
    description: 'Track engagement status, stakeholder contacts, and deliverables.'
  }
};

export const INDUSTRY_FIELD_REGISTRY: Record<IndustryVertical, IndustryGroupDef[]> = {
  SchoolEnrollment: [
    {
      slug: 'school_identity',
      name: 'School Identity',
      description: 'Core identifying properties for the institution',
      entityTypes: ['institution'],
      order: 10,
      fields: [
        { name: 'School Name', variableName: 'school_name', type: 'short_text', compatibilityScope: ['institution', 'common'], validationRules: { required: true } },
        { name: 'School Initials', variableName: 'school_initials', type: 'short_text', compatibilityScope: ['institution', 'common'] },
        { name: 'Location/Address', variableName: 'school_location', type: 'address', compatibilityScope: ['institution', 'common'] },
        { name: 'Main Phone', variableName: 'school_phone', type: 'phone', compatibilityScope: ['institution', 'common'] },
        { name: 'General Email', variableName: 'school_email', type: 'email', compatibilityScope: ['institution', 'common'] },
      ]
    },
    {
      slug: 'contact_signatory',
      name: 'Contact & Signatory',
      description: 'Primary contact person details',
      entityTypes: ['person'],
      order: 20,
      fields: [
        { name: 'Signatory Name', variableName: 'contact_name', type: 'short_text', compatibilityScope: ['person', 'common'], validationRules: { required: true } },
        { name: 'Signatory Position', variableName: 'contact_position', type: 'short_text', compatibilityScope: ['person', 'common'] },
        { name: 'Contact Email', variableName: 'contact_email', type: 'email', compatibilityScope: ['person', 'common'] },
        { name: 'Contact Phone', variableName: 'contact_phone', type: 'phone', compatibilityScope: ['person', 'common'] },
      ]
    },
    {
      slug: 'financial_profile',
      name: 'Financial Profile',
      description: 'Billing and subscription details',
      entityTypes: ['institution'],
      order: 30,
      fields: [
        { name: 'Subscription Tier', variableName: 'school_package', type: 'select', compatibilityScope: ['institution'], options: [{ label: 'Starter', value: 'starter' }, { label: 'Professional', value: 'pro' }, { label: 'Enterprise', value: 'enterprise' }] },
        { name: 'Effective Rate', variableName: 'subscription_rate', type: 'currency', compatibilityScope: ['institution'] },
        { name: 'Total Amount', variableName: 'subscription_total', type: 'currency', compatibilityScope: ['institution'] },
        { name: 'Outstanding Arrears', variableName: 'arrears_balance', type: 'currency', compatibilityScope: ['institution'] },
      ]
    },
    {
      slug: 'enrollment_metrics',
      name: 'Enrollment Metrics',
      description: 'Student capacity and counts',
      entityTypes: ['institution'],
      order: 40,
      fields: [
        { name: 'Nominal Roll', variableName: 'nominal_roll', type: 'number', compatibilityScope: ['institution'] },
      ]
    }
  ],
  SaaS: [
    {
      slug: 'company_identity',
      name: 'Company Identity',
      description: 'Account and company details',
      entityTypes: ['institution'],
      order: 10,
      fields: [
        { name: 'Company Name', variableName: 'company_name', type: 'short_text', compatibilityScope: ['institution', 'common'], validationRules: { required: true } },
        { name: 'Website', variableName: 'website', type: 'url', compatibilityScope: ['institution', 'common'] },
        { name: 'Industry Sector', variableName: 'industry_sector', type: 'short_text', compatibilityScope: ['institution'] },
        { name: 'Employee Count', variableName: 'employee_count', type: 'select', compatibilityScope: ['institution'], options: [{label: '1-10', value: '1-10'}, {label: '11-50', value: '11-50'}, {label: '51-200', value: '51-200'}, {label: '201+', value: '201+'}] },
        { name: 'Billing Address', variableName: 'billing_address', type: 'address', compatibilityScope: ['institution'] },
        { name: 'Referee', variableName: 'referee', type: 'short_text', compatibilityScope: ['institution', 'common'] },
      ]
    },
    {
      slug: 'saas_financials',
      name: 'SaaS Financials',
      description: 'Subscription and billing metrics',
      entityTypes: ['institution'],
      order: 20,
      fields: [
        { name: 'Plan Type', variableName: 'plan_type', type: 'select', compatibilityScope: ['institution'], options: [{label: 'Free', value: 'Free'}, {label: 'Standard', value: 'Standard'}, {label: 'Professional', value: 'Professional'}, {label: 'Enterprise', value: 'Enterprise'}] },
        { name: 'Customer Tier', variableName: 'customer_tier', type: 'select', compatibilityScope: ['institution'], options: [{label: 'Basic', value: 'basic'}, {label: 'Silver', value: 'silver'}, {label: 'Gold', value: 'gold'}] },
        { name: 'Subscription Rate', variableName: 'subscription_rate', type: 'currency', compatibilityScope: ['institution'] },
        { name: 'Signup Date', variableName: 'signup_date', type: 'date', compatibilityScope: ['institution'] },
        { name: 'Currency', variableName: 'currency', type: 'short_text', compatibilityScope: ['institution'], defaultValue: 'USD' },
      ]
    },
    {
      slug: 'saas_operations',
      name: 'SaaS Operations',
      description: 'Account health and capacity metrics',
      entityTypes: ['institution'],
      order: 30,
      fields: [
        { name: 'Account Status', variableName: 'account_status', type: 'select', compatibilityScope: ['institution'], options: [{label: 'Lead', value: 'lead'}, {label: 'Active', value: 'active'}, {label: 'At Risk', value: 'at_risk'}, {label: 'Churned', value: 'churned'}] },
        { name: 'Capacity', variableName: 'capacity', type: 'number', compatibilityScope: ['institution'], helpText: 'User or seat capacity' },
      ]
    },
    {
      slug: 'contact_lead',
      name: 'Contact & Lead',
      description: 'User and prospect details',
      entityTypes: ['person'],
      order: 40,
      fields: [
        { name: 'First Name', variableName: 'first_name', type: 'short_text', compatibilityScope: ['person', 'common'], validationRules: { required: true } },
        { name: 'Last Name', variableName: 'last_name', type: 'short_text', compatibilityScope: ['person', 'common'] },
        { name: 'Job Title', variableName: 'job_title', type: 'short_text', compatibilityScope: ['person', 'common'] },
        { name: 'Lead Source', variableName: 'lead_source', type: 'select', compatibilityScope: ['person'], options: [{label: 'Organic', value: 'organic'}, {label: 'Paid', value: 'paid'}, {label: 'Referral', value: 'referral'}, {label: 'Outbound', value: 'outbound'}] },
      ]
    },
    {
      slug: 'marketing_attribution',
      name: 'Marketing Attribution',
      description: 'Hidden UTM and attribution tracking parameters',
      entityTypes: ['person', 'institution'],
      order: 50,
      fields: [
        { name: 'Channel', variableName: 'channel', type: 'hidden', compatibilityScope: ['person', 'institution'] },
        { name: 'Channel Drilldown 1', variableName: 'channel_drilldown_1', type: 'hidden', compatibilityScope: ['person', 'institution'] },
        { name: 'Channel Drilldown 2', variableName: 'channel_drilldown_2', type: 'hidden', compatibilityScope: ['person', 'institution'] },
        { name: 'Landing Page', variableName: 'landing_page', type: 'hidden', compatibilityScope: ['person', 'institution'] },
        { name: 'Landing Page Group', variableName: 'landing_page_group', type: 'hidden', compatibilityScope: ['person', 'institution'] },
      ]
    }
  ],
  Law: [
    {
      slug: 'case_identity',
      name: 'Case Identity',
      description: 'Primary case and matter details',
      entityTypes: ['institution'], // Using institution for matter/case
      order: 10,
      fields: [
        { name: 'Case Number', variableName: 'case_number', type: 'short_text', compatibilityScope: ['institution', 'common'], validationRules: { required: true } },
        { name: 'Matter Type', variableName: 'matter_type', type: 'select', compatibilityScope: ['institution'], options: [{label: 'Corporate', value: 'corporate'}, {label: 'Litigation', value: 'litigation'}, {label: 'Real Estate', value: 'real_estate'}, {label: 'Family', value: 'family'}] },
        { name: 'Date Opened', variableName: 'date_opened', type: 'date', compatibilityScope: ['institution'] },
      ]
    },
    {
      slug: 'client_contact',
      name: 'Client Contact',
      description: 'Details of the client',
      entityTypes: ['person'],
      order: 20,
      fields: [
        { name: 'Client First Name', variableName: 'client_first_name', type: 'short_text', compatibilityScope: ['person', 'common'], validationRules: { required: true } },
        { name: 'Client Last Name', variableName: 'client_last_name', type: 'short_text', compatibilityScope: ['person', 'common'] },
        { name: 'Primary Email', variableName: 'client_email', type: 'email', compatibilityScope: ['person', 'common'] },
        { name: 'Mobile Phone', variableName: 'client_phone', type: 'phone', compatibilityScope: ['person', 'common'] },
      ]
    },
    {
      slug: 'billing_retainer',
      name: 'Billing & Retainer',
      description: 'Financial agreements',
      entityTypes: ['institution', 'person'],
      order: 30,
      fields: [
        { name: 'Retainer Amount', variableName: 'retainer_amount', type: 'currency', compatibilityScope: ['institution', 'person'] },
        { name: 'Hourly Rate', variableName: 'hourly_rate', type: 'currency', compatibilityScope: ['institution', 'person'] },
        { name: 'Billing Frequency', variableName: 'billing_frequency', type: 'select', compatibilityScope: ['institution', 'person'], options: [{label: 'Monthly', value: 'monthly'}, {label: 'Milestone', value: 'milestone'}, {label: 'Upon Completion', value: 'upon_completion'}] },
      ]
    },
    {
      slug: 'court_filings',
      name: 'Court & Filings',
      description: 'Legal procedure tracking',
      entityTypes: ['institution'],
      order: 40,
      fields: [
        { name: 'Court Name', variableName: 'court_name', type: 'short_text', compatibilityScope: ['institution'] },
        { name: 'Next Filing Deadline', variableName: 'filing_deadline', type: 'date', compatibilityScope: ['institution'] },
        { name: 'Judge/Magistrate', variableName: 'judge_name', type: 'short_text', compatibilityScope: ['institution'] },
      ]
    }
  ],
  Marketing: [
    {
      slug: 'campaign_identity',
      name: 'Campaign Identity',
      description: 'Core details of the marketing initiative',
      entityTypes: ['institution'],
      order: 10,
      fields: [
        { name: 'Campaign Name', variableName: 'campaign_name', type: 'short_text', compatibilityScope: ['institution', 'common'], validationRules: { required: true } },
        { name: 'Client Name', variableName: 'client_name', type: 'short_text', compatibilityScope: ['institution', 'common'] },
        { name: 'Launch Date', variableName: 'launch_date', type: 'date', compatibilityScope: ['institution'] },
        { name: 'Target Audience', variableName: 'target_audience', type: 'short_text', compatibilityScope: ['institution'] },
      ]
    },
    {
      slug: 'client_contact',
      name: 'Client Contact',
      description: 'Point of contact at the client organization',
      entityTypes: ['person'],
      order: 20,
      fields: [
        { name: 'Contact Name', variableName: 'poc_name', type: 'short_text', compatibilityScope: ['person', 'common'], validationRules: { required: true } },
        { name: 'Role/Title', variableName: 'poc_role', type: 'short_text', compatibilityScope: ['person'] },
        { name: 'Email Address', variableName: 'poc_email', type: 'email', compatibilityScope: ['person', 'common'] },
      ]
    },
    {
      slug: 'performance_metrics',
      name: 'Performance Metrics',
      description: 'Campaign KPIs and budgeting',
      entityTypes: ['institution'],
      order: 30,
      fields: [
        { name: 'Total Budget', variableName: 'total_budget', type: 'currency', compatibilityScope: ['institution'] },
        { name: 'Current Spend', variableName: 'current_spend', type: 'currency', compatibilityScope: ['institution'] },
        { name: 'Leads Generated', variableName: 'leads_generated', type: 'number', compatibilityScope: ['institution'] },
        { name: 'Target CPA', variableName: 'target_cpa', type: 'currency', compatibilityScope: ['institution'] },
      ]
    },
    {
      slug: 'marketing_attribution',
      name: 'Marketing Attribution',
      description: 'UTM and source tracking',
      entityTypes: ['person', 'institution'],
      order: 40,
      fields: [
        { name: 'UTM Source', variableName: 'utm_source', type: 'hidden', compatibilityScope: ['person', 'institution'] },
        { name: 'UTM Medium', variableName: 'utm_medium', type: 'hidden', compatibilityScope: ['person', 'institution'] },
        { name: 'UTM Campaign', variableName: 'utm_campaign', type: 'hidden', compatibilityScope: ['person', 'institution'] },
        { name: 'Referrer URL', variableName: 'referrer_url', type: 'hidden', compatibilityScope: ['person', 'institution'] },
      ]
    }
  ],
  RealEstate: [
    {
      slug: 'property_details',
      name: 'Property Details',
      description: 'Core details of the real estate asset',
      entityTypes: ['institution'], // Institution acts as Property
      order: 10,
      fields: [
        { name: 'Property Address', variableName: 'property_address', type: 'address', compatibilityScope: ['institution', 'common'], validationRules: { required: true } },
        { name: 'Property Type', variableName: 'property_type', type: 'select', compatibilityScope: ['institution'], options: [{label: 'Residential', value: 'residential'}, {label: 'Commercial', value: 'commercial'}, {label: 'Industrial', value: 'industrial'}, {label: 'Land', value: 'land'}] },
        { name: 'Square Footage', variableName: 'square_footage', type: 'number', compatibilityScope: ['institution'] },
        { name: 'Year Built', variableName: 'year_built', type: 'number', compatibilityScope: ['institution'] },
      ]
    },
    {
      slug: 'buyer_seller_contact',
      name: 'Buyer/Seller Contact',
      description: 'Client details',
      entityTypes: ['person'],
      order: 20,
      fields: [
        { name: 'Client Name', variableName: 'client_name', type: 'short_text', compatibilityScope: ['person', 'common'], validationRules: { required: true } },
        { name: 'Client Role', variableName: 'client_role', type: 'select', compatibilityScope: ['person'], options: [{label: 'Buyer', value: 'buyer'}, {label: 'Seller', value: 'seller'}, {label: 'Landlord', value: 'landlord'}, {label: 'Tenant', value: 'tenant'}] },
        { name: 'Email Address', variableName: 'client_email', type: 'email', compatibilityScope: ['person', 'common'] },
        { name: 'Phone Number', variableName: 'client_phone', type: 'phone', compatibilityScope: ['person', 'common'] },
      ]
    },
    {
      slug: 'listing_details',
      name: 'Listing Details',
      description: 'Market positioning and pricing',
      entityTypes: ['institution'],
      order: 30,
      fields: [
        { name: 'Listing Price', variableName: 'listing_price', type: 'currency', compatibilityScope: ['institution', 'common'] },
        { name: 'MLS Number', variableName: 'mls_number', type: 'short_text', compatibilityScope: ['institution'] },
        { name: 'Listing Date', variableName: 'listing_date', type: 'date', compatibilityScope: ['institution'] },
        { name: 'Status', variableName: 'listing_status', type: 'select', compatibilityScope: ['institution'], options: [{label: 'Active', value: 'active'}, {label: 'Pending', value: 'pending'}, {label: 'Sold', value: 'sold'}, {label: 'Off Market', value: 'off_market'}] },
      ]
    },
    {
      slug: 'transaction_closing',
      name: 'Transaction & Closing',
      description: 'Escrow and closing details',
      entityTypes: ['institution', 'person'],
      order: 40,
      fields: [
        { name: 'Accepted Offer', variableName: 'accepted_offer', type: 'currency', compatibilityScope: ['institution'] },
        { name: 'Expected Closing Date', variableName: 'closing_date', type: 'date', compatibilityScope: ['institution', 'person'] },
        { name: 'Escrow Company', variableName: 'escrow_company', type: 'short_text', compatibilityScope: ['institution'] },
      ]
    }
  ],
  Consultancy: [
    {
      slug: 'engagement_identity',
      name: 'Engagement Identity',
      description: 'Project or engagement details',
      entityTypes: ['institution'], // Institution acts as Project/Engagement
      order: 10,
      fields: [
        { name: 'Engagement Name', variableName: 'engagement_name', type: 'short_text', compatibilityScope: ['institution', 'common'], validationRules: { required: true } },
        { name: 'Client Company', variableName: 'client_company', type: 'short_text', compatibilityScope: ['institution', 'common'] },
        { name: 'Start Date', variableName: 'start_date', type: 'date', compatibilityScope: ['institution'] },
        { name: 'Status', variableName: 'project_status', type: 'select', compatibilityScope: ['institution'], options: [{label: 'Scoping', value: 'scoping'}, {label: 'Active', value: 'active'}, {label: 'On Hold', value: 'on_hold'}, {label: 'Completed', value: 'completed'}] },
      ]
    },
    {
      slug: 'client_contact',
      name: 'Client Contact',
      description: 'Key stakeholders',
      entityTypes: ['person'],
      order: 20,
      fields: [
        { name: 'Stakeholder Name', variableName: 'stakeholder_name', type: 'short_text', compatibilityScope: ['person', 'common'], validationRules: { required: true } },
        { name: 'Title/Role', variableName: 'stakeholder_title', type: 'short_text', compatibilityScope: ['person'] },
        { name: 'Email', variableName: 'stakeholder_email', type: 'email', compatibilityScope: ['person', 'common'] },
      ]
    },
    {
      slug: 'deliverables_scope',
      name: 'Deliverables & Scope',
      description: 'What is being delivered',
      entityTypes: ['institution'],
      order: 30,
      fields: [
        { name: 'Project Scope', variableName: 'project_scope', type: 'long_text', compatibilityScope: ['institution'] },
        { name: 'Key Deliverable 1', variableName: 'deliverable_1', type: 'short_text', compatibilityScope: ['institution'] },
        { name: 'Estimated Hours', variableName: 'estimated_hours', type: 'number', compatibilityScope: ['institution'] },
      ]
    },
    {
      slug: 'billing_invoicing',
      name: 'Billing & Invoicing',
      description: 'Financial terms',
      entityTypes: ['institution', 'person'],
      order: 40,
      fields: [
        { name: 'Billing Type', variableName: 'billing_type', type: 'select', compatibilityScope: ['institution'], options: [{label: 'Fixed Fee', value: 'fixed_fee'}, {label: 'Time & Materials', value: 'time_materials'}, {label: 'Retainer', value: 'retainer'}] },
        { name: 'Total Fee / Budget', variableName: 'total_fee', type: 'currency', compatibilityScope: ['institution'] },
        { name: 'Day Rate', variableName: 'day_rate', type: 'currency', compatibilityScope: ['institution', 'person'] },
        { name: 'Invoicing Schedule', variableName: 'invoicing_schedule', type: 'short_text', compatibilityScope: ['institution'] },
      ]
    }
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// Platform-Scoped Field Groups (App-Level Variables)
//
// These are seeded for EVERY workspace regardless of industry.
// They cover entity identity, feature modules (meetings, surveys, forms,
// agreements), entity lifecycle, and messaging/system fields.
// ─────────────────────────────────────────────────────────────────────────────

export const PLATFORM_FIELD_GROUPS: IndustryGroupDef[] = [
  // ── Entity Identity ───────────────────────────────────────────────────────
  {
    slug: 'entity_identity',
    name: 'Entity Identity',
    description: 'Core entity and contact identity fields available across the platform',
    entityTypes: ['institution', 'person', 'family'],
    order: 1,
    fields: [
      { name: 'Entity Name', variableName: 'entity_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Name of the entity (school, company, person, or family)' },
      { name: 'Contact Name (Primary)', variableName: 'contact_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Full name of the primary contact' },
      { name: 'Contact Email (Primary)', variableName: 'contact_email', type: 'email', compatibilityScope: ['common'], helpText: 'Email address of the primary contact' },
      { name: 'Contact Phone (Primary)', variableName: 'contact_phone', type: 'phone', compatibilityScope: ['common'], helpText: 'Phone number of the primary contact' },
      { name: 'Signatory Name', variableName: 'signatory_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Full name of the designated signatory' },
      { name: 'Signatory Email', variableName: 'signatory_email', type: 'email', compatibilityScope: ['common'], helpText: 'Email address of the designated signatory' },
      { name: 'Signatory Phone', variableName: 'signatory_phone', type: 'phone', compatibilityScope: ['common'], helpText: 'Phone number of the designated signatory' },
      { name: 'Initials', variableName: 'initials', type: 'short_text', compatibilityScope: ['common'] },
      { name: 'Referee', variableName: 'referee', type: 'short_text', compatibilityScope: ['common'] },
      { name: 'Location String', variableName: 'location_string', type: 'short_text', compatibilityScope: ['common'] },
      { name: 'Zone Name', variableName: 'zone_name', type: 'short_text', compatibilityScope: ['common'] },
      { name: 'Organization Name', variableName: 'organization_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Name of the organization' },
      { name: 'Workspace Name', variableName: 'workspace_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Name of the current workspace' },
      { name: 'User Name', variableName: 'user_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Name of the logged-in user sending the message' },
    ]
  },

  // ── System & Date/Time ────────────────────────────────────────────────────
  {
    slug: 'system_datetime',
    name: 'System & Date/Time',
    description: 'Auto-computed date and time variables',
    entityTypes: ['institution', 'person', 'family'],
    order: 2,
    fields: [
      { name: 'Current Date', variableName: 'current_date', type: 'date', compatibilityScope: ['common'], helpText: "Today's date (auto-computed)" },
      { name: 'Current Time', variableName: 'current_time', type: 'short_text', compatibilityScope: ['common'], helpText: 'Current time of day (auto-computed)' },
      { name: 'Current Year', variableName: 'current_year', type: 'number', compatibilityScope: ['common'], helpText: 'The current calendar year (auto-computed)' },
    ]
  },

  // ── Meetings ──────────────────────────────────────────────────────────────
  {
    slug: 'meetings',
    name: 'Meetings & Webinars',
    description: 'Variables for meeting invitations, reminders, and follow-ups',
    entityTypes: ['institution', 'person', 'family'],
    order: 50,
    fields: [
      { name: 'Meeting Link', variableName: 'meeting_link', type: 'url', compatibilityScope: ['common'], helpText: 'URL to join the meeting' },
      { name: 'Meeting Time', variableName: 'meeting_time', type: 'datetime', compatibilityScope: ['common'], helpText: 'Scheduled time of the meeting' },
      { name: 'Meeting Title', variableName: 'meeting_title', type: 'short_text', compatibilityScope: ['common'], helpText: 'Title or name of the meeting' },
      { name: 'Meeting Type', variableName: 'meeting_type', type: 'short_text', compatibilityScope: ['common'], helpText: 'Type/category of the meeting (e.g. Webinar, 1:1)' },
      { name: 'Organizer Name', variableName: 'organizer_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Name of the meeting organizer' },
      { name: 'Attendee Names', variableName: 'attendee_names', type: 'short_text', compatibilityScope: ['common'], helpText: 'Comma-separated list of attendee names' },
      { name: 'Meeting Date', variableName: 'meeting_date', type: 'date', compatibilityScope: ['common'], helpText: 'Date of the meeting' },
      { name: 'Meeting Duration', variableName: 'meeting_duration', type: 'short_text', compatibilityScope: ['common'], helpText: 'Duration of the meeting (e.g. 60 minutes)' },
    ]
  },

  // ── Forms & PDFs ──────────────────────────────────────────────────────────
  {
    slug: 'forms_pdfs',
    name: 'Forms & PDFs',
    description: 'Variables for form distribution, submission tracking, and PDF agreements',
    entityTypes: ['institution', 'person', 'family'],
    order: 51,
    fields: [
      { name: 'Form Name', variableName: 'form_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Name of the form' },
      { name: 'Form Link', variableName: 'form_link', type: 'url', compatibilityScope: ['common'], helpText: 'URL to access the form' },
      { name: 'Submission Deadline', variableName: 'submission_deadline', type: 'date', compatibilityScope: ['common'], helpText: 'Deadline for form submission' },
      { name: 'Respondent Name', variableName: 'respondent_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Name of the person filling out the form' },
      { name: 'Submission Date', variableName: 'submission_date', type: 'date', compatibilityScope: ['common'], helpText: 'Date the form was submitted' },
      { name: 'Days Remaining (Form)', variableName: 'form_days_remaining', type: 'number', compatibilityScope: ['common'], helpText: 'Number of days until the submission deadline' },
      { name: 'Agreement URL', variableName: 'agreement_url', type: 'url', compatibilityScope: ['common'], helpText: 'Direct link to the contract/agreement PDF' },
    ]
  },

  // ── Surveys ───────────────────────────────────────────────────────────────
  {
    slug: 'surveys',
    name: 'Surveys & Feedback',
    description: 'Variables for survey distribution, completion tracking, and result notifications',
    entityTypes: ['institution', 'person', 'family'],
    order: 52,
    fields: [
      { name: 'Survey Title', variableName: 'survey_title', type: 'short_text', compatibilityScope: ['common'], helpText: 'Title of the survey' },
      { name: 'Survey Link', variableName: 'survey_link', type: 'url', compatibilityScope: ['common'], helpText: 'URL to access the survey' },
      { name: 'Completion Status', variableName: 'completion_status', type: 'short_text', compatibilityScope: ['common'], helpText: 'Whether the survey has been completed' },
      { name: 'Score', variableName: 'score', type: 'number', compatibilityScope: ['common'], helpText: 'Score achieved on the survey' },
      { name: 'Result Message', variableName: 'result_message', type: 'short_text', compatibilityScope: ['common'], helpText: 'Message based on survey result/score' },
      { name: 'Completion Date', variableName: 'completion_date', type: 'date', compatibilityScope: ['common'], helpText: 'Date the survey was completed' },
      { name: 'Days Remaining (Survey)', variableName: 'survey_days_remaining', type: 'number', compatibilityScope: ['common'], helpText: 'Number of days until the survey deadline' },
    ]
  },

  // ── Agreements & Contracts ────────────────────────────────────────────────
  {
    slug: 'agreements',
    name: 'Agreements & Contracts',
    description: 'Variables for contract signing workflows and status tracking',
    entityTypes: ['institution', 'person', 'family'],
    order: 53,
    fields: [
      { name: 'Contract Name', variableName: 'contract_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Name of the contract or agreement' },
      { name: 'Contract Link', variableName: 'contract_link', type: 'url', compatibilityScope: ['common'], helpText: 'URL to view or sign the contract' },
      { name: 'Signatory Name', variableName: 'signatory_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Name of the person who signs the contract' },
      { name: 'Signing Deadline', variableName: 'signing_deadline', type: 'date', compatibilityScope: ['common'], helpText: 'Deadline for signing the contract' },
      { name: 'Contract Status', variableName: 'contract_status', type: 'short_text', compatibilityScope: ['common'], helpText: 'Current status of the contract (e.g. Pending Signature)' },
      { name: 'Signing Date', variableName: 'signing_date', type: 'date', compatibilityScope: ['common'], helpText: 'Date the contract was signed' },
      { name: 'Days Remaining (Contract)', variableName: 'contract_days_remaining', type: 'number', compatibilityScope: ['common'], helpText: 'Number of days until the signing deadline' },
    ]
  },

  // ── Entity Lifecycle ──────────────────────────────────────────────────────
  {
    slug: 'entity_lifecycle',
    name: 'Entity Lifecycle',
    description: 'Pipeline stage changes, status transitions, and assignment tracking',
    entityTypes: ['institution', 'person', 'family'],
    order: 54,
    fields: [
      { name: 'Old Stage', variableName: 'old_stage', type: 'short_text', compatibilityScope: ['common'], helpText: 'Previous pipeline stage of the entity' },
      { name: 'New Stage', variableName: 'new_stage', type: 'short_text', compatibilityScope: ['common'], helpText: 'New pipeline stage of the entity' },
      { name: 'Assigned To', variableName: 'assigned_to', type: 'short_text', compatibilityScope: ['common'], helpText: 'Name of the user assigned to this entity' },
      { name: 'Assigner Name', variableName: 'assigner_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Name of the user who made the assignment' },
      { name: 'Old Status', variableName: 'old_status', type: 'short_text', compatibilityScope: ['common'], helpText: 'Previous status of the entity' },
      { name: 'New Status', variableName: 'new_status', type: 'short_text', compatibilityScope: ['common'], helpText: 'New status of the entity' },
    ]
  },

  // ── Messaging ─────────────────────────────────────────────────────────────
  {
    slug: 'messaging',
    name: 'Messaging & Notifications',
    description: 'Variables for personalized messaging, links, and notification context',
    entityTypes: ['institution', 'person', 'family'],
    order: 55,
    fields: [
      { name: 'School Name', variableName: 'school_name', type: 'short_text', compatibilityScope: ['institution', 'common'], helpText: 'Alias for entity name (backward-compatible)' },
      { name: 'First Name', variableName: 'first_name', type: 'short_text', compatibilityScope: ['person', 'common'], helpText: 'First name of the contact (derived from contact_name)' },
      { name: 'Link', variableName: 'link', type: 'url', compatibilityScope: ['common'], helpText: 'Generic action link for the message' },
      { name: 'ID', variableName: 'id', type: 'short_text', compatibilityScope: ['common'], helpText: 'Entity identifier' },
    ]
  },
];
