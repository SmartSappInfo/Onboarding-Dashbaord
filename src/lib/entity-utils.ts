/**
 * @fileOverview Pure synchronous entity utility functions.
 *
 * IMPORTANT: This file must NOT contain a 'use server' directive. It is a shared
 * utility module imported by both server actions (entity-actions.ts) and test files.
 * All exports are plain synchronous functions — keep it that way.
 */

import type { IndustryVertical, EntityType } from './types';

/**
 * Applies safe default values to industryData based on the workspace's
 * industry vertical and the entity type being created/updated.
 *
 * This is a pure function — no side effects, no async I/O.
 */
export function applyIndustryDataDefaults(
  industryData: any,
  industry: IndustryVertical,
  entityType: EntityType
): any {
  if (!industryData) return industryData;
  const result = { ...industryData };

  if (industry === 'SaaS') {
    if (entityType === 'institution') {
      if (result.capacity === undefined || result.capacity === null) result.capacity = 0;
      // accountStatus intentionally NOT defaulted — lifecycleStatus is authoritative
      if (!result.trialIds) result.trialIds = [];
      if (!result.onboardingIds) result.onboardingIds = [];
      if (!result.supportTicketIds) result.supportTicketIds = [];
      if (!result.healthScoreIds) result.healthScoreIds = [];
    } else if (entityType === 'person') {
      if (!result.role) result.role = 'user';
      if (!result.activationStatus) result.activationStatus = 'pending';
    }
  } else if (industry === 'SchoolEnrollment') {
    if (entityType === 'institution') {
      if (!result.gradeOfferings) result.gradeOfferings = [];
      if (!result.academicYear) result.academicYear = 'N/A';
      if (result.capacity === undefined || result.capacity === null) result.capacity = 0;
    }
  } else if (industry === 'Law') {
    if (entityType === 'institution') {
      if (!result.firmType) result.firmType = 'solo';
      if (!result.practiceAreas) result.practiceAreas = [];
      if (result.conflictCheckRequired === undefined) result.conflictCheckRequired = false;
    } else if (entityType === 'person') {
      if (!result.clientType) result.clientType = 'individual';
      if (!result.urgency) result.urgency = 'low';
    }
  } else if (industry === 'Marketing') {
    if (entityType === 'institution') {
      if (!result.clientIndustry) result.clientIndustry = 'N/A';
    } else if (entityType === 'person') {
      if (!result.role) result.role = 'User';
      if (!result.influenceLevel) result.influenceLevel = 'user';
      if (result.approvalAuthority === undefined) result.approvalAuthority = false;
    }
  } else if (industry === 'RealEstate') {
    if (entityType === 'institution') {
      if (!result.developerType) result.developerType = 'residential';
    } else if (entityType === 'person') {
      if (!result.clientType) result.clientType = 'buyer';
    }
  } else if (industry === 'Consultancy') {
    if (entityType === 'institution') {
      if (!result.clientIndustry) result.clientIndustry = 'N/A';
    } else if (entityType === 'person') {
      if (!result.role) result.role = 'User';
      if (!result.influenceLevel) result.influenceLevel = 'user';
    }
  }

  return result;
}
