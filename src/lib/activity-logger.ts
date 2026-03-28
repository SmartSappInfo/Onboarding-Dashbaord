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
 * Updated with dual-write pattern for entityId migration (Requirements 4.1, 25.3)
 */
export async function logActivity(activityData: LogActivityInput): Promise<void> {
    try {
        let finalData = { ...activityData };
        
        // Initialize dual-write fields
        let schoolId: string | undefined = activityData.schoolId;
        let schoolName: string | undefined = activityData.schoolName;
        let schoolSlug: string | undefined = activityData.schoolSlug;
        let entityId: string | undefined = activityData.entityId;
        let entityType: 'institution' | 'family' | 'person' | undefined = activityData.entityType;
        let displayName: string | undefined = activityData.displayName;
        let entitySlug: string | undefined = activityData.entitySlug;
        
        // Dual-write resolution logic (Requirements 4.1, 25.3)
        if (activityData.workspaceId) {
            // Case 1: Only entityId provided - resolve schoolId for backward compatibility
            if (entityId && !schoolId) {
                const contact = await resolveContact({ entityId }, activityData.workspaceId);
                if (contact) {
                    schoolId = contact.schoolData?.id;
                    schoolName = contact.name;
                    schoolSlug = contact.slug;
                    entityType = contact.entityType;
                    displayName = contact.name;
                    entitySlug = contact.slug;
                }
            }
            // Case 2: Only schoolId provided - resolve entityId if migrated
            else if (schoolId && !entityId) {
                const contact = await resolveContact({ schoolId }, activityData.workspaceId);
                if (contact) {
                    schoolName = contact.name;
                    schoolSlug = contact.slug;
                    entityId = contact.entityId;
                    entityType = contact.entityType;
                    displayName = contact.name;
                    entitySlug = contact.slug;
                }
            }
            // Case 3: Both provided - ensure denormalized fields are populated
            else if (schoolId || entityId) {
                const contact = await resolveContact({ entityId, schoolId }, activityData.workspaceId);
                if (contact) {
                    schoolName = schoolName || contact.name;
                    schoolSlug = schoolSlug || contact.slug;
                    entityType = entityType || contact.entityType;
                    displayName = displayName || contact.name;
                    entitySlug = entitySlug || contact.slug;
                    
                    // Ensure both identifiers are populated if available
                    if (!schoolId && contact.schoolData) {
                        schoolId = contact.schoolData.id;
                    }
                    if (!entityId && contact.entityId) {
                        entityId = contact.entityId;
                    }
                }
            }
        }
        
        // Update finalData with resolved fields
        finalData = {
            ...finalData,
            schoolId,
            schoolName,
            schoolSlug,
            entityId,
            entityType,
            displayName,
            entitySlug,
        };

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
