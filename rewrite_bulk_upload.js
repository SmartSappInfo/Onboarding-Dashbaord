const fs = require('fs');

const path = 'src/lib/bulk-upload-actions.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Add imports
content = content.replace(
    "import { logActivity } from './activity-logger';",
    `import { logActivity } from './activity-logger';
import { FieldValue } from 'firebase-admin/firestore';
import type { DuplicateStrategy } from './import-types';
import { IngestionDeduplicator } from './services/IngestionDeduplicator';
import { after } from 'next/server';`
);

// 2. Change ingestBatchAction signature
content = content.replace(
    /globalTagIds: string\[\] = \[\],\n    automationId\?: string,\n    manualTagNames: string\[\] = \[\]\n\): Promise<BatchResult> \{/,
    `globalTagIds: string[] = [],
    automationId?: string,
    manualTagNames: string[] = [],
    duplicateStrategy: DuplicateStrategy = 'SKIP'
): Promise<{ importLogId: string }> {`
);

// 3. Replace the existingNames logic and processing loop up to return { successCount... }
// Using string split & replace for large blocks
const searchBlock1 = `    // 5. Build a set of existing entity names for duplicate detection`;
const replaceBlock1 = `    // 5. Build O(1) in-memory HashSets for duplicate detection
    const existingNames = new Map<string, any>();
    const existingEmails = new Map<string, any>();
    const existingPhones = new Map<string, any>();
    
    try {
        const existingSnap = await adminDb.collection('workspace_entities')
            .where('workspaceId', '==', workspaceId)
            .select('displayName', 'primaryEmail', 'primaryPhone', 'entityContacts', 'workspaceTags')
            .get();
            
        for (const doc of existingSnap.docs) {
            const data = doc.data();
            data.id = doc.id;
            
            if (data.displayName) existingNames.set(normaliseName(data.displayName), data);
            if (data.primaryEmail) existingEmails.set(data.primaryEmail.toLowerCase().trim(), data);
            
            if (Array.isArray(data.entityContacts)) {
                for (const c of data.entityContacts) {
                   if (c.email) existingEmails.set(c.email.toLowerCase().trim(), data);
                   if (c.phone) existingPhones.set(c.phone.replace(/[^0-9]/g, ''), data);
                }
            }
        }
    } catch {
        console.warn('[BULK] Could not fetch existing entities for duplicate check');
    }

    const importLogId = \`implog_\${Date.now()}_\${Math.random().toString(36).substring(2, 9)}\`;
    const importLogRef = adminDb.collection('import_logs').doc(importLogId);
    
    await importLogRef.set({
        id: importLogId,
        workspaceId,
        organizationId,
        userId,
        filename,
        entityType,
        status: 'processing',
        totalCount: rows.length,
        successCount: 0,
        failedCount: 0,
        duplicateCount: 0,
        duplicateStrategy,
        selectedTags: globalTagIds,
        automationId: automationId || null,
        startedAt: FieldValue.serverTimestamp(),
        rawFieldsCleared: false
    });

    // 6. Background async processor
    after(async () => {
        let successCount = 0;
        let failedCount = 0;
        let duplicateCount = 0;
        const failedRows = [];

        for (let i = 0; i < rows.length; i++) {`;

content = content.replace(searchBlock1 + content.substring(content.indexOf(searchBlock1) + searchBlock1.length, content.indexOf(`    for (let i = 0; i < rows.length; i++) {`)) + `    for (let i = 0; i < rows.length; i++) {`, replaceBlock1);

