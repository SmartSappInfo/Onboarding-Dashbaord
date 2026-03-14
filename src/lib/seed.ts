
'use client';

import { collection, writeBatch, getDocs, doc, query, where, orderBy, limit, addDoc, setDoc, deleteDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { School, Meeting, MediaAsset, Survey, UserProfile, OnboardingStage, Module, Activity, PDFForm, PDFFormField, SenderProfile, MessageStyle, MessageTemplate, MessageLog, Zone, FocalPerson, SchoolStatus, Task, TaskPriority, TaskCategory, TaskStatus, SubscriptionPackage, BillingPeriod, BillingSettings, Role, AppPermissionId, Pipeline, InstitutionalTrack } from '@/lib/types';
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

const baseSchoolData: Omit<School, 'id' | 'slug' | 'track' | 'stage' | 'assignedTo' | 'createdAt' | 'logoUrl' | 'heroImageUrl' | 'modules' | 'zone' | 'focalPersons' | 'status' | 'lifecycleStatus' | 'pipelineId'>[] = [
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
    resultRules: [
      { id: 'rule1', label: 'Highly Ready', minScore: 70, maxScore: 100, priority: 1, pageId: 'page1' }
    ]
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

/**
 * High-fidelity migration engine for the Institutional Onboarding Pipeline.
 * Harvests unique stages from current schools to architect the pipeline.
 */
export async function seedOnboardingPipelineFromCurrentData(firestore: Firestore): Promise<number> {
    const schoolsSnap = await getDocs(collection(firestore, 'schools'));
    if (schoolsSnap.empty) {
        return await seedPipelines(firestore); // Fallback to standard seed if no data exists
    }

    const schools = schoolsSnap.docs.map(d => d.data() as School);
    
    // 1. Identify Unique Stages from current dataset
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

    // 2. Ensure foundational stages exist if harvesting yielded little
    if (stageMap.size === 0) {
        stageMap.set('welcome', { name: 'Welcome', color: '#f72585', order: 1 });
        stageMap.set('training', { name: 'Staff Training', color: '#7209b7', order: 2 });
        stageMap.set('live', { name: 'Go-Live', color: '#4361ee', order: 3 });
    }

    const batch = writeBatch(firestore);
    const pipelinesCol = collection(firestore, 'pipelines');
    const stagesCol = collection(firestore, 'onboardingStages');
    const onboardingId = 'institutional_onboarding';

    // 3. Clear existing stages for this pipeline only to prevent orphans
    const oldStagesQuery = query(stagesCol, where('pipelineId', '==', onboardingId));
    const oldStagesSnap = await getDocs(oldStagesQuery);
    oldStagesSnap.forEach(d => batch.delete(d.ref));

    // 4. Architect New Stages
    const newStageIds: string[] = [];
    const sortedStages = Array.from(stageMap.values()).sort((a, b) => a.order - b.order);
    
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

    // 5. Initialize Pipeline Blueprint
    const onboardingPipeline: Omit<Pipeline, 'id'> = {
        name: 'Institutional Onboarding',
        description: 'Harvested from current network data. Primary school integration cycle.',
        targetTrack: 'onboarding',
        stageIds: newStageIds,
        accessRoles: ['administrator', 'regional_supervisor', 'finance_officer'],
        createdAt: new Date().toISOString()
    };

    batch.set(doc(pipelinesCol, onboardingId), onboardingPipeline);

    await batch.commit();
    return newStageIds.length;
}

/**
 * Enrichment Strategy: Updates all schools to be part of the "Institutional Onboarding" pipeline.
 * Creates a backup before proceeding.
 */
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
    if (availableStages.length === 0) throw new Error("Pipeline architecture must be initialized first.");

    const batch = writeBatch(firestore);
    
    // 1. CLEAR OLD BACKUP
    const oldBackupSnap = await getDocs(backupCol);
    oldBackupSnap.forEach(d => batch.delete(d.ref));

    let processedCount = 0;

    schoolsSnap.forEach(schoolDoc => {
        const schoolData = schoolDoc.data() as School;
        
        // 2. BACKUP CURRENT STATE
        batch.set(doc(backupCol, schoolDoc.id), { ...schoolData, id: schoolDoc.id });

        // 3. ENRICH WITH PIPELINE CONTEXT
        let targetStage = availableStages[0]; // Default to entry stage
        if (schoolData.stage && schoolData.stage.name) {
            const match = availableStages.find(s => s.name.toLowerCase().trim() === schoolData.stage!.name.toLowerCase().trim());
            if (match) targetStage = match;
        }

        batch.update(schoolDoc.ref, {
            pipelineId: onboardingId,
            track: 'onboarding', // Enrich with default track
            stage: {
                id: targetStage.id,
                name: targetStage.name,
                order: targetStage.order,
                color: targetStage.color
            },
            updatedAt: new Date().toISOString()
        });

        processedCount++;
    });

    await batch.commit();
    return processedCount;
}

/**
 * Emergency Recovery: Restores school directory from the last backup.
 */
export async function rollbackSchoolsMigration(firestore: Firestore): Promise<number> {
    const schoolsCol = collection(firestore, 'schools');
    const backupCol = collection(firestore, 'backup_schools');

    const backupSnap = await getDocs(backupCol);
    if (backupSnap.empty) throw new Error("No institutional backup found.");

    const batch = writeBatch(firestore);
    
    // Wipe current school records to ensure clean restore
    const currentSchools = await getDocs(schoolsCol);
    currentSchools.forEach(d => batch.delete(d.ref));

    let restoreCount = 0;
    backupSnap.forEach(backupDoc => {
        const data = backupDoc.data();
        batch.set(doc(schoolsCol, backupDoc.id), data);
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

    // 1. Primary Onboarding Pipeline
    const onboardingId = 'institutional_onboarding';
    const onboardingStages = [
        { id: 'welcome', name: 'Welcome', order: 1, color: '#f72585', pipelineId: onboardingId },
        { id: 'setup', name: 'Identity Setup', order: 2, color: '#b5179e', pipelineId: onboardingId },
        { id: 'training', name: 'Staff Training', order: 3, color: '#7209b7', pipelineId: onboardingId },
        { id: 'live', name: 'Active (Go-Live)', order: 4, color: '#4361ee', pipelineId: onboardingId },
    ];

    onboardingStages.forEach(s => {
        batch.set(doc(stagesCol, s.id), s);
    });

    const onboardingPipeline: Omit<Pipeline, 'id'> = {
        name: 'Institutional Onboarding',
        description: 'Standard lifecycle for new campus integration.',
        targetTrack: 'onboarding',
        stageIds: onboardingStages.map(s => s.id),
        accessRoles: ['administrator', 'regional_supervisor', 'finance_officer'],
        createdAt: timestamp
    };

    batch.set(doc(pipelinesCol, onboardingId), onboardingPipeline);

    // 2. Lead Acquisition Pipeline
    const salesId = 'sales_acquisition';
    const salesStages = [
        { id: 'contacted', name: 'Contact Established', order: 1, color: '#f59e0b', pipelineId: salesId },
        { id: 'demo', name: 'Demo Scheduled', order: 2, color: '#d97706', pipelineId: salesId },
        { id: 'negotiation', name: 'Contract Review', order: 3, color: '#b45309', pipelineId: salesId },
        { id: 'closed', name: 'Closed Won', order: 4, color: '#10b981', pipelineId: salesId },
    ];

    salesStages.forEach(s => {
        batch.set(doc(stagesCol, s.id), s);
    });

    const salesPipeline: Omit<Pipeline, 'id'> = {
        name: 'Lead Pipeline',
        description: 'Sales cycle for prospective institutions.',
        targetTrack: 'prospect',
        stageIds: salesStages.map(s => s.id),
        accessRoles: ['administrator', 'sales_supervisor', 'sales_representative'],
        createdAt: timestamp
    };

    batch.set(doc(pipelinesCol, salesId), salesPipeline);

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
            description: 'Full system control, user management, and configuration.',
            color: '#f72585',
            permissions: ['schools_view', 'schools_edit', 'prospects_view', 'prospects_edit', 'finance_view', 'finance_manage', 'contracts_delete', 'studios_view', 'studios_edit', 'system_admin', 'system_user_switch', 'meetings_manage', 'tasks_manage', 'activities_view'],
            createdAt: timestamp
        },
        {
            name: 'Sales Supervisor',
            description: 'Regional lead oversight, conversion metrics, and sales pipeline architecting.',
            color: '#10b981',
            permissions: ['prospects_view', 'prospects_edit', 'studios_view', 'activities_view', 'tasks_manage'],
            createdAt: timestamp
        },
        {
            name: 'Sales Representative',
            description: 'Lead acquisition, demos, and prospect documentation.',
            color: '#fbbf24',
            permissions: ['prospects_view', 'prospects_edit', 'tasks_manage'],
            createdAt: timestamp
        },
        {
            name: 'Finance Officer',
            description: 'Manages billing, invoicing, and institutional agreements.',
            color: '#10b981',
            permissions: ['schools_view', 'finance_view', 'finance_manage', 'studios_view', 'activities_view'],
            createdAt: timestamp
        },
        {
            name: 'Regional Supervisor',
            description: 'Regional oversight, performance audit, and content architecture.',
            color: '#3b82f6',
            permissions: ['schools_view', 'schools_edit', 'studios_view', 'studios_edit', 'system_user_switch', 'meetings_manage', 'tasks_manage', 'activities_view'],
            createdAt: timestamp
        },
        {
            name: 'Institutional Trainer',
            description: 'Focused on meeting coordination and staff training workshops.',
            color: '#8b5cf6',
            permissions: ['schools_view', 'meetings_manage', 'tasks_manage', 'activities_view'],
            createdAt: timestamp
        },
        {
            name: 'Customer Success (CSE)',
            description: 'Daily operational tasks and school profile maintenance.',
            color: '#64748b',
            permissions: ['schools_view', 'schools_edit', 'meetings_manage', 'tasks_manage'],
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
  initialZones.forEach(name => {
    batch.set(doc(zonesCol), { name });
  });
  await batch.commit();
  return initialZones.length;
}

export async function seedSchools(firestore: Firestore): Promise<number> {
    const schoolsCollection = collection(firestore, 'schools');
    const usersCollection = collection(firestore, 'users');
    const zonesCollection = collection(firestore, 'zones');
    
    const existingSchoolsSnap = await getDocs(schoolsCollection);
    const existingSchools = existingSchoolsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

    await clearCollection(firestore, 'schools');
    const batch = writeBatch(firestore);

    const usersQuery = query(usersCollection, where('isAuthorized', '==', true));
    const usersSnapshot = await getDocs(usersQuery);
    const authorizedUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
    
    const stagesQuery = query(collection(firestore, 'onboardingStages'), orderBy('order'));
    const stagesSnapshot = await getDocs(stagesQuery);
    const stages = stagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data()} as OnboardingStage));
    
    const modulesSnapshot = await getDocs(query(collection(firestore, 'modules'), orderBy('order')));
    const allModules = modulesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Module));

    const zonesSnapshot = await getDocs(zonesCollection);
    const allZones = zonesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Zone));
    const defaultZone = allZones.find(z => z.name.includes('External')) || (allZones.length > 0 ? allZones[0] : { id: 'ext', name: 'External Zone' });

    const dataToSeed = existingSchools.length > 0 ? existingSchools : baseSchoolData;

    dataToSeed.forEach((schoolSource: any, index: number) => {
        const docRef = doc(schoolsCollection);
        const name = schoolSource.name || schoolSource.organization || 'Untitled School';
        const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        let focalPersons: FocalPerson[] = schoolSource.focalPersons || [];
        if (focalPersons.length === 0 && (schoolSource.contactPerson || schoolSource.email)) {
            focalPersons.push({
                name: schoolSource.contactPerson || 'Primary Contact',
                email: schoolSource.email || '',
                phone: schoolSource.phone || '',
                type: 'Administrator',
                isSignatory: true
            });
        }

        const schoolModulesForSchool: any[] = schoolSource.modules || [];
        if (schoolModulesForSchool.length === 0 && allModules.length > 0) {
            const moduleCount = (index % 3) + 1;
            for (let i = 0; i < moduleCount; i++) {
                const moduleIndex = (index + i * 2) % allModules.length;
                if (!schoolModulesForSchool.find(m => m.id === allModules[moduleIndex].id)) {
                    schoolModulesForSchool.push(allModules[moduleIndex]);
                }
            }
        }
        
        const school: Omit<School, 'id'> = {
            ...schoolSource,
            name,
            slug,
            track: schoolSource.track || (index % 4 === 0 ? 'prospect' : 'onboarding'),
            status: schoolSource.status || 'Active',
            lifecycleStatus: schoolSource.lifecycleStatus || (index % 5 === 0 ? 'Active' : 'Onboarding'),
            pipelineId: schoolSource.pipelineId || 'institutional_onboarding',
            logoUrl: schoolSource.logoUrl || `https://logo.clearbit.com/${slug}.com`,
            heroImageUrl: schoolSource.heroImageUrl || `https://picsum.photos/seed/${slug}/1200/800`,
            stage: schoolSource.stage || (stages.length > 0 ? stages[index % stages.length] : undefined),
            assignedTo: schoolSource.assignedTo || (authorizedUsers.length > 0 
                ? {
                    userId: authorizedUsers[index % authorizedUsers.length].id,
                    name: authorizedUsers[index % authorizedUsers.length].name,
                    email: authorizedUsers[index % authorizedUsers.length].email,
                  }
                : { userId: null, name: null, email: null }),
            createdAt: schoolSource.createdAt || subDays(new Date(), index * 3).toISOString(),
            implementationDate: schoolSource.implementationDate || addDays(new Date(), (index + 1) * 7).toISOString(),
            modules: schoolModulesForSchool.map(m => ({ id: m.id, name: m.name, abbreviation: m.abbreviation, color: m.color })),
            zone: schoolSource.zone || (allZones.length > 0 ? allZones[index % allZones.length] : defaultZone),
            focalPersons: focalPersons,
            arrearsBalance: schoolSource.arrearsBalance || 0,
            creditBalance: schoolSource.creditBalance || 0,
            currency: schoolSource.currency || 'GHS',
        };
        batch.set(docRef, school);
    });
    
    await batch.commit();
    return dataToSeed.length;
}

