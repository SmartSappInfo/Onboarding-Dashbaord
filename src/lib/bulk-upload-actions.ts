'use server';

import { adminDb } from './firebase-admin';
import { logActivity } from './activity-logger';
import { FieldValue } from 'firebase-admin/firestore';
import type { DuplicateStrategy } from './import-types';
import { IngestionDeduplicator } from './services/IngestionDeduplicator';
import { after } from 'next/server';
import type { EntityContact } from './types';
import { revalidatePath } from 'next/cache';
import { normalizeContactType } from './entity-contact-helpers';
import { resolveFieldStorageBucket } from './field-storage-utils';
import { cleanBatch, type CleaningStats } from './import-data-cleaner';

/**
 * @fileOverview Entity-aware Batch Ingestion Engine.
 * Optimized for bulk operations — fetches resolution context ONCE per batch.
 * Supports institution, person, and family entity types.
 */

// ─── Resolution Context ──────────────────────────────────────────────────────

interface ResolutionContext {
    zones: { id: string; name: string }[];
    users: { id: string; name: string; email: string }[];
    packages: { id: string; [key: string]: any }[];
    modules: { id: string; [key: string]: any }[];
    regions: { id: string; name: string }[];
    districts: { id: string; name: string }[];
    tags: { id: string; name: string }[];
}

async function getResolutionContext(workspaceId: string): Promise<ResolutionContext> {
    const [zonesSnap, usersSnap, packagesSnap, modulesSnap, regionsSnap, districtsSnap, tagsSnap] = await Promise.all([
        adminDb.collection('zones').orderBy('name').get(),
        adminDb.collection('users').where('isAuthorized', '==', true).get(),
        adminDb.collection('subscription_packages').where('isActive', '==', true).get(),
        adminDb.collection('modules').orderBy('order').get(),
        adminDb.collection('regions').get(),
        adminDb.collection('districts').get(),
        adminDb.collection('tags').where('workspaceId', '==', workspaceId).get()
    ]);

    return {
        zones: zonesSnap.docs.map(d => ({ id: d.id, name: d.data().name })),
        users: usersSnap.docs.map(d => ({ id: d.id, name: d.data().name, email: d.data().email })),
        packages: packagesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        modules: modulesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        regions: regionsSnap.docs.map(d => ({ id: d.id, name: d.data().name })),
        districts: districtsSnap.docs.map(d => ({ id: d.id, name: d.data().name })),
        tags: tagsSnap.docs.map(d => ({ id: d.id, name: d.data().name })),
    };
}

// ─── Name Utilities ──────────────────────────────────────────────────────────

/**
 * Splits a full name into firstName and lastName using smart logic.
 * Handles prefixes (Dr., Mr., Mrs.), multi-word last names, etc.
 */
function splitPersonName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' };
    if (parts.length === 2) return { firstName: parts[0], lastName: parts[1] };

    // If first part looks like a title, include it with the first name
    const titles = ['dr', 'dr.', 'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'prof', 'prof.', 'rev', 'rev.'];
    if (titles.includes(parts[0].toLowerCase())) {
        return {
            firstName: parts.slice(0, 2).join(' '),
            lastName: parts.slice(2).join(' '),
        };
    }

    // Default: last word is lastName, everything else is firstName
    return {
        firstName: parts.slice(0, -1).join(' '),
        lastName: parts[parts.length - 1],
    };
}

