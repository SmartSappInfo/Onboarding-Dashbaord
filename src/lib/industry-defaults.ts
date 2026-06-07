import type { IndustryVertical, EntityType } from './types';

/**
 * Returns a minimal, valid industryData object for the given industry/entityType.
 * Used as a fallback when an entity has no industryData yet.
 * accountStatus is intentionally NOT included — lifecycleStatus is authoritative.
 */
export function createMinimalIndustryData(
  industry: IndustryVertical,
  entityType: EntityType
): Record<string, any> {
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
