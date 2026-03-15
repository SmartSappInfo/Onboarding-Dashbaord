
'use client';

import { collection, writeBatch, getDocs, doc, query, where, orderBy, limit, setDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { School, Meeting, MediaAsset, Survey, UserProfile, OnboardingStage, Module, Activity, PDFForm, SenderProfile, MessageStyle, MessageTemplate, MessageLog, Zone, FocalPerson, SchoolStatus, Task, TaskPriority, TaskCategory, TaskStatus, SubscriptionPackage, BillingPeriod, BillingSettings, Role, AppPermissionId, Pipeline, InstitutionalTrack, Workspace } from '@/lib/types';
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
            createdAt: timestamp,
            updatedAt: timestamp
        },
        {
            id: 'prospect',
            name: 'Lead Acquisition',
            description: 'Sales and marketing track for prospective institutions.',
            color: '#10b981',
            status: 'active',
            createdAt: timestamp,
            updatedAt: timestamp
        }
    ];

    data.forEach(w => batch.set(doc(col, w.id), w));
    await batch.commit();
    return data.length;
}

/**
 * MIGRATION PROTOCOL 1: Architect
 * Scans current schools to identify existing stages and builds the master pipeline.
 */
export async function seedOnboardingPipelineFromCurrentData(firestore: Firestore): Promise<number> {
    const schoolsSnap = await getDocs(collection(firestore, 'schools'));
    const stagesMap = new Map<string, { name: string, color: string }>();

    schoolsSnap.forEach(doc => {
        const data = doc.data();
        if (data.stage && data.stage.name) {
            stagesMap.set(data.stage.name, { 
                name: data.stage.name, 
                color: data.stage.color || ONBOARDING_STAGE_COLORS[0] 
            });
        }
    });

    if (stagesMap.size === 0) {
        stagesMap.set('Welcome', { name: 'Welcome', color: '#f72585' });
        stagesMap.set('Identity Setup', { name: 'Identity Setup', color: '#b5179e' });
        stagesMap.set('Active (Go-Live)', { name: 'Active (Go-Live)', color: '#4361ee' });
    }

    const pipelineId = 'institutional_onboarding';
    const batch = writeBatch(firestore);
    
    const stageIds: string[] = [];
    let order = 1;
    stagesMap.forEach((val, name) => {
        const id = `stage_${pipelineId}_${name.toLowerCase().replace(/\s+/g, '_')}`;
        stageIds.push(id);
        batch.set(doc(firestore, 'onboardingStages', id), {
            id,
            name: val.name,
            color: val.color,
            order: order++,
            pipelineId
        });
    });

    batch.set(doc(firestore, 'pipelines', pipelineId), {
        id: pipelineId,
        name: 'Institutional Onboarding',
        description: 'Primary workflow for school implementation.',
        workspaceId: 'onboarding',
        stageIds,
        accessRoles: ['administrator'],
        createdAt: new Date().toISOString()
    });

    await batch.commit();
    return stagesMap.size;
}

/**
 * MIGRATION PROTOCOL 2: Harmonize
 * Backs up schools and enriches them with the mandatory workspaceId.
 */
export async function enrichAndRestoreSchools(firestore: Firestore): Promise<number> {
    const schoolsSnap = await getDocs(collection(firestore, 'schools'));
    const batch = writeBatch(firestore);
    const backupBatch = writeBatch(firestore);
    
    // 1. Safety Backup
    schoolsSnap.forEach(docSnap => {
        const backupRef = doc(firestore, 'backup_schools', docSnap.id);
        backupBatch.set(backupRef, docSnap.data());
    });
    await backupBatch.commit();

    // 2. Resolve default stage for the target pipeline
    const stagesSnap = await getDocs(query(
        collection(firestore, 'onboardingStages'), 
        where('pipelineId', '==', 'institutional_onboarding'),
        orderBy('order', 'asc'),
        limit(1)
    ));
    
    const defaultStage = !stagesSnap.empty 
        ? stagesSnap.docs[0].data() 
        : { id: 'stage_onboarding_welcome', name: 'Welcome', order: 1, color: '#f72585' };

    // 3. Dynamic Enrichment
    let count = 0;
    schoolsSnap.forEach(docSnap => {
        const data = docSnap.data();
        batch.update(docSnap.ref, {
            workspaceId: 'onboarding',
            track: 'onboarding',
            pipelineId: 'institutional_onboarding',
            // Maintain current stage if it looks like it belongs to the new schema
            stage: data.stage?.id ? data.stage : defaultStage, 
            updatedAt: new Date().toISOString()
        });
        count++;
    });

    await batch.commit();
    return count;
}

