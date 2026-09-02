/**
 * @fileOverview Canonical Department Seed Service (Workforce 2.0)
 *
 * Provides industry-tailored seed department blueprints and automated provisioning
 * for new organizations and backfilling existing organizations with 0 departments.
 *
 * ARCHITECTURAL RULES & DESIGN:
 * - Each IndustryVertical ('SaaS' | 'SchoolEnrollment' | 'Law' | 'Marketing' | 'RealEstate' | 'Consultancy' | 'General')
 *   defines a standard set of core operational units.
 * - Idempotent: If an organization already has at least one department, seeding is SKIPPED.
 * - Conforms strictly to zero `any` or `any[]` policy.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { Department, IndustryVertical, Organization, Workspace } from '@/lib/types';

export interface SeedDepartmentTemplate {
  name: string;
  code: string;
  description: string;
}

export const INDUSTRY_SEED_DEPARTMENTS: Record<IndustryVertical | 'General', SeedDepartmentTemplate[]> = {
  SaaS: [
    {
      name: 'Engineering',
      code: 'ENG',
      description: 'Software engineering, platform architecture, and DevOps infrastructure.',
    },
    {
      name: 'Product Management',
      code: 'PROD',
      description: 'Product discovery, roadmapping, UX design, and feature delivery.',
    },
    {
      name: 'Sales & Business Development',
      code: 'SALES',
      description: 'Outbound sales, enterprise accounts, and pipeline generation.',
    },
    {
      name: 'Customer Success & Support',
      code: 'CS',
      description: 'Customer onboarding, account management, and technical support.',
    },
    {
      name: 'Marketing & Growth',
      code: 'MKTG',
      description: 'Demand generation, product marketing, brand positioning, and content.',
    },
    {
      name: 'Finance & People Operations',
      code: 'OPS',
      description: 'Accounting, legal compliance, talent acquisition, and workplace operations.',
    },
  ],

  SchoolEnrollment: [
    {
      name: 'Admissions & Recruitment',
      code: 'ADM',
      description: 'Student enrollment, campus tours, open days, and prospect conversion.',
    },
    {
      name: 'Academic Affairs & Faculty',
      code: 'ACAD',
      description: 'Curriculum delivery, faculty supervision, instruction, and student learning.',
    },
    {
      name: 'Student Affairs & Welfare',
      code: 'STU',
      description: 'Counseling, extracurricular activities, student life, and pastoral care.',
    },
    {
      name: 'Administration & Registry',
      code: 'REG',
      description: 'Student records, certification, scheduling, and compliance.',
    },
    {
      name: 'Finance & Bursary',
      code: 'FIN',
      description: 'Tuition billing, financial aid, payroll, and institutional budget.',
    },
    {
      name: 'Campus Operations & Facilities',
      code: 'OPS',
      description: 'Campus maintenance, security, IT systems, and logistics.',
    },
  ],

  Law: [
    {
      name: 'Litigation & Dispute Resolution',
      code: 'LIT',
      description: 'Court proceedings, trial advocacy, mediation, and arbitration.',
    },
    {
      name: 'Corporate & Commercial Law',
      code: 'CORP',
      description: 'M&A, contracts, entity governance, and commercial advisory.',
    },
    {
      name: 'Client Intake & Case Management',
      code: 'INTK',
      description: 'New matter intake, conflict checks, and case administration.',
    },
    {
      name: 'Legal Research & Paralegal',
      code: 'RSRCH',
      description: 'Statutory analysis, brief preparation, filings, and discovery.',
    },
    {
      name: 'Finance & Trust Accounting',
      code: 'FIN',
      description: 'Trust accounting, client billing, retainer management, and disbursements.',
    },
    {
      name: 'Firm Administration & Operations',
      code: 'OPS',
      description: 'Practice management, facilities, human resources, and compliance.',
    },
  ],

  Marketing: [
    {
      name: 'Client Accounts & Strategy',
      code: 'ACCT',
      description: 'Client relationship management, campaign briefs, and account growth.',
    },
    {
      name: 'Creative & Content Production',
      code: 'CRTV',
      description: 'Brand identity, graphic design, copywriting, and multimedia production.',
    },
    {
      name: 'Media Buying & Performance',
      code: 'MEDIA',
      description: 'Paid advertising, PPC, social ad campaigns, and SEO/SEM optimization.',
    },
    {
      name: 'Social Media & Influencers',
      code: 'SOC',
      description: 'Channel management, influencer outreach, and community engagement.',
    },
    {
      name: 'Analytics & Data Insights',
      code: 'DATA',
      description: 'Campaign reporting, conversion attribution, and ROI analytics.',
    },
    {
      name: 'Agency Operations & Traffic',
      code: 'OPS',
      description: 'Project management, resourcing, vendor relations, and billing.',
    },
  ],

  RealEstate: [
    {
      name: 'Sales & Brokerage',
      code: 'SALES',
      description: 'Property listings, buyer representation, and deal closing.',
    },
    {
      name: 'Property & Leasing Management',
      code: 'LEAS',
      description: 'Tenant relations, lease agreements, inspections, and renewals.',
    },
    {
      name: 'Acquisitions & Development',
      code: 'ACQ',
      description: 'Land acquisition, market feasibility, zoning, and project underwriting.',
    },
    {
      name: 'Facilities & Maintenance',
      code: 'MAINT',
      description: 'Property repairs, contractor management, and site inspections.',
    },
    {
      name: 'Marketing & Showings',
      code: 'MKTG',
      description: 'Virtual tours, open houses, digital property listings, and staging.',
    },
    {
      name: 'Escrow & Closing Operations',
      code: 'ESC',
      description: 'Escrow coordination, commission processing, and trust accounting.',
    },
  ],

  Consultancy: [
    {
      name: 'Management Advisory & Strategy',
      code: 'STRAT',
      description: 'Executive consulting, corporate strategy, and organizational transformation.',
    },
    {
      name: 'Client Engagements & Delivery',
      code: 'ENG',
      description: 'Project delivery, client workstreams, deliverables, and implementation.',
    },
    {
      name: 'Business Development & Proposals',
      code: 'BIZDEV',
      description: 'RFP responses, pipeline qualification, and proposal presentations.',
    },
    {
      name: 'Research & Benchmarking',
      code: 'RSRCH',
      description: 'Industry benchmarking, qualitative surveys, and macroeconomic research.',
    },
    {
      name: 'Finance & Project Accounting',
      code: 'FIN',
      description: 'Engagement billing, expense tracking, and time tracking audit.',
    },
    {
      name: 'People & Practice Operations',
      code: 'OPS',
      description: 'Consultant staffing, professional development, and practice administration.',
    },
  ],

  General: [
    {
      name: 'Executive & Strategy',
      code: 'EXEC',
      description: 'Executive steering, strategic direction, and organizational governance.',
    },
    {
      name: 'Sales & Commercial',
      code: 'SALES',
      description: 'Revenue generation, sales pipeline, and business relationships.',
    },
    {
      name: 'Customer Success & Support',
      code: 'CS',
      description: 'Client satisfaction, customer onboarding, and account support.',
    },
    {
      name: 'Marketing & Communications',
      code: 'MKTG',
      description: 'Brand presence, lead generation, and corporate communications.',
    },
    {
      name: 'Finance & Accounting',
      code: 'FIN',
      description: 'Budgeting, bookkeeping, treasury, and compliance.',
    },
    {
      name: 'Operations & Human Resources',
      code: 'OPS',
      description: 'Talent management, workplace culture, and operational administration.',
    },
  ],
};

export interface SeedResult {
  success: boolean;
  count: number;
  departments: Department[];
  skipped?: boolean;
  reason?: string;
  vertical?: string;
}

export interface BackfillSummary {
  totalOrgs: number;
  backfilledCount: number;
  skippedCount: number;
  details: Array<{
    orgId: string;
    name: string;
    vertical: string;
    action: 'seeded' | 'skipped';
    departmentCount: number;
  }>;
}

export class DepartmentSeedService {
  /**
   * Retrieves seed department templates for a specific vertical.
   */
  static getSeedDepartments(vertical?: string | null): SeedDepartmentTemplate[] {
    if (!vertical) return INDUSTRY_SEED_DEPARTMENTS.General;
    
    // Exact or normalized match
    const normalized = Object.keys(INDUSTRY_SEED_DEPARTMENTS).find(
      (k) => k.toLowerCase() === vertical.toLowerCase().trim()
    ) as IndustryVertical | 'General' | undefined;

    return normalized ? INDUSTRY_SEED_DEPARTMENTS[normalized] : INDUSTRY_SEED_DEPARTMENTS.General;
  }

  /**
   * Resolves the primary industry vertical for an organization by inspecting:
   * 1. Organization document `industry` property.
   * 2. First associated workspace `industry` property.
   * 3. Keyword matching on organization name/slug.
   * 4. Fallback to 'General'.
   */
  static async resolveOrganizationVertical(organizationId: string): Promise<IndustryVertical | 'General'> {
    if (!organizationId) return 'General';

    try {
      const orgSnap = await adminDb.collection('organizations').doc(organizationId).get();
      if (orgSnap.exists) {
        const orgData = orgSnap.data() as Organization | undefined;
        if (orgData?.industry && INDUSTRY_SEED_DEPARTMENTS[orgData.industry]) {
          return orgData.industry;
        }

        // Check workspace industries for this organization
        const wsSnap = await adminDb
          .collection('workspaces')
          .where('organizationId', '==', organizationId)
          .limit(10)
          .get();

        for (const doc of wsSnap.docs) {
          const ws = doc.data() as Workspace;
          if (ws.industry && INDUSTRY_SEED_DEPARTMENTS[ws.industry]) {
            // Backfill org.industry for fast future lookups
            await orgSnap.ref.update({ industry: ws.industry, updatedAt: new Date().toISOString() }).catch(() => {});
            return ws.industry;
          }
        }

        // Infer from organization name or slug keywords
        const text = `${orgData?.name || ''} ${orgData?.slug || ''} ${organizationId}`.toLowerCase();
        if (text.includes('school') || text.includes('enroll') || text.includes('academy') || text.includes('college') || text.includes('campus')) {
          return 'SchoolEnrollment';
        }
        if (text.includes('legal') || text.includes('law') || text.includes('attorney') || text.includes('chambers')) {
          return 'Law';
        }
        if (text.includes('estate') || text.includes('property') || text.includes('realty') || text.includes('palace') || text.includes('homes')) {
          return 'RealEstate';
        }
        if (text.includes('marketing') || text.includes('agency') || text.includes('media') || text.includes('attention') || text.includes('creative')) {
          return 'Marketing';
        }
        if (text.includes('saas') || text.includes('software') || text.includes('smartsapp') || text.includes('tech') || text.includes('app')) {
          return 'SaaS';
        }
        if (text.includes('consult') || text.includes('advisory') || text.includes('mining') || text.includes('partner')) {
          return 'Consultancy';
        }
      }
    } catch (err) {
      console.warn(`[DepartmentSeedService] Could not infer vertical for org ${organizationId}:`, err);
    }

    return 'General';
  }

  /**
   * Seeds departments for a specific organization.
   * SKIPS if the organization already has at least one department (unless force=true).
   */
  static async seedDepartmentsForOrganization(
    organizationId: string,
    vertical?: string | null,
    force: boolean = false
  ): Promise<SeedResult> {
    if (!organizationId) {
      throw new Error('Organization ID is required to seed departments.');
    }

    // 1. Check existing departments
    const existingSnap = await adminDb
      .collection('departments')
      .where('organizationId', '==', organizationId)
      .get();

    if (existingSnap.size > 0 && !force) {
      return {
        success: true,
        count: 0,
        departments: existingSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Department)),
        skipped: true,
        reason: `Organization already has ${existingSnap.size} department(s). Seeding skipped.`,
      };
    }

    // 2. Resolve Vertical & Templates
    const targetVertical = (vertical && INDUSTRY_SEED_DEPARTMENTS[vertical as IndustryVertical])
      ? (vertical as IndustryVertical)
      : await this.resolveOrganizationVertical(organizationId);

    const templates = this.getSeedDepartments(targetVertical);
    const now = new Date().toISOString();
    const batch = adminDb.batch();
    const createdDepartments: Department[] = [];

    for (const tmpl of templates) {
      const deptRef = adminDb.collection('departments').doc();
      const newDept: Department = {
        id: deptRef.id,
        organizationId,
        name: tmpl.name,
        code: tmpl.code,
        description: tmpl.description,
        memberCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      batch.set(deptRef, newDept);
      createdDepartments.push(newDept);
    }

    // Also update the organization record with the list of department names and industry
    const orgRef = adminDb.collection('organizations').doc(organizationId);
    batch.set(
      orgRef,
      {
        departments: templates.map((t) => t.name),
        industry: targetVertical,
        updatedAt: now,
      },
      { merge: true }
    );

    await batch.commit();

    return {
      success: true,
      count: createdDepartments.length,
      departments: createdDepartments,
      skipped: false,
      vertical: targetVertical,
    };
  }

  /**
   * Backfills all organizations in the system that currently do not have any department.
   * If an organization has >= 1 department, it is preserved and skipped.
   */
  static async backfillOrganizationsWithoutDepartments(): Promise<BackfillSummary> {
    const orgsSnap = await adminDb.collection('organizations').get();
    const totalOrgs = orgsSnap.size;
    let backfilledCount = 0;
    let skippedCount = 0;

    const details: BackfillSummary['details'] = [];

    for (const orgDoc of orgsSnap.docs) {
      const orgId = orgDoc.id;
      const orgData = orgDoc.data() as Organization;
      const orgName = orgData.name || orgId;

      // Check current department count
      const deptSnap = await adminDb
        .collection('departments')
        .where('organizationId', '==', orgId)
        .get();

      if (deptSnap.size > 0) {
        skippedCount++;
        details.push({
          orgId,
          name: orgName,
          vertical: orgData.industry || 'Unknown',
          action: 'skipped',
          departmentCount: deptSnap.size,
        });
      } else {
        // Resolve vertical & seed
        const res = await this.seedDepartmentsForOrganization(orgId, orgData.industry);
        backfilledCount++;
        details.push({
          orgId,
          name: orgName,
          vertical: res.vertical || 'General',
          action: 'seeded',
          departmentCount: res.count,
        });
      }
    }

    return {
      totalOrgs,
      backfilledCount,
      skippedCount,
      details,
    };
  }
}
