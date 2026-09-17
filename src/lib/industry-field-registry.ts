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

export interface StaticVariableGroupInfo {
  groupId: string;
  groupName: string;
  groupSlug: string;
  groupOrder: number;
  groupIcon: string;
}

/**
 * ARCHITECTURAL HELPER (Rule 1 & Rule 10 SSOT):
 * Maps static variable keys and contexts to their canonical platform field group definitions
 * so they can be grouped, badged, and displayed cleanly across VariablesPanel, Fields Hub, and Services.
 */
export function resolveStaticVariableGroup(varName: string, varContext?: string): StaticVariableGroupInfo {
  const normCtx = (varContext || '').toLowerCase().replace(/s$/, '');
  if (normCtx === 'meeting') {
    return { groupId: 'meetings', groupName: 'Meetings & Webinars', groupSlug: 'meetings', groupOrder: 50, groupIcon: 'Calendar' };
  }
  if (normCtx === 'survey') {
    return { groupId: 'surveys', groupName: 'Surveys & Feedback', groupSlug: 'surveys', groupOrder: 52, groupIcon: 'ClipboardList' };
  }
  if (normCtx === 'form') {
    return { groupId: 'forms_pdfs', groupName: 'Forms & PDFs', groupSlug: 'forms_pdfs', groupOrder: 51, groupIcon: 'FileText' };
  }
  if (normCtx === 'agreement' || normCtx === 'finance') {
    return { groupId: 'agreements', groupName: 'Agreements & Contracts', groupSlug: 'agreements', groupOrder: 53, groupIcon: 'FileCheck' };
  }
  if (normCtx === 'task') {
    return { groupId: 'tasks', groupName: 'Tasks & Assignments', groupSlug: 'tasks', groupOrder: 60, groupIcon: 'CheckSquare' };
  }
  if (normCtx === 'automation') {
    return { groupId: 'automations', groupName: 'Automation & System', groupSlug: 'automations', groupOrder: 61, groupIcon: 'Zap' };
  }
  if (normCtx === 'qr_code' || normCtx === 'qrcode') {
    return { groupId: 'qr_codes', groupName: 'QR Code Details', groupSlug: 'qr_codes', groupOrder: 62, groupIcon: 'QrCode' };
  }
  if (normCtx === 'reminder') {
    return { groupId: 'reminders', groupName: 'Reminder Details', groupSlug: 'reminders', groupOrder: 63, groupIcon: 'Bell' };
  }
  if (normCtx === 'user' || normCtx === 'users') {
    return { groupId: 'users', groupName: 'User Account Details', groupSlug: 'users', groupOrder: 64, groupIcon: 'Shield' };
  }

  const k = varName.toLowerCase();
  if (k.startsWith('contact_') || k.startsWith('signatory_') || k === 'first_name') {
    return { groupId: 'entity_contacts', groupName: 'Contacts', groupSlug: 'entity_contacts', groupOrder: 5, groupIcon: 'Users' };
  }
  if (k.includes('location') || k.includes('zone') || k.includes('address') || k.includes('gps')) {
    return { groupId: 'location_data', groupName: 'Location Data', groupSlug: 'location_data', groupOrder: 2, groupIcon: 'MapPin' };
  }
  if (k.includes('subscription') || k.includes('currency') || k.includes('discount') || k.includes('balance') || k.includes('rate') || k.includes('capacity')) {
    return { groupId: 'billing_profile', groupName: 'Billing Profile', groupSlug: 'billing_profile', groupOrder: 3, groupIcon: 'CreditCard' };
  }
  if (k.includes('needs') || k.includes('challenge')) {
    return { groupId: 'current_situation', groupName: 'Current Situation', groupSlug: 'current_situation', groupOrder: 7, groupIcon: 'FileText' };
  }
  if (k.includes('website') || k.includes('facebook') || k.includes('whatsapp') || k.includes('instagram') || k.includes('linkedin') || k.includes('youtube') || k.includes('tiktok') || k.includes('map')) {
    return { groupId: 'online_presence', groupName: 'Online Presence', groupSlug: 'online_presence', groupOrder: 8, groupIcon: 'Globe' };
  }
  if (k.includes('stage') || k.includes('status')) {
    return { groupId: 'entity_lifecycle', groupName: 'Entity Lifecycle', groupSlug: 'entity_lifecycle', groupOrder: 54, groupIcon: 'Activity' };
  }
  if (k.includes('assigned_to') || k.includes('assigner_name')) {
    return { groupId: 'account_ownership', groupName: 'Account Ownership', groupSlug: 'account_ownership', groupOrder: 4, groupIcon: 'Briefcase' };
  }
  if (k.includes('date') || k.includes('time') || k.includes('year') || k.includes('token') || k.includes('tag_') || k.endsWith('_tag') || k === 'tag' || k.includes('tags')) {
    return { groupId: 'system_datetime', groupName: 'System & Date/Time', groupSlug: 'system_datetime', groupOrder: 9, groupIcon: 'Clock' };
  }

  return { groupId: 'entity_details', groupName: 'General Identity', groupSlug: 'entity_details', groupOrder: 1, groupIcon: 'Building' };
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
  defaultValue?: string | number | boolean | string[] | null;
  options?: { label: string; value: string }[];
  validationRules?: AppField['validationRules'];
}

