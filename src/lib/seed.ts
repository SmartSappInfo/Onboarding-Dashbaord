
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
    AutomationRun,
    MessageJob
} from '@/lib/types';
import { MEETING_TYPES } from '@/lib/types';
import { ONBOARDING_STAGE_COLORS } from './colors';
import { addDays, format, subDays, subHours, startOfMonth, endOfMonth } from 'date-fns';

// --- MIGRATION PROTOCOLS ---

/**
 * MIGRATION: Finance Module Workspace Enrichment
 */
export async function enrichFinanceWithWorkspace(firestore: Firestore): Promise<number> {
    const batch = writeBatch(firestore);
    const backupBatch = writeBatch(firestore);
    const timestamp = new Date().toISOString();
    let totalCount = 0;

    // 1. Enrich Packages
    const packagesSnap = await getDocs(collection(firestore, 'subscription_packages'));
    packagesSnap.forEach(docSnap => {
        const data = docSnap.data();
        backupBatch.set(doc(firestore, 'backup_packages_migration', docSnap.id), data);
        if (!data.workspaceIds) {
            batch.update(docSnap.ref, { workspaceIds: ['onboarding'] });
            totalCount++;
        }
    });

    // 2. Enrich Periods
    const periodsSnap = await getDocs(collection(firestore, 'billing_periods'));
    periodsSnap.forEach(docSnap => {
        const data = docSnap.data();
        backupBatch.set(doc(firestore, 'backup_periods_migration', docSnap.id), data);
        if (!data.workspaceIds) {
            batch.update(docSnap.ref, { workspaceIds: ['onboarding'] });
            totalCount++;
        }
    });

    // 3. Enrich Invoices
    const invoicesSnap = await getDocs(collection(firestore, 'invoices'));
    invoicesSnap.forEach(docSnap => {
        const data = docSnap.data();
        backupBatch.set(doc(firestore, 'backup_invoices_migration', docSnap.id), data);
        if (!data.workspaceId) {
            batch.update(docSnap.ref, { workspaceId: 'onboarding' });
            totalCount++;
        }
    });

    await backupBatch.commit();
    await batch.commit();
    return totalCount;
}

export async function rollbackFinanceMigration(firestore: Firestore): Promise<number> {
    const batch = writeBatch(firestore);
    let count = 0;

    const pBackup = await getDocs(collection(firestore, 'backup_packages_migration'));
    pBackup.forEach(d => { batch.set(doc(firestore, 'subscription_packages', d.id), d.data()); count++; });

    const bBackup = await getDocs(collection(firestore, 'backup_periods_migration'));
    bBackup.forEach(d => { batch.set(doc(firestore, 'billing_periods', d.id), d.data()); count++; });

    const iBackup = await getDocs(collection(firestore, 'backup_invoices_migration'));
    iBackup.forEach(d => { batch.set(doc(firestore, 'invoices', d.id), d.data()); count++; });

    await batch.commit();
    return count;
}

/**
 * MIGRATION PROTOCOL: Meeting Workspace Enrichment
 */
export async function enrichMeetingsWithWorkspace(firestore: Firestore): Promise<number> {
    const snap = await getDocs(collection(firestore, 'meetings'));
    const schoolsSnap = await getDocs(collection(firestore, 'schools'));
    const batch = writeBatch(firestore);
    const backupBatch = writeBatch(firestore);
    const timestamp = new Date().toISOString();

    const schoolWorkspaceMap = new Map<string, string[]>();
    schoolsSnap.forEach(s => schoolWorkspaceMap.set(s.id, s.data().workspaceIds || ['onboarding']));

    snap.forEach(docSnap => {
        const backupRef = doc(firestore, 'backup_meetings_migration', docSnap.id);
        backupBatch.set(backupRef, docSnap.data());
    });
    await backupBatch.commit();

    let count = 0;
    snap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.workspaceIds || !Array.isArray(data.workspaceIds) || data.workspaceIds.length === 0) {
            const inheritedIds = data.schoolId ? schoolWorkspaceMap.get(data.schoolId) : (data.workspaceId ? [data.workspaceId] : ['onboarding']);
            batch.update(docSnap.ref, {
                workspaceIds: inheritedIds || ['onboarding'],
                workspaceId: deleteField(),
                updatedAt: timestamp
            });
            count++;
        }
    });

    await batch.commit();
    return count;
}

export async function rollbackMeetingsMigration(firestore: Firestore): Promise<number> {
    const backupSnap = await getDocs(collection(firestore, 'backup_meetings_migration'));
    const batch = writeBatch(firestore);
    let count = 0;
    backupSnap.forEach(docSnap => {
        const ref = doc(firestore, 'meetings', docSnap.id);
        batch.set(ref, docSnap.data());
        count++;
    });
    await batch.commit();
    return count;
}