const searchBlock2 = `            // Duplicate check
            if (existingNames.has(normalised) || batchNames.has(normalised)) {
                throw new Error(\`Duplicate: "\${name}" already exists in this workspace\`);
            }

            // Process the row
            const result = await processRow(
                row, mapping, name, entityType, context,
                workspaceIndustry, workspaceId, organizationId, userId,
                filename, autoCreateTags,
                defaultValues, globalTagIds, automationId, manualTagNames
            );

            batchNames.add(normalised);
            existingNames.add(normalised);
            successCount++;
            results.push({ row: i, status: 'success', entityName: result.entityName });
        } catch (err: any) {
            errorCount++;
            results.push({ row: i, status: 'error', error: err.message });
        }
    }

    // 7. Log aggregate activity
    await logActivity({
        organizationId,
        workspaceId,
        userId,
        type: 'contacts_imported',
        source: 'system',
        description: \`Bulk import: \${successCount} created, \${errorCount} errors from "\${filename}"\`,
        metadata: { entityType, successCount, errorCount, batchSize: rows.length, cleaningStats },
    });

    revalidatePath('/admin/entities');
    revalidatePath('/admin/pipeline');

    return { successCount, errorCount, results, cleaningStats };`;

const replaceBlock2 = `            // Process the row purely to extract data (does not commit)
            const extracted = await processRow(
                row, mapping, name, entityType, context,
                workspaceIndustry, workspaceId, organizationId, userId,
                filename, autoCreateTags,
                defaultValues, globalTagIds, automationId, manualTagNames
            ) as any;

            const normalisedEmail = extracted.workspaceEntityDoc.primaryEmail?.toLowerCase().trim();
            const normalisedPhone = extracted.workspaceEntityDoc.primaryPhone?.replace(/[^0-9]/g, '');
            
            let existingEntity = null;
            if (existingNames.has(normalised)) existingEntity = existingNames.get(normalised);
            else if (normalisedEmail && existingEmails.has(normalisedEmail)) existingEntity = existingEmails.get(normalisedEmail);
            else if (normalisedPhone && existingPhones.has(normalisedPhone)) existingEntity = existingPhones.get(normalisedPhone);

            if (existingEntity) {
                if (duplicateStrategy === 'MANUAL_CORRECTION') {
                    throw new Error(\`Duplicate: "\${name}" already exists. Manual correction selected.\`);
                }
                const reconciled = IngestionDeduplicator.reconcile(existingEntity, extracted.workspaceEntityDoc, duplicateStrategy, globalTagIds);
                if (reconciled) {
                    await adminDb.collection('workspace_entities').doc(existingEntity.id).update({
                        ...reconciled,
                        updatedAt: new Date().toISOString()
                    });
                    if (duplicateStrategy === 'TRIGGER_AUTOMATION' && automationId) {
                        const { runAutomationById } = await import('./automation-processor');
                        await runAutomationById(automationId, extracted.automationPayload);
                    }
                    successCount++;
                } else {
                    duplicateCount++;
                }
            } else {
                // New record
                await adminDb.collection('entities').doc(extracted.entityId).set(extracted.entityDoc);
                await adminDb.collection('workspace_entities').doc(extracted.workspaceEntityId).set(extracted.workspaceEntityDoc);
                
                const { triggerAutomationProtocols, runAutomationById } = await import('./automation-processor');
                await triggerAutomationProtocols('ENTITY_CREATED', extracted.automationPayload);
                if (automationId) {
                    await runAutomationById(automationId, extracted.automationPayload);
                }
                
                existingNames.set(normalised, extracted.workspaceEntityDoc);
                if (normalisedEmail) existingEmails.set(normalisedEmail, extracted.workspaceEntityDoc);
                if (normalisedPhone) existingPhones.set(normalisedPhone, extracted.workspaceEntityDoc);
                
                successCount++;
            }
        } catch (err: any) {
            failedCount++;
            failedRows.push({
                id: \`fail_\${Date.now()}_\${i}\`,
                importLogId,
                rowIdx: i,
                rawPayload: row,
                error: err.message || 'Unknown error',
                resolved: false,
                retryCount: 0,
                createdAt: FieldValue.serverTimestamp()
            });
        }
    } // End of batch loop

    // Save failed rows in chunks of 500
    const failedRowsRef = importLogRef.collection('failed_rows');
    for (let i = 0; i < failedRows.length; i += 500) {
        const chunk = failedRows.slice(i, i + 500);
        const wb = adminDb.batch();
        for (const fr of chunk) wb.set(failedRowsRef.doc(fr.id), fr);
        await wb.commit();
    }

    await importLogRef.update({
        status: failedCount > 0 ? 'partially_completed' : 'completed',
        successCount,
        failedCount,
        duplicateCount,
        completedAt: FieldValue.serverTimestamp()
    });

    await logActivity({
        organizationId,
        workspaceId,
        userId,
        type: 'contacts_imported',
        source: 'system',
        description: \`Bulk import finished: \${successCount} processed, \${failedCount} errors.\`,
        metadata: { importLogId, entityType, successCount, failedCount },
    });

    }); // End of after() block

    return { importLogId };`;

