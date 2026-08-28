/**
 * @fileoverview Canonical Role Blueprints & Multi-Industry Preset Catalog
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Single source of truth for all 22 platform role architecture blueprints.
 * - Categorizes roles by Industry Vertical ('SaaS', 'SchoolEnrollment', 'Marketing', 'Law', 'RealEstate', 'Consultancy', 'Universal').
 * - Every blueprint payload is guaranteed to pass `normalizePermissionsSchema` without throwing or leaking undefined keys.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Exported `CANONICAL_ROLE_BLUEPRINTS` and helpers are tested in `role-templates-qa.test.ts`.
 */

import type { PlatformTemplate } from './backoffice/backoffice-types';
import type { PermissionsSchema, IndustryVertical } from './types';
import {
  getBlankPermissions,
  getFullAdminPermissions,
  getOperationsPermissions,
  getFinancePermissions,
  getMarketingPermissions,
  normalizePermissionsSchema,
} from './permissions-engine';

// ─────────────────────────────────────────────────────────────
// 1. Specialized Vertical Schema Builders
// ─────────────────────────────────────────────────────────────

/** SaaS: Customer Success Lead */
export function getSaaSCustomerSuccessPermissions(): PermissionsSchema {
  const schema = getBlankPermissions();
  schema.operations = {
    enabled: true,
    features: {
      dashboard: { view: true },
      campuses: { view: true, create: false, edit: true, delete: false },
      pipeline: { view: true, create: true, edit: true, delete: false },
      tasks: { view: true, create: true, edit: true, delete: false },
      meetings: { view: true, create: true, edit: true, delete: false },
      automations: { view: false },
      intelligence: { view: true },
      quickNotes: { view: true, create: true, edit: true, delete: false },
    },
  };
  schema.studios = {
    enabled: true,
    features: {
      publicPortals: { view: true },
      landingPages: { view: false },
      media: { view: true, create: true, edit: true, delete: false },
      surveys: { view: true, create: true, edit: true, delete: false },
      messaging: { view: true, create: true, edit: true, delete: false },
      forms: { view: true, create: true, edit: true, delete: false },
      tags: { view: true, create: true, edit: true, delete: false },
      docSigning: { view: false },
      qrStudio: { view: false },
      verifyStudio: { view: false },
      socialIntelligence: { view: false },
    },
  };
  schema.management = {
    enabled: true,
    features: {
      activities: { view: true },
      users: { view: false },
      fields: { view: false },
      systemSettings: { view: false },
    },
  };
  return normalizePermissionsSchema(schema);
}

/** SaaS: Sales & Growth Executive */
export function getSaaSSalesExecutivePermissions(): PermissionsSchema {
  const schema = getBlankPermissions();
  schema.operations = {
    enabled: true,
    features: {
      dashboard: { view: true },
      campuses: { view: true, create: true, edit: true, delete: false },
      pipeline: { view: true, create: true, edit: true, delete: true },
      tasks: { view: true, create: true, edit: true, delete: false },
      meetings: { view: true, create: true, edit: true, delete: false },
      automations: { view: true, create: true, edit: true, delete: false },
      intelligence: { view: true },
      quickNotes: { view: true, create: true, edit: true, delete: false },
    },
  };
  schema.studios = {
    enabled: true,
    features: {
      publicPortals: { view: true, create: true, edit: true, delete: false },
      landingPages: { view: true, create: true, edit: true, delete: false },
      media: { view: true, create: true, edit: true, delete: false },
      surveys: { view: true, create: true, edit: true, delete: false },
      messaging: { view: true, create: true, edit: true, delete: false },
      forms: { view: true, create: true, edit: true, delete: false },
      tags: { view: true, create: true, edit: true, delete: false },
      docSigning: { view: false },
      qrStudio: { view: true, create: true, edit: true, delete: false },
      verifyStudio: { view: false },
      socialIntelligence: { view: true, create: false, edit: false, delete: false },
    },
  };
  return normalizePermissionsSchema(schema);
}