export async function seedMeetings(firestore: Firestore): Promise<number> {
  const meetingsCollection = collection(firestore, 'meetings');
  await clearCollection(firestore, 'meetings');
  const batch = writeBatch(firestore);
  const schoolsSnapshot = await getDocs(collection(firestore, 'schools'));
  if (schoolsSnapshot.empty) return 0;
  let meetingsCount = 0;
  schoolsSnapshot.forEach((schoolDoc, index) => {
    const school = { id: schoolDoc.id, ...schoolDoc.data() } as School;
    MEETING_TYPES.forEach((type, typeIndex) => {
        const docRef = doc(meetingsCollection);
        const meetingDate = addDays(new Date(), (index * 2) + typeIndex);
        const meeting: Omit<Meeting, 'id'> = {
            schoolId: school.id, schoolName: school.name, schoolSlug: school.slug,
            type: type, meetingTime: meetingDate.toISOString(),
            meetingLink: `https://meet.google.com/${school.slug.substring(0,3)}-${type.slug.substring(0,3)}`,
            recordingUrl: type.id === 'parent' ? 'https://youtu.be/M6MUlDkfZOg' : '',
            brochureUrl: type.id === 'parent' ? 'https://smartsapp.com/downloads/brochure.pdf' : '',
        };
        batch.set(docRef, meeting);
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
  mediaData.forEach((asset) => {
    const docRef = doc(mediaCollection);
    batch.set(docRef, asset);
  });
  await batch.commit();
  return mediaData.length;
}

export async function seedSurveys(firestore: Firestore): Promise<number> {
  await clearCollection(firestore, 'surveys');
  const batch = writeBatch(firestore);
  const surveysCollection = collection(firestore, 'surveys');
  surveyData.forEach((survey) => {
    const docRef = doc(surveysCollection);
    const slug = survey.slug || survey.title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
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
      const seed = user.name ? user.name.replace(/\s+/g, '-').toLowerCase() : docSnap.id;
      batch.update(docSnap.ref, { photoURL: `https://i.pravatar.cc/150?u=${seed}` });
      updatedCount++;
    }
  });
  if (updatedCount > 0) await batch.commit();
  return updatedCount;
}

export async function seedOnboardingStages(firestore: Firestore): Promise<{ stagesCreated: number, schoolsUpdated: number }> {
    const stagesCollection = collection(firestore, 'onboardingStages');
    const schoolsCollection = collection(firestore, 'schools');
    const batch = writeBatch(firestore);
    const oldStagesSnapshot = await getDocs(stagesCollection);
    oldStagesSnapshot.forEach((doc) => batch.delete(doc.ref));
    const newStagesMap = new Map<string, OnboardingStage>();
    
    // Default stages for the primary onboarding pipeline
    const onboardingId = 'institutional_onboarding';
    const onboardingStages = [
        { id: 'welcome', name: 'Welcome', order: 1, color: '#f72585', pipelineId: onboardingId },
        { id: 'setup', name: 'Identity Setup', order: 2, color: '#b5179e', pipelineId: onboardingId },
        { id: 'training', name: 'Staff Training', order: 3, color: '#7209b7', pipelineId: onboardingId },
        { id: 'live', name: 'Active (Go-Live)', order: 4, color: '#4361ee', pipelineId: onboardingId },
    ];

    onboardingStages.forEach((stageData) => {
        const docRef = doc(stagesCollection, stageData.id);
        batch.set(docRef, stageData);
        newStagesMap.set(stageData.id, stageData as any);
    });

    const schoolsSnapshot = await getDocs(schoolsCollection);
    let schoolsUpdated = 0;
    const welcomeStage = onboardingStages[0];
    schoolsSnapshot.forEach(schoolDoc => {
        const school = schoolDoc.data() as School;
        const currentStageId = school.stage?.id;
        let newStageData = (currentStageId && newStagesMap.has(currentStageId)) ? newStagesMap.get(currentStageId) : welcomeStage;
        if (newStageData) {
            batch.update(schoolDoc.ref, { 
                stage: { id: newStageData.id, name: newStageData.name, order: newStageData.order, color: newStageData.color },
                pipelineId: onboardingId
            });
            schoolsUpdated++;
        }
    });
    await batch.commit();
    return { stagesCreated: onboardingStages.length, schoolsUpdated };
}

export async function seedModules(firestore: Firestore): Promise<number> {
  await clearCollection(firestore, 'modules');
  const batch = writeBatch(firestore);
  const modulesCollection = collection(firestore, 'modules');
  defaultModules.forEach((moduleData) => {
    const docRef = doc(modulesCollection);
    batch.set(docRef, moduleData);
  });
  await batch.commit();
  return defaultModules.length;
}

export async function seedActivities(firestore: Firestore): Promise<number> {
  // 1. Fetch existing activities to preserve them
  const activitiesSnapshot = await getDocs(collection(firestore, 'activities'));
  const existingActivities = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));

  // 2. Fetch schools for enrichment (lookup map)
  const schoolsSnapshot = await getDocs(collection(firestore, 'schools'));
  const schoolsMap = new Map(schoolsSnapshot.docs.map(doc => {
    const data = doc.data();
    return [doc.id, { name: data.name, slug: data.slug, track: data.track || 'onboarding' }];
  }));

  // 3. Fetch authorized users for context
  const usersSnapshot = await getDocs(query(collection(firestore, 'users'), where('isAuthorized', '==', true)));
  const users = usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile));

  // 4. Clear existing collection
  await clearCollection(firestore, 'activities');

  // 5. Enrich existing data with denormalized fields
  const enrichedExisting = existingActivities.map(activity => {
    const schoolData = activity.schoolId ? schoolsMap.get(activity.schoolId) : null;
    return {
      ...activity,
      schoolName: schoolData?.name || activity.schoolName,
      schoolSlug: schoolData?.slug || activity.schoolSlug,
      track: schoolData?.track || activity.track || 'onboarding',
    };
  });

  // 6. Generate fresh dummy activities if needed
  const dummyActivities: Omit<Activity, 'id'>[] = [];
  if (schoolsSnapshot.docs.length > 0) {
      const schools = schoolsSnapshot.docs.map(d => ({id: d.id, ...d.data()} as School));
      schools.forEach((school, i) => {
          dummyActivities.push({
              schoolId: school.id,
              schoolName: school.name,
              schoolSlug: school.slug,
              track: school.track || 'onboarding',
              userId: users.length > 0 ? users[i % users.length].id : null,
              type: 'note',
              source: 'manual',
              timestamp: subHours(new Date(), i * 2).toISOString(),
              description: `added a follow-up note for ${school.name}`,
              metadata: { content: 'School is interested in drone footage for the primary campus.' }
          });
      });
  }

  // 7. Write back in chunks (max 500 per batch)
  const allActivities = [...enrichedExisting, ...dummyActivities];
  const chunkSize = 450;
  for (let i = 0; i < allActivities.length; i += chunkSize) {
      const chunk = allActivities.slice(i, i + chunkSize);
      const batch = writeBatch(firestore);
      chunk.forEach(act => {
          const docRef = ('id' in act) ? doc(firestore, 'activities', (act as any).id) : doc(collection(firestore, 'activities'));
          batch.set(docRef, act);
      });
      await batch.commit();
  }

  return allActivities.length;
}

