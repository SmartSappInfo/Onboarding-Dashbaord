/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Test suite for the Immutable Template Versioning Engine (Phase 3 Task 2).
 * Verifies monotonic version numbering, draft-to-published state transitions,
 * superseded version archival, strict immutability guards, and visual diff computation.
 */

import { describe, it, expect } from 'vitest';
import {
  createDraftVersion,
  publishTemplateVersion,
  validateTemplateVersionImmutability,
  diffTemplateVersions,
  type TemplateVersionDiff,
} from '@/lib/documents/template-version-service';
import type {
  TemplateVersion,
  DocumentFieldDefinition,
} from '@/lib/types/document-signing';

describe('Immutable Template Versioning Engine (template-version-service)', () => {
  const sampleField1: DocumentFieldDefinition = {
    id: 'f_sig_1',
    key: 'client_signature',
    label: 'Client Signature',
    type: 'signature',
    page: 1,
    x: 10,
    y: 70,
    width: 25,
    height: 8,
    required: true,
    assignedRole: 'signer',
  };

  const sampleField2: DocumentFieldDefinition = {
    id: 'f_date_1',
    key: 'sign_date',
    label: 'Date Signed',
    type: 'date',
    page: 1,
    x: 40,
    y: 70,
    width: 15,
    height: 5,
    required: true,
    assignedRole: 'signer',
  };

  describe('createDraftVersion', () => {
    it('creates an initial v1 draft when no previous versions exist', () => {
      const draft = createDraftVersion({
        workspaceId: 'ws_legal_1',
        templateId: 'tmpl_100',
        currentVersions: [],
        createdBy: 'user_admin_1',
        storagePath: 'workspaces/ws_legal_1/templates/tmpl_100/v1.pdf',
        sha256: 'abc123sha',
        fields: [sampleField1],
        changeSummary: 'Initial draft version',
      });

      expect(draft.versionNumber).toBe(1);
      expect(draft.status).toBe('draft');
      expect(draft.templateId).toBe('tmpl_100');
      expect(draft.workspaceId).toBe('ws_legal_1');
      expect(draft.fields).toHaveLength(1);
      expect(draft.fields[0].id).toBe('f_sig_1');
      expect(draft.contentSnapshot.sha256).toBe('abc123sha');
    });

    it('creates an incremental v2 draft based on an existing published v1', () => {
      const v1Published: TemplateVersion = {
        id: 'ver_001',
        workspaceId: 'ws_legal_1',
        templateId: 'tmpl_100',
        versionNumber: 1,
        status: 'published',
        contentSnapshot: {
          storagePath: 'templates/v1.pdf',
          sha256: 'sha_v1',
        },
        fields: [sampleField1],
        variableSchemaVersion: '1.0',
        publishedAt: '2026-09-01T00:00:00Z',
        createdBy: 'user_admin_1',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      };

      const v2Draft = createDraftVersion({
        workspaceId: 'ws_legal_1',
        templateId: 'tmpl_100',
        currentVersions: [v1Published],
        baseVersionId: 'ver_001',
        createdBy: 'user_legal_editor',
        changeSummary: 'Added date signed field to second version',
      });

      expect(v2Draft.versionNumber).toBe(2);
      expect(v2Draft.status).toBe('draft');
      expect(v2Draft.fields).toHaveLength(1); // Cloned from base
      expect(v2Draft.contentSnapshot.sha256).toBe('sha_v1');
    });

    it('rejects creating a new draft if an un-published draft already exists', () => {
      const existingDraft: TemplateVersion = {
        id: 'ver_draft_1',
        workspaceId: 'ws_legal_1',
        templateId: 'tmpl_100',
        versionNumber: 2,
        status: 'draft',
        contentSnapshot: {
          storagePath: 'templates/v2.pdf',
          sha256: 'sha_v2',
        },
        fields: [sampleField1],
        variableSchemaVersion: '1.0',
        createdBy: 'user_editor',
        createdAt: '2026-09-02T00:00:00Z',
        updatedAt: '2026-09-02T00:00:00Z',
      };

      expect(() =>
        createDraftVersion({
          workspaceId: 'ws_legal_1',
          templateId: 'tmpl_100',
          currentVersions: [existingDraft],
          createdBy: 'user_editor_2',
        })
      ).toThrowError(/An active draft version \(v2\) already exists/);
    });
  });

  describe('publishTemplateVersion', () => {
    it('promotes draft to published and supersedes previous published versions', () => {
      const v1Published: TemplateVersion = {
        id: 'ver_001',
        workspaceId: 'ws_legal_1',
        templateId: 'tmpl_100',
        versionNumber: 1,
        status: 'published',
        contentSnapshot: {
          storagePath: 'templates/v1.pdf',
          sha256: 'sha_v1',
        },
        fields: [sampleField1],
        variableSchemaVersion: '1.0',
        publishedAt: '2026-09-01T00:00:00Z',
        createdBy: 'user_admin_1',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      };

      const v2Draft: TemplateVersion = {
        id: 'ver_002',
        workspaceId: 'ws_legal_1',
        templateId: 'tmpl_100',
        versionNumber: 2,
        status: 'draft',
        contentSnapshot: {
          storagePath: 'templates/v2.pdf',
          sha256: 'sha_v2',
        },
        fields: [sampleField1, sampleField2],
        variableSchemaVersion: '1.0',
        createdBy: 'user_legal_editor',
        createdAt: '2026-09-02T00:00:00Z',
        updatedAt: '2026-09-02T00:00:00Z',
      };

      const result = publishTemplateVersion({
        versionToPublish: v2Draft,
        allVersions: [v1Published, v2Draft],
        publishedBy: 'user_legal_lead',
        changeSummary: 'Official v2 enterprise standard with date field',
      });

      expect(result.publishedVersion.status).toBe('published');
      expect(result.publishedVersion.versionNumber).toBe(2);
      expect(result.publishedVersion.publishedAt).toBeDefined();
      expect(result.currentPublishedVersionId).toBe('ver_002');

      expect(result.supersededVersions).toHaveLength(1);
      expect(result.supersededVersions[0].id).toBe('ver_001');
      expect(result.supersededVersions[0].status).toBe('superseded');
    });

    it('rejects publishing a version that is not in draft status', () => {
      const v1Published: TemplateVersion = {
        id: 'ver_001',
        workspaceId: 'ws_legal_1',
        templateId: 'tmpl_100',
        versionNumber: 1,
        status: 'published',
        contentSnapshot: {
          storagePath: 'templates/v1.pdf',
          sha256: 'sha_v1',
        },
        fields: [sampleField1],
        variableSchemaVersion: '1.0',
        publishedAt: '2026-09-01T00:00:00Z',
        createdBy: 'user_admin_1',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      };

      expect(() =>
        publishTemplateVersion({
          versionToPublish: v1Published,
          allVersions: [v1Published],
          publishedBy: 'user_admin_1',
        })
      ).toThrowError(/Cannot publish version with status "published"/);
    });
  });

  describe('validateTemplateVersionImmutability', () => {
    it('allows updating fields and snapshots on a draft version', () => {
      const draft: TemplateVersion = {
        id: 'ver_003',
        workspaceId: 'ws_1',
        templateId: 'tmpl_1',
        versionNumber: 3,
        status: 'draft',
        contentSnapshot: {
          storagePath: 'templates/v3.pdf',
          sha256: 'sha_v3',
        },
        fields: [sampleField1],
        variableSchemaVersion: '1.0',
        createdBy: 'user_1',
        createdAt: '2026-09-29T00:00:00Z',
        updatedAt: '2026-09-29T00:00:00Z',
      };

      const result = validateTemplateVersionImmutability(draft, {
        fields: [sampleField1, sampleField2],
      });

      expect(result.allowed).toBe(true);
    });

    it('rejects mutating fields or contentSnapshot on a published version', () => {
      const published: TemplateVersion = {
        id: 'ver_001',
        workspaceId: 'ws_1',
        templateId: 'tmpl_1',
        versionNumber: 1,
        status: 'published',
        contentSnapshot: {
          storagePath: 'templates/v1.pdf',
          sha256: 'sha_v1',
        },
        fields: [sampleField1],
        variableSchemaVersion: '1.0',
        publishedAt: '2026-09-01T00:00:00Z',
        createdBy: 'user_1',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      };

      const result = validateTemplateVersionImmutability(published, {
        fields: [],
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Published template versions are immutable');
    });

    it('rejects mutating a superseded version', () => {
      const superseded: TemplateVersion = {
        id: 'ver_000',
        workspaceId: 'ws_1',
        templateId: 'tmpl_1',
        versionNumber: 1,
        status: 'superseded',
        contentSnapshot: {
          storagePath: 'templates/v0.pdf',
          sha256: 'sha_v0',
        },
        fields: [sampleField1],
        variableSchemaVersion: '1.0',
        publishedAt: '2026-08-01T00:00:00Z',
        createdBy: 'user_1',
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
      };

      const result = validateTemplateVersionImmutability(superseded, {
        changeSummary: 'Trying to change history',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Superseded template versions are immutable');
    });
  });

  describe('diffTemplateVersions', () => {
    it('accurately identifies added, removed, and modified fields between two versions', () => {
      const oldVersion: TemplateVersion = {
        id: 'ver_old',
        workspaceId: 'ws_1',
        templateId: 'tmpl_1',
        versionNumber: 1,
        status: 'superseded',
        contentSnapshot: {
          storagePath: 'templates/v1.pdf',
          sha256: 'sha_old_111',
        },
        fields: [
          sampleField1, // id: 'f_sig_1', x: 10, y: 70
          {
            id: 'f_to_be_removed',
            key: 'temp_notes',
            label: 'Temporary Notes',
            type: 'text',
            page: 1,
            x: 5,
            y: 50,
            width: 50,
            height: 10,
            required: false,
            assignedRole: 'signer',
          },
        ],
        variableSchemaVersion: '1.0',
        createdBy: 'user_1',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      };

      const modifiedField1: DocumentFieldDefinition = {
        ...sampleField1,
        x: 15, // Changed position
        required: false, // Changed requirement
      };

      const newVersion: TemplateVersion = {
        id: 'ver_new',
        workspaceId: 'ws_1',
        templateId: 'tmpl_1',
        versionNumber: 2,
        status: 'published',
        contentSnapshot: {
          storagePath: 'templates/v2.pdf',
          sha256: 'sha_new_222', // Changed file
        },
        fields: [
          modifiedField1,
          sampleField2, // Added field: 'f_date_1'
        ],
        variableSchemaVersion: '1.0',
        createdBy: 'user_2',
        createdAt: '2026-09-29T00:00:00Z',
        updatedAt: '2026-09-29T00:00:00Z',
      };

      const diff: TemplateVersionDiff = diffTemplateVersions(oldVersion, newVersion);

      expect(diff.versionFrom).toBe(1);
      expect(diff.versionTo).toBe(2);
      expect(diff.hasDocumentChanged).toBe(true);
      expect(diff.addedFields).toHaveLength(1);
      expect(diff.addedFields[0].id).toBe('f_date_1');
      expect(diff.removedFields).toHaveLength(1);
      expect(diff.removedFields[0].id).toBe('f_to_be_removed');

      expect(diff.modifiedFields).toHaveLength(1);
      expect(diff.modifiedFields[0].fieldId).toBe('f_sig_1');
      expect(diff.modifiedFields[0].changes).toEqual(
        expect.arrayContaining([
          { property: 'x', from: 10, to: 15 },
          { property: 'required', from: true, to: false },
        ])
      );
    });
  });
});
