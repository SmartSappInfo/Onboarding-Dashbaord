/**
 * Migration script: Deprecate unsubscribe_url and migrate to unsubscribe_link.
 *
 * Usage:
 *   tsx src/app/seeds/migrate-unsubscribe-url.ts
 */

import * as dotenv from 'dotenv';
// Load environment variables before importing any firebase admin packages
dotenv.config({ path: '.env.local' });

interface TemplateBlock {
  id: string;
  type: string;
  [key: string]: unknown;
}

interface MessageTemplateDoc {
  name?: string;
  subject?: string;
  previewText?: string;
  body?: string;
  blocks?: TemplateBlock[];
  variables?: string[];
  [key: string]: unknown;
}

interface CampaignVariant {
  id: string;
  customSubject?: string;
  customBody?: string;
  customBlocks?: TemplateBlock[];
  [key: string]: unknown;
}

interface MessageCampaignDoc {
  name?: string;
  variants?: CampaignVariant[];
  [key: string]: unknown;
}

function extractVariables(content: string): string[] {
  const matches = content.match(/\{\{([^{}]+?)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))];
}

function replaceInBlocks(blocks: TemplateBlock[]): TemplateBlock[] {
  return blocks.map(block => {
    const stringified = JSON.stringify(block);
    if (stringified.includes('{{unsubscribe_url}}')) {
      const replaced = stringified.replace(/\{\{unsubscribe_url\}\}/g, '{{unsubscribe_link}}');
      return JSON.parse(replaced) as TemplateBlock;
    }
    return block;
  });
}

async function runMigration() {
  console.log('--- Starting Unsubscribe URL Database Migration ---');

  // Dynamically import adminDb so it resolves process.env *after* dotenv.config has run
  const { adminDb } = await import('../../lib/firebase-admin');

  // 1. Migrate message_templates
  console.log('Fetching message_templates...');
  const templatesSnap = await adminDb.collection('message_templates').get();
  console.log(`Found ${templatesSnap.size} templates in total.`);

  let templatesMigrated = 0;
  let batch = adminDb.batch();
  let operationCount = 0;

  for (const doc of templatesSnap.docs) {
    const data = doc.data() as MessageTemplateDoc;
    let needsUpdate = false;

    let updatedSubject = data.subject || '';
    if (updatedSubject.includes('{{unsubscribe_url}}')) {
      updatedSubject = updatedSubject.replace(/\{\{unsubscribe_url\}\}/g, '{{unsubscribe_link}}');
      needsUpdate = true;
    }

    let updatedPreview = data.previewText || '';
    if (updatedPreview.includes('{{unsubscribe_url}}')) {
      updatedPreview = updatedPreview.replace(/\{\{unsubscribe_url\}\}/g, '{{unsubscribe_link}}');
      needsUpdate = true;
    }

    let updatedBody = data.body || '';
    if (updatedBody.includes('{{unsubscribe_url}}')) {
      updatedBody = updatedBody.replace(/\{\{unsubscribe_url\}\}/g, '{{unsubscribe_link}}');
      needsUpdate = true;
    }

    let updatedBlocks = data.blocks || [];
    const stringifiedBlocks = JSON.stringify(updatedBlocks);
    if (stringifiedBlocks.includes('{{unsubscribe_url}}')) {
      updatedBlocks = replaceInBlocks(updatedBlocks);
      needsUpdate = true;
    }

    let updatedVars = data.variables || [];
    if (updatedVars.includes('unsubscribe_url')) {
      updatedVars = updatedVars.filter(v => v !== 'unsubscribe_url');
      needsUpdate = true;
    }

    if (needsUpdate) {
      const contentForExtraction = `${updatedSubject} ${updatedPreview} ${updatedBody} ${JSON.stringify(updatedBlocks)}`;
      const extracted = extractVariables(contentForExtraction);
      
      if (extracted.includes('unsubscribe_link') && !updatedVars.includes('unsubscribe_link')) {
        updatedVars.push('unsubscribe_link');
      }
      updatedVars = updatedVars.filter(v => v !== 'unsubscribe_url');

      batch.update(doc.ref, {
        subject: updatedSubject,
        previewText: updatedPreview,
        body: updatedBody,
        blocks: updatedBlocks,
        variables: updatedVars,
        updatedAt: new Date().toISOString(),
      });

      templatesMigrated++;
      operationCount++;

      console.log(`[TEMPLATE MIGRATED] ID: ${doc.id} - ${data.name || 'Untitled'}`);

      if (operationCount >= 200) {
        await batch.commit();
        batch = adminDb.batch();
        operationCount = 0;
        console.log('Committed batch chunk of templates.');
      }
    }
  }

  if (operationCount > 0) {
    await batch.commit();
    console.log('Committed final batch chunk of templates.');
  }

  // 2. Migrate message_campaigns
  console.log('\nFetching message_campaigns...');
  const campaignsSnap = await adminDb.collection('message_campaigns').get();
  console.log(`Found ${campaignsSnap.size} campaigns in total.`);

  let campaignsMigrated = 0;
  batch = adminDb.batch();
  operationCount = 0;

  for (const doc of campaignsSnap.docs) {
    const data = doc.data() as MessageCampaignDoc;
    let needsUpdate = false;

    const updatedVariants = (data.variants || []).map(variant => {
      let variantNeedsUpdate = false;
      let updatedSubject = variant.customSubject || '';
      if (updatedSubject.includes('{{unsubscribe_url}}')) {
        updatedSubject = updatedSubject.replace(/\{\{unsubscribe_url\}\}/g, '{{unsubscribe_link}}');
        variantNeedsUpdate = true;
      }

      let updatedBody = variant.customBody || '';
      if (updatedBody.includes('{{unsubscribe_url}}')) {
        updatedBody = updatedBody.replace(/\{\{unsubscribe_url\}\}/g, '{{unsubscribe_link}}');
        variantNeedsUpdate = true;
      }

      let updatedBlocks = variant.customBlocks || [];
      const stringifiedBlocks = JSON.stringify(updatedBlocks);
      if (stringifiedBlocks.includes('{{unsubscribe_url}}')) {
        updatedBlocks = replaceInBlocks(updatedBlocks);
        variantNeedsUpdate = true;
      }

      if (variantNeedsUpdate) {
        needsUpdate = true;
        return {
          ...variant,
          customSubject: updatedSubject,
          customBody: updatedBody,
          customBlocks: updatedBlocks,
        };
      }
      return variant;
    });

    if (needsUpdate) {
      batch.update(doc.ref, {
        variants: updatedVariants,
        updatedAt: new Date().toISOString(),
      });

      campaignsMigrated++;
      operationCount++;

      console.log(`[CAMPAIGN MIGRATED] ID: ${doc.id} - ${data.name || 'Untitled'}`);

      if (operationCount >= 200) {
        await batch.commit();
        batch = adminDb.batch();
        operationCount = 0;
        console.log('Committed batch chunk of campaigns.');
      }
    }
  }

  if (operationCount > 0) {
    await batch.commit();
    console.log('Committed final batch chunk of campaigns.');
  }

  console.log('\n--- Migration Summary ---');
  console.log(`Templates Migrated: ${templatesMigrated}`);
  console.log(`Campaigns Migrated: ${campaignsMigrated}`);
  console.log('Migration Completed Successfully!');
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
