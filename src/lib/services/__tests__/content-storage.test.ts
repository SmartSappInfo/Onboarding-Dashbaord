import { describe, it, expect } from 'vitest';
import type { ContentStudioDraft } from '@/lib/types/content';

describe('Content Studio Draft Storage Engine', () => {
  it('serializes and validates draft payload with all required metadata', () => {
    const draft: ContentStudioDraft = {
      id: 'portal_123_item_456',
      portalId: 'portal_123',
      organizationId: 'org_789',
      contentItemId: 'item_456',
      title: 'Guide to SmartSapp',
      slug: 'guide-to-smartsapp',
      type: 'article',
      summary: 'Comprehensive guide',
      category: 'General',
      tags: ['onboarding'],
      blocks: [{ id: 'b1', type: 'text', props: { content: 'Content' } }],
      visibility: 'public',
      media: {},
      authorId: 'user_1',
      authorName: 'Alex Smith',
      authorEmail: 'alex@example.com',
      savedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    const serialized = JSON.stringify(draft);
    const parsed = JSON.parse(serialized) as ContentStudioDraft;

    expect(parsed.portalId).toBe('portal_123');
    expect(parsed.blocks).toHaveLength(1);
    expect(new Date(parsed.savedAt).getTime()).toBeGreaterThan(0);
    expect(parsed.authorEmail).toBe('alex@example.com');
  });
});
