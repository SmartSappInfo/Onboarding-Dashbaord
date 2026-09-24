/**
 * {{Org_name}} Experience Platform — Universal Content Domain Service
 *
 * Provides transactional lifecycle management, scoped slug generation,
 * revision history snapshots, and search indexing for all content items.
 *
 * Rules:
 * - Strictly typed: 0 `any` / 0 `any[]`.
 * - Multi-workspace scoped and tenant guarded.
 * - Conforms to backend-design and vercel-react-best-practices.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { PageBlock } from '@/lib/types';
import type {
  ContentItem,
  ContentItemType,
  ContentStatus,
  ContentItemVersion,
  CreateContentItemInput,
  UpdateContentItemInput,
  ContentFilterOptions,
  ContentSearchResult,
  PortalContentTemplate,
  CreatePortalContentTemplateInput,
  ContentStudioDraft,
} from '@/lib/types/content';
import { PortalEventService } from './portal-event-service';

export class ContentService {
  private static COLLECTION = 'content_items';
  private static TEMPLATES_COLLECTION = 'portal_content_templates';
  private static DRAFTS_COLLECTION = 'content_drafts';

  /**
   * Maximum depth for recursive block tree traversal to prevent call-stack overflow
   * in the event of malformed or circularly linked block structures.
   */
  private static readonly MAX_BLOCK_TRAVERSAL_DEPTH = 10;

  /**
   * Maximum allowable payload size for blocks JSON (500 KB limit).
   * Firestore documents are capped at 1 MB; capping blocks at 500 KB reserves
   * headroom for metadata, versioning snapshots, and system indexing.
   */
  public static readonly MAX_BLOCKS_PAYLOAD_BYTES = 500 * 1024;

  /**
   * Recursively traverses an array of PageBlocks and extracts all author text
   * to populate the searchable `content` plain-text string cache.
   *
   * Handles:
   * - Standard text props (`content`, `title`, `subtitle`, `description`, `text`, `heading`)
   * - List and FAQ items arrays (`items` containing strings or objects)
   * - Nested layout blocks (`columns`, `container`)
   */
  public static extractPlainTextFromBlocks(
    blocks?: PageBlock[],
    depth = 0
  ): string {
    if (!Array.isArray(blocks) || blocks.length === 0 || depth > this.MAX_BLOCK_TRAVERSAL_DEPTH) {
      return '';
    }

    const segments: string[] = [];

    for (const block of blocks) {
      if (!block || typeof block !== 'object' || !block.props) continue;

      const props = block.props as Record<string, unknown>;

      // 1. Direct text properties across editorial, media, title, and cta blocks
      const directProps = [
        'content',
        'title',
        'subtitle',
        'subheading',
        'description',
        'text',
        'heading',
        'caption',
        'kicker',
        'quote',
        'author',
        'alt',
        'buttonText',
      ];
      for (const key of directProps) {
        const val = props[key];
        if (typeof val === 'string' && val.trim().length > 0) {
          segments.push(val.trim());
        }
      }

      // 2. Structured items collections (Lists, FAQs, Choice cards, Steps, Testimonials)
      if (Array.isArray(props.items)) {
        for (const item of props.items) {
          if (typeof item === 'string' && item.trim().length > 0) {
            segments.push(item.trim());
          } else if (item && typeof item === 'object') {
            const itemRec = item as Record<string, unknown>;
            const subProps = [
              'title',
              'content',
              'text',
              'description',
              'question',
              'answer',
              'quote',
              'author',
              'role',
              'company',
              'label',
              'subheading',
              'caption',
            ];
            for (const subKey of subProps) {
              const subVal = itemRec[subKey];
              if (typeof subVal === 'string' && subVal.trim().length > 0) {
                segments.push(subVal.trim());
              }
            }
          }
        }
      }

      // 3. Nested layout blocks (columns, containers)
      if (Array.isArray(block.blocks) && block.blocks.length > 0) {
        const nestedText = this.extractPlainTextFromBlocks(block.blocks, depth + 1);
        if (nestedText) segments.push(nestedText);
      }
    }

    // Join with clean paragraphs and deduplicate excess newlines
    return segments.join('\n\n').replace(/\n{3,}/g, '\n\n');
  }

  /**
   * Validates that the block tree does not exceed safe Firestore document size limits
   * and contains no raw base64 data URIs.
   */
  public static validateBlockPayloadSize(blocks?: PageBlock[]): void {
    if (!blocks || blocks.length === 0) return;

    const serialized = JSON.stringify(blocks);
    const byteLength = Buffer.byteLength(serialized, 'utf8');

    if (byteLength > this.MAX_BLOCKS_PAYLOAD_BYTES) {
      throw new Error(
        `Block content exceeds the maximum size limit of 500 KB (current: ${Math.round(byteLength / 1024)} KB). Please optimize media by linking to uploaded assets rather than embedding large payloads.`
      );
    }

    // Disallow base64 data URIs
    if (serialized.includes('data:image/') || serialized.includes('data:video/')) {
      throw new Error(
        'Raw base64 media embedded directly into blocks is prohibited. Please use the media uploader to store images in cloud storage.'
      );
    }
  }

  /**
   * Cleans and normalizes a string into a URL-safe kebab-case slug.
   */
  public static sanitizeSlug(raw: string): string {
    return raw
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Generates a unique slug within a portal and content type namespace.
   */
  public static async generateUniqueContentSlug(
    portalId: string,
    type: ContentItemType,
    preferredTitle: string
  ): Promise<string> {
    const baseSlug = this.sanitizeSlug(preferredTitle) || `${type}-${Date.now()}`;
    let candidate = baseSlug;
    let suffix = 1;

    while (true) {
      const snapshot = await adminDb
        .collection(this.COLLECTION)
        .where('portalId', '==', portalId)
        .where('type', '==', type)
        .where('slug', '==', candidate)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return candidate;
      }

      suffix += 1;
      candidate = `${baseSlug}-${suffix}`;
    }
  }

  /**
   * Creates a new ContentItem and initializes version 1 in history.
   */
  public static async createContentItem(
    input: CreateContentItemInput,
    userId: string
  ): Promise<ContentItem> {
    if (!input.title?.trim()) {
      throw new Error('Content title is required.');
    }
    if (!input.portalId || !input.organizationId) {
      throw new Error('portalId and organizationId are required.');
    }

    const docRef = adminDb.collection(this.COLLECTION).doc();
    const now = new Date().toISOString();

    const slug = input.slug
      ? this.sanitizeSlug(input.slug)
      : await this.generateUniqueContentSlug(input.portalId, input.type, input.title);

    const initialStatus: ContentStatus = input.status || 'draft';

    if (input.blocks && input.blocks.length > 0) {
      this.validateBlockPayloadSize(input.blocks);
    }

    const synthesizedContent = input.blocks && input.blocks.length > 0
      ? this.extractPlainTextFromBlocks(input.blocks)
      : (input.content || '');

    const newItem: ContentItem = {
      id: docRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      workspaceIds: input.workspaceIds?.length ? input.workspaceIds : ['default'],
      type: input.type,
      title: input.title.trim(),
      slug,
      summary: input.summary?.trim() || undefined,
      content: synthesizedContent,
      blocks: input.blocks || [],
      pageDocumentId: input.pageDocumentId || undefined,
      media: input.media || undefined,
      category: input.category?.trim() || 'General',
      tags: input.tags || [],
      authors: input.authors || [],
      status: initialStatus,
      publishedAt: initialStatus === 'published' ? now : undefined,
      scheduledAt: input.scheduledAt || undefined,
      visibility: input.visibility || 'public',
      accessRoles: input.accessRoles || [],
      requiredPlanIds: input.requiredPlanIds || [],
      teaserMode: input.teaserMode || 'first_block',
      customPaywall: input.customPaywall || undefined,
      seo: input.seo || {
        metaTitle: input.title.trim(),
        metaDescription: input.summary?.trim() || undefined,
      },
      stats: {
        viewCount: 0,
        readCount: 0,
        completionCount: 0,
        downloadCount: 0,
        likeCount: 0,
        shareCount: 0,
      },
      order: input.order ?? 0,
      parentId: input.parentId || undefined,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    };

    await docRef.set(newItem);

    // Create initial revision snapshot in subcollection with block AST
    const versionRef = docRef.collection('versions').doc('v1');
    const initialVersion: ContentItemVersion = {
      id: 'v1',
      contentItemId: newItem.id,
      version: 1,
      title: newItem.title,
      summary: newItem.summary,
      content: newItem.content,
      blocks: newItem.blocks,
      media: newItem.media,
      pageDocumentId: newItem.pageDocumentId,
      createdBy: userId,
      createdAt: now,
      changeNote: 'Initial creation',
    };
    await versionRef.set(initialVersion);

    // Log Activity Event
    await PortalEventService.emitContentEvent(
      'content.created',
      {
        id: newItem.id,
        title: newItem.title,
        type: newItem.type,
        portalId: newItem.portalId,
        organizationId: newItem.organizationId,
        workspaceIds: newItem.workspaceIds,
      },
      userId
    );

    return newItem;
  }

  /**
   * Updates an existing content item and records a revision snapshot.
   */
  public static async updateContentItem(
    itemId: string,
    input: UpdateContentItemInput,
    userId: string
  ): Promise<ContentItem> {
    const docRef = adminDb.collection(this.COLLECTION).doc(itemId);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      throw new Error(`Content item ${itemId} not found.`);
    }

    const current = snapshot.data() as ContentItem;
    const now = new Date().toISOString();
    const nextVersion = current.version + 1;

    // Check slug uniqueness if changed
    let slug = current.slug;
    if (input.slug && input.slug !== current.slug) {
      slug = this.sanitizeSlug(input.slug);
    }

    if (input.blocks && input.blocks.length > 0) {
      this.validateBlockPayloadSize(input.blocks);
    }

    const blocks = input.blocks !== undefined ? input.blocks : current.blocks;
    let content = input.content !== undefined ? input.content : current.content;

    // Re-synthesize content cache if blocks are modified
    if (input.blocks !== undefined) {
      if (input.blocks.length > 0) {
        content = this.extractPlainTextFromBlocks(input.blocks);
      } else {
        content = input.content !== undefined ? input.content : '';
      }
    }

    const updatedItem: ContentItem = {
      ...current,
      title: input.title !== undefined ? input.title.trim() : current.title,
      slug,
      summary: input.summary !== undefined ? input.summary.trim() : current.summary,
      content,
      blocks,
      pageDocumentId: input.pageDocumentId !== undefined ? input.pageDocumentId : current.pageDocumentId,
      media: input.media !== undefined ? input.media : current.media,
      category: input.category !== undefined ? input.category.trim() : current.category,
      tags: input.tags !== undefined ? input.tags : current.tags,
      authors: input.authors !== undefined ? input.authors : current.authors,
      status: input.status !== undefined ? input.status : current.status,
      scheduledAt: input.scheduledAt !== undefined ? input.scheduledAt : current.scheduledAt,
      visibility: input.visibility !== undefined ? input.visibility : current.visibility,
      accessRoles: input.accessRoles !== undefined ? input.accessRoles : current.accessRoles,
      requiredPlanIds: input.requiredPlanIds !== undefined ? input.requiredPlanIds : (current.requiredPlanIds || []),
      teaserMode: input.teaserMode !== undefined ? input.teaserMode : (current.teaserMode || 'first_block'),
      customPaywall: input.customPaywall !== undefined ? input.customPaywall : current.customPaywall,
      seo: input.seo !== undefined ? input.seo : current.seo,
      order: input.order !== undefined ? input.order : current.order,
      parentId: input.parentId !== undefined ? input.parentId : current.parentId,
      workspaceIds: input.workspaceIds !== undefined ? input.workspaceIds : current.workspaceIds,
      version: nextVersion,
      updatedAt: now,
      updatedBy: userId,
    };

    // If transitioning to published for the first time
    if (updatedItem.status === 'published' && !updatedItem.publishedAt) {
      updatedItem.publishedAt = now;
    }

    await docRef.set(updatedItem);

    // Save version history snapshot with block AST
    const versionRef = docRef.collection('versions').doc(`v${nextVersion}`);
    const revision: ContentItemVersion = {
      id: `v${nextVersion}`,
      contentItemId: itemId,
      version: nextVersion,
      title: updatedItem.title,
      summary: updatedItem.summary,
      content: updatedItem.content,
      blocks: updatedItem.blocks,
      media: updatedItem.media,
      pageDocumentId: updatedItem.pageDocumentId,
      createdBy: userId,
      createdAt: now,
      changeNote: input.changeNote || `Updated to revision v${nextVersion}`,
    };
    await versionRef.set(revision);

    return updatedItem;
  }

  /**
   * Publishes a content item immediately.
   */
  public static async publishContentItem(itemId: string, userId: string): Promise<ContentItem> {
    return this.updateContentItem(
      itemId,
      { status: 'published', changeNote: 'Published content' },
      userId
    );
  }

  /**
   * Archives a content item.
   */
  public static async archiveContentItem(itemId: string, userId: string): Promise<ContentItem> {
    return this.updateContentItem(
      itemId,
      { status: 'archived', changeNote: 'Archived content' },
      userId
    );
  }

  /**
   * Permanently deletes a content item and its revision history.
   */
  public static async deleteContentItem(itemId: string): Promise<void> {
    const docRef = adminDb.collection(this.COLLECTION).doc(itemId);
    
    // Delete versions subcollection
    const versions = await docRef.collection('versions').get();
    const batch = adminDb.batch();
    versions.docs.forEach(v => batch.delete(v.ref));
    batch.delete(docRef);
    await batch.commit();
  }

  /**
   * Retrieves a single content item by ID.
   */
  public static async getContentItemById(itemId: string): Promise<ContentItem | null> {
    const doc = await adminDb.collection(this.COLLECTION).doc(itemId).get();
    if (!doc.exists) return null;
    return doc.data() as ContentItem;
  }

  /**
   * Retrieves a single content item by portal ID, content type, and slug.
   */
  public static async getContentItemBySlug(
    portalId: string,
    type: ContentItemType,
    slug: string
  ): Promise<ContentItem | null> {
    const snapshot = await adminDb
      .collection(this.COLLECTION)
      .where('portalId', '==', portalId)
      .where('type', '==', type)
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as ContentItem;
  }

  /**
   * Lists content items for a portal with filtering and pagination.
   */
  public static async listContentItems(
    portalId: string,
    options: ContentFilterOptions = {}
  ): Promise<ContentItem[]> {
    let q: FirebaseFirestore.Query = adminDb
      .collection(this.COLLECTION)
      .where('portalId', '==', portalId);

    if (options.type) {
      q = q.where('type', '==', options.type);
    }
    if (options.status) {
      q = q.where('status', '==', options.status);
    }
    if (options.category) {
      q = q.where('category', '==', options.category);
    }
    if (options.workspaceId && options.workspaceId !== 'global') {
      q = q.where('workspaceIds', 'array-contains', options.workspaceId);
    }

    const limitCount = options.limitCount || 50;
    q = q.limit(limitCount);

    const snapshot = await q.get();
    return snapshot.docs.map(doc => doc.data() as ContentItem);
  }

  /**
   * Unified full-text search across content items within a portal.
   */
  public static async searchPortalContent(
    portalId: string,
    searchQuery: string,
    filters: ContentFilterOptions = {}
  ): Promise<ContentSearchResult[]> {
    const cleanQuery = searchQuery.trim().toLowerCase();
    if (!cleanQuery) return [];

    // Fetch published content items for the portal
    const items = await this.listContentItems(portalId, {
      ...filters,
      status: filters.status || 'published',
      limitCount: 100,
    });

    const results: ContentSearchResult[] = [];

    for (const item of items) {
      const matchedFields: string[] = [];
      let matchScore = 0;
      let snippet = item.summary || '';

      const titleMatch = item.title.toLowerCase().includes(cleanQuery);
      if (titleMatch) {
        matchedFields.push('title');
        matchScore += 10;
      }

      const summaryMatch = item.summary?.toLowerCase().includes(cleanQuery);
      if (summaryMatch) {
        matchedFields.push('summary');
        matchScore += 5;
      }

      const tagMatch = item.tags?.some(t => t.toLowerCase().includes(cleanQuery));
      if (tagMatch) {
        matchedFields.push('tags');
        matchScore += 4;
      }

      const categoryMatch = item.category?.toLowerCase().includes(cleanQuery);
      if (categoryMatch) {
        matchedFields.push('category');
        matchScore += 3;
      }

      const bodyMatch = item.content?.toLowerCase().includes(cleanQuery);
      if (bodyMatch) {
        matchedFields.push('content');
        matchScore += 2;
        // Extract surrounding snippet
        if (item.content) {
          const idx = item.content.toLowerCase().indexOf(cleanQuery);
          const start = Math.max(0, idx - 40);
          const end = Math.min(item.content.length, idx + cleanQuery.length + 80);
          snippet = `…${item.content.slice(start, end).replace(/\n/g, ' ')}…`;
        }
      }

      if (matchScore > 0) {
        results.push({
          item,
          matchScore,
          matchedFields,
          snippet,
        });
      }
    }

    // Sort by match score descending
    return results.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Persists a custom block arrangement as a reusable portal content template.
   */
  public static async createPortalContentTemplate(
    input: CreatePortalContentTemplateInput,
    userId: string = 'system'
  ): Promise<PortalContentTemplate> {
    if (!input.name.trim()) {
      throw new Error('Template name is required.');
    }
    if (!input.blocks || input.blocks.length === 0) {
      throw new Error('Cannot save an empty template. Please add at least one block.');
    }
    this.validateBlockPayloadSize(input.blocks);

    const now = new Date().toISOString();
    const docRef = adminDb.collection(this.TEMPLATES_COLLECTION).doc();
    const template: PortalContentTemplate = {
      id: docRef.id,
      portalId: input.portalId,
      organizationId: input.organizationId,
      name: input.name.trim(),
      description: input.description.trim(),
      category: input.category || 'custom',
      blocks: input.blocks,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };

    await docRef.set(template);
    return template;
  }

  /**
   * Lists custom content templates created for a specific portal.
   */
  public static async listPortalContentTemplates(
    portalId: string
  ): Promise<PortalContentTemplate[]> {
    const snap = await adminDb
      .collection(this.TEMPLATES_COLLECTION)
      .where('portalId', '==', portalId)
      .get();

    return snap.docs.map((doc) => doc.data() as PortalContentTemplate);
  }

  /**
   * Persists an in-progress auto-save draft to Firestore for multi-device recovery.
   */
  public static async saveDraft(draft: ContentStudioDraft): Promise<void> {
    if (!draft.portalId || !draft.organizationId) {
      throw new Error('portalId and organizationId are required to save a draft.');
    }
    const docId = draft.id || `${draft.portalId}_${draft.contentItemId || 'new_' + draft.authorId}`;
    const docRef = adminDb.collection(this.DRAFTS_COLLECTION).doc(docId);
    await docRef.set({
      ...draft,
      id: docId,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Fetches an active cloud draft for a specific portal content item.
   */
  public static async getDraft(
    portalId: string,
    contentItemId: string | null,
    authorId?: string
  ): Promise<ContentStudioDraft | null> {
    const docId = `${portalId}_${contentItemId || 'new_' + (authorId || 'default')}`;
    const doc = await adminDb.collection(this.DRAFTS_COLLECTION).doc(docId).get();
    if (!doc.exists) return null;
    return doc.data() as ContentStudioDraft;
  }

  /**
   * Discards an active cloud draft.
   */
  public static async discardDraft(
    portalId: string,
    contentItemId: string | null,
    authorId?: string
  ): Promise<void> {
    const docId = `${portalId}_${contentItemId || 'new_' + (authorId || 'default')}`;
    await adminDb.collection(this.DRAFTS_COLLECTION).doc(docId).delete();
  }

  /**
   * Lists all active unsaved cloud drafts for a specific portal (for backoffice management).
   */
  public static async listDraftsByPortal(
    portalId: string
  ): Promise<ContentStudioDraft[]> {
    const snap = await adminDb
      .collection(this.DRAFTS_COLLECTION)
      .where('portalId', '==', portalId)
      .orderBy('updatedAt', 'desc')
      .get();

    return snap.docs.map((doc) => doc.data() as ContentStudioDraft);
  }
}
