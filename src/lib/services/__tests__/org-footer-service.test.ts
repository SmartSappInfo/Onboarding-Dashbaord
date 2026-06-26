import { describe, it, expect } from 'vitest';
import { 
    resolveOrgFooter, 
    htmlContainsFooter, 
    ORG_FOOTER_SENTINEL, 
    DEFAULT_ORG_FOOTER_HTML,
    type OrgFooterVariables 
} from '../org-footer-service';

describe('org-footer-service', () => {
    const mockVars: OrgFooterVariables = {
        unsubscribe_copy: 'You are receiving this email because you subscribed to our services.',
        unsubscribe_link: 'https://example.com/unsubscribe/token123',
        org_name: 'Test Academy',
        org_address: '123 Test Lane, Suite A',
        org_email: 'support@testacademy.edu',
        org_phone: '+1 (555) 987-6543',
        org_website: 'https://testacademy.edu',
        current_year: '2026',
        brand_primary_color: '#3B5FFF',
    };

    describe('resolveOrgFooter', () => {
        it('should render all tokens correctly with custom footerHtml', () => {
            const customFooter = '<div style="color: {{brand_primary_color}};">{{org_name}} • {{org_address}} • {{org_email}} • {{org_phone}} • {{org_website}} • {{current_year}} • <a href="{{unsubscribe_link}}">{{unsubscribe_copy}}</a></div>';
            const result = resolveOrgFooter(customFooter, true, mockVars);

            expect(result).toContain(ORG_FOOTER_SENTINEL);
            expect(result).toContain('color: #3B5FFF');
            expect(result).toContain('Test Academy');
            expect(result).toContain('123 Test Lane, Suite A');
            expect(result).toContain('support@testacademy.edu');
            expect(result).toContain('+1 (555) 987-6543');
            expect(result).toContain('https://testacademy.edu');
            expect(result).toContain('2026');
            expect(result).toContain('https://example.com/unsubscribe/token123');
            expect(result).toContain('You are receiving this email because you subscribed to our services.');
        });

        it('should use DEFAULT_ORG_FOOTER_HTML when footerHtml is undefined', () => {
            const result = resolveOrgFooter(undefined, true, mockVars);

            expect(result).toContain(ORG_FOOTER_SENTINEL);
            expect(result).toContain('Test Academy');
            expect(result).toContain('123 Test Lane, Suite A');
            expect(result).toContain('support@testacademy.edu');
            expect(result).toContain('+1 (555) 987-6543');
            expect(result).toContain('unsubscribe here');
        });

        it('should return empty string when footerEnabled is false', () => {
            const customFooter = '<div>{{org_name}}</div>';
            const result = resolveOrgFooter(customFooter, false, mockVars);

            expect(result).toBe('');
        });

        it('should handle simple conditionals correctly', () => {
            const conditionalFooter = '<div>{{org_name}}{{#if org_address}} - {{org_address}}{{/if}}{{#if org_contact}} - Contact: {{org_contact}}{{/if}}</div>';
            const result = resolveOrgFooter(conditionalFooter, true, mockVars);

            expect(result).toContain('Test Academy - 123 Test Lane, Suite A - Contact: +1 (555) 987-6543  •  support@testacademy.edu');
        });

        it('should remove conditional blocks if value is empty/falsy', () => {
            const conditionalFooter = '<div>{{org_name}}{{#if org_address}} - {{org_address}}{{/if}}</div>';
            const emptyAddressVars: OrgFooterVariables = {
                ...mockVars,
                org_address: '',
            };
            const result = resolveOrgFooter(conditionalFooter, true, emptyAddressVars);

            expect(result).not.toContain(' - ');
            expect(result).toContain('Test Academy');
        });
    });

    describe('htmlContainsFooter', () => {
        it('should return true if HTML contains the sentinel comment', () => {
            const html = `<html><body><div>Content</div>\n${ORG_FOOTER_SENTINEL}\n<div>Footer</div></body></html>`;
            expect(htmlContainsFooter(html)).toBe(true);
        });

        it('should return true if HTML contains the {{org_footer}} token placeholder', () => {
            const html = '<html><body><div>Content</div>{{org_footer}}</body></html>';
            expect(htmlContainsFooter(html)).toBe(true);
        });

        it('should return false if HTML does not contain sentinel or token', () => {
            const html = '<html><body><div>Content</div><div class="footer">Plain Footer</div></body></html>';
            expect(htmlContainsFooter(html)).toBe(false);
        });
    });
});
