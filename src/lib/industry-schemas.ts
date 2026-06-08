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

// ─────────────────────────────────────────────────────────────────────────────
// SaaS Industry Schemas (Requirement 8)
// ─────────────────────────────────────────────────────────────────────────────

export const SaaSInstitutionDataSchema = z.object({
  industry: z.literal('SaaS'),
  capacity: z.number().int().nonnegative(),
  activeUsers: z.number().int().nonnegative().optional(),

  trialIds: OptionalStringArraySchema,
  onboardingIds: OptionalStringArraySchema,
  supportTicketIds: OptionalStringArraySchema,
  healthScoreIds: OptionalStringArraySchema,
});

export const SaaSPersonDataSchema = z.object({
  industry: z.literal('SaaS'),
  role: z.enum(['admin', 'manager', 'user']),
  lastLoginDate: z.string().optional(),
  activationStatus: z.enum(['pending', 'active', 'inactive']),
});

// ─────────────────────────────────────────────────────────────────────────────
// School Enrollment Industry Schemas (Requirement 4)
// ─────────────────────────────────────────────────────────────────────────────

export const SchoolEnrollmentInstitutionDataSchema = z.object({
  industry: z.literal('SchoolEnrollment'),
  gradeOfferings: StringArraySchema,
  academicYear: z.string().min(1),
  capacity: z.number().int().nonnegative(),
  currentEnrollment: z.number().int().nonnegative().optional(),
  applicationIds: OptionalStringArraySchema,
  enrollmentIds: OptionalStringArraySchema,
  schoolVisitIds: OptionalStringArraySchema,
});

// ─────────────────────────────────────────────────────────────────────────────
// Law Industry Schemas (Requirement 5)
// ─────────────────────────────────────────────────────────────────────────────

export const LawInstitutionDataSchema = z.object({
  industry: z.literal('Law'),
  firmType: z.enum(['solo', 'partnership', 'corporate']),
  practiceAreas: StringArraySchema,
  barAssociations: OptionalStringArraySchema,
  capacity: z.number().int().nonnegative().optional(),
  conflictCheckRequired: z.boolean(),
  matterIds: OptionalStringArraySchema,
  intakeFormIds: OptionalStringArraySchema,
  conflictCheckIds: OptionalStringArraySchema,
});

export const LawPersonDataSchema = z.object({
  industry: z.literal('Law'),
  clientType: z.enum(['individual', 'company']),
  legalIssueType: z.string().optional(),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
});

// ─────────────────────────────────────────────────────────────────────────────
// Marketing Industry Schemas (Requirement 6)
// ─────────────────────────────────────────────────────────────────────────────

export const MarketingInstitutionDataSchema = z.object({
  industry: z.literal('Marketing'),
  clientIndustry: z.string().min(1),
  targetAudience: z.string().optional(),
  capacity: z.number().int().nonnegative().optional(),
  revenue: z.number().nonnegative().optional(),
  monthlyBudget: z.number().nonnegative().optional(),
  campaignIds: OptionalStringArraySchema,
  proposalIds: OptionalStringArraySchema,
  deliverableIds: OptionalStringArraySchema,
});

export const MarketingPersonDataSchema = z.object({
  industry: z.literal('Marketing'),
  role: z.string().min(1),
  influenceLevel: z.enum(['decision-maker', 'influencer', 'user']),
  approvalAuthority: z.boolean(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Real Estate Industry Schemas (Requirement 7)
// ─────────────────────────────────────────────────────────────────────────────

export const RealEstateInstitutionDataSchema = z.object({
  industry: z.literal('RealEstate'),
  propertyPortfolio: OptionalStringArraySchema,
  developerType: z.enum(['residential', 'commercial', 'mixed']),
  investmentFocus: z.string().optional(),
  capacity: z.number().int().nonnegative().optional(),
  propertyIds: OptionalStringArraySchema,
});

export const RealEstatePersonDataSchema = z.object({
  industry: z.literal('RealEstate'),
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
  clientIndustry: z.string().min(1),
  capacity: z.number().int().nonnegative().optional(),
  strategicPriorities: OptionalStringArraySchema,
  painPoints: OptionalStringArraySchema,
  discoveryIds: OptionalStringArraySchema,
  proposalIds: OptionalStringArraySchema,
  engagementIds: OptionalStringArraySchema,
});

export const ConsultancyPersonDataSchema = z.object({
  industry: z.literal('Consultancy'),
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