/** SaaS: Billing & Subscriptions Specialist */
export function getSaaSBillingSpecialistPermissions(): PermissionsSchema {
  const schema = getBlankPermissions();
  schema.finance = {
    enabled: true,
    features: {
      agreements: { view: true, create: true, edit: true, delete: false },
      invoices: { view: true, create: true, edit: true, delete: true },
      packages: { view: true, create: true, edit: true, delete: false },
      cycles: { view: true, create: true, edit: true, delete: false },
      billingSetup: { view: true, create: true, edit: true, delete: false },
    },
  };
  schema.operations = {
    enabled: true,
    features: {
      dashboard: { view: true },
      campuses: { view: true, create: false, edit: false, delete: false },
      pipeline: { view: false },
      tasks: { view: true, create: true, edit: true, delete: false },
      meetings: { view: false },
      automations: { view: false },
      intelligence: { view: true },
      quickNotes: { view: false },
    },
  };
  return normalizePermissionsSchema(schema);
}

/** School Admissions: Admissions Officer */
export function getSchoolAdmissionsOfficerPermissions(): PermissionsSchema {
  const schema = getBlankPermissions();
  schema.operations = {
    enabled: true,
    features: {
      dashboard: { view: true },
      campuses: { view: true, create: true, edit: true, delete: false },
      pipeline: { view: true, create: true, edit: true, delete: false },
      tasks: { view: true, create: true, edit: true, delete: false },
      meetings: { view: true, create: true, edit: true, delete: false },
      automations: { view: false },
      intelligence: { view: true },
      quickNotes: { view: true, create: true, edit: true, delete: false },
    },
  };
  schema.studios = {
    enabled: true,
    features: {
      publicPortals: { view: true },
      landingPages: { view: false },
      media: { view: true, create: true, edit: true, delete: false },
      surveys: { view: true, create: true, edit: true, delete: false },
      messaging: { view: true, create: true, edit: true, delete: false },
      forms: { view: true, create: true, edit: true, delete: false },
      tags: { view: true, create: true, edit: true, delete: false },
      docSigning: { view: true, create: true, edit: true, delete: false },
      qrStudio: { view: true, create: true, edit: true, delete: false },
      verifyStudio: { view: false },
      socialIntelligence: { view: false },
    },
  };
  return normalizePermissionsSchema(schema);
}

/** School Admissions: Academic Registrar */
export function getSchoolRegistrarPermissions(): PermissionsSchema {
  const schema = getBlankPermissions();
  schema.operations = {
    enabled: true,
    features: {
      dashboard: { view: true },
      campuses: { view: true, create: true, edit: true, delete: false },
      pipeline: { view: true, create: false, edit: true, delete: false },
      tasks: { view: true, create: true, edit: true, delete: false },
      meetings: { view: true, create: true, edit: true, delete: false },
      automations: { view: false },
      intelligence: { view: true },
      quickNotes: { view: true, create: true, edit: true, delete: false },
    },
  };
  schema.studios = {
    enabled: true,
    features: {
      publicPortals: { view: true, create: true, edit: true, delete: false },
      landingPages: { view: false },
      media: { view: true, create: true, edit: true, delete: false },
      surveys: { view: true, create: true, edit: true, delete: false },
      messaging: { view: true, create: true, edit: true, delete: false },
      forms: { view: true, create: true, edit: true, delete: false },
      tags: { view: true, create: true, edit: true, delete: false },
      docSigning: { view: true, create: true, edit: true, delete: true },
      qrStudio: { view: true, create: true, edit: true, delete: false },
      verifyStudio: { view: true, create: true, edit: true, delete: false },
      socialIntelligence: { view: false },
    },
  };
  schema.management = {
    enabled: true,
    features: {
      activities: { view: true },
      users: { view: false },
      fields: { view: true, create: false, edit: true, delete: false },
      systemSettings: { view: false },
    },
  };
  return normalizePermissionsSchema(schema);
}

/** School Admissions: Bursar / Finance Lead */
export function getSchoolBursarPermissions(): PermissionsSchema {
  const schema = getBlankPermissions();
  schema.finance = {
    enabled: true,
    features: {
      agreements: { view: true, create: true, edit: true, delete: false },
      invoices: { view: true, create: true, edit: true, delete: true },
      packages: { view: true, create: true, edit: true, delete: false },
      cycles: { view: true, create: true, edit: true, delete: false },
      billingSetup: { view: true, create: true, edit: true, delete: false },
    },
  };
  schema.operations = {
    enabled: true,
    features: {
      dashboard: { view: true },
      campuses: { view: true, create: false, edit: false, delete: false },
      pipeline: { view: false },
      tasks: { view: true, create: true, edit: true, delete: false },
      meetings: { view: false },
      automations: { view: false },
      intelligence: { view: true },
      quickNotes: { view: false },
    },
  };
  return normalizePermissionsSchema(schema);
}

