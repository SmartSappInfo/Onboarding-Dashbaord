/**
 * @fileOverview Seed Department Templates and Constants
 *
 * Client-safe constants for industry seed department blueprints.
 * Does NOT import server-only packages (like firebase-admin or @google-cloud/firestore).
 */

import type { IndustryVertical } from '@/lib/types';

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

export const ALL_SEED_DEPARTMENT_NAMES: string[] = Array.from(
  new Set(
    Object.values(INDUSTRY_SEED_DEPARTMENTS).flatMap((templates) =>
      templates.map((t) => t.name)
    )
  )
);
