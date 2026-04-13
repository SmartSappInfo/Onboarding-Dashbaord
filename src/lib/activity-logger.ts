'use server';

import { adminDb } from './firebase-admin';
import type { Activity, AutomationTrigger } from './types';
import { triggerAutomationProtocols } from './automation-processor';
import { resolveContact } from './contact-adapter';

type LogActivityInput = Omit<Activity, 'id' | 'timestamp'>;

/**
 * Logs an activity using the Firebase Admin SDK for reliability.
 * Upgraded to serve as the platform's primary Event Bus for the Automation Engine.
 * 
 * Updated to use the Contact Adapter Layer for backward compatibility (Requirement 18)
 * Updated for workspace awareness (Requirement 12)
 * Updated to fully support entity architecture.
 */
export async function logActivity(activityData: LogActivityInput): Promise<void> {
    try {
        let finalData = { ...activityData };
        
        let entityId: string | null | undefined = activityData.entityId;
        let entityName: string | null | undefined = activityData.entityName;
        let entitySlug: string | null | undefined = activityData.entitySlug;
        let entityType: 'institution' | 'family' | 'person' | null | undefined = activityData.entityType;
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
            entityId,
            entityName,
            entitySlug,
            entityType,
            displayName,
        };

        // 3. Persist the Audit Log with all workspace-aware fields (Requirement 12)
        const docRef = await adminDb.collection('activities').add({
            ...finalData,
            timestamp: new Date().toISOString(),
        });

        // 4. BROADCAST TO AUTOMATION ENGINE
        const triggerMap: Record<string, AutomationTrigger> = {
            'school_created': 'SCHOOL_CREATED',
            'pipeline_stage_changed': 'SCHOOL_STAGE_CHANGED',
            'pdf_form_submitted': 'PDF_SIGNED',
            'form_submission': 'SURVEY_SUBMITTED',
            'form_submitted': 'FORM_SUBMITTED',
            'task_completed': 'TASK_COMPLETED',
            'meeting_created': 'MEETING_CREATED'
        };

        const triggerType = triggerMap[activityData.type];
        if (triggerType) {
            console.log(`>>> [EVENT:BUS] Signal detected: ${triggerType}. Invoking Logic Processor.`);
            
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
                timestamp: new Date().toISOString()
            };

            triggerAutomationProtocols(triggerType, payload).catch(err => {
                console.error(`>>> [EVENT:BUS] Protocol trigger failed:`, err.message);
            });
        }

    } catch (error) {
        console.error("ActivityLogger: Failed to log activity.", error);
    }
}