export async function seedPdfForms(firestore: Firestore): Promise<number> {
    await clearCollection(firestore, 'pdfs');
    const batch = writeBatch(firestore);
    const pdfsCol = collection(firestore, 'pdfs');
    
    const samplePdfs: Omit<PDFForm, 'id'>[] = [
        {
            name: 'Enrollment Agreement 2024',
            publicTitle: 'GIS Enrollment Agreement',
            slug: 'gis-enrollment-2024',
            originalFileName: 'enrollment.pdf',
            storagePath: 'seed/enrollment.pdf',
            downloadUrl: 'https://smartsapp.com/downloads/enrollment.pdf',
            status: 'published',
            createdBy: 'system',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            backgroundPattern: 'none',
            backgroundColor: '#F1F5F9',
            patternColor: '#3B5FFF',
            fields: [
                { id: 'fld_name', type: 'text', label: 'Student Full Name', pageNumber: 1, position: { x: 10, y: 20 }, dimensions: { width: 40, height: 4 }, fontSize: 12, required: true },
                { id: 'fld_sig', type: 'signature', label: 'Parent Signature', pageNumber: 1, position: { x: 60, y: 80 }, dimensions: { width: 30, height: 10 }, required: true }
            ],
            namingFieldId: 'fld_name',
            displayFieldIds: ['fld_name']
        }
    ];

    samplePdfs.forEach(pdf => {
        batch.set(doc(pdfsCol), pdf);
    });

    await batch.commit();
    return samplePdfs.length;
}

