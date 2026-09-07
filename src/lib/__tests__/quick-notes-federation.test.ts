import { describe, it, expect } from 'vitest';
import {
  validateIngestionPayload,
  serializeKnowledgeToMarkdownArchive,
  deserializeMarkdownArchive,
  resolveFederatedVisibility,
  resolveFederationConflict,
  filterFederatedKnowledge,
  getKnowledgeIngestionSourceMeta,
  getKnowledgeSpaceAccessLevelMeta,
  getFederationPolicyMeta,
} from '../quick-notes-domain';
import type {
  QuickNote,
  FederatedKnowledgeSpace,
  FederatedKnowledgeItem,
} from '../quick-notes-types';

describe('Phase 9: Multi-Workspace Knowledge Federation & Ingestion Pure Domain Logic', () => {
  const dummyNote: QuickNote = {
    id: 'note_fed_1',
    organizationId: 'org_acme',
    workspaceId: 'ws_alpha',
    title: 'HQ Brand Voice & Core Guidelines',
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'All campuses must use friendly and accessible tone in parent communications.' }],
        },
      ],
    },
    plainText: 'All campuses must use friendly and accessible tone in parent communications.',
    contentVersion: 1,
    categoryId: 'Brand & Marketing',
    tags: ['brand', 'guidelines', 'communication'],
    attachments: [],
    links: {},
    isPinned: false,
    createdBy: 'user_admin',
    authorName: 'Chief Marketing Officer',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
  };

  const dummySpace: FederatedKnowledgeSpace = {
    id: 'space_central_guidelines',
    name: 'Central HQ Brand & Policy Hub',
    description: 'Official curriculum, brand tone, and compliance playbooks for all campuses.',
    organizationId: 'org_acme',
    ownerWorkspaceId: 'ws_hq',
    subscriberWorkspaceIds: ['ws_branch_north', 'ws_branch_south'],
    accessLevel: 'viewer',
    federationPolicy: 'selective_peers',
    publishedCollectionIds: ['cat_brand', 'cat_compliance'],
    tags: ['hq', 'policy', 'brand'],
    isArchived: false,
    createdBy: 'user_admin',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
  };

  describe('validateIngestionPayload', () => {
    it('validates a standard webhook payload and creates valid TipTap AST', () => {
      const payload = {
        title: 'Parent Inquiry from WhatsApp Bot',
        content: 'Parent asked about nursery enrollment fees for Term 1.',
        source: 'whatsapp_bot',
        sourceAuthor: '+233244123456',
        tags: ['Admissions', 'Fees', 'urgent-lead!'],
        priority: 'high',
      };

      const result = validateIngestionPayload(payload);
      expect(result.valid).toBe(true);
      expect(result.sanitizedPayload?.title).toBe('Parent Inquiry from WhatsApp Bot');
      expect(result.sanitizedPayload?.source).toBe('whatsapp_bot');
      expect(result.sanitizedPayload?.tags).toContain('admissions');
      expect(result.sanitizedPayload?.tags).toContain('fees');
      expect(result.document?.type).toBe('doc');
      expect(result.document?.content?.length).toBeGreaterThan(0);
    });

    it('rejects empty titles and oversized payloads', () => {
      expect(validateIngestionPayload({ title: '', content: 'Some text' }).valid).toBe(false);
      expect(validateIngestionPayload({ title: 'Test', content: '' }).valid).toBe(false);
      expect(
        validateIngestionPayload({
          title: 'Test',
          content: 'x'.repeat(26000),
        }).valid
      ).toBe(false);
    });

    it('sanitizes script tags and validates safe URLs', () => {
      const payloadWithScript = {
        title: 'Notes with Script',
        content: 'Safe text <script>alert("hack")</script> more text',
        source: 'slack',
        sourceUrl: 'https://app.slack.com/archives/C123/p456',
      };

      const result = validateIngestionPayload(payloadWithScript);
      expect(result.valid).toBe(true);
      expect(result.sanitizedPayload?.content).not.toContain('<script>');
      expect(result.sanitizedPayload?.sourceUrl).toBe('https://app.slack.com/archives/C123/p456');
    });

    it('rejects SSRF private addresses in sourceUrl', () => {
      const payload = {
        title: 'SSRF Attack Note',
        content: 'Attempting to probe internal metadata',
        source: 'webhook_rest',
        sourceUrl: 'http://169.254.169.254/latest/meta-data/',
      };

      const result = validateIngestionPayload(payload);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('security verification');
    });
  });

  describe('serializeKnowledgeToMarkdownArchive & deserializeMarkdownArchive', () => {
    it('round-trips a QuickNote to Markdown with YAML frontmatter and parses it back', () => {
      const { files, compiledBundle } = serializeKnowledgeToMarkdownArchive({
        notes: [dummyNote],
      });

      expect(files.length).toBe(1);
      expect(files[0].filename).toContain('hq-brand-voice');
      expect(files[0].content).toContain('---');
      expect(files[0].content).toContain('id: "note_fed_1"');
      expect(files[0].content).toContain('title: "HQ Brand Voice & Core Guidelines"');

      // Deserialize
      const parsedItems = deserializeMarkdownArchive(compiledBundle);
      expect(parsedItems.length).toBe(1);
      expect(parsedItems[0].title).toBe('HQ Brand Voice & Core Guidelines');
      expect(parsedItems[0].categoryName).toBe('Brand & Marketing');
      expect(parsedItems[0].tags).toContain('brand');
      expect(parsedItems[0].document.type).toBe('doc');
    });
  });

  describe('resolveFederatedVisibility', () => {
    it('allows owner workspace full admin access', () => {
      const result = resolveFederatedVisibility({
        space: dummySpace,
        requestingWorkspaceId: 'ws_hq',
        userOrgId: 'org_acme',
      });
      expect(result.allowed).toBe(true);
      expect(result.effectiveAccessLevel).toBe('admin');
    });

    it('allows authorized peer workspace subscriber access', () => {
      const result = resolveFederatedVisibility({
        space: dummySpace,
        requestingWorkspaceId: 'ws_branch_north',
        userOrgId: 'org_acme',
      });
      expect(result.allowed).toBe(true);
      expect(result.effectiveAccessLevel).toBe('viewer');
    });

    it('blocks non-subscriber workspace in selective peers mode', () => {
      const result = resolveFederatedVisibility({
        space: dummySpace,
        requestingWorkspaceId: 'ws_unauthorized_branch',
        userOrgId: 'org_acme',
      });
      expect(result.allowed).toBe(false);
    });

    it('blocks cross-organization access unconditionally', () => {
      const result = resolveFederatedVisibility({
        space: dummySpace,
        requestingWorkspaceId: 'ws_branch_north',
        userOrgId: 'org_malicious_competitor',
      });
      expect(result.allowed).toBe(false);
    });
  });

  describe('resolveFederationConflict', () => {
    const localNote: QuickNote = {
      ...dummyNote,
      updatedAt: '2026-09-02T10:00:00.000Z',
    };
    const remoteNote: QuickNote = {
      ...dummyNote,
      title: 'HQ Brand Voice (Upstream Revised)',
      updatedAt: '2026-09-03T10:00:00.000Z',
    };

    it('resolves with last_write_wins by picking the newer note', () => {
      const res = resolveFederationConflict({
        localNote,
        remoteNote,
        strategy: 'last_write_wins',
      });
      expect(res.action).toBe('overwrite');
      expect(res.resolvedNote?.title).toBe('HQ Brand Voice (Upstream Revised)');
    });

    it('resolves with fork_as_variant by creating a new variant note', () => {
      const res = resolveFederationConflict({
        localNote,
        remoteNote,
        strategy: 'fork_as_variant',
      });
      expect(res.action).toBe('create_variant');
      expect(res.resolvedNote?.title).toContain('[Federated Variant]');
    });

    it('resolves with manual_inbox_review by emitting an inbox contradiction payload', () => {
      const res = resolveFederationConflict({
        localNote,
        remoteNote,
        strategy: 'manual_inbox_review',
      });
      expect(res.action).toBe('flag_for_inbox');
      expect(res.inboxPayload?.type).toBe('contradiction');
      expect(res.inboxPayload?.contradictionDetails?.thesisNoteId).toBe(localNote.id);
    });
  });

  describe('filterFederatedKnowledge', () => {
    const feedItems: FederatedKnowledgeItem[] = [
      {
        id: 'fed_1',
        title: 'Parent Tuition Payment Policy 2026',
        snippet: 'Standardized fees and sibling discount policy',
        sourceWorkspaceId: 'ws_hq',
        sourceWorkspaceName: 'Headquarters',
        sourceSpaceId: 'space_1',
        sourceSpaceName: 'Operations',
        tags: ['tuition', 'finance'],
        accessLevel: 'viewer',
        updatedAt: '2026-09-03T12:00:00.000Z',
        isLocalCopy: false,
      },
      {
        id: 'fed_2',
        title: 'Science Lab Safety Protocol',
        snippet: 'Guidelines for laboratory experiments',
        sourceWorkspaceId: 'ws_branch_north',
        sourceWorkspaceName: 'North Campus',
        sourceSpaceId: 'space_2',
        sourceSpaceName: 'Academics',
        tags: ['science', 'safety'],
        accessLevel: 'contributor',
        updatedAt: '2026-09-02T12:00:00.000Z',
        isLocalCopy: true,
      },
    ];

    it('filters by search query', () => {
      const res = filterFederatedKnowledge(feedItems, { searchQuery: 'tuition' });
      expect(res.length).toBe(1);
      expect(res[0].id).toBe('fed_1');
    });

    it('filters by source workspace', () => {
      const res = filterFederatedKnowledge(feedItems, { sourceWorkspaceId: 'ws_branch_north' });
      expect(res.length).toBe(1);
      expect(res[0].id).toBe('fed_2');
    });
  });

  describe('Metadata helpers', () => {
    it('returns valid metadata for ingestion sources, access levels, and federation policies', () => {
      expect(getKnowledgeIngestionSourceMeta('slack').label).toBe('Slack Webhook');
      expect(getKnowledgeSpaceAccessLevelMeta('contributor').label).toBe('Read & Write');
      expect(getFederationPolicyMeta('organization_shared').label).toBe('Organization-Wide');
    });
  });
});
