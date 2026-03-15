
'use client';

import { collection, writeBatch, getDocs, doc, query, where, orderBy, limit, addDoc, setDoc, deleteDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { School, Meeting, MediaAsset, Survey, UserProfile, OnboardingStage, Module, Activity, PDFForm, PDFFormField, SenderProfile, MessageStyle, MessageTemplate, MessageLog, Zone, FocalPerson, SchoolStatus, Task, TaskPriority, TaskCategory, TaskStatus, SubscriptionPackage, BillingPeriod, BillingSettings, Role, AppPermissionId, Pipeline, InstitutionalTrack, Perspective } from '@/lib/types';
import { MEETING_TYPES } from '@/lib/types';
import { ONBOARDING_STAGE_COLORS } from './colors';
import { addDays, format, isAfter, startOfToday, subDays, subHours } from 'date-fns';

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
  {
    name: 'school-campus-hero.jpg',
    url: 'https://picsum.photos/seed/school-hero/1200/800',
    originalName: 'school-campus-hero.jpg',
    fullPath: 'seed/school-campus-hero.jpg',
    type: 'image', mimeType: 'image/jpeg', size: 250000, width: 1200, height: 800,
    uploadedBy: 'system-seed', createdAt: new Date('2024-01-01T10:01:00Z').toISOString(),
  },
  {
    name: 'school-prospectus.pdf',
    url: 'https://smartsapp.com/downloads/brochure.pdf',
    originalName: 'school-prospectus.pdf',
    fullPath: 'seed/school-prospectus.pdf',
    type: 'document', mimeType: 'application/pdf', size: 1200000,
    uploadedBy: 'system-seed', createdAt: new Date('2024-01-02T11:00:00Z').toISOString(),
  },
  {
    name: 'promotional-video.mp4',
    url: 'https://youtu.be/M6MUlDkfZOg',
    originalName: 'promotional-video.mp4',
    type: 'link', size: 0,
    uploadedBy: 'system-seed', createdAt: new Date('2024-01-02T12:00:00Z').toISOString(),
  },
  {
    name: 'students-in-classroom.jpg',
    url: 'https://picsum.photos/seed/classroom/1200/800',
    originalName: 'students-in-classroom.jpg',
    fullPath: 'seed/students-in-classroom.jpg',
    type: 'image', mimeType: 'image/jpeg', size: 310000, width: 1200, height: 800,
    uploadedBy: 'system-seed', createdAt: new Date('2024-01-03T09:00:00Z').toISOString(),
  },
];