export async function seedMessaging(firestore: Firestore): Promise<number> {
    await clearCollection(firestore, 'sender_profiles');
    await clearCollection(firestore, 'message_styles');
    await clearCollection(firestore, 'message_templates');

    const batch = writeBatch(firestore);

    // 1. Sender Profiles - Updated Branded Names
    const profilesCol = collection(firestore, 'sender_profiles');
    const profiles = [
        { name: 'SmartSapp Info', channel: 'sms', identifier: 'SMARTSAPP', isDefault: true, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { name: 'SmartSapp Onboarding', channel: 'email', identifier: 'onboarding@enroll.smartsapp.com', isDefault: true, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ];
    profiles.forEach(p => batch.set(doc(profilesCol), p));

    // 2. Message Styles
    const stylesCol = collection(firestore, 'message_styles');
    const styleData = {
        name: 'Classic Branded',
        htmlWrapper: '<html><body style="font-family: sans-serif; padding: 40px; background: #f8fafc;"><div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; border: 1px solid #e2e8f0;">{{content}}</div></body></html>',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    const styleRef = doc(stylesCol);
    batch.set(styleRef, styleData);

    // 3. Templates
    const templatesCol = collection(firestore, 'message_templates');
    const templates = [
        {
            name: 'Meeting Invitation',
            category: 'meetings',
            channel: 'email',
            subject: 'Join our upcoming {{meeting_type}} session',
            body: '<h1>Hello!</h1><p>You are invited to the {{meeting_type}} for {{school_name}}.</p><p>Date: {{date}} at {{time}}</p><p>Link: {{link}}</p>',
            styleId: styleRef.id,
            variables: ['meeting_type', 'school_name', 'date', 'time', 'link'],
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    ];
    templates.forEach(t => batch.set(doc(templatesCol), t));

    await batch.commit();
    return profiles.length + 1 + templates.length;
}

export async function seedMessageLogs(firestore: Firestore): Promise<number> {
  await clearCollection(firestore, 'message_logs');
  const batch = writeBatch(firestore);
  const logsCol = collection(firestore, 'message_logs');

  const schoolsSnap = await getDocs(collection(firestore, 'schools'));
  const templatesSnap = await getDocs(collection(firestore, 'message_templates'));
  const profilesSnap = await getDocs(collection(firestore, 'sender_profiles'));

  if (templatesSnap.empty || profilesSnap.empty) return 0;

  const schools = schoolsSnap.docs.map(d => ({ id: d.id, ...d.data() } as School));
  const templates = templatesSnap.docs.map(d => ({ id: d.id, ...d.data() } as MessageTemplate));
  const profiles = profilesSnap.docs.map(d => ({ id: d.id, ...d.data() } as SenderProfile));

  let count = 0;
  // Create 30 logs
  for (let i = 0; i < 30; i++) {
    const template = templates[i % templates.length];
    const profile = profiles.find(p => p.channel === template.channel) || profiles[0];
    const school = schools.length > 0 ? schools[i % schools.length] : null;
    
    const sentAt = subDays(new Date(), i % 10).toISOString();
    const status = i % 10 === 0 ? 'failed' : (i % 15 === 0 ? 'scheduled' : 'sent');
    
    const log: Omit<MessageLog, 'id'> = {
      title: template.name,
      templateId: template.id,
      templateName: template.name,
      senderProfileId: profile.id,
      senderName: profile.name,
      channel: template.channel,
      recipient: template.channel === 'email' ? (school?.email || `user${i}@example.com`) : (school?.phone || `02400000${i}`),
      subject: template.channel === 'email' ? (template.subject || 'Notification') : undefined,
      body: template.body,
      status: status as any,
      sentAt,
      variables: { school_name: school?.name || 'SmartSapp' },
      schoolId: school?.id || null,
      providerId: `prov_${Math.random().toString(36).substr(2, 9)}`,
      providerStatus: status === 'sent' ? 'delivered' : (status === 'failed' ? 'rejected' : 'queued'),
      openedCount: template.channel === 'email' && status === 'sent' ? Math.floor(Math.random() * 5) : 0,
      clickedCount: template.channel === 'email' && status === 'sent' ? Math.floor(Math.random() * 2) : 0,
    };

    batch.set(doc(logsCol), log);
    count++;
  }

  await batch.commit();
  return count;
}

export async function seedTasks(firestore: Firestore): Promise<number> {
    await clearCollection(firestore, 'tasks');
    const batch = writeBatch(firestore);
    const tasksCol = collection(firestore, 'tasks');

    const schoolsSnap = await getDocs(collection(firestore, 'schools'));
    const usersSnap = await getDocs(query(collection(firestore, 'users'), where('isAuthorized', '==', true)));

    if (schoolsSnap.empty || usersSnap.empty) return 0;

    const schools = schoolsSnap.docs.map(d => ({ id: d.id, ...d.data() } as School));
    const users = usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile));

    const priorities: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
    const categories: TaskCategory[] = ['call', 'visit', 'document', 'training', 'general'];
    const statuses: TaskStatus[] = ['todo', 'in_progress', 'waiting', 'review', 'done'];

    let count = 0;
    schools.forEach((school, i) => {
        for (let j = 0; j < 2; j++) {
            const user = users[i % users.length];
            const priority = priorities[(i + j) % priorities.length];
            const category = categories[(i + j * 2) % categories.length];
            const status = j === 0 ? 'todo' : (i % 3 === 0 ? 'done' : 'in_progress');
            
            let dueDate = new Date();
            if (i % 3 === 0) dueDate = subDays(new Date(), 2); 
            else if (i % 3 === 1) dueDate = new Date(); 
            else dueDate = addDays(new Date(), 5); 

            const task: any = {
                title: `${category.charAt(0).toUpperCase() + category.slice(1)}: ${school.name} protocol`,
                description: `Complete the ${category} phase for the onboarding workflow at ${school.name}. Ensure all focal persons are briefed.`,
                priority,
                status,
                category,
                track: school.track || 'onboarding',
                schoolId: school.id,
                schoolName: school.name,
                assignedTo: user.id,
                assignedToName: user.name,
                dueDate: dueDate.toISOString(),
                reminders: [],
                reminderSent: false,
                source: 'manual',
                createdAt: subDays(new Date(), 5).toISOString(),
                updatedAt: new Date().toISOString()
            };

            if (status === 'done') {
                task.completedAt = new Date().toISOString();
            }

            batch.set(doc(tasksCol), task);
            count++;
        }
    });

    await batch.commit();
    return count;
}

export async function seedBillingData(firestore: Firestore): Promise<number> {
    await clearCollection(firestore, 'subscription_packages');
    await clearCollection(firestore, 'billing_periods');
    
    const batch = writeBatch(firestore);

    // 1. Packages
    const pkgCol = collection(firestore, 'subscription_packages');
    defaultPackages.forEach(pkg => batch.set(doc(pkgCol), pkg));

    // 2. Periods
    const periodCol = collection(firestore, 'billing_periods');
    const currentPeriod = {
        name: 'Term 1 (2026)',
        startDate: new Date('2026-01-05').toISOString(),
        endDate: new Date('2026-04-15').toISOString(),
        invoiceDate: new Date('2026-01-12').toISOString(),
        paymentDueDate: new Date('2026-03-20').toISOString(),
        status: 'open'
    };
    batch.set(doc(periodCol), currentPeriod);

    // 3. Settings
    const settingsCol = collection(firestore, 'billing_settings');
    const globalSettings: BillingSettings = {
        levyPercent: 5,
        vatPercent: 15,
        defaultDiscount: 0,
        paymentInstructions: 'Please make all payments (cheque/cash/bank transfer) into our Fidelity GH¢ Account.',
        signatureName: 'Director of Finance',
        signatureDesignation: 'Finance Dept, SmartSapp',
    };
    batch.set(doc(settingsCol, 'global'), globalSettings);

    await batch.commit();
    return defaultPackages.length + 2;
}
