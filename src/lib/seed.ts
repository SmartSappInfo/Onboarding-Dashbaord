
'use client';

import { 
    collection, 
    writeBatch, 
    getDocs, 
    doc, 
    query, 
    where, 
    orderBy, 
    limit, 
    setDoc, 
    deleteField, 
    addDoc,
    getDoc,
    type Firestore 
} from 'firebase/firestore';
import type { 
    School, 
    Meeting, 
    MediaAsset, 
    Survey, 
    UserProfile, 
    OnboardingStage, 
    Module, 
    Activity, 
    PDFForm, 
    SenderProfile, 
    MessageStyle, 
    MessageTemplate, 
    MessageLog, 
    Zone, 
    Task, 
    SubscriptionPackage, 
    BillingPeriod, 
    Role, 
    Pipeline, 
    Workspace, 
    Invoice,
    Automation,
    BillingProfile
} from '@/lib/types';

const DEFAULT_ORG_ID = 'smartsapp-hq';

/**
 * PORTAL SEEDING: Multi-Tenant Blueprints
 * Generates sample surveys and PDF forms shared across default workspaces.
 */
export async function seedPortals(firestore: Firestore): Promise<number> {
    const batch = writeBatch(firestore);
    const timestamp = new Date().toISOString();
    let count = 0;

    // 1. Create Sample Survey
    const surveyRef = doc(collection(firestore, 'surveys'));
    batch.set(surveyRef, {
        id: surveyRef.id,
        title: 'Institutional Satisfaction Audit',
        internalName: 'Parent Satisfaction Audit (2024)',
        description: 'Help us improve the SmartSapp experience for your family.',
        slug: 'parent-audit',
        status: 'published',
        workspaceIds: ['onboarding', 'prospect'],
        organizationId: DEFAULT_ORG_ID,
        elements: [
            { id: 'q1', type: 'rating', title: 'Overall Campus Satisfaction', isRequired: true },
            { id: 'q2', type: 'long-text', title: 'Key Functional Feedback', isRequired: false }
        ],
        createdAt: timestamp,
        updatedAt: timestamp
    });
    count++;

    // 2. Create Sample PDF Form
    const pdfRef = doc(collection(firestore, 'pdfs'));
    batch.set(pdfRef, {
        id: pdfRef.id,
        name: 'Institutional Enrollment Agreement',
        publicTitle: 'Standard Enrollment Agreement',
        slug: 'enrollment-agreement',
        storagePath: 'pdfs/sample.pdf',
        downloadUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.appspot.com/o/media%2Fdocument%2F1768935712710-sample.pdf?alt=media',
        status: 'published',
        workspaceIds: ['onboarding'],
        organizationId: DEFAULT_ORG_ID,
        fields: [
            { id: 'f1', label: 'School Name', type: 'text', pageNumber: 1, position: { x: 10, y: 10 }, dimensions: { width: 30, height: 5 }, required: true }
        ],
        createdAt: timestamp,
        updatedAt: timestamp
    });
    count++;

    await batch.commit();
    return count;
}

/**
 * PORTAL RESTORATION: Deep Context Sync
 * Fetches all Surveys and PDFs, resolves their associated school's workspaces, 
 * and repositions them in the correct hub tracks.
 */
export async function enrichAndRestorePortals(firestore: Firestore): Promise<number> {
    const batch = writeBatch(firestore);
    let count = 0;
    const collections = ['surveys', 'pdfs'];

    for (const colName of collections) {
        const snap = await getDocs(collection(firestore, colName));
        for (const docSnap of snap.docs) {
            const data = docSnap.data();
            const updates: any = {
                organizationId: DEFAULT_ORG_ID,
                updatedAt: new Date().toISOString()
            };

            // Logic: If school-bound, inherit its workspace track(s)
            if (data.schoolId) {
                const schoolSnap = await getDoc(doc(firestore, 'schools', data.schoolId));
                if (schoolSnap.exists()) {
                    const schoolData = schoolSnap.data();
                    updates.workspaceIds = schoolData.workspaceIds || ['onboarding'];
                }
            }

            // Migration: Convert single ID to array if necessary and not already resolved
            if (!updates.workspaceIds) {
                if (data.workspaceId && !data.workspaceIds) {
                    updates.workspaceIds = [data.workspaceId];
                } else if (!data.workspaceIds) {
                    updates.workspaceIds = ['onboarding'];
                }
            }

            batch.update(docSnap.ref, updates);
            count++;
        }
    }

    await batch.commit();
    return count;
}

/**
 * ENRICHMENT PROTOCOL: Universal Shared Arrays
 * Scans all primary operational collections and migrates legacy data to the multi-tenant architecture.
 */
