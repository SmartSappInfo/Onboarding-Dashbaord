'use server';

import { adminDb } from './firebase-admin';

/**
 * SEED: System Maintenance Template
 * Specifically requested for SMS alerts during maintenance windows.
 */
export async function seedMaintenanceTemplate() {
    try {
        const timestamp = new Date().toISOString();
        const templateId = 'global_general_maintenance_sms';
        const templateRef = adminDb.collection('message_templates').doc(templateId);
        
        await templateRef.set({
            id: templateId,
            scope: 'global',
            category: 'general',
            channel: 'sms',
            target: 'external_client',
            name: 'System Maintenance Alert (SMS)',
            contentMode: 'plain_text',
            subject: 'System Maintenance',
            body: "Please note: SmartSapp maintenance runs Sat 9AM–Mon 5AM. Some features may be temporarily unavailable. Thank you",
            templateType: 'general_maintenance_alert',
            recipientType: 'entity',
            status: 'active',
            version: 1,
            isActive: true,
            createdAt: timestamp,
            updatedAt: timestamp,
            createdBy: 'system_seed'
        });
        
        return { success: true };
    } catch (error: any) {
        console.error('Failed to seed maintenance template:', error.message);
        return { success: false, error: error.message };
    }
}
