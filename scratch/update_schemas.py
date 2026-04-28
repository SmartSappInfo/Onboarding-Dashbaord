import re

with open('src/lib/industry-schemas.ts', 'r') as f:
    content = f.read()

# Shared primitives is fine.

# We should define FinanceDataSchema right after shared primitives.
finance_data_schema = """
// ─────────────────────────────────────────────────────────────────────────────
// Finance Data Schema
// ─────────────────────────────────────────────────────────────────────────────

export const FinanceDataSchema = z.object({
  planType: z.string().optional(),
  subscriptionIds: OptionalStringArraySchema,
  currency: z.string().min(1),
  billingAddress: z.string().optional(),
  subscriptionRate: z.number().nonnegative().optional(),
  customerTier: z.enum(['basic', 'pro', 'enterprise']).optional(),
  signupDate: z.string().optional(),
  renewalDate: z.string().optional(),
  paymentMethod: z.enum(['card', 'bank_transfer', 'cash', 'check']).optional(),
  lastPaymentDate: z.string().optional(),
  nextPaymentDue: z.string().optional(),
  invoiceIds: OptionalStringArraySchema,
  paymentIds: OptionalStringArraySchema,
});
"""

content = content.replace("// ─────────────────────────────────────────────────────────────────────────────\n// SaaS Industry Schemas", finance_data_schema + "\n// ─────────────────────────────────────────────────────────────────────────────\n// SaaS Industry Schemas")

# Replace individual schemas

old_saas_inst = """export const SaaSInstitutionDataSchema = z.object({
  industry: z.literal('SaaS'),
  entityType: z.literal('institution'),
  // Mapped from legacy fields
  companySize: z.number().int().nonnegative(),
  planType: z.string().min(1),
  features: StringArraySchema,
  signupDate: z.string().min(1), // ISO date string
  // Billing fields (existing)
  billingAddress: z.string().optional(),
  currency: z.string().optional(),
  subscriptionRate: z.number().nonnegative().optional(),
  // SaaS-specific fields
  accountStatus: z.enum(['lead', 'trial', 'active', 'suspended', 'churned']),
  renewalDate: z.string().optional(),
  customerTier: z.enum(['basic', 'pro', 'enterprise']).optional(),
  // Collection reference IDs
  trialIds: OptionalStringArraySchema,
  onboardingIds: OptionalStringArraySchema,
  subscriptionIds: OptionalStringArraySchema,
  supportTicketIds: OptionalStringArraySchema,
  healthScoreIds: OptionalStringArraySchema,
});"""

new_saas_inst = """export const SaaSInstitutionDataSchema = z.object({
  industry: z.literal('SaaS'),
  capacity: z.number().int().nonnegative(),
  activeUsers: z.number().int().nonnegative().optional(),
  accountStatus: z.enum(['lead', 'trial', 'active', 'suspended', 'churned']),
  trialIds: OptionalStringArraySchema,
  onboardingIds: OptionalStringArraySchema,
  supportTicketIds: OptionalStringArraySchema,
  healthScoreIds: OptionalStringArraySchema,
});"""

content = content.replace(old_saas_inst, new_saas_inst)

old_saas_pers = """export const SaaSPersonDataSchema = z.object({
  industry: z.literal('SaaS'),
  entityType: z.literal('person'),
  role: z.enum(['admin', 'manager', 'user']),
  lastLoginDate: z.string().optional(),
  activationStatus: z.enum(['pending', 'active', 'inactive']),
});"""

new_saas_pers = """export const SaaSPersonDataSchema = z.object({
  industry: z.literal('SaaS'),
  role: z.enum(['admin', 'manager', 'user']),
  lastLoginDate: z.string().optional(),
  activationStatus: z.enum(['pending', 'active', 'inactive']),
});"""

content = content.replace(old_saas_pers, new_saas_pers)

old_school_inst = """export const SchoolEnrollmentInstitutionDataSchema = z.object({
  industry: z.literal('SchoolEnrollment'),
  entityType: z.literal('institution'),
  gradeOfferings: StringArraySchema,
  academicYear: z.string().min(1),
  enrollmentCapacity: z.number().int().nonnegative().optional(),
  currentEnrollment: z.number().int().nonnegative().optional(),
  // Collection reference IDs
  applicationIds: OptionalStringArraySchema,
  enrollmentIds: OptionalStringArraySchema,
  schoolVisitIds: OptionalStringArraySchema,
});"""

