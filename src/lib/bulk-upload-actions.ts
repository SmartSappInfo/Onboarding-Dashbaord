
'use server';

import { adminDb } from './firebase-admin';
import { normalizeBulkRow } from '@/ai/flows/bulk-normalization-flow';
import { logActivity } from './activity-logger';
import type { School, UserProfile, SubscriptionPackage, Zone, Module, OnboardingStage } from './types';
import { revalidatePath } from 'next/cache';

/**
 * @fileOverview Server-side actions for the AI Bulk Institutional Ingestion Engine.
 */

/**
 * Fetches all necessary system context for the AI Normalization engine.
 */
async function getNormalizationContext() {
    const [zonesSnap, usersSnap, packagesSnap, modulesSnap] = await Promise.all([
        adminDb.collection('zones').orderBy('name').get(),
        adminDb.collection('users').where('isAuthorized', '==', true).get(),
        adminDb.collection('subscription_packages').where('isActive', '==', true).get(),
        adminDb.collection('modules').orderBy('order').get(),
    ]);

    return {
        zones: zonesSnap.docs.map(d => ({ id: d.id, name: d.data().name })),
        users: usersSnap.docs.map(d => ({ id: d.id, name: d.data().name })),
        packages: packagesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        modules: modulesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    };
}

/**
 * Processes a single row from an uploaded document using AI normalization.
 * Performs fuzzy matching and creates the school record.
 */
export async function ingestSchoolRowAction(
    rawData: any, 
    mapping: Record<string, string>, 
    userId: string,
    filename: string
) {
    try {
        const context = await getNormalizationContext();
        
        // 1. AI Normalization
        const { normalizedSchool, explanation } = await normalizeBulkRow({
            rawData,
            mapping,
            context: context as any
        });

        // 2. Hydrate IDs back to full objects for the School record
        const selectedZone = context.zones.find(z => z.id === normalizedSchool.zoneId);
        const selectedUser = context.users.find(u => u.id === normalizedSchool.assignedToId);
        const selectedPackage = context.packages.find(p => p.id === normalizedSchool.subscriptionPackageId) as any;
        
        const selectedModules = (normalizedSchool.moduleIds || [])
            .map(id => context.modules.find(m => m.id === id))
            .filter(Boolean) as any[];

        // 3. Resolve Default Stage (Welcome)
        const stagesSnap = await adminDb.collection('onboardingStages').orderBy('order').limit(1).get();
        const defaultStage = !stagesSnap.empty 
            ? { id: stagesSnap.docs[0].id, ...stagesSnap.docs[0].data() } as OnboardingStage
            : { id: 'welcome', name: 'Welcome', order: 1, color: '#3B5FFF' };

        // 4. Construct Final Document
        const slug = normalizedSchool.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        const finalSchoolData: Omit<School, 'id'> = {
            name: normalizedSchool.name,
            initials: normalizedSchool.initials || normalizedSchool.name.substring(0, 3).toUpperCase(),
            slug,
            slogan: normalizedSchool.slogan || '',
            location: normalizedSchool.location || '',
            nominalRoll: normalizedSchool.nominalRoll || 0,
            status: 'Active',
            zone: selectedZone ? { id: selectedZone.id, name: selectedZone.name } : { id: 'unassigned', name: 'Unassigned' },
            assignedTo: selectedUser 
                ? { userId: selectedUser.id, name: selectedUser.name, email: (selectedUser as any).email }
                : { userId: null, name: 'Unassigned', email: null },
            subscriptionPackageId: normalizedSchool.subscriptionPackageId || null,
            subscriptionPackageName: selectedPackage ? selectedPackage.name : 'Standard',
            subscriptionRate: normalizedSchool.subscriptionRate || selectedPackage?.ratePerStudent || 0,
            focalPersons: normalizedSchool.focalPersons as any,
            modules: selectedModules.map(m => ({ id: m.id, name: m.name, abbreviation: m.abbreviation, color: m.color })),
            stage: { id: defaultStage.id, name: defaultStage.name, order: defaultStage.order, color: defaultStage.color },
            createdAt: new Date().toISOString(),
            implementationDate: normalizedSchool.implementationDate || null,
            arrearsBalance: 0,
            creditBalance: 0,
            currency: 'GHS',
        };

        const docRef = await adminDb.collection('schools').add(finalSchoolData);

        // 5. Log Activity
        await logActivity({
            schoolId: docRef.id,
            schoolName: finalSchoolData.name,
            schoolSlug: finalSchoolData.slug,
            userId,
            type: 'school_created',
            source: 'system',
            description: `AI Bulk Ingest: Created record from "${filename}"`,
            metadata: { aiExplanation: explanation }
        });

        revalidatePath('/admin/schools');
        revalidatePath('/admin/pipeline');
        
        return { success: true, id: docRef.id, schoolName: finalSchoolData.name };

    } catch (error: any) {
        console.error(">>> [BULK:INGEST] Error:", error.message);
        return { success: false, error: error.message };
    }
}
