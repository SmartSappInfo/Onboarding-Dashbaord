import { describe, it, expect } from 'vitest';
import {
    isInternalTemplate,
    isWorkspaceTemplate,
} from '@/app/admin/components/MessagingTemplateSelector';
import type { MessageTemplate } from '@/lib/types';

describe('MessagingTemplateSelector Filter Helpers', () => {
    it('correctly classifies internal team templates based on target property', () => {
        const tmpl: Partial<MessageTemplate> = {
            id: 'tmpl-1',
            target: 'internal_team',
            scope: 'global',
        };
        expect(isInternalTemplate(tmpl as MessageTemplate)).toBe(true);
    });

    it('correctly classifies internal team templates based on recipientType role', () => {
        const tmpl: Partial<MessageTemplate> = {
            id: 'tmpl-2',
            recipientType: 'internal_alert',
            scope: 'global',
        };
        expect(isInternalTemplate(tmpl as MessageTemplate)).toBe(true);
    });

    it('correctly classifies external recipient templates', () => {
        const tmpl: Partial<MessageTemplate> = {
            id: 'tmpl-3',
            target: 'external_client',
            recipientType: 'entity',
            scope: 'global',
        };
        expect(isInternalTemplate(tmpl as MessageTemplate)).toBe(false);
    });

    it('correctly classifies global scoped templates', () => {
        const tmpl: Partial<MessageTemplate> = {
            id: 'tmpl-4',
            scope: 'global',
        };
        expect(isWorkspaceTemplate(tmpl as MessageTemplate)).toBe(false);
    });

    it('correctly classifies organization and custom scoped templates', () => {
        const tmplOrg: Partial<MessageTemplate> = {
            id: 'tmpl-5',
            scope: 'organization',
            organizationId: 'org_123',
        };
        expect(isWorkspaceTemplate(tmplOrg as MessageTemplate)).toBe(true);

        const tmplWs: Partial<MessageTemplate> = {
            id: 'tmpl-6',
            scope: 'organization',
            workspaceIds: ['ws_456'],
        };
        expect(isWorkspaceTemplate(tmplWs as MessageTemplate)).toBe(true);
    });
});
