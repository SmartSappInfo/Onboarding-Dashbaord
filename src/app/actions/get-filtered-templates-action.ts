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
    category: TemplateCategory;
    recipientType: RecipientType;
    channel: MessageChannel;
    workspaceId?: string;
    organizationId?: string;
}

/**
 * PHASE 3: Smart Filtering Service
 * Fetches templates matching strict criteria and applies Org > Global resolution.
 */
export async function getFilteredTemplatesAction(filters: FilterOptions): Promise<MessageTemplate[]> {
    const { category, recipientType, channel, workspaceId, organizationId } = filters;

    try {
        // Run both global template search and organization overrides concurrently to reduce latency
        const [globalSnap, overrideSnap] = await Promise.all([
            adminDb.collection('message_templates')
                .where('scope', '==', 'global')
                .where('category', '==', category)
                .where('recipientType', '==', recipientType)
                .where('channel', '==', channel)
                .where('status', '==', 'active')
                .get(),
            workspaceId || organizationId
                ? adminDb.collection('message_templates')
                    .where('category', '==', category)
                    .where('recipientType', '==', recipientType)
                    .where('channel', '==', channel)
                    .where('status', '==', 'active')
                    .get()
                : Promise.resolve(null)
        ]);

        const globalTemplates = globalSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MessageTemplate));

        // 2. Fetch relevant Organization/Workspace Overrides
        let overrides: MessageTemplate[] = [];
        if (overrideSnap) {
            overrides = overrideSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as MessageTemplate))
                .filter(t => t.scope === 'organization' && (
                    (organizationId && t.organizationId === organizationId) || 
                    (workspaceId && t.workspaceIds?.includes(workspaceId))
                ));
        }

        // 3. Deduplicate (Org Overrides take precedence over Global Blueprints)
        // We use 'templateType' as the unique key for variants (e.g., 'forms_respondent_standard')
        const resultTemplates: MessageTemplate[] = [];
        const seenTypes = new Set<string>();

        // First, add overrides
        for (const tmpl of overrides) {
            if (tmpl.templateType) {
                seenTypes.add(tmpl.templateType);
            }
            resultTemplates.push(tmpl);
        }

        // Then, add global templates if no override exists for that type
        for (const tmpl of globalTemplates) {
            if (tmpl.templateType && seenTypes.has(tmpl.templateType)) {
                continue;
            }
            resultTemplates.push(tmpl);
        }

        // Sort by name for consistent UI
        return resultTemplates.sort((a, b) => a.name.localeCompare(b.name));

    } catch (error) {
        console.error('Error fetching filtered templates:', error);
        return [];
    }
}
