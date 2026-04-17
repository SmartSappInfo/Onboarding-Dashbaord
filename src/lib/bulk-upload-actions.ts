'use server';

import { adminDb } from './firebase-admin';
import { logActivity } from './activity-logger';
import type { School, UserProfile, SubscriptionPackage, Zone, Module, OnboardingStage, EntityContact } from './types';
import { revalidatePath } from 'next/cache';
import { normalizeContactType, entityContactToFocalPerson } from './entity-contact-helpers';

/**
 * @fileOverview Logic-based Institutional Ingestion Engine.
 * Processes spreadsheet rows using direct mapping logic without AI.
 */

/**
 * Fetches relevant system context for name-to-ID resolution.
 */
async function getResolutionContext() {
    const [zonesSnap, usersSnap, packagesSnap, modulesSnap] = await Promise.all([
        adminDb.collection('zones').orderBy('name').get(),
        adminDb.collection('users').where('isAuthorized', '==', true).get(),
        adminDb.collection('subscription_packages').where('isActive', '==', true).get(),
        adminDb.collection('modules').orderBy('order').get(),
    ]);

    return {
        zones: zonesSnap.docs.map(d => ({ id: d.id, name: d.data().name })),
        users: usersSnap.docs.map(d => ({ id: d.id, name: d.data().name, email: d.data().email })),
        packages: packagesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        modules: modulesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    };
}

/**
 * Deterministically ingests a single school record from raw data.
 */
export async function ingestSchoolRowAction(
    rawData: any, 
    mapping: Record<string, string>, 
    userId: string,
    filename: string
) {
    try {
        const context = await getResolutionContext();
        
        // 1. Resolve Values using the Provided Mapping
        const getValue = (key: string) => {
            const header = mapping[key];
            if (!header || header === 'none') return undefined;
            return rawData[header];
        };

        const rawName = getValue('name');
        if (!rawName || typeof rawName !== 'string') {
            throw new Error("Mandatory field 'School Name' is missing or invalid in this row.");
        }

        const name = rawName.trim();
        const initials = getValue('initials') || name.split(' ').map(w => w[0]).join('').toUpperCase();
        const slogan = getValue('slogan') || '';
        const location = getValue('location') || '';
        const nominalRoll = Number(getValue('nominalRoll')) || 0;
        const currency = getValue('currency') || 'GHS';
        const billingAddress = getValue('billingAddress') || location;
        
        // 2. Fuzzy Match Zone
        const rawZone = getValue('zone');
        const selectedZone = rawZone ? context.zones.find(z => z.name.toLowerCase().includes(String(rawZone).toLowerCase())) : null;

        // 3. Fuzzy Match Manager
        const rawManager = getValue('assignedTo');
        const selectedUser = rawManager ? context.users.find(u => u.name.toLowerCase().includes(String(rawManager).toLowerCase())) : null;

        // 4. Fuzzy Match Package
        const rawPkg = getValue('package');
        const selectedPackage = rawPkg ? context.packages.find(p => (p as any).name.toLowerCase().includes(String(rawPkg).toLowerCase())) as any : null;

        // 5. Fuzzy Match Modules (Comma separated)
        const rawModulesStr = getValue('modules');
        const selectedModules = rawModulesStr ? String(rawModulesStr).split(',').map(m => {
            const match = context.modules.find(mod => 
                (mod as any).name.toLowerCase().includes(m.trim().toLowerCase()) || 
                (mod as any).abbreviation.toLowerCase() === m.trim().toLowerCase()
            );
            return match;
        }).filter(Boolean) as any[] : [];

        // 6. Resolve Focal Person → EntityContact (FER-01)
        const contactName = getValue('contactName');
        const contactEmail = getValue('contactEmail');
        const contactPhone = getValue('contactPhone');
        const contactRole = getValue('contactRole');
        const isSignatoryRaw = getValue('isSignatory');
        const isSignatory = String(isSignatoryRaw).toLowerCase() === 'yes' || isSignatoryRaw === 'true' || isSignatoryRaw === true;

        const entityContacts: EntityContact[] = [];
        if (contactName) {
            const typeLabel = String(contactRole || 'Administrator');
            const contactEmail = String(getValue('contactEmail') || '');
            const contactPhoneVal = String(getValue('contactPhone') || '');
            
            const ec: any = {
                id: `ec_bulk_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`,
                name: String(contactName),
                typeKey: normalizeContactType(typeLabel),
                typeLabel,
                isPrimary: true,
                isSignatory: isSignatory,
                order: 0,
                createdAt: new Date().toISOString(),
            };
            if (contactEmail) ec.email = contactEmail;
            if (contactPhoneVal) ec.phone = contactPhoneVal;
            
            entityContacts.push(ec as EntityContact);
        }

        // 7. Pipeline Initialization
        const stagesSnap = await adminDb.collection('onboardingStages').orderBy('order').limit(1).get();
        const defaultStage = !stagesSnap.empty 
            ? { id: stagesSnap.docs[0].id, ...stagesSnap.docs[0].data() } as OnboardingStage
            : { id: 'welcome', name: 'Welcome', order: 1, color: '#3B5FFF' };

        const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        // 8. Construct Entity Data
        const entityId = `entity_bulk_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
        const timestamp = new Date().toISOString();
        const organizationId = 'smartsapp-hq';
        const workspaceId = 'onboarding';

        // 8a. Save to Universal Identity Collection
        await adminDb.collection('entities').doc(entityId).set({
            id: entityId,
            organizationId,
            entityType: 'institution',
            name,
            slug,
            entityContacts, // Canonical (FER-01)
            globalTags: [],
            status: 'active',
            institutionData: {
                nominalRoll,
                billingAddress,
                currency,
                subscriptionPackageId: selectedPackage?.id || null,
                subscriptionRate: Number(getValue('subscriptionRate')) || selectedPackage?.ratePerStudent || 0,
            },
            createdAt: timestamp,
            updatedAt: timestamp,
        });

        const primaryContact = entityContacts.find(c => c.isPrimary);

        // 8b. Save to Operational Workspace Collection
        const workspaceEntityId = `${workspaceId}_${entityId}`;
        await adminDb.collection('workspace_entities').doc(workspaceEntityId).set({
            id: workspaceEntityId,
            organizationId,
            workspaceId,
            entityId,
            entityType: 'institution',
            pipelineId: '',
            stageId: defaultStage.id,
            currentStageName: defaultStage.name,
            status: 'active',
            assignedTo: selectedUser ? selectedUser.id : null,
            workspaceTags: [],
            addedAt: timestamp,
            updatedAt: timestamp,
            displayName: name,
            primaryContactName: primaryContact?.name || '',
            primaryEmail: primaryContact?.email || '',
            primaryPhone: primaryContact?.phone || '',
            entityContacts, // Denormalized for list performance
            interests: selectedModules.map(m => ({ id: m.id, name: m.name, abbreviation: m.abbreviation, color: m.color })),
        });

        await logActivity({
            entityId: entityId,
            entityType: 'institution',
            displayName: name,
            entitySlug: slug,
            organizationId,
            userId,
            workspaceId,
            type: 'entity_created',
            source: 'system',
            description: `Ingested entity record from "${filename}"`
        });

        revalidatePath('/admin/entities');
        revalidatePath('/admin/pipeline');
        
        return { success: true, id: entityId, entityName: name };

    } catch (error: any) {
        console.error(">>> [BULK:INGEST] Logical Error:", error.message);
        return { success: false, error: error.message };
    }
}
