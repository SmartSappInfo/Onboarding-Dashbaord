/**
 * Consultancy Industry Server Actions
 * 
 * Implements server actions for Consultancy-specific collections:
 * - Discovery Management (Requirements 9.9)
 * - Engagement Management (Requirements 9.11)
 * - Milestone Management (Requirements 9.13)
 * - Outcome Measurement (Requirements 9.14)
 * - Retainer Management (Requirements 9.15)
 * 
 * All actions validate workspace.industry === 'Consultancy' before writing.
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
  Discovery,
  Engagement,
  Milestone,
  Outcome,
  Retainer,
  Workspace,
  Entity,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates that a workspace is scoped to the Consultancy industry.
 * Throws an error if the workspace is not Consultancy.
 */
async function validateConsultancyWorkspace(workspaceId: string): Promise<Workspace> {
  const workspaceRef = doc(db, 'workspaces', workspaceId);
  const workspaceSnap = await getDoc(workspaceRef);

  if (!workspaceSnap.exists()) {
    throw new Error(`Workspace ${workspaceId} not found`);
  }

  const workspace = { id: workspaceSnap.id, ...workspaceSnap.data() } as Workspace;

  if (workspace.industry !== 'Consultancy') {
    throw new Error(
      `This action is only available for Consultancy workspaces. Current workspace industry: ${workspace.industry}`
    );
  }

  return workspace;
}

/**
 * Updates an entity's industry data to include a new collection reference ID.
 */
async function addCollectionReferenceToEntity(
  entityId: string,
  collectionField: 'discoveryIds' | 'engagementIds' | 'retainerIds',
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
    industry: 'Consultancy',
    entityType: 'institution',
    clientIndustry: '',
    companySize: {},
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
// Discovery Management (Requirement 9.9)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateDiscoveryParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  discoveryType: string;
  status?: Discovery['status'];
  findings?: string;
  completedDate?: string; // ISO date string
}

/**
 * Creates a new discovery session record for a Consultancy client entity.
 * Updates the entity's discoveryIds array.
 * 
 * @throws Error if workspace is not Consultancy industry
 */
export async function createDiscovery(params: CreateDiscoveryParams): Promise<Discovery> {
  const {
    organizationId,
    workspaceId,
    entityId,
    discoveryType,
    status = 'scheduled',
    findings,
    completedDate,
  } = params;

  // Validate workspace is Consultancy
  await validateConsultancyWorkspace(workspaceId);

  const now = new Date().toISOString();

  const discoveryData: Omit<Discovery, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    discoveryType,
    status,
    findings,
    completedDate,
    createdAt: now,
    updatedAt: now,
  };

  const discoveriesRef = collection(db, 'discoveries');
  const docRef = await addDoc(discoveriesRef, discoveryData);

  // Update entity's discoveryIds array
  await addCollectionReferenceToEntity(entityId, 'discoveryIds', docRef.id);

  return {
    id: docRef.id,
    ...discoveryData,
  };
}

/**
 * Updates an existing discovery session record.
 * If status changes to 'completed', sets completedDate to now if not already set.
 * 
 * @throws Error if workspace is not Consultancy industry
 */
export async function updateDiscovery(
  discoveryId: string,
  updates: Partial<Omit<Discovery, 'id' | 'createdAt' | 'organizationId' | 'workspaceId' | 'entityId'>>
): Promise<void> {
  const discoveryRef = doc(db, 'discoveries', discoveryId);
  const discoverySnap = await getDoc(discoveryRef);

  if (!discoverySnap.exists()) {
    throw new Error(`Discovery ${discoveryId} not found`);
  }

  const discovery = { id: discoverySnap.id, ...discoverySnap.data() } as Discovery;

  // Validate workspace is Consultancy
  await validateConsultancyWorkspace(discovery.workspaceId);

  const now = new Date().toISOString();
  const finalUpdates: Partial<Discovery> = {
    ...updates,
    updatedAt: now,
  };

  // If status is being changed to completed, set completedDate if not already set
  if (updates.status === 'completed' && !discovery.completedDate && !updates.completedDate) {
    finalUpdates.completedDate = now;
  }

  await updateDoc(discoveryRef, finalUpdates);
}

/**
 * Retrieves all discovery sessions for a specific entity.
 */
