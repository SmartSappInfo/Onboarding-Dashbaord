/**
 * SaaS Industry Server Actions
 * 
 * Implements server actions for SaaS-specific collections:
 * - Trial Management (Requirements 8.17)
 * - Onboarding Tracking (Requirements 8.18)
 * - Subscription Management (Requirements 8.20)
 * - Support Ticket Management (Requirements 8.21)
 * - Health Score Tracking (Requirements 8.23)
 * - Product Usage Analytics (Requirements 8.19)
 * - Feature Adoption Tracking (Requirements 8.22)
 * 
 * All actions validate workspace.industry === 'SaaS' before writing.
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
  Timestamp,
  arrayUnion,
} from 'firebase/firestore';
import { firestore as db } from '@/firebase/config';
import { recalculateEntityScore } from './scoring-engine';
import type {
  Trial,
  Onboarding,
  IndustrySubscription,
  SupportTicket,
  HealthScore,
  ProductUsage,
  FeatureAdoption,
  Workspace,
  Entity,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates that a workspace is scoped to the SaaS industry.
 * Throws an error if the workspace is not SaaS.
 */
async function validateSaaSWorkspace(workspaceId: string): Promise<Workspace> {
  const workspaceRef = doc(db, 'workspaces', workspaceId);
  const workspaceSnap = await getDoc(workspaceRef);

  if (!workspaceSnap.exists()) {
    throw new Error(`Workspace ${workspaceId} not found`);
  }

  const workspace = { id: workspaceSnap.id, ...workspaceSnap.data() } as Workspace;

  if (workspace.industry !== 'SaaS') {
    throw new Error(
      `This action is only available for SaaS workspaces. Current workspace industry: ${workspace.industry}`
    );
  }

  return workspace;
}

/**
 * Updates an entity's industry data to include a new collection reference ID.
 */
async function addCollectionReferenceToEntity(
  entityId: string,
  collectionField: 'trialIds' | 'onboardingIds' | 'subscriptionIds' | 'supportTicketIds' | 'healthScoreIds',
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
    industry: 'SaaS',
    entityType: 'institution',
    companySize: 0,
    planType: '',
    features: [],
    signupDate: new Date().toISOString(),
    accountStatus: 'active' as const,
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
// Trial Management (Requirement 8.17)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateTrialParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  trialStartDate: string; // ISO date string
  trialEndDate: string; // ISO date string
  trialStatus?: Trial['trialStatus'];
}

/**
 * Creates a new trial record for a SaaS account entity.
 * Updates the entity's trialIds array.
 * 
 * @throws Error if workspace is not SaaS industry
 */
export async function createTrial(params: CreateTrialParams): Promise<Trial> {
  const { organizationId, workspaceId, entityId, trialStartDate, trialEndDate, trialStatus = 'active' } = params;

  // Validate workspace is SaaS
  await validateSaaSWorkspace(workspaceId);

  const now = new Date().toISOString();

  const trialData: Omit<Trial, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    trialStartDate,
    trialEndDate,
    trialStatus,
    createdAt: now,
    updatedAt: now,
  };

  const trialsRef = collection(db, 'trials');
  const docRef = await addDoc(trialsRef, trialData);

  // Update entity's trialIds array
  await addCollectionReferenceToEntity(entityId, 'trialIds', docRef.id);

  return {
    id: docRef.id,
    ...trialData,
  };
}

/**
 * Retrieves all trials for a specific entity.
 */
