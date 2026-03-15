
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

export async function seedPipelines(firestore: Firestore): Promise<number> {
    const batch = writeBatch(firestore);
    const pipelinesCol = collection(firestore, 'pipelines');
    const stagesCol = collection(firestore, 'onboardingStages');
    const timestamp = new Date().toISOString();

    const onboardingId = 'institutional_onboarding';
    const onboardingStages = [
        { id: 'welcome', name: 'Welcome', order: 1, color: '#f72585', pipelineId: onboardingId },
        { id: 'setup', name: 'Identity Setup', order: 2, color: '#b5179e', pipelineId: onboardingId },
        { id: 'live', name: 'Active (Go-Live)', order: 3, color: '#4361ee', pipelineId: onboardingId },
    ];

    onboardingStages.forEach(s => batch.set(doc(stagesCol, s.id), s));
    batch.set(doc(pipelinesCol, onboardingId), {
        name: 'Institutional Onboarding',
        description: 'Standard lifecycle.',
        workspaceId: 'onboarding',
        stageIds: onboardingStages.map(s => s.id),
        accessRoles: ['administrator'],
        createdAt: timestamp
    });

    await batch.commit();
    return 1;
}

export async function seedSchools(firestore: Firestore): Promise<number> {
    const schoolsCollection = collection(firestore, 'schools');
    const batch = writeBatch(firestore);

    baseSchoolData.forEach((schoolSource: any, index: number) => {
        const docRef = doc(schoolsCollection);
        const name = schoolSource.name;
        const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const wId = index % 4 === 0 ? 'prospect' : 'onboarding';

        const school = {
            ...schoolSource,
            slug,
            workspaceId: wId,
            track: wId,
            status: 'Active',
            lifecycleStatus: 'Onboarding',
            pipelineId: wId === 'prospect' ? 'sales_acquisition' : 'institutional_onboarding',
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

export async function seedOnboardingStages(firestore: Firestore) { return { stagesCreated: 0, schoolsUpdated: 0 }; }
export async function seedActivities(firestore: Firestore) { return 0; }
export async function seedPdfForms(firestore: Firestore) { return 0; }
export async function seedMessaging(firestore: Firestore) { return 0; }
export async function seedMessageLogs(firestore: Firestore) { return 0; }
export async function seedTasks(firestore: Firestore) { return 0; }
export async function seedBillingData(firestore: Firestore) { return 0; }
export async function seedRolesAndPermissions(firestore: Firestore) { return 0; }
export async function seedOnboardingPipelineFromCurrentData(firestore: Firestore) { return 0; }
export async function enrichAndRestoreSchools(firestore: Firestore) { return 0; }
export async function rollbackSchoolsMigration(firestore: Firestore) { return 0; }
export async function seedMeetings(firestore: Firestore) { return 0; }