export interface IndustryGroupDef {
  slug: string;
  name: string;
  description: string;
  entityTypes: EntityType[];
  order: number;
  icon?: string;
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
  // ── 1. Education & Schools ──────────────────────────────────────────────────
  SchoolEnrollment: [
    {
      slug: 'enrollment_metrics',
      name: 'Enrollment & Capacity',
      description: 'Key metrics, boarding model, and curriculum specifications',
      entityTypes: ['institution'],
      order: 10,
      icon: 'GraduationCap',
      fields: [
        { name: 'Nominal Roll', variableName: 'nominal_roll', type: 'number', compatibilityScope: ['institution'], helpText: 'Total active enrolled student population' },
        { name: 'Current Capacity', variableName: 'current_capacity', type: 'number', compatibilityScope: ['institution'], helpText: 'Maximum student capacity of the campus' },
        { 
          name: 'School Category', 
          variableName: 'school_category', 
          type: 'select', 
          compatibilityScope: ['institution'], 
          helpText: 'Boarding arrangement of the institution',
          options: [
            { label: 'Day Only', value: 'day_only' },
            { label: 'Boarding Only', value: 'boarding_only' },
            { label: 'Day & Boarding (Mixed)', value: 'mixed' }
          ]
        },
        { 
          name: 'Gender Policy', 
          variableName: 'gender_policy', 
          type: 'select', 
          compatibilityScope: ['institution'], 
          helpText: 'Student admission gender profile',
          options: [
            { label: 'Co-educational', value: 'co_ed' },
            { label: 'Boys Only', value: 'boys_only' },
            { label: 'Girls Only', value: 'girls_only' }
          ]
        },
        { 
          name: 'Curriculum Type', 
          variableName: 'curriculum_type', 
          type: 'select', 
          compatibilityScope: ['institution'], 
          helpText: 'Primary academic curriculum followed',
          options: [
            { label: 'National Curriculum', value: 'national' },
            { label: 'British / Cambridge', value: 'cambridge' },
            { label: 'International Baccalaureate (IB)', value: 'ib' },
            { label: 'American Curriculum', value: 'american' },
            { label: 'Blended / Hybrid', value: 'blended' }
          ]
        },
        { 
          name: 'Academic Calendar Type', 
          variableName: 'academic_calendar_type', 
          type: 'select', 
          compatibilityScope: ['institution'], 
          helpText: 'Term or semester structure of the academic year',
          options: [
            { label: 'Trimester (3 Terms)', value: 'trimester' },
            { label: 'Semester (2 Semesters)', value: 'semester' }
          ]
        },
        { 
          name: 'Educational Levels Served', 
          variableName: 'educational_levels', 
          type: 'multi_select', 
          compatibilityScope: ['institution'], 
          helpText: 'Grade and division stages operated by the campus',
          options: [
            { label: 'Creche & Daycare', value: 'creche' },
            { label: 'Nursery / Kindergarten', value: 'kindergarten' },
            { label: 'Primary School', value: 'primary' },
            { label: 'Junior High School (JHS)', value: 'jhs' },
            { label: 'Senior High School (SHS)', value: 'shs' },
            { label: 'Sixth Form / A-Levels', value: 'sixth_form' }
          ]
        },
      ]
    },
    {
      slug: 'institution_profile',
      name: 'Institutional Governance & Profile',
      description: 'Accreditations, examination councils, and leadership governance',
      entityTypes: ['institution'],
      order: 20,
      icon: 'Award',
      fields: [
        { 
          name: 'Affiliated Examination Bodies', 
          variableName: 'examination_bodies', 
          type: 'multi_select', 
          compatibilityScope: ['institution'], 
          helpText: 'Certified exam authorities and awarding councils',
          options: [
            { label: 'WAEC / BECE / WASSCE', value: 'waec' },
            { label: 'Cambridge Assessment (IGCSE / A-Level)', value: 'cambridge' },
            { label: 'IB World School', value: 'ib' },
            { label: 'SAT / ACT / AP', value: 'us_collegeboard' }
          ]
        },
        { name: 'PTA Chairperson Name', variableName: 'pta_chair_name', type: 'short_text', compatibilityScope: ['institution'], helpText: 'Full name of the Parent-Teacher Association Chairperson' },
        { name: 'Board Chairperson Name', variableName: 'board_chair_name', type: 'short_text', compatibilityScope: ['institution'], helpText: 'Full name of the Board of Governors / Advisory Chair' },
        { name: 'School Crest / Badge URL', variableName: 'school_crest_url', type: 'url', compatibilityScope: ['institution'], helpText: 'Direct secure link to high-resolution school crest' },
        { name: 'Transport / Bus Services Available', variableName: 'transport_services_available', type: 'yes_no', compatibilityScope: ['institution'], helpText: 'Whether school operates student bus transportation' },
        { name: 'Hostel / Boarding Capacity', variableName: 'hostel_capacity', type: 'number', compatibilityScope: ['institution'], helpText: 'Total student boarding beds available' },
      ]
    }
  ],

