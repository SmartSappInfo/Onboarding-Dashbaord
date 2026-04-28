/**
 * Feature Flags for Phased Industry Rollout
 *
 * Controls which industry verticals are enabled in the application.
 * SaaS is always enabled (current production system).
 * All other industries are gated behind NEXT_PUBLIC_* environment variables.
 *
 * Requirements: 1.6, 15.9
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Required Environment Variables
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * NEXT_PUBLIC_INDUSTRY_MARKETING_ENABLED=true
 *   Enables the Marketing Agency industry vertical.
 *   Priority 2 in the rollout order.
 *
 * NEXT_PUBLIC_INDUSTRY_SCHOOL_ENROLLMENT_ENABLED=true
 *   Enables the School Enrollment industry vertical.
 *   Priority 3 in the rollout order.
 *
 * NEXT_PUBLIC_INDUSTRY_CONSULTANCY_ENABLED=true
 *   Enables the Consultancy industry vertical.
 *   Priority 4 in the rollout order.
 *
 * NEXT_PUBLIC_INDUSTRY_REAL_ESTATE_ENABLED=true
 *   Enables the Real Estate industry vertical.
 *   Priority 5 in the rollout order.
 *
 * NEXT_PUBLIC_INDUSTRY_LAW_ENABLED=true
 *   Enables the Law Firm industry vertical.
 *   Priority 6 in the rollout order.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Usage Example (.env.local)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * # Enable Marketing and School Enrollment for Phase 2 rollout
 * NEXT_PUBLIC_INDUSTRY_MARKETING_ENABLED=true
 * NEXT_PUBLIC_INDUSTRY_SCHOOL_ENROLLMENT_ENABLED=true
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { IndustryVertical } from '@/lib/types';

/**
 * Feature flag constants for each industry vertical.
 *
 * SaaS is always `true` — it represents the current production system.
 * All other verticals are driven by NEXT_PUBLIC_* env vars, defaulting to
 * `false` when the variable is absent or set to any value other than "true".
 */
export const INDUSTRY_FEATURE_FLAGS: Record<IndustryVertical, boolean> = {
  // Priority 1: Always enabled — current production system
  SaaS: true,

  // Priority 2: Marketing Agency CRM
  Marketing: process.env.NEXT_PUBLIC_INDUSTRY_MARKETING_ENABLED === 'true',

  // Priority 3: School Enrollment / Admissions management
  SchoolEnrollment: process.env.NEXT_PUBLIC_INDUSTRY_SCHOOL_ENROLLMENT_ENABLED === 'true',

  // Priority 4: Consultancy engagement tracking
  Consultancy: process.env.NEXT_PUBLIC_INDUSTRY_CONSULTANCY_ENABLED === 'true',

  // Priority 5: Real Estate property and transaction management
  RealEstate: process.env.NEXT_PUBLIC_INDUSTRY_REAL_ESTATE_ENABLED === 'true',

  // Priority 6: Law Firm practice management
  Law: process.env.NEXT_PUBLIC_INDUSTRY_LAW_ENABLED === 'true',
} as const;

/**
 * Returns the list of currently enabled industry verticals, in rollout
 * priority order (SaaS first, Law last).
 *
 * Used by the industry configuration registry and workspace creation UI to
 * show only the verticals that are active in the current environment.
 *
 * @returns Array of enabled IndustryVertical values
 *
 * @example
 * const enabled = getEnabledIndustries();
 * // In production with only SaaS enabled: ['SaaS']
 * // With Marketing flag on: ['SaaS', 'Marketing']
 */
export function getEnabledIndustries(): IndustryVertical[] {
  // Preserve rollout priority order
  const orderedVerticals: IndustryVertical[] = [
    'SaaS',
    'Marketing',
    'SchoolEnrollment',
    'Consultancy',
    'RealEstate',
    'Law',
  ];

  return orderedVerticals.filter((industry) => INDUSTRY_FEATURE_FLAGS[industry]);
}

/**
 * Returns whether a specific industry vertical is currently enabled.
 *
 * @param industry - The IndustryVertical to check
 * @returns `true` if the industry is enabled, `false` otherwise
 *
 * @example
 * if (isIndustryEnabled('Marketing')) {
 *   // show Marketing workspace option
 * }
 */
export function isIndustryEnabled(industry: IndustryVertical): boolean {
  return INDUSTRY_FEATURE_FLAGS[industry] === true;
}
