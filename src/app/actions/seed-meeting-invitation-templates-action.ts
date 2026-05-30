'use server';

import { adminDb } from '@/lib/firebase-admin';
import { TEMPLATES } from '@/lib/messaging-templates-registry';

/**
 * Seeds all standard meeting templates and runs a Fetch-Enrich-Restore protocol
 * to replace any instances of raw meeting_link with unique registration/join/facilitator links.
 */
export async function seedEnrichedMeetingTemplatesAction(): Promise<{
  success: boolean;
  totalProcessed: number;
  enrichedCount: number;
  seededCount: number;
  errors: Array<{ name: string; error: string }>;
}> {
  try {
    const timestamp = new Date().toISOString();
    
    // Step 1: Seed/Upsert the default global templates first to ensure they all exist
    // and are up to date (this will populate the database with the correct non-meeting_link templates).
    const batch = adminDb.batch();
    let seededCount = 0;
    const meetingTemplates = TEMPLATES.filter(t => t.category === 'meetings');
    
    for (const tpl of meetingTemplates) {
      const docId = `global_${tpl.templateType}_${tpl.channel}`;
      const docRef = adminDb.collection('message_templates').doc(docId);
      
      const templateDoc = {
        id: docId,
        scope: 'global',
        category: tpl.category,
        channel: tpl.channel,
        target: tpl.recipientType === 'internal_alert' ? 'internal_team' : 'external_client',
        name: tpl.name,
        contentMode: 'plain_text',
        subject: tpl.subject || '',
        body: tpl.body,
        templateType: tpl.templateType,
        recipientType: tpl.recipientType || 'external_alert',
        variableContext: tpl.variableContext || 'meeting',
        declaredVariables: tpl.declaredVariables || [],
        status: 'active',
        version: 1,
        isActive: true,
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: 'system_seed_enriched_meetings',
        ...(tpl.reminderConfig ? { reminderConfig: tpl.reminderConfig } : {}),
      };
      
      batch.set(docRef, templateDoc, { merge: true });
      seededCount++;
    }
    await batch.commit();

    // Step 2: Fetch all customized templates (both global and workspace-scoped) to perform the Enrich & Restore protocol
    const templatesSnapshot = await adminDb.collection('message_templates').get();
    const enrichmentBatch = adminDb.batch();
    let totalProcessed = 0;
    let enrichedCount = 0;
    
    for (const doc of templatesSnapshot.docs) {
      const data = doc.data();
      totalProcessed++;
      
      // We only care about meeting templates
      if (data.category === 'meetings') {
        let body = data.body || '';
        let subject = data.subject || '';
        let declaredVariables = Array.isArray(data.declaredVariables) ? [...data.declaredVariables] : [];
        let modified = false;
        
        const templateType = data.templateType || '';
        
        // Check for presence of raw meeting_link variable
        if (body.includes('{{meeting_link}}') || subject.includes('{{meeting_link}}')) {
          modified = true;
          
          // Determine the correct replacement variable
          let replacementVar = 'registrant_join_link';
          if (templateType.includes('invitation')) {
            replacementVar = 'meeting_registrant_one_click_link';
          } else if (templateType.includes('facilitator')) {
            replacementVar = 'facilitator_join_link';
          }
          
          // Perform the replacements
          body = body.replaceAll('{{meeting_link}}', `{{${replacementVar}}}`);
          subject = subject.replaceAll('{{meeting_link}}', `{{${replacementVar}}}`);
          
          // Update declaredVariables list
          declaredVariables = declaredVariables.filter(v => v !== 'meeting_link');
          if (!declaredVariables.includes(replacementVar)) {
            declaredVariables.push(replacementVar);
          }
        }
        
        if (modified) {
          enrichmentBatch.update(doc.ref, {
            body,
            subject,
            declaredVariables,
            updatedAt: timestamp,
            updatedBy: 'system_enrichment_protocol'
          });
          enrichedCount++;
        }
      }
    }
    
    if (enrichedCount > 0) {
      await enrichmentBatch.commit();
    }
    
    return {
      success: true,
      totalProcessed,
      enrichedCount,
      seededCount,
      errors: []
    };
  } catch (error: any) {
    console.error('[SEED_ENRICHED_MEETING_TEMPLATES] Seeding failed:', error);
    return {
      success: false,
      totalProcessed: 0,
      enrichedCount: 0,
      seededCount: 0,
      errors: [{ name: 'Enriched Seeding Failure', error: error.message || 'Unknown error' }]
    };
  }
}