  // ── 2. Software & SaaS ──────────────────────────────────────────────────────
  SaaS: [
    {
      slug: 'saas_operations',
      name: 'SaaS Scale & Environment',
      description: 'Customer scale, sector parameters, and infrastructure deployment',
      entityTypes: ['institution'],
      order: 10,
      icon: 'Cpu',
      fields: [
        { name: 'Industry Sector', variableName: 'industry_sector', type: 'short_text', compatibilityScope: ['institution'], helpText: 'Customer sector (e.g. FinTech, HealthTech, EdTech)' },
        { name: 'Employee Count', variableName: 'employee_count', type: 'number', compatibilityScope: ['institution'], helpText: 'Total organization headcount' },
        { name: 'User Seat Capacity', variableName: 'seat_capacity', type: 'number', compatibilityScope: ['institution'], helpText: 'Licensed active seat count or provisioned logins' },
        { 
          name: 'Deployment Model', 
          variableName: 'deployment_type', 
          type: 'select', 
          compatibilityScope: ['institution'], 
          helpText: 'Hosting infrastructure environment',
          options: [
            { label: 'Multi-Tenant Cloud', value: 'cloud_multitenant' },
            { label: 'Dedicated Cloud', value: 'cloud_dedicated' },
            { label: 'On-Premises / Hybrid', value: 'on_premises' }
          ]
        },
      ]
    },
    {
      slug: 'subscription_contract',
      name: 'Subscription & Contract Lifecycle',
      description: 'Commercial terms, renewal gates, and ARR/MRR tracking',
      entityTypes: ['institution'],
      order: 15,
      icon: 'HandCoins',
      fields: [
        { 
          name: 'Software Plan Tier', 
          variableName: 'saas_plan_tier', 
          type: 'select', 
          compatibilityScope: ['institution'], 
          helpText: 'Active software product tier',
          options: [
            { label: 'Starter', value: 'starter' },
            { label: 'Growth / Team', value: 'growth' },
            { label: 'Professional', value: 'pro' },
            { label: 'Enterprise', value: 'enterprise' },
            { label: 'Custom', value: 'custom' }
          ]
        },
        { 
          name: 'Pricing Model', 
          variableName: 'pricing_model', 
          type: 'select', 
          compatibilityScope: ['institution'], 
          helpText: 'Revenue model applied to subscription',
          options: [
            { label: 'Per-User / Seat', value: 'per_seat' },
            { label: 'Usage-Based / Metered', value: 'usage_based' },
            { label: 'Flat Rate', value: 'flat_rate' },
            { label: 'Tiered Package', value: 'tiered' }
          ]
        },
        { 
          name: 'Contract Term', 
          variableName: 'contract_term', 
          type: 'select', 
          compatibilityScope: ['institution'], 
          helpText: 'Contract commitment interval',
          options: [
            { label: 'Monthly', value: 'monthly' },
            { label: 'Quarterly', value: 'quarterly' },
            { label: 'Annual (12 Months)', value: 'annual' },
            { label: 'Multi-Year (24+ Months)', value: 'multi_year' }
          ]
        },
        { name: 'Target MRR', variableName: 'target_mrr', type: 'currency', compatibilityScope: ['institution'], helpText: 'Monthly Recurring Revenue value' },
        { name: 'Target ARR', variableName: 'target_arr', type: 'currency', compatibilityScope: ['institution'], helpText: 'Annual Recurring Revenue value' },
        { name: 'Contract Renewal Date', variableName: 'renewal_date', type: 'date', compatibilityScope: ['institution'], helpText: 'Next contract expiry or renewal gate' },
        { name: 'Technical Lead Name', variableName: 'technical_lead_name', type: 'short_text', compatibilityScope: ['institution'], helpText: 'Name of client CTO or lead administrator' },
      ]
    },
    {
      slug: 'marketing_attribution',
      name: 'Marketing Attribution',
      description: 'Acquisition channels and digital campaign tracking',
      entityTypes: ['institution', 'person'],
      order: 20,
      icon: 'BarChart3',
      fields: [
        { 
          name: 'Acquisition Channel', 
          variableName: 'channel', 
          type: 'select', 
          compatibilityScope: ['institution', 'person'], 
          helpText: 'Primary pipeline source',
          options: [
            { label: 'Organic Search', value: 'organic' },
            { label: 'Paid Search (SEM)', value: 'paid_search' },
            { label: 'Paid Social', value: 'paid_social' },
            { label: 'Outbound Sales', value: 'outbound' },
            { label: 'Referral', value: 'referral' },
            { label: 'Partner Network', value: 'partner' },
            { label: 'Event / Conference', value: 'event' }
          ]
        },
        { name: 'UTM Source', variableName: 'utm_source', type: 'hidden', compatibilityScope: ['institution', 'person'] },
        { name: 'UTM Medium', variableName: 'utm_medium', type: 'hidden', compatibilityScope: ['institution', 'person'] },
        { name: 'UTM Campaign', variableName: 'utm_campaign', type: 'hidden', compatibilityScope: ['institution', 'person'] },
      ]
    }
  ],

