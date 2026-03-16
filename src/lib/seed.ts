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
    WorkspaceStatus 
} from '@/lib/types';
import { MEETING_TYPES } from '@/lib/types';
import { ONBOARDING_STAGE_COLORS } from './colors';
import { addDays, format, subDays, subHours } from 'date-fns';

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
    { value: 'Active', label: 'Active', color: '#10b981', description: 'Campus is fully deployed.' },
    { value: 'Churned', label: 'Churned', color: '#ef4444', description: 'No longer using the platform.' },
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
 * MIGRATION PROTOCOL: Task Enrichment
 * Ensures all existing tasks carry the 'onboarding' workspace ID.
 */
export async function enrichTasksWithWorkspace(firestore: Firestore): Promise<number> {
    const tasksSnap = await getDocs(collection(firestore, 'tasks'));
    const batch = writeBatch(firestore);
    const backupBatch = writeBatch(firestore);
    const timestamp = new Date().toISOString();
    
    // 1. Safety Backup
    tasksSnap.forEach(docSnap => {
        const backupRef = doc(firestore, 'backup_tasks_migration', docSnap.id);
        backupBatch.set(backupRef, docSnap.data());
    });
    await backupBatch.commit();

    // 2. Resolve enrichment logic
    let count = 0;
    tasksSnap.forEach(docSnap => {
        const data = docSnap.data();
        // If it doesn't have a workspaceId, set it to onboarding
        if (!data.workspaceId) {
            batch.update(docSnap.ref, {
                workspaceId: 'onboarding',
                updatedAt: timestamp
            });
            count++;
        }
    });

    await batch.commit();
    return count;
}

/**
 * MIGRATION PROTOCOL: Tasks Rollback
 */
export async function rollbackTasksMigration(firestore: Firestore): Promise<number> {
    const backupSnap = await getDocs(collection(firestore, 'backup_tasks_migration'));
    const batch = writeBatch(firestore);
    
    let count = 0;
    backupSnap.forEach(docSnap => {
        const originalRef = doc(firestore, 'tasks', docSnap.id);
        batch.set(originalRef, docSnap.data());
        count++;
    });

    await batch.commit();
    return count;
}

/**
 * MIGRATION PROTOCOL: School Status Enrichment
 * Sets schools in "Support" stage to "Active", the rest to "Onboarding".
 */
export async function enrichSchoolStatuses(firestore: Firestore): Promise<number> {
    const schoolsSnap = await getDocs(collection(firestore, 'schools'));
    const batch = writeBatch(firestore);
    const backupBatch = writeBatch(firestore);
    
    // 1. Safety Backup
    schoolsSnap.forEach(docSnap => {
        const backupRef = doc(firestore, 'backup_schools_status', docSnap.id);
        backupBatch.set(backupRef, docSnap.data());
    });
    await backupBatch.commit();

    // 2. Resolve enrichment logic
    let count = 0;
    schoolsSnap.forEach(docSnap => {
        const data = docSnap.data();
        const stageName = data.stage?.name || '';
        
        // Logic: Support stage -> Active, others -> Onboarding
        const newStatus = stageName.toLowerCase().includes('support') ? 'Active' : 'Onboarding';

        batch.update(docSnap.ref, {
            schoolStatus: newStatus,
            updatedAt: new Date().toISOString()
        });
        count++;
    });

    await batch.commit();
    return count;
}

/**
 * MIGRATION PROTOCOL: Status Rollback
 */
export async function rollbackSchoolStatuses(firestore: Firestore): Promise<number> {
    const backupSnap = await getDocs(collection(firestore, 'backup_schools_status'));
    const batch = writeBatch(firestore);
    
    let count = 0;
    backupSnap.forEach(docSnap => {
        const originalRef = doc(firestore, 'schools', docSnap.id);
        batch.set(originalRef, docSnap.data());
        count++;
    });

    await batch.commit();
    return count;
}

