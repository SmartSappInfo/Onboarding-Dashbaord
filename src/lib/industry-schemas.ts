/**
 * Zod validation schemas for all industry-specific data types.
 *
 * Implements Requirements 23.1–23.10:
 * - Schema per industry data variant (institution + person)
 * - Discriminated union `IndustryDataSchema` keyed on `industry`
 * - `EntitySchema` with optional `industryData`
 * - `validateIndustryData` throws on schema failure or industry mismatch
 *
 * Feature: industry-scoped-entity-expansion
 */

import { z } from 'zod';
import type { IndustryVertical, IndustryData, Entity } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

const StringArraySchema = z.array(z.string());
const OptionalStringArraySchema = z.array(z.string()).optional();

// ─────────────────────────────────────────────────────────────────────────────
// SaaS Industry Schemas (Requirement 8)
// ─────────────────────────────────────────────────────────────────────────────

export const SaaSInstitutionDataSchema = z.object({
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
});

export const SaaSPersonDataSchema = z.object({
  industry: z.literal('SaaS'),
  entityType: z.literal('person'),
  role: z.enum(['admin', 'manager', 'user']),
  lastLoginDate: z.string().optional(),
  activationStatus: z.enum(['pending', 'active', 'inactive']),
});

// ─────────────────────────────────────────────────────────────────────────────
// School Enrollment Industry Schemas (Requirement 4)
// ─────────────────────────────────────────────────────────────────────────────

export const SchoolEnrollmentInstitutionDataSchema = z.object({
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
});

// ─────────────────────────────────────────────────────────────────────────────
// Law Industry Schemas (Requirement 5)
// ─────────────────────────────────────────────────────────────────────────────

export const LawInstitutionDataSchema = z.object({
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
});

export const LawPersonDataSchema = z.object({
  industry: z.literal('Law'),
  entityType: z.literal('person'),
  clientType: z.enum(['individual', 'company']),
  legalIssueType: z.string().optional(),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
});

// ─────────────────────────────────────────────────────────────────────────────
// Marketing Industry Schemas (Requirement 6)
// ─────────────────────────────────────────────────────────────────────────────

export const MarketingInstitutionDataSchema = z.object({
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
});

