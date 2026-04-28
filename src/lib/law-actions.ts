/**
 * Law Industry Server Actions
 * 
 * Implements server actions for Law-specific collections:
 * - Matter Management (Requirements 5.8)
 * - Intake Form Management (Requirements 5.9)
 * - Conflict Check Management (Requirements 5.10)
 * - Consultation Management (Requirements 5.11)
 * - Related Party Management (Requirements 5.12)
 * - Legal Document Management (Requirements 5.13)
 * - Time Tracking (Requirements 5.14)
 * - Court Date Management (Requirements 5.15)
 * 
 * All actions validate workspace.industry === 'Law' before writing.
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
  limit,
  arrayUnion,
} from 'firebase/firestore';
import { firestore as db } from '@/firebase/config';
import type {
  Matter,
  IntakeForm,
  ConflictCheck,
  Consultation,
  RelatedParty,
  LegalDocument,
  TimeTracking,
  CourtDate,
  Workspace,
  Entity,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates that a workspace is scoped to the Law industry.
 * Throws an error if the workspace is not Law.
 */
async function validateLawWorkspace(workspaceId: string): Promise<Workspace> {
  const workspaceRef = doc(db, 'workspaces', workspaceId);
  const workspaceSnap = await getDoc(workspaceRef);

  if (!workspaceSnap.exists()) {
    throw new Error(`Workspace ${workspaceId} not found`);
  }

  const workspace = { id: workspaceSnap.id, ...workspaceSnap.data() } as Workspace;

  if (workspace.industry !== 'Law') {
    throw new Error(
      `This action is only available for Law workspaces. Current workspace industry: ${workspace.industry}`
    );
  }

  return workspace;
}

/**
 * Updates an entity's industry data to include a new collection reference ID.
 */
async function addCollectionReferenceToEntity(
  entityId: string,
  collectionField: 'matterIds' | 'intakeFormIds' | 'conflictCheckIds',
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
    industry: 'Law',
    entityType: 'institution',
    firmType: 'solo',
    practiceAreas: [],
    conflictCheckRequired: true,
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
// Matter Management (Requirement 5.8)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateMatterParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  matterNumber: string;
  matterType: string;
  practiceArea: string;
  status?: Matter['status'];
  openedDate: string; // ISO date string
}

/**
 * Creates a new matter record for a Law client entity.
 * Updates the entity's matterIds array.
 * 
 * @throws Error if workspace is not Law industry
 */
export async function createMatter(params: CreateMatterParams): Promise<Matter> {
  const {
    organizationId,
    workspaceId,
    entityId,
    matterNumber,
    matterType,
    practiceArea,
    status = 'intake',
    openedDate,
  } = params;

  // Validate workspace is Law
  await validateLawWorkspace(workspaceId);

  const now = new Date().toISOString();

  const matterData: Omit<Matter, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    matterNumber,
    matterType,
    practiceArea,
    status,
    openedDate,
    createdAt: now,
    updatedAt: now,
  };

  const mattersRef = collection(db, 'matters');
  const docRef = await addDoc(mattersRef, matterData);

  // Update entity's matterIds array
  await addCollectionReferenceToEntity(entityId, 'matterIds', docRef.id);

  return {
    id: docRef.id,
    ...matterData,
  };
}

/**
 * Updates the status of a matter.
 * If status changes to 'closed', sets closedDate to now.
 * 
 * @throws Error if workspace is not Law industry
 */
export async function updateMatterStatus(
  matterId: string,
  status: Matter['status']
): Promise<void> {
  const matterRef = doc(db, 'matters', matterId);
  const matterSnap = await getDoc(matterRef);

  if (!matterSnap.exists()) {
    throw new Error(`Matter ${matterId} not found`);
  }

  const matter = { id: matterSnap.id, ...matterSnap.data() } as Matter;

  // Validate workspace is Law
  await validateLawWorkspace(matter.workspaceId);

  const now = new Date().toISOString();
  const updates: Partial<Matter> = {
    status,
    updatedAt: now,
  };

  // If status is being changed to closed, set closedDate
  if (status === 'closed' && !matter.closedDate) {
    updates.closedDate = now;
  }

  await updateDoc(matterRef, updates);
}

