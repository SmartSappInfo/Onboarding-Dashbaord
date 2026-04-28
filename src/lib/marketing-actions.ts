/**
 * Marketing Industry Server Actions
 * 
 * Implements server actions for Marketing-specific collections:
 * - Campaign Management (Requirements 6.8)
 * - Proposal Management (Requirements 6.9)
 * - Deliverable Management (Requirements 6.10)
 * - Performance Metric Tracking (Requirements 6.11)
 * - Client Report Management (Requirements 6.12)
 * - Strategy Document Management (Requirements 6.13)
 * 
 * All actions validate workspace.industry === 'Marketing' before writing.
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
  Campaign,
  Proposal,
  Deliverable,
  PerformanceMetric,
  ClientReport,
  StrategyDoc,
  Workspace,
  Entity,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates that a workspace is scoped to the Marketing industry.
 * Throws an error if the workspace is not Marketing.
 */
async function validateMarketingWorkspace(workspaceId: string): Promise<Workspace> {
  const workspaceRef = doc(db, 'workspaces', workspaceId);
  const workspaceSnap = await getDoc(workspaceRef);

  if (!workspaceSnap.exists()) {
    throw new Error(`Workspace ${workspaceId} not found`);
  }

  const workspace = { id: workspaceSnap.id, ...workspaceSnap.data() } as Workspace;

  if (workspace.industry !== 'Marketing') {
    throw new Error(
      `This action is only available for Marketing workspaces. Current workspace industry: ${workspace.industry}`
    );
  }

  return workspace;
}

/**
 * Updates an entity's industry data to include a new collection reference ID.
 */
async function addCollectionReferenceToEntity(
  entityId: string,
  collectionField: 'campaignIds' | 'proposalIds' | 'deliverableIds',
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
    industry: 'Marketing',
    entityType: 'institution',
    clientIndustry: '',
    businessSize: {},
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
// Campaign Management (Requirement 6.8)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateCampaignParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  campaignName: string;
  campaignType: string;
  status?: Campaign['status'];
  budget: number;
  startDate: string; // ISO date string
  endDate?: string; // ISO date string
}

/**
 * Creates a new campaign record for a Marketing client entity.
 * Updates the entity's campaignIds array.
 * 
 * @throws Error if workspace is not Marketing industry
 */
export async function createCampaign(params: CreateCampaignParams): Promise<Campaign> {
  const {
    organizationId,
    workspaceId,
    entityId,
    campaignName,
    campaignType,
    status = 'planning',
    budget,
    startDate,
    endDate,
  } = params;

  // Validate workspace is Marketing
  await validateMarketingWorkspace(workspaceId);

  const now = new Date().toISOString();

  const campaignData: Omit<Campaign, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    campaignName,
    campaignType,
    status,
    budget,
    startDate,
    endDate,
    createdAt: now,
    updatedAt: now,
  };

  const campaignsRef = collection(db, 'campaigns');
  const docRef = await addDoc(campaignsRef, campaignData);

  // Update entity's campaignIds array
  await addCollectionReferenceToEntity(entityId, 'campaignIds', docRef.id);

  return {
    id: docRef.id,
    ...campaignData,
  };
}

/**
 * Updates an existing campaign record.
 * 
 * @throws Error if workspace is not Marketing industry
 */