  // ── 3. Legal & Law Firms ──────────────────────────────────────────────────
  Law: [
    {
      slug: 'case_details',
      name: 'Case & Matter Details',
      description: 'Docket management, opposing counsel, and procedural milestones',
      entityTypes: ['institution'],
      order: 10,
      icon: 'Briefcase',
      fields: [
        { 
          name: 'Matter Type', 
          variableName: 'matter_type', 
          type: 'select', 
          compatibilityScope: ['institution'], 
          helpText: 'Practice area or legal specialization',
          options: [
            { label: 'Corporate & Commercial', value: 'corporate' },
            { label: 'Civil Litigation', value: 'litigation' },
            { label: 'Criminal Defense', value: 'criminal' },
            { label: 'Intellectual Property', value: 'ip' },
            { label: 'Real Estate & Conveyancing', value: 'real_estate' },
            { label: 'Family & Probate', value: 'family' },
            { label: 'Labor & Employment', value: 'labor' }
          ]
        },
        { name: 'Case / Suit Number', variableName: 'case_number', type: 'short_text', compatibilityScope: ['institution'], helpText: 'Official court docket index or suit number' },
        { name: 'Date Opened', variableName: 'date_opened', type: 'date', compatibilityScope: ['institution'], helpText: 'Date matter file was formally opened' },
        { name: 'Court Name', variableName: 'court_name', type: 'short_text', compatibilityScope: ['institution'], helpText: 'Presiding court, bench, or tribunal' },
        { 
          name: 'Court Jurisdiction', 
          variableName: 'jurisdiction', 
          type: 'select', 
          compatibilityScope: ['institution'], 
          helpText: 'Hierarchy level of presiding judicial venue',
          options: [
            { label: 'Supreme Court', value: 'supreme_court' },
            { label: 'Court of Appeal', value: 'appeal_court' },
            { label: 'High Court', value: 'high_court' },
            { label: 'Circuit Court', value: 'circuit_court' },
            { label: 'District / Magistrate Court', value: 'district_court' },
            { label: 'Arbitration Tribunal', value: 'arbitration' }
          ]
        },
        { name: 'Presiding Judge / Magistrate', variableName: 'judge_name', type: 'short_text', compatibilityScope: ['institution'], helpText: 'Name of the sitting justice, judge, or arbitrator' },
        { name: 'Opposing Party Name', variableName: 'opposing_party', type: 'short_text', compatibilityScope: ['institution'], helpText: 'Adverse defendant, plaintiff, or respondent' },
        { name: 'Opposing Counsel / Firm', variableName: 'opposing_counsel', type: 'short_text', compatibilityScope: ['institution'], helpText: 'Legal representatives for opposing party' },
        { 
          name: 'Case Procedural Stage', 
          variableName: 'case_status_stage', 
          type: 'select', 
          compatibilityScope: ['institution'], 
          helpText: 'Current procedural stage of the suit',
          options: [
            { label: 'Consultation & Scoping', value: 'scoping' },
            { label: 'Pleadings & Filings', value: 'pleadings' },
            { label: 'Discovery & Interlocutory', value: 'discovery' },
            { label: 'Trial / Substantive Hearing', value: 'trial' },
            { label: 'Awaiting Judgment / Award', value: 'judgment' },
            { label: 'Appeal Pending', value: 'appeal' },
            { label: 'Settled / Concluded', value: 'closed' }
          ]
        },
        { name: 'Next Statutory Filing Deadline', variableName: 'filing_deadline', type: 'date', compatibilityScope: ['institution'], helpText: 'Hard statutory court filing deadline' },
      ]
    },
    {
      slug: 'billing_retainer',
      name: 'Legal Billing & Retainer',
      description: 'Fee agreements, billing schedules, and counsel assignment',
      entityTypes: ['institution', 'person'],
      order: 20,
      icon: 'Scale',
      fields: [
        { name: 'Retainer Deposit Amount', variableName: 'retainer_amount', type: 'currency', compatibilityScope: ['institution', 'person'], helpText: 'Agreed upfront retainer fee' },
        { name: 'Hourly Billing Rate', variableName: 'hourly_rate', type: 'currency', compatibilityScope: ['institution', 'person'], helpText: 'Lead counsel billable hourly rate' },
        { 
          name: 'Billing Frequency', 
          variableName: 'billing_frequency', 
          type: 'select', 
          compatibilityScope: ['institution', 'person'], 
          helpText: 'Invoicing terms schedule',
          options: [
            { label: 'Monthly In Arrears', value: 'monthly' },
            { label: 'Milestone-Based', value: 'milestone' },
            { label: 'Fixed Retainer', value: 'retainer' },
            { label: 'Contingency Fee', value: 'contingency' },
            { label: 'Upon Final Judgment', value: 'upon_completion' }
          ]
        },
        { name: 'Lead Handling Attorney', variableName: 'lead_attorney', type: 'short_text', compatibilityScope: ['institution', 'person'], helpText: 'Partner or associate managing the matter' },
      ]
    }
  ],