/** Marketing Agency: Campaign & Creative Director */
export function getMarketingCreativeDirectorPermissions(): PermissionsSchema {
  const schema = getMarketingPermissions();
  schema.operations = {
    enabled: true,
    features: {
      dashboard: { view: true },
      campuses: { view: true, create: false, edit: false, delete: false },
      pipeline: { view: false },
      tasks: { view: true, create: true, edit: true, delete: false },
      meetings: { view: true, create: true, edit: true, delete: false },
      automations: { view: false },
      intelligence: { view: true },
      quickNotes: { view: true, create: true, edit: true, delete: false },
    },
  };
  return normalizePermissionsSchema(schema);
}

/** Marketing Agency: Agency Account Executive */
export function getMarketingAccountExecutivePermissions(): PermissionsSchema {
  const schema = getBlankPermissions();
  schema.operations = {
    enabled: true,
    features: {
      dashboard: { view: true },
      campuses: { view: true, create: true, edit: true, delete: false },
      pipeline: { view: true, create: true, edit: true, delete: false },
      tasks: { view: true, create: true, edit: true, delete: false },
      meetings: { view: true, create: true, edit: true, delete: false },
      automations: { view: false },
      intelligence: { view: true },
      quickNotes: { view: true, create: true, edit: true, delete: false },
    },
  };
  schema.finance = {
    enabled: true,
    features: {
      agreements: { view: true, create: true, edit: true, delete: false },
      invoices: { view: true, create: true, edit: true, delete: false },
      packages: { view: true, create: false, edit: false, delete: false },
      cycles: { view: false },
      billingSetup: { view: false },
    },
  };
  schema.studios = {
    enabled: true,
    features: {
      publicPortals: { view: true, create: false, edit: false, delete: false },
      landingPages: { view: true, create: false, edit: false, delete: false },
      media: { view: true, create: true, edit: true, delete: false },
      surveys: { view: true, create: true, edit: true, delete: false },
      messaging: { view: true, create: true, edit: true, delete: false },
      forms: { view: true, create: true, edit: true, delete: false },
      tags: { view: true, create: true, edit: true, delete: false },
      docSigning: { view: true, create: true, edit: true, delete: false },
      qrStudio: { view: true, create: true, edit: true, delete: false },
      verifyStudio: { view: false },
      socialIntelligence: { view: true, create: false, edit: false, delete: false },
    },
  };
  return normalizePermissionsSchema(schema);
}

/** Marketing Agency: Growth & Analytics Lead */
export function getMarketingAnalyticsLeadPermissions(): PermissionsSchema {
  const schema = getBlankPermissions();
  schema.operations = {
    enabled: true,
    features: {
      dashboard: { view: true },
      campuses: { view: true, create: false, edit: false, delete: false },
      pipeline: { view: true, create: false, edit: false, delete: false },
      tasks: { view: true, create: true, edit: true, delete: false },
      meetings: { view: false },
      automations: { view: false },
      intelligence: { view: true },
      quickNotes: { view: true, create: true, edit: true, delete: false },
    },
  };
  schema.studios = {
    enabled: true,
    features: {
      publicPortals: { view: true, create: false, edit: false, delete: false },
      landingPages: { view: true, create: false, edit: false, delete: false },
      media: { view: true, create: false, edit: false, delete: false },
      surveys: { view: true, create: true, edit: true, delete: false },
      messaging: { view: false },
      forms: { view: true, create: false, edit: false, delete: false },
      tags: { view: true, create: true, edit: true, delete: false },
      docSigning: { view: false },
      qrStudio: { view: true, create: true, edit: true, delete: false },
      verifyStudio: { view: false },
      socialIntelligence: { view: true, create: true, edit: true, delete: true },
    },
  };
  return normalizePermissionsSchema(schema);
}

