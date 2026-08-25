import { describe, it, expect } from 'vitest';
import { blockRegistry } from '../registry';
import '../blocks'; // import and register all blocks

describe('Portal Page Builder Blocks Registry', () => {
  const PORTAL_BLOCK_TYPES = [
    'portal_course_list',
    'portal_lesson_list',
    'portal_member_profile',
    'portal_membership_status',
    'portal_upcoming_events',
    'portal_community_feed',
    'portal_certificates',
    'portal_my_tasks',
    'portal_ai_tutor',
    'portal_search',
    'portal_related_content',
    'portal_resource_vault',
  ] as const;

  it('registers all 12 Portal-specific blocks in the blockRegistry', () => {
    PORTAL_BLOCK_TYPES.forEach(type => {
      const def = blockRegistry[type];
      expect(def).toBeDefined();
      expect(def?.type).toBe(type);
      expect(def?.category).toBe('portal');
      expect(def?.label).toBeDefined();
      expect(typeof def?.render).toBe('function');
    });
  });

  it('validates that each portal block schema parses its default props cleanly', () => {
    PORTAL_BLOCK_TYPES.forEach(type => {
      const def = blockRegistry[type];
      expect(def).toBeDefined();
      if (def) {
        const parsed = def.schema.safeParse(def.defaults);
        expect(parsed.success).toBe(true);
      }
    });
  });
});
