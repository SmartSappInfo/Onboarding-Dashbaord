/**
 * @fileOverview Fetch, Enrich, Restore (FER) Protocol for Template Variables
 * 
 * Replaces deprecated tokens (recipient_*, legacy camelCase fields, and uppercase tokens)
 * with their canonical snake_case counterparts across message_templates and app_fields.
 */

import { adminDb } from '@/lib/firebase-admin';
import { DEPRECATED_VARIABLES_MAP } from '@/lib/template-validator';
import type { MessageTemplate } from '@/lib/types';

export interface FERReplacementDetail {
  from: string;
  to: string;
  count: number;
}

export interface FERItemReport {
  type: 'template' | 'field';
  id: string;
  name: string;
  replacements: FERReplacementDetail[];
}

export interface FERMigrationResult {
  success: boolean;
  dryRun: boolean;
  templatesScanned: number;
  templatesMigrated: number;
  fieldsScanned: number;
  fieldsArchived: number;
  details: FERItemReport[];
}

/**
 * Replace all occurrences of deprecated variables in a string.
 */
function replaceDeprecatedTokens(
  text: string,
  map: Record<string, { replacement: string }>
): { newText: string; replacements: FERReplacementDetail[] } {
  let newText = text;
  const replacements: FERReplacementDetail[] = [];

  for (const [depKey, info] of Object.entries(map)) {
    // Regex matches {{depKey}}, {{ depKey }}, {{depKey|fallback}}, etc.
    const escapedKey = depKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\{\\{\\s*${escapedKey}(\\s*(\\|[^}]+)?)\\s*\\}\\}`, 'g');
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      newText = newText.replace(regex, (_match, fallbackGroup) => {
        return `{{${info.replacement}${fallbackGroup || ''}}}`;
      });
      replacements.push({
        from: depKey,
        to: info.replacement,
        count: matches.length,
      });
    }
  }

  return { newText, replacements };
}

/**
 * Executes the Fetch, Enrich, Restore (FER) Protocol on Firestore database.
 */
export async function runVariablesFERMigration(options?: {
  dryRun?: boolean;
  workspaceId?: string;
  organizationId?: string;
}): Promise<FERMigrationResult> {
  const dryRun = options?.dryRun ?? false;
  const details: FERItemReport[] = [];
  let templatesScanned = 0;
  let templatesMigrated = 0;
  let fieldsScanned = 0;
  let fieldsArchived = 0;

  console.log(`[FER Migration] Starting run (dryRun: ${dryRun})...`);

  // 1. Scan and migrate message_templates
  let templateQuery: FirebaseFirestore.Query = adminDb.collection('message_templates');
  if (options?.organizationId) {
    templateQuery = templateQuery.where('organizationId', '==', options.organizationId);
  }

  const templatesSnap = await templateQuery.get();
  templatesScanned = templatesSnap.size;

  for (const doc of templatesSnap.docs) {
    const data = doc.data() as Partial<MessageTemplate>;
    const itemReplacements: FERReplacementDetail[] = [];

    // Fields to inspect
    let subject = data.subject || '';
    let previewText = data.previewText || '';
    let body = data.body || '';
    let htmlContent = (data as { htmlContent?: string }).htmlContent || '';
    let blocksJson = data.blocks ? JSON.stringify(data.blocks) : '';

    // Check & replace in subject
    if (subject) {
      const res = replaceDeprecatedTokens(subject, DEPRECATED_VARIABLES_MAP);
      if (res.replacements.length > 0) {
        subject = res.newText;
        itemReplacements.push(...res.replacements);
      }
    }

    // Check & replace in previewText
    if (previewText) {
      const res = replaceDeprecatedTokens(previewText, DEPRECATED_VARIABLES_MAP);
      if (res.replacements.length > 0) {
        previewText = res.newText;
        itemReplacements.push(...res.replacements);
      }
    }

    // Check & replace in body
    if (body) {
      const res = replaceDeprecatedTokens(body, DEPRECATED_VARIABLES_MAP);
      if (res.replacements.length > 0) {
        body = res.newText;
        itemReplacements.push(...res.replacements);
      }
    }

    // Check & replace in htmlContent
    if (htmlContent) {
      const res = replaceDeprecatedTokens(htmlContent, DEPRECATED_VARIABLES_MAP);
      if (res.replacements.length > 0) {
        htmlContent = res.newText;
        itemReplacements.push(...res.replacements);
      }
    }

    // Check & replace in blocks JSON
    let newBlocks = data.blocks;
    if (blocksJson) {
      const res = replaceDeprecatedTokens(blocksJson, DEPRECATED_VARIABLES_MAP);
      if (res.replacements.length > 0) {
        try {
          newBlocks = JSON.parse(res.newText);
          itemReplacements.push(...res.replacements);
        } catch (e) {
          console.error(`[FER Migration] Failed to parse updated blocks for template ${doc.id}:`, e);
        }
      }
    }

    if (itemReplacements.length > 0) {
      templatesMigrated++;
      details.push({
        type: 'template',
        id: doc.id,
        name: data.name || 'Untitled Template',
        replacements: itemReplacements,
      });

      if (!dryRun) {
        const updatePayload: Record<string, unknown> = {
          updatedAt: new Date().toISOString(),
        };
        if (subject !== (data.subject || '')) updatePayload.subject = subject;
        if (previewText !== (data.previewText || '')) updatePayload.previewText = previewText;
        if (body !== (data.body || '')) updatePayload.body = body;
        if (htmlContent !== ((data as { htmlContent?: string }).htmlContent || '')) updatePayload.htmlContent = htmlContent;
        if (newBlocks && newBlocks !== data.blocks) updatePayload.blocks = newBlocks;

        await doc.ref.update(updatePayload);
        console.log(`[FER Migration] Updated template ${doc.id} (${data.name}) with ${itemReplacements.length} token fixes.`);
      }
    }
  }

  // 2. Scan and archive deprecated custom fields in app_fields
  let fieldsQuery: FirebaseFirestore.Query = adminDb.collection('app_fields');
  if (options?.workspaceId) {
    fieldsQuery = fieldsQuery.where('workspaceId', '==', options.workspaceId);
  }

  const fieldsSnap = await fieldsQuery.get();
  fieldsScanned = fieldsSnap.size;

  for (const doc of fieldsSnap.docs) {
    const field = doc.data();
    if (!field || !field.variableName) continue;

    const varName = field.variableName as string;
    const isRecipientVar = varName.startsWith('recipient_');
    const isDeprecated = isRecipientVar || (varName in DEPRECATED_VARIABLES_MAP);

    if (isDeprecated && field.status !== 'archived') {
      fieldsArchived++;
      const targetReplacement = DEPRECATED_VARIABLES_MAP[varName]?.replacement || 'contact_name';
      details.push({
        type: 'field',
        id: doc.id,
        name: field.name || field.label || varName,
        replacements: [{
          from: varName,
          to: targetReplacement,
          count: 1,
        }],
      });

      if (!dryRun) {
        await doc.ref.update({
          status: 'archived',
          deprecatedAt: new Date().toISOString(),
          canonicalReplacement: targetReplacement,
        });
        console.log(`[FER Migration] Archived deprecated app_field ${doc.id} (${varName} -> ${targetReplacement}).`);
      }
    }
  }

  console.log(`[FER Migration] Completed. Scanned ${templatesScanned} templates (${templatesMigrated} migrated), ${fieldsScanned} fields (${fieldsArchived} archived).`);

  return {
    success: true,
    dryRun,
    templatesScanned,
    templatesMigrated,
    fieldsScanned,
    fieldsArchived,
    details,
  };
}
