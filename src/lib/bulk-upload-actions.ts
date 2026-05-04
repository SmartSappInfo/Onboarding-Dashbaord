'use server';

import { adminDb } from './firebase-admin';
import { logActivity } from './activity-logger';
import type { EntityContact } from './types';
import { revalidatePath } from 'next/cache';
import { normalizeContactType } from './entity-contact-helpers';
import { resolveFieldStorageBucket } from './field-storage-utils';

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

// ─── Batch Ingestion (Optimized) ─────────────────────────────────────────────

export interface BatchResult {
    successCount: number;
    errorCount: number;
    results: { row: number; status: 'success' | 'error'; entityName?: string; error?: string }[];
}

/**
 * Processes an entire batch of rows with a SINGLE context fetch.
 * This replaces the per-row `ingestSchoolRowAction` for better performance.
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
    manualTagNames: string[] = []
): Promise<BatchResult> {
    // 1. Fetch resolution context ONCE for the entire batch
    const context = await getResolutionContext(workspaceId);

    // 2. Fetch workspace industry ONCE
    let workspaceIndustry = 'SaaS';
    try {
        const wsSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
        if (wsSnap.exists) {
            workspaceIndustry = (wsSnap.data() as any)?.industry || 'SaaS';
        }
    } catch { /* Non-critical */ }

    // 3. (Pipeline logic removed as per deal-centric migration)

    // 4. Build a set of existing entity names for duplicate detection
    const existingNames = new Set<string>();
    try {
        const existingSnap = await adminDb.collection('workspace_entities')
            .where('workspaceId', '==', workspaceId)
            .select('displayName')
            .get();
        for (const doc of existingSnap.docs) {
            const n = doc.data()?.displayName;
            if (n) existingNames.add(normaliseName(n));
        }
    } catch {
        console.warn('[BULK] Could not fetch existing entities for duplicate check');
    }

    // Track names added in THIS batch to catch intra-batch duplicates
    const batchNames = new Set<string>();

    // 5. Process each row
    const results: BatchResult['results'] = [];
    let successCount = 0;
    let errorCount = 0;

    const _getValueOuter = (row: any, key: string) => {
        const header = mapping[key];
        if (!header || header === 'none') return undefined;
        return row[header];
    };

    for (let i = 0; i < rows.length; i++) {
        try {
            const row = rows[i];
            const header = mapping['name'];
            const isMapped = header && header !== 'none';
            let rawName = isMapped ? row[header] : undefined;

            if (!rawName || typeof rawName !== 'string' || !rawName.trim()) {
                if (isMapped) {
                    throw new Error("Entity Name is mapped but empty. Please provide a name in the corrections page.");
                } else {
                    const contactHeader = mapping['contact_0_name'];
                    const contactName = (contactHeader && contactHeader !== 'none') ? row[contactHeader] : undefined;
                    
                    if (contactName && typeof contactName === 'string' && contactName.trim()) {
                        rawName = contactName.trim();
                    } else {
                        throw new Error("Missing Entity Name, and no Contact Name was found to use as fallback.");
                    }
                }
            }

            const name = rawName.trim();
            const normalised = normaliseName(name);

            // Duplicate check
            if (existingNames.has(normalised) || batchNames.has(normalised)) {
                throw new Error(`Duplicate: "${name}" already exists in this workspace`);
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

    // 6. Log aggregate activity
    await logActivity({
        organizationId,
        workspaceId,
        userId,
        type: 'contacts_imported',
        source: 'system',
        description: `Bulk import: ${successCount} created, ${errorCount} errors from "${filename}"`,
        metadata: { entityType, successCount, errorCount, batchSize: rows.length },
    });

    revalidatePath('/admin/entities');
    revalidatePath('/admin/pipeline');

    return { successCount, errorCount, results };
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
): Promise<{ entityName: string }> {
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
    const selectedPackage = fuzzyMatch(context.packages as any, String(getValue('package') || '')) as any;

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

    // Save entity
    await adminDb.collection('entities').doc(entityId).set(entityDoc);

    // Save workspace entity
    const primaryContact = entityContacts.find(c => c.isPrimary);
    const workspaceEntityId = `${workspaceId}_${entityId}`;
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

    return { entityName: name };
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
    const row = result.results[0];
    if (row?.status === 'success') {
        return { success: true, entityName: row.entityName };
    }
    return { success: false, error: row?.error || 'Unknown error' };
}
