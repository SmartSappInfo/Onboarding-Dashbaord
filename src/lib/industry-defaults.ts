import type { IndustryVertical, WorkspaceStatus, EntityType } from '@/lib/types';

export const UNIVERSAL_FALLBACK_STATUSES: WorkspaceStatus[] = [
    { value: 'Open', label: 'Open', color: '#3B5FFF', description: 'Active lead, inquiry or client case' },
    { value: 'Won', label: 'Won', color: '#10b981', description: 'Successfully converted, retained or closed won' },
    { value: 'Lost', label: 'Lost', color: '#ef4444', description: 'Lost deal, churned or closed lost' }
];

export const INDUSTRY_STATUS_DEFAULTS: Record<IndustryVertical, WorkspaceStatus[]> = {
    SaaS: [
        { value: 'Onboarding', label: 'Onboarding', color: '#3B5FFF', description: 'New signup setting up their account' },
        { value: 'Active', label: 'Active', color: '#10b981', description: 'Fully active paying subscriber' },
        { value: 'Churned', label: 'Churned', color: '#ef4444', description: 'Subscription cancelled or lost client' }
    ],
    Marketing: [
        { value: 'Lead', label: 'Lead', color: '#4cc9f0', description: 'Incoming lead or inquiry' },
        { value: 'Proposal', label: 'Proposal', color: '#ffba08', description: 'Pitch deck or retainer quote sent' },
        { value: 'Retained', label: 'Retained', color: '#10b981', description: 'Active retainer contract running' },
        { value: 'Lost', label: 'Lost', color: '#ef4444', description: 'Closed/lost deal' }
    ],
    SchoolEnrollment: [
        { value: 'Inquiry', label: 'Inquiry', color: '#4895ef', description: 'Student/family showing interest' },
        { value: 'Applied', label: 'Applied', color: '#ffba08', description: 'Admissions application submitted' },
        { value: 'Admitted', label: 'Admitted', color: '#b5179e', description: 'Offer of admission extended' },
        { value: 'Enrolled', label: 'Enrolled', color: '#10b981', description: 'Student fully enrolled in classes' },
        { value: 'Withdrawn', label: 'Withdrawn', color: '#ef4444', description: 'Application withdrawn or student left' }
    ],
    Consultancy: [
        { value: 'Prospect', label: 'Prospect', color: '#4361ee', description: 'Client under discussion' },
        { value: 'Discovery', label: 'Discovery', color: '#ffba08', description: 'Statement of Work / SOW scope draft' },
        { value: 'Active Engagement', label: 'Active Engagement', color: '#10b981', description: 'Project delivery in progress' },
        { value: 'Completed', label: 'Completed', color: '#64748b', description: 'Project signed off and closed' }
    ],
    RealEstate: [
        { value: 'Prospect', label: 'Prospect', color: '#4cc9f0', description: 'Potential buyer or seller lead' },
        { value: 'Viewing', label: 'Viewing', color: '#ffba08', description: 'Property listings viewing in progress' },
        { value: 'Offer', label: 'Offer', color: '#b5179e', description: 'Purchase contract or offer submitted' },
        { value: 'Closed', label: 'Closed', color: '#10b981', description: 'Deal closed and keys handed over' }
    ],
    Law: [
        { value: 'Intake', label: 'Intake', color: '#7209b7', description: 'Initial consultation and case intake' },
        { value: 'Conflict Check', label: 'Conflict Check', color: '#4361ee', description: 'Performing conflict checking clearances' },
        { value: 'Retained', label: 'Retained', color: '#10b981', description: 'Retainer fee paid and case active' },
        { value: 'Closed', label: 'Closed', color: '#64748b', description: 'Settlement achieved or case resolved' }
    ]
};

/**
 * Resolve workspace status defaults based on selected industry vertical,
 * with database defaults overlay, static defaults fallback, and final universal fallback.
 */
export function getWorkspaceStatusDefaults(
    industry: IndustryVertical, 
    dbDefaults?: Record<string, WorkspaceStatus[]> | null
): WorkspaceStatus[] {
    if (dbDefaults && dbDefaults[industry] && dbDefaults[industry].length > 0) {
        return dbDefaults[industry];
    }
    return INDUSTRY_STATUS_DEFAULTS[industry] || UNIVERSAL_FALLBACK_STATUSES;
}

/**
 * Returns a minimal, valid industryData object for the given industry/entityType.
 * Used as a fallback when an entity has no industryData yet.
 * accountStatus is intentionally NOT included — status field is authoritative.
 */
export function createMinimalIndustryData(
  industry: IndustryVertical,
  entityType: EntityType
): Record<string, unknown> {
  switch (industry) {
    case 'SaaS':
      return entityType === 'institution'
        ? {
            industry: 'SaaS',
            capacity: 0,
            trialIds: [],
            onboardingIds: [],
            supportTicketIds: [],
            healthScoreIds: [],
          }
        : {
            industry: 'SaaS',
            role: 'user',
            activationStatus: 'pending',
          };
    case 'SchoolEnrollment':
      return entityType === 'institution'
        ? {
            industry: 'SchoolEnrollment',
            gradeOfferings: [],
            academicYear: new Date().getFullYear().toString(),
            capacity: 0,
          }
        : {
            industry: 'SchoolEnrollment',
          };
    case 'Law':
      return entityType === 'institution'
        ? {
            industry: 'Law',
            firmType: 'solo',
            practiceAreas: [],
            conflictCheckRequired: false,
          }
        : {
            industry: 'Law',
            clientType: 'individual',
            urgency: 'low',
          };
    case 'Marketing':
      return entityType === 'institution'
        ? {
            industry: 'Marketing',
            clientIndustry: 'N/A',
          }
        : {
            industry: 'Marketing',
            role: 'User',
            influenceLevel: 'user',
            approvalAuthority: false,
          };
    case 'RealEstate':
      return entityType === 'institution'
        ? {
            industry: 'RealEstate',
            developerType: 'residential',
          }
        : {
            industry: 'RealEstate',
            clientType: 'buyer',
          };
    case 'Consultancy':
      return entityType === 'institution'
        ? {
            industry: 'Consultancy',
            clientIndustry: 'N/A',
          }
        : {
            industry: 'Consultancy',
            role: 'User',
            influenceLevel: 'user',
          };
    default:
      return { industry };
  }
}