new_school_inst = """export const SchoolEnrollmentInstitutionDataSchema = z.object({
  industry: z.literal('SchoolEnrollment'),
  gradeOfferings: StringArraySchema,
  academicYear: z.string().min(1),
  capacity: z.number().int().nonnegative(),
  currentEnrollment: z.number().int().nonnegative().optional(),
  applicationIds: OptionalStringArraySchema,
  enrollmentIds: OptionalStringArraySchema,
  schoolVisitIds: OptionalStringArraySchema,
});"""

content = content.replace(old_school_inst, new_school_inst)

old_law_inst = """export const LawInstitutionDataSchema = z.object({
  industry: z.literal('Law'),
  entityType: z.literal('institution'),
  firmType: z.enum(['solo', 'partnership', 'corporate']),
  practiceAreas: StringArraySchema,
  barAssociations: OptionalStringArraySchema,
  conflictCheckRequired: z.boolean(),
  // Collection reference IDs
  matterIds: OptionalStringArraySchema,
  intakeFormIds: OptionalStringArraySchema,
  conflictCheckIds: OptionalStringArraySchema,
});"""

new_law_inst = """export const LawInstitutionDataSchema = z.object({
  industry: z.literal('Law'),
  firmType: z.enum(['solo', 'partnership', 'corporate']),
  practiceAreas: StringArraySchema,
  barAssociations: OptionalStringArraySchema,
  capacity: z.number().int().nonnegative().optional(),
  conflictCheckRequired: z.boolean(),
  matterIds: OptionalStringArraySchema,
  intakeFormIds: OptionalStringArraySchema,
  conflictCheckIds: OptionalStringArraySchema,
});"""

content = content.replace(old_law_inst, new_law_inst)

old_law_pers = """export const LawPersonDataSchema = z.object({
  industry: z.literal('Law'),
  entityType: z.literal('person'),
  clientType: z.enum(['individual', 'company']),
  legalIssueType: z.string().optional(),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
});"""

new_law_pers = """export const LawPersonDataSchema = z.object({
  industry: z.literal('Law'),
  clientType: z.enum(['individual', 'company']),
  legalIssueType: z.string().optional(),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
});"""

content = content.replace(old_law_pers, new_law_pers)

old_mkt_inst = """export const MarketingInstitutionDataSchema = z.object({
  industry: z.literal('Marketing'),
  entityType: z.literal('institution'),
  clientIndustry: z.string().min(1),
  businessSize: z.object({
    employees: z.number().int().nonnegative().optional(),
    revenue: z.number().nonnegative().optional(),
  }),
  targetAudience: z.string().optional(),
  monthlyBudget: z.number().nonnegative().optional(),
  // Collection reference IDs
  campaignIds: OptionalStringArraySchema,
  proposalIds: OptionalStringArraySchema,
  deliverableIds: OptionalStringArraySchema,
});"""

new_mkt_inst = """export const MarketingInstitutionDataSchema = z.object({
  industry: z.literal('Marketing'),
  clientIndustry: z.string().min(1),
  targetAudience: z.string().optional(),
  capacity: z.number().int().nonnegative().optional(),
  revenue: z.number().nonnegative().optional(),
  monthlyBudget: z.number().nonnegative().optional(),
  campaignIds: OptionalStringArraySchema,
  proposalIds: OptionalStringArraySchema,
  deliverableIds: OptionalStringArraySchema,
});"""

content = content.replace(old_mkt_inst, new_mkt_inst)

old_mkt_pers = """export const MarketingPersonDataSchema = z.object({
  industry: z.literal('Marketing'),
  entityType: z.literal('person'),
  role: z.string().min(1),
  influenceLevel: z.enum(['decision-maker', 'influencer', 'user']),
  approvalAuthority: z.boolean(),
});"""

new_mkt_pers = """export const MarketingPersonDataSchema = z.object({
  industry: z.literal('Marketing'),
  role: z.string().min(1),
  influenceLevel: z.enum(['decision-maker', 'influencer', 'user']),
  approvalAuthority: z.boolean(),
});"""

content = content.replace(old_mkt_pers, new_mkt_pers)

old_re_inst = """export const RealEstateInstitutionDataSchema = z.object({
  industry: z.literal('RealEstate'),
  entityType: z.literal('institution'),
  propertyPortfolio: OptionalStringArraySchema,
  developerType: z.enum(['residential', 'commercial', 'mixed']),
  investmentFocus: z.string().optional(),
  // Collection reference IDs
  propertyIds: OptionalStringArraySchema,
});"""

new_re_inst = """export const RealEstateInstitutionDataSchema = z.object({
  industry: z.literal('RealEstate'),
  propertyPortfolio: OptionalStringArraySchema,
  developerType: z.enum(['residential', 'commercial', 'mixed']),
  investmentFocus: z.string().optional(),
  capacity: z.number().int().nonnegative().optional(),
  propertyIds: OptionalStringArraySchema,
});"""

