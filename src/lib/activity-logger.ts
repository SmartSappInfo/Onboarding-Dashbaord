'use server';

import { adminDb } from './firebase-admin';
import type { Activity, AutomationTrigger, EntityType } from './types';
import { triggerAutomationProtocols } from './automation-processor';
import { resolveContact } from './contact-adapter';

// Polyfill for unstable_after - run async work after response
const after = (fn: () => Promise<void>) => { fn().catch(console.error); };

type LogActivityInput = Omit<Activity, 'id' | 'timestamp'>;

/**
 * Logs an activity using the Firebase Admin SDK for reliability.
 * Upgraded to serve as the platform's primary Event Bus for the Automation Engine.
 * 
 * Updated to use the Contact Adapter Layer for backward compatibility (Requirement 18)
 * Updated for workspace awareness (Requirement 12)
 * Updated to fully support entity architecture.
 * Updated with Vercel Best Practices: Non-blocking automation triggers via after().
 */
export async function logActivity(activityData: LogActivityInput): Promise<void> {
    try {
        let finalData = { ...activityData };
        
        let entityId: string | null | undefined = activityData.entityId;
        let entityName: string | null | undefined = activityData.entityName;
        let entitySlug: string | null | undefined = activityData.entitySlug;
        let entityType: EntityType | null | undefined = activityData.entityType as EntityType;
        let displayName: string | null | undefined = activityData.displayName;
        
        // Resolution logic
        if (activityData.workspaceId) {
            if (entityId) {
                const contact = await resolveContact(entityId, activityData.workspaceId);
                if (contact) {
                    entityName = contact.name || entityName;
                    entitySlug = contact.slug || entitySlug;
                    entityType = contact.entityType || entityType;
                    displayName = contact.name || displayName;
                }
            }
        }
        
        // Update finalData with resolved fields
        finalData = {
            ...finalData,
            entityId: entityId || null,
            entityName: entityName || null,
            entitySlug: entitySlug || undefined,
            entityType: entityType || null,
            displayName: displayName || undefined,
        };

        // 3. Persist the Audit Log with all workspace-aware fields (Requirement 12)
        const docRef = await adminDb.collection('activities').add({
            ...finalData,
            timestamp: new Date().toISOString(),
        });

        // 4. BROADCAST TO AUTOMATION ENGINE
        const triggerMap: Record<string, AutomationTrigger> = {
            'entity_created': 'ENTITY_CREATED',
            'school_created': 'SCHOOL_CREATED',
            'pipeline_stage_changed': 'SCHOOL_STAGE_CHANGED',
            'pdf_form_submitted': 'PDF_SIGNED',
            'form_submission': 'SURVEY_SUBMITTED',
            'form_submitted': 'FORM_SUBMITTED',
            'task_completed': 'TASK_COMPLETED',
            'meeting_created': 'MEETING_CREATED',
            'tag_added': 'TAG_ADDED',
            'tag_removed': 'TAG_REMOVED',
            'deal_created': 'DEAL_CREATED',
            'deal_stage_changed': 'DEAL_STAGE_CHANGED',
            'deal_status_changed': 'DEAL_STATUS_CHANGED',
            'deal_value_changed': 'DEAL_VALUE_CHANGED'
        };

        const triggerType = triggerMap[activityData.type];
        if (triggerType) {
            console.log(`>>> [EVENT:BUS] Signal detected: ${triggerType}. Scheduling Logic Processor.`);
            
            const payload = {
                ...finalData,
                activityId: docRef.id,
                organizationId: activityData.organizationId,
                entityId: finalData.entityId,
                entityName: finalData.entityName,
                entitySlug: finalData.entitySlug,
                workspaceId: activityData.workspaceId,
                entityType: finalData.entityType,
                displayName: finalData.displayName,
                action: activityData.type,
                actorId: activityData.userId,
                timestamp: new Date().toISOString(),
                // Extra metadata from activity (tagId, appliedBy, etc.)
                ...(activityData.metadata || {})
            };

            // Vercel Best Practice: server-after-nonblocking
            // Ensures the main operation is not blocked by automation processing
            after(async () => {
                try {
                    await triggerAutomationProtocols(triggerType, payload);
                } catch (err: any) {
                    console.error(`>>> [EVENT:BUS] Protocol trigger failed:`, err.message);
                }
            });
        }

    } catch (error) {
        console.error("ActivityLogger: Failed to log activity.", error);
    }
}
