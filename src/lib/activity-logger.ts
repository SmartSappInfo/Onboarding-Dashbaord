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
 */
export async function logActivity(activityData: LogActivityInput): Promise<void> {
    try {
        let finalData = { ...activityData };
        
        // 1. Ensure Denormalization (Fetch contact context if missing)
        // Use adapter layer to resolve contact from either schools or entities + workspace_entities
        if (activityData.schoolId && (!activityData.schoolName || !activityData.schoolSlug)) {
            const contact = await resolveContact(activityData.schoolId, activityData.workspaceId);
            if (contact) {
                finalData.schoolName = contact.name;
                finalData.schoolSlug = contact.slug;
                // Populate entity fields if available
                if (contact.entityId) {
                    finalData.entityId = contact.entityId;
                    finalData.entityType = contact.entityType;
                    finalData.displayName = contact.name;
                    finalData.entitySlug = contact.slug;
                }
            }
        }
        
        // 2. Denormalize entity data at time of logging (Requirement 12)
        // If entityId is provided but displayName/entitySlug are missing, resolve them
        if (activityData.entityId && (!activityData.displayName || !activityData.entitySlug)) {
            const contact = await resolveContact(activityData.entityId, activityData.workspaceId);
            if (contact) {
                finalData.displayName = contact.name;
                finalData.entitySlug = contact.slug;
                finalData.entityType = contact.entityType;
                
                // Dual-write for legacy schools (Requirement 12)
                // If this is a legacy school, populate both schoolId and entityId
                if (contact.migrationStatus === 'legacy' && contact.schoolData) {
                    finalData.schoolId = contact.id;
                    finalData.schoolName = contact.name;
                    finalData.schoolSlug = contact.slug;
                }
            }
        }

        // 3. Persist the Audit Log with all workspace-aware fields (Requirement 12)
        const docRef = await adminDb.collection('activities').add({
            ...finalData,
            timestamp: new Date().toISOString(),
        });

        // 4. BROADCAST TO AUTOMATION ENGINE
        // Map Activity types to high-level Automation Triggers
        const triggerMap: Record<string, AutomationTrigger> = {
            'school_created': 'SCHOOL_CREATED',
            'pipeline_stage_changed': 'SCHOOL_STAGE_CHANGED',
            'pdf_form_submitted': 'PDF_SIGNED',
            'form_submission': 'SURVEY_SUBMITTED',
            'task_completed': 'TASK_COMPLETED',
            'meeting_created': 'MEETING_CREATED'
        };

        const triggerType = triggerMap[activityData.type];
        if (triggerType) {
            console.log(`>>> [EVENT:BUS] Signal detected: ${triggerType}. Invoking Logic Processor.`);
            
            // Prepare the payload for the engine (Requirement 10.1)
            // Include organizationId, workspaceId, entityId, entityType, action, actorId, timestamp
            const payload = {
                ...finalData,
                activityId: docRef.id,
                // Include common resolution keys
                organizationId: activityData.organizationId, // Requirement 10.1
                schoolId: finalData.schoolId,
                schoolName: finalData.schoolName,
                schoolSlug: finalData.schoolSlug,
                workspaceId: activityData.workspaceId, // Requirement 10.1
                entityId: finalData.entityId,
                entityType: finalData.entityType,
                displayName: finalData.displayName,
                entitySlug: finalData.entitySlug,
                action: activityData.type,
                actorId: activityData.userId,
                timestamp: new Date().toISOString()
            };

            // Invoke the processor (Fire and forget, non-blocking for the logger)
            triggerAutomationProtocols(triggerType, payload).catch(err => {
                console.error(`>>> [EVENT:BUS] Protocol trigger failed:`, err.message);
            });
        }

    } catch (error) {
        console.error("ActivityLogger: Failed to log activity.", error);
    }
}