content = content.replace(old_re_inst, new_re_inst)

old_re_pers = """export const RealEstatePersonDataSchema = z.object({
  industry: z.literal('RealEstate'),
  entityType: z.literal('person'),
  clientType: z.enum(['buyer', 'seller', 'tenant', 'landlord', 'investor']),
  budgetRange: z
    .object({
      min: z.number().nonnegative(),
      max: z.number().nonnegative(),
    })
    .optional(),
  preferredLocations: OptionalStringArraySchema,
});"""

new_re_pers = """export const RealEstatePersonDataSchema = z.object({
  industry: z.literal('RealEstate'),
  clientType: z.enum(['buyer', 'seller', 'tenant', 'landlord', 'investor']),
  budgetRange: z
    .object({
      min: z.number().nonnegative(),
      max: z.number().nonnegative(),
    })
    .optional(),
  preferredLocations: OptionalStringArraySchema,
});"""

content = content.replace(old_re_pers, new_re_pers)

old_cons_inst = """export const ConsultancyInstitutionDataSchema = z.object({
  industry: z.literal('Consultancy'),
  entityType: z.literal('institution'),
  clientIndustry: z.string().min(1),
  companySize: z.object({
    employees: z.number().int().nonnegative().optional(),
    revenue: z.number().nonnegative().optional(),
  }),
  strategicPriorities: OptionalStringArraySchema,
  painPoints: OptionalStringArraySchema,
  // Collection reference IDs
  discoveryIds: OptionalStringArraySchema,
  proposalIds: OptionalStringArraySchema,
  engagementIds: OptionalStringArraySchema,
});"""

new_cons_inst = """export const ConsultancyInstitutionDataSchema = z.object({
  industry: z.literal('Consultancy'),
  clientIndustry: z.string().min(1),
  capacity: z.number().int().nonnegative().optional(),
  strategicPriorities: OptionalStringArraySchema,
  painPoints: OptionalStringArraySchema,
  discoveryIds: OptionalStringArraySchema,
  proposalIds: OptionalStringArraySchema,
  engagementIds: OptionalStringArraySchema,
});"""

content = content.replace(old_cons_inst, new_cons_inst)

old_cons_pers = """export const ConsultancyPersonDataSchema = z.object({
  industry: z.literal('Consultancy'),
  entityType: z.literal('person'),
  role: z.string().min(1),
  department: z.string().optional(),
  influenceLevel: z.enum(['decision-maker', 'influencer', 'user']),
  decisionMakingStyle: z.enum(['fast', 'consensus', 'hierarchical']).optional(),
});"""

new_cons_pers = """export const ConsultancyPersonDataSchema = z.object({
  industry: z.literal('Consultancy'),
  role: z.string().min(1),
  department: z.string().optional(),
  influenceLevel: z.enum(['decision-maker', 'influencer', 'user']),
  decisionMakingStyle: z.enum(['fast', 'consensus', 'hierarchical']).optional(),
});"""

content = content.replace(old_cons_pers, new_cons_pers)

# Update EntitySchema
old_entity_schema = """export const EntitySchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  entityType: z.enum(['institution', 'family', 'person']),
  name: z.string().min(1),
  status: z.enum(['active', 'archived']).optional(),
  industry: IndustryVerticalSchema.optional(),
  industryData: IndustryDataSchema.optional(),
  migrationStatus: z.enum(['legacy', 'migrated', 'dual-write']).optional(),
  legacySchoolId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});"""

new_entity_schema = """export const EntitySchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  entityType: z.enum(['institution', 'family', 'person']),
  name: z.string().min(1),
  slug: z.string().optional(),
  
  initials: z.string().optional(),
  logoUrl: z.string().optional(),
  referee: z.string().optional(),
  location: z.object({
    locationString: z.string().optional(),
    zone: z.object({
      id: z.string(),
      name: z.string(),
    }).optional(),
  }).optional(),
  
  financeData: FinanceDataSchema.optional(),
  interests: OptionalStringArraySchema,
  
  status: z.enum(['active', 'archived']).optional(),
  industry: IndustryVerticalSchema.optional(),
  industryData: IndustryDataSchema.optional(),
  migrationStatus: z.enum(['legacy', 'migrated', 'dual-write']).optional(),
  legacySchoolId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});"""

content = content.replace(old_entity_schema, new_entity_schema)

with open('src/lib/industry-schemas.ts', 'w') as f:
    f.write(content)

