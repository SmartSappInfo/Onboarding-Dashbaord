import re

with open('src/lib/types.ts', 'r') as f:
    content = f.read()

# 1. Update Entity interface
entity_pattern = re.compile(r'(export interface Entity \{)(.*?)(^\})', re.MULTILINE | re.DOTALL)

def entity_replacement(m):
    inner = m.group(2)
    
    # Remove institutionData, add financeData, interests, root fields
    # We will just replace the whole Entity interface to be safe, but let's do targeted replacements inside it.
    
    return m.group(1) + m.group(2) + m.group(3)

# Let's just do targeted string replacements.

# Entity Interface Replacement
old_entity = """export interface Entity {
  id: string;
  organizationId: string;
  entityType: EntityType;
  name: string; // Display name (computed from firstName + lastName for person entities)
  slug?: string; // URL-safe identifier (for institution entities)
  entityContacts: EntityContact[]; // Canonical contact data (FER-01)
  contacts?: any[]; // @deprecated - legacy focal persons fallback
  globalTags: string[]; // Identity-level tags visible across all workspaces (Requirement 7)
  status?: 'active' | 'archived'; // Soft delete status
  createdAt: string;
  updatedAt: string;
  // Scope-specific data (only one will be populated based on entityType)
  institutionData?: InstitutionData;
  familyData?: FamilyData;
  personData?: PersonData;
  // Industry-specific data (polymorphic, Requirement 3)
  industry?: IndustryVertical;
  industryData?: IndustryData;
  // Migration fields (Requirement 12)
  migrationStatus?: 'legacy' | 'migrated' | 'dual-write';
  legacySchoolId?: string;
  // Reserved for future cross-entity relationships
  relatedEntityIds?: string[];
}"""

new_entity = """export interface Entity {
  id: string;
  organizationId: string;
  entityType: EntityType;
  name: string; // Display name (computed from firstName + lastName for person entities)
  slug?: string; // URL-safe identifier (for institution entities)
  
  // Institution-specific root fields (Moved from institutionData)
  initials?: string;
  logoUrl?: string;
  referee?: string;
  location?: {
    locationString?: string;
    zone?: {
      id: string;
      name: string;
    };
  };

  entityContacts: EntityContact[]; // Canonical contact data (FER-01)
  contacts?: any[]; // @deprecated - legacy focal persons fallback
  
  // Finance Data (Consolidated)
  financeData?: FinanceData;
  
  globalTags: string[]; // Identity-level tags visible across all workspaces (Requirement 7)
  
  // Legacy modules/features migrated to root
  interests?: string[]; // Array of feature/module/interest IDs or names

  status?: 'active' | 'archived'; // Soft delete status
  createdAt: string;
  updatedAt: string;
  
  // Scope-specific data (only one will be populated based on entityType)
  /** @deprecated Moved to root/financeData/industryData. Kept for migration. */
  institutionData?: InstitutionData;
  familyData?: FamilyData;
  personData?: PersonData;
  
  // Industry-specific data (polymorphic, Requirement 3)
  industry?: IndustryVertical;
  industryData?: IndustryData;
  
  // Migration fields (Requirement 12)
  migrationStatus?: 'legacy' | 'migrated' | 'dual-write';
  legacySchoolId?: string;
  
  // Reserved for future cross-entity relationships
  relatedEntityIds?: string[];
}"""

content = content.replace(old_entity, new_entity)

finance_data = """/**
 * Consolidated finance data for all entity types
 * Replaces scattered billing fields across institutionData and industryData
 */
export interface FinanceData {
  planType?: string;
  subscriptionIds?: string[];
  currency: string;
  billingAddress?: string;
  subscriptionRate?: number;
  customerTier?: 'basic' | 'pro' | 'enterprise';
  signupDate?: string;
  renewalDate?: string;
  paymentMethod?: 'card' | 'bank_transfer' | 'cash' | 'check';
  lastPaymentDate?: string;
  nextPaymentDue?: string;
  invoiceIds?: string[];
  paymentIds?: string[];
}

"""

# Insert FinanceData before export interface Entity
content = content.replace('export interface Entity {', finance_data + 'export interface Entity {')