  // ── 4. Marketing Agency ─────────────────────────────────────────────────────
  Marketing: [
    {
      slug: 'campaign_details',
      name: 'Campaign Scope & Strategy',
      description: 'Targeting demographics, channel mix, and creative repository',
      entityTypes: ['institution'],
      order: 10,
      icon: 'Megaphone',
      fields: [
        { 
          name: 'Campaign Objective', 
          variableName: 'campaign_objective', 
          type: 'select', 
          compatibilityScope: ['institution'], 
          helpText: 'Primary KPI goal of campaign',
          options: [
            { label: 'Brand Awareness', value: 'awareness' },
            { label: 'Lead Generation', value: 'lead_gen' },
            { label: 'E-Commerce Conversions', value: 'conversions' },
            { label: 'Product Launch', value: 'launch' },
            { label: 'Event Promotion', value: 'event' },
            { label: 'App Installs', value: 'installs' }
          ]
        },
        { name: 'Target Audience Profile', variableName: 'target_audience', type: 'short_text', compatibilityScope: ['institution'], helpText: 'Audience persona and geographic targeting focus' },
        { 
          name: 'Primary Advertising Channel', 
          variableName: 'primary_ad_channel', 
          type: 'select', 
          compatibilityScope: ['institution'], 
          helpText: 'Primary paid media deployment platform',
          options: [
            { label: 'Meta (Facebook & Instagram)', value: 'meta' },
            { label: 'Google Search & YouTube', value: 'google' },
            { label: 'LinkedIn Ads', value: 'linkedin' },
            { label: 'TikTok Ads', value: 'tiktok' },
            { label: 'Influencer & Creator Network', value: 'influencer' },
            { label: 'Programmatic Display', value: 'programmatic' },
            { label: 'Email Marketing Blast', value: 'email' }
          ]
        },
        { name: 'Campaign Launch Date', variableName: 'launch_date', type: 'date', compatibilityScope: ['institution'], helpText: 'Scheduled date of media flight launch' },
        { name: 'Campaign Conclusion Date', variableName: 'campaign_end_date', type: 'date', compatibilityScope: ['institution'], helpText: 'Scheduled date of campaign flight conclusion' },
        { name: 'Creative Assets Folder Link', variableName: 'creative_asset_folder_url', type: 'url', compatibilityScope: ['institution'], helpText: 'Shared Drive or Figma repository link' },
      ]
    },
    {
      slug: 'performance_metrics',
      name: 'Performance Metrics & Budgeting',
      description: 'Budget pacing, ROAS multipliers, and CPA efficiency',
      entityTypes: ['institution'],
      order: 20,
      icon: 'LineChart',
      fields: [
        { name: 'Total Campaign Media Budget', variableName: 'total_budget', type: 'currency', compatibilityScope: ['institution'], helpText: 'Total allocated advertising budget' },
        { name: 'Current Spend to Date', variableName: 'current_spend', type: 'currency', compatibilityScope: ['institution'], helpText: 'Total budget consumed to date' },
        { name: 'Target CPA', variableName: 'target_cpa', type: 'currency', compatibilityScope: ['institution'], helpText: 'Maximum target cost per acquired lead' },
        { name: 'Target ROAS Multiplier', variableName: 'target_roas', type: 'number', compatibilityScope: ['institution'], helpText: 'Target Return On Ad Spend multiplier (e.g. 4.5)' },
        { name: 'Total Leads Captured', variableName: 'leads_generated', type: 'number', compatibilityScope: ['institution'], helpText: 'Total verified leads captured' },
        { name: 'Confirmed Sales Conversions', variableName: 'conversions_count', type: 'number', compatibilityScope: ['institution'], helpText: 'Total completed sales or customer acquisitions' },
      ]
    },
    {
      slug: 'marketing_attribution',
      name: 'Attribution & Tracking',
      description: 'UTM parameters and domain source identifiers',
      entityTypes: ['person', 'institution'],
      order: 30,
      icon: 'BarChart3',
      fields: [
        { name: 'UTM Source', variableName: 'utm_source', type: 'hidden', compatibilityScope: ['person', 'institution'] },
        { name: 'UTM Medium', variableName: 'utm_medium', type: 'hidden', compatibilityScope: ['person', 'institution'] },
        { name: 'UTM Campaign', variableName: 'utm_campaign', type: 'hidden', compatibilityScope: ['person', 'institution'] },
        { name: 'Referrer Domain URL', variableName: 'referrer_url', type: 'hidden', compatibilityScope: ['person', 'institution'] },
      ]
    }
  ],

