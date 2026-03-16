
'use client';

import { collection, writeBatch, getDocs, doc, query, where, orderBy, limit, setDoc, deleteField } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
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
    FocalPerson, 
    Task, 
    TaskPriority, 
    TaskCategory, 
    TaskStatus, 
    SubscriptionPackage, 
    BillingPeriod, 
    BillingSettings, 
    Role, 
    AppPermissionId, 
    Pipeline, 
    Workspace, 
    WorkspaceStatus,
    Invoice,
    InvoiceItem,
    Automation,
    AutomationRun
} from '@/lib/types';
import { MEETING_TYPES } from '@/lib/types';
import { ONBOARDING_STAGE_COLORS } from './colors';
import { addDays, format, subDays, subHours, startOfMonth, endOfMonth } from 'date-fns';

// --- SEED DATA ---

const initialZones = [
  'Kasoa Zone',
  'Dansoman Zone',
  'Tema Zone',
  'Spintex/Lashibi/Teshie Zone',
  'Airport / Legon Zone',
  'North Legon/Adenta/Madina/Dodowa Zone',
  'Pokuase Zone',
  'External Zone (Other Regions)',
];

const DEFAULT_ONBOARDING_STATUSES: WorkspaceStatus[] = [
    { value: 'Onboarding', label: 'Onboarding', color: '#3B5FFF', description: 'Institutional initialization phase.' },
    { value: 'Active', label: 'Active', color: '#10b981', description: 'Institutional go-live.' },
    { value: 'Churned', label: 'Churned', color: '#ef4444', description: 'No longer operational.' },
];

const DEFAULT_PROSPECT_STATUSES: WorkspaceStatus[] = [
    { value: 'Lead', label: 'New Lead', color: '#f59e0b', description: 'Initial contact established.' },
    { value: 'Negotiation', label: 'Negotiation', color: '#8b5cf6', description: 'Contract discussions in progress.' },
    { value: 'Won', label: 'Won (Converted)', color: '#10b981', description: 'Successfully acquired campus.' },
    { value: 'Lost', label: 'Lost', color: '#64748b', description: 'Lead declined.' },
];

// --- SEEDING FUNCTIONS ---

export async function seedWorkspaces(firestore: Firestore): Promise<number> {
    const batch = writeBatch(firestore);
    const col = collection(firestore, 'workspaces');
    const timestamp = new Date().toISOString();

    const data: Workspace[] = [
        {
            id: 'onboarding',
            name: 'Institutional Onboarding',
            description: 'Primary technical implementation track for new campuses.',
            color: '#3B5FFF',
            status: 'active',
            statuses: DEFAULT_ONBOARDING_STATUSES,
            createdAt: timestamp,
            updatedAt: timestamp
        },
        {
            id: 'prospect',
            name: 'Lead Acquisition',
            description: 'Sales and marketing track for prospective institutions.',
            color: '#10b981',
            status: 'active',
            statuses: DEFAULT_PROSPECT_STATUSES,
            createdAt: timestamp,
            updatedAt: timestamp
        }
    ];

    data.forEach(w => batch.set(doc(col, w.id), w));
    await batch.commit();
    return data.length;
}

/**
 * MIGRATION PROTOCOL: School Workspace Enrichment
 * Upgraded to migrate legacy 'workspaceId' and 'track' fields to the new 'workspaceIds' array.
 */
export async function enrichAndRestoreSchools(firestore: Firestore): Promise<number> {
    const schoolsSnap = await getDocs(collection(firestore, 'schools'));
    const batch = writeBatch(firestore);
    const backupBatch = writeBatch(firestore);
    const timestamp = new Date().toISOString();
    
    // 1. Safety Snapshot
    schoolsSnap.forEach(docSnap => {
        const backupRef = doc(firestore, 'backup_schools_migration', docSnap.id);
        backupBatch.set(backupRef, docSnap.data());
    });
    await backupBatch.commit();

    let count = 0;
    // 2. Surgical Enrichment
    schoolsSnap.forEach(docSnap => {
        const data = docSnap.data();
        
        // Only enrich if array is missing or empty
        if (!data.workspaceIds || !Array.isArray(data.workspaceIds) || data.workspaceIds.length === 0) {
            const legacyId = data.workspaceId || data.track || 'onboarding';
            
            batch.update(docSnap.ref, {
                workspaceIds: [legacyId],
                updatedAt: timestamp,
                // Remove legacy fields to maintain schema purity
                workspaceId: deleteField(),
                track: deleteField()
            });
            count++;
        }
    });

    await batch.commit();
    return count;
}

