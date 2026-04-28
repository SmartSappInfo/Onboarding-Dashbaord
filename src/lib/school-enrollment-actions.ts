/**
 * School Enrollment Industry Server Actions
 * 
 * Implements server actions for School Enrollment-specific collections:
 * - Application Management (Requirements 4.7)
 * - Enrollment Management (Requirements 4.8)
 * - School Visit Management (Requirements 4.9)
 * 
 * All actions validate workspace.industry === 'SchoolEnrollment' before writing.
 */

'use server';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  arrayUnion,
} from 'firebase/firestore';
import { firestore as db } from '@/firebase/config';
import type {
  Application,
  Enrollment,
  SchoolVisit,
  Workspace,
  Entity,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates that a workspace is scoped to the SchoolEnrollment industry.
 * Throws an error if the workspace is not SchoolEnrollment.
 */
async function validateSchoolEnrollmentWorkspace(workspaceId: string): Promise<Workspace> {
  const workspaceRef = doc(db, 'workspaces', workspaceId);
  const workspaceSnap = await getDoc(workspaceRef);

  if (!workspaceSnap.exists()) {
    throw new Error(`Workspace ${workspaceId} not found`);
  }

  const workspace = { id: workspaceSnap.id, ...workspaceSnap.data() } as Workspace;

  if (workspace.industry !== 'SchoolEnrollment') {
    throw new Error(
      `This action is only available for SchoolEnrollment workspaces. Current workspace industry: ${workspace.industry}`
    );
  }

  return workspace;
}

/**
 * Updates an entity's industry data to include a new collection reference ID.
 */
async function addCollectionReferenceToEntity(
  entityId: string,
  collectionField: 'applicationIds' | 'enrollmentIds' | 'schoolVisitIds',
  referenceId: string
): Promise<void> {
  const entityRef = doc(db, 'entities', entityId);
  const entitySnap = await getDoc(entityRef);

  if (!entitySnap.exists()) {
    throw new Error(`Entity ${entityId} not found`);
  }

  const entity = { id: entitySnap.id, ...entitySnap.data() } as Entity;

  // Initialize industryData if it doesn't exist
  const industryData = entity.industryData || {
    industry: 'SchoolEnrollment',
    entityType: 'institution',
    gradeOfferings: [],
    academicYear: new Date().getFullYear().toString(),
  };

  // Add the reference ID to the appropriate array
  const updatedIndustryData = {
    ...industryData,
    [collectionField]: arrayUnion(referenceId),
  };

  await updateDoc(entityRef, {
    industryData: updatedIndustryData,
    updatedAt: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Application Management (Requirement 4.7)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateApplicationParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  familyId?: string;
  studentName: string;
  gradeApplying: string;
  applicationStatus?: Application['applicationStatus'];
  submittedAt?: string; // ISO date string
}

/**
 * Creates a new application record for a School Enrollment entity.
 * Updates the entity's applicationIds array.
 * 
 * @throws Error if workspace is not SchoolEnrollment industry
 */
export async function createApplication(params: CreateApplicationParams): Promise<Application> {
  const {
    organizationId,
    workspaceId,
    entityId,
    familyId,
    studentName,
    gradeApplying,
    applicationStatus = 'submitted',
    submittedAt,
  } = params;

  // Validate workspace is SchoolEnrollment
  await validateSchoolEnrollmentWorkspace(workspaceId);

  const now = new Date().toISOString();

  const applicationData: Omit<Application, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    familyId,
    studentName,
    gradeApplying,
    applicationStatus,
    submittedAt: submittedAt || now,
    createdAt: now,
    updatedAt: now,
  };

  const applicationsRef = collection(db, 'applications');
  const docRef = await addDoc(applicationsRef, applicationData);

  // Update entity's applicationIds array
  await addCollectionReferenceToEntity(entityId, 'applicationIds', docRef.id);

  return {
    id: docRef.id,
    ...applicationData,
  };
}

/**
 * Updates the status of an application.
 * If status changes to 'accepted', 'rejected', or 'waitlisted', sets reviewedAt timestamp.
 * 
 * @throws Error if workspace is not SchoolEnrollment industry
 */
export async function updateApplicationStatus(
  applicationId: string,
  status: Application['applicationStatus']
): Promise<void> {
  const applicationRef = doc(db, 'applications', applicationId);
  const applicationSnap = await getDoc(applicationRef);

  if (!applicationSnap.exists()) {
    throw new Error(`Application ${applicationId} not found`);
  }

  const application = { id: applicationSnap.id, ...applicationSnap.data() } as Application;

  // Validate workspace is SchoolEnrollment
  await validateSchoolEnrollmentWorkspace(application.workspaceId);

  const now = new Date().toISOString();
  const updates: Partial<Application> = {
    applicationStatus: status,
    updatedAt: now,
  };

  // If status is being changed to a reviewed state, set reviewedAt timestamp
  if (
    (status === 'accepted' || status === 'rejected' || status === 'waitlisted') &&
    !application.reviewedAt
  ) {
    updates.reviewedAt = now;
  }

  await updateDoc(applicationRef, updates);
}

/**
 * Retrieves all applications for a specific entity.
 */
export async function getApplicationsForEntity(entityId: string, workspaceId: string): Promise<Application[]> {
  const applicationsRef = collection(db, 'applications');
  const q = query(
    applicationsRef,
    where('workspaceId', '==', workspaceId),
    where('entityId', '==', entityId),
    orderBy('submittedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Application[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Enrollment Management (Requirement 4.8)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateEnrollmentParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  familyId?: string;
  studentName: string;
  grade: string;
  academicYear: string;
  enrollmentStatus?: Enrollment['enrollmentStatus'];
  enrollmentDate?: string; // ISO date string
}

/**
 * Creates a new enrollment record for a School Enrollment entity.
 * Updates the entity's enrollmentIds array.
 * 
 * @throws Error if workspace is not SchoolEnrollment industry
 */
export async function createEnrollment(params: CreateEnrollmentParams): Promise<Enrollment> {
  const {
    organizationId,
    workspaceId,
    entityId,
    familyId,
    studentName,
    grade,
    academicYear,
    enrollmentStatus = 'enrolled',
    enrollmentDate,
  } = params;

  // Validate workspace is SchoolEnrollment
  await validateSchoolEnrollmentWorkspace(workspaceId);

  const now = new Date().toISOString();

  const enrollmentData: Omit<Enrollment, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    familyId,
    studentName,
    grade,
    academicYear,
    enrollmentStatus,
    enrollmentDate: enrollmentDate || now,
    createdAt: now,
    updatedAt: now,
  };

  const enrollmentsRef = collection(db, 'enrollments');
  const docRef = await addDoc(enrollmentsRef, enrollmentData);

  // Update entity's enrollmentIds array
  await addCollectionReferenceToEntity(entityId, 'enrollmentIds', docRef.id);

  return {
    id: docRef.id,
    ...enrollmentData,
  };
}

/**
 * Updates the status of an enrollment.
 * 
 * @throws Error if workspace is not SchoolEnrollment industry
 */
export async function updateEnrollmentStatus(
  enrollmentId: string,
  status: Enrollment['enrollmentStatus']
): Promise<void> {
  const enrollmentRef = doc(db, 'enrollments', enrollmentId);
  const enrollmentSnap = await getDoc(enrollmentRef);

  if (!enrollmentSnap.exists()) {
    throw new Error(`Enrollment ${enrollmentId} not found`);
  }

  const enrollment = { id: enrollmentSnap.id, ...enrollmentSnap.data() } as Enrollment;

  // Validate workspace is SchoolEnrollment
  await validateSchoolEnrollmentWorkspace(enrollment.workspaceId);

  await updateDoc(enrollmentRef, {
    enrollmentStatus: status,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Retrieves all enrollments for a specific entity.
 */
export async function getEnrollmentsForEntity(entityId: string, workspaceId: string): Promise<Enrollment[]> {
  const enrollmentsRef = collection(db, 'enrollments');
  const q = query(
    enrollmentsRef,
    where('workspaceId', '==', workspaceId),
    where('entityId', '==', entityId),
    orderBy('enrollmentDate', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Enrollment[];
}

// ─────────────────────────────────────────────────────────────────────────────
// School Visit Management (Requirement 4.9)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateSchoolVisitParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  familyId?: string;
  visitDate: string; // ISO date string
  visitType: SchoolVisit['visitType'];
  status?: SchoolVisit['status'];
  attendees?: string[];
}

/**
 * Creates a new school visit record for a School Enrollment entity.
 * Updates the entity's schoolVisitIds array.
 * 
 * @throws Error if workspace is not SchoolEnrollment industry
 */
export async function createSchoolVisit(params: CreateSchoolVisitParams): Promise<SchoolVisit> {
  const {
    organizationId,
    workspaceId,
    entityId,
    familyId,
    visitDate,
    visitType,
    status = 'scheduled',
    attendees,
  } = params;

  // Validate workspace is SchoolEnrollment
  await validateSchoolEnrollmentWorkspace(workspaceId);

  const now = new Date().toISOString();

  const visitData: Omit<SchoolVisit, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    familyId,
    visitDate,
    visitType,
    status,
    attendees,
    createdAt: now,
    updatedAt: now,
  };

  const visitsRef = collection(db, 'schoolVisits');
  const docRef = await addDoc(visitsRef, visitData);

  // Update entity's schoolVisitIds array
  await addCollectionReferenceToEntity(entityId, 'schoolVisitIds', docRef.id);

  return {
    id: docRef.id,
    ...visitData,
  };
}

/**
 * Updates the status of a school visit.
 * 
 * @throws Error if workspace is not SchoolEnrollment industry
 */
export async function updateVisitStatus(
  visitId: string,
  status: SchoolVisit['status']
): Promise<void> {
  const visitRef = doc(db, 'schoolVisits', visitId);
  const visitSnap = await getDoc(visitRef);

  if (!visitSnap.exists()) {
    throw new Error(`School visit ${visitId} not found`);
  }

  const visit = { id: visitSnap.id, ...visitSnap.data() } as SchoolVisit;

  // Validate workspace is SchoolEnrollment
  await validateSchoolEnrollmentWorkspace(visit.workspaceId);

  await updateDoc(visitRef, {
    status,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Retrieves all school visits for a specific entity.
 */
export async function getSchoolVisitsForEntity(entityId: string, workspaceId: string): Promise<SchoolVisit[]> {
  const visitsRef = collection(db, 'schoolVisits');
  const q = query(
    visitsRef,
    where('workspaceId', '==', workspaceId),
    where('entityId', '==', entityId),
    orderBy('visitDate', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as SchoolVisit[];
}