export async function seedPipelines(firestore: Firestore): Promise<number> {
    const batch = writeBatch(firestore);
    const pipelinesCol = collection(firestore, 'pipelines');
    const stagesCol = collection(firestore, 'onboardingStages');
    const timestamp = new Date().toISOString();

    // 1. Onboarding Pipeline
    const onboardingId = 'institutional_onboarding';
    const onboardingStages = [
        { id: 'stage_onboarding_welcome', name: 'Welcome', order: 1, color: '#f72585', pipelineId: onboardingId },
        { id: 'stage_onboarding_setup', name: 'Identity Setup', order: 2, color: '#b5179e', pipelineId: onboardingId },
        { id: 'stage_onboarding_support', name: 'Support & Success', order: 3, color: '#4361ee', pipelineId: onboardingId },
    ];

    onboardingStages.forEach(s => batch.set(doc(stagesCol, s.id), s));
    batch.set(doc(pipelinesCol, onboardingId), {
        id: onboardingId,
        name: 'Institutional Onboarding',
        description: 'Standard technical implementation lifecycle.',
        workspaceId: 'onboarding',
        stageIds: onboardingStages.map(s => s.id),
        accessRoles: ['administrator'],
        createdAt: timestamp
    });

    // 2. Lead Acquisition Pipeline (Prospects)
    const prospectId = 'sales_acquisition';
    const prospectStages = [
        { id: 'stage_prospect_discovery', name: 'Discovery', order: 1, color: '#4cc9f0', pipelineId: prospectId },
        { id: 'stage_prospect_proposal', name: 'Proposal Sent', order: 2, color: '#4361ee', pipelineId: prospectId },
        { id: 'stage_prospect_contract', name: 'Contract Signed', order: 3, color: '#22c55e', pipelineId: prospectId },
    ];

    prospectStages.forEach(s => batch.set(doc(stagesCol, s.id), s));
    batch.set(doc(pipelinesCol, prospectId), {
        id: prospectId,
        name: 'Lead Acquisition',
        description: 'Sales funnel for prospective campuses.',
        workspaceId: 'prospect',
        stageIds: prospectStages.map(s => s.id),
        accessRoles: ['administrator'],
        createdAt: timestamp
    });

    await batch.commit();
    return 2;
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
            workspaceId: wId,
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

export async function seedModules(firestore: Firestore): Promise<number> {
    const batch = writeBatch(firestore);
    const col = collection(firestore, 'modules');
    const modules = [
        { name: 'Student Billing', abbreviation: 'BIL', color: '#3B5FFF', order: 0 },
        { name: 'Child Security', abbreviation: 'SEC', color: '#ef4444', order: 1 },
        { name: 'Attendance', abbreviation: 'ATT', color: '#10b981', order: 2 },
        { name: 'Academic Reports', abbreviation: 'REP', color: '#8b5cf6', order: 3 },
    ];
    modules.forEach(m => batch.set(doc(col), m));
    await batch.commit();
    return modules.length;
}

export async function seedZones(firestore: Firestore): Promise<number> {
    const batch = writeBatch(firestore);
    const col = collection(firestore, 'zones');
    initialZones.forEach(z => batch.set(doc(col), { name: z }));
    await batch.commit();
    return initialZones.length;
}

// --- STUBS FOR REMAINING EXPORTS ---

export async function seedMedia(firestore: Firestore): Promise<number> { return 0; }
export async function seedMeetings(firestore: Firestore): Promise<number> { return 0; }
export async function seedSurveys(firestore: Firestore): Promise<number> { return 0; }
export async function seedUserAvatars(firestore: Firestore): Promise<number> { return 0; }
export async function seedOnboardingStages(firestore: Firestore) { return { stagesCreated: 0, schoolsUpdated: 0 }; }
export async function seedOnboardingPipelineFromCurrentData(firestore: Firestore) { return 0; }
export async function enrichAndRestoreSchools(firestore: Firestore) { return 0; }
export async function rollbackSchoolsMigration(firestore: Firestore) { return 0; }
export async function seedActivities(firestore: Firestore) { return 0; }
export async function seedPdfForms(firestore: Firestore) { return 0; }
export async function seedMessaging(firestore: Firestore) { return 0; }
export async function seedMessageLogs(firestore: Firestore) { return 0; }
export async function seedTasks(firestore: Firestore) { return 0; }
export async function seedBillingData(firestore: Firestore) { return 0; }
export async function seedRolesAndPermissions(firestore: Firestore) { return 0; }