export async function updateCampaign(
  campaignId: string,
  updates: Partial<Omit<Campaign, 'id' | 'createdAt' | 'organizationId' | 'workspaceId' | 'entityId'>>
): Promise<void> {
  const campaignRef = doc(db, 'campaigns', campaignId);
  const campaignSnap = await getDoc(campaignRef);

  if (!campaignSnap.exists()) {
    throw new Error(`Campaign ${campaignId} not found`);
  }

  const campaign = { id: campaignSnap.id, ...campaignSnap.data() } as Campaign;

  // Validate workspace is Marketing
  await validateMarketingWorkspace(campaign.workspaceId);

  await updateDoc(campaignRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Retrieves all campaigns for a specific entity.
 */
export async function getCampaignsForEntity(entityId: string, workspaceId: string): Promise<Campaign[]> {
  const campaignsRef = collection(db, 'campaigns');
  const q = query(
    campaignsRef,
    where('workspaceId', '==', workspaceId),
    where('entityId', '==', entityId),
    orderBy('startDate', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Campaign[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Proposal Management (Requirement 6.9)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateProposalParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  proposalName: string;
  status?: Proposal['status'];
  value?: number;
}

/**
 * Creates a new proposal record for a Marketing client entity.
 * Updates the entity's proposalIds array.
 * 
 * @throws Error if workspace is not Marketing industry
 */
export async function createProposal(params: CreateProposalParams): Promise<Proposal> {
  const { organizationId, workspaceId, entityId, proposalName, status = 'draft', value } = params;

  // Validate workspace is Marketing
  await validateMarketingWorkspace(workspaceId);

  const now = new Date().toISOString();

  const proposalData: Omit<Proposal, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    proposalName,
    status,
    value,
    createdAt: now,
    updatedAt: now,
  };

  const proposalsRef = collection(db, 'proposals');
  const docRef = await addDoc(proposalsRef, proposalData);

  // Update entity's proposalIds array
  await addCollectionReferenceToEntity(entityId, 'proposalIds', docRef.id);

  return {
    id: docRef.id,
    ...proposalData,
  };
}

/**
 * Updates an existing proposal record.
 * If status changes to 'sent', sets sentAt timestamp.
 * If status changes to 'accepted' or 'rejected', sets respondedAt timestamp.
 * 
 * @throws Error if workspace is not Marketing industry
 */
export async function updateProposal(
  proposalId: string,
  updates: Partial<Omit<Proposal, 'id' | 'createdAt' | 'organizationId' | 'workspaceId' | 'entityId'>>
): Promise<void> {
  const proposalRef = doc(db, 'proposals', proposalId);
  const proposalSnap = await getDoc(proposalRef);

  if (!proposalSnap.exists()) {
    throw new Error(`Proposal ${proposalId} not found`);
  }

  const proposal = { id: proposalSnap.id, ...proposalSnap.data() } as Proposal;

  // Validate workspace is Marketing
  await validateMarketingWorkspace(proposal.workspaceId);

  const now = new Date().toISOString();
  const finalUpdates: Partial<Proposal> = {
    ...updates,
    updatedAt: now,
  };

  // If status is being changed to sent, set sentAt timestamp
  if (updates.status === 'sent' && !proposal.sentAt) {
    finalUpdates.sentAt = now;
  }

  // If status is being changed to accepted or rejected, set respondedAt timestamp
  if (
    updates.status &&
    (updates.status === 'accepted' || updates.status === 'rejected') &&
    !proposal.respondedAt
  ) {
    finalUpdates.respondedAt = now;
  }

  await updateDoc(proposalRef, finalUpdates);
}

// ─────────────────────────────────────────────────────────────────────────────
// Deliverable Management (Requirement 6.10)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateDeliverableParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  campaignId?: string;
  engagementId?: string;
  deliverableName: string;
  deliverableType: string;
  status?: Deliverable['status'];
  dueDate: string; // ISO date string
}

/**
 * Creates a new deliverable record for a Marketing client entity.
 * Updates the entity's deliverableIds array.
 * 
 * @throws Error if workspace is not Marketing industry
 */
export async function createDeliverable(params: CreateDeliverableParams): Promise<Deliverable> {
  const {
    organizationId,
    workspaceId,
    entityId,
    campaignId,
    engagementId,
    deliverableName,
    deliverableType,
    status = 'pending',
    dueDate,
  } = params;

  // Validate workspace is Marketing
  await validateMarketingWorkspace(workspaceId);

  const now = new Date().toISOString();

  const deliverableData: Omit<Deliverable, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    campaignId,
    engagementId,
    deliverableName,
    deliverableType,
    status,
    dueDate,
    createdAt: now,
    updatedAt: now,
  };

  const deliverablesRef = collection(db, 'deliverables');
  const docRef = await addDoc(deliverablesRef, deliverableData);

  // Update entity's deliverableIds array
  await addCollectionReferenceToEntity(entityId, 'deliverableIds', docRef.id);

  return {
    id: docRef.id,
    ...deliverableData,
  };
}

/**
 * Updates the status of a deliverable.
 * If status changes to 'delivered', sets completedDate to now.
 * 
 * @throws Error if workspace is not Marketing industry
 */
export async function updateDeliverableStatus(
  deliverableId: string,
  status: Deliverable['status']
): Promise<void> {
  const deliverableRef = doc(db, 'deliverables', deliverableId);
  const deliverableSnap = await getDoc(deliverableRef);

  if (!deliverableSnap.exists()) {
    throw new Error(`Deliverable ${deliverableId} not found`);
  }

  const deliverable = { id: deliverableSnap.id, ...deliverableSnap.data() } as Deliverable;

  // Validate workspace is Marketing
  await validateMarketingWorkspace(deliverable.workspaceId);

  const now = new Date().toISOString();
  const updates: Partial<Deliverable> = {
    status,
    updatedAt: now,
  };

  // If status is being changed to delivered, set completedDate
  if (status === 'delivered' && !deliverable.completedDate) {
    updates.completedDate = now;
  }

  await updateDoc(deliverableRef, updates);
}

// ─────────────────────────────────────────────────────────────────────────────
// Performance Metric Tracking (Requirement 6.11)
// ─────────────────────────────────────────────────────────────────────────────

export interface RecordPerformanceMetricParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  campaignId?: string;
  metricName: string;
  metricValue: number;
  unit?: string;
}

/**
 * Records a performance metric snapshot for a Marketing campaign.
 * 
 * @throws Error if workspace is not Marketing industry
 */
export async function recordPerformanceMetric(params: RecordPerformanceMetricParams): Promise<PerformanceMetric> {
  const { organizationId, workspaceId, entityId, campaignId, metricName, metricValue, unit } = params;

  // Validate workspace is Marketing
  await validateMarketingWorkspace(workspaceId);

  const now = new Date().toISOString();

  const metricData: Omit<PerformanceMetric, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    campaignId,
    metricName,
    metricValue,
    unit,
    recordedAt: now,
    createdAt: now,
  };

  const metricsRef = collection(db, 'performanceMetrics');
  const docRef = await addDoc(metricsRef, metricData);

  return {
    id: docRef.id,
    ...metricData,
  };
}