export async function rollbackSchoolsMigration(firestore: Firestore): Promise<number> {
    const backupSnap = await getDocs(collection(firestore, 'backup_schools_migration'));
    const batch = writeBatch(firestore);
    let count = 0;
    backupSnap.forEach(docSnap => {
        const schoolRef = doc(firestore, 'schools', docSnap.id);
        batch.set(schoolRef, docSnap.data());
        count++;
    });
    await batch.commit();
    return count;
}

/**
 * MIGRATION PROTOCOL: School Status Enrichment
 */
export async function enrichSchoolStatuses(firestore: Firestore): Promise<number> {
    const schoolsSnap = await getDocs(collection(firestore, 'schools'));
    const batch = writeBatch(firestore);
    const backupBatch = writeBatch(firestore);
    const timestamp = new Date().toISOString();

    // Backup
    schoolsSnap.forEach(docSnap => {
        const backupRef = doc(firestore, 'backup_school_statuses', docSnap.id);
        backupBatch.set(backupRef, { schoolStatus: docSnap.data().schoolStatus });
    });
    await backupBatch.commit();

    let count = 0;
    schoolsSnap.forEach(docSnap => {
        const data = docSnap.data();
        const stageName = data.stage?.name?.toLowerCase() || '';
        let newStatus = data.schoolStatus || 'Onboarding';

        if (stageName.includes('live') || stageName.includes('completed')) {
            newStatus = 'Active';
        } else if (stageName.includes('churn') || stageName.includes('lost')) {
            newStatus = 'Churned';
        }

        if (newStatus !== data.schoolStatus) {
            batch.update(docSnap.ref, { 
                schoolStatus: newStatus,
                updatedAt: timestamp
            });
            count++;
        }
    });

    await batch.commit();
    return count;
}

export async function rollbackSchoolStatuses(firestore: Firestore): Promise<number> {
    const backupSnap = await getDocs(collection(firestore, 'backup_school_statuses'));
    const batch = writeBatch(firestore);
    let count = 0;
    backupSnap.forEach(docSnap => {
        const schoolRef = doc(firestore, 'schools', docSnap.id);
        batch.update(schoolRef, { schoolStatus: docSnap.data().schoolStatus });
        count++;
    });
    await batch.commit();
    return count;
}

/**
 * MIGRATION PROTOCOL: Task Workspace Enrichment
 */
export async function enrichTasksWithWorkspace(firestore: Firestore): Promise<number> {
    const tasksSnap = await getDocs(collection(firestore, 'tasks'));
    const batch = writeBatch(firestore);
    const backupBatch = writeBatch(firestore);
    const timestamp = new Date().toISOString();

    tasksSnap.forEach(docSnap => {
        const backupRef = doc(firestore, 'backup_tasks_migration', docSnap.id);
        backupBatch.set(backupRef, docSnap.data());
    });
    await backupBatch.commit();

    let count = 0;
    tasksSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.workspaceId) {
            batch.update(docSnap.ref, { 
                workspaceId: data.track || 'onboarding',
                updatedAt: timestamp
            });
            count++;
        }
    });

    await batch.commit();
    return count;
}

export async function rollbackTasksMigration(firestore: Firestore): Promise<number> {
    const backupSnap = await getDocs(collection(firestore, 'backup_tasks_migration'));
    const batch = writeBatch(firestore);
    let count = 0;
    backupSnap.forEach(docSnap => {
        const taskRef = doc(firestore, 'tasks', docSnap.id);
        batch.set(taskRef, docSnap.data());
        count++;
    });
    await batch.commit();
    return count;
}

/**
 * MIGRATION PROTOCOL: Automation Workspace Enrichment
 */
export async function enrichAutomationsWithWorkspace(firestore: Firestore): Promise<number> {
    const snap = await getDocs(collection(firestore, 'automations'));
    const batch = writeBatch(firestore);
    const timestamp = new Date().toISOString();

    let count = 0;
    snap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.workspaceId) {
            batch.update(docSnap.ref, { 
                workspaceId: data.track || 'onboarding',
                updatedAt: timestamp
            });
            count++;
        }
    });

    await batch.commit();
    return count;
}

export async function rollbackAutomationsMigration(firestore: Firestore): Promise<number> {
    const snap = await getDocs(collection(firestore, 'automations'));
    const batch = writeBatch(firestore);
    snap.forEach(docSnap => {
        batch.update(docSnap.ref, { workspaceId: 'onboarding' });
    });
    await batch.commit();
    return snap.size;
}

/**
 * MIGRATION PROTOCOL: Media Workspace Enrichment
 */