export async function getDiscoveriesForEntity(entityId: string, workspaceId: string): Promise<Discovery[]> {
  const discoveriesRef = collection(db, 'discoveries');
  const q = query(
    discoveriesRef,
    where('workspaceId', '==', workspaceId),
    where('entityId', '==', entityId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Discovery[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Engagement Management (Requirement 9.11)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateEngagementParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  engagementName: string;
  engagementType: string;
  status?: Engagement['status'];
  startDate: string; // ISO date string
  endDate?: string; // ISO date string
  value: number;
}

/**
 * Creates a new engagement record for a Consultancy client entity.
 * Updates the entity's engagementIds array.
 * 
 * @throws Error if workspace is not Consultancy industry
 */
export async function createEngagement(params: CreateEngagementParams): Promise<Engagement> {
  const {
    organizationId,
    workspaceId,
    entityId,
    engagementName,
    engagementType,
    status = 'proposal',
    startDate,
    endDate,
    value,
  } = params;

  // Validate workspace is Consultancy
  await validateConsultancyWorkspace(workspaceId);

  const now = new Date().toISOString();

  const engagementData: Omit<Engagement, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    engagementName,
    engagementType,
    status,
    startDate,
    endDate,
    value,
    createdAt: now,
    updatedAt: now,
  };

  const engagementsRef = collection(db, 'engagements');
  const docRef = await addDoc(engagementsRef, engagementData);

  // Update entity's engagementIds array
  await addCollectionReferenceToEntity(entityId, 'engagementIds', docRef.id);

  return {
    id: docRef.id,
    ...engagementData,
  };
}

/**
 * Updates an existing engagement record.
 * 
 * @throws Error if workspace is not Consultancy industry
 */
export async function updateEngagement(
  engagementId: string,
  updates: Partial<Omit<Engagement, 'id' | 'createdAt' | 'organizationId' | 'workspaceId' | 'entityId'>>
): Promise<void> {
  const engagementRef = doc(db, 'engagements', engagementId);
  const engagementSnap = await getDoc(engagementRef);

  if (!engagementSnap.exists()) {
    throw new Error(`Engagement ${engagementId} not found`);
  }

  const engagement = { id: engagementSnap.id, ...engagementSnap.data() } as Engagement;

  // Validate workspace is Consultancy
  await validateConsultancyWorkspace(engagement.workspaceId);

  await updateDoc(engagementRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Retrieves all engagements for a specific entity.
 */
export async function getEngagementsForEntity(entityId: string, workspaceId: string): Promise<Engagement[]> {
  const engagementsRef = collection(db, 'engagements');
  const q = query(
    engagementsRef,
    where('workspaceId', '==', workspaceId),
    where('entityId', '==', entityId),
    orderBy('startDate', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Engagement[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Milestone Management (Requirement 9.13)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateMilestoneParams {
  organizationId: string;
  workspaceId: string;
  engagementId: string;
  milestoneName: string;
  status?: Milestone['status'];
  dueDate: string; // ISO date string
}

/**
 * Creates a new milestone record for a consulting engagement.
 * 
 * @throws Error if workspace is not Consultancy industry
 */
export async function createMilestone(params: CreateMilestoneParams): Promise<Milestone> {
  const { organizationId, workspaceId, engagementId, milestoneName, status = 'pending', dueDate } = params;

  // Validate workspace is Consultancy
  await validateConsultancyWorkspace(workspaceId);

  const now = new Date().toISOString();

  const milestoneData: Omit<Milestone, 'id'> = {
    organizationId,
    workspaceId,
    engagementId,
    milestoneName,
    status,
    dueDate,
    createdAt: now,
    updatedAt: now,
  };

  const milestonesRef = collection(db, 'milestones');
  const docRef = await addDoc(milestonesRef, milestoneData);

  return {
    id: docRef.id,
    ...milestoneData,
  };
}

/**
 * Updates the status of a milestone.
 * If status changes to 'completed', sets completedDate to now.
 * 
 * @throws Error if workspace is not Consultancy industry
 */
export async function updateMilestoneStatus(milestoneId: string, status: Milestone['status']): Promise<void> {
  const milestoneRef = doc(db, 'milestones', milestoneId);
  const milestoneSnap = await getDoc(milestoneRef);

  if (!milestoneSnap.exists()) {
    throw new Error(`Milestone ${milestoneId} not found`);
  }

  const milestone = { id: milestoneSnap.id, ...milestoneSnap.data() } as Milestone;

  // Validate workspace is Consultancy
  await validateConsultancyWorkspace(milestone.workspaceId);

  const now = new Date().toISOString();
  const updates: Partial<Milestone> = {
    status,
    updatedAt: now,
  };

  // If status is being changed to completed, set completedDate
  if (status === 'completed' && !milestone.completedDate) {
    updates.completedDate = now;
  }

  await updateDoc(milestoneRef, updates);
}

/**
 * Retrieves all milestones for a specific engagement.
 */
export async function getMilestonesForEngagement(
  engagementId: string,
  workspaceId: string
): Promise<Milestone[]> {
  const milestonesRef = collection(db, 'milestones');
  const q = query(
    milestonesRef,
    where('workspaceId', '==', workspaceId),
    where('engagementId', '==', engagementId),
    orderBy('dueDate', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Milestone[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Outcome Measurement (Requirement 9.14)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateOutcomeParams {
  organizationId: string;
  workspaceId: string;
  engagementId: string;
  entityId: string;
  outcomeDescription: string;
  measuredValue?: number;
  unit?: string;
  measuredAt?: string; // ISO date string
}

/**
 * Creates a new outcome measurement record for a consulting engagement.
 * 
 * @throws Error if workspace is not Consultancy industry
 */
export async function createOutcome(params: CreateOutcomeParams): Promise<Outcome> {
  const {
    organizationId,
    workspaceId,
    engagementId,
    entityId,
    outcomeDescription,
    measuredValue,
    unit,
    measuredAt,
  } = params;

  // Validate workspace is Consultancy
  await validateConsultancyWorkspace(workspaceId);

  const now = new Date().toISOString();

  const outcomeData: Omit<Outcome, 'id'> = {
    organizationId,
    workspaceId,
    engagementId,
    entityId,
    outcomeDescription,
    measuredValue,
    unit,
    measuredAt: measuredAt || now,
    createdAt: now,
    updatedAt: now,
  };

  const outcomesRef = collection(db, 'outcomes');
  const docRef = await addDoc(outcomesRef, outcomeData);

  return {
    id: docRef.id,
    ...outcomeData,
  };
}

/**
 * Updates an existing outcome record.
 * 
 * @throws Error if workspace is not Consultancy industry
 */
export async function updateOutcome(
  outcomeId: string,
  updates: Partial<Omit<Outcome, 'id' | 'createdAt' | 'organizationId' | 'workspaceId' | 'engagementId' | 'entityId'>>
): Promise<void> {
  const outcomeRef = doc(db, 'outcomes', outcomeId);
  const outcomeSnap = await getDoc(outcomeRef);

  if (!outcomeSnap.exists()) {
    throw new Error(`Outcome ${outcomeId} not found`);
  }

  const outcome = { id: outcomeSnap.id, ...outcomeSnap.data() } as Outcome;

  // Validate workspace is Consultancy
  await validateConsultancyWorkspace(outcome.workspaceId);

  await updateDoc(outcomeRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Retrieves all outcomes for a specific engagement.
 */
export async function getOutcomesForEngagement(engagementId: string, workspaceId: string): Promise<Outcome[]> {
  const outcomesRef = collection(db, 'outcomes');
  const q = query(
    outcomesRef,
    where('workspaceId', '==', workspaceId),
    where('engagementId', '==', engagementId),
    orderBy('measuredAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Outcome[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Retainer Management (Requirement 9.15)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateRetainerParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  retainerName: string;
  monthlyValue: number;
  currency: string;
  status?: Retainer['status'];
  startDate: string; // ISO date string
  endDate?: string; // ISO date string
}

/**
 * Creates a new retainer agreement record for a Consultancy client entity.
 * Updates the entity's retainerIds array.
 * 
 * @throws Error if workspace is not Consultancy industry
 */
export async function createRetainer(params: CreateRetainerParams): Promise<Retainer> {
  const {
    organizationId,
    workspaceId,
    entityId,
    retainerName,
    monthlyValue,
    currency,
    status = 'active',
    startDate,
    endDate,
  } = params;

  // Validate workspace is Consultancy
  await validateConsultancyWorkspace(workspaceId);

  const now = new Date().toISOString();

  const retainerData: Omit<Retainer, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    retainerName,
    monthlyValue,
    currency,
    status,
    startDate,
    endDate,
    createdAt: now,
    updatedAt: now,
  };

  const retainersRef = collection(db, 'retainers');
  const docRef = await addDoc(retainersRef, retainerData);

  // Update entity's retainerIds array
  await addCollectionReferenceToEntity(entityId, 'retainerIds', docRef.id);

  return {
    id: docRef.id,
    ...retainerData,
  };
}

/**
 * Updates an existing retainer agreement record.
 * 
 * @throws Error if workspace is not Consultancy industry
 */
export async function updateRetainer(
  retainerId: string,
  updates: Partial<Omit<Retainer, 'id' | 'createdAt' | 'organizationId' | 'workspaceId' | 'entityId'>>
): Promise<void> {
  const retainerRef = doc(db, 'retainers', retainerId);
  const retainerSnap = await getDoc(retainerRef);

  if (!retainerSnap.exists()) {
    throw new Error(`Retainer ${retainerId} not found`);
  }

  const retainer = { id: retainerSnap.id, ...retainerSnap.data() } as Retainer;

  // Validate workspace is Consultancy
  await validateConsultancyWorkspace(retainer.workspaceId);

  await updateDoc(retainerRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Retrieves all retainers for a specific entity.
 */
export async function getRetainersForEntity(entityId: string, workspaceId: string): Promise<Retainer[]> {
  const retainersRef = collection(db, 'retainers');
  const q = query(
    retainersRef,
    where('workspaceId', '==', workspaceId),
    where('entityId', '==', entityId),
    orderBy('startDate', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Retainer[];
}
