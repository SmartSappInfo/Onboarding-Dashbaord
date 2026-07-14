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
  metrics: 'LineChart',
  status: 'Activity',
  details: 'FileText',
  scope: 'Target'
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
  name: string;
  variableName: string;
  type: AppField['type'];
  compatibilityScope: AppField['compatibilityScope'];
  helpText?: string;
  placeholder?: string;
  defaultValue?: any;
  options?: { label: string; value: string }[];
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
      slug: 'enrollment_metrics',
      name: 'Enrollment Metrics',
      description: 'Key metrics and operational capacity',
      entityTypes: ['institution'],
      order: 10,
      fields: [
        { name: 'Nominal Roll', variableName: 'nominal_roll', type: 'number', compatibilityScope: ['institution'] },
        { name: 'Current Capacity', variableName: 'current_capacity', type: 'number', compatibilityScope: ['institution'] },
        { name: 'Curriculum Type', variableName: 'curriculum_type', type: 'select', compatibilityScope: ['institution'], options: [{label: 'National', value: 'national'}, {label: 'International', value: 'international'}, {label: 'Blended', value: 'blended'}] },
      ]
    }
  ],
  SaaS: [
    {
      slug: 'saas_operations',
      name: 'SaaS Operations',
      description: 'Scale, financial, and operational parameters',
      entityTypes: ['institution'],
      order: 10,
      fields: [
        { name: 'Industry Sector', variableName: 'industry_sector', type: 'short_text', compatibilityScope: ['institution'] },
        { name: 'Employee Count', variableName: 'employee_count', type: 'number', compatibilityScope: ['institution'] },
        { name: 'System Capacity', variableName: 'capacity', type: 'number', compatibilityScope: ['institution'] },
      ]
    },
    {
      slug: 'marketing_attribution',
      name: 'Marketing Attribution',
      description: 'Source tracking and channel attribution',
      entityTypes: ['institution', 'person'],
      order: 20,
      fields: [
        { name: 'Acquisition Channel', variableName: 'channel', type: 'select', compatibilityScope: ['institution', 'person'], options: [{label: 'Organic', value: 'organic'}, {label: 'Paid Social', value: 'paid_social'}, {label: 'Paid Search', value: 'paid_search'}, {label: 'Referral', value: 'referral'}, {label: 'Direct', value: 'direct'}] },
        { name: 'UTM Source', variableName: 'utm_source', type: 'hidden', compatibilityScope: ['institution', 'person'] },
        { name: 'UTM Medium', variableName: 'utm_medium', type: 'hidden', compatibilityScope: ['institution', 'person'] },
        { name: 'UTM Campaign', variableName: 'utm_campaign', type: 'hidden', compatibilityScope: ['institution', 'person'] },
      ]
    }
  ],
  Law: [
    {
      slug: 'case_details',
      name: 'Case Details',
      description: 'Matter and procedural tracking',
      entityTypes: ['institution'],
      order: 10,
      fields: [
        { name: 'Matter Type', variableName: 'matter_type', type: 'select', compatibilityScope: ['institution'], options: [{label: 'Corporate', value: 'corporate'}, {label: 'Litigation', value: 'litigation'}, {label: 'Intellectual Property', value: 'ip'}, {label: 'Real Estate', value: 'real_estate'}] },
        { name: 'Date Opened', variableName: 'date_opened', type: 'date', compatibilityScope: ['institution'] },
        { name: 'Court Name', variableName: 'court_name', type: 'short_text', compatibilityScope: ['institution'] },
        { name: 'Judge/Magistrate', variableName: 'judge_name', type: 'short_text', compatibilityScope: ['institution'] },
        { name: 'Next Filing Deadline', variableName: 'filing_deadline', type: 'date', compatibilityScope: ['institution'] },
      ]
    },
    {
      slug: 'billing_retainer',
      name: 'Billing & Retainer',
      description: 'Financial agreements',
      entityTypes: ['institution', 'person'],
      order: 20,
      fields: [
        { name: 'Retainer Amount', variableName: 'retainer_amount', type: 'currency', compatibilityScope: ['institution', 'person'] },
        { name: 'Hourly Rate', variableName: 'hourly_rate', type: 'currency', compatibilityScope: ['institution', 'person'] },
        { name: 'Billing Frequency', variableName: 'billing_frequency', type: 'select', compatibilityScope: ['institution', 'person'], options: [{label: 'Monthly', value: 'monthly'}, {label: 'Milestone', value: 'milestone'}, {label: 'Upon Completion', value: 'upon_completion'}] },
      ]
    }
  ],
  Marketing: [
    {
      slug: 'campaign_details',
      name: 'Campaign Details',
      description: 'Core details of the marketing initiative',
      entityTypes: ['institution'],
      order: 10,
      fields: [
        { name: 'Target Audience', variableName: 'target_audience', type: 'short_text', compatibilityScope: ['institution'] },
        { name: 'Launch Date', variableName: 'launch_date', type: 'date', compatibilityScope: ['institution'] },
      ]
    },
    {
      slug: 'performance_metrics',
      name: 'Performance Metrics',
      description: 'Campaign KPIs and budgeting',
      entityTypes: ['institution'],
      order: 20,
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
      order: 30,
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
      slug: 'property_specs',
      name: 'Property Specifications',
      description: 'Asset characteristics',
      entityTypes: ['institution'], // Institution acts as Property
      order: 10,
      fields: [
        { name: 'Property Type', variableName: 'property_type', type: 'select', compatibilityScope: ['institution'], options: [{label: 'Residential', value: 'residential'}, {label: 'Commercial', value: 'commercial'}, {label: 'Industrial', value: 'industrial'}, {label: 'Land', value: 'land'}] },
        { name: 'Square Footage', variableName: 'square_footage', type: 'number', compatibilityScope: ['institution'] },
        { name: 'Year Built', variableName: 'year_built', type: 'number', compatibilityScope: ['institution'] },
      ]
    },
    {
      slug: 'listing_status',
      name: 'Listing Details',
      description: 'Market positioning and pricing',
      entityTypes: ['institution'],
      order: 20,
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
      order: 30,
      fields: [
        { name: 'Accepted Offer', variableName: 'accepted_offer', type: 'currency', compatibilityScope: ['institution'] },
        { name: 'Expected Closing Date', variableName: 'closing_date', type: 'date', compatibilityScope: ['institution', 'person'] },
        { name: 'Escrow Company', variableName: 'escrow_company', type: 'short_text', compatibilityScope: ['institution'] },
      ]
    }
  ],
  Consultancy: [
    {
      slug: 'project_details',
      name: 'Project Details',
      description: 'Project or engagement details',
      entityTypes: ['institution'], // Institution acts as Project/Engagement
      order: 10,
      fields: [
        { name: 'Start Date', variableName: 'start_date', type: 'date', compatibilityScope: ['institution'] },
        { name: 'Status', variableName: 'project_status', type: 'select', compatibilityScope: ['institution'], options: [{label: 'Scoping', value: 'scoping'}, {label: 'Active', value: 'active'}, {label: 'On Hold', value: 'on_hold'}, {label: 'Completed', value: 'completed'}] },
      ]
    },
    {
      slug: 'deliverables_scope',
      name: 'Deliverables & Scope',
      description: 'What is being delivered',
      entityTypes: ['institution'],
      order: 20,
      fields: [
        { name: 'Project Scope', variableName: 'project_scope', type: 'long_text', compatibilityScope: ['institution'] },
        { name: 'Key Deliverable', variableName: 'deliverable_1', type: 'short_text', compatibilityScope: ['institution'] },
        { name: 'Estimated Hours', variableName: 'estimated_hours', type: 'number', compatibilityScope: ['institution'] },
      ]
    },
    {
      slug: 'consulting_billing',
      name: 'Billing & Invoicing',
      description: 'Financial terms',
      entityTypes: ['institution', 'person'],
      order: 30,
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
  // ── General Identity ──────────────────────────────────────────────────────
  {
    slug: 'entity_details',
    name: 'General Identity',
    description: 'Core entity and contact identity fields',
    entityTypes: ['institution', 'person', 'family'],
    order: 1,
    fields: [
      { name: 'Entity Name', variableName: 'entity_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Name of the entity (school, company, person, or family)' },
      { name: 'Initials', variableName: 'initials', type: 'short_text', compatibilityScope: ['common'], helpText: 'Entity initials or short code' },
      { name: 'Vision / Slogan', variableName: 'slogan', type: 'short_text', compatibilityScope: ['common'], helpText: 'Entity vision statement or slogan' },
      { name: 'Organization Name', variableName: 'org_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Name of the organization' },
      { name: 'Workspace Name', variableName: 'workspace_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Name of the current workspace' },
      { name: 'User Name', variableName: 'user_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Name of the logged-in user sending the message' },
      { name: 'Referee', variableName: 'referee', type: 'short_text', compatibilityScope: ['common'], helpText: 'Referral source or referee name' },
    ]
  },

  // ── Location Data ─────────────────────────────────────────────────────────
  {
    slug: 'location_data',
    name: 'Location Data',
    description: 'Geographical and address details',
    entityTypes: ['institution', 'person', 'family'],
    order: 2,
    fields: [
      { name: 'Location String', variableName: 'location_string', type: 'short_text', compatibilityScope: ['common'], helpText: 'Physical location of the entity' },
      { name: 'Zone Name', variableName: 'zone_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Operational zone or area' },
      { name: 'Billing Address', variableName: 'billingAddress', type: 'address', compatibilityScope: ['common'], helpText: 'Primary billing address' },
    ]
  },

  // ── Billing Profile ───────────────────────────────────────────────────────
  {
    slug: 'billing_profile',
    name: 'Billing Profile',
    description: 'Billing rates, packages, and transaction balances',
    entityTypes: ['institution', 'person', 'family'],
    order: 3,
    fields: [
      { name: 'Subscription Package', variableName: 'subscriptionPackageId', type: 'select', compatibilityScope: ['common'], helpText: 'Active subscription tier or package key' },
      { name: 'Billing Currency', variableName: 'currency', type: 'select', compatibilityScope: ['common'], helpText: 'Default billing currency (e.g. GHS, USD)' },
      { name: 'Preferred Grant / Discount %', variableName: 'discountPercentage', type: 'number', compatibilityScope: ['common'], helpText: 'Applicable percentage discount' },
      { name: 'Expected Net Rate', variableName: 'subscriptionRate', type: 'currency', compatibilityScope: ['common'], helpText: 'Calculated expected rate' },
      { name: 'Capacity', variableName: 'capacity', type: 'number', compatibilityScope: ['common'], helpText: 'Seat or student capacity limit' },
      { name: 'Arrears Balance', variableName: 'arrearsBalance', type: 'currency', compatibilityScope: ['common'], helpText: 'Current outstanding arrears' },
      { name: 'Credit Balance', variableName: 'creditBalance', type: 'currency', compatibilityScope: ['common'], helpText: 'Current credit balance' },
    ]
  },

  // ── Account Ownership ─────────────────────────────────────────────────────
  {
    slug: 'account_ownership',
    name: 'Account Ownership',
    description: 'Primary owner and assigned sales representative',
    entityTypes: ['institution', 'person', 'family'],
    order: 4,
    fields: [
      { name: 'Assigned Representative', variableName: 'assigned_to', type: 'short_text', compatibilityScope: ['common'], helpText: 'Full name of the primary assignee or account manager' },
    ]
  },

  // ── Contacts ──────────────────────────────────────────────────────────────
  {
    slug: 'entity_contacts',
    name: 'Contacts',
    description: 'Primary contact, signatory, and recipient identifiers',
    entityTypes: ['institution', 'person', 'family'],
    order: 5,
    fields: [
      { name: 'Primary Contact Name', variableName: 'contact_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Full name of the primary contact' },
      { name: 'Primary Contact Email', variableName: 'contact_email', type: 'email', compatibilityScope: ['common'], helpText: 'Email of the primary contact' },
      { name: 'Primary Contact Phone', variableName: 'contact_phone', type: 'phone', compatibilityScope: ['common'], helpText: 'Phone number of the primary contact' },
      { name: 'Signatory Name', variableName: 'signatory_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Full name of the designated signatory' },
      { name: 'Signatory Email', variableName: 'signatory_email', type: 'email', compatibilityScope: ['common'], helpText: 'Email of the designated signatory' },
      { name: 'Signatory Phone', variableName: 'signatory_phone', type: 'phone', compatibilityScope: ['common'], helpText: 'Phone number of the designated signatory' },
      { name: 'Recipient Name', variableName: 'recipient_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Name of the specific message recipient' },
      { name: 'Recipient Email', variableName: 'recipient_email', type: 'email', compatibilityScope: ['common'], helpText: 'Email of the specific message recipient' },
      { name: 'Recipient Phone', variableName: 'recipient_phone', type: 'phone', compatibilityScope: ['common'], helpText: 'Phone of the specific message recipient' },
      { name: 'Recipient Role', variableName: 'recipient_role', type: 'short_text', compatibilityScope: ['common'], helpText: 'Role of the specific message recipient' },
      { name: 'Recipient First Name', variableName: 'recipient_first_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'First name of the specific recipient' },
    ]
  },

  // ── Interests ─────────────────────────────────────────────────────────────
  {
    slug: 'interests',
    name: 'Interests',
    description: 'Selected interests and program preferences',
    entityTypes: ['institution', 'person', 'family'],
    order: 6,
    fields: [
      { name: 'Interests / Modules', variableName: 'interests', type: 'multi_select', compatibilityScope: ['common'], helpText: 'Topics or modules the entity is interested in' },
    ]
  },

  // ── Current Situation ─────────────────────────────────────────────────────
  {
    slug: 'current_situation',
    name: 'Current Situation',
    description: 'Needs, challenges, and objectives details',
    entityTypes: ['institution', 'person', 'family'],
    order: 7,
    fields: [
      { name: 'Current Needs', variableName: 'currentNeeds', type: 'long_text', compatibilityScope: ['common'], helpText: 'Active requirements or needs' },
      { name: 'Current Challenges', variableName: 'currentChallenges', type: 'long_text', compatibilityScope: ['common'], helpText: 'Pain points or obstacles faced' },
    ]
  },

  // ── Online Presence ───────────────────────────────────────────────────────
  {
    slug: 'online_presence',
    name: 'Online Presence',
    description: 'Digital presence, websites, and social handles',
    entityTypes: ['institution', 'person', 'family'],
    order: 8,
    fields: [
      { name: 'Website', variableName: 'website', type: 'url', compatibilityScope: ['common'], helpText: 'Official website URL' },
      { name: 'Digital Address', variableName: 'digitalAddress', type: 'short_text', compatibilityScope: ['common'], helpText: 'National digital address code' },
      { name: 'Google Map Location', variableName: 'googleMapLocation', type: 'url', compatibilityScope: ['common'], helpText: 'Google Maps directions link' },
      { name: 'Google Business Profile', variableName: 'googleBusinessProfile', type: 'url', compatibilityScope: ['common'], helpText: 'Google Business profile page' },
      { name: 'Facebook', variableName: 'facebook', type: 'url', compatibilityScope: ['common'], helpText: 'Facebook page link' },
      { name: 'WhatsApp', variableName: 'whatsapp', type: 'phone', compatibilityScope: ['common'], helpText: 'WhatsApp contact link or number' },
      { name: 'Instagram', variableName: 'instagram', type: 'url', compatibilityScope: ['common'], helpText: 'Instagram handle link' },
      { name: 'LinkedIn', variableName: 'linkedin', type: 'url', compatibilityScope: ['common'], helpText: 'LinkedIn company or profile page' },
      { name: 'YouTube', variableName: 'youtube', type: 'url', compatibilityScope: ['common'], helpText: 'YouTube channel page' },
      { name: 'TikTok', variableName: 'tiktok', type: 'url', compatibilityScope: ['common'], helpText: 'TikTok profile link' },
    ]
  },

  // ── System & Date/Time ────────────────────────────────────────────────────
  {
    slug: 'system_datetime',
    name: 'System & Date/Time',
    description: 'Auto-computed date and time variables',
    entityTypes: ['institution', 'person', 'family'],
    order: 9,
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
      { name: 'Meeting Type', variableName: 'meeting_type', type: 'short_text', compatibilityScope: ['common'], helpText: 'Type/category of the meeting' },
      { name: 'Organizer Name', variableName: 'organizer_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Name of the meeting organizer' },
      { name: 'Attendee Names', variableName: 'attendee_names', type: 'short_text', compatibilityScope: ['common'], helpText: 'List of attendee names' },
      { name: 'Meeting Date', variableName: 'meeting_date', type: 'date', compatibilityScope: ['common'], helpText: 'Date of the meeting' },
      { name: 'Meeting Duration', variableName: 'meeting_duration', type: 'short_text', compatibilityScope: ['common'], helpText: 'Duration of the meeting' },
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
      { name: 'Days Remaining (Form)', variableName: 'form_days_remaining', type: 'number', compatibilityScope: ['common'], helpText: 'Number of days until submission deadline' },
      { name: 'Agreement URL', variableName: 'agreement_url', type: 'url', compatibilityScope: ['common'], helpText: 'Direct link to contract/agreement PDF' },
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
      { name: 'Days Remaining (Survey)', variableName: 'survey_days_remaining', type: 'number', compatibilityScope: ['common'], helpText: 'Number of days until survey deadline' },
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
      { name: 'Contract Status', variableName: 'contract_status', type: 'short_text', compatibilityScope: ['common'], helpText: 'Current status of the contract' },
      { name: 'Signing Date', variableName: 'signing_date', type: 'date', compatibilityScope: ['common'], helpText: 'Date the contract was signed' },
      { name: 'Days Remaining (Contract)', variableName: 'contract_days_remaining', type: 'number', compatibilityScope: ['common'], helpText: 'Number of days until signing deadline' },
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
      { name: 'Assigned To', variableName: 'assigned_to', type: 'short_text', compatibilityScope: ['common'], helpText: 'Name of user assigned to this entity' },
      { name: 'Assigner Name', variableName: 'assigner_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Name of user who made the assignment' },
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
      { name: 'First Name', variableName: 'first_name', type: 'short_text', compatibilityScope: ['person', 'common'], helpText: 'First name of the contact' },
      { name: 'Link', variableName: 'link', type: 'url', compatibilityScope: ['common'], helpText: 'Generic action link for the message' },
      { name: 'ID', variableName: 'id', type: 'short_text', compatibilityScope: ['common'], helpText: 'Entity identifier' },
    ]
  },
];

export const MARKETPLACE_FIELD_PACKS: IndustryGroupDef[] = [];