export async function enrichMediaWithWorkspace(firestore: Firestore): Promise<number> {
    const snap = await getDocs(collection(firestore, 'media'));
    const batch = writeBatch(firestore);
    const timestamp = new Date().toISOString();

    let count = 0;
    snap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.workspaceIds || data.workspaceIds.length === 0) {
            const wId = data.workspaceId || 'onboarding';
            batch.update(docSnap.ref, { 
                workspaceIds: [wId],
                updatedAt: timestamp,
                workspaceId: deleteField()
            });
            count++;
        }
    });

    await batch.commit();
    return count;
}

export async function rollbackMediaMigration(firestore: Firestore): Promise<number> {
    const snap = await getDocs(collection(firestore, 'media'));
    const batch = writeBatch(firestore);
    snap.forEach(docSnap => {
        batch.update(docSnap.ref, { workspaceIds: ['onboarding'] });
    });
    await batch.commit();
    return snap.size;
}

/**
 * MIGRATION PROTOCOL: Role Workspace Enrichment
 */
export async function enrichRolesWithWorkspaces(firestore: Firestore): Promise<number> {
    const snap = await getDocs(collection(firestore, 'roles'));
    const batch = writeBatch(firestore);
    const backupBatch = writeBatch(firestore);
    const timestamp = new Date().toISOString();

    snap.forEach(docSnap => {
        const backupRef = doc(firestore, 'backup_roles_migration', docSnap.id);
        backupBatch.set(backupRef, docSnap.data());
    });
    await backupBatch.commit();

    let count = 0;
    snap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.workspaceIds || data.workspaceIds.length === 0) {
            batch.update(docSnap.ref, { 
                workspaceIds: ['onboarding', 'prospect'],
                updatedAt: timestamp
            });
            count++;
        }
    });

    await batch.commit();
    return count;
}

export async function rollbackRolesMigration(firestore: Firestore): Promise<number> {
    const backupSnap = await getDocs(collection(firestore, 'backup_roles_migration'));
    const batch = writeBatch(firestore);
    let count = 0;
    backupSnap.forEach(docSnap => {
        const ref = doc(firestore, 'roles', docSnap.id);
        batch.set(ref, docSnap.data());
        count++;
    });
    await batch.commit();
    return count;
}

/**
 * MIGRATION PROTOCOL: Activity Workspace Enrichment
 */
export async function enrichActivitiesWithWorkspace(firestore: Firestore): Promise<number> {
    const snap = await getDocs(collection(firestore, 'activities'));
    const batch = writeBatch(firestore);
    const backupBatch = writeBatch(firestore);
    const timestamp = new Date().toISOString();

    snap.forEach(docSnap => {
        const backupRef = doc(firestore, 'backup_activities_migration', docSnap.id);
        backupBatch.set(backupRef, docSnap.data());
    });
    await backupBatch.commit();

    let count = 0;
    for (const docSnap of snap.docs) {
        const data = docSnap.data();
        if (!data.workspaceId) {
            let wId = 'onboarding';
            if (data.schoolId) {
                const schoolSnap = await getDocs(query(collection(firestore, 'schools'), where('id', '==', data.schoolId), limit(1)));
                if (!schoolSnap.empty) {
                    const schoolData = schoolSnap.docs[0].data();
                    wId = schoolData.workspaceIds?.[0] || schoolData.track || 'onboarding';
                }
            }
            batch.update(docSnap.ref, { 
                workspaceId: wId,
                updatedAt: timestamp
            });
            count++;
        }
    }

    await batch.commit();
    return count;
}

export async function rollbackActivitiesMigration(firestore: Firestore): Promise<number> {
    const backupSnap = await getDocs(collection(firestore, 'backup_activities_migration'));
    const batch = writeBatch(firestore);
    let count = 0;
    backupSnap.forEach(docSnap => {
        const ref = doc(firestore, 'activities', docSnap.id);
        batch.set(ref, docSnap.data());
        count++;
    });
    await batch.commit();
    return count;
}