function normaliseName(name: string): string {
    return name.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

// ─── Fuzzy Matchers ──────────────────────────────────────────────────────────

function fuzzyMatch<T extends { name: string }>(items: T[], query: string): T | null {
    if (!query) return null;
    const q = query.toLowerCase().trim();
    return items.find(item => item.name.toLowerCase().includes(q)) || null;
}

// ─── Batch Ingestion Constants ────────────────────────────────────────────────

/** Number of pending rows processed per background invocation. */
const IMPORT_CHUNK_SIZE = 30;

export interface BatchResult {
    successCount: number;
    errorCount: number;
    results: { row: number; status: 'success' | 'error'; entityName?: string; error?: string }[];
    cleaningStats?: CleaningStats;
}

/**
 * Fire-and-forget bulk ingestion entry point.
 *
 * Cleans CSV data, persists all rows to `import_logs/{id}/pending_rows`, then
 * returns `{ importLogId }` immediately so the UI can navigate away safely.
 * Processing is handled entirely by `processImportChunkBackground` which
 * self-schedules via `after()` until the subcollection is drained.
 */
export async function ingestBatchAction(
    rows: any[],
    mapping: Record<string, string>,
    userId: string,
    filename: string,
    workspaceId: string,
    organizationId: string,
    entityType: string,
    autoCreateTags: boolean = false,
    defaultValues: Record<string, string> = {},
    globalTagIds: string[] = [],
    automationId?: string,
    manualTagNames: string[] = [],
    enableTitleCase: boolean = false
): Promise<{ importLogId: string }> {
    // 1. Workspace metadata (needed for data cleaning)
    let workspaceIndustry = 'SaaS';
    let defaultCountryCode = 'GH';
    try {
        const [wsSnap, orgSnap] = await Promise.all([
            adminDb.collection('workspaces').doc(workspaceId).get(),
            adminDb.collection('organizations').doc(organizationId).get()
        ]);
        if (wsSnap.exists) workspaceIndustry = (wsSnap.data() as any)?.industry || 'SaaS';
        if (orgSnap.exists) defaultCountryCode = (orgSnap.data() as any)?.defaultCountryCode || 'GH';
    } catch { /* Non-critical */ }

    // 2. Data cleaning — run synchronously so rows are clean before storage
    const { stats: cleaningStats } = cleanBatch(rows, mapping, defaultCountryCode, enableTitleCase);
    console.log('[BULK] Data cleaning stats:', cleaningStats);

    // 3. Create import log with 'queued' status and persisted import config
    const importLogId = `implog_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const importLogRef = adminDb.collection('import_logs').doc(importLogId);

    await importLogRef.set({
        id: importLogId,
        workspaceId,
        organizationId,
        userId,
        filename,
        entityType,
        status: 'queued',
        totalCount: rows.length,
        successCount: 0,
        failedCount: 0,
        duplicateCount: 0,
        selectedTags: globalTagIds,
        automationId: automationId || null,
        startedAt: FieldValue.serverTimestamp(),
        rawFieldsCleared: false,
        // Config stored here so the background worker needs no closure state
        _importConfig: {
            mapping,
            autoCreateTags,
            defaultValues,
            globalTagIds,
            automationId: automationId || null,
            manualTagNames,
            workspaceIndustry,
            defaultCountryCode,
            enableTitleCase,
        }
    });

    // 4. Fan-out rows to pending_rows (batches of 450 to stay under Firestore limit)
    const pendingRowsRef = importLogRef.collection('pending_rows');
    for (let i = 0; i < rows.length; i += 450) {
        const wb = adminDb.batch();
        const chunk = rows.slice(i, i + 450);
        for (let j = 0; j < chunk.length; j++) {
            const globalIdx = i + j;
            // Zero-padded key ensures lexicographic order === row order
            const docRef = pendingRowsRef.doc(`row_${String(globalIdx).padStart(6, '0')}`);
            wb.set(docRef, { rowIdx: globalIdx, rawPayload: chunk[j], createdAt: FieldValue.serverTimestamp() });
        }
        await wb.commit();
    }

    // 5. Kick off first background chunk — subsequent chunks self-schedule
    after(async () => {
        try {
            await processImportChunkBackground(importLogId);
        } catch (e) {
            console.error('[BULK] Initial chunk scheduling failed:', (e as Error).message);
            await importLogRef.update({ status: 'failed' });
        }
    });

    return { importLogId };
}

/**
 * Background worker — processes IMPORT_CHUNK_SIZE pending rows, writes results,
 * deletes those rows, updates counters atomically, then self-schedules via after().
 *
 * Key properties:
 * - Browser-independent: all state lives in Firestore.
 * - Atomic counters: FieldValue.increment() prevents race conditions.
 * - Targeted queries: only queries identifiers present in the current chunk.
 * - Intra-batch dedup: local maps catch duplicates within the same chunk.
 */
export async function processImportChunkBackground(importLogId: string): Promise<void> {
    const importLogRef = adminDb.collection('import_logs').doc(importLogId);
    const importLogSnap = await importLogRef.get();

    if (!importLogSnap.exists) {
        console.error(`[BULK-BG] Import log ${importLogId} not found`);
        return;
    }

    const importLog = importLogSnap.data() as any;

    // Guard: already finalised
    if (['completed', 'partially_completed', 'failed'].includes(importLog.status)) return;

    // Transition to processing on first invocation
    if (importLog.status === 'queued') {
        await importLogRef.update({ status: 'processing' });
    }

    // Fetch next chunk of pending rows in insertion order
    const pendingSnap = await importLogRef.collection('pending_rows')
        .orderBy('rowIdx', 'asc')
        .limit(IMPORT_CHUNK_SIZE)
        .get();

    // No pending rows → finalize
    if (pendingSnap.empty) {
        const hasIssues = (importLog.failedCount ?? 0) > 0 || (importLog.duplicateCount ?? 0) > 0;
        await importLogRef.update({
            status: hasIssues ? 'partially_completed' : 'completed',
            completedAt: FieldValue.serverTimestamp(),
        });
        await logActivity({
            organizationId: importLog.organizationId,
            workspaceId: importLog.workspaceId,
            userId: importLog.userId,
            type: 'contacts_imported',
            source: 'system',
            description: `Bulk import finished: ${importLog.successCount ?? 0} created, ${importLog.failedCount ?? 0} failed, ${importLog.duplicateCount ?? 0} duplicates.`,
            metadata: { importLogId, entityType: importLog.entityType },
        });
        return;
    }

    // Resolve stored import config
    const cfg = importLog._importConfig ?? {};
    const {
        mapping = {} as Record<string, string>,
        autoCreateTags = false,
        defaultValues = {} as Record<string, string>,
        globalTagIds = [] as string[],
        automationId = null as string | null,
        manualTagNames = [] as string[],
        workspaceIndustry = 'SaaS',
    } = cfg;

    // Fetch resolution context once per chunk (zones, tags, users, etc.)
    const context = await getResolutionContext(importLog.workspaceId);

    // Targeted duplicate-detection: extract emails from this chunk only
    const emailKey = mapping['contact_0_email'] || mapping['primaryEmail'];
    const chunkEmails = pendingSnap.docs
        .map(d => d.data().rawPayload?.[emailKey])
        .filter(Boolean)
        .map((e: any) => String(e).toLowerCase().trim());

    const existingByEmail = new Map<string, any>();
    const existingByName = new Map<string, any>();
    const existingByPhone = new Map<string, any>();

    // Query existing entities matching this chunk's emails (batched in groups of 10)
    for (let i = 0; i < chunkEmails.length; i += 10) {
        const emailBatch = chunkEmails.slice(i, i + 10);
        try {
            const snap = await adminDb.collection('workspace_entities')
                .where('workspaceId', '==', importLog.workspaceId)
                .where('primaryEmail', 'in', emailBatch)
                .select('displayName', 'primaryEmail', 'primaryPhone', 'entityContacts')
                .get();
            for (const doc of snap.docs) {
                const data: any = { id: doc.id, ...doc.data() };
                if (data.primaryEmail) existingByEmail.set(data.primaryEmail.toLowerCase().trim(), data);
                if (data.displayName) existingByName.set(normaliseName(data.displayName), data);
                if (data.primaryPhone) existingByPhone.set(data.primaryPhone.replace(/[^0-9]/g, ''), data);
            }
        } catch (e) {
            console.warn('[BULK-BG] Targeted email query failed:', (e as Error).message);
        }
    }

    // Process rows
    let successIncrement = 0;
    let failedIncrement = 0;
    let duplicateIncrement = 0;
    const failedRowDocs: any[] = [];
    const duplicateRowDocs: any[] = [];

    for (const pendingDoc of pendingSnap.docs) {
        const { rowIdx, rawPayload } = pendingDoc.data();
        try {
            const nameHeader = mapping['name'];
            const isMapped = nameHeader && nameHeader !== 'none';
            let rawName = isMapped ? rawPayload[nameHeader] : undefined;
            if (rawName === undefined || rawName === null || rawName === '') {
                rawName = defaultValues?.['name'];
            }

            if (!rawName || typeof rawName !== 'string' || !rawName.trim()) {
                const contactHeader = mapping['contact_0_name'];
                let contactName = (contactHeader && contactHeader !== 'none') ? rawPayload[contactHeader] : undefined;
                if (contactName === undefined || contactName === null || contactName === '') {
                    contactName = defaultValues?.['contact_0_name'];
                }
                if (contactName && typeof contactName === 'string' && contactName.trim()) {
                    rawName = contactName.trim();
                } else {
                    throw new Error('Missing Entity Name, and no Contact Name was found to use as fallback.');
                }
            }

            const name = rawName.trim();
            const normalised = normaliseName(name);

            const extracted = await processRow(
                rawPayload, mapping, name, importLog.entityType, context,
                workspaceIndustry, importLog.workspaceId, importLog.organizationId,
                importLog.userId, importLog.filename, autoCreateTags,
                defaultValues, globalTagIds, automationId ?? undefined, manualTagNames
            );

            const normalisedEmail = extracted.workspaceEntityDoc.primaryEmail?.toLowerCase().trim();
            const normalisedPhone = extracted.workspaceEntityDoc.primaryPhone?.replace(/[^0-9]/g, '');

            let existingEntity: any = null;
            if (existingByName.has(normalised)) existingEntity = existingByName.get(normalised);
            else if (normalisedEmail && existingByEmail.has(normalisedEmail)) existingEntity = existingByEmail.get(normalisedEmail);
            else if (normalisedPhone && existingByPhone.has(normalisedPhone)) existingEntity = existingByPhone.get(normalisedPhone);

            console.log(`[BULK-BG] Row ${rowIdx} (${normalisedEmail}): matched =`, existingEntity ? existingEntity.id : 'None');

            if (existingEntity) {
                duplicateIncrement++;
                const matchedOn: string[] = [];
                if (existingByName.has(normalised)) matchedOn.push('Name');
                if (normalisedEmail && existingByEmail.has(normalisedEmail)) matchedOn.push('Email');
                if (normalisedPhone && existingByPhone.has(normalisedPhone)) matchedOn.push('Phone');
                duplicateRowDocs.push({
                    id: `dup_${Date.now()}_${rowIdx}`,
                    importLogId, rowIdx, rawPayload, matchedEntityId: existingEntity.id,
                    matchedOn, resolved: false, createdAt: FieldValue.serverTimestamp()
                });
            } else {
                await adminDb.collection('entities').doc(extracted.entityId).set(extracted.entityDoc);
                await adminDb.collection('workspace_entities').doc(extracted.workspaceEntityId).set(extracted.workspaceEntityDoc);

                const { triggerAutomationProtocols, runAutomationById } = await import('./automation-processor');
                await triggerAutomationProtocols('ENTITY_CREATED', extracted.automationPayload);
                if (automationId) await runAutomationById(automationId, extracted.automationPayload);

                // Update local maps for intra-batch dedup
                existingByName.set(normalised, extracted.workspaceEntityDoc);
                if (normalisedEmail) existingByEmail.set(normalisedEmail, extracted.workspaceEntityDoc);
                if (normalisedPhone) existingByPhone.set(normalisedPhone, extracted.workspaceEntityDoc);
                successIncrement++;
            }
        } catch (err: any) {
            failedIncrement++;
            failedRowDocs.push({
                id: `fail_${Date.now()}_${rowIdx}`,
                importLogId, rowIdx, rawPayload,
                error: err.message || 'Unknown error',
                resolved: false, retryCount: 0, createdAt: FieldValue.serverTimestamp()
            });
        }
    }

    // Atomic batch: persist results + delete processed rows
    const wb = adminDb.batch();
    for (const fr of failedRowDocs) wb.set(importLogRef.collection('failed_rows').doc(fr.id), fr);
    for (const dr of duplicateRowDocs) wb.set(importLogRef.collection('duplicate_rows').doc(dr.id), dr);
    for (const doc of pendingSnap.docs) wb.delete(doc.ref);
    await wb.commit();

    // Atomic counter update — no read-modify-write race
    await importLogRef.update({
        successCount: FieldValue.increment(successIncrement),
        failedCount: FieldValue.increment(failedIncrement),
        duplicateCount: FieldValue.increment(duplicateIncrement),
    });

    // Self-schedule next chunk
    after(async () => {
        try {
            await processImportChunkBackground(importLogId);
        } catch (e) {
            console.error('[BULK-BG] Next chunk scheduling failed:', (e as Error).message);
            await importLogRef.update({ status: 'failed' });
        }
    });
}

// ─── Per-Row Processing (Internal) ───────────────────────────────────────────

async function processRow(
    row: any,
    mapping: Record<string, string>,
    name: string,
    entityType: string,
    context: ResolutionContext,
    workspaceIndustry: string,
    workspaceId: string,
    organizationId: string,
    userId: string,
    filename: string,
    autoCreateTags: boolean = false,
    defaultValues: Record<string, string> = {},
    globalTagIds: string[] = [],
    automationId?: string,
    manualTagNames: string[] = []
): Promise<any> {
    const getValue = (key: string) => {
        const header = mapping[key];
        const rawVal = (!header || header === 'none') ? undefined : row[header];
        if (rawVal === undefined || rawVal === null || rawVal === '') {
            return defaultValues[key];
        }
        return rawVal;
    };

    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const companyValue = getValue('company');
    const sourceForInitials = companyValue ? String(companyValue).trim() : name;
    const _initials = getValue('initials') || sourceForInitials.split(' ').map(w => w[0]).join('').toUpperCase();
    const _lifecycleStatus = getValue('lifecycleStatus') || 'Onboarding';

    // Fuzzy matching Locations
    const selectedRegion = fuzzyMatch(context.regions, String(getValue('locationRegion') || ''));
    const selectedDistrict = fuzzyMatch(context.districts, String(getValue('locationDistrict') || ''));
    const selectedZone = fuzzyMatch(context.zones, String(getValue('zone') || ''));
    
    const locationObj = {
        region: selectedRegion ? { id: selectedRegion.id, name: selectedRegion.name } : null,
        district: selectedDistrict ? { id: selectedDistrict.id, name: selectedDistrict.name } : null,
        zone: selectedZone ? { id: selectedZone.id, name: selectedZone.name } : null,
        locationString: String(getValue('locationString') || '')
    };

    const selectedUser = fuzzyMatch(context.users, String(getValue('assignedTo') || ''));
    const selectedPackage = fuzzyMatch(context.packages as any, String(getValue('package') || getValue('subscriptionPackageName') || '')) as any;

    const rawModulesStr = getValue('modules');
    const selectedModules = rawModulesStr ? String(rawModulesStr).split(',').map(m => {
        return context.modules.find(mod =>
            (mod as any).name?.toLowerCase().includes(m.trim().toLowerCase()) ||
            (mod as any).abbreviation?.toLowerCase() === m.trim().toLowerCase()
        );
    }).filter(Boolean) as any[] : [];

    // Build EntityContacts from dynamic contact slots (contact_0_*, contact_1_*, ...)
    const entityContacts: EntityContact[] = [];
    
    // Detect how many contact slots are in the mapping
    const contactSlotIndices = new Set<number>();
    Object.keys(mapping).forEach(key => {
        const match = key.match(/^contact_(\d+)_/);
        if (match) contactSlotIndices.add(parseInt(match[1]));
    });
    
    // Sort indices to ensure contact_0 is processed first (primary)
    const sortedSlotIndices = Array.from(contactSlotIndices).sort((a, b) => a - b);
    
    for (const slotIdx of sortedSlotIndices) {
        const contactName = getValue(`contact_${slotIdx}_name`);
        const contactEmail = getValue(`contact_${slotIdx}_email`);
        const contactPhone = getValue(`contact_${slotIdx}_phone`);
        const contactRole = getValue(`contact_${slotIdx}_role`);
        
        // Skip completely empty slots (no data at all)
        if (!contactName && !contactEmail && !contactPhone) continue;
        
        const isPrimary = slotIdx === 0;
        const typeLabel = String(contactRole || (entityType === 'family' ? 'Guardian' : entityType === 'person' ? 'Primary' : 'Administrator'));
        
        const ec: any = {
            id: `ec_${crypto.randomUUID().substring(0, 8)}`,
            // Contacts without a name fall back to the entity name
            name: String(contactName || name),
            typeKey: normalizeContactType(typeLabel),
            typeLabel,
            isPrimary,
            isSignatory: isPrimary,
            order: slotIdx,
            createdAt: new Date().toISOString(),
        };
        if (contactEmail) ec.email = String(contactEmail);
        if (contactPhone) ec.phone = String(contactPhone);
        entityContacts.push(ec as EntityContact);
    }
    
    // If no contacts were mapped at all, create a minimal primary contact from the entity name
    if (entityContacts.length === 0) {
        entityContacts.push({
            id: `ec_${crypto.randomUUID().substring(0, 8)}`,
            name: name,
            typeKey: entityType === 'family' ? 'guardian' : entityType === 'person' ? 'primary' : 'administrator',
            typeLabel: entityType === 'family' ? 'Guardian' : entityType === 'person' ? 'Primary' : 'Administrator',
            isPrimary: true,
            isSignatory: true,
            order: 0,
            createdAt: new Date().toISOString(),
        } as EntityContact);
    }

    // Tags processing
    const rawTagsStr = getValue('workspaceTags');
    const tagIds: string[] = [...globalTagIds];
    if (rawTagsStr) {
        const tagNames = String(rawTagsStr).split(',').map(t => t.trim()).filter(Boolean);
        for (const tagName of tagNames) {
            let matchedTag = fuzzyMatch(context.tags, tagName);
            if (matchedTag) {
                if (!tagIds.includes(matchedTag.id)) tagIds.push(matchedTag.id);
            } else if (autoCreateTags) {
                const newTagRef = adminDb.collection('tags').doc();
                const newTagData = {
                    name: tagName,
                    slug: normaliseName(tagName).replace(/\s+/g, '-'),
                    workspaceId,
                    organizationId,
                    color: '#94a3b8',
                    createdBy: userId,
                    createdAt: new Date().toISOString()
                };
                await newTagRef.set(newTagData);
                tagIds.push(newTagRef.id);
                context.tags.push({ id: newTagRef.id, name: tagName });
            }
        }
    }

    for (const tagName of manualTagNames) {
        let matchedTag = fuzzyMatch(context.tags, tagName);
        if (matchedTag) {
            if (!tagIds.includes(matchedTag.id)) tagIds.push(matchedTag.id);
        } else {
            const newTagRef = adminDb.collection('tags').doc();
            const newTagData = {
                name: tagName,
                slug: normaliseName(tagName).replace(/\s+/g, '-'),
                workspaceId,
                organizationId,
                color: '#94a3b8',
                createdBy: userId,
                createdAt: new Date().toISOString()
            };
            await newTagRef.set(newTagData);
            tagIds.push(newTagRef.id);
            context.tags.push({ id: newTagRef.id, name: tagName });
        }
    }

    // Build entity document
    const entityId = `entity_${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();

    // Initialize Storage Buckets
    const entityDoc: any = {
        id: entityId,
        organizationId,
        entityType,
        globalTags: [],
        location: locationObj,
        status: 'active',
        createdAt: timestamp,
        updatedAt: timestamp,
        industry: workspaceIndustry,
        customData: {}
    };

    const financeData: any = {};
    const industryData: any = {};
    const personData: any = {};
    const familyData: any = { guardians: [], children: [] };

    // Process ALL mapped fields dynamically
    Object.keys(mapping).forEach(variableName => {
        const value = getValue(variableName);
        if (value === undefined || value === null || value === '') return;

        // Skip contact slot fields — already handled by the entityContacts builder above
        if (/^contact_\d+_/.test(variableName)) return;

        const bucket = resolveFieldStorageBucket(variableName, entityType as any, workspaceIndustry as any);
        
        switch (bucket) {
            case 'root':
                entityDoc[variableName] = value;
                break;
            case 'financeData':
                financeData[variableName] = value;
                break;
            case 'industryData':
                industryData[variableName] = value;
                break;
            case 'personData':
                personData[variableName] = value;
                break;
            case 'familyData':
                // Special handling for family fields if needed, or just flat storage
                familyData[variableName] = value;
                break;
            case 'customData':
                entityDoc.customData[variableName] = value;
                break;
        }
    });

    // Post-processing & Derived fields
    entityDoc.name = name;
    entityDoc.slug = slug;
    entityDoc.entityContacts = entityContacts;
    if (!entityDoc.initials) {
        entityDoc.initials = name.split(' ').map(w => w[0]).join('').toUpperCase();
    }

    if (Object.keys(financeData).length > 0) {
        entityDoc.financeData = { 
            currency: getValue('currency') || 'GHS',
            billingAddress: getValue('billingAddress') || '',
            subscriptionRate: Number(getValue('subscriptionRate')) || selectedPackage?.ratePerStudent || 0,
            ...financeData 
        };
        if (selectedPackage?.id) entityDoc.financeData.subscriptionIds = [selectedPackage.id];
    }

    if (Object.keys(industryData).length > 0) {
        entityDoc.industryData = { ...industryData };
    }

    if (entityType === 'person') {
        const { firstName, lastName } = splitPersonName(name);
        entityDoc.personData = { firstName, lastName, ...personData };
    } else if (entityType === 'family') {
        // Build guardians/children if missing but raw data present
        if (familyData.guardians.length === 0 && (getValue('contactName') || name)) {
            familyData.guardians.push({
                name: String(getValue('contactName') || name),
                phone: String(getValue('contactPhone') || ''),
                email: String(getValue('contactEmail') || ''),
                relationship: getValue('relationship') || 'Guardian',
                isPrimary: true,
            });
        }
        if (familyData.children.length === 0 && getValue('childFirstName')) {
            familyData.children.push({
                firstName: String(getValue('childFirstName')),
                lastName: getValue('childLastName') || '',
                gradeLevel: getValue('childGradeLevel') || '',
            });
        }
        entityDoc.familyData = familyData;
    }

    if (selectedModules.length > 0) {
        entityDoc.interests = selectedModules.map((m: any) => ({ id: m.id, name: m.name, abbreviation: m.abbreviation, color: m.color }));
    }

    // ── Narrative Fields (currentNeeds, currentChallenges, interests text) ────
    const currentNeeds = getValue('currentNeeds');
    if (currentNeeds) entityDoc.currentNeeds = String(currentNeeds);
    const currentChallenges = getValue('currentChallenges');
    if (currentChallenges) entityDoc.currentChallenges = String(currentChallenges);
    const interestsText = getValue('interests');
    if (interestsText) entityDoc.interestsText = String(interestsText);

    const primaryContact = entityContacts.find(c => c.isPrimary);
    const workspaceEntityId = `${workspaceId}_${entityId}`;
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
    };
}

// ─── Legacy Compat: Single-Row Action ────────────────────────────────────────

/**
 * @deprecated Use `ingestBatchAction` for better performance.
 * Kept for backward compatibility with existing callers.
 */
export async function ingestSchoolRowAction(
    rawData: any,
    mapping: Record<string, string>,
    userId: string,
    filename: string,
    workspaceId: string = 'onboarding',
    organizationId: string = 'smartsapp-hq',
    entityType: string = 'institution'
) {
    const result = await ingestBatchAction(
        [rawData], mapping, userId, filename,
        workspaceId, organizationId, entityType
    );
    // Return early success since it's background processed now.
    return { success: true, entityName: 'Importing in background', importLogId: result.importLogId };
}

// ─── Imports Auditing Logs & TTL Cleanup ─────────────────────────────────────

export async function getImportsLogsListAction(workspaceId: string, limitCount = 50) {
    const snap = await adminDb.collection('import_logs')
        .where('workspaceId', '==', workspaceId)
        .orderBy('startedAt', 'desc')
        .limit(limitCount)
        .get();
        
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Sweeps and deletes detailed failed rows for any import logs older than 72 hours.
 * Only deletes the heavy payloads, keeping the core analytics document.
 */
export async function purgeExpiredFailedImportsAction(workspaceId: string) {
    const ttlThreshold = new Date(Date.now() - 72 * 60 * 60 * 1000);
    
    // We sort on the primary field. Missing index risk is low if we filter by rawFieldsCleared.
    const expiredSnap = await adminDb.collection('import_logs')
        .where('workspaceId', '==', workspaceId)
        .where('rawFieldsCleared', '==', false)
        .get();

    let logsClearedCount = 0;
    
    for (const docSnap of expiredSnap.docs) {
        const data = docSnap.data();
        const startedAtDate = data.startedAt?.toDate?.() || new Date(data.startedAt);
        
        if (startedAtDate < ttlThreshold) {
            // Delete subcollection failed_rows
            const subSnap = await docSnap.ref.collection('failed_rows').limit(500).get();
            if (!subSnap.empty) {
                const wb = adminDb.batch();
                subSnap.docs.forEach(d => wb.delete(d.ref));
                await wb.commit();
            }
            
            // Mark as cleared
            await docSnap.ref.update({ rawFieldsCleared: true });
            logsClearedCount++;
        }
    }
    
    return { success: true, logsClearedCount };
}

export async function getFailedRowsAction(importLogId: string) {
    const snap = await adminDb.collection('import_logs').doc(importLogId).collection('failed_rows')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();
    return snap.docs.map(d => {
        const data = d.data();
        return { 
            id: d.id, 
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt
        };
    });
}

export async function updateFailedRowAction(importLogId: string, rowId: string, updatedPayload: any) {
    await adminDb.collection('import_logs').doc(importLogId).collection('failed_rows').doc(rowId).update({
        rawPayload: updatedPayload,
        updatedAt: FieldValue.serverTimestamp()
    });
    return { success: true };
}

export async function getDuplicateRowsAction(importLogId: string) {
    const snap = await adminDb.collection('import_logs')
        .doc(importLogId)
        .collection('duplicate_rows')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();

    // Helper: recursively convert any Firestore Timestamp into an ISO string
    // so that Next.js Server Actions can safely serialize the response.
    function sanitizeTimestamps(obj: any): any {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj?.toDate === 'function') return obj.toDate().toISOString();
        if (Array.isArray(obj)) return obj.map(sanitizeTimestamps);
        if (typeof obj === 'object') {
            const out: any = {};
            for (const key of Object.keys(obj)) out[key] = sanitizeTimestamps(obj[key]);
            return out;
        }
        return obj;
    }

    const rows = snap.docs.map(d => {
        const data = d.data();
        return sanitizeTimestamps({ id: d.id, ...data });
    });

    // Enrich with existing entity data for side-by-side comparison
    const uniqueEntityIds = [...new Set(rows.map((r: any) => r.matchedEntityId).filter(Boolean))];
    const entityDataMap: Record<string, { name: string; entityContacts: any[] }> = {};

    await Promise.all(uniqueEntityIds.map(async (entityId) => {
        try {
            // Try workspace_entities first (has denormalized contacts)
            const weSnap = await adminDb.collection('workspace_entities').doc(entityId as string).get();
            if (weSnap.exists) {
                const we = weSnap.data()!;
                entityDataMap[entityId as string] = {
                    name: we.displayName || we.name || we.entityName || '',
                    entityContacts: we.entityContacts || [],
                };
                return;
            }
            // Fallback to entities collection
            const entSnap = await adminDb.collection('entities').doc(entityId as string).get();
            if (entSnap.exists) {
                const ent = entSnap.data()!;
                entityDataMap[entityId as string] = {
                    name: ent.name || '',
                    entityContacts: ent.entityContacts || [],
                };
            }
        } catch {
            // Non-blocking: if entity fetch fails, comparison will show partial data
        }
    }));

    return rows.map((row: any) => ({
        ...row,
        existingEntityData: row.matchedEntityId ? (entityDataMap[row.matchedEntityId] || null) : null,
    }));
}


export async function resolveDuplicatesAction(
    importLogId: string, 
    resolutions: { duplicateRowId: string; strategy: DuplicateStrategy; tagIds?: string[]; customPayload?: any }[],
    globalTagIds: string[] = []
) {
    const importLogRef = adminDb.collection('import_logs').doc(importLogId);
    const importLogSnap = await importLogRef.get();
    if (!importLogSnap.exists) {
        throw new Error('Import log not found');
    }
    const importLog = importLogSnap.data() as any;
    
    // Resolve stored import config
    const cfg = importLog._importConfig ?? {};
    const {
        mapping = {} as Record<string, string>,
        autoCreateTags = false,
        defaultValues = {} as Record<string, string>,
        globalTagIds: cfgGlobalTagIds = [] as string[],
        automationId = null as string | null,
        manualTagNames = [] as string[],
        workspaceIndustry = 'SaaS',
    } = cfg;

    const resolutionTags = globalTagIds.length > 0 ? globalTagIds : cfgGlobalTagIds;

    // Fetch resolution context once
    const context = await getResolutionContext(importLog.workspaceId);

    // Resolve manualTagNames into actual tag IDs for duplicates
    let resolvedManualTagIds: string[] = [];
    if (manualTagNames && manualTagNames.length > 0) {
        for (const tagName of manualTagNames) {
            let matchedTag = fuzzyMatch(context.tags, tagName);
            if (matchedTag) {
                if (!resolvedManualTagIds.includes(matchedTag.id)) resolvedManualTagIds.push(matchedTag.id);
            } else {
                // If somehow it wasn't created during the background processing, create it now
                const newTagRef = adminDb.collection('tags').doc();
                const newTagData = {
                    name: tagName,
                    slug: normaliseName(tagName).replace(/\s+/g, '-'),
                    workspaceId: importLog.workspaceId,
                    organizationId: importLog.organizationId || 'smartsapp-hq',
                    color: '#94a3b8',
                    createdBy: importLog.userId,
                    createdAt: new Date().toISOString()
                };
                await newTagRef.set(newTagData);
                resolvedManualTagIds.push(newTagRef.id);
                context.tags.push({ id: newTagRef.id, name: tagName });
            }
        }
    }

    // Combine global tag IDs with any newly resolved manual tag IDs
    const effectiveResolutionTags = [...new Set([...resolutionTags, ...resolvedManualTagIds])];

    let manualCorrectionsCount = 0;

    // Process in batches
    for (let i = 0; i < resolutions.length; i += 100) {
        const chunk = resolutions.slice(i, i + 100);
        const automationsToRun: { automationPayload: any; automationId?: string | null }[] = [];
        
        await adminDb.runTransaction(async (transaction) => {
            for (const { duplicateRowId, strategy, tagIds, customPayload } of chunk) {
                const dupRef = adminDb.collection('import_logs').doc(importLogId).collection('duplicate_rows').doc(duplicateRowId);
                const dupSnap = await transaction.get(dupRef);
                
                if (!dupSnap.exists) continue;
                
                const dupData = dupSnap.data();
                if (dupData?.resolved) continue;
                
                const existingEntityRef = adminDb.collection('workspace_entities').doc(dupData?.matchedEntityId);
                const existingSnap = await transaction.get(existingEntityRef);
                
                if (strategy === 'MANUAL_CORRECTION' || strategy === 'CREATE_NEW') {
                    const payload = strategy === 'MANUAL_CORRECTION' ? (customPayload || dupData?.rawPayload) : dupData?.rawPayload;
                    
                    const nameHeader = mapping['name'];
                    const isMapped = nameHeader && nameHeader !== 'none';
                    let rawName = isMapped ? payload[nameHeader] : undefined;
                    if (rawName === undefined || rawName === null || rawName === '') {
                        rawName = defaultValues?.['name'];
                    }

                    if (!rawName || typeof rawName !== 'string' || !rawName.trim()) {
                        const contactHeader = mapping['contact_0_name'];
                        let contactName = (contactHeader && contactHeader !== 'none') ? payload[contactHeader] : undefined;
                        if (contactName === undefined || contactName === null || contactName === '') {
                            contactName = defaultValues?.['contact_0_name'];
                        }
                        if (contactName && typeof contactName === 'string' && contactName.trim()) {
                            rawName = contactName.trim();
                        } else {
                            throw new Error('Missing Entity Name, and no Contact Name was found to use as fallback.');
                        }
                    }

                    const name = rawName.trim();
                    
                    const extracted = await processRow(
                        payload, mapping, name, importLog.entityType, context,
                        workspaceIndustry, importLog.workspaceId, importLog.organizationId,
                        importLog.userId, importLog.filename, autoCreateTags,
                        defaultValues, tagIds || effectiveResolutionTags, automationId ?? undefined, manualTagNames
                    );
                    
                    transaction.set(adminDb.collection('entities').doc(extracted.entityId), extracted.entityDoc);
                    transaction.set(adminDb.collection('workspace_entities').doc(extracted.workspaceEntityId), extracted.workspaceEntityDoc);
                    
                    automationsToRun.push({
                        automationPayload: extracted.automationPayload,
                        automationId
                    });
                    
                    manualCorrectionsCount++;
                } else if (existingSnap.exists) {
                    if (strategy !== 'SKIP') {
                        const existingEntity = { id: existingSnap.id, ...existingSnap.data() };
                        const finalTagsForReconciliation = tagIds || effectiveResolutionTags;
                        const reconciled = IngestionDeduplicator.reconcile(existingEntity, dupData?.rawPayload, strategy, finalTagsForReconciliation);
                        
                        if (reconciled) {
                            transaction.update(existingEntityRef, {
                                ...reconciled,
                                updatedAt: new Date().toISOString()
                            });
                        }
                    }
                }
                
                // Mark duplicate row as resolved
                transaction.update(dupRef, {
                    resolved: true,
                    resolvedAt: FieldValue.serverTimestamp(),
                    appliedStrategy: strategy
                });
            }
        });

        // Trigger automations
        if (automationsToRun.length > 0) {
            try {
                const { triggerAutomationProtocols, runAutomationById } = await import('./automation-processor');
                for (const auto of automationsToRun) {
                    await triggerAutomationProtocols('ENTITY_CREATED', auto.automationPayload);
                    if (auto.automationId) {
                        await runAutomationById(auto.automationId, auto.automationPayload);
                    }
                }
            } catch (err) {
                console.error('[BULK-RESOLVE] Automations failed:', err);
            }
        }
    }
    
    // Update main import log duplicate metrics
    await adminDb.collection('import_logs').doc(importLogId).update({
        resolvedDuplicateCount: FieldValue.increment(resolutions.length),
        successCount: FieldValue.increment(manualCorrectionsCount),
        updatedAt: FieldValue.serverTimestamp()
    });
    
    return { success: true };
}