/** Law Practice: Managing Partner / Lead Attorney */
export function getLawManagingPartnerPermissions(): PermissionsSchema {
  const schema = getFullAdminPermissions();
  // Retains broad governance suitable for partners
  return schema;
}

/** Law Practice: Paralegal & Intake Coordinator */
export function getLawParalegalPermissions(): PermissionsSchema {
  const schema = getBlankPermissions();
  schema.operations = {
    enabled: true,
    features: {
      dashboard: { view: true },
      campuses: { view: true, create: true, edit: true, delete: false },
      pipeline: { view: true, create: true, edit: true, delete: false },
      tasks: { view: true, create: true, edit: true, delete: false },
      meetings: { view: true, create: true, edit: true, delete: false },
      automations: { view: false },
      intelligence: { view: true },
      quickNotes: { view: true, create: true, edit: true, delete: false },
    },
  };
  schema.studios = {
    enabled: true,
    features: {
      publicPortals: { view: true, create: false, edit: false, delete: false },
      landingPages: { view: false },
      media: { view: true, create: true, edit: true, delete: false },
      surveys: { view: true, create: true, edit: true, delete: false },
      messaging: { view: true, create: true, edit: true, delete: false },
      forms: { view: true, create: true, edit: true, delete: false },
      tags: { view: true, create: true, edit: true, delete: false },
      docSigning: { view: true, create: true, edit: true, delete: false },
      qrStudio: { view: false },
      verifyStudio: { view: true, create: true, edit: true, delete: false },
      socialIntelligence: { view: false },
    },
  };
  schema.management = {
    enabled: true,
    features: {
      activities: { view: true },
      users: { view: false },
      fields: { view: true, create: false, edit: false, delete: false },
      systemSettings: { view: false },
    },
  };
  return normalizePermissionsSchema(schema);
}

/** Law Practice: Legal Billing Clerk */
export function getLawBillingClerkPermissions(): PermissionsSchema {
  const schema = getBlankPermissions();
  schema.finance = {
    enabled: true,
    features: {
      agreements: { view: true, create: true, edit: true, delete: false },
      invoices: { view: true, create: true, edit: true, delete: true },
      packages: { view: true, create: true, edit: true, delete: false },
      cycles: { view: true, create: true, edit: true, delete: false },
      billingSetup: { view: true, create: true, edit: true, delete: false },
    },
  };
  schema.operations = {
    enabled: true,
    features: {
      dashboard: { view: true },
      campuses: { view: true, create: false, edit: false, delete: false },
      pipeline: { view: false },
      tasks: { view: true, create: true, edit: true, delete: false },
      meetings: { view: false },
      automations: { view: false },
      intelligence: { view: true },
      quickNotes: { view: false },
    },
  };
  return normalizePermissionsSchema(schema);
}

/** Real Estate: Lead Broker / Agent */
export function getRealEstateBrokerPermissions(): PermissionsSchema {
  const schema = getBlankPermissions();
  schema.operations = {
    enabled: true,
    features: {
      dashboard: { view: true },
      campuses: { view: true, create: true, edit: true, delete: true },
      pipeline: { view: true, create: true, edit: true, delete: false },
      tasks: { view: true, create: true, edit: true, delete: false },
      meetings: { view: true, create: true, edit: true, delete: false },
      automations: { view: false },
      intelligence: { view: true },
      quickNotes: { view: true, create: true, edit: true, delete: false },
    },
  };
  schema.finance = {
    enabled: true,
    features: {
      agreements: { view: true, create: true, edit: true, delete: false },
      invoices: { view: true, create: true, edit: true, delete: false },
      packages: { view: false },
      cycles: { view: false },
      billingSetup: { view: false },
    },
  };
  schema.studios = {
    enabled: true,
    features: {
      publicPortals: { view: true, create: true, edit: true, delete: false },
      landingPages: { view: true, create: true, edit: true, delete: false },
      media: { view: true, create: true, edit: true, delete: true },
      surveys: { view: true, create: true, edit: true, delete: false },
      messaging: { view: true, create: true, edit: true, delete: false },
      forms: { view: true, create: true, edit: true, delete: false },
      tags: { view: true, create: true, edit: true, delete: false },
      docSigning: { view: true, create: true, edit: true, delete: false },
      qrStudio: { view: true, create: true, edit: true, delete: false },
      verifyStudio: { view: false },
      socialIntelligence: { view: true, create: false, edit: false, delete: false },
    },
  };
  return normalizePermissionsSchema(schema);
}