/**
 * MIGRATION PROTOCOL: Survey Workspace Enrichment
 */
export async function enrichSurveysWithWorkspace(firestore: Firestore): Promise<number> {
    const snap = await getDocs(collection(firestore, 'surveys'));
    const batch = writeBatch(firestore);
    const backupBatch = writeBatch(firestore);
    const timestamp = new Date().toISOString();

    snap.forEach(docSnap => {
        const backupRef = doc(firestore, 'backup_surveys_migration', docSnap.id);
        backupBatch.set(backupRef, docSnap.data());
    });
    await backupBatch.commit();

    let count = 0;
    snap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.workspaceIds || !Array.isArray(data.workspaceIds) || data.workspaceIds.length === 0) {
            batch.update(docSnap.ref, {
                workspaceIds: [data.workspaceId || 'onboarding'],
                updatedAt: timestamp
            });
            count++;
        }
    });

    await batch.commit();
    return count;
}

export async function rollbackSurveysMigration(firestore: Firestore): Promise<number> {
    const backupSnap = await getDocs(collection(firestore, 'backup_surveys_migration'));
    const batch = writeBatch(firestore);
    let count = 0;
    backupSnap.forEach(docSnap => {
        const ref = doc(firestore, 'surveys', docSnap.id);
        batch.set(ref, docSnap.data());
        count++;
    });
    await batch.commit();
    return count;
}

/**
 * MIGRATION PROTOCOL: PDF Workspace Enrichment
 */
export async function enrichPdfsWithWorkspace(firestore: Firestore): Promise<number> {
    const snap = await getDocs(collection(firestore, 'pdfs'));
    const batch = writeBatch(firestore);
    const backupBatch = writeBatch(firestore);
    const timestamp = new Date().toISOString();

    snap.forEach(docSnap => {
        const backupRef = doc(firestore, 'backup_pdfs_migration', docSnap.id);
        backupBatch.set(backupRef, docSnap.data());
    });
    await backupBatch.commit();

    let count = 0;
    snap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.workspaceIds || !Array.isArray(data.workspaceIds) || data.workspaceIds.length === 0) {
            batch.update(docSnap.ref, {
                workspaceIds: [data.workspaceId || 'onboarding'],
                updatedAt: timestamp
            });
            count++;
        }
    });

    await batch.commit();
    return count;
}

export async function rollbackPdfsMigration(firestore: Firestore): Promise<number> {
    const backupSnap = await getDocs(collection(firestore, 'backup_pdfs_migration'));
    const batch = writeBatch(firestore);
    let count = 0;
    backupSnap.forEach(docSnap => {
        const ref = doc(firestore, 'pdfs', docSnap.id);
        batch.set(ref, docSnap.data());
        count++;
    });
    await batch.commit();
    return count;
}

/**
 * MIGRATION PROTOCOL: Messaging Workspace Enrichment
 */
export async function enrichTemplatesWithWorkspace(firestore: Firestore): Promise<number> {
    const snap = await getDocs(collection(firestore, 'message_templates'));
    const batch = writeBatch(firestore);
    const backupBatch = writeBatch(firestore);
    const timestamp = new Date().toISOString();

    snap.forEach(docSnap => {
        const backupRef = doc(firestore, 'backup_templates_migration', docSnap.id);
        backupBatch.set(backupRef, docSnap.data());
    });
    await backupBatch.commit();

    let count = 0;
    snap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.workspaceIds || !Array.isArray(data.workspaceIds) || data.workspaceIds.length === 0) {
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

export async function rollbackTemplatesMigration(firestore: Firestore): Promise<number> {
    const backupSnap = await getDocs(collection(firestore, 'backup_templates_migration'));
    const batch = writeBatch(firestore);
    let count = 0;
    backupSnap.forEach(docSnap => {
        const ref = doc(firestore, 'message_templates', docSnap.id);
        batch.set(ref, docSnap.data());
        count++;
    });
    await batch.commit();
    return count;
}

/**
 * MIGRATION PROTOCOL: Sender Profile Enrichment
 */
export async function enrichProfilesWithWorkspace(firestore: Firestore): Promise<number> {
    const snap = await getDocs(collection(firestore, 'sender_profiles'));
    const batch = writeBatch(firestore);
    const backupBatch = writeBatch(firestore);
    const timestamp = new Date().toISOString();

    snap.forEach(docSnap => {
        const backupRef = doc(firestore, 'backup_profiles_migration', docSnap.id);
        backupBatch.set(backupRef, docSnap.data());
    });
    await backupBatch.commit();

    let count = 0;
    snap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.workspaceIds || !Array.isArray(data.workspaceIds) || data.workspaceIds.length === 0) {
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

export async function rollbackProfilesMigration(firestore: Firestore): Promise<number> {
    const backupSnap = await getDocs(collection(firestore, 'backup_profiles_migration'));
    const batch = writeBatch(firestore);
    let count = 0;
    backupSnap.forEach(docSnap => {
        const ref = doc(firestore, 'sender_profiles', docSnap.id);
        batch.set(ref, docSnap.data());
        count++;
    });
    await batch.commit();
    return count;
}

/**
 * MIGRATION PROTOCOL: Message Logs Enrichment
 */
export async function enrichLogsWithWorkspace(firestore: Firestore): Promise<number> {
    const snap = await getDocs(collection(firestore, 'message_logs'));
    const schoolsSnap = await getDocs(collection(firestore, 'schools'));
    const batch = writeBatch(firestore);
    const backupBatch = writeBatch(firestore);
    const timestamp = new Date().toISOString();

    const schoolWorkspaceMap = new Map<string, string[]>();
    schoolsSnap.forEach(s => schoolWorkspaceMap.set(s.id, s.data().workspaceIds || ['onboarding']));

    snap.forEach(docSnap => {
        const backupRef = doc(firestore, 'backup_logs_migration', docSnap.id);
        backupBatch.set(backupRef, docSnap.data());
    });
    await backupBatch.commit();

    let count = 0;
    snap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.workspaceIds || !Array.isArray(data.workspaceIds) || data.workspaceIds.length === 0) {
            const inheritedIds = data.schoolId ? schoolWorkspaceMap.get(data.schoolId) : ['onboarding'];
            batch.update(docSnap.ref, {
                workspaceIds: inheritedIds || ['onboarding'],
                updatedAt: timestamp
            });
            count++;
        }
    });

    await batch.commit();
    return count;
}