/**
 * Retrieves all performance metrics for a specific campaign.
 */
export async function getPerformanceMetricsForCampaign(
  campaignId: string,
  workspaceId: string
): Promise<PerformanceMetric[]> {
  const metricsRef = collection(db, 'performanceMetrics');
  const q = query(
    metricsRef,
    where('workspaceId', '==', workspaceId),
    where('campaignId', '==', campaignId),
    orderBy('recordedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as PerformanceMetric[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Client Report Management (Requirement 6.12)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateClientReportParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  campaignId?: string;
  reportName: string;
  reportPeriod: string;
  storageUrl?: string;
}

/**
 * Creates a new client report record for a Marketing client entity.
 * 
 * @throws Error if workspace is not Marketing industry
 */
export async function createClientReport(params: CreateClientReportParams): Promise<ClientReport> {
  const { organizationId, workspaceId, entityId, campaignId, reportName, reportPeriod, storageUrl } = params;

  // Validate workspace is Marketing
  await validateMarketingWorkspace(workspaceId);

  const now = new Date().toISOString();

  const reportData: Omit<ClientReport, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    campaignId,
    reportName,
    reportPeriod,
    storageUrl,
    createdAt: now,
    updatedAt: now,
  };

  const reportsRef = collection(db, 'clientReports');
  const docRef = await addDoc(reportsRef, reportData);

  return {
    id: docRef.id,
    ...reportData,
  };
}

/**
 * Updates a client report record (e.g., to mark as sent).
 * 
 * @throws Error if workspace is not Marketing industry
 */
export async function updateClientReport(
  reportId: string,
  updates: Partial<Omit<ClientReport, 'id' | 'createdAt' | 'organizationId' | 'workspaceId' | 'entityId'>>
): Promise<void> {
  const reportRef = doc(db, 'clientReports', reportId);
  const reportSnap = await getDoc(reportRef);

  if (!reportSnap.exists()) {
    throw new Error(`Client report ${reportId} not found`);
  }

  const report = { id: reportSnap.id, ...reportSnap.data() } as ClientReport;

  // Validate workspace is Marketing
  await validateMarketingWorkspace(report.workspaceId);

  await updateDoc(reportRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Retrieves all client reports for a specific entity.
 */
export async function getClientReportsForEntity(entityId: string, workspaceId: string): Promise<ClientReport[]> {
  const reportsRef = collection(db, 'clientReports');
  const q = query(
    reportsRef,
    where('workspaceId', '==', workspaceId),
    where('entityId', '==', entityId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ClientReport[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Strategy Document Management (Requirement 6.13)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateStrategyDocParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  docName: string;
  docType: string;
  storageUrl?: string;
  version?: string;
}

/**
 * Creates a new strategy document record for a Marketing client entity.
 * 
 * @throws Error if workspace is not Marketing industry
 */
export async function createStrategyDoc(params: CreateStrategyDocParams): Promise<StrategyDoc> {
  const { organizationId, workspaceId, entityId, docName, docType, storageUrl, version } = params;

  // Validate workspace is Marketing
  await validateMarketingWorkspace(workspaceId);

  const now = new Date().toISOString();

  const docData: Omit<StrategyDoc, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    docName,
    docType,
    storageUrl,
    version,
    createdAt: now,
    updatedAt: now,
  };

  const docsRef = collection(db, 'strategyDocs');
  const docRef = await addDoc(docsRef, docData);

  return {
    id: docRef.id,
    ...docData,
  };
}

/**
 * Updates a strategy document record.
 * 
 * @throws Error if workspace is not Marketing industry
 */
export async function updateStrategyDoc(
  docId: string,
  updates: Partial<Omit<StrategyDoc, 'id' | 'createdAt' | 'organizationId' | 'workspaceId' | 'entityId'>>
): Promise<void> {
  const docRef = doc(db, 'strategyDocs', docId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error(`Strategy document ${docId} not found`);
  }

  const strategyDoc = { id: docSnap.id, ...docSnap.data() } as StrategyDoc;

  // Validate workspace is Marketing
  await validateMarketingWorkspace(strategyDoc.workspaceId);

  await updateDoc(docRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Retrieves all strategy documents for a specific entity.
 */
export async function getStrategyDocsForEntity(entityId: string, workspaceId: string): Promise<StrategyDoc[]> {
  const docsRef = collection(db, 'strategyDocs');
  const q = query(
    docsRef,
    where('workspaceId', '==', workspaceId),
    where('entityId', '==', entityId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as StrategyDoc[];
}