export const MarketingPersonDataSchema = z.object({
  industry: z.literal('Marketing'),
  entityType: z.literal('person'),
  role: z.string().min(1),
  influenceLevel: z.enum(['decision-maker', 'influencer', 'user']),
  approvalAuthority: z.boolean(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Real Estate Industry Schemas (Requirement 7)
// ─────────────────────────────────────────────────────────────────────────────

export const RealEstateInstitutionDataSchema = z.object({
  industry: z.literal('RealEstate'),
  entityType: z.literal('institution'),
  propertyPortfolio: OptionalStringArraySchema,
  developerType: z.enum(['residential', 'commercial', 'mixed']),
  investmentFocus: z.string().optional(),
  // Collection reference IDs
  propertyIds: OptionalStringArraySchema,
});

export const RealEstatePersonDataSchema = z.object({
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
});

// ─────────────────────────────────────────────────────────────────────────────
// Consultancy Industry Schemas (Requirement 9)
// ─────────────────────────────────────────────────────────────────────────────

export const ConsultancyInstitutionDataSchema = z.object({
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
});

export const ConsultancyPersonDataSchema = z.object({
  industry: z.literal('Consultancy'),
  entityType: z.literal('person'),
  role: z.string().min(1),
  department: z.string().optional(),
  influenceLevel: z.enum(['decision-maker', 'influencer', 'user']),
  decisionMakingStyle: z.enum(['fast', 'consensus', 'hierarchical']).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Discriminated Union — IndustryDataSchema (Requirement 23.5)
// Keyed on `industry` field; each variant is further narrowed by `entityType`
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Union of all industry data schemas.
 *
 * Note: Zod's `discriminatedUnion` requires each member to be a plain
 * `ZodObject` with the discriminant key. Because several industries have
 * two variants (institution + person) that share the same `industry` value,
 * we use a flat `z.union` across all 11 concrete schemas instead.
 * Runtime discrimination is handled by `validateIndustryData` via
 * `INDUSTRY_SCHEMA_MAP`, which picks the correct per-industry union.
 */
export const IndustryDataSchema = z.union([
  SaaSInstitutionDataSchema,
  SaaSPersonDataSchema,
  SchoolEnrollmentInstitutionDataSchema,
  LawInstitutionDataSchema,
  LawPersonDataSchema,
  MarketingInstitutionDataSchema,
  MarketingPersonDataSchema,
  RealEstateInstitutionDataSchema,
  RealEstatePersonDataSchema,
  ConsultancyInstitutionDataSchema,
  ConsultancyPersonDataSchema,
]);

export type IndustryDataInput = z.input<typeof IndustryDataSchema>;
export type IndustryDataOutput = z.output<typeof IndustryDataSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// EntitySchema — core entity with optional industryData (Requirement 23.6)
// ─────────────────────────────────────────────────────────────────────────────

const IndustryVerticalSchema = z.enum([
  'SaaS',
  'SchoolEnrollment',
  'Law',
  'Marketing',
  'RealEstate',
  'Consultancy',
]);

/**
 * Partial Entity schema covering the fields relevant to industry validation.
 * Full entity validation (all fields) is intentionally out of scope here —
 * the complete Entity type lives in types.ts and is enforced by TypeScript.
 */
export const EntitySchema = z.object({
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
});

export type EntityInput = z.input<typeof EntitySchema>;
export type EntityOutput = z.output<typeof EntitySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Per-industry schema lookup map
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps each IndustryVertical to the union of its valid data schemas.
 * Used by `validateIndustryData` to pick the right schema at runtime.
 */
const INDUSTRY_SCHEMA_MAP: Record<IndustryVertical, z.ZodTypeAny> = {
  SaaS: z.union([SaaSInstitutionDataSchema, SaaSPersonDataSchema]),
  SchoolEnrollment: SchoolEnrollmentInstitutionDataSchema,
  Law: z.union([LawInstitutionDataSchema, LawPersonDataSchema]),
  Marketing: z.union([MarketingInstitutionDataSchema, MarketingPersonDataSchema]),
  RealEstate: z.union([RealEstateInstitutionDataSchema, RealEstatePersonDataSchema]),
  Consultancy: z.union([ConsultancyInstitutionDataSchema, ConsultancyPersonDataSchema]),
};

// ─────────────────────────────────────────────────────────────────────────────
// validateIndustryData (Requirement 23.7–23.10)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates that `data` conforms to the schema for `workspaceIndustry`.
 *
 * Throws an `Error` when:
 * 1. `data.industry` does not match `workspaceIndustry` (industry mismatch)
 * 2. The data fails the Zod schema for `workspaceIndustry` (schema failure)
 *
 * Returns the parsed (validated) data on success.
 *
 * @example
 * // Throws: industry mismatch
 * validateIndustryData({ industry: 'Law', ... }, 'SaaS');
 *
 * @example
 * // Throws: schema failure (missing required field)
 * validateIndustryData({ industry: 'SaaS', entityType: 'institution' }, 'SaaS');
 *
 * @example
 * // Returns validated data
 * const validated = validateIndustryData(saasData, 'SaaS');
 */
export function validateIndustryData(
  data: unknown,
  workspaceIndustry: IndustryVertical
): IndustryData {
  // Requirement 23.8 — industry field must match workspace industry
  if (
    typeof data !== 'object' ||
    data === null ||
    (data as Record<string, unknown>)['industry'] !== workspaceIndustry
  ) {
    const actual =
      typeof data === 'object' && data !== null
        ? (data as Record<string, unknown>)['industry']
        : undefined;
    throw new Error(
      `Industry mismatch: industryData.industry is "${String(actual)}" but workspace industry is "${workspaceIndustry}"`
    );
  }

  // Requirement 23.9 — validate against the schema for this industry
  const schema = INDUSTRY_SCHEMA_MAP[workspaceIndustry];
  const result = schema.safeParse(data);

  if (!result.success) {
    const message = result.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    throw new Error(
      `Industry data validation failed for "${workspaceIndustry}": ${message}`
    );
  }

  return result.data as IndustryData;
}