export async function getTrialsForEntity(entityId: string): Promise<Trial[]> {
  const trialsRef = collection(db, 'trials');
  const q = query(
    trialsRef,
    where('entityId', '==', entityId),
    orderBy('trialStartDate', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Trial[];
}

/**
 * Updates the status of a trial.
 * If status is 'converted', sets conversionDate to now.
 */
export async function updateTrialStatus(
  trialId: string,
  status: Trial['trialStatus']
): Promise<void> {
  const trialRef = doc(db, 'trials', trialId);
  const trialSnap = await getDoc(trialRef);

  if (!trialSnap.exists()) {
    throw new Error(`Trial ${trialId} not found`);
  }

  const trial = { id: trialSnap.id, ...trialSnap.data() } as Trial;

  // Validate workspace is SaaS
  await validateSaaSWorkspace(trial.workspaceId);

  const updates: Partial<Trial> = {
    trialStatus: status,
    updatedAt: new Date().toISOString(),
  };

  if (status === 'converted' && !trial.conversionDate) {
    updates.conversionDate = new Date().toISOString();
  }

  await updateDoc(trialRef, updates);
}

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding Tracking (Requirement 8.18)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateOnboardingParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  onboardingStatus?: Onboarding['onboardingStatus'];
  activationMilestones?: Onboarding['activationMilestones'];
}

/**
 * Creates a new onboarding record for a SaaS account entity.
 * Updates the entity's onboardingIds array.
 * 
 * @throws Error if workspace is not SaaS industry
 */
export async function createOnboarding(params: CreateOnboardingParams): Promise<Onboarding> {
  const {
    organizationId,
    workspaceId,
    entityId,
    onboardingStatus = 'not_started',
    activationMilestones = [],
  } = params;

  // Validate workspace is SaaS
  await validateSaaSWorkspace(workspaceId);

  const now = new Date().toISOString();

  const onboardingData: Omit<Onboarding, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    onboardingStatus,
    activationMilestones,
    createdAt: now,
    updatedAt: now,
  };

  const onboardingRef = collection(db, 'onboarding');
  const docRef = await addDoc(onboardingRef, onboardingData);

  // Update entity's onboardingIds array
  await addCollectionReferenceToEntity(entityId, 'onboardingIds', docRef.id);

  return {
    id: docRef.id,
    ...onboardingData,
  };
}

/**
 * Updates a specific milestone in an onboarding record.
 * Marks the milestone as completed and sets completedAt timestamp.
 */
