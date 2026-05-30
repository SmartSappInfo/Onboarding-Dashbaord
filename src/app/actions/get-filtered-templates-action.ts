'use server';

/**
 * ARCHITECTURAL NOTE (DO NOT DELETE):
 * Future messaging modules should exclusively use the SmartTemplateDropdown component. 
 * If a new blueprint type is added, update the RecipientType and TemplateCategory in types.ts 
 * and the getFilteredTemplatesAction will automatically handle the resolution.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { MessageTemplate, TemplateCategory, RecipientType, MessageChannel } from '@/lib/types';

interface FilterOptions {
    category: TemplateCategory | 'all';
    recipientType: RecipientType | 'all';
    channel: MessageChannel | 'all';
    workspaceId?: string;
    organizationId?: string;
}

function standardizeCategory(cat: string | undefined): string {
    if (!cat) return 'general';
    const c = cat.toLowerCase().trim();
    if (c === 'survey' || c === 'surveys') return 'surveys';
    if (c === 'meeting' || c === 'meetings') return 'meetings';
    if (c === 'form' || c === 'forms') return 'forms';
    if (c === 'agreement' || c === 'agreements') return 'agreements';
    if (c === 'campaign' || c === 'campaigns') return 'campaigns';
    if (c === 'reminder' || c === 'reminders') return 'reminders';
    if (c === 'task' || c === 'tasks') return 'tasks';
    if (c === 'automation' || c === 'automations') return 'automations';
    if (c === 'qr_codes' || c === 'qr codes' || c === 'qr_code') return 'qr_codes';
    if (c === 'user' || c === 'users') return 'users';
    return c;
}

/**
 * PHASE 3: Smart Filtering Service
 * Fetches templates matching strict criteria and applies Org > Global resolution.
 */
export async function getFilteredTemplatesAction(filters: FilterOptions): Promise<MessageTemplate[]> {
    const { category, recipientType, channel, workspaceId, organizationId } = filters;

    try {
        let queryRef: any = adminDb.collection('message_templates');
        
        // Fetch strictly by channel if specified and not 'all'
        if (channel && channel !== 'all') {
            queryRef = queryRef.where('channel', '==', channel);
        }

        const snap = await queryRef.get();
        let templates: MessageTemplate[] = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as MessageTemplate));

        console.log(`[getFilteredTemplatesAction] Fetched ${templates.length} templates for channel: ${channel}`);

        // Filter out archived ones
        templates = templates.filter(t => t.status !== 'archived' && t.isActive !== false);

        // Filter for External Client focused templates only
        // Keep: target === 'external_client', recipientType in (respondent, entity, external_alert, all)
        // Exclude: target === 'internal_team', recipientType in (internal_alert, assignee)
        templates = templates.filter(t => {
            // Explicitly internal — exclude
            if (t.target === 'internal_team') return false;
            if (t.recipientType === 'internal_alert' || t.recipientType === 'assignee') return false;

            // Explicitly external, or no target/recipientType set (include by default)
            return true;
        });

        // Deduplicate templates by their templateType or id to ensure no duplicates
        const seenTypes = new Set<string>();
        const resultTemplates: MessageTemplate[] = [];

        // Prioritize organization-specific templates if they match workspaceId or organizationId
        const orgTemplates = templates.filter(t => 
            t.scope === 'organization' && (
                (organizationId && t.organizationId === organizationId) || 
                (workspaceId && t.workspaceIds?.includes(workspaceId))
            )
        );

        for (const tmpl of orgTemplates) {
            if (tmpl.templateType) {
                seenTypes.add(tmpl.templateType);
            }
            resultTemplates.push(tmpl);
        }

        // Add remaining global or other organization templates
        for (const tmpl of templates) {
            if (tmpl.templateType && seenTypes.has(tmpl.templateType)) {
                continue;
            }
            if (resultTemplates.some(t => t.id === tmpl.id)) {
                continue;
            }
            resultTemplates.push(tmpl);
        }

        // Standardize category property on returned templates
        const standardized = resultTemplates.map(t => ({
            ...t,
            category: standardizeCategory(t.category) as any
        }));

        console.log(`[getFilteredTemplatesAction] Returning ${standardized.length} external client focused templates.`);
        return standardized;

    } catch (error) {
        console.error('Error fetching filtered templates:', error);
        return [];
    }
}