const baseSchoolData: Omit<School, 'id' | 'slug' | 'perspectiveId' | 'stage' | 'assignedTo' | 'createdAt' | 'logoUrl' | 'heroImageUrl' | 'modules' | 'zone' | 'focalPersons' | 'status' | 'lifecycleStatus' | 'pipelineId'>[] = [
  { name: 'Ghana International School', initials: 'GIS', slogan: 'Understanding of each other.', location: 'Accra, Ghana', nominalRoll: 1500, includeDroneFootage: true, referee: 'SmartSapp Team', focalPersons: [{ name: 'Dr. Mary Ashun', email: 'principal@gis.edu.gh', phone: '+233 30 277 7163', type: 'Principal', isSignatory: true }] },
  { name: 'Lincoln Community School', initials: 'LCS', slogan: 'Learning and community, hand in hand.', location: 'Accra, Ghana', nominalRoll: 800, includeDroneFootage: false, referee: 'Ama Serwaa', focalPersons: [{ name: 'John Smith', email: 'admissions@lincoln.edu.gh', phone: '+233 30 221 8100', type: 'Administrator', isSignatory: true }] },
  { name: 'Adisadel College', initials: 'ADISCO', slogan: 'Vel Primus Vel Cum Primis.', location: 'Cape Coast, Ghana', nominalRoll: 2000, includeDroneFootage: true, referee: 'Old Boys Association', focalPersons: [{ name: 'The Headmaster', email: 'info@adisadelcollege.net', phone: '+233 33 213 2543', type: 'Principal', isSignatory: true }] },
  { name: 'SOS-Hermann Gmeiner International College', initials: 'SOS-HGIC', slogan: 'Knowledge and Service.', location: 'Tema, Ghana', nominalRoll: 400, includeDroneFootage: false, referee: 'SOS-CV Ghana', focalPersons: [{ name: 'The Principal', email: 'hgic.info@sos-ghana.org', phone: '+233 30 330 5231', type: 'Principal', isSignatory: true }] },
  { name: 'Wesley Girls\' High School', initials: 'WGHS', slogan: 'Live Pure, Speak True, Right Wrong, Follow the King.', location: 'Cape Coast, Ghana', nominalRoll: 1800, includeDroneFootage: false, referee: 'GES', focalPersons: [{ name: 'The Headmistress', email: 'info@wesleygirls.edu.gh', phone: '+233 33 213 2218', type: 'Principal', isSignatory: true }] },
  { name: 'Presbyterian Boys\' Secondary School (PRESEC)', initials: 'PRESEC', slogan: 'In Lumine Tuo Videbimus Lumen.', location: 'Legon, Accra', nominalRoll: 2500, includeDroneFootage: true, referee: 'Old Boys Association', focalPersons: [{ name: 'The Headmaster', email: 'info@preseclegon.edu.gh', phone: '+233 30 250 0907', type: 'Principal', isSignatory: true }] },
  { name: 'Galaxy International School', initials: 'Galaxy', slogan: 'Gateway to the Future.', location: 'Accra, Ghana', nominalRoll: 600, includeDroneFootage: true, referee: 'Corporate Referral', focalPersons: [{ name: 'Admissions Office', email: 'info@galaxy.edu.gh', phone: '+233 30 254 5472', type: 'Administrator', isSignatory: true }] },
  { name: 'Tema International School', initials: 'TIS', slogan: 'Service, Strength and Stability.', location: 'Tema, Ghana', nominalRoll: 500, includeDroneFootage: false, referee: 'IB Network', focalPersons: [{ name: 'Admissions Dean', email: 'admissions@tis.edu.gh', phone: '+233 30 330 5134', type: 'Administrator', isSignatory: true }] },
  { name: 'Ridge School', initials: 'Ridge', slogan: 'Loyalty and Service.', location: 'Accra, Ghana', nominalRoll: 1200, includeDroneFootage: false, referee: 'Parent Alumni', focalPersons: [{ name: 'Mrs. S. Nelson', email: 'info@ridgeschool.edu.gh', phone: '+233 30 222 2962', type: 'Principal', isSignatory: true }] },
  { name: 'Faith Montessori School', initials: 'Faith', slogan: 'Godliness and Academic Excellence.', location: 'Gbawe, Accra', nominalRoll: 1000, includeDroneFootage: true, referee: 'SmartSapp Support', focalPersons: [{ name: 'Mr. Oswald Amoo', email: 'admin@faithmontessori.edu.gh', phone: '+233 30 231 2345', type: 'Administrator', isSignatory: true }] },
];

const defaultModules = [
    { name: 'Child Security', abbreviation: 'SEC', color: '#f72585', description: 'Ensures safe drop-off and pick-up of students.', order: 1 },
    { name: 'Connected Community', abbreviation: 'COM', color: '#b5179e', description: 'Enhances communication between school, teachers, and parents.', order: 2 },
    { name: 'Student Billing', abbreviation: 'BIL', color: '#4361ee', description: 'Automated termly invoicing and arrears management.', order: 3 },
    { name: 'Health Monitor', abbreviation: 'HLT', color: '#4cc9f0', description: 'Digital health logs and infirmary tracking.', order: 4 },
];

const defaultPackages: Omit<SubscriptionPackage, 'id'>[] = [
    { name: 'Platinum Hub', description: 'Full feature access with high-priority support.', ratePerStudent: 85.50, billingTerm: 'term', currency: 'GHS', isActive: true },
    { name: 'Premium Cloud', description: 'Core functional modules for digital operations.', ratePerStudent: 65.00, billingTerm: 'term', currency: 'GHS', isActive: true },
    { name: 'Starter Suite', description: 'Essential security and communication tools.', ratePerStudent: 45.00, billingTerm: 'term', currency: 'GHS', isActive: true },
];

const surveyData = [
  {
    title: 'School Readiness Audit',
    internalName: 'Institutional Readiness v1',
    description: 'A comprehensive assessment to determine digital transformation readiness.',
    status: 'published' as const,
    scoringEnabled: true,
    maxScore: 100,
    elements: [
      { id: 'q1', type: 'yes-no', title: 'Do you have stable internet?', isRequired: true, enableScoring: true, yesScore: 20, noScore: 0 },
      { id: 'q2', type: 'multiple-choice', title: 'Total students?', options: ['< 100', '100-500', '500+'], isRequired: true, enableScoring: true, optionScores: [10, 30, 50] },
    ],
    resultPages: [],
    resultRules: []
  }
];

