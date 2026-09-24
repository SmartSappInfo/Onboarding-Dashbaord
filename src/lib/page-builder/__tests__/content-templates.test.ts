import { describe, it, expect } from 'vitest';
import {
  CONTENT_STARTER_TEMPLATES,
  instantiateContentTemplate,
  type ContentStarterTemplate,
} from '../templates/content-templates';
import {
  getContentStudioBlocks,
  getContentStudioBlockCategories,
  validateBlockProps,
  getBlock,
} from '../registry';
import { ContentService } from '@/lib/services/content-service';
import '@/lib/page-builder/blocks'; // Register all blocks

describe('Phase 2: Shared Content Templates & Registry Filtering', () => {
  describe('Starter Templates Catalog', () => {
    it('provides all 4 core starter templates with rich initial structures', () => {
      expect(CONTENT_STARTER_TEMPLATES.length).toBeGreaterThanOrEqual(4);

      const expectedIds = [
        'article-standard-starter',
        'lesson-curriculum-starter',
        'resource-download-starter',
        'documentation-kb-starter',
      ];

      for (const id of expectedIds) {
        const tpl = CONTENT_STARTER_TEMPLATES.find((t: ContentStarterTemplate) => t.id === id);
        expect(tpl, `Template "${id}" should exist in CONTENT_STARTER_TEMPLATES`).toBeDefined();
        expect(tpl?.blocks.length).toBeGreaterThan(0);
        expect(tpl?.name).toBeTruthy();
        expect(tpl?.description).toBeTruthy();
        expect(tpl?.badge).toBeTruthy();
        expect(tpl?.category).toBeTruthy();
      }
    });

    it('validates every block in each starter template against its registered Zod schema', () => {
      for (const tpl of CONTENT_STARTER_TEMPLATES) {
        for (const block of tpl.blocks) {
          const def = getBlock(block.type);
          expect(def, `Block type "${block.type}" in template "${tpl.id}" must be registered`).toBeDefined();

          // Ensure props validate cleanly through registered Zod schemas
          const parsed = validateBlockProps(block);
          expect(parsed, `Props for block "${block.id}" in template "${tpl.id}" must be valid`).toBeDefined();
        }
      }
    });

    it('instantiateContentTemplate deep-clones blocks and assigns unique IDs', () => {
      const original = CONTENT_STARTER_TEMPLATES[0];
      const instance1 = instantiateContentTemplate(original.id);
      const instance2 = instantiateContentTemplate(original.id);

      expect(instance1.length).toBe(original.blocks.length);
      expect(instance2.length).toBe(original.blocks.length);

      // Verify IDs are distinct from the original template and from each other
      for (let i = 0; i < instance1.length; i++) {
        expect(instance1[i].id).not.toBe(original.blocks[i].id);
        expect(instance1[i].id).not.toBe(instance2[i].id);
        expect(instance1[i].type).toBe(original.blocks[i].type);
      }
    });

    it('extracts searchable plain text from starter templates for search parity', () => {
      for (const tpl of CONTENT_STARTER_TEMPLATES) {
        const text = ContentService.extractPlainTextFromBlocks(tpl.blocks);
        expect(text.trim().length, `Template ${tpl.id} must synthesize non-empty text`).toBeGreaterThan(20);
      }
    });
  });

  describe('Content Studio Registry Filter (getContentStudioBlocks)', () => {
    it('filters out landing-page campaign bloat while retaining editorial and media blocks', () => {
      const studioBlocks = getContentStudioBlocks();
      const types = studioBlocks.map((b) => b.type);

      // Must include essential editorial, media, and layout blocks
      expect(types).toContain('title');
      expect(types).toContain('text');
      expect(types).toContain('video');
      expect(types).toContain('image');
      expect(types).toContain('columns');
      expect(types).toContain('container');
      expect(types).toContain('procedure_list');
      expect(types).toContain('step_section');
      expect(types).toContain('faq');
      expect(types).toContain('divider');
      expect(types).toContain('spacer');
      expect(types).toContain('cta');
      expect(types).toContain('testimonial');

      // Must exclude campaign and marketing landing-page bloat
      expect(types).not.toContain('countdown');
      expect(types).not.toContain('app_download');
      expect(types).not.toContain('payment_methods');
      expect(types).not.toContain('logo_grid');
    });

    it('provides organized block categories with plain-English labels for the studio palette', () => {
      const categories = getContentStudioBlockCategories();
      expect(categories.length).toBeGreaterThanOrEqual(4);

      const categoryKeys = categories.map((c) => c.category);
      expect(categoryKeys).toContain('text');
      expect(categoryKeys).toContain('media');
      expect(categoryKeys).toContain('lists');
      expect(categoryKeys).toContain('layout');

      // Every block in each category must be a valid studio block
      const studioBlocks = getContentStudioBlocks();
      const studioTypes = new Set(studioBlocks.map((b) => b.type));

      for (const cat of categories) {
        expect(cat.label).toBeTruthy();
        expect(cat.description).toBeTruthy();
        for (const type of cat.types) {
          expect(studioTypes.has(type), `Type "${type}" in category "${cat.category}" must be in studio blocks`).toBe(true);
        }
      }
    });
  });
});
