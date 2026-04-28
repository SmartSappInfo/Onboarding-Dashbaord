/**
 * Firestore Security Rules Tests: Industry-Specific Collections
 * 
 * Tests the security rules for industry-scoped collections:
 * - SaaS collections (trials, onboarding, subscriptions, supportTickets, healthScores)
 * - School Enrollment collections (applications, enrollments, schoolVisits)
 * - Law collections (matters, conflictChecks, timeTracking)
 * - Marketing collections (campaigns, deliverables)
 * - Real Estate collections (properties, viewings, offers)
 * - Consultancy collections (engagements, milestones)
 * 
 * Validates: Requirements 10.9, 16.8, Design Property 3
 * Tests that users can only access collections matching their workspace industry
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Industry-Specific Collection Security Rules', () => {
  let testEnv: RulesTestEnvironment;
  const PROJECT_ID = `test-industry-rules-${Date.now()}`;

  // Test user contexts
  const SUPER_ADMIN_UID = 'super-admin-user';
  const SAAS_USER_UID = 'saas-user';
  const SCHOOL_USER_UID = 'school-user';
  const LAW_USER_UID = 'law-user';
  const MARKETING_USER_UID = 'marketing-user';
  const REALESTATE_USER_UID = 'realestate-user';
  const CONSULTANCY_USER_UID = 'consultancy-user';
  
  const ORG_ID = 'org-1';
  const SAAS_WORKSPACE_ID = 'saas-workspace-1';
  const SCHOOL_WORKSPACE_ID = 'school-workspace-1';
  const LAW_WORKSPACE_ID = 'law-workspace-1';
  const MARKETING_WORKSPACE_ID = 'marketing-workspace-1';
  const REALESTATE_WORKSPACE_ID = 'realestate-workspace-1';
  const CONSULTANCY_WORKSPACE_ID = 'consultancy-workspace-1';

  beforeEach(async () => {
    // Load the actual firestore.rules file
    const rulesPath = resolve(__dirname, '../../../firestore.rules');
    const rules = readFileSync(rulesPath, 'utf8');

    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host: 'localhost',
        port: 8080,
      },
    });

    // Setup test users with different workspace access
    const adminContext = testEnv.authenticatedContext(SUPER_ADMIN_UID, {
      email: 'admin@smartsapp.com',
    });

    // Super admin
    await adminContext.firestore().collection('users').doc(SUPER_ADMIN_UID).set({
      isAuthorized: true,
      permissions: ['system_admin'],
      organizationId: ORG_ID,
      workspaceIds: [],
    });

    // SaaS workspace user
    await adminContext.firestore().collection('users').doc(SAAS_USER_UID).set({
      isAuthorized: true,
      permissions: ['saas_trials_manage', 'finance_manage'],
      organizationId: ORG_ID,
      workspaceIds: [SAAS_WORKSPACE_ID],
    });

    // School Enrollment workspace user
    await adminContext.firestore().collection('users').doc(SCHOOL_USER_UID).set({
      isAuthorized: true,
      permissions: ['schoolenrollment_admissions_manage'],
      organizationId: ORG_ID,
      workspaceIds: [SCHOOL_WORKSPACE_ID],
    });

    // Law workspace user
    await adminContext.firestore().collection('users').doc(LAW_USER_UID).set({
      isAuthorized: true,
      permissions: ['law_matters_manage', 'law_conflict_check'],
      organizationId: ORG_ID,
      workspaceIds: [LAW_WORKSPACE_ID],
    });

    // Marketing workspace user
    await adminContext.firestore().collection('users').doc(MARKETING_USER_UID).set({
      isAuthorized: true,
      permissions: ['marketing_campaigns_manage'],
      organizationId: ORG_ID,
      workspaceIds: [MARKETING_WORKSPACE_ID],
    });

    // Real Estate workspace user
    await adminContext.firestore().collection('users').doc(REALESTATE_USER_UID).set({
      isAuthorized: true,
      permissions: ['realestate_properties_manage', 'realestate_viewings_manage'],
      organizationId: ORG_ID,
      workspaceIds: [REALESTATE_WORKSPACE_ID],
    });

    // Consultancy workspace user
    await adminContext.firestore().collection('users').doc(CONSULTANCY_USER_UID).set({
      isAuthorized: true,
      permissions: ['consultancy_engagements_manage'],
      organizationId: ORG_ID,
      workspaceIds: [CONSULTANCY_WORKSPACE_ID],
    });

    // Setup workspaces with different industries
    await adminContext.firestore().collection('workspaces').doc(SAAS_WORKSPACE_ID).set({
      organizationId: ORG_ID,
      name: 'SaaS Workspace',
      industry: 'SaaS',
      industryScopeLocked: true,
      status: 'active',
    });

    await adminContext.firestore().collection('workspaces').doc(SCHOOL_WORKSPACE_ID).set({
      organizationId: ORG_ID,
      name: 'School Enrollment Workspace',
      industry: 'SchoolEnrollment',
      industryScopeLocked: true,
      status: 'active',
    });

    await adminContext.firestore().collection('workspaces').doc(LAW_WORKSPACE_ID).set({
      organizationId: ORG_ID,
      name: 'Law Workspace',
      industry: 'Law',
      industryScopeLocked: true,
      status: 'active',
    });

    await adminContext.firestore().collection('workspaces').doc(MARKETING_WORKSPACE_ID).set({
      organizationId: ORG_ID,
      name: 'Marketing Workspace',
      industry: 'Marketing',
      industryScopeLocked: true,
      status: 'active',
    });

    await adminContext.firestore().collection('workspaces').doc(REALESTATE_WORKSPACE_ID).set({
      organizationId: ORG_ID,
      name: 'Real Estate Workspace',
      industry: 'RealEstate',
      industryScopeLocked: true,
      status: 'active',
    });

    await adminContext.firestore().collection('workspaces').doc(CONSULTANCY_WORKSPACE_ID).set({
      organizationId: ORG_ID,
      name: 'Consultancy Workspace',
      industry: 'Consultancy',
      industryScopeLocked: true,
      status: 'active',
    });
  });

  afterEach(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  describe('SaaS Industry Collections', () => {
    describe('trials collection', () => {
      const trialId = 'trial-1';
      const trial = {
        organizationId: ORG_ID,
        workspaceId: SAAS_WORKSPACE_ID,
        entityId: 'entity-1',
        trialStartDate: new Date().toISOString(),
        trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        trialStatus: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      it('should allow SaaS workspace user to create trial', async () => {
        const saasUserDb = testEnv.authenticatedContext(SAAS_USER_UID).firestore();
        await assertSucceeds(
          setDoc(doc(saasUserDb, 'trials', trialId), trial)
        );
      });

      it('should allow SaaS workspace user to read trial', async () => {
        // Setup
        const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
        await setDoc(doc(superAdminDb, 'trials', trialId), trial);

        // Test
        const saasUserDb = testEnv.authenticatedContext(SAAS_USER_UID).firestore();
        await assertSucceeds(
          getDoc(doc(saasUserDb, 'trials', trialId))
        );
      });

      it('should deny SchoolEnrollment workspace user from reading SaaS trial', async () => {
        // Setup
        const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
        await setDoc(doc(superAdminDb, 'trials', trialId), trial);

        // Test: School user cannot read SaaS collection
        const schoolUserDb = testEnv.authenticatedContext(SCHOOL_USER_UID).firestore();
        await assertFails(
          getDoc(doc(schoolUserDb, 'trials', trialId))
        );
      });

      it('should deny Law workspace user from reading SaaS trial', async () => {
        // Setup
        const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
        await setDoc(doc(superAdminDb, 'trials', trialId), trial);

        // Test: Law user cannot read SaaS collection
        const lawUserDb = testEnv.authenticatedContext(LAW_USER_UID).firestore();
        await assertFails(
          getDoc(doc(lawUserDb, 'trials', trialId))
        );
      });

      it('should allow SaaS workspace user to update trial', async () => {
        // Setup
        const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
        await setDoc(doc(superAdminDb, 'trials', trialId), trial);

        // Test
        const saasUserDb = testEnv.authenticatedContext(SAAS_USER_UID).firestore();
        await assertSucceeds(
          updateDoc(doc(saasUserDb, 'trials', trialId), {
            trialStatus: 'converted',
            conversionDate: new Date().toISOString(),
          })
        );
      });

      it('should deny changing workspaceId in update', async () => {
        // Setup
        const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
        await setDoc(doc(superAdminDb, 'trials', trialId), trial);

        // Test
        const saasUserDb = testEnv.authenticatedContext(SAAS_USER_UID).firestore();
        await assertFails(
          updateDoc(doc(saasUserDb, 'trials', trialId), {
            workspaceId: SCHOOL_WORKSPACE_ID,
          })
        );
      });
    });

    describe('subscriptions collection', () => {
      const subscriptionId = 'subscription-1';
      const subscription = {
        organizationId: ORG_ID,
        workspaceId: SAAS_WORKSPACE_ID,
        entityId: 'entity-1',
        planType: 'Pro',
        billingCycle: 'monthly',
        amount: 99.99,
        currency: 'USD',
        status: 'active',
        startDate: new Date().toISOString(),
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      it('should allow SaaS workspace user with finance_manage to create subscription', async () => {
        const saasUserDb = testEnv.authenticatedContext(SAAS_USER_UID).firestore();
        await assertSucceeds(
          setDoc(doc(saasUserDb, 'subscriptions', subscriptionId), subscription)
        );
      });

      it('should deny SchoolEnrollment workspace user from reading subscription', async () => {
        // Setup
        const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
        await setDoc(doc(superAdminDb, 'subscriptions', subscriptionId), subscription);

        // Test
        const schoolUserDb = testEnv.authenticatedContext(SCHOOL_USER_UID).firestore();
        await assertFails(
          getDoc(doc(schoolUserDb, 'subscriptions', subscriptionId))
        );
      });
    });
  });

  describe('School Enrollment Industry Collections', () => {
    describe('applications collection', () => {
      const applicationId = 'application-1';
      const application = {
        organizationId: ORG_ID,
        workspaceId: SCHOOL_WORKSPACE_ID,
        entityId: 'school-entity-1',
        familyId: 'family-1',
        studentName: 'John Doe',
        gradeApplying: '9',
        applicationStatus: 'submitted',
        submittedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      it('should allow SchoolEnrollment workspace user to create application', async () => {
        const schoolUserDb = testEnv.authenticatedContext(SCHOOL_USER_UID).firestore();
        await assertSucceeds(
          setDoc(doc(schoolUserDb, 'applications', applicationId), application)
        );
      });

      it('should allow SchoolEnrollment workspace user to read application', async () => {
        // Setup
        const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
        await setDoc(doc(superAdminDb, 'applications', applicationId), application);

        // Test
        const schoolUserDb = testEnv.authenticatedContext(SCHOOL_USER_UID).firestore();
        await assertSucceeds(
          getDoc(doc(schoolUserDb, 'applications', applicationId))
        );
      });

      it('should deny SaaS workspace user from reading SchoolEnrollment application', async () => {
        // Setup
        const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
        await setDoc(doc(superAdminDb, 'applications', applicationId), application);

        // Test: SaaS user cannot read SchoolEnrollment collection
        const saasUserDb = testEnv.authenticatedContext(SAAS_USER_UID).firestore();
        await assertFails(
          getDoc(doc(saasUserDb, 'applications', applicationId))
        );
      });

      it('should deny Law workspace user from reading SchoolEnrollment application', async () => {
        // Setup
        const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
        await setDoc(doc(superAdminDb, 'applications', applicationId), application);

        // Test
        const lawUserDb = testEnv.authenticatedContext(LAW_USER_UID).firestore();
        await assertFails(
          getDoc(doc(lawUserDb, 'applications', applicationId))
        );
      });
    });

    describe('enrollments collection', () => {
      const enrollmentId = 'enrollment-1';
      const enrollment = {
        organizationId: ORG_ID,
        workspaceId: SCHOOL_WORKSPACE_ID,
        entityId: 'school-entity-1',
        familyId: 'family-1',
        studentName: 'John Doe',
        grade: '9',
        academicYear: '2024-2025',
        enrollmentStatus: 'enrolled',
        enrollmentDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      it('should allow SchoolEnrollment workspace user to create enrollment', async () => {
        const schoolUserDb = testEnv.authenticatedContext(SCHOOL_USER_UID).firestore();
        await assertSucceeds(
          setDoc(doc(schoolUserDb, 'enrollments', enrollmentId), enrollment)
        );
      });

      it('should deny SaaS workspace user from reading enrollment', async () => {
        // Setup
        const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
        await setDoc(doc(superAdminDb, 'enrollments', enrollmentId), enrollment);

        // Test
        const saasUserDb = testEnv.authenticatedContext(SAAS_USER_UID).firestore();
        await assertFails(
          getDoc(doc(saasUserDb, 'enrollments', enrollmentId))
        );
      });
    });
  });

  describe('Law Industry Collections', () => {
    describe('matters collection', () => {
      const matterId = 'matter-1';
      const matter = {
        organizationId: ORG_ID,
        workspaceId: LAW_WORKSPACE_ID,
        entityId: 'client-entity-1',
        matterNumber: 'M-2024-001',
        matterType: 'Civil Litigation',
        practiceArea: 'litigation',
        status: 'active',
        openedDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      it('should allow Law workspace user to create matter', async () => {
        const lawUserDb = testEnv.authenticatedContext(LAW_USER_UID).firestore();
        await assertSucceeds(
          setDoc(doc(lawUserDb, 'matters', matterId), matter)
        );
      });

      it('should allow Law workspace user to read matter', async () => {
        // Setup
        const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
        await setDoc(doc(superAdminDb, 'matters', matterId), matter);

        // Test
        const lawUserDb = testEnv.authenticatedContext(LAW_USER_UID).firestore();
        await assertSucceeds(
          getDoc(doc(lawUserDb, 'matters', matterId))
        );
      });

      it('should deny SaaS workspace user from reading Law matter', async () => {
        // Setup
        const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
        await setDoc(doc(superAdminDb, 'matters', matterId), matter);

        // Test: SaaS user cannot read Law collection
        const saasUserDb = testEnv.authenticatedContext(SAAS_USER_UID).firestore();
        await assertFails(
          getDoc(doc(saasUserDb, 'matters', matterId))
        );
      });

      it('should deny SchoolEnrollment workspace user from reading Law matter', async () => {
        // Setup
        const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
        await setDoc(doc(superAdminDb, 'matters', matterId), matter);

        // Test
        const schoolUserDb = testEnv.authenticatedContext(SCHOOL_USER_UID).firestore();
        await assertFails(
          getDoc(doc(schoolUserDb, 'matters', matterId))
        );
      });
    });

    describe('conflictChecks collection', () => {
      const checkId = 'check-1';
      const conflictCheck = {
        organizationId: ORG_ID,
        workspaceId: LAW_WORKSPACE_ID,
        entityId: 'client-entity-1',
        checkStatus: 'clear',
        checkedBy: LAW_USER_UID,
        checkedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      it('should allow Law workspace user to create conflict check', async () => {
        const lawUserDb = testEnv.authenticatedContext(LAW_USER_UID).firestore();
        await assertSucceeds(
          setDoc(doc(lawUserDb, 'conflictChecks', checkId), conflictCheck)
        );
      });

      it('should deny SaaS workspace user from reading conflict check', async () => {
        // Setup
        const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
        await setDoc(doc(superAdminDb, 'conflictChecks', checkId), conflictCheck);

        // Test
        const saasUserDb = testEnv.authenticatedContext(SAAS_USER_UID).firestore();
        await assertFails(
          getDoc(doc(saasUserDb, 'conflictChecks', checkId))
        );
      });
    });
  });

  describe('Marketing Industry Collections', () => {
    describe('campaigns collection', () => {
      const campaignId = 'campaign-1';
      const campaign = {
        organizationId: ORG_ID,
        workspaceId: MARKETING_WORKSPACE_ID,
        entityId: 'client-entity-1',
        campaignName: 'Q1 Launch Campaign',
        campaignType: 'product_launch',
        status: 'active',
        budget: 50000,
        startDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      it('should allow Marketing workspace user to create campaign', async () => {
        const marketingUserDb = testEnv.authenticatedContext(MARKETING_USER_UID).firestore();
        await assertSucceeds(
          setDoc(doc(marketingUserDb, 'campaigns', campaignId), campaign)
        );
      });

      it('should deny SaaS workspace user from reading Marketing campaign', async () => {
        // Setup
        const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
        await setDoc(doc(superAdminDb, 'campaigns', campaignId), campaign);

        // Test
        const saasUserDb = testEnv.authenticatedContext(SAAS_USER_UID).firestore();
        await assertFails(
          getDoc(doc(saasUserDb, 'campaigns', campaignId))
        );
      });
    });
  });

  describe('Real Estate Industry Collections', () => {
    describe('properties collection', () => {
      const propertyId = 'property-1';
      const property = {
        organizationId: ORG_ID,
        workspaceId: REALESTATE_WORKSPACE_ID,
        entityId: 'owner-entity-1',
        propertyType: 'residential',
        address: {
          street: '123 Main St',
          city: 'Springfield',
          state: 'IL',
          postalCode: '62701',
          country: 'USA',
        },
        price: 350000,
        status: 'available',
        listedDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      it('should allow RealEstate workspace user to create property', async () => {
        const realestateUserDb = testEnv.authenticatedContext(REALESTATE_USER_UID).firestore();
        await assertSucceeds(
          setDoc(doc(realestateUserDb, 'properties', propertyId), property)
        );
      });

      it('should deny SaaS workspace user from reading RealEstate property', async () => {
        // Setup
        const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
        await setDoc(doc(superAdminDb, 'properties', propertyId), property);

        // Test
        const saasUserDb = testEnv.authenticatedContext(SAAS_USER_UID).firestore();
        await assertFails(
          getDoc(doc(saasUserDb, 'properties', propertyId))
        );
      });
    });
  });

  describe('Consultancy Industry Collections', () => {
    describe('engagements collection', () => {
      const engagementId = 'engagement-1';
      const engagement = {
        organizationId: ORG_ID,
        workspaceId: CONSULTANCY_WORKSPACE_ID,
        entityId: 'client-entity-1',
        engagementName: 'Digital Transformation Project',
        engagementType: 'strategy',
        status: 'active',
        startDate: new Date().toISOString(),
        value: 150000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      it('should allow Consultancy workspace user to create engagement', async () => {
        const consultancyUserDb = testEnv.authenticatedContext(CONSULTANCY_USER_UID).firestore();
        await assertSucceeds(
          setDoc(doc(consultancyUserDb, 'engagements', engagementId), engagement)
        );
      });

      it('should deny SaaS workspace user from reading Consultancy engagement', async () => {
        // Setup
        const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
        await setDoc(doc(superAdminDb, 'engagements', engagementId), engagement);

        // Test
        const saasUserDb = testEnv.authenticatedContext(SAAS_USER_UID).firestore();
        await assertFails(
          getDoc(doc(saasUserDb, 'engagements', engagementId))
        );
      });
    });
  });

  describe('Cross-Industry Access Control', () => {
    it('should allow super admin to access all industry collections', async () => {
      const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();

      // Create documents in different industry collections
      const trial = {
        organizationId: ORG_ID,
        workspaceId: SAAS_WORKSPACE_ID,
        entityId: 'entity-1',
        trialStartDate: new Date().toISOString(),
        trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        trialStatus: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const matter = {
        organizationId: ORG_ID,
        workspaceId: LAW_WORKSPACE_ID,
        entityId: 'client-entity-1',
        matterNumber: 'M-2024-001',
        matterType: 'Civil Litigation',
        practiceArea: 'litigation',
        status: 'active',
        openedDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Super admin can read all collections
      await setDoc(doc(superAdminDb, 'trials', 'trial-1'), trial);
      await setDoc(doc(superAdminDb, 'matters', 'matter-1'), matter);

      await assertSucceeds(getDoc(doc(superAdminDb, 'trials', 'trial-1')));
      await assertSucceeds(getDoc(doc(superAdminDb, 'matters', 'matter-1')));
    });

    it('should enforce strict industry boundaries for regular users', async () => {
      const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();

      // Create a trial in SaaS workspace
      const trial = {
        organizationId: ORG_ID,
        workspaceId: SAAS_WORKSPACE_ID,
        entityId: 'entity-1',
        trialStartDate: new Date().toISOString(),
        trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        trialStatus: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(superAdminDb, 'trials', 'trial-1'), trial);

      // Test that users from other industries cannot access
      const schoolUserDb = testEnv.authenticatedContext(SCHOOL_USER_UID).firestore();
      const lawUserDb = testEnv.authenticatedContext(LAW_USER_UID).firestore();
      const marketingUserDb = testEnv.authenticatedContext(MARKETING_USER_UID).firestore();
      const realestateUserDb = testEnv.authenticatedContext(REALESTATE_USER_UID).firestore();
      const consultancyUserDb = testEnv.authenticatedContext(CONSULTANCY_USER_UID).firestore();

      await assertFails(getDoc(doc(schoolUserDb, 'trials', 'trial-1')));
      await assertFails(getDoc(doc(lawUserDb, 'trials', 'trial-1')));
      await assertFails(getDoc(doc(marketingUserDb, 'trials', 'trial-1')));
      await assertFails(getDoc(doc(realestateUserDb, 'trials', 'trial-1')));
      await assertFails(getDoc(doc(consultancyUserDb, 'trials', 'trial-1')));
    });
  });
});
