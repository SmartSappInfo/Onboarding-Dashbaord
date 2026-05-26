'use server';

import { after } from 'next/server';
import { adminDb } from './firebase-admin';
import type { Activity, EntityType } from './types';
import { triggerAutomationProtocols } from './automation-processor';
import { resolveContact } from './contact-adapter';
import { buildAutomationPayload } from './automation-payload';
import { resolveAutomationTrigger } from './automation-trigger-map';

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
        const triggerType = resolveAutomationTrigger(activityData.type);
        if (triggerType) {
            console.log(`>>> [EVENT:BUS] Signal detected: ${triggerType}. Scheduling Logic Processor.`);

            const payload = buildAutomationPayload({
                organizationId: activityData.organizationId,
                workspaceId: activityData.workspaceId,
                entityId: finalData.entityId,
                entityType: finalData.entityType,
                action: activityData.type,
                actorId: activityData.userId ?? null,
                metadata: activityData.metadata,
                activityId: docRef.id,
                entityName: finalData.entityName,
                entitySlug: finalData.entitySlug,
                displayName: finalData.displayName,
            });

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