  // ── 5. Real Estate ────────────────────────────────────────────────────────
  RealEstate: [
    {
      slug: 'property_specs',
      name: 'Property Specifications',
      description: 'Physical dimensions, zoning, and architectural characteristics',
      entityTypes: ['institution'], // Institution acts as Property
      order: 10,
      icon: 'Home',
      fields: [
        { 
          name: 'Property Classification', 
          variableName: 'property_type', 
          type: 'select', 
          compatibilityScope: ['institution'], 
          helpText: 'Real estate asset class',
          options: [
            { label: 'Single-Family Residential', value: 'residential' },
            { label: 'Multi-Family / Apartment', value: 'multi_family' },
            { label: 'Commercial Office', value: 'commercial' },
            { label: 'Retail Storefront', value: 'retail' },
            { label: 'Industrial / Warehouse', value: 'industrial' },
            { label: 'Land / Plot / Acreage', value: 'land' }
          ]
        },
        { name: 'Bedroom Count', variableName: 'bedrooms', type: 'number', compatibilityScope: ['institution'], helpText: 'Total number of private bedrooms' },
        { name: 'Bathroom Count', variableName: 'bathrooms', type: 'number', compatibilityScope: ['institution'], helpText: 'Total number of full and half bathrooms' },
        { name: 'Usable Square Footage', variableName: 'square_footage', type: 'number', compatibilityScope: ['institution'], helpText: 'Gross usable interior square footage / meters' },
        { name: 'Lot Dimensions / Acreage', variableName: 'lot_size', type: 'short_text', compatibilityScope: ['institution'], helpText: 'Total parcel or plot dimensions' },
        { name: 'Year Built', variableName: 'year_built', type: 'number', compatibilityScope: ['institution'], helpText: 'Year construction was completed' },
        { name: 'Property Physical Address', variableName: 'property_address', type: 'short_text', compatibilityScope: ['institution'], helpText: 'Physical street address of listing' },
        { name: 'Tax Parcel ID Number', variableName: 'parcel_number', type: 'short_text', compatibilityScope: ['institution'], helpText: 'Official municipal land registry identification' },
      ]
    },
    {
      slug: 'listing_status',
      name: 'Listing Details & Pricing',
      description: 'Market positioning, MLS registry, and walkthrough media',
      entityTypes: ['institution'],
      order: 20,
      icon: 'MapPin',
      fields: [
        { name: 'Listing Asking Price', variableName: 'listing_price', type: 'currency', compatibilityScope: ['institution', 'common'], helpText: 'Official public asking price' },
        { name: 'MLS Registration Number', variableName: 'mls_number', type: 'short_text', compatibilityScope: ['institution'], helpText: 'Multiple Listing Service identification number' },
        { name: 'Date Listed on Market', variableName: 'listing_date', type: 'date', compatibilityScope: ['institution'], helpText: 'Official date property was placed on market' },
        { 
          name: 'Listing Status', 
          variableName: 'listing_status', 
          type: 'select', 
          compatibilityScope: ['institution'], 
          helpText: 'Current market transaction state',
          options: [
            { label: 'Active / Available', value: 'active' },
            { label: 'Under Offer / In Negotiations', value: 'under_offer' },
            { label: 'Pending Escrow', value: 'pending' },
            { label: 'Sold / Closed', value: 'sold' },
            { label: 'Off Market', value: 'off_market' }
          ]
        },
        { name: '3D Virtual Tour URL', variableName: 'virtual_tour_url', type: 'url', compatibilityScope: ['institution'], helpText: 'Matterport or 3D video walkthrough link' },
        { name: 'HOA / Maintenance Monthly Fee', variableName: 'hoa_fee', type: 'currency', compatibilityScope: ['institution'], helpText: 'Homeowners association or estate dues' },
      ]
    },
    {
      slug: 'transaction_closing',
      name: 'Transaction & Closing',
      description: 'Ratified offers, title agency, and commission splits',
      entityTypes: ['institution', 'person'],
      order: 30,
      icon: 'ArrowLeftRight',
      fields: [
        { name: 'Accepted Offer Price', variableName: 'accepted_offer', type: 'currency', compatibilityScope: ['institution'], helpText: 'Final ratified contract sales price' },
        { name: 'Expected Closing Date', variableName: 'closing_date', type: 'date', compatibilityScope: ['institution', 'person'], helpText: 'Scheduled deed transfer or handover date' },
        { name: 'Escrow / Title Company', variableName: 'escrow_company', type: 'short_text', compatibilityScope: ['institution'], helpText: 'Designated settlement or escrow company' },
        { name: 'Agreed Commission Rate %', variableName: 'commission_rate', type: 'number', compatibilityScope: ['institution'], helpText: 'Total agreed agency commission percentage' },
      ]
    }
  ],

