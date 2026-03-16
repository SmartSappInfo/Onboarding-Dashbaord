
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
 * MIGRATION PROTOCOL: Role Alignment
 */
export async function enrichRolesWithWorkspaces(firestore: Firestore): Promise<number> {
    const rolesSnap = await getDocs(collection(firestore, 'roles'));
    const batch = writeBatch(firestore);
    const backupBatch = writeBatch(firestore);
    const timestamp = new Date().toISOString();
    
    // Safety Snapshot
    rolesSnap.forEach(docSnap => {
        const backupRef = doc(firestore, 'backup_roles_migration', docSnap.id);
        backupBatch.set(backupRef, docSnap.data());
    });
    await backupBatch.commit();

    let count = 0;
    rolesSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.workspaceIds || data.workspaceIds.length === 0) {
            batch.update(docSnap.ref, {
                workspaceIds: ['onboarding'],
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
        const originalRef = doc(firestore, 'roles', docSnap.id);
        batch.set(originalRef, docSnap.data());
        count++;
    });
    await batch.commit();
    return count;
}

export async function seedBillingData(firestore: Firestore): Promise<number> {
    const batch = writeBatch(firestore);
    const timestamp = new Date().toISOString();

    // 1. Global Settings
    const settingsRef = doc(firestore, 'billing_settings', 'global');
    const settings: BillingSettings = {
        id: 'global',
        levyPercent: 5,
        vatPercent: 15,
        defaultDiscount: 0,
        paymentInstructions: 'Account Name: SmartSapp Services\nBank: Fidelity Bank Ghana\nAccount Number: 1050349221014\nBranch: Ridge, Accra\n\nPlease use the Invoice Number as the payment reference.',
        signatureName: 'Joseph Aidoo',
        signatureDesignation: 'Director of Finance',
        signatureUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/media%2Fimage%2Fsignature-sample.png?alt=media'
    };
    batch.set(settingsRef, settings);

    // 2. Subscription Packages
    const pkgCol = collection(firestore, 'subscription_packages');
    const packages: Partial<SubscriptionPackage>[] = [
        { name: 'Starter Hub', description: 'Essential communication and attendance for small campuses.', ratePerStudent: 45.00, billingTerm: 'term', currency: 'GHS', isActive: true },
        { name: 'Professional Suite', description: 'Advanced billing and results management for growing schools.', ratePerStudent: 85.00, billingTerm: 'term', currency: 'GHS', isActive: true },
        { name: 'Elite Enterprise', description: 'Full institutional logic, drone footage, and priority support.', ratePerStudent: 125.00, billingTerm: 'term', currency: 'GHS', isActive: true }
    ];

    const packageIds: string[] = [];
    packages.forEach(p => {
        const ref = doc(pkgCol);
        batch.set(ref, p);
        packageIds.push(ref.id);
    });

    // 3. Billing Periods
    const periodCol = collection(firestore, 'billing_periods');
    const periods: Partial<BillingPeriod>[] = [
        { 
            name: 'Term 1 (Jan - Apr 2026)', 
            startDate: new Date('2026-01-01').toISOString(), 
            endDate: new Date('2026-04-30').toISOString(), 
            invoiceDate: new Date('2026-01-15').toISOString(), 
            paymentDueDate: new Date('2026-02-15').toISOString(), 
            status: 'open' 
        },
        { 
            name: 'Term 3 (Sept - Dec 2025)', 
            startDate: new Date('2025-09-01').toISOString(), 
            endDate: new Date('2025-12-31').toISOString(), 
            invoiceDate: new Date('2025-09-15').toISOString(), 
            paymentDueDate: new Date('2025-10-15').toISOString(), 
            status: 'closed' 
        }
    ];

    const periodIds: string[] = [];
    periods.forEach(p => {
        const ref = doc(periodCol);
        batch.set(ref, p);
        periodIds.push(ref.id);
    });

    // 4. Sample Invoices for Existing Schools
    const schoolsSnap = await getDocs(query(collection(firestore, 'schools'), limit(10)));
    const invoiceCol = collection(firestore, 'invoices');
    let invoiceCount = 0;

    schoolsSnap.forEach((schoolDoc, idx) => {
        const school = schoolDoc.data() as School;
        const pkgIdx = idx % packages.length;
        const selectedPkg = packages[pkgIdx];
        const nominalRoll = school.nominalRoll || 250;
        const rate = school.subscriptionRate || selectedPkg.ratePerStudent || 45;
        const subtotal = nominalRoll * rate;
        const levy = (subtotal * 0.05);
        const vat = (subtotal * 0.15);
        const total = subtotal + levy + vat;

        const invRef = doc(invoiceCol);
        const invData: Omit<Invoice, 'id'> = {
            invoiceNumber: `INV-2026-${1000 + idx}`,
            schoolId: schoolDoc.id,
            schoolName: school.name,
            periodId: periodIds[0],
            periodName: periods[0].name!,
            nominalRoll,
            packageId: packageIds[pkgIdx],
            packageName: selectedPkg.name!,
            ratePerStudent: rate,
            currency: school.currency || 'GHS',
            subtotal,
            discount: 0,
            levyAmount: levy,
            vatAmount: vat,
            arrearsAdded: 0,
            creditDeducted: 0,
            totalPayable: total,
            status: idx % 2 === 0 ? 'paid' : 'sent',
            items: [{
                name: `SmartSapp Subscription (${selectedPkg.name})`,
                description: `Billing for ${nominalRoll} students at ${rate} per term.`,
                quantity: nominalRoll,
                unitPrice: rate,
                amount: subtotal
            }],
            paymentInstructions: settings.paymentInstructions,
            signatureName: settings.signatureName,
            signatureDesignation: settings.signatureDesignation,
            signatureUrl: settings.signatureUrl,
            createdAt: timestamp,
            updatedAt: timestamp,
            sentAt: timestamp
        };
        batch.set(invRef, invData);
        invoiceCount++;
    });

    await batch.commit();
    return invoiceCount;
}

