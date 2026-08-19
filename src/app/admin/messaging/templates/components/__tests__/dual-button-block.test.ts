import { describe, it, expect } from 'vitest';
import type { MessageBlock } from '@/lib/types';
import { renderBlocksToHtml } from '@/lib/messaging-utils';
import { resolveButtonPadding, ensureUnit } from '../visual-block';

/**
 * PURPOSE: Comprehensive Vitest suite validating dual-button block behavior,
 * HTML email generation, security sanitisation, and variable token resolution.
 *
 * RELATED SURFACES: types.ts, messaging-utils.ts, visual-block.tsx, block-inspector.tsx.
 */
describe('Dual-Button Block Implementation', () => {
    const mockVariables = {
        contact_name: 'John Doe',
        action_url: 'https://smart-sapp.com/activate',
        secondary_url: '/learn-more',
    };

    it('supports dual-button block objects in MessageBlock type structure', () => {
        const dualBlock: MessageBlock = {
            id: 'blk_test_1',
            type: 'dual-button',
            title: 'Primary CTA',
            link: 'https://example.com/primary',
            secondaryTitle: 'Secondary Action',
            secondaryLink: 'https://example.com/secondary',
            style: {
                variant: 'default',
                backgroundColor: '#2563eb',
                color: '#ffffff',
            },
            secondaryStyle: {
                variant: 'outline',
                backgroundColor: 'transparent',
                color: '#2563eb',
                borderColor: '#2563eb',
            },
        };

        expect(dualBlock.type).toBe('dual-button');
        expect(dualBlock.title).toBe('Primary CTA');
        expect(dualBlock.secondaryTitle).toBe('Secondary Action');
        expect(dualBlock.secondaryStyle?.variant).toBe('outline');
    });

    it('exports dual-button blocks to Outlook-compatible HTML with two anchor tags', () => {
        const dualBlock: MessageBlock = {
            id: 'blk_test_2',
            type: 'dual-button',
            title: 'Enroll Now',
            link: 'https://example.com/enroll',
            secondaryTitle: 'View Syllabus',
            secondaryLink: 'https://example.com/syllabus',
            style: {
                variant: 'default',
                backgroundColor: '#2563eb',
                color: '#ffffff',
            },
            secondaryStyle: {
                variant: 'ghost',
                color: '#4b5563',
            },
        };

        const html = renderBlocksToHtml([dualBlock], mockVariables);

        expect(html).toContain('href="https://example.com/enroll"');
        expect(html).toContain('href="https://example.com/syllabus"');
        expect(html).toContain('Enroll Now');
        expect(html).toContain('View Syllabus');
        // Ensure inline-block styling is present for Outlook compat
        expect(html).toContain('display: inline-block');
    });

    it('sanitises dangerous javascript: URLs in primary and secondary links', () => {
        const maliciousBlock: MessageBlock = {
            id: 'blk_test_3',
            type: 'dual-button',
            title: 'Safe Primary',
            link: 'javascript:alert("hacked_primary")',
            secondaryTitle: 'Safe Secondary',
            secondaryLink: 'javascript:alert("hacked_secondary")',
        };

        const html = renderBlocksToHtml([maliciousBlock], mockVariables);

        expect(html).not.toContain('javascript:alert');
        expect(html).toContain('href="#"');
    });

    it('resolves {{variable}} tokens in primary and secondary button titles and links', () => {
        const dynamicBlock: MessageBlock = {
            id: 'blk_test_4',
            type: 'dual-button',
            title: 'Hello {{contact_name}}',
            link: '{{action_url}}',
            secondaryTitle: 'Learn More {{contact_name}}',
            secondaryLink: '{{secondary_url}}',
        };

        const html = renderBlocksToHtml([dynamicBlock], mockVariables);

        expect(html).toContain('Hello John Doe');
        expect(html).toContain('Learn More John Doe');
        expect(html).toContain('href="https://smart-sapp.com/activate"');
    });

    it('absolutises relative secondary links starting with /', () => {
        const relativeBlock: MessageBlock = {
            id: 'blk_test_5',
            type: 'dual-button',
            title: 'Primary',
            link: '/primary-path',
            secondaryTitle: 'Secondary',
            secondaryLink: '/secondary-path',
        };

        const html = renderBlocksToHtml([relativeBlock], {});

        expect(html).toContain('/primary-path');
        expect(html).toContain('/secondary-path');
        expect(html).not.toContain('href="/secondary-path"'); // Should be prefixed with base URL
    });

    it('resolves button padding correctly without creating invalid CSS units (never 12pxpx)', () => {
        // Test with string px values (e.g. from preset templates)
        const stringPadding = resolveButtonPadding('12px', '24px', '12px', '24px');
        expect(stringPadding).toBe('12px 24px 12px 24px');
        expect(stringPadding).not.toContain('pxpx');

        // Test with numeric values
        const numericPadding = resolveButtonPadding(14, 28, 14, 28);
        expect(numericPadding).toBe('14px 28px 14px 28px');

        // Test with undefined values (default fallbacks)
        const fallbackPadding = resolveButtonPadding(undefined, undefined, undefined, undefined, '14px', '28px');
        expect(fallbackPadding).toBe('14px 28px 14px 28px');
    });

    it('sanitises unit string values with ensureUnit correctly', () => {
        expect(ensureUnit('12px')).toBe('12px');
        expect(ensureUnit(12)).toBe('12px');
        expect(ensureUnit('2em')).toBe('2em');
        expect(ensureUnit(undefined)).toBe('');
    });
});
