/**
 * Firestore Security Rules Tests: Message Template System
 * 
 * Tests the security rules for the two-tier messaging template system:
 * - message_templates collection (global and organization-scoped)
 * - template_variables collection (variable registry)
 * - scheduled_messages collection (reminder system)
 * 
 * Validates: Task 16.1, 16.2, 16.3
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
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Message Template Security Rules', () => {
  let testEnv: RulesTestEnvironment;
  const PROJECT_ID = `test-message-templates-${Date.now()}`;

  // Test user contexts
  const SUPER_ADMIN_UID = 'super-admin-user';
  const ORG_ADMIN_UID = 'org-admin-user';
  const ORG_ADMIN_2_UID = 'org-admin-2-user';
  const TEAM_MEMBER_UID = 'team-member-user';
  const ORG_ID_1 = 'org-1';
  const ORG_ID_2 = 'org-2';

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

    // Setup test users with different roles
    const adminContext = testEnv.authenticatedContext(SUPER_ADMIN_UID, {
      email: 'admin@smartsapp.com',
    });

    await adminContext.firestore().collection('users').doc(SUPER_ADMIN_UID).set({
      isAuthorized: true,
      permissions: ['system_admin'],
      organizationId: ORG_ID_1,
      workspaceIds: [],
    });

    await adminContext.firestore().collection('users').doc(ORG_ADMIN_UID).set({
      isAuthorized: true,
      permissions: ['studios_edit'],
      organizationId: ORG_ID_1,
      workspaceIds: [],
    });

    await adminContext.firestore().collection('users').doc(ORG_ADMIN_2_UID).set({
      isAuthorized: true,
      permissions: ['studios_edit'],
      organizationId: ORG_ID_2,
      workspaceIds: [],
    });

    await adminContext.firestore().collection('users').doc(TEAM_MEMBER_UID).set({
      isAuthorized: true,
      permissions: [],
      organizationId: ORG_ID_1,
      workspaceIds: [],
    });
  });

  afterEach(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  describe('message_templates collection', () => {
    describe('Global templates (scope: global)', () => {
      const globalTemplateId = 'global-template-1';
      const globalTemplate = {
        scope: 'global',
        category: 'meetings',
        templateType: 'meeting_invitation',
        name: 'Meeting Invitation',
        channel: 'email',
        subject: 'You are invited',
        body: 'Join us for {{meeting_title}}',
        status: 'approved',
        isActive: true,
        version: 1,
      };

      it('should allow super admin to create global template', async () => {
        const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
        await assertSucceeds(
          setDoc(doc(superAdminDb, 'message_templates', globalTemplateId), globalTemplate)
        );
      });

      it('should deny org admin from creating global template', async () => {
        const orgAdminDb = testEnv.authenticatedContext(ORG_ADMIN_UID).firestore();
        await assertFails(
          setDoc(doc(orgAdminDb, 'message_templates', globalTemplateId), globalTemplate)
        );
      });

      it('should allow all authenticated users to read global template', async () => {
        // Setup: Create global template as super admin
        const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
        await setDoc(doc(superAdminDb, 'message_templates', globalTemplateId), globalTemplate);

        // Test: Team member can read
        const teamMemberDb = testEnv.authenticatedContext(TEAM_MEMBER_UID).firestore();
        await assertSucceeds(
          getDoc(doc(teamMemberDb, 'message_templates', globalTemplateId))
        );

        // Test: Org admin from different org can read
        const orgAdmin2Db = testEnv.authenticatedContext(ORG_ADMIN_2_UID).firestore();
        await assertSucceeds(
          getDoc(doc(orgAdmin2Db, 'message_templates', globalTemplateId))
        );
      });

      it('should allow super admin to update global template', async () => {
        // Setup
        const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
        await setDoc(doc(superAdminDb, 'message_templates', globalTemplateId), globalTemplate);

        // Test: Update
        await assertSucceeds(
          updateDoc(doc(superAdminDb, 'message_templates', globalTemplateId), {
            body: 'Updated body',
            version: 2,
          })
        );
      });

      it('should deny org admin from updating global template', async () => {
        // Setup
        const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
        await setDoc(doc(superAdminDb, 'message_templates', globalTemplateId), globalTemplate);

        // Test: Org admin cannot update
        const orgAdminDb = testEnv.authenticatedContext(ORG_ADMIN_UID).firestore();
        await assertFails(
          updateDoc(doc(orgAdminDb, 'message_templates', globalTemplateId), {
            body: 'Hacked body',
          })
        );
      });

      it('should allow super admin to delete global template', async () => {
        // Setup
        const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
        await setDoc(doc(superAdminDb, 'message_templates', globalTemplateId), globalTemplate);

        // Test: Delete
        await assertSucceeds(
          deleteDoc(doc(superAdminDb, 'message_templates', globalTemplateId))
        );
      });

      it('should deny org admin from deleting global template', async () => {
        // Setup
        const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
        await setDoc(doc(superAdminDb, 'message_templates', globalTemplateId), globalTemplate);

        // Test: Org admin cannot delete
        const orgAdminDb = testEnv.authenticatedContext(ORG_ADMIN_UID).firestore();
        await assertFails(
          deleteDoc(doc(orgAdminDb, 'message_templates', globalTemplateId))
        );
      });
    });

    describe('Organization templates (scope: organization)', () => {
      const orgTemplateId = 'org-template-1';
      const orgTemplate = {
        scope: 'organization',
        organizationId: ORG_ID_1,
        globalTemplateId: 'global-template-1',
        category: 'meetings',
        templateType: 'meeting_invitation',
        name: 'Custom Meeting Invitation',
        channel: 'email',
        subject: 'Custom invitation',
        body: 'Custom body for {{meeting_title}}',
        status: 'approved',
        isActive: true,
        version: 1,
      };

      it('should allow org admin to create org template', async () => {
        const orgAdminDb = testEnv.authenticatedContext(ORG_ADMIN_UID).firestore();
        await assertSucceeds(
          setDoc(doc(orgAdminDb, 'message_templates', orgTemplateId), orgTemplate)
        );
      });

      it('should deny org admin from creating template for different org', async () => {
        const orgAdmin2Db = testEnv.authenticatedContext(ORG_ADMIN_2_UID).firestore();
        await assertFails(
          setDoc(doc(orgAdmin2Db, 'message_templates', orgTemplateId), orgTemplate)
        );
      });

      it('should allow org admin to read their org template', async () => {
        // Setup
        const orgAdminDb = testEnv.authenticatedContext(ORG_ADMIN_UID).firestore();
        await setDoc(doc(orgAdminDb, 'message_templates', orgTemplateId), orgTemplate);

        // Test: Read
        await assertSucceeds(
          getDoc(doc(orgAdminDb, 'message_templates', orgTemplateId))
        );
      });

      it('should deny org admin from reading different org template', async () => {
        // Setup
        const orgAdminDb = testEnv.authenticatedContext(ORG_ADMIN_UID).firestore();
        await setDoc(doc(orgAdminDb, 'message_templates', orgTemplateId), orgTemplate);

        // Test: Different org admin cannot read
        const orgAdmin2Db = testEnv.authenticatedContext(ORG_ADMIN_2_UID).firestore();
        await assertFails(
          getDoc(doc(orgAdmin2Db, 'message_templates', orgTemplateId))
        );
      });

      it('should allow org admin to update their org template', async () => {
        // Setup
        const orgAdminDb = testEnv.authenticatedContext(ORG_ADMIN_UID).firestore();
        await setDoc(doc(orgAdminDb, 'message_templates', orgTemplateId), orgTemplate);

        // Test: Update
        await assertSucceeds(
          updateDoc(doc(orgAdminDb, 'message_templates', orgTemplateId), {
            body: 'Updated custom body',
            version: 2,
          })
        );
      });

      it('should deny changing organizationId in update', async () => {
        // Setup
        const orgAdminDb = testEnv.authenticatedContext(ORG_ADMIN_UID).firestore();
        await setDoc(doc(orgAdminDb, 'message_templates', orgTemplateId), orgTemplate);

        // Test: Cannot change organizationId
        await assertFails(
          updateDoc(doc(orgAdminDb, 'message_templates', orgTemplateId), {
            organizationId: ORG_ID_2,
          })
        );
      });

      it('should deny changing scope in update', async () => {
        // Setup
        const orgAdminDb = testEnv.authenticatedContext(ORG_ADMIN_UID).firestore();
        await setDoc(doc(orgAdminDb, 'message_templates', orgTemplateId), orgTemplate);

        // Test: Cannot change scope
        await assertFails(
          updateDoc(doc(orgAdminDb, 'message_templates', orgTemplateId), {
            scope: 'global',
          })
        );
      });

      it('should allow org admin to delete their org template', async () => {
        // Setup
        const orgAdminDb = testEnv.authenticatedContext(ORG_ADMIN_UID).firestore();
        await setDoc(doc(orgAdminDb, 'message_templates', orgTemplateId), orgTemplate);

        // Test: Delete
        await assertSucceeds(
          deleteDoc(doc(orgAdminDb, 'message_templates', orgTemplateId))
        );
      });

      it('should deny team member without studios_edit from creating org template', async () => {
        const teamMemberDb = testEnv.authenticatedContext(TEAM_MEMBER_UID).firestore();
        await assertFails(
          setDoc(doc(teamMemberDb, 'message_templates', orgTemplateId), orgTemplate)
        );
      });
    });
  });

  describe('template_variables collection', () => {
    const variableId = 'var-meeting-link';
    const variable = {
      name: 'meeting_link',
      label: 'Meeting Link',
      description: 'URL to join the meeting',
      dataType: 'url',
      context: 'meeting',
      exampleValue: 'https://meet.example.com/abc123',
      isDynamic: false,
      isComputed: false,
    };

    it('should allow all authenticated users to read variables', async () => {
      // Setup: Create variable as super admin
      const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
      await setDoc(doc(superAdminDb, 'template_variables', variableId), variable);

      // Test: Team member can read
      const teamMemberDb = testEnv.authenticatedContext(TEAM_MEMBER_UID).firestore();
      await assertSucceeds(
        getDoc(doc(teamMemberDb, 'template_variables', variableId))
      );

      // Test: Org admin can read
      const orgAdminDb = testEnv.authenticatedContext(ORG_ADMIN_UID).firestore();
      await assertSucceeds(
        getDoc(doc(orgAdminDb, 'template_variables', variableId))
      );
    });

    it('should allow super admin to create variables', async () => {
      const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
      await assertSucceeds(
        setDoc(doc(superAdminDb, 'template_variables', variableId), variable)
      );
    });

    it('should allow org admin to create variables', async () => {
      const orgAdminDb = testEnv.authenticatedContext(ORG_ADMIN_UID).firestore();
      await assertSucceeds(
        setDoc(doc(orgAdminDb, 'template_variables', variableId), variable)
      );
    });

    it('should deny team member without studios_edit from creating variables', async () => {
      const teamMemberDb = testEnv.authenticatedContext(TEAM_MEMBER_UID).firestore();
      await assertFails(
        setDoc(doc(teamMemberDb, 'template_variables', variableId), variable)
      );
    });

    it('should allow org admin to update variables', async () => {
      // Setup
      const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
      await setDoc(doc(superAdminDb, 'template_variables', variableId), variable);

      // Test: Org admin can update
      const orgAdminDb = testEnv.authenticatedContext(ORG_ADMIN_UID).firestore();
      await assertSucceeds(
        updateDoc(doc(orgAdminDb, 'template_variables', variableId), {
          description: 'Updated description',
        })
      );
    });

    it('should allow org admin to delete variables', async () => {
      // Setup
      const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
      await setDoc(doc(superAdminDb, 'template_variables', variableId), variable);

      // Test: Org admin can delete
      const orgAdminDb = testEnv.authenticatedContext(ORG_ADMIN_UID).firestore();
      await assertSucceeds(
        deleteDoc(doc(orgAdminDb, 'template_variables', variableId))
      );
    });
  });

  describe('scheduled_messages collection', () => {
    const messageId = 'scheduled-msg-1';
    const scheduledMessage = {
      organizationId: ORG_ID_1,
      workspaceId: 'workspace-1',
      templateId: 'template-1',
      channel: 'email',
      recipientContact: 'user@example.com',
      recipientEntityId: 'entity-1',
      variables: { meeting_title: 'Team Sync' },
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
      status: 'pending',
      reminderType: 'meeting_1_hour',
      sourceEventId: 'meeting-1',
      sourceEventType: 'meeting',
      createdAt: new Date().toISOString(),
    };

    it('should allow org admin to create scheduled message', async () => {
      const orgAdminDb = testEnv.authenticatedContext(ORG_ADMIN_UID).firestore();
      await assertSucceeds(
        setDoc(doc(orgAdminDb, 'scheduled_messages', messageId), scheduledMessage)
      );
    });

    it('should deny creating scheduled message for different org', async () => {
      const orgAdmin2Db = testEnv.authenticatedContext(ORG_ADMIN_2_UID).firestore();
      await assertFails(
        setDoc(doc(orgAdmin2Db, 'scheduled_messages', messageId), scheduledMessage)
      );
    });

    it('should allow org admin to read their org scheduled messages', async () => {
      // Setup
      const orgAdminDb = testEnv.authenticatedContext(ORG_ADMIN_UID).firestore();
      await setDoc(doc(orgAdminDb, 'scheduled_messages', messageId), scheduledMessage);

      // Test: Read
      await assertSucceeds(
        getDoc(doc(orgAdminDb, 'scheduled_messages', messageId))
      );
    });

    it('should deny org admin from reading different org scheduled messages', async () => {
      // Setup
      const orgAdminDb = testEnv.authenticatedContext(ORG_ADMIN_UID).firestore();
      await setDoc(doc(orgAdminDb, 'scheduled_messages', messageId), scheduledMessage);

      // Test: Different org admin cannot read
      const orgAdmin2Db = testEnv.authenticatedContext(ORG_ADMIN_2_UID).firestore();
      await assertFails(
        getDoc(doc(orgAdmin2Db, 'scheduled_messages', messageId))
      );
    });

    it('should allow org admin to update their scheduled message', async () => {
      // Setup
      const orgAdminDb = testEnv.authenticatedContext(ORG_ADMIN_UID).firestore();
      await setDoc(doc(orgAdminDb, 'scheduled_messages', messageId), scheduledMessage);

      // Test: Update status
      await assertSucceeds(
        updateDoc(doc(orgAdminDb, 'scheduled_messages', messageId), {
          status: 'sent',
          sentAt: new Date().toISOString(),
        })
      );
    });

    it('should deny changing organizationId in update', async () => {
      // Setup
      const orgAdminDb = testEnv.authenticatedContext(ORG_ADMIN_UID).firestore();
      await setDoc(doc(orgAdminDb, 'scheduled_messages', messageId), scheduledMessage);

      // Test: Cannot change organizationId
      await assertFails(
        updateDoc(doc(orgAdminDb, 'scheduled_messages', messageId), {
          organizationId: ORG_ID_2,
        })
      );
    });

    it('should allow org admin to delete their scheduled message', async () => {
      // Setup
      const orgAdminDb = testEnv.authenticatedContext(ORG_ADMIN_UID).firestore();
      await setDoc(doc(orgAdminDb, 'scheduled_messages', messageId), scheduledMessage);

      // Test: Delete (cancel)
      await assertSucceeds(
        deleteDoc(doc(orgAdminDb, 'scheduled_messages', messageId))
      );
    });

    it('should allow super admin to access all scheduled messages', async () => {
      // Setup
      const orgAdminDb = testEnv.authenticatedContext(ORG_ADMIN_UID).firestore();
      await setDoc(doc(orgAdminDb, 'scheduled_messages', messageId), scheduledMessage);

      // Test: Super admin can read
      const superAdminDb = testEnv.authenticatedContext(SUPER_ADMIN_UID).firestore();
      await assertSucceeds(
        getDoc(doc(superAdminDb, 'scheduled_messages', messageId))
      );
    });
  });
});
