/**
 * @fileOverview Unit tests for feature gate system
 * 
 * Tests Requirements:
 * - 15.7: Hide features not applicable to Workspace Industry_Vertical
 * - 15.8: Validate feature access based on Workspace Industry_Vertical
 * - 15.9: Support feature toggles at Organization and Workspace levels
 * 
 * Design Property 8: Feature gate enforcement
 */

import { describe, it, expect } from 'vitest';
import {
  isFeatureEnabled,
  getEnabledFeatures,
  areAllFeaturesEnabled,
  isAnyFeatureEnabled,
  getFeatureGateConfig,
} from '@/lib/feature-gate';

describe('feature-gate', () => {
  describe('isFeatureEnabled', () => {
    it('should return true for SaaS-specific features in SaaS industry', () => {
      expect(isFeatureEnabled('trials', 'SaaS')).toBe(true);
      expect(isFeatureEnabled('onboarding', 'SaaS')).toBe(true);
      expect(isFeatureEnabled('subscriptions', 'SaaS')).toBe(true);
      expect(isFeatureEnabled('healthScores', 'SaaS')).toBe(true);
      expect(isFeatureEnabled('supportTickets', 'SaaS')).toBe(true);
    });

    it('should return false for non-SaaS features in SaaS industry', () => {
      expect(isFeatureEnabled('applications', 'SaaS')).toBe(false);
      expect(isFeatureEnabled('matters', 'SaaS')).toBe(false);
      expect(isFeatureEnabled('campaigns', 'SaaS')).toBe(false);
      expect(isFeatureEnabled('properties', 'SaaS')).toBe(false);
      expect(isFeatureEnabled('engagements', 'SaaS')).toBe(false);
    });

    it('should return true for SchoolEnrollment-specific features', () => {
      expect(isFeatureEnabled('applications', 'SchoolEnrollment')).toBe(true);
      expect(isFeatureEnabled('enrollments', 'SchoolEnrollment')).toBe(true);
      expect(isFeatureEnabled('schoolVisits', 'SchoolEnrollment')).toBe(true);
    });

    it('should return false for SaaS features in SchoolEnrollment industry', () => {
      expect(isFeatureEnabled('trials', 'SchoolEnrollment')).toBe(false);
      expect(isFeatureEnabled('subscriptions', 'SchoolEnrollment')).toBe(false);
    });

    it('should return true for Law-specific features', () => {
      expect(isFeatureEnabled('matters', 'Law')).toBe(true);
      expect(isFeatureEnabled('conflictChecks', 'Law')).toBe(true);
      expect(isFeatureEnabled('timeTracking', 'Law')).toBe(true);
      expect(isFeatureEnabled('courtDates', 'Law')).toBe(true);
    });

    it('should return true for Marketing-specific features', () => {
      expect(isFeatureEnabled('campaigns', 'Marketing')).toBe(true);
      expect(isFeatureEnabled('proposals', 'Marketing')).toBe(true);
      expect(isFeatureEnabled('deliverables', 'Marketing')).toBe(true);
      expect(isFeatureEnabled('performanceMetrics', 'Marketing')).toBe(true);
      expect(isFeatureEnabled('clientReports', 'Marketing')).toBe(true);
    });

    it('should return true for RealEstate-specific features', () => {
      expect(isFeatureEnabled('properties', 'RealEstate')).toBe(true);
      expect(isFeatureEnabled('viewings', 'RealEstate')).toBe(true);
      expect(isFeatureEnabled('offers', 'RealEstate')).toBe(true);
      expect(isFeatureEnabled('negotiations', 'RealEstate')).toBe(true);
      expect(isFeatureEnabled('deals', 'RealEstate')).toBe(true);
    });

    it('should return true for Consultancy-specific features', () => {
      expect(isFeatureEnabled('engagements', 'Consultancy')).toBe(true);
      expect(isFeatureEnabled('discoveries', 'Consultancy')).toBe(true);
      expect(isFeatureEnabled('milestones', 'Consultancy')).toBe(true);
      expect(isFeatureEnabled('outcomes', 'Consultancy')).toBe(true);
      expect(isFeatureEnabled('retainers', 'Consultancy')).toBe(true);
    });

    it('should return false for unknown industry', () => {
      // @ts-expect-error Testing invalid industry
      expect(isFeatureEnabled('trials', 'UnknownIndustry')).toBe(false);
    });
  });

  describe('getEnabledFeatures', () => {
    it('should return all enabled features for SaaS industry', () => {
      const features = getEnabledFeatures('SaaS');
      
      expect(features).toContain('trials');
      expect(features).toContain('onboarding');
      expect(features).toContain('subscriptions');
      expect(features).toContain('healthScores');
      expect(features).toContain('supportTickets');
      
      expect(features).not.toContain('applications');
      expect(features).not.toContain('matters');
    });

    it('should return all enabled features for SchoolEnrollment industry', () => {
      const features = getEnabledFeatures('SchoolEnrollment');
      
      expect(features).toContain('applications');
      expect(features).toContain('enrollments');
      expect(features).toContain('schoolVisits');
      
      expect(features).not.toContain('trials');
      expect(features).not.toContain('matters');
    });

    it('should return empty array for unknown industry', () => {
      // @ts-expect-error Testing invalid industry
      const features = getEnabledFeatures('UnknownIndustry');
      expect(features).toEqual([]);
    });
  });

  describe('areAllFeaturesEnabled', () => {
    it('should return true when all features are enabled', () => {
      expect(areAllFeaturesEnabled(['trials', 'subscriptions'], 'SaaS')).toBe(true);
      expect(areAllFeaturesEnabled(['applications', 'enrollments'], 'SchoolEnrollment')).toBe(true);
    });

    it('should return false when any feature is disabled', () => {
      expect(areAllFeaturesEnabled(['trials', 'matters'], 'SaaS')).toBe(false);
      expect(areAllFeaturesEnabled(['applications', 'trials'], 'SchoolEnrollment')).toBe(false);
    });

    it('should return true for empty array', () => {
      expect(areAllFeaturesEnabled([], 'SaaS')).toBe(true);
    });
  });

  describe('isAnyFeatureEnabled', () => {
    it('should return true when at least one feature is enabled', () => {
      expect(isAnyFeatureEnabled(['trials', 'matters'], 'SaaS')).toBe(true);
      expect(isAnyFeatureEnabled(['applications', 'trials'], 'SchoolEnrollment')).toBe(true);
    });

    it('should return false when all features are disabled', () => {
      expect(isAnyFeatureEnabled(['matters', 'campaigns'], 'SaaS')).toBe(false);
      expect(isAnyFeatureEnabled(['trials', 'subscriptions'], 'SchoolEnrollment')).toBe(false);
    });

    it('should return false for empty array', () => {
      expect(isAnyFeatureEnabled([], 'SaaS')).toBe(false);
    });
  });

  describe('getFeatureGateConfig', () => {
    it('should return complete feature gate config for SaaS', () => {
      const config = getFeatureGateConfig('SaaS');
      
      expect(config.trials).toBe(true);
      expect(config.onboarding).toBe(true);
      expect(config.subscriptions).toBe(true);
      expect(config.applications).toBe(false);
      expect(config.matters).toBe(false);
    });

    it('should return complete feature gate config for SchoolEnrollment', () => {
      const config = getFeatureGateConfig('SchoolEnrollment');
      
      expect(config.applications).toBe(true);
      expect(config.enrollments).toBe(true);
      expect(config.trials).toBe(false);
      expect(config.matters).toBe(false);
    });

    it('should return all-disabled config for unknown industry', () => {
      // @ts-expect-error Testing invalid industry
      const config = getFeatureGateConfig('UnknownIndustry');
      
      const allDisabled = Object.values(config).every((value) => value === false);
      expect(allDisabled).toBe(true);
    });
  });

  describe('Design Property 8: Feature gate enforcement', () => {
    it('should enforce that features absent from INDUSTRY_CONFIG return false', () => {
      // SaaS should not have School Enrollment features
      expect(isFeatureEnabled('applications', 'SaaS')).toBe(false);
      expect(isFeatureEnabled('enrollments', 'SaaS')).toBe(false);
      
      // SchoolEnrollment should not have SaaS features
      expect(isFeatureEnabled('trials', 'SchoolEnrollment')).toBe(false);
      expect(isFeatureEnabled('subscriptions', 'SchoolEnrollment')).toBe(false);
      
      // Law should not have Marketing features
      expect(isFeatureEnabled('campaigns', 'Law')).toBe(false);
      expect(isFeatureEnabled('deliverables', 'Law')).toBe(false);
      
      // Marketing should not have Real Estate features
      expect(isFeatureEnabled('properties', 'Marketing')).toBe(false);
      expect(isFeatureEnabled('viewings', 'Marketing')).toBe(false);
      
      // RealEstate should not have Consultancy features
      expect(isFeatureEnabled('engagements', 'RealEstate')).toBe(false);
      expect(isFeatureEnabled('discoveries', 'RealEstate')).toBe(false);
      
      // Consultancy should not have Law features
      expect(isFeatureEnabled('matters', 'Consultancy')).toBe(false);
      expect(isFeatureEnabled('conflictChecks', 'Consultancy')).toBe(false);
    });
  });
});