// --- HELPER FUNCTIONS ---

async function clearCollection(firestore: Firestore, collectionPath: string) {
  const collectionRef = collection(firestore, collectionPath);
  const querySnapshot = await getDocs(collectionRef);
  if (querySnapshot.empty) return;
  const batch = writeBatch(firestore);
  querySnapshot.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
}

// --- SEEDING FUNCTIONS ---

export async function seedPerspectives(firestore: Firestore): Promise<number> {
    await clearCollection(firestore, 'perspectives');
    const batch = writeBatch(firestore);
    const col = collection(firestore, 'perspectives');
    const timestamp = new Date().toISOString();

    const data: Perspective[] = [
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

    data.forEach(p => batch.set(doc(col, p.id), p));
    await batch.commit();
    return data.length;
}

export async function seedOnboardingPipelineFromCurrentData(firestore: Firestore): Promise<number> {
    const schoolsSnap = await getDocs(collection(firestore, 'schools'));
    if (schoolsSnap.empty) {
        return await seedPipelines(firestore);
    }

    const schools = schoolsSnap.docs.map(d => d.data() as School);
    const stageMap = new Map<string, { name: string, color: string, order: number }>();
    
    schools.forEach(school => {
        if (school.stage && school.stage.name) {
            const key = school.stage.name.toLowerCase().trim();
            if (!stageMap.has(key)) {
                stageMap.set(key, {
                    name: school.stage.name,
                    color: school.stage.color || ONBOARDING_STAGE_COLORS[stageMap.size % ONBOARDING_STAGE_COLORS.length],
                    order: school.stage.order || (stageMap.size + 1)
                });
            }
        }
    });

    if (stageMap.size === 0) {
        stageMap.set('welcome', { name: 'Welcome', color: '#f72585', order: 1 });
        stageMap.set('training', { name: 'Staff Training', color: '#7209b7', order: 2 });
        stageMap.set('live', { name: 'Go-Live', color: '#4361ee', order: 3 });
    }

    const batch = writeBatch(firestore);
    const pipelinesCol = collection(firestore, 'pipelines');
    const stagesCol = collection(firestore, 'onboardingStages');
    const onboardingId = 'institutional_onboarding';

    const oldStagesQuery = query(stagesCol, where('pipelineId', '==', onboardingId));
    const oldStagesSnap = await getDocs(oldStagesQuery);
    oldStagesSnap.forEach(d => batch.delete(d.ref));

    const sortedStages = Array.from(stageMap.values()).sort((a, b) => a.order - b.order);
    const newStageIds: string[] = [];
    
    sortedStages.forEach((s, i) => {
        const stageId = `stg_${onboardingId}_${i}`;
        newStageIds.push(stageId);
        batch.set(doc(stagesCol, stageId), {
            id: stageId,
            pipelineId: onboardingId,
            name: s.name,
            order: i + 1,
            color: s.color
        });
    });

    const onboardingPipeline: Omit<Pipeline, 'id'> = {
        name: 'Institutional Onboarding',
        description: 'Harvested from current network data.',
        perspectiveId: 'onboarding',
        stageIds: newStageIds,
        accessRoles: ['administrator', 'regional_supervisor', 'finance_officer'],
        createdAt: new Date().toISOString()
    };

    batch.set(doc(pipelinesCol, onboardingId), onboardingPipeline);
    await batch.commit();
    return newStageIds.length;
}

export async function enrichAndRestoreSchools(firestore: Firestore): Promise<number> {
    const schoolsCol = collection(firestore, 'schools');
    const backupCol = collection(firestore, 'backup_schools');
    const stagesCol = collection(firestore, 'onboardingStages');
    const onboardingId = 'institutional_onboarding';

    const [schoolsSnap, stagesSnap] = await Promise.all([
        getDocs(schoolsCol),
        getDocs(query(stagesCol, where('pipelineId', '==', onboardingId), orderBy('order', 'asc')))
    ]);

    if (schoolsSnap.empty) return 0;
    
    const availableStages = stagesSnap.docs.map(d => ({ id: d.id, ...d.data() } as OnboardingStage));
    const batch = writeBatch(firestore);
    
    const oldBackupSnap = await getDocs(backupCol);
    oldBackupSnap.forEach(d => batch.delete(d.ref));

    let processedCount = 0;

    schoolsSnap.forEach(schoolDoc => {
        const schoolData = schoolDoc.data() as School;
        batch.set(doc(backupCol, schoolDoc.id), { ...schoolData, id: schoolDoc.id });

        let targetStage = availableStages[0];
        if (schoolData.stage && schoolData.stage.name) {
            const match = availableStages.find(s => s.name.toLowerCase().trim() === schoolData.stage!.name.toLowerCase().trim());
            if (match) targetStage = match;
        }

        batch.update(schoolDoc.ref, {
            pipelineId: onboardingId,
            perspectiveId: 'onboarding',
            stage: targetStage ? {
                id: targetStage.id,
                name: targetStage.name,
                order: targetStage.order,
                color: targetStage.color
            } : null,
            updatedAt: new Date().toISOString()
        });

        processedCount++;
    });

    await batch.commit();
    return processedCount;
}

export async function rollbackSchoolsMigration(firestore: Firestore): Promise<number> {
    const schoolsCol = collection(firestore, 'schools');
    const backupCol = collection(firestore, 'backup_schools');

    const backupSnap = await getDocs(backupCol);
    if (backupSnap.empty) throw new Error("No backup found.");

    const batch = writeBatch(firestore);
    const currentSchools = await getDocs(schoolsCol);
    currentSchools.forEach(d => batch.delete(d.ref));

    let restoreCount = 0;
    backupSnap.forEach(backupDoc => {
        batch.set(doc(schoolsCol, backupDoc.id), backupDoc.data());
        restoreCount++;
    });

    await batch.commit();
    return restoreCount;
}

export async function seedPipelines(firestore: Firestore): Promise<number> {
    await clearCollection(firestore, 'pipelines');
    await clearCollection(firestore, 'onboardingStages');
    
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
        perspectiveId: 'onboarding',
        stageIds: onboardingStages.map(s => s.id),
        accessRoles: ['administrator'],
        createdAt: timestamp
    });

    const salesId = 'sales_acquisition';
    const salesStages = [
        { id: 'contacted', name: 'Contact Established', order: 1, color: '#f59e0b', pipelineId: salesId },
        { id: 'demo', name: 'Demo Scheduled', order: 2, color: '#d97706', pipelineId: salesId },
        { id: 'closed', name: 'Closed Won', order: 3, color: '#10b981', pipelineId: salesId },
    ];

    salesStages.forEach(s => batch.set(doc(stagesCol, s.id), s));
    batch.set(doc(pipelinesCol, salesId), {
        name: 'Lead Pipeline',
        description: 'Sales cycle.',
        perspectiveId: 'prospect',
        stageIds: salesStages.map(s => s.id),
        accessRoles: ['administrator'],
        createdAt: timestamp
    });

    await batch.commit();
    return 2;
}

