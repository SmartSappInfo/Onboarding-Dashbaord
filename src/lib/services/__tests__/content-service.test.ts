import { describe, it, expect } from 'vitest';
import { ContentService } from '../content-service';
import type { PageBlock } from '@/lib/types';

describe('ContentService', () => {
  describe('Slug Sanitization', () => {
    it('converts article titles into clean kebab-case slugs', () => {
      expect(
        ContentService.sanitizeSlug('5 Automated WhatsApp Strategies to Eliminate Late Fee Payments!')
      ).toBe('5-automated-whatsapp-strategies-to-eliminate-late-fee-payments');

      expect(
        ContentService.sanitizeSlug('Module 1: Invoicing Automation Architecture & USSD Setup')
      ).toBe('module-1-invoicing-automation-architecture-ussd-setup');

      expect(
        ContentService.sanitizeSlug('   leading & trailing spaces   ')
      ).toBe('leading-trailing-spaces');

      expect(
        ContentService.sanitizeSlug('Special @#$$% Characters & Symbols')
      ).toBe('special-characters-symbols');
    });
  });

  describe('AST Plain-Text Extraction (extractPlainTextFromBlocks)', () => {
    it('extracts plain text from standard blocks with title and content props', () => {
      const blocks: PageBlock[] = [
        {
          id: 'b1',
          type: 'title',
          props: { content: 'Introduction to Bursary Accounting' },
        },
        {
          id: 'b2',
          type: 'text',
          props: { content: 'This lesson covers the fundamentals of fee collections.' },
        },
      ];

      const extracted = ContentService.extractPlainTextFromBlocks(blocks);
      expect(extracted).toContain('Introduction to Bursary Accounting');
      expect(extracted).toContain('This lesson covers the fundamentals of fee collections.');
    });

    it('extracts text from nested layout blocks (columns and containers)', () => {
      const blocks: PageBlock[] = [
        {
          id: 'col1',
          type: 'columns',
          props: { columnsCount: 2 },
          blocks: [
            {
              id: 'c1',
              type: 'container',
              props: {},
              blocks: [
                {
                  id: 't1',
                  type: 'title',
                  props: { title: 'Column 1 Heading' },
                },
                {
                  id: 'p1',
                  type: 'text',
                  props: { text: 'Paragraph inside nested column container.' },
                },
              ],
            },
          ],
        },
      ];

      const extracted = ContentService.extractPlainTextFromBlocks(blocks);
      expect(extracted).toContain('Column 1 Heading');
      expect(extracted).toContain('Paragraph inside nested column container.');
    });

    it('extracts text from structured list collections (procedure lists and FAQs)', () => {
      const blocks: PageBlock[] = [
        {
          id: 'list1',
          type: 'procedure_list',
          props: {
            items: [
              { title: 'Step 1: Reconcile daily cash receipts', description: 'Match receipts against daily bank slips' },
              { title: 'Step 2: Post to student ledger', description: 'Update term balance' },
            ],
          },
        },
        {
          id: 'faq1',
          type: 'faq',
          props: {
            items: [
              { question: 'What is the refund turnaround?', answer: 'Within 5 business days.' },
            ],
          },
        },
      ];

      const extracted = ContentService.extractPlainTextFromBlocks(blocks);
      expect(extracted).toContain('Step 1: Reconcile daily cash receipts');
      expect(extracted).toContain('Match receipts against daily bank slips');
      expect(extracted).toContain('Step 2: Post to student ledger');
      expect(extracted).toContain('What is the refund turnaround?');
      expect(extracted).toContain('Within 5 business days.');
    });

    it('safely handles empty arrays, undefined, and malformed blocks without throwing', () => {
      expect(ContentService.extractPlainTextFromBlocks([])).toBe('');
      expect(ContentService.extractPlainTextFromBlocks(undefined)).toBe('');
      const malformed: PageBlock[] = [
        { id: 'm1', type: 'divider', props: {} },
        { id: 'm2', type: 'spacer', props: { height: 40 } },
      ];
      expect(ContentService.extractPlainTextFromBlocks(malformed)).toBe('');
    });

    it('respects recursion depth limit to guard against circular references', () => {
      // Create a deep structure past depth limit 10
      let current: PageBlock = {
        id: 'leaf',
        type: 'text',
        props: { content: 'Deepest Text' },
      };

      for (let i = 0; i < 15; i++) {
        current = {
          id: `level-${i}`,
          type: 'container',
          props: {},
          blocks: [current],
        };
      }

      // Traversal past depth 10 will halt gracefully without stack overflow
      expect(() => ContentService.extractPlainTextFromBlocks([current])).not.toThrow();
    });
  });

  describe('Payload Size & Quota Validation (validateBlockPayloadSize)', () => {
    it('passes for standard size block trees', () => {
      const normalBlocks: PageBlock[] = [
        { id: 'b1', type: 'title', props: { content: 'Normal Title' } },
        { id: 'b2', type: 'text', props: { content: 'Normal Content' } },
      ];
      expect(() => ContentService.validateBlockPayloadSize(normalBlocks)).not.toThrow();
    });

    it('rejects raw base64 data URIs embedded directly in block props', () => {
      const base64Blocks: PageBlock[] = [
        {
          id: 'img1',
          type: 'image',
          props: {
            url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          },
        },
      ];
      expect(() => ContentService.validateBlockPayloadSize(base64Blocks)).toThrow(
        /Raw base64 media embedded directly into blocks is prohibited/
      );
    });

    it('rejects payloads exceeding the 500 KB quota', () => {
      const massiveString = 'A'.repeat(550 * 1024);
      const oversizedBlocks: PageBlock[] = [
        {
          id: 'huge1',
          type: 'text',
          props: { content: massiveString },
        },
      ];
      expect(() => ContentService.validateBlockPayloadSize(oversizedBlocks)).toThrow(
        /exceeds the maximum size limit of 500 KB/
      );
    });
  });
});