/** Real Estate: Property Marketing Specialist */
export function getRealEstateMarketingSpecialistPermissions(): PermissionsSchema {
  const schema = getBlankPermissions();
  schema.operations = {
    enabled: true,
    features: {
      dashboard: { view: true },
      campuses: { view: true, create: false, edit: false, delete: false },
      pipeline: { view: false },
      tasks: { view: true, create: true, edit: true, delete: false },
      meetings: { view: false },
      automations: { view: false },
      intelligence: { view: true },
      quickNotes: { view: true, create: true, edit: true, delete: false },
    },
  };
  schema.studios = {
    enabled: true,
    features: {
      publicPortals: { view: true, create: true, edit: true, delete: false },
      landingPages: { view: true, create: true, edit: true, delete: true },
      media: { view: true, create: true, edit: true, delete: true },
      surveys: { view: true, create: true, edit: true, delete: false },
      messaging: { view: true, create: true, edit: true, delete: false },
      forms: { view: true, create: true, edit: true, delete: false },
      tags: { view: true, create: true, edit: true, delete: false },
      docSigning: { view: false },
      qrStudio: { view: true, create: true, edit: true, delete: true },
      verifyStudio: { view: false },
      socialIntelligence: { view: true, create: true, edit: true, delete: true },
    },
  };
  return normalizePermissionsSchema(schema);
}

/** Real Estate: Escrow & Transaction Coordinator */
export function getRealEstateEscrowCoordinatorPermissions(): PermissionsSchema {
  const schema = getBlankPermissions();
  schema.finance = {
    enabled: true,
    features: {
      agreements: { view: true, create: true, edit: true, delete: true },
      invoices: { view: true, create: true, edit: true, delete: false },
      packages: { view: false },
      cycles: { view: false },
      billingSetup: { view: false },
    },
  };
  schema.studios = {
    enabled: true,
    features: {
      publicPortals: { view: true, create: false, edit: false, delete: false },
      landingPages: { view: false },
      media: { view: true, create: false, edit: false, delete: false },
      surveys: { view: false },
      messaging: { view: true, create: true, edit: true, delete: false },
      forms: { view: true, create: false, edit: false, delete: false },
      tags: { view: true, create: true, edit: true, delete: false },
      docSigning: { view: true, create: true, edit: true, delete: true },
      qrStudio: { view: false },
      verifyStudio: { view: false },
      socialIntelligence: { view: false },
    },
  };
  schema.operations = {
    enabled: true,
    features: {
      dashboard: { view: true },
      campuses: { view: true, create: false, edit: false, delete: false },
      pipeline: { view: true, create: false, edit: true, delete: false },
      tasks: { view: true, create: true, edit: true, delete: false },
      meetings: { view: true, create: true, edit: true, delete: false },
      automations: { view: false },
      intelligence: { view: true },
      quickNotes: { view: true, create: true, edit: true, delete: false },
    },
  };
  return normalizePermissionsSchema(schema);
}

/** Consultancy: Engagement Principal / Lead Consultant */
export function getConsultancyPrincipalPermissions(): PermissionsSchema {
  const schema = getBlankPermissions();
  schema.operations = {
    enabled: true,
    features: {
      dashboard: { view: true },
      campuses: { view: true, create: true, edit: true, delete: true },
      pipeline: { view: true, create: true, edit: true, delete: false },
      tasks: { view: true, create: true, edit: true, delete: false },
      meetings: { view: true, create: true, edit: true, delete: false },
      automations: { view: false },
      intelligence: { view: true },
      quickNotes: { view: true, create: true, edit: true, delete: false },
    },
  };
  schema.finance = {
    enabled: true,
    features: {
      agreements: { view: true, create: true, edit: true, delete: false },
      invoices: { view: true, create: true, edit: true, delete: false },
      packages: { view: true, create: true, edit: true, delete: false },
      cycles: { view: false },
      billingSetup: { view: false },
    },
  };
  schema.studios = {
    enabled: true,
    features: {
      publicPortals: { view: true, create: true, edit: true, delete: false },
      landingPages: { view: false },
      media: { view: true, create: true, edit: true, delete: false },
      surveys: { view: true, create: true, edit: true, delete: false },
      messaging: { view: true, create: true, edit: true, delete: false },
      forms: { view: true, create: true, edit: true, delete: false },
      tags: { view: true, create: true, edit: true, delete: false },
      docSigning: { view: true, create: true, edit: true, delete: false },
      qrStudio: { view: false },
      verifyStudio: { view: false },
      socialIntelligence: { view: false },
    },
  };
  return normalizePermissionsSchema(schema);
}