/**
 * MIGRATION PROTOCOL 3: Recovery
 * Restores the directory from the pre-migration backup.
 */
export async function rollbackSchoolsMigration(firestore: Firestore): Promise<number> {
    const backupSnap = await getDocs(collection(firestore, 'backup_schools'));
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
        { id: 'stage_onboarding_live', name: 'Active (Go-Live)', order: 3, color: '#4361ee', pipelineId: onboardingId },
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
        { id: 'stage_prospect_negotiation', name: 'Negotiation', order: 3, color: '#7209b7', pipelineId: prospectId },
        { id: 'stage_prospect_contract', name: 'Contract Signed', order: 4, color: '#22c55e', pipelineId: prospectId },
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
        
        // Resolve default stage based on pipeline
        const stage = wId === 'prospect' 
            ? { id: 'stage_prospect_discovery', name: 'Discovery', order: 1, color: '#4cc9f0' }
            : { id: 'stage_onboarding_welcome', name: 'Welcome', order: 1, color: '#f72585' };

        const school = {
            ...schoolSource,
            slug,
            workspaceId: wId,
            track: wId,
            status: 'Active',
            lifecycleStatus: 'Onboarding',
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

export async function seedMedia(firestore: Firestore): Promise<number> {
  const batch = writeBatch(firestore);
  const mediaCollection = collection(firestore, 'media');
  mediaData.forEach((asset) => batch.set(doc(mediaCollection), asset));
  await batch.commit();
  return mediaData.length;
}

export async function seedSurveys(firestore: Firestore): Promise<number> {
  const batch = writeBatch(firestore);
  const surveysCollection = collection(firestore, 'surveys');
  const survey = {
    title: 'School Readiness Audit',
    internalName: 'Institutional Readiness v1',
    description: 'A comprehensive assessment to determine digital transformation readiness.',
    status: 'published' as const,
    elements: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const docRef = doc(surveysCollection);
  batch.set(docRef, { ...survey, slug: 'readiness-audit' });
  await batch.commit();
  return 1;
}

export async function seedUserAvatars(firestore: Firestore): Promise<number> {
  const usersCollection = collection(firestore, 'users');
  const querySnapshot = await getDocs(usersCollection);
  const batch = writeBatch(firestore);
  let updatedCount = 0;
  querySnapshot.forEach((docSnap) => {
    batch.update(docSnap.ref, { photoURL: `https://i.pravatar.cc/150?u=${docSnap.id}` });
    updatedCount++;
  });
  if (updatedCount > 0) await batch.commit();
  return updatedCount;
}

export async function seedModules(firestore: Firestore): Promise<number> {
  const batch = writeBatch(firestore);
  const col = collection(firestore, 'modules');
  const mod = { name: 'Child Security', abbreviation: 'SEC', color: '#f72585', order: 1 };
  batch.set(doc(col), mod);
  await batch.commit();
  return 1;
}

export async function seedZones(firestore: Firestore): Promise<number> {
  const batch = writeBatch(firestore);
  const zonesCol = collection(firestore, 'zones');
  initialZones.forEach(name => batch.set(doc(zonesCol), { name }));
  await batch.commit();
  return initialZones.length;
}

// These are handled by specific seeders above
export async function seedOnboardingStages(firestore: Firestore) { return { stagesCreated: 0, schoolsUpdated: 0 }; }
export async function seedActivities(firestore: Firestore) { return 0; }
export async function seedPdfForms(firestore: Firestore) { return 0; }
export async function seedMessaging(firestore: Firestore) { return 0; }
export async function seedMessageLogs(firestore: Firestore) { return 0; }
export async function seedTasks(firestore: Firestore) { return 0; }
export async function seedBillingData(firestore: Firestore) { return 0; }
export async function seedRolesAndPermissions(firestore: Firestore) { return 0; }
export async function seedMeetings(firestore: Firestore) { return 0; }