export async function enrichOperationalData(firestore: Firestore): Promise<number> {
    const batch = writeBatch(firestore);
    let count = 0;

    const collections = [
        'schools', 'meetings', 'surveys', 'pdfs', 'contracts',
        'message_templates', 'sender_profiles', 'message_styles',
        'pipelines', 'subscription_packages', 'billing_periods', 'invoices', 'automations', 'media'
    ];

    for (const colName of collections) {
        const snap = await getDocs(collection(firestore, colName));
        
        for (const docSnap of snap.docs) {
            const data = docSnap.data();
            
            // 1. Create Backup Snapshot
            const backupRef = doc(firestore, `backup_phase2_${colName}`, docSnap.id);
            batch.set(backupRef, { ...data, backedUpAt: new Date().toISOString() });

            // 2. Apply Enrichment
            const updates: any = {
                organizationId: DEFAULT_ORG_ID,
                updatedAt: new Date().toISOString()
            };

            // Migrate single ID to array if necessary
            if (data.workspaceId && !data.workspaceIds) {
                updates.workspaceIds = [data.workspaceId];
                updates.workspaceId = deleteField();
            } else if (!data.workspaceIds) {
                updates.workspaceIds = ['onboarding']; // Global default track
            }

            batch.update(docSnap.ref, updates);
            count++;
        }
    }

    await batch.commit();
    return count;
}

/**
 * RESTORATION PROTOCOL: Institutional Blueprint Recovery
 * Rebuilds missing Pipeline/Stage blueprints using snapshots from school metadata.
 */
export async function syncOperationalArchitecture(firestore: Firestore): Promise<number> {
    const schoolsSnap = await getDocs(collection(firestore, 'schools'));
    const batch = writeBatch(firestore);
    const timestamp = new Date().toISOString();
    let count = 0;

    const pipelinesToCreate = new Map<string, any>();
    const stagesToCreate = new Map<string, any>();

    schoolsSnap.forEach(docSnap => {
        const school = docSnap.data() as School;
        if (school.pipelineId && school.stage) {
            if (!pipelinesToCreate.has(school.pipelineId)) {
                pipelinesToCreate.set(school.pipelineId, {
                    name: 'Restored Institutional Pipeline',
                    organizationId: DEFAULT_ORG_ID,
                    workspaceIds: school.workspaceIds || ['onboarding'],
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    isDefault: false
                });
            }
            
            const stageKey = `${school.pipelineId}_${school.stage.id}`;
            if (!stagesToCreate.has(stageKey)) {
                stagesToCreate.set(stageKey, {
                    ...school.stage,
                    pipelineId: school.pipelineId,
                    createdAt: timestamp
                });
            }
        }
    });

    for (const [id, data] of Array.from(pipelinesToCreate.entries())) {
        batch.set(doc(firestore, 'pipelines', id), data, { merge: true });
        count++;
    }

    for (const [key, data] of Array.from(stagesToCreate.entries())) {
        const [_, sId] = key.split('_');
        batch.set(doc(firestore, 'onboardingStages', sId), data, { merge: true });
        count++;
    }

    await batch.commit();
    return count;
}

/**
 * IDENTITY ENRICHMENT: User Sovereignty
 */
export async function enrichUsers(firestore: Firestore): Promise<number> {
    const snap = await getDocs(collection(firestore, 'users'));
    const batch = writeBatch(firestore);
    let count = 0;

    snap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.organizationId || !data.workspaceIds) {
            batch.update(docSnap.ref, { 
                organizationId: DEFAULT_ORG_ID,
                workspaceIds: data.workspaceIds || ['onboarding', 'prospect'],
                updatedAt: new Date().toISOString()
            });
            count++;
        }
    });

    await batch.commit();
    return count;
}

/**
 * CONFINED ENRICHMENT: CRM & Audit Trails
 */
export async function enrichTasksWithWorkspace(firestore: Firestore): Promise<number> {
    const snap = await getDocs(collection(firestore, 'tasks'));
    const batch = writeBatch(firestore);
    let count = 0;

    snap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.workspaceId || !data.organizationId) {
            batch.update(docSnap.ref, { 
                workspaceId: data.workspaceId || 'onboarding',
                organizationId: DEFAULT_ORG_ID
            });
            count++;
        }
    });

    await batch.commit();
    return count;
}

export async function enrichActivitiesWithWorkspace(firestore: Firestore): Promise<number> {
    const snap = await getDocs(collection(firestore, 'activities'));
    const batch = writeBatch(firestore);
    let count = 0;

    snap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.workspaceId) {
            batch.update(docSnap.ref, { 
                workspaceId: data.workspaceId || 'onboarding'
            });
            count++;
        }
    });

    await batch.commit();
    return count;
}

/**
 * GOVERNANCE ENRICHMENT: Roles & Access Control
 */
