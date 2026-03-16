
'use client';

import { collection, writeBatch, getDocs, doc, query, where, orderBy, limit, setDoc } from 'firebase/firestore';
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
    Automation
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
 * Upgraded to use workspaceIds array.
 */
export async function enrichSchoolsWithWorkspaces(firestore: Firestore): Promise<number> {
    const schoolsSnap = await getDocs(collection(firestore, 'schools'));
    const batch = writeBatch(firestore);
    const backupBatch = writeBatch(firestore);
    const timestamp = new Date().toISOString();
    
    // Safety Snapshot
    schoolsSnap.forEach(docSnap => {
        const backupRef = doc(firestore, 'backup_schools_migration', docSnap.id);
        backupBatch.set(backupRef, docSnap.data());
    });
    await backupBatch.commit();

    let count = 0;
    schoolsSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.workspaceIds || data.workspaceIds.length === 0) {
            // Support legacy single workspaceId (or track) or default to onboarding
            const wId = data.workspaceId || data.track || 'onboarding';
            batch.update(docSnap.ref, {
                workspaceIds: [wId],
                updatedAt: timestamp
            });
            // Cleanup legacy fields
            batch.update(docSnap.ref, { workspaceId: null });
            count++;
        }
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
            track: wId,
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

export async function seedMeetings(firestore: Firestore): Promise<number> { return 0; }
export async function seedSurveys(firestore: Firestore): Promise<number> { return 0; }
export async function seedUserAvatars(firestore: Firestore): Promise<number> { return 0; }
export async function seedOnboardingStages(firestore: Firestore) { return { stagesCreated: 0, schoolsUpdated: 0 }; }
export async function seedModules(firestore: Firestore): Promise<number> { return 0; }
export async function seedZones(firestore: Firestore): Promise<number> { return 0; }
export async function seedActivities(firestore: Firestore): Promise<number> { return 0; }
export async function seedPdfForms(firestore: Firestore) { return 0; }
export async function seedMessaging(firestore: Firestore) { return 0; }
export async function seedMessageLogs(firestore: Firestore) { return 0; }
export async function seedTasks(firestore: Firestore) { return 0; }
export async function seedBillingData(firestore: Firestore) { return 0; }
export async function seedRolesAndPermissions(firestore: Firestore) { return 0; }
export async function seedPipelines(firestore: Firestore) { return 0; }
export async function seedOnboardingPipelineFromCurrentData(firestore: Firestore) { return 0; }
export async function enrichAndRestoreSchools(firestore: Firestore) { return 0; }
export async function rollbackSchoolsMigration(firestore: Firestore) { return 0; }
export async function enrichTasksWithWorkspace(firestore: Firestore) { return 0; }
export async function rollbackTasksMigration(firestore: Firestore) { return 0; }
export async function enrichAutomationsWithWorkspace(firestore: Firestore) { return 0; }
export async function rollbackAutomationsMigration(firestore: Firestore) { return 0; }
export async function enrichMediaWithWorkspace(firestore: Firestore) { return 0; }
export async function rollbackMediaMigration(firestore: Firestore) { return 0; }
export async function enrichRolesWithWorkspaces(firestore: Firestore) { return 0; }
export async function rollbackRolesMigration(firestore: Firestore) { return 0; }
export async function enrichActivitiesWithWorkspace(firestore: Firestore) { return 0; }
export async function rollbackActivitiesMigration(firestore: Firestore) { return 0; }