/**
 * Retrieves all matters for a specific entity.
 */
export async function getMattersForEntity(entityId: string, workspaceId: string): Promise<Matter[]> {
  const mattersRef = collection(db, 'matters');
  const q = query(
    mattersRef,
    where('workspaceId', '==', workspaceId),
    where('entityId', '==', entityId),
    orderBy('openedDate', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Matter[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Intake Form Management (Requirement 5.9)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateIntakeFormParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  matterId?: string;
  formData: Record<string, unknown>;
  submittedAt?: string; // ISO date string
}

/**
 * Creates a new intake form record for a Law client entity.
 * Updates the entity's intakeFormIds array.
 * 
 * @throws Error if workspace is not Law industry
 */
export async function createIntakeForm(params: CreateIntakeFormParams): Promise<IntakeForm> {
  const { organizationId, workspaceId, entityId, matterId, formData, submittedAt } = params;

  // Validate workspace is Law
  await validateLawWorkspace(workspaceId);

  const now = new Date().toISOString();

  const intakeFormData: Omit<IntakeForm, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    matterId,
    formData,
    submittedAt: submittedAt || now,
    createdAt: now,
    updatedAt: now,
  };

  const intakeFormsRef = collection(db, 'intakeForms');
  const docRef = await addDoc(intakeFormsRef, intakeFormData);

  // Update entity's intakeFormIds array
  await addCollectionReferenceToEntity(entityId, 'intakeFormIds', docRef.id);

  return {
    id: docRef.id,
    ...intakeFormData,
  };
}

/**
 * Retrieves all intake forms for a specific entity.
 */
export async function getIntakeFormsForEntity(entityId: string, workspaceId: string): Promise<IntakeForm[]> {
  const intakeFormsRef = collection(db, 'intakeForms');
  const q = query(
    intakeFormsRef,
    where('workspaceId', '==', workspaceId),
    where('entityId', '==', entityId),
    orderBy('submittedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as IntakeForm[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Conflict Check Management (Requirement 5.10)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateConflictCheckParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  checkStatus?: ConflictCheck['checkStatus'];
  conflictDetails?: string;
  checkedBy: string;
  checkedAt?: string; // ISO date string
}

/**
 * Creates a new conflict check record for a Law client entity.
 * Updates the entity's conflictCheckIds array.
 * 
 * @throws Error if workspace is not Law industry
 */
export async function createConflictCheck(params: CreateConflictCheckParams): Promise<ConflictCheck> {
  const { organizationId, workspaceId, entityId, checkStatus = 'pending', conflictDetails, checkedBy, checkedAt } =
    params;

  // Validate workspace is Law
  await validateLawWorkspace(workspaceId);

  const now = new Date().toISOString();

  const conflictCheckData: Omit<ConflictCheck, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    checkStatus,
    conflictDetails,
    checkedBy,
    checkedAt: checkedAt || now,
    createdAt: now,
    updatedAt: now,
  };

  const conflictChecksRef = collection(db, 'conflictChecks');
  const docRef = await addDoc(conflictChecksRef, conflictCheckData);

  // Update entity's conflictCheckIds array
  await addCollectionReferenceToEntity(entityId, 'conflictCheckIds', docRef.id);

  return {
    id: docRef.id,
    ...conflictCheckData,
  };
}

/**
 * Updates the status of a conflict check.
 * 
 * @throws Error if workspace is not Law industry
 */
export async function updateConflictCheckStatus(
  conflictCheckId: string,
  checkStatus: ConflictCheck['checkStatus'],
  conflictDetails?: string
): Promise<void> {
  const conflictCheckRef = doc(db, 'conflictChecks', conflictCheckId);
  const conflictCheckSnap = await getDoc(conflictCheckRef);

  if (!conflictCheckSnap.exists()) {
    throw new Error(`Conflict check ${conflictCheckId} not found`);
  }

  const conflictCheck = { id: conflictCheckSnap.id, ...conflictCheckSnap.data() } as ConflictCheck;

  // Validate workspace is Law
  await validateLawWorkspace(conflictCheck.workspaceId);

  const updates: Partial<ConflictCheck> = {
    checkStatus,
    updatedAt: new Date().toISOString(),
  };

  if (conflictDetails !== undefined) {
    updates.conflictDetails = conflictDetails;
  }

  await updateDoc(conflictCheckRef, updates);
}

/**
 * Retrieves all conflict checks for a specific entity.
 */
export async function getConflictChecksForEntity(entityId: string, workspaceId: string): Promise<ConflictCheck[]> {
  const conflictChecksRef = collection(db, 'conflictChecks');
  const q = query(
    conflictChecksRef,
    where('workspaceId', '==', workspaceId),
    where('entityId', '==', entityId),
    orderBy('checkedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ConflictCheck[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Consultation Management (Requirement 5.11)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateConsultationParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  matterId?: string;
  consultationDate: string; // ISO date string
  status?: Consultation['status'];
  notes?: string;
}

/**
 * Creates a new consultation record for a Law client entity.
 * 
 * @throws Error if workspace is not Law industry
 */
export async function createConsultation(params: CreateConsultationParams): Promise<Consultation> {
  const { organizationId, workspaceId, entityId, matterId, consultationDate, status = 'scheduled', notes } = params;

  // Validate workspace is Law
  await validateLawWorkspace(workspaceId);

  const now = new Date().toISOString();

  const consultationData: Omit<Consultation, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    matterId,
    consultationDate,
    status,
    notes,
    createdAt: now,
    updatedAt: now,
  };

  const consultationsRef = collection(db, 'consultations');
  const docRef = await addDoc(consultationsRef, consultationData);

  return {
    id: docRef.id,
    ...consultationData,
  };
}

/**
 * Updates a consultation record.
 * 
 * @throws Error if workspace is not Law industry
 */
export async function updateConsultation(
  consultationId: string,
  updates: Partial<Omit<Consultation, 'id' | 'createdAt' | 'organizationId' | 'workspaceId' | 'entityId'>>
): Promise<void> {
  const consultationRef = doc(db, 'consultations', consultationId);
  const consultationSnap = await getDoc(consultationRef);

  if (!consultationSnap.exists()) {
    throw new Error(`Consultation ${consultationId} not found`);
  }

  const consultation = { id: consultationSnap.id, ...consultationSnap.data() } as Consultation;

  // Validate workspace is Law
  await validateLawWorkspace(consultation.workspaceId);

  await updateDoc(consultationRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Retrieves all consultations for a specific entity.
 */
export async function getConsultationsForEntity(entityId: string, workspaceId: string): Promise<Consultation[]> {
  const consultationsRef = collection(db, 'consultations');
  const q = query(
    consultationsRef,
    where('workspaceId', '==', workspaceId),
    where('entityId', '==', entityId),
    orderBy('consultationDate', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Consultation[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Related Party Management (Requirement 5.12)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateRelatedPartyParams {
  organizationId: string;
  workspaceId: string;
  matterId: string;
  name: string;
  role: string;
  contactInfo?: string;
}

/**
 * Creates a new related party record for a matter.
 * 
 * @throws Error if workspace is not Law industry
 */
export async function createRelatedParty(params: CreateRelatedPartyParams): Promise<RelatedParty> {
  const { organizationId, workspaceId, matterId, name, role, contactInfo } = params;

  // Validate workspace is Law
  await validateLawWorkspace(workspaceId);

  const now = new Date().toISOString();

  const relatedPartyData: Omit<RelatedParty, 'id'> = {
    organizationId,
    workspaceId,
    matterId,
    name,
    role,
    contactInfo,
    createdAt: now,
    updatedAt: now,
  };

  const relatedPartiesRef = collection(db, 'relatedParties');
  const docRef = await addDoc(relatedPartiesRef, relatedPartyData);

  return {
    id: docRef.id,
    ...relatedPartyData,
  };
}

/**
 * Retrieves all related parties for a specific matter.
 */
export async function getRelatedPartiesForMatter(matterId: string, workspaceId: string): Promise<RelatedParty[]> {
  const relatedPartiesRef = collection(db, 'relatedParties');
  const q = query(
    relatedPartiesRef,
    where('workspaceId', '==', workspaceId),
    where('matterId', '==', matterId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as RelatedParty[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Legal Document Management (Requirement 5.13)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateLegalDocumentParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  matterId?: string;
  documentName: string;
  documentType: string;
  storageUrl: string;
  uploadedAt?: string; // ISO date string
}

/**
 * Creates a new legal document record for a Law client entity.
 * 
 * @throws Error if workspace is not Law industry
 */
export async function createLegalDocument(params: CreateLegalDocumentParams): Promise<LegalDocument> {
  const { organizationId, workspaceId, entityId, matterId, documentName, documentType, storageUrl, uploadedAt } =
    params;

  // Validate workspace is Law
  await validateLawWorkspace(workspaceId);

  const now = new Date().toISOString();

  const legalDocumentData: Omit<LegalDocument, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    matterId,
    documentName,
    documentType,
    storageUrl,
    uploadedAt: uploadedAt || now,
    createdAt: now,
    updatedAt: now,
  };

  const legalDocumentsRef = collection(db, 'legalDocuments');
  const docRef = await addDoc(legalDocumentsRef, legalDocumentData);

  return {
    id: docRef.id,
    ...legalDocumentData,
  };
}

/**
 * Retrieves all legal documents for a specific entity.
 */
export async function getLegalDocumentsForEntity(entityId: string, workspaceId: string): Promise<LegalDocument[]> {
  const legalDocumentsRef = collection(db, 'legalDocuments');
  const q = query(
    legalDocumentsRef,
    where('workspaceId', '==', workspaceId),
    where('entityId', '==', entityId),
    orderBy('uploadedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as LegalDocument[];
}

/**
 * Retrieves all legal documents for a specific matter.
 */
export async function getLegalDocumentsForMatter(matterId: string, workspaceId: string): Promise<LegalDocument[]> {
  const legalDocumentsRef = collection(db, 'legalDocuments');
  const q = query(
    legalDocumentsRef,
    where('workspaceId', '==', workspaceId),
    where('matterId', '==', matterId),
    orderBy('uploadedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as LegalDocument[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Time Tracking (Requirement 5.14)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateTimeEntryParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  matterId: string;
  userId: string;
  hours: number;
  billableRate: number;
  description: string;
  date: string; // ISO date string
}

/**
 * Creates a new time tracking entry for a matter.
 * 
 * @throws Error if workspace is not Law industry
 * @throws Error if hours or billableRate is negative
 */
export async function createTimeEntry(params: CreateTimeEntryParams): Promise<TimeTracking> {
  const { organizationId, workspaceId, entityId, matterId, userId, hours, billableRate, description, date } = params;

  // Validate workspace is Law
  await validateLawWorkspace(workspaceId);

  // Validate numeric values
  if (hours < 0) {
    throw new Error('Hours must be a positive number');
  }
  if (billableRate < 0) {
    throw new Error('Billable rate must be a positive number');
  }

  const now = new Date().toISOString();

  const timeEntryData: Omit<TimeTracking, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    matterId,
    userId,
    hours,
    billableRate,
    description,
    date,
    createdAt: now,
    updatedAt: now,
  };

  const timeTrackingRef = collection(db, 'timeTracking');
  const docRef = await addDoc(timeTrackingRef, timeEntryData);

  return {
    id: docRef.id,
    ...timeEntryData,
  };
}

/**
 * Retrieves all time entries for a specific matter.
 */
export async function getTimeEntriesForMatter(matterId: string, workspaceId: string): Promise<TimeTracking[]> {
  const timeTrackingRef = collection(db, 'timeTracking');
  const q = query(
    timeTrackingRef,
    where('workspaceId', '==', workspaceId),
    where('matterId', '==', matterId),
    orderBy('date', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as TimeTracking[];
}

/**
 * Retrieves all time entries for a specific entity.
 */
export async function getTimeEntriesForEntity(entityId: string, workspaceId: string): Promise<TimeTracking[]> {
  const timeTrackingRef = collection(db, 'timeTracking');
  const q = query(
    timeTrackingRef,
    where('workspaceId', '==', workspaceId),
    where('entityId', '==', entityId),
    orderBy('date', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as TimeTracking[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Court Date Management (Requirement 5.15)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateCourtDateParams {
  organizationId: string;
  workspaceId: string;
  matterId: string;
  entityId: string;
  courtName?: string;
  hearingType: string;
  scheduledDate: string; // ISO date string
  status?: CourtDate['status'];
  notes?: string;
}

/**
 * Creates a new court date record for a matter.
 * 
 * @throws Error if workspace is not Law industry
 */
export async function createCourtDate(params: CreateCourtDateParams): Promise<CourtDate> {
  const {
    organizationId,
    workspaceId,
    matterId,
    entityId,
    courtName,
    hearingType,
    scheduledDate,
    status = 'upcoming',
    notes,
  } = params;

  // Validate workspace is Law
  await validateLawWorkspace(workspaceId);

  const now = new Date().toISOString();

  const courtDateData: Omit<CourtDate, 'id'> = {
    organizationId,
    workspaceId,
    matterId,
    entityId,
    courtName,
    hearingType,
    scheduledDate,
    status,
    notes,
    createdAt: now,
    updatedAt: now,
  };

  const courtDatesRef = collection(db, 'courtDates');
  const docRef = await addDoc(courtDatesRef, courtDateData);

  return {
    id: docRef.id,
    ...courtDateData,
  };
}

/**
 * Updates a court date record.
 * 
 * @throws Error if workspace is not Law industry
 */
export async function updateCourtDate(
  courtDateId: string,
  updates: Partial<Omit<CourtDate, 'id' | 'createdAt' | 'organizationId' | 'workspaceId' | 'matterId' | 'entityId'>>
): Promise<void> {
  const courtDateRef = doc(db, 'courtDates', courtDateId);
  const courtDateSnap = await getDoc(courtDateRef);

  if (!courtDateSnap.exists()) {
    throw new Error(`Court date ${courtDateId} not found`);
  }

  const courtDate = { id: courtDateSnap.id, ...courtDateSnap.data() } as CourtDate;

  // Validate workspace is Law
  await validateLawWorkspace(courtDate.workspaceId);

  await updateDoc(courtDateRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Retrieves all court dates for a specific matter.
 */
export async function getCourtDatesForMatter(matterId: string, workspaceId: string): Promise<CourtDate[]> {
  const courtDatesRef = collection(db, 'courtDates');
  const q = query(
    courtDatesRef,
    where('workspaceId', '==', workspaceId),
    where('matterId', '==', matterId),
    orderBy('scheduledDate', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as CourtDate[];
}

/**
 * Retrieves all upcoming court dates for a specific entity.
 */
export async function getUpcomingCourtDatesForEntity(entityId: string, workspaceId: string): Promise<CourtDate[]> {
  const courtDatesRef = collection(db, 'courtDates');
  const q = query(
    courtDatesRef,
    where('workspaceId', '==', workspaceId),
    where('entityId', '==', entityId),
    where('status', '==', 'upcoming'),
    orderBy('scheduledDate', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as CourtDate[];
}
