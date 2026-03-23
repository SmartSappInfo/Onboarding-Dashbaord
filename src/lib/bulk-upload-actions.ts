'use server';

import { adminDb } from './firebase-admin';
import { logActivity } from './activity-logger';
import type { School, UserProfile, SubscriptionPackage, Zone, Module, OnboardingStage } from './types';
import { revalidatePath } from 'next/cache';

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

        // 6. Resolve Focal Person
        const contactName = getValue('contactName');
        const contactEmail = getValue('contactEmail');
        const contactPhone = getValue('contactPhone');
        const contactRole = getValue('contactRole');
        const isSignatoryRaw = getValue('isSignatory');
        const isSignatory = String(isSignatoryRaw).toLowerCase() === 'yes' || isSignatoryRaw === 'true' || isSignatoryRaw === true;

        const focalPersons = [];
        if (contactName) {
            focalPersons.push({
                name: String(contactName),
                email: String(contactEmail || ''),
                phone: String(contactPhone || ''),
                type: String(contactRole || 'Administrator'),
                isSignatory: isSignatory
            });
        }

        // 7. Pipeline Initialization
        const stagesSnap = await adminDb.collection('onboardingStages').orderBy('order').limit(1).get();
        const defaultStage = !stagesSnap.empty 
            ? { id: stagesSnap.docs[0].id, ...stagesSnap.docs[0].data() } as OnboardingStage
            : { id: 'welcome', name: 'Welcome', order: 1, color: '#3B5FFF' };

        const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        // 8. Construct Final Data Record
        const schoolData: Omit<School, 'id'> = {
            name,
            initials,
            slug,
            slogan,
            location,
            nominalRoll,
            status: 'Active',
            workspaceIds: ['onboarding'],
            schoolStatus: 'Lead',
            pipelineId: '',
            zone: selectedZone ? { id: selectedZone.id, name: selectedZone.name } : { id: 'unassigned', name: 'Unassigned' },
            assignedTo: selectedUser 
                ? { userId: selectedUser.id, name: selectedUser.name, email: selectedUser.email }
                : { userId: null, name: 'Unassigned', email: null },
            subscriptionPackageId: selectedPackage?.id || null,
            subscriptionPackageName: selectedPackage?.name || 'Standard',
            subscriptionRate: Number(getValue('subscriptionRate')) || selectedPackage?.ratePerStudent || 0,
            discountPercentage: Number(getValue('discountPercentage')) || 0,
            arrearsBalance: Number(getValue('arrearsBalance')) || 0,
            creditBalance: Number(getValue('creditBalance')) || 0,
            billingAddress,
            currency,
            focalPersons: focalPersons as any,
            modules: selectedModules.map(m => ({ id: m.id, name: m.name, abbreviation: m.abbreviation, color: m.color })),
            stage: { id: defaultStage.id, name: defaultStage.name, order: defaultStage.order, color: defaultStage.color },
            createdAt: new Date().toISOString(),
            implementationDate: getValue('implementationDate') ? new Date(String(getValue('implementationDate'))).toISOString() :'',
            referee: String(getValue('referee') || ''),
            includeDroneFootage: String(getValue('includeDroneFootage')).toLowerCase() === 'yes' || getValue('includeDroneFootage') === true,
        };

        const docRef = await adminDb.collection('schools').add(schoolData);

        await logActivity({
            schoolId: docRef.id,
            schoolName: schoolData.name,
            schoolSlug: schoolData.slug,
            userId,
            workspaceId: 'onboarding',
            type: 'school_created',
            source: 'system',
            description: `Ingested school record from "${filename}"`
        });

        revalidatePath('/admin/schools');
        revalidatePath('/admin/pipeline');
        
        return { success: true, id: docRef.id, schoolName: schoolData.name };

    } catch (error: any) {
        console.error(">>> [BULK:INGEST] Logical Error:", error.message);
        return { success: false, error: error.message };
    }
}