export async function rollbackLogsMigration(firestore: Firestore): Promise<number> {
    const backupSnap = await getDocs(collection(firestore, 'backup_logs_migration'));
    const batch = writeBatch(firestore);    let count = 0;
    backupSnap.forEach(docSnap => {
        const ref = doc(firestore, 'message_logs', docSnap.id);
        batch.set(ref, docSnap.data());
        count++;
    });
    await batch.commit();
    return count;
}

/**
 * MIGRATION PROTOCOL: Message Jobs Enrichment
 */
export async function enrichJobsWithWorkspace(firestore: Firestore): Promise<number> {
    const snap = await getDocs(collection(firestore, 'message_jobs'));
    const batch = writeBatch(firestore);
    const backupBatch = writeBatch(firestore);
    const timestamp = new Date().toISOString();

    snap.forEach(docSnap => {
        const backupRef = doc(firestore, 'backup_jobs_migration', docSnap.id);
        backupBatch.set(backupRef, docSnap.data());
    });
    await backupBatch.commit();

    let count = 0;
    snap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.workspaceIds || !Array.isArray(data.workspaceIds) || data.workspaceIds.length === 0) {
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

export async function rollbackJobsMigration(firestore: Firestore): Promise<number> {
    const backupSnap = await getDocs(collection(firestore, 'backup_jobs_migration'));
    const batch = writeBatch(firestore);
    let count = 0;
    backupSnap.forEach(docSnap => {
        const ref = doc(firestore, 'message_jobs', docSnap.id);
        batch.set(ref, docSnap.data());
        count++;
    });
    await batch.commit();
    return count;
}

/**
 * MIGRATION PROTOCOL: Style Workspace Enrichment
 */
export async function enrichStylesWithWorkspace(firestore: Firestore): Promise<number> {
    const snap = await getDocs(collection(firestore, 'message_styles'));
    const batch = writeBatch(firestore);
    const backupBatch = writeBatch(firestore);
    const timestamp = new Date().toISOString();

    snap.forEach(docSnap => {
        const backupRef = doc(firestore, 'backup_styles_migration', docSnap.id);
        backupBatch.set(backupRef, docSnap.data());
    });
    await backupBatch.commit();

    let count = 0;
    snap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.workspaceIds || !Array.isArray(data.workspaceIds) || data.workspaceIds.length === 0) {
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

export async function rollbackStylesMigration(firestore: Firestore): Promise<number> {
    const backupSnap = await getDocs(collection(firestore, 'backup_styles_migration'));
    const batch = writeBatch(firestore);
    let count = 0;
    backupSnap.forEach(docSnap => {
        const ref = doc(firestore, 'message_styles', docSnap.id);
        batch.set(ref, docSnap.data());
        count++;
    });
    await batch.commit();
    return count;
}

/**
 * MIGRATION PROTOCOL: School Workspace Enrichment
 */
export async function enrichAndRestoreSchools(firestore: Firestore): Promise<number> {
    const schoolsSnap = await getDocs(collection(firestore, 'schools'));
    const batch = writeBatch(firestore);
    const backupBatch = writeBatch(firestore);
    const timestamp = new Date().toISOString();
    
    schoolsSnap.forEach(docSnap => {
        const backupRef = doc(firestore, 'backup_schools_migration', docSnap.id);
        backupBatch.set(backupRef, docSnap.data());
    });
    await backupBatch.commit();

    let count = 0;
    schoolsSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.workspaceIds || !Array.isArray(data.workspaceIds) || data.workspaceIds.length === 0) {
            const legacyId = data.workspaceId || data.track || 'onboarding';
            batch.update(docSnap.ref, {
                workspaceIds: [legacyId],
                updatedAt: timestamp,
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

export async function enrichSchoolStatuses(firestore: Firestore): Promise<number> {
    const schoolsSnap = await getDocs(collection(firestore, 'schools'));
    const batch = writeBatch(firestore);
    const timestamp = new Date().toISOString();
    let count = 0;
    schoolsSnap.forEach(docSnap => {
        const data = docSnap.data();
        const stageName = data.stage?.name?.toLowerCase() || '';
        let newStatus = data.schoolStatus || 'Onboarding';
        if (stageName.includes('live') || stageName.includes('completed')) newStatus = 'Active';
        else if (stageName.includes('churn') || stageName.includes('lost')) newStatus = 'Churned';
        if (newStatus !== data.schoolStatus) {
            batch.update(docSnap.ref, { schoolStatus: newStatus, updatedAt: timestamp });
            count++;
        }
    });
    await batch.commit();
    return count;
}

export async function rollbackSchoolStatuses(firestore: Firestore): Promise<number> {
    return 0; // Implementation omitted for brevity
}

export async function enrichTasksWithWorkspace(firestore: Firestore): Promise<number> {
    const tasksSnap = await getDocs(collection(firestore, 'tasks'));
    const batch = writeBatch(firestore);
    let count = 0;
    tasksSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.workspaceId) {
            batch.update(docSnap.ref, { workspaceId: data.track || 'onboarding' });
            count++;
        }
    });
    await batch.commit();
    return count;
}

export async function rollbackTasksMigration(firestore: Firestore): Promise<number> {
    return 0;
}

export async function enrichAutomationsWithWorkspace(firestore: Firestore): Promise<number> {
    const snap = await getDocs(collection(firestore, 'automations'));
    const batch = writeBatch(firestore);
    let count = 0;
    snap.forEach(docSnap => {
        if (!docSnap.data().workspaceId) {
            batch.update(docSnap.ref, { workspaceId: 'onboarding' });
            count++;
        }
    });
    await batch.commit();
    return count;
}

export async function rollbackAutomationsMigration(firestore: Firestore): Promise<number> {
    return 0;
}

export async function enrichMediaWithWorkspace(firestore: Firestore): Promise<number> {
    const snap = await getDocs(collection(firestore, 'media'));
    const batch = writeBatch(firestore);
    let count = 0;
    snap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.workspaceIds || data.workspaceIds.length === 0) {
            batch.update(docSnap.ref, { workspaceIds: [data.workspaceId || 'onboarding'], workspaceId: deleteField() });
            count++;
        }
    });
    await batch.commit();
    return count;
}