  // ── 6. Consultancy ──────────────────────────────────────────────────────────
  Consultancy: [
    {
      slug: 'project_details',
      name: 'Engagement Governance & Details',
      description: 'Client leadership, delivery model, and timeline tracking',
      entityTypes: ['institution'], // Institution acts as Project/Engagement
      order: 10,
      icon: 'Briefcase',
      fields: [
        { name: 'Client Executive Sponsor', variableName: 'client_sponsor', type: 'short_text', compatibilityScope: ['institution'], helpText: 'Senior client stakeholder or decision-maker' },
        { name: 'Statement of Work Reference', variableName: 'sow_reference', type: 'short_text', compatibilityScope: ['institution'], helpText: 'Contractual SOW or engagement identifier' },
        { 
          name: 'Engagement Delivery Model', 
          variableName: 'engagement_model', 
          type: 'select', 
          compatibilityScope: ['institution'], 
          helpText: 'Consulting execution structure',
          options: [
            { label: 'Strategic Advisory', value: 'advisory' },
            { label: 'Staff Augmentation', value: 'augmentation' },
            { label: 'Turnkey / Fixed Scope', value: 'turnkey' },
            { label: 'Retainer / Ongoing Support', value: 'retainer' }
          ]
        },
        { 
          name: 'Project Lifecycle Status', 
          variableName: 'project_status', 
          type: 'select', 
          compatibilityScope: ['institution'], 
          helpText: 'Current delivery progress status',
          options: [
            { label: 'Scoping & Proposal', value: 'scoping' },
            { label: 'Active / In Progress', value: 'active' },
            { label: 'Client Review & Sign-off', value: 'review' },
            { label: 'Completed', value: 'completed' },
            { label: 'On Hold', value: 'on_hold' }
          ]
        },
        { name: 'Official Kickoff Date', variableName: 'start_date', type: 'date', compatibilityScope: ['institution'], helpText: 'Engagement project start date' },
        { name: 'Projected Completion Date', variableName: 'target_completion_date', type: 'date', compatibilityScope: ['institution'], helpText: 'Target final milestone handover date' },
      ]
    },
    {
      slug: 'deliverables_scope',
      name: 'Scope & Deliverables',
      description: 'Core objectives, work products, and estimated effort',
      entityTypes: ['institution'],
      order: 20,
      icon: 'PackageCheck',
      fields: [
        { name: 'Project Scope Summary', variableName: 'project_scope', type: 'long_text', compatibilityScope: ['institution'], helpText: 'Executive summary of agreed engagement scope' },
        { name: 'Primary Key Deliverable', variableName: 'deliverable_1', type: 'short_text', compatibilityScope: ['institution'], helpText: 'Core flagship work product description' },
        { name: 'Contractual Milestones Count', variableName: 'milestone_count', type: 'number', compatibilityScope: ['institution'], helpText: 'Total number of gated delivery milestones' },
        { name: 'Total Estimated Consulting Hours', variableName: 'estimated_hours', type: 'number', compatibilityScope: ['institution'], helpText: 'Total estimated professional effort in hours' },
      ]
    },
    {
      slug: 'consulting_billing',
      name: 'Billing & Financial Terms',
      description: 'Fee structures, day rates, and expense reimbursement',
      entityTypes: ['institution', 'person'],
      order: 30,
      icon: 'Handshake',
      fields: [
        { 
          name: 'Billing Arrangement', 
          variableName: 'billing_type', 
          type: 'select', 
          compatibilityScope: ['institution'], 
          helpText: 'Commercial fee arrangement',
          options: [
            { label: 'Fixed Fee Project', value: 'fixed_fee' },
            { label: 'Time & Materials', value: 'time_materials' },
            { label: 'Monthly Retainer', value: 'retainer' },
            { label: 'Value / Success Fee', value: 'success_fee' }
          ]
        },
        { name: 'Total Contracted Fee', variableName: 'total_fee', type: 'currency', compatibilityScope: ['institution'], helpText: 'Total contracted engagement budget' },
        { name: 'Standard Consultant Day Rate', variableName: 'day_rate', type: 'currency', compatibilityScope: ['institution', 'person'], helpText: 'Billable consultant rate per day' },
        { name: 'Invoicing Schedule Terms', variableName: 'invoicing_schedule', type: 'short_text', compatibilityScope: ['institution'], helpText: 'Payment schedule (e.g. 50% upfront, 50% upon sign-off)' },
        { 
          name: 'Reimbursable Expense Terms', 
          variableName: 'expense_policy', 
          type: 'select', 
          compatibilityScope: ['institution'], 
          helpText: 'Travel and incidental expense terms',
          options: [
            { label: 'All-Inclusive (No Expenses)', value: 'all_inclusive' },
            { label: 'Billable at Actual Cost', value: 'billable_actual' },
            { label: 'Capped Budget', value: 'capped' }
          ]
        },
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
      { name: 'Organization Name', variableName: 'organization_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Name of the organization' },
      { name: 'Workspace Name', variableName: 'workspace_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Name of the current workspace' },
      { name: 'Sender Name', variableName: 'sender_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Name of the logged-in user or agent sending the message' },
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
      { name: 'Billing Address', variableName: 'billing_address', type: 'address', compatibilityScope: ['common'], helpText: 'Primary billing address' },
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
      { name: 'Subscription Package', variableName: 'subscription_package_id', type: 'select', compatibilityScope: ['common'], helpText: 'Active subscription tier or package key' },
      { name: 'Billing Currency', variableName: 'currency', type: 'select', compatibilityScope: ['common'], helpText: 'Default billing currency (e.g. GHS, USD)' },
      { name: 'Preferred Grant / Discount %', variableName: 'discount_percentage', type: 'number', compatibilityScope: ['common'], helpText: 'Applicable percentage discount' },
      { name: 'Expected Net Rate', variableName: 'subscription_rate', type: 'currency', compatibilityScope: ['common'], helpText: 'Calculated expected rate' },
      { name: 'Capacity', variableName: 'capacity', type: 'number', compatibilityScope: ['common'], helpText: 'Seat or student capacity limit' },
      { name: 'Arrears Balance', variableName: 'arrears_balance', type: 'currency', compatibilityScope: ['common'], helpText: 'Current outstanding arrears' },
      { name: 'Credit Balance', variableName: 'credit_balance', type: 'currency', compatibilityScope: ['common'], helpText: 'Current credit balance' },
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
      { name: 'Assigner Name', variableName: 'assigner_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Full name of the team lead or manager assigning the record' },
    ]
  },

  // ── Contacts ──────────────────────────────────────────────────────────────
  // Canonical contact fields only. Deprecated recipient_* variables are eliminated.
  {
    slug: 'entity_contacts',
    name: 'Contacts',
    description: 'Primary contact and signatory identifiers',
    entityTypes: ['institution', 'person', 'family'],
    order: 5,
    fields: [
      { name: 'Primary Contact Name', variableName: 'contact_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Full name of the primary contact' },
      { name: 'Primary Contact Email', variableName: 'contact_email', type: 'email', compatibilityScope: ['common'], helpText: 'Email of the primary contact' },
      { name: 'Primary Contact Phone', variableName: 'contact_phone', type: 'phone', compatibilityScope: ['common'], helpText: 'Phone number of the primary contact' },
      { name: 'Primary Contact Role', variableName: 'contact_role', type: 'short_text', compatibilityScope: ['common'], helpText: 'Role or title of the primary contact' },
      { name: 'Contact First Name', variableName: 'first_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'First name of the primary contact' },
      { name: 'Signatory Name', variableName: 'signatory_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Full name of the designated signatory' },
      { name: 'Signatory Email', variableName: 'signatory_email', type: 'email', compatibilityScope: ['common'], helpText: 'Email of the designated signatory' },
      { name: 'Signatory Phone', variableName: 'signatory_phone', type: 'phone', compatibilityScope: ['common'], helpText: 'Phone number of the designated signatory' },
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
      { name: 'Current Needs', variableName: 'current_needs', type: 'long_text', compatibilityScope: ['common'], helpText: 'Active requirements or needs' },
      { name: 'Current Challenges', variableName: 'current_challenges', type: 'long_text', compatibilityScope: ['common'], helpText: 'Pain points or obstacles faced' },
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
      { name: 'Digital Address', variableName: 'digital_address', type: 'short_text', compatibilityScope: ['common'], helpText: 'National digital address code' },
      { name: 'Google Map Location', variableName: 'google_map_location', type: 'url', compatibilityScope: ['common'], helpText: 'Google Maps directions link' },
      { name: 'Google Business Profile', variableName: 'google_business_profile', type: 'url', compatibilityScope: ['common'], helpText: 'Google Business profile page' },
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
      { name: 'Agreement Name', variableName: 'agreement_name', type: 'short_text', compatibilityScope: ['common'], helpText: 'Name of the agreement or contract' },
      { name: 'Agreement URL', variableName: 'agreement_url', type: 'url', compatibilityScope: ['common'], helpText: 'URL to view or sign the agreement' },
      { name: 'Signing Deadline', variableName: 'signing_deadline', type: 'date', compatibilityScope: ['common'], helpText: 'Deadline for signing the contract' },
      { name: 'Agreement Status', variableName: 'agreement_status', type: 'short_text', compatibilityScope: ['common'], helpText: 'Current status of the agreement' },
      { name: 'Signing Date', variableName: 'signing_date', type: 'date', compatibilityScope: ['common'], helpText: 'Date the contract was signed' },
      { name: 'Days Remaining (Agreement)', variableName: 'agreement_days_remaining', type: 'number', compatibilityScope: ['common'], helpText: 'Number of days until signing deadline' },
    ]
  },

  // ── Entity Lifecycle ──────────────────────────────────────────────────────
  {
    slug: 'entity_lifecycle',
    name: 'Entity Lifecycle',
    description: 'Pipeline stage changes and status transitions',
    entityTypes: ['institution', 'person', 'family'],
    order: 54,
    fields: [
      { name: 'Old Stage', variableName: 'old_stage', type: 'short_text', compatibilityScope: ['common'], helpText: 'Previous pipeline stage of the entity' },
      { name: 'New Stage', variableName: 'new_stage', type: 'short_text', compatibilityScope: ['common'], helpText: 'New pipeline stage of the entity' },
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
      { name: 'Action Link', variableName: 'action_link', type: 'url', compatibilityScope: ['common'], helpText: 'Primary call-to-action link for the message' },
      { name: 'ID', variableName: 'id', type: 'short_text', compatibilityScope: ['common'], helpText: 'Entity identifier' },
    ]
  },
];

export const MARKETPLACE_FIELD_PACKS: IndustryGroupDef[] = [];
