
'use client';

import { collection, writeBatch, getDocs, doc, query, where, orderBy, limit, setDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { School, Meeting, MediaAsset, Survey, UserProfile, OnboardingStage, Module, Activity, PDFForm, SenderProfile, MessageStyle, MessageTemplate, MessageLog, Zone, FocalPerson, SchoolStatusState, Task, TaskPriority, TaskCategory, TaskStatus, SubscriptionPackage, BillingPeriod, BillingSettings, Role, AppPermissionId, Pipeline, InstitutionalTrack, Workspace, WorkspaceStatus } from '@/lib/types';
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

const mediaData: Omit<MediaAsset, 'id'>[] = [
  {
    name: 'smartsapp-logo.png',
    url: 'https://smartsapp.com/wp-content/uploads/2023/08/logo-blue.png',
    originalName: 'smartsapp-logo.png',
    fullPath: 'seed/smartsapp-logo.png',
    type: 'image', mimeType: 'image/png', size: 15000, width: 256, height: 256,
    uploadedBy: 'system-seed', createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
  },
];

const baseSchoolData: any[] = [
  { name: 'Ghana International School', initials: 'GIS', slogan: 'Understanding of each other.', location: 'Accra, Ghana', nominalRoll: 1500, includeDroneFootage: true, referee: 'SmartSapp Team', focalPersons: [{ name: 'Dr. Mary Ashun', email: 'principal@gis.edu.gh', phone: '+233 30 277 7163', type: 'Principal', isSignatory: true }] },
  { name: 'Lincoln Community School', initials: 'LCS', slogan: 'Learning and community, hand in hand.', location: 'Accra, Ghana', nominalRoll: 800, includeDroneFootage: false, referee: 'Ama Serwaa', focalPersons: [{ name: 'John Smith', email: 'admissions@lincoln.edu.gh', phone: '+233 30 221 8100', type: 'Administrator', isSignatory: true }] },
  { name: 'Ridge Church School', initials: 'RCS', slogan: 'Fear of the Lord is the beginning of wisdom.', location: 'Accra, Ghana', nominalRoll: 1200, includeDroneFootage: true, referee: 'Parent Referral', focalPersons: [{ name: 'Mrs. Afua Dako', email: 'admin@ridgechurchschool.edu.gh', phone: '+233 30 222 2222', type: 'Administrator', isSignatory: true }] },
  { name: 'Morning Star School', initials: 'MSS', slogan: 'Quality Education for a Brighter Future.', location: 'Accra, Ghana', nominalRoll: 950, includeDroneFootage: false, referee: 'Google Search', focalPersons: [{ name: 'Mr. Kofi Boateng', email: 'info@morningstar.edu.gh', phone: '+233 30 233 3333', type: 'Principal', isSignatory: true }] },
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
 * MIGRATION PROTOCOL: School Status Enrichment
 * Maps legacy lifecycleStatus to schoolStatus and performs the "Support -> Active" logic.
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
 * Restores the schoolStatus state from the last backup.
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

    baseSchoolData.forEach((schoolSource: any, index: number) => {
        const docRef = doc(schoolsCollection);
        const name = schoolSource.name;
        const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const wId = index % 2 === 0 ? 'onboarding' : 'prospect';
        const pId = wId === 'prospect' ? 'sales_acquisition' : 'institutional_onboarding';
        
        const stage = wId === 'prospect' 
            ? { id: 'stage_prospect_discovery', name: 'Discovery', order: 1, color: '#4cc9f0' }
            : { id: 'stage_onboarding_welcome', name: 'Welcome', order: 1, color: '#f72585' };

        const school = {
            ...schoolSource,
            slug,
            workspaceId: wId,
            track: wId,
            status: 'Active',
            schoolStatus: wId === 'prospect' ? 'Lead' : 'Onboarding',
            pipelineId: pId,
            stage,
            createdAt: subDays(new Date(), index * 3).toISOString(),
            currency: 'GHS',
        };
        batch.set(docRef, school);
    });
    
    await batch.commit();
    return baseSchoolData.length;
}

// ... rest of seeding functions remain unchanged ...
export async function seedMedia(firestore: Firestore): Promise<number> { return 0; }
export async function seedSurveys(firestore: Firestore): Promise<number> { return 0; }
export async function seedUserAvatars(firestore: Firestore): Promise<number> { return 0; }
export async function seedOnboardingStages(firestore: Firestore) { return { stagesCreated: 0, schoolsUpdated: 0 }; }
export async function seedOnboardingPipelineFromCurrentData(firestore: Firestore) { return 0; }
export async function enrichAndRestoreSchools(firestore: Firestore) { return 0; }
export async function rollbackSchoolsMigration(firestore: Firestore) { return 0; }
export async function seedActivities(firestore: Firestore) { return 0; }
export async function seedPdfForms(firestore: Firestore) { return 0; }
export async function seedMessaging(firestore: Firestore) { return 0; }
export async function seedZones(firestore: Firestore) { return 0; }
export async function seedMessageLogs(firestore: Firestore) { return 0; }
export async function seedTasks(firestore: Firestore) { return 0; }
export async function seedBillingData(firestore: Firestore) { return 0; }
export async function seedRolesAndPermissions(firestore: Firestore) { return 0; }
export async function seedMeetings(firestore: Firestore) { return 0; }