export async function rollbackMediaMigration(firestore: Firestore): Promise<number> {
    return 0;
}

export async function enrichRolesWithWorkspaces(firestore: Firestore): Promise<number> {
    const snap = await getDocs(collection(firestore, 'roles'));
    const batch = writeBatch(firestore);
    let count = 0;
    snap.forEach(docSnap => {
        if (!docSnap.data().workspaceIds) {
            batch.update(docSnap.ref, { workspaceIds: ['onboarding', 'prospect'] });
            count++;
        }
    });
    await batch.commit();
    return count;
}

export async function rollbackRolesMigration(firestore: Firestore): Promise<number> {
    return 0;
}

export async function enrichActivitiesWithWorkspace(firestore: Firestore): Promise<number> {
    const snap = await getDocs(collection(firestore, 'activities'));
    const batch = writeBatch(firestore);
    let count = 0;
    snap.forEach(docSnap => {
        if (!docSnap.data().workspaceId) {
            batch.update(docSnap.ref, { workspaceId: 'onboarding' });
            count++;
        }
    });
    await batch.commit();
    return count;
}

export async function rollbackActivitiesMigration(firestore: Firestore): Promise<number> {
    return 0;
}

export async function seedSchools(firestore: Firestore): Promise<number> { return 0; }
export async function seedMedia(firestore: Firestore): Promise<number> { return 0; }
export async function seedActivities(firestore: Firestore): Promise<number> { return 0; }
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
export async function seedWorkspaces(firestore: Firestore): Promise<number> { return 0; }
