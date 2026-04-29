/**
 * @fileOverview Field Storage Utilities (Phase 6)
 * 
 * Centralizes the logic for determining where a dynamic field should be stored
 * on an Entity document based on its variableName and context.
 */

import { EntityType, IndustryVertical } from './types';

export type FieldBucket = 'root' | 'financeData' | 'industryData' | 'personData' | 'familyData' | 'customData';

/**
 * Maps a variableName to its appropriate storage bucket.
 * 
 * Logic Hierarchy:
 * 1. Root fields (Core identity)
 * 2. Finance fields (Billing/Subscription)
 * 3. Person/Family specific fields
 * 4. Industry-specific fields (Standard industry schemas)
 * 5. Custom fields (Fallback to customData)
 */
export function resolveFieldStorageBucket(
  variableName: string, 
  entityType: EntityType, 
  industry?: IndustryVertical
): FieldBucket {
  // 1. Root Fields (Common to all entities)
  const rootFields = [
    'name', 'slug', 'initials', 'logoUrl', 'referee', 
    'status', 'lifecycleStatus', 'location', 'locationString',
    'school_name', 'company_name', 'engagement_name', 'campaign_name', 'property_address'
  ];
  if (rootFields.includes(variableName)) return 'root';

  // 2. Finance Data
  const financeFields = [
    'currency', 'billingAddress', 'billing_address', 'subscriptionRate', 'subscription_rate',
    'arrears_balance', 'credit_balance', 'subscription_total', 'nominal_roll',
    'planType', 'plan_type', 'customerTier', 'customer_tier', 'billing_frequency', 'retainer_amount', 'hourly_rate',
    'total_fee', 'day_rate', 'listing_price', 'signup_date'
  ];
  if (financeFields.includes(variableName)) return 'financeData';

  // 3. Entity Type Specific
  if (entityType === 'person') {
    const personFields = ['first_name', 'last_name', 'job_title', 'company', 'lead_source', 'poc_role', 'client_role'];
    if (personFields.includes(variableName)) return 'personData';
  }

  if (entityType === 'family') {
    const familyFields = ['guardians', 'children', 'childFirstName', 'childLastName', 'childGradeLevel'];
    if (familyFields.includes(variableName)) return 'familyData';
  }

  // 4. Industry Data (Standard schemas)
  // These are often industry-specific capacity or status metrics
  const industryFields = [
    'capacity', 'activeUsers', 'accountStatus', 'account_status', 'employee_count', 'industry_sector',
    'case_number', 'matter_type', 'court_name', 'filing_deadline', 'judge_name',
    'leads_generated', 'target_cpa', 'total_budget', 'current_spend',
    'property_type', 'square_footage', 'year_built', 'mls_number', 'listing_status',
    'project_status', 'estimated_hours', 'deliverable_1'
  ];
  if (industryFields.includes(variableName)) return 'industryData';

  // 5. Fallback for custom fields
  return 'customData';
}