export async function updateOnboardingMilestone(
  onboardingId: string,
  milestoneName: string,
  completed: boolean
): Promise<void> {
  const onboardingRef = doc(db, 'onboarding', onboardingId);
  const onboardingSnap = await getDoc(onboardingRef);

  if (!onboardingSnap.exists()) {
    throw new Error(`Onboarding ${onboardingId} not found`);
  }

  const onboarding = { id: onboardingSnap.id, ...onboardingSnap.data() } as Onboarding;

  // Validate workspace is SaaS
  await validateSaaSWorkspace(onboarding.workspaceId);

  // Update the milestone
  const updatedMilestones = onboarding.activationMilestones.map((milestone) => {
    if (milestone.name === milestoneName) {
      return {
        ...milestone,
        completed,
        completedAt: completed ? new Date().toISOString() : undefined,
      };
    }
    return milestone;
  });

  // Check if all milestones are completed
  const allCompleted = updatedMilestones.every((m) => m.completed);
  const newStatus = allCompleted ? 'completed' : 'in_progress';

  await updateDoc(onboardingRef, {
    activationMilestones: updatedMilestones,
    onboardingStatus: newStatus,
    updatedAt: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Subscription Management (Requirement 8.20)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateSubscriptionParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  planType: string;
  billingCycle: IndustrySubscription['billingCycle'];
  amount: number;
  currency: string;
  status?: IndustrySubscription['status'];
  startDate: string;
  renewalDate: string;
}

/**
 * Creates a new subscription record for a SaaS account entity.
 * Updates the entity's subscriptionIds array.
 * 
 * @throws Error if workspace is not SaaS industry
 */
export async function createSubscription(params: CreateSubscriptionParams): Promise<IndustrySubscription> {
  const {
    organizationId,
    workspaceId,
    entityId,
    planType,
    billingCycle,
    amount,
    currency,
    status = 'active',
    startDate,
    renewalDate,
  } = params;

  // Validate workspace is SaaS
  await validateSaaSWorkspace(workspaceId);

  const now = new Date().toISOString();

  const subscriptionData: Omit<IndustrySubscription, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    planType,
    billingCycle,
    amount,
    currency,
    status,
    startDate,
    renewalDate,
    createdAt: now,
    updatedAt: now,
  };

  const subscriptionsRef = collection(db, 'subscriptions');
  const docRef = await addDoc(subscriptionsRef, subscriptionData);

  // Update entity's subscriptionIds array
  await addCollectionReferenceToEntity(entityId, 'subscriptionIds', docRef.id);

  return {
    id: docRef.id,
    ...subscriptionData,
  };
}

/**
 * Updates an existing subscription record.
 */
export async function updateSubscription(
  subscriptionId: string,
  updates: Partial<Omit<IndustrySubscription, 'id' | 'createdAt'>>
): Promise<void> {
  const subscriptionRef = doc(db, 'subscriptions', subscriptionId);
  const subscriptionSnap = await getDoc(subscriptionRef);

  if (!subscriptionSnap.exists()) {
    throw new Error(`Subscription ${subscriptionId} not found`);
  }

  const subscription = { id: subscriptionSnap.id, ...subscriptionSnap.data() } as IndustrySubscription;

  // Validate workspace is SaaS
  await validateSaaSWorkspace(subscription.workspaceId);

  await updateDoc(subscriptionRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Support Ticket Management (Requirement 8.21)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateSupportTicketParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  issueType: string;
  priority: SupportTicket['priority'];
  status?: SupportTicket['status'];
}

/**
 * Creates a new support ticket for a SaaS account entity.
 * Updates the entity's supportTicketIds array.
 * 
 * @throws Error if workspace is not SaaS industry
 */
export async function createSupportTicket(params: CreateSupportTicketParams): Promise<SupportTicket> {
  const { organizationId, workspaceId, entityId, issueType, priority, status = 'open' } = params;

  // Validate workspace is SaaS
  await validateSaaSWorkspace(workspaceId);

  const now = new Date().toISOString();

  const ticketData: Omit<SupportTicket, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    issueType,
    priority,
    status,
    createdAt: now,
    updatedAt: now,
  };

  const ticketsRef = collection(db, 'supportTickets');
  const docRef = await addDoc(ticketsRef, ticketData);

  // Update entity's supportTicketIds array
  await addCollectionReferenceToEntity(entityId, 'supportTicketIds', docRef.id);

  // Recalculate health score asynchronously
  try {
    await recalculateEntityScore(entityId, workspaceId, organizationId);
  } catch (err) {
    console.error('Failed to trigger score recalculation in createSupportTicket:', err);
  }

  return {
    id: docRef.id,
    ...ticketData,
  };
}

/**
 * Updates an existing support ticket.
 * If status changes to 'resolved' or 'closed', sets resolvedAt timestamp and calculates resolutionTime.
 */
export async function updateSupportTicket(
  ticketId: string,
  updates: Partial<Omit<SupportTicket, 'id' | 'createdAt'>>
): Promise<void> {
  const ticketRef = doc(db, 'supportTickets', ticketId);
  const ticketSnap = await getDoc(ticketRef);

  if (!ticketSnap.exists()) {
    throw new Error(`Support ticket ${ticketId} not found`);
  }

  const ticket = { id: ticketSnap.id, ...ticketSnap.data() } as SupportTicket;

  // Validate workspace is SaaS
  await validateSaaSWorkspace(ticket.workspaceId);

  const now = new Date().toISOString();
  const finalUpdates: Partial<SupportTicket> = {
    ...updates,
    updatedAt: now,
  };

  // If status is being changed to resolved or closed, set resolvedAt and calculate resolutionTime
  if (
    updates.status &&
    (updates.status === 'resolved' || updates.status === 'closed') &&
    !ticket.resolvedAt
  ) {
    finalUpdates.resolvedAt = now;

    // Calculate resolution time in hours
    const createdTime = new Date(ticket.createdAt).getTime();
    const resolvedTime = new Date(now).getTime();
    const resolutionTimeHours = (resolvedTime - createdTime) / (1000 * 60 * 60);
    finalUpdates.resolutionTime = Math.round(resolutionTimeHours * 100) / 100; // Round to 2 decimals
  }

  await updateDoc(ticketRef, finalUpdates);

  // Recalculate health score asynchronously
  try {
    await recalculateEntityScore(ticket.entityId, ticket.workspaceId, ticket.organizationId);
  } catch (err) {
    console.error('Failed to trigger score recalculation in updateSupportTicket:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Health Score Tracking (Requirement 8.23)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateHealthScoreParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  overallScore: number; // 0-100
  usageScore: number;
  supportScore: number;
  engagementScore: number;
  churnRisk: HealthScore['churnRisk'];
}

/**
 * Creates a new health score snapshot for a SaaS account entity.
 * Updates the entity's healthScoreIds array.
 * 
 * @throws Error if workspace is not SaaS industry
 * @throws Error if any score is outside 0-100 range
 */
export async function createHealthScore(params: CreateHealthScoreParams): Promise<HealthScore> {
  const { organizationId, workspaceId, entityId, overallScore, usageScore, supportScore, engagementScore, churnRisk } =
    params;

  // Validate workspace is SaaS
  await validateSaaSWorkspace(workspaceId);

  // Validate score ranges
  const scores = [overallScore, usageScore, supportScore, engagementScore];
  if (scores.some((score) => score < 0 || score > 100)) {
    throw new Error('All scores must be between 0 and 100');
  }

  const now = new Date().toISOString();

  const healthScoreData: Omit<HealthScore, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    overallScore,
    usageScore,
    supportScore,
    engagementScore,
    churnRisk,
    calculatedAt: now,
    createdAt: now,
  };

  const healthScoresRef = collection(db, 'healthScores');
  const docRef = await addDoc(healthScoresRef, healthScoreData);

  // Update entity's healthScoreIds array
  await addCollectionReferenceToEntity(entityId, 'healthScoreIds', docRef.id);

  return {
    id: docRef.id,
    ...healthScoreData,
  };
}

/**
 * Retrieves the most recent health score for an entity.
 */
export async function getLatestHealthScore(entityId: string): Promise<HealthScore | null> {
  const healthScoresRef = collection(db, 'healthScores');
  const q = query(
    healthScoresRef,
    where('entityId', '==', entityId),
    orderBy('calculatedAt', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  } as HealthScore;
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Usage Analytics (Requirement 8.19)
// ─────────────────────────────────────────────────────────────────────────────

export interface RecordProductUsageParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  featureUsed: string;
  frequency: number;
  sessionDuration?: number; // seconds
  engagementScore?: number;
}

/**
 * Records a product usage event for a SaaS account entity.
 * 
 * @throws Error if workspace is not SaaS industry
 */
export async function recordProductUsage(params: RecordProductUsageParams): Promise<ProductUsage> {
  const { organizationId, workspaceId, entityId, featureUsed, frequency, sessionDuration, engagementScore } = params;

  // Validate workspace is SaaS
  await validateSaaSWorkspace(workspaceId);

  const now = new Date().toISOString();

  const usageData: Omit<ProductUsage, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    featureUsed,
    frequency,
    sessionDuration,
    engagementScore,
    recordedAt: now,
    createdAt: now,
  };

  const usageRef = collection(db, 'productUsage');
  const docRef = await addDoc(usageRef, usageData);

  // Recalculate health score asynchronously
  try {
    await recalculateEntityScore(entityId, workspaceId, organizationId);
  } catch (err) {
    console.error('Failed to trigger score recalculation in recordProductUsage:', err);
  }

  return {
    id: docRef.id,
    ...usageData,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature Adoption Tracking (Requirement 8.22)
// ─────────────────────────────────────────────────────────────────────────────

export interface RecordFeatureAdoptionParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  featureName: string;
  featureUsageStatus: FeatureAdoption['featureUsageStatus'];
  adoptionDate?: string;
  depthOfUsage?: FeatureAdoption['depthOfUsage'];
}

/**
 * Records or updates feature adoption status for a SaaS account entity.
 * 
 * @throws Error if workspace is not SaaS industry
 */
export async function recordFeatureAdoption(params: RecordFeatureAdoptionParams): Promise<FeatureAdoption> {
  const { organizationId, workspaceId, entityId, featureName, featureUsageStatus, adoptionDate, depthOfUsage } =
    params;

  // Validate workspace is SaaS
  await validateSaaSWorkspace(workspaceId);

  const now = new Date().toISOString();

  // Check if a record already exists for this entity + feature
  const adoptionRef = collection(db, 'featureAdoption');
  const q = query(
    adoptionRef,
    where('entityId', '==', entityId),
    where('featureName', '==', featureName),
    limit(1)
  );

  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    // Update existing record
    const existingDoc = snapshot.docs[0];
    const updates: Partial<FeatureAdoption> = {
      featureUsageStatus,
      depthOfUsage,
      updatedAt: now,
    };

    if (featureUsageStatus === 'adopted' && !existingDoc.data().adoptionDate) {
      updates.adoptionDate = adoptionDate || now;
    }

    await updateDoc(doc(db, 'featureAdoption', existingDoc.id), updates);

    return {
      id: existingDoc.id,
      ...existingDoc.data(),
      ...updates,
    } as FeatureAdoption;
  }

  // Create new record
  const adoptionData: Omit<FeatureAdoption, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    featureName,
    featureUsageStatus,
    adoptionDate: featureUsageStatus === 'adopted' ? adoptionDate || now : undefined,
    depthOfUsage,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(adoptionRef, adoptionData);

  return {
    id: docRef.id,
    ...adoptionData,
  };
}