/** Consultancy: Client Operations Specialist */
export function getConsultancyOperationsSpecialistPermissions(): PermissionsSchema {
  const schema = getBlankPermissions();
  schema.operations = {
    enabled: true,
    features: {
      dashboard: { view: true },
      campuses: { view: true, create: false, edit: true, delete: false },
      pipeline: { view: true, create: false, edit: true, delete: false },
      tasks: { view: true, create: true, edit: true, delete: false },
      meetings: { view: true, create: true, edit: true, delete: false },
      automations: { view: false },
      intelligence: { view: true },
      quickNotes: { view: true, create: true, edit: true, delete: false },
    },
  };
  schema.studios = {
    enabled: true,
    features: {
      publicPortals: { view: true, create: false, edit: false, delete: false },
      landingPages: { view: false },
      media: { view: true, create: true, edit: true, delete: false },
      surveys: { view: true, create: true, edit: true, delete: false },
      messaging: { view: true, create: true, edit: true, delete: false },
      forms: { view: true, create: true, edit: true, delete: false },
      tags: { view: true, create: true, edit: true, delete: false },
      docSigning: { view: false },
      qrStudio: { view: false },
      verifyStudio: { view: false },
      socialIntelligence: { view: false },
    },
  };
  return normalizePermissionsSchema(schema);
}

/** Consultancy: Contracts & Invoicing Officer */
export function getConsultancyContractsOfficerPermissions(): PermissionsSchema {
  const schema = getBlankPermissions();
  schema.finance = {
    enabled: true,
    features: {
      agreements: { view: true, create: true, edit: true, delete: true },
      invoices: { view: true, create: true, edit: true, delete: true },
      packages: { view: true, create: true, edit: true, delete: false },
      cycles: { view: true, create: true, edit: true, delete: false },
      billingSetup: { view: true, create: true, edit: true, delete: false },
    },
  };
  schema.studios = {
    enabled: true,
    features: {
      publicPortals: { view: false },
      landingPages: { view: false },
      media: { view: false },
      surveys: { view: false },
      messaging: { view: false },
      forms: { view: false },
      tags: { view: false },
      docSigning: { view: true, create: true, edit: true, delete: true },
      qrStudio: { view: false },
      verifyStudio: { view: false },
      socialIntelligence: { view: false },
    },
  };
  schema.operations = {
    enabled: true,
    features: {
      dashboard: { view: true },
      campuses: { view: true, create: false, edit: false, delete: false },
      pipeline: { view: false },
      tasks: { view: true, create: true, edit: true, delete: false },
      meetings: { view: false },
      automations: { view: false },
      intelligence: { view: true },
      quickNotes: { view: false },
    },
  };
  return normalizePermissionsSchema(schema);
}

// ─────────────────────────────────────────────────────────────
// 2. Helper factory to construct standard PlatformTemplate records
// ─────────────────────────────────────────────────────────────

function createRoleTemplate(
  id: string,
  name: string,
  description: string,
  category: string,
  content: PermissionsSchema,
  industryTarget?: IndustryVertical,
  defaultForNewOrgs = false
): PlatformTemplate {
  const timestamp = '2026-01-01T00:00:00.000Z';
  return {
    id,
    name,
    description,
    category,
    type: 'role_architecture',
    scope: 'system',
    status: 'published',
    version: 1,
    versionHistory: [
      {
        version: 1,
        content,
        publishedAt: timestamp,
        publishedBy: 'system',
        changelog: 'Initial canonical vertical preset release.',
      },
    ],
    defaultForNewOrgs,
    visibilityRules: {
      orgIds: [],
      workspaceTypes: industryTarget ? [industryTarget, 'all'] : ['all'],
    },
    content: normalizePermissionsSchema(content),
    usageCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    updatedBy: 'system',
  };
}

