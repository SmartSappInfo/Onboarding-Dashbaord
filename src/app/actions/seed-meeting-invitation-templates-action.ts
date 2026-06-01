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
      
      const isEmail = tpl.channel === 'email';
      const blocks = isEmail ? [
          {
              id: `meet_head_${docId}`,
              type: 'heading',
              title: tpl.subject,
              variant: 'h2',
              style: { textAlign: 'center', fontWeight: 'bold', marginTop: '16px', marginBottom: '16px' }
          },
          {
              id: `meet_body_${docId}`,
              type: 'text',
              content: tpl.body,
              style: { textAlign: 'left', lineHeight: '1.6', marginTop: '8px', marginBottom: '16px' }
          },
          {
              id: `meet_rsvp_${docId}`,
              type: 'rsvp',
              title: 'Will you attend this meeting?',
              goingLabel: 'Going',
              laterLabel: 'Later',
              declinedLabel: 'Not Going',
              style: { textAlign: 'center', backgroundColor: '#f8fafc', paddingTop: '20px', paddingBottom: '20px', paddingLeft: '20px', paddingRight: '20px', borderRadius: '12px', borderWidth: '1px', borderStyle: 'solid', borderColor: '#e2e8f0' }
          }
      ] : undefined;

      const templateDoc = {
        id: docId,
        scope: 'global',
        category: tpl.category,
        channel: tpl.channel,
        target: tpl.recipientType === 'internal_alert' ? 'internal_team' : 'external_client',
        name: tpl.name,
        contentMode: isEmail ? 'rich_builder' : 'plain_text',
        subject: tpl.subject || '',
        body: isEmail ? '' : tpl.body,
        ...(blocks ? { blocks } : {}),
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
    const templatesSnapshot = await adminDb.collection('message_templates')
      .where('category', '==', 'meetings')
      .get();
      
    let totalProcessed = 0;
    let enrichedCount = 0;
    let currentBatch = adminDb.batch();
    let currentBatchCount = 0;
    
    for (const doc of templatesSnapshot.docs) {
      const data = doc.data();
      totalProcessed++;
      
      let body = data.body || '';
      let subject = data.subject || '';
      let declaredVariables = Array.isArray(data.declaredVariables) ? [...data.declaredVariables] : [];
      let blocks = data.blocks;
      let modified = false;
      
      const templateType = data.templateType || '';
      
      // 1. Process blocks if they exist (visual rich builder mode)
      if (Array.isArray(blocks)) {
        let blocksModified = false;
        blocks = blocks.map((block: any) => {
          let blockModified = false;
          let content = block.content || '';
          let title = block.title || '';
          
          if (content.includes('{{organization_name}}')) {
            content = content.replaceAll('{{organization_name}}', '{{org_name}}');
            blockModified = true;
          }
          if (title.includes('{{organization_name}}')) {
            title = title.replaceAll('{{organization_name}}', '{{org_name}}');
            blockModified = true;
          }
          
          if (content.includes('{{meeting_link}}')) {
            let replacementVar = 'registrant_join_link';
            if (templateType.includes('invitation')) {
              replacementVar = 'meeting_registrant_one_click_link';
            } else if (templateType.includes('facilitator')) {
              replacementVar = 'facilitator_join_link';
            }
            content = content.replaceAll('{{meeting_link}}', `{{${replacementVar}}}`);
            blockModified = true;
          }
          if (title.includes('{{meeting_link}}')) {
            let replacementVar = 'registrant_join_link';
            if (templateType.includes('invitation')) {
              replacementVar = 'meeting_registrant_one_click_link';
            } else if (templateType.includes('facilitator')) {
              replacementVar = 'facilitator_join_link';
            }
            title = title.replaceAll('{{meeting_link}}', `{{${replacementVar}}}`);
            blockModified = true;
          }
          
          if (blockModified) {
            blocksModified = true;
            return { ...block, content, title };
          }
          return block;
        });
        
        if (blocksModified) {
          modified = true;
        }
      }
      
      // 2. Process body & subject (plain text mode or visual rich builder subject)
      if (body.includes('{{organization_name}}') || subject.includes('{{organization_name}}')) {
        body = body.replaceAll('{{organization_name}}', '{{org_name}}');
        subject = subject.replaceAll('{{organization_name}}', '{{org_name}}');
        modified = true;
      }
      
      // Update declaredVariables for organization_name
      const hasOrgNameVar = body.includes('{{org_name}}') || subject.includes('{{org_name}}') || (Array.isArray(blocks) && blocks.some((b: any) => (b.content?.includes('{{org_name}}') || b.title?.includes('{{org_name}}'))));
      if (hasOrgNameVar) {
        declaredVariables = declaredVariables.filter(v => v !== 'organization_name');
        if (!declaredVariables.includes('org_name')) {
          declaredVariables.push('org_name');
        }
      }
      
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
        currentBatch.update(doc.ref, {
          body,
          subject,
          declaredVariables,
          ...(Array.isArray(blocks) ? { blocks } : {}),
          updatedAt: timestamp,
          updatedBy: 'system_enrichment_protocol'
        });
        currentBatchCount++;
        enrichedCount++;

        // Commit and reset batch if limit reached
        if (currentBatchCount === 500) {
          await currentBatch.commit();
          currentBatch = adminDb.batch();
          currentBatchCount = 0;
        }
      }
    }
    
    if (currentBatchCount > 0) {
      await currentBatch.commit();
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