export async function seedSchools(firestore: Firestore): Promise<number> {
    const schoolsCollection = collection(firestore, 'schools');
    const batch = writeBatch(firestore);
    const timestamp = new Date().toISOString();

    const baseSchoolData = [
        { name: 'Ghana International School', initials: 'GIS', nominalRoll: 1500, location: 'Accra' },
        { name: 'Lincoln Community School', initials: 'LCS', nominalRoll: 800, location: 'Accra' },
        { name: 'Ridge Church School', initials: 'RCS', nominalRoll: 1200, location: 'Accra' },
        { name: 'Morning Star School', initials: 'MSS', nominalRoll: 950, location: 'Accra' },
    ];

    baseSchoolData.forEach((data, index) => {
        const docRef = doc(schoolsCollection);
        const wId = index % 2 === 0 ? 'onboarding' : 'prospect';
        const pId = wId === 'prospect' ? 'sales_acquisition' : 'institutional_onboarding';
        const stage = wId === 'prospect' 
            ? { id: 'stage_prospect_discovery', name: 'Discovery', order: 1, color: '#4cc9f0' }
            : { id: 'stage_onboarding_welcome', name: 'Welcome', order: 1, color: '#f72585' };

        batch.set(docRef, {
            ...data,
            slug: data.name.toLowerCase().replace(/\s+/g, '-'),
            workspaceIds: [wId],
            status: 'Active',
            schoolStatus: wId === 'prospect' ? 'Lead' : 'Onboarding',
            pipelineId: pId,
            stage,
            currency: 'GHS',
            createdAt: timestamp,
            updatedAt: timestamp,
            focalPersons: [{ name: 'Admin', email: 'admin@school.edu', phone: '0000000000', type: 'Principal', isSignatory: true }]
        });
    });
    
    await batch.commit();
    return baseSchoolData.length;
}

export async function seedMedia(firestore: Firestore): Promise<number> {
    const batch = writeBatch(firestore);
    const col = collection(firestore, 'media');
    const timestamp = new Date().toISOString();

    const sampleMedia: Omit<MediaAsset, 'id'>[] = [
        {
            name: 'Campus Main Entrance',
            type: 'image',
            url: 'https://picsum.photos/seed/1/1200/800',
            workspaceIds: ['onboarding'],
            uploadedBy: 'system',
            createdAt: timestamp,
            mimeType: 'image/jpeg',
            size: 1024 * 500
        },
        {
            name: 'Institutional Brochure 2026',
            type: 'document',
            url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            workspaceIds: ['onboarding', 'prospect'],
            uploadedBy: 'system',
            createdAt: timestamp,
            mimeType: 'application/pdf',
            size: 1024 * 1500
        },
        {
            name: 'Parent Onboarding Video',
            type: 'video',
            url: 'https://www.youtube.com/watch?v=M6MUlDkfZOg',
            workspaceIds: ['onboarding'],
            uploadedBy: 'system',
            createdAt: timestamp
        },
        {
            name: 'Prospect Welcome Kit',
            type: 'document',
            url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            workspaceIds: ['prospect'],
            uploadedBy: 'system',
            createdAt: timestamp,
            mimeType: 'application/pdf',
            size: 1024 * 800
        }
    ];

    sampleMedia.forEach(m => batch.set(doc(col), m));
    await batch.commit();
    return sampleMedia.length;
}

export async function seedActivities(firestore: Firestore): Promise<number> {
    const schoolsSnap = await getDocs(collection(firestore, 'schools'));
    if (schoolsSnap.empty) return 0;

    const batch = writeBatch(firestore);
    const col = collection(firestore, 'activities');
    const timestamp = new Date().toISOString();

    let count = 0;
    schoolsSnap.docs.forEach((schoolDoc, idx) => {
        const school = schoolDoc.data();
        const activityRef = doc(col);
        batch.set(activityRef, {
            schoolId: schoolDoc.id,
            schoolName: school.name,
            schoolSlug: school.slug,
            workspaceId: school.workspaceIds?.[0] || 'onboarding',
            type: idx % 2 === 0 ? 'school_created' : 'pipeline_stage_changed',
            source: 'system',
            timestamp: subHours(new Date(timestamp), idx).toISOString(),
            description: idx % 2 === 0 ? 'initialized institutional hub' : 'advanced to next workflow phase'
        });
        count++;
    });

    await batch.commit();
    return count;
}

export async function seedMeetings(firestore: Firestore): Promise<number> { return 0; }
export async function seedSurveys(firestore: Firestore): Promise<number> { return 0; }
export async function seedUserAvatars(firestore: Firestore): Promise<number> { return 0; }
export async function seedOnboardingStages(firestore: Firestore) { return { stagesCreated: 0, schoolsUpdated: 0 }; }
export async function seedModules(firestore: Firestore): Promise<number> { return 0; }
export async function seedZones(firestore: Firestore): Promise<number> { return 0; }
export async function seedPdfForms(firestore: Firestore) { return 0; }
export async function seedMessaging(firestore: Firestore) { return 0; }
export async function seedMessageLogs(firestore: Firestore) { return 0; }
export async function seedTasks(firestore: Firestore) { return 0; }
export async function seedBillingData(firestore: Firestore) { return 0; }
export async function seedRolesAndPermissions(firestore: Firestore) { return 0; }
export async function seedPipelines(firestore: Firestore) { return 0; }
export async function seedOnboardingPipelineFromCurrentData(firestore: Firestore) { return 0; }