export async function seedRolesAndPermissions(firestore: Firestore): Promise<number> {
    await clearCollection(firestore, 'roles');
    const batch = writeBatch(firestore);
    const rolesCol = collection(firestore, 'roles');
    const timestamp = new Date().toISOString();

    const initialRoles: Omit<Role, 'id'>[] = [
        {
            name: 'Administrator',
            description: 'Full system control.',
            color: '#f72585',
            permissions: ['schools_view', 'schools_edit', 'finance_view', 'finance_manage', 'contracts_delete', 'studios_view', 'studios_edit', 'system_admin', 'system_user_switch', 'meetings_manage', 'tasks_manage', 'activities_view'],
            createdAt: timestamp
        },
        {
            name: 'Regional Supervisor',
            description: 'Regional oversight.',
            color: '#3b82f6',
            permissions: ['schools_view', 'schools_edit', 'studios_view', 'meetings_manage', 'tasks_manage', 'activities_view'],
            createdAt: timestamp
        }
    ];

    initialRoles.forEach(role => {
        const id = role.name.toLowerCase().replace(/\s+/g, '_');
        batch.set(doc(rolesCol, id), role);
    });

    await batch.commit();
    return initialRoles.length;
}

export async function seedZones(firestore: Firestore): Promise<number> {
  await clearCollection(firestore, 'zones');
  const batch = writeBatch(firestore);
  const zonesCol = collection(firestore, 'zones');
  initialZones.forEach(name => batch.set(doc(zonesCol), { name }));
  await batch.commit();
  return initialZones.length;
}