/**
 * MIGRATION PROTOCOL: Media Asset Enrichment
 */
export async function enrichMediaWithWorkspace(firestore: Firestore): Promise<number> {
    const mediaSnap = await getDocs(collection(firestore, 'media'));
    const batch = writeBatch(firestore);
    const backupBatch = writeBatch(firestore);
    const timestamp = new Date().toISOString();
    
    // Safety Snapshot
    mediaSnap.forEach(docSnap => {
        const backupRef = doc(firestore, 'backup_media_migration', docSnap.id);
        backupBatch.set(backupRef, docSnap.data());
    });
    await backupBatch.commit();

    let count = 0;
    mediaSnap.forEach(docSnap => {
        const data = docSnap.data();
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

export async function rollbackMediaMigration(firestore: Firestore): Promise<number> {
    const backupSnap = await getDocs(collection(firestore, 'backup_media_migration'));
    const batch = writeBatch(firestore);
    let count = 0;
    backupSnap.forEach(docSnap => {
        const originalRef = doc(firestore, 'media', docSnap.id);
        batch.set(originalRef, docSnap.data());
        count++;
    });
    await batch.commit();
    return count;
}

/**
 * MIGRATION PROTOCOL: Task Enrichment
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
                workspaceId: 'onboarding',
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
        const originalRef = doc(firestore, 'tasks', docSnap.id);
        batch.set(originalRef, docSnap.data());
        count++;
    });
    await batch.commit();
    return count;
}

/**
 * MIGRATION PROTOCOL: Automation Enrichment
 */
export async function enrichAutomationsWithWorkspace(firestore: Firestore): Promise<number> {
    const autoSnap = await getDocs(collection(firestore, 'automations'));
    const batch = writeBatch(firestore);
    const backupBatch = writeBatch(firestore);
    const timestamp = new Date().toISOString();
    
    // Backup existing state
    autoSnap.forEach(docSnap => {
        const backupRef = doc(firestore, 'backup_automations_migration', docSnap.id);
        backupBatch.set(backupRef, docSnap.data());
    });
    await backupBatch.commit();

    let count = 0;
    autoSnap.forEach(docSnap => {
        const data = docSnap.data();
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

export async function rollbackAutomationsMigration(firestore: Firestore): Promise<number> {
    const backupSnap = await getDocs(collection(firestore, 'backup_automations_migration'));
    const batch = writeBatch(firestore);
    let count = 0;
    backupSnap.forEach(docSnap => {
        const originalRef = doc(firestore, 'automations', docSnap.id);
        batch.set(originalRef, docSnap.data());
        count++;
    });
    await batch.commit();
    return count;
}

export async function enrichSchoolStatuses(firestore: Firestore): Promise<number> {
    const schoolsSnap = await getDocs(collection(firestore, 'schools'));
    const batch = writeBatch(firestore);
    let count = 0;
    schoolsSnap.forEach(docSnap => {
        const data = docSnap.data();
        const stageName = data.stage?.name || '';
        const newStatus = stageName.toLowerCase().includes('support') ? 'Active' : 'Onboarding';
        batch.update(docSnap.ref, { schoolStatus: newStatus, updatedAt: new Date().toISOString() });
        count++;
    });
    await batch.commit();
    return count;
}

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
export async function seedRolesAndPermissions(firestore: Firestore) { return 0; }