# SaaSInstitutionData
old_saas_inst = """export interface SaaSInstitutionData {
  industry: 'SaaS';
  entityType: 'institution';
  companySize: number; // Maps from nominalRoll
  planType: string; // Maps from subscriptionPackage
  features: string[]; // Maps from modules
  signupDate: string; // Maps from implementationDate (ISO string)
  billingAddress?: string;
  currency?: string;
  subscriptionRate?: number;
  accountStatus: 'lead' | 'trial' | 'active' | 'suspended' | 'churned';
  renewalDate?: string;
  customerTier?: 'basic' | 'pro' | 'enterprise';
  trialIds?: string[];
  onboardingIds?: string[];
  subscriptionIds?: string[];
  supportTicketIds?: string[];
  healthScoreIds?: string[];
}"""

new_saas_inst = """export interface SaaSInstitutionData {
  industry: 'SaaS';
  capacity: number; // Renamed from companySize
  activeUsers?: number;
  accountStatus: 'lead' | 'trial' | 'active' | 'suspended' | 'churned';
  trialIds?: string[];
  onboardingIds?: string[];
  supportTicketIds?: string[];
  healthScoreIds?: string[];
}"""
content = content.replace(old_saas_inst, new_saas_inst)

# SaaSPersonData
old_saas_pers = """export interface SaaSPersonData {
  industry: 'SaaS';
  entityType: 'person';
  role: 'admin' | 'manager' | 'user';
  lastLoginDate?: string;
  activationStatus: 'pending' | 'active' | 'inactive';
}"""

new_saas_pers = """export interface SaaSPersonData {
  industry: 'SaaS';
  role: 'admin' | 'manager' | 'user';
  lastLoginDate?: string;
  activationStatus: 'pending' | 'active' | 'inactive';
}"""
content = content.replace(old_saas_pers, new_saas_pers)

# SchoolEnrollmentInstitutionData
old_school_inst = """export interface SchoolEnrollmentInstitutionData {
  industry: 'SchoolEnrollment';
  entityType: 'institution';
  gradeOfferings: string[];
  academicYear: string;
  enrollmentCapacity?: number;
  currentEnrollment?: number;
  applicationIds?: string[];
  enrollmentIds?: string[];
  schoolVisitIds?: string[];
}"""

new_school_inst = """export interface SchoolEnrollmentInstitutionData {
  industry: 'SchoolEnrollment';
  gradeOfferings: string[];
  academicYear: string;
  capacity: number; // Renamed from enrollmentCapacity
  currentEnrollment?: number;
  applicationIds?: string[];
  enrollmentIds?: string[];
  schoolVisitIds?: string[];
}"""
content = content.replace(old_school_inst, new_school_inst)

# LawInstitutionData
old_law_inst = """export interface LawInstitutionData {
  industry: 'Law';
  entityType: 'institution';
  firmType: 'solo' | 'partnership' | 'corporate';
  practiceAreas: string[];
  barAssociations?: string[];
  conflictCheckRequired: boolean;
  matterIds?: string[];
  intakeFormIds?: string[];
  conflictCheckIds?: string[];
}"""

new_law_inst = """export interface LawInstitutionData {
  industry: 'Law';
  firmType: 'solo' | 'partnership' | 'corporate';
  practiceAreas: string[];
  barAssociations?: string[];
  capacity?: number; // Number of attorneys/staff
  conflictCheckRequired: boolean;
  matterIds?: string[];
  intakeFormIds?: string[];
  conflictCheckIds?: string[];
}"""
content = content.replace(old_law_inst, new_law_inst)

# LawPersonData
old_law_pers = """export interface LawPersonData {
  industry: 'Law';
  entityType: 'person';
  clientType: 'individual' | 'company';
  legalIssueType?: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}"""

new_law_pers = """export interface LawPersonData {
  industry: 'Law';
  clientType: 'individual' | 'company';
  legalIssueType?: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}"""
content = content.replace(old_law_pers, new_law_pers)