export async function seedSchools(firestore: Firestore): Promise<number> {
    const schoolsCollection = collection(firestore, 'schools');
    const usersCollection = collection(firestore, 'users');
    const stagesCollection = collection(firestore, 'onboardingStages');
    
    await clearCollection(firestore, 'schools');
    const batch = writeBatch(firestore);

    const authorizedUsers = (await getDocs(query(usersCollection, where('isAuthorized', '==', true)))).docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
    const stages = (await getDocs(query(stagesCollection, orderBy('order')))).docs.map(doc => ({ id: doc.id, ...doc.data()} as OnboardingStage));
    const allModules = (await getDocs(query(collection(firestore, 'modules'), orderBy('order')))).docs.map(doc => ({ id: doc.id, ...doc.data() } as Module));
    const allZones = (await getDocs(collection(firestore, 'zones'))).docs.map(doc => ({ id: doc.id, ...doc.data() } as Zone));

    baseSchoolData.forEach((schoolSource: any, index: number) => {
        const docRef = doc(schoolsCollection);
        const name = schoolSource.name;
        const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const pId = index % 4 === 0 ? 'prospect' : 'onboarding';
        const pStages = stages.filter(s => s.pipelineId === (pId === 'prospect' ? 'sales_acquisition' : 'institutional_onboarding'));

        const school: Omit<School, 'id'> = {
            ...schoolSource,
            slug,
            perspectiveId: pId,
            status: 'Active',
            lifecycleStatus: 'Onboarding',
            pipelineId: pId === 'prospect' ? 'sales_acquisition' : 'institutional_onboarding',
            logoUrl: `https://logo.clearbit.com/${slug}.com`,
            heroImageUrl: `https://picsum.photos/seed/${slug}/1200/800`,
            stage: pStages[index % (pStages.length || 1)] || null,
            assignedTo: authorizedUsers.length > 0 
                ? { userId: authorizedUsers[index % authorizedUsers.length].id, name: authorizedUsers[index % authorizedUsers.length].name, email: authorizedUsers[index % authorizedUsers.length].email }
                : { userId: null, name: null, email: null },
            createdAt: subDays(new Date(), index * 3).toISOString(),
            modules: allModules.slice(0, 2).map(m => ({ id: m.id, name: m.name, abbreviation: m.abbreviation, color: m.color })),
            zone: allZones[index % (allZones.length || 1)],
            currency: 'GHS',
        };
        batch.set(docRef, school);
    });
    
    await batch.commit();
    return baseSchoolData.length;
}

export async function seedMeetings(firestore: Firestore): Promise<number> {
  await clearCollection(firestore, 'meetings');
  const batch = writeBatch(firestore);
  const schoolsSnapshot = await getDocs(collection(firestore, 'schools'));
  let meetingsCount = 0;
  schoolsSnapshot.forEach((schoolDoc, index) => {
    const school = { id: schoolDoc.id, ...schoolDoc.data() } as School;
    MEETING_TYPES.forEach((type, typeIndex) => {
        const docRef = doc(collection(firestore, 'meetings'));
        batch.set(docRef, {
            schoolId: school.id, schoolName: school.name, schoolSlug: school.slug,
            type: type, meetingTime: addDays(new Date(), (index * 2) + typeIndex).toISOString(),
            meetingLink: `https://meet.google.com/${school.slug.substring(0,3)}-${type.slug.substring(0,3)}`,
        });
        meetingsCount++;
    });
  });
  await batch.commit();
  return meetingsCount;
}

export async function seedMedia(firestore: Firestore): Promise<number> {
  await clearCollection(firestore, 'media');
  const batch = writeBatch(firestore);
  const mediaCollection = collection(firestore, 'media');
  mediaData.forEach((asset) => batch.set(doc(mediaCollection), asset));
  await batch.commit();
  return mediaData.length;
}