content = content.replace(searchBlock2, replaceBlock2);

// 4. Update processRow return signature
content = content.replace(
    /manualTagNames: string\[\] = \[\]\n\): Promise<\{ entityName: string \}> \{/,
    `manualTagNames: string[] = []
): Promise<any> {`
);

// 5. Update processRow body
const searchBlock3 = `    // Save entity
    await adminDb.collection('entities').doc(entityId).set(entityDoc);

    // Save workspace entity
    const primaryContact = entityContacts.find(c => c.isPrimary);
    const workspaceEntityId = \`\${workspaceId}_\${entityId}\`;
    await adminDb.collection('workspace_entities').doc(workspaceEntityId).set({
        id: workspaceEntityId,
        organizationId,
        workspaceId,
        entityId,
        entityType,
        status: 'active',
        assignedTo: selectedUser?.id || null,
        workspaceTags: tagIds,
        addedAt: timestamp,
        updatedAt: timestamp,
        displayName: name,
        primaryContactName: primaryContact?.name || '',
        primaryEmail: primaryContact?.email || '',
        primaryPhone: primaryContact?.phone || '',
        entityContacts,
        interests: entityDoc.interests || [],
        customData: entityDoc.customData || {},
        ...(entityDoc.currentNeeds && { currentNeeds: entityDoc.currentNeeds }),
        ...(entityDoc.currentChallenges && { currentChallenges: entityDoc.currentChallenges }),
        ...(entityDoc.interestsText && { interestsText: entityDoc.interestsText }),
    });

    const { triggerAutomationProtocols, runAutomationById } = await import('./automation-processor');
    const automationPayload = {
        entityId,
        workspaceId,
        organizationId,
        entityName: name,
        entityType,
        assignedTo: selectedUser ? { userId: selectedUser.id, name: selectedUser.name } : null
    };

    await triggerAutomationProtocols('ENTITY_CREATED', automationPayload);

    if (automationId) {
        await runAutomationById(automationId, automationPayload);
    }

    return { entityName: name };`;

const replaceBlock3 = `    const primaryContact = entityContacts.find(c => c.isPrimary);
    const workspaceEntityId = \`\${workspaceId}_\${entityId}\`;
    const workspaceEntityDoc = {
        id: workspaceEntityId,
        organizationId,
        workspaceId,
        entityId,
        entityType,
        status: 'active',
        assignedTo: selectedUser?.id || null,
        workspaceTags: tagIds,
        addedAt: timestamp,
        updatedAt: timestamp,
        displayName: name,
        primaryContactName: primaryContact?.name || '',
        primaryEmail: primaryContact?.email || '',
        primaryPhone: primaryContact?.phone || '',
        entityContacts,
        interests: entityDoc.interests || [],
        customData: entityDoc.customData || {},
        ...(entityDoc.currentNeeds && { currentNeeds: entityDoc.currentNeeds }),
        ...(entityDoc.currentChallenges && { currentChallenges: entityDoc.currentChallenges }),
        ...(entityDoc.interestsText && { interestsText: entityDoc.interestsText }),
    };

    const automationPayload = {
        entityId,
        workspaceId,
        organizationId,
        entityName: name,
        entityType,
        assignedTo: selectedUser ? { userId: selectedUser.id, name: selectedUser.name } : null
    };

    return { 
        entityName: name, 
        entityId, 
        entityDoc, 
        workspaceEntityId, 
        workspaceEntityDoc, 
        automationPayload 
    };`;

content = content.replace(searchBlock3, replaceBlock3);

fs.writeFileSync(path, content, 'utf8');
console.log("Successfully rewritten bulk-upload-actions.ts!");