# MarketingInstitutionData
old_mkt_inst = """export interface MarketingInstitutionData {
  industry: 'Marketing';
  entityType: 'institution';
  clientIndustry: string;
  businessSize: { employees?: number; revenue?: number };
  targetAudience?: string;
  monthlyBudget?: number;
  campaignIds?: string[];
  proposalIds?: string[];
  deliverableIds?: string[];
}"""

new_mkt_inst = """export interface MarketingInstitutionData {
  industry: 'Marketing';
  clientIndustry: string;
  targetAudience?: string;
  capacity?: number; // Number of employees
  revenue?: number; // Annual revenue
  monthlyBudget?: number;
  campaignIds?: string[];
  proposalIds?: string[];
  deliverableIds?: string[];
}"""
content = content.replace(old_mkt_inst, new_mkt_inst)

# MarketingPersonData
old_mkt_pers = """export interface MarketingPersonData {
  industry: 'Marketing';
  entityType: 'person';
  role: string;
  influenceLevel: 'decision-maker' | 'influencer' | 'user';
  approvalAuthority: boolean;
}"""

new_mkt_pers = """export interface MarketingPersonData {
  industry: 'Marketing';
  role: string;
  influenceLevel: 'decision-maker' | 'influencer' | 'user';
  approvalAuthority: boolean;
}"""
content = content.replace(old_mkt_pers, new_mkt_pers)

# RealEstateInstitutionData
old_re_inst = """export interface RealEstateInstitutionData {
  industry: 'RealEstate';
  entityType: 'institution';
  propertyPortfolio?: string[];
  developerType: 'residential' | 'commercial' | 'mixed';
  investmentFocus?: string;
  propertyIds?: string[];
}"""

new_re_inst = """export interface RealEstateInstitutionData {
  industry: 'RealEstate';
  propertyPortfolio?: string[];
  developerType: 'residential' | 'commercial' | 'mixed';
  investmentFocus?: string;
  capacity?: number; // Number of properties managed
  propertyIds?: string[];
}"""
content = content.replace(old_re_inst, new_re_inst)

# RealEstatePersonData
old_re_pers = """export interface RealEstatePersonData {
  industry: 'RealEstate';
  entityType: 'person';
  clientType: 'buyer' | 'seller' | 'tenant' | 'landlord' | 'investor';
  budgetRange?: { min: number; max: number };
  preferredLocations?: string[];
}"""

new_re_pers = """export interface RealEstatePersonData {
  industry: 'RealEstate';
  clientType: 'buyer' | 'seller' | 'tenant' | 'landlord' | 'investor';
  budgetRange?: { min: number; max: number };
  preferredLocations?: string[];
}"""
content = content.replace(old_re_pers, new_re_pers)

# ConsultancyInstitutionData
old_cons_inst = """export interface ConsultancyInstitutionData {
  industry: 'Consultancy';
  entityType: 'institution';
  clientIndustry: string;
  companySize: { employees?: number; revenue?: number };
  strategicPriorities?: string[];
  painPoints?: string[];
  discoveryIds?: string[];
  proposalIds?: string[];
  engagementIds?: string[];
}"""

new_cons_inst = """export interface ConsultancyInstitutionData {
  industry: 'Consultancy';
  clientIndustry: string;
  capacity?: number; // Number of consultants
  strategicPriorities?: string[];
  painPoints?: string[];
  discoveryIds?: string[];
  proposalIds?: string[];
  engagementIds?: string[];
}"""
content = content.replace(old_cons_inst, new_cons_inst)

# ConsultancyPersonData
old_cons_pers = """export interface ConsultancyPersonData {
  industry: 'Consultancy';
  entityType: 'person';
  role: string;
  department?: string;
  influenceLevel: 'decision-maker' | 'influencer' | 'user';
  decisionMakingStyle?: 'fast' | 'consensus' | 'hierarchical';
}"""

new_cons_pers = """export interface ConsultancyPersonData {
  industry: 'Consultancy';
  role: string;
  department?: string;
  influenceLevel: 'decision-maker' | 'influencer' | 'user';
  decisionMakingStyle?: 'fast' | 'consensus' | 'hierarchical';
}"""
content = content.replace(old_cons_pers, new_cons_pers)

with open('src/lib/types.ts', 'w') as f:
    f.write(content)