// ─────────────────────────────────────────────────────────────
// 3. Canonical Master Dictionary of 22 Platform Blueprints
// ─────────────────────────────────────────────────────────────

export const CANONICAL_ROLE_BLUEPRINTS: PlatformTemplate[] = [
  // Universal / Executive (4 roles)
  createRoleTemplate(
    'builtin-super-admin',
    'Super Admin (All Access)',
    'Complete unrestricted access across all operational, financial, studio, and management silos.',
    'Universal',
    getFullAdminPermissions(),
    undefined,
    true
  ),
  createRoleTemplate(
    'builtin-operations-lead',
    'Operations Lead',
    'Full oversight of daily operations, entity pipeline, daily tasks, and team meetings.',
    'Universal',
    getOperationsPermissions()
  ),
  createRoleTemplate(
    'builtin-finance-officer',
    'Finance Officer',
    'Manages contracts, customer agreements, invoices, package tiers, and billing cycles.',
    'Universal',
    getFinancePermissions()
  ),
  createRoleTemplate(
    'builtin-studio-manager',
    'Studio & Marketing Lead',
    'Full management of landing pages, public portals, media assets, messaging, forms, and surveys.',
    'Universal',
    getMarketingPermissions()
  ),

  // SaaS (3 roles)
  createRoleTemplate(
    'role-saas-customer-success',
    'Customer Success Lead',
    'Manages subscriber onboarding, account health scorecards, daily tasks, and intelligence reports.',
    'SaaS',
    getSaaSCustomerSuccessPermissions(),
    'SaaS'
  ),
  createRoleTemplate(
    'role-saas-sales-growth',
    'Sales & Growth Executive',
    'Full management of subscription trial pipelines, automations, public portals, and outreach.',
    'SaaS',
    getSaaSSalesExecutivePermissions(),
    'SaaS'
  ),
  createRoleTemplate(
    'role-saas-billing-specialist',
    'SaaS Billing Specialist',
    'Oversees subscription invoices, package pricing tiers, recurring billing cycles, and gateway setup.',
    'SaaS',
    getSaaSBillingSpecialistPermissions(),
    'SaaS'
  ),

  // School Admissions (3 roles)
  createRoleTemplate(
    'role-school-admissions-officer',
    'Admissions Officer',
    'Manages student enrollment pipeline, school tour schedules, application forms, and parent surveys.',
    'SchoolEnrollment',
    getSchoolAdmissionsOfficerPermissions(),
    'SchoolEnrollment'
  ),
  createRoleTemplate(
    'role-school-academic-registrar',
    'Academic Registrar',
    'Oversees student records, school portal publications, document signing, and parent communications.',
    'SchoolEnrollment',
    getSchoolRegistrarPermissions(),
    'SchoolEnrollment'
  ),
  createRoleTemplate(
    'role-school-bursar',
    'School Bursar / Finance Lead',
    'Full control over tuition fee agreements, student billing, package tiers, and payment receipts.',
    'SchoolEnrollment',
    getSchoolBursarPermissions(),
    'SchoolEnrollment'
  ),

  // Marketing Agency (3 roles)
  createRoleTemplate(
    'role-mktg-creative-director',
    'Creative & Campaign Director',
    'Full authority over client landing pages, brand media assets, public portals, social intelligence, and forms.',
    'Marketing',
    getMarketingCreativeDirectorPermissions(),
    'Marketing'
  ),
  createRoleTemplate(
    'role-mktg-account-executive',
    'Agency Account Executive',
    'Oversees client proposal pipelines, retainer agreements, client deliverables, and account reporting.',
    'Marketing',
    getMarketingAccountExecutivePermissions(),
    'Marketing'
  ),
  createRoleTemplate(
    'role-mktg-analytics-lead',
    'Growth & Analytics Lead',
    'Monitors campaign performance metrics, social intelligence signals, client surveys, and analytics dashboards.',
    'Marketing',
    getMarketingAnalyticsLeadPermissions(),
    'Marketing'
  ),

  // Law Practice (3 roles)
  createRoleTemplate(
    'role-law-managing-partner',
    'Managing Partner / Lead Attorney',
    'Comprehensive legal matter oversight, client retainer agreements, contract signing, and practice governance.',
    'Law',
    getLawManagingPartnerPermissions(),
    'Law'
  ),
  createRoleTemplate(
    'role-law-paralegal-intake',
    'Paralegal & Intake Coordinator',
    'Coordinates case intake pipelines, court tasks, consultation schedules, and legal document preparation.',
    'Law',
    getLawParalegalPermissions(),
    'Law'
  ),
  createRoleTemplate(
    'role-law-billing-clerk',
    'Legal Billing Clerk',
    'Manages matter billing, retainer fee invoices, hourly rate packages, and trust accounting setup.',
    'Law',
    getLawBillingClerkPermissions(),
    'Law'
  ),

  // Real Estate (3 roles)
  createRoleTemplate(
    'role-realestate-lead-broker',
    'Lead Broker / Real Estate Agent',
    'Manages property listings, deal pipeline, viewing meetings, offer document signing, and client portals.',
    'RealEstate',
    getRealEstateBrokerPermissions(),
    'RealEstate'
  ),
  createRoleTemplate(
    'role-realestate-marketing-specialist',
    'Property Marketing Specialist',
    'Builds property landing pages, curates media galleries, manages QR property signage, and social campaigns.',
    'RealEstate',
    getRealEstateMarketingSpecialistPermissions(),
    'RealEstate'
  ),
  createRoleTemplate(
    'role-realestate-escrow-coordinator',
    'Escrow & Transaction Coordinator',
    'Oversees purchase & sale agreements, commission billing, contract e-signatures, and closing checklists.',
    'RealEstate',
    getRealEstateEscrowCoordinatorPermissions(),
    'RealEstate'
  ),

  // Consultancy (3 roles)
  createRoleTemplate(
    'role-consultancy-engagement-principal',
    'Engagement Principal / Lead Consultant',
    'Oversees client project delivery, discovery pipeline, project milestone meetings, and statements of work.',
    'Consultancy',
    getConsultancyPrincipalPermissions(),
    'Consultancy'
  ),
  createRoleTemplate(
    'role-consultancy-operations-specialist',
    'Client Operations Specialist',
    'Coordinates project deliverables, client intake forms, feedback surveys, messaging, and quick notes.',
    'Consultancy',
    getConsultancyOperationsSpecialistPermissions(),
    'Consultancy'
  ),
  createRoleTemplate(
    'role-consultancy-contracts-officer',
    'Contracts & Invoicing Officer',
    'Full control over master service agreements, milestone invoices, retainer packages, and contract signing.',
    'Consultancy',
    getConsultancyContractsOfficerPermissions(),
    'Consultancy'
  ),
];