export async function enrichRolesWithWorkspaces(firestore: Firestore): Promise<number> {
    const snap = await getDocs(collection(firestore, 'roles'));
    const batch = writeBatch(firestore);
    let count = 0;

    snap.forEach(docSnap => {
        const data = docSnap.data();
        batch.update(docSnap.ref, { 
            organizationId: DEFAULT_ORG_ID,
            workspaceIds: data.workspaceIds || ['onboarding', 'prospect'],
            updatedAt: new Date().toISOString()
        });
        count++;
    });

    await batch.commit();
    return count;
}

/**
 * SEEDERS: Infrastructure Framework
 */
export async function seedWorkspaces(firestore: Firestore): Promise<number> {
    const workspaces: Partial<Workspace>[] = [
        {
            id: 'onboarding',
            organizationId: DEFAULT_ORG_ID,
            name: 'Client Onboarding',
            description: 'Implementation and school initialization track.',
            color: '#3B5FFF',
            status: 'active',
            statuses: [
                { value: 'Onboarding', label: 'Onboarding', color: '#3B5FFF' },
                { value: 'Active', label: 'Active', color: '#10b981' },
                { value: 'Churned', label: 'Churned', color: '#ef4444' }
            ]
        },
        {
            id: 'prospect',
            organizationId: DEFAULT_ORG_ID,
            name: 'Sales Leads',
            description: 'Discovery and acquisition track.',
            color: '#10b981',
            status: 'active',
            statuses: [
                { value: 'Lead', label: 'Inbound Lead', color: '#3B5FFF' },
                { value: 'Lost', label: 'Lost Lead', color: '#ef4444' }
            ]
        }
    ];

    for (const w of workspaces) {
        await setDoc(doc(firestore, 'workspaces', w.id!), {
            ...w,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }
    return workspaces.length;
}

export async function seedBillingData(firestore: Firestore): Promise<number> {
    const batch = writeBatch(firestore);
    const timestamp = new Date().toISOString();

    const profileRef = doc(collection(firestore, 'billing_profiles'));
    batch.set(profileRef, {
        id: profileRef.id,
        organizationId: DEFAULT_ORG_ID,
        name: 'Standard SmartSapp HQ',
        levyPercent: 5,
        vatPercent: 15,
        defaultDiscount: 0,
        paymentInstructions: 'Kindly remit payments to SmartSapp HQ Account.',
        signatureName: 'Director of Finance',
        signatureDesignation: 'SmartSapp Corporate',
        workspaceIds: ['onboarding', 'prospect'],
        createdAt: timestamp,
        updatedAt: timestamp
    } as BillingProfile);

    await batch.commit();
    return 1;
}

/**
 * ROLLBACK HANDLERS: Safety Recovery Protocols
 */
async function performRollback(firestore: Firestore, colName: string): Promise<number> {
    const backupCol = `backup_phase2_${colName}`;
    const snap = await getDocs(collection(firestore, backupCol));
    const batch = writeBatch(firestore);
    let count = 0;

    snap.forEach(docSnap => {
        const { backedUpAt, ...originalData } = docSnap.data() as any;
        batch.set(doc(firestore, colName, docSnap.id), originalData);
        count++;
    });

    await batch.commit();
    return count;
}

export async function rollbackSchoolsMigration(firestore: Firestore) { return performRollback(firestore, 'schools'); }
export async function rollbackTasksMigration(firestore: Firestore) { return performRollback(firestore, 'tasks'); }
export async function rollbackActivitiesMigration(firestore: Firestore) { return performRollback(firestore, 'activities'); }

// Stubs for remaining exports to maintain build compatibility
export async function seedMedia(f: Firestore) { return 0; }
export async function seedSchools(f: Firestore) { return 0; }
export async function seedMeetings(f: Firestore) { return 0; }
export async function seedSurveys(f: Firestore) { return 0; }
export async function seedUserAvatars(f: Firestore) { return 0; }
export async function seedOnboardingStages(f: Firestore) { return 0; }
export async function seedModules(f: Firestore) { return 0; }
export async function seedZones(f: Firestore) { return 0; }
export async function seedMessageLogs(f: Firestore) { return 0; }
export async function seedTasks(f: Firestore) { return 0; }
export async function seedRolesAndPermissions(f: Firestore) { return 0; }
export async function seedPipelines(f: Firestore) { return 0; }
export async function seedOnboardingPipelineFromCurrentData(f: Firestore) { return 0; }
export async function enrichAndRestoreSchools(f: Firestore) { return 0; }
export async function rollbackAutomationsMigration(f: Firestore) { return 0; }
export async function enrichAutomationsWithWorkspace(f: Firestore) { return 0; }
export async function enrichMediaWithWorkspace(f: Firestore) { return 0; }
export async function rollbackMediaMigration(f: Firestore) { return 0; }
export async function rollbackRolesMigration(f: Firestore) { return 0; }