export async function seedSurveys(firestore: Firestore): Promise<number> {
  await clearCollection(firestore, 'surveys');
  const batch = writeBatch(firestore);
  const surveysCollection = collection(firestore, 'surveys');
  surveyData.forEach((survey) => {
    const docRef = doc(surveysCollection);
    const slug = survey.title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    batch.set(docRef, { ...survey, slug, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  });
  await batch.commit();
  return surveyData.length;
}

export async function seedUserAvatars(firestore: Firestore): Promise<number> {
  const usersCollection = collection(firestore, 'users');
  const querySnapshot = await getDocs(usersCollection);
  const batch = writeBatch(firestore);
  let updatedCount = 0;
  querySnapshot.forEach((docSnap) => {
    const user = docSnap.data() as UserProfile;
    if (!user.photoURL) {
      batch.update(docSnap.ref, { photoURL: `https://i.pravatar.cc/150?u=${docSnap.id}` });
      updatedCount++;
    }
  });
  if (updatedCount > 0) await batch.commit();
  return updatedCount;
}

export async function seedOnboardingStages(firestore: Firestore): Promise<{ stagesCreated: number, schoolsUpdated: number }> {
    return { stagesCreated: 0, schoolsUpdated: 0 }; // Deprecated in favor of seedPipelines
}

export async function seedModules(firestore: Firestore): Promise<number> {
  await clearCollection(firestore, 'modules');
  const batch = writeBatch(firestore);
  defaultModules.forEach((moduleData) => batch.set(doc(collection(firestore, 'modules')), moduleData));
  await batch.commit();
  return defaultModules.length;
}

export async function seedActivities(firestore: Firestore): Promise<number> {
  await clearCollection(firestore, 'activities');
  const schoolsSnapshot = await getDocs(collection(firestore, 'schools'));
  const usersSnapshot = await getDocs(query(collection(firestore, 'users'), where('isAuthorized', '==', true)));
  const users = usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile));
  const batch = writeBatch(firestore);

  let count = 0;
  schoolsSnapshot.forEach((schoolDoc, i) => {
      const school = schoolDoc.data() as School;
      const docRef = doc(collection(firestore, 'activities'));
      batch.set(docRef, {
          schoolId: schoolDoc.id, schoolName: school.name, schoolSlug: school.slug, perspectiveId: school.perspectiveId,
          userId: users.length > 0 ? users[i % users.length].id : null,
          type: 'note', source: 'manual', timestamp: subHours(new Date(), i * 2).toISOString(),
          description: `added a note for ${school.name}`, metadata: { content: 'Following up on implementation.' }
      });
      count++;
  });
  await batch.commit();
  return count;
}

export async function seedPdfForms(firestore: Firestore): Promise<number> {
    await clearCollection(firestore, 'pdfs');
    const batch = writeBatch(firestore);
    const pdf = {
        name: 'Enrollment Agreement', publicTitle: 'Institutional Agreement', slug: 'enrollment-2024',
        storagePath: 'seed/enrollment.pdf', downloadUrl: 'https://smartsapp.com/downloads/enrollment.pdf',
        status: 'published', createdBy: 'system', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        backgroundPattern: 'none', backgroundColor: '#F1F5F9', patternColor: '#3B5FFF',
        fields: [{ id: 'fld_1', type: 'text', label: 'Name', pageNumber: 1, position: { x: 10, y: 20 }, dimensions: { width: 40, height: 4 } }],
    };
    batch.set(doc(collection(firestore, 'pdfs')), pdf);
    await batch.commit();
    return 1;
}

export async function seedMessaging(firestore: Firestore): Promise<number> {
    return 0; // Standard logic in seed.ts suffices
}

export async function seedMessageLogs(firestore: Firestore): Promise<number> {
  await clearCollection(firestore, 'message_logs');
  return 0; 
}

export async function seedTasks(firestore: Firestore): Promise<number> {
    await clearCollection(firestore, 'tasks');
    const schoolsSnap = await getDocs(collection(firestore, 'schools'));
    const usersSnap = await getDocs(query(collection(firestore, 'users'), where('isAuthorized', '==', true)));
    const batch = writeBatch(firestore);

    let count = 0;
    schoolsSnap.docs.forEach((schoolDoc, i) => {
        const school = schoolDoc.data() as School;
        const task = {
            title: `Audit ${school.name} branding`, description: 'Verify logos and motto.',
            priority: 'medium', status: 'todo', category: 'general', perspectiveId: school.perspectiveId,
            schoolId: schoolDoc.id, schoolName: school.name, assignedTo: usersSnap.docs[0].id,
            dueDate: addDays(new Date(), 2).toISOString(), createdAt: new Date().toISOString(),
            source: 'manual', reminders: [], reminderSent: false
        };
        batch.set(doc(collection(firestore, 'tasks')), task);
        count++;
    });
    await batch.commit();
    return count;
}

export async function seedBillingData(firestore: Firestore): Promise<number> {
    await clearCollection(firestore, 'subscription_packages');
    const batch = writeBatch(firestore);
    defaultPackages.forEach(pkg => batch.set(doc(collection(firestore, 'subscription_packages')), pkg));
    batch.set(doc(collection(firestore, 'billing_settings'), 'global'), {
        levyPercent: 5, vatPercent: 15, defaultDiscount: 0, paymentInstructions: 'Pay to Fidelity Bank.', signatureName: 'Director'
    });
    await batch.commit();
    return 3;
}