// ─────────────────────────────────────────────────────────────
// 4. Industry Grouping & Sorting Utilities
// ─────────────────────────────────────────────────────────────

export interface GroupedBlueprints {
  recommended: PlatformTemplate[];
  universal: PlatformTemplate[];
  otherVerticals: { category: string; blueprints: PlatformTemplate[] }[];
}

/**
 * Partitions and orders role blueprints based on the active organization's industry vertical.
 */
export function groupBlueprintsByIndustry(
  blueprints: PlatformTemplate[],
  activeIndustry?: string
): GroupedBlueprints {
  const recommended: PlatformTemplate[] = [];
  const universal: PlatformTemplate[] = [];
  const otherMap = new Map<string, PlatformTemplate[]>();

  for (const blueprint of blueprints) {
    if (blueprint.category === 'Universal' || !blueprint.category) {
      universal.push(blueprint);
      continue;
    }

    const isMatch = activeIndustry && (
      blueprint.category.toLowerCase() === activeIndustry.toLowerCase() ||
      blueprint.visibilityRules?.workspaceTypes?.includes(activeIndustry)
    );

    if (isMatch) {
      recommended.push(blueprint);
    } else {
      const cat = blueprint.category;
      if (!otherMap.has(cat)) {
        otherMap.set(cat, []);
      }
      otherMap.get(cat)!.push(blueprint);
    }
  }

  const otherVerticals = Array.from(otherMap.entries()).map(([category, list]) => ({
    category,
    blueprints: list,
  }));

  return {
    recommended,
    universal,
    otherVerticals,
  };
}
