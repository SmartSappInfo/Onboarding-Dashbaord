'use server';

/**
 * SmartSapp Finance 2.0 - Debt Collection Server Actions
 * Handles Collection Cases, Promises-to-Pay, Payment Plans, and Activity Logging with canUser RBAC.
 */

import { canUser } from './workspace-permissions';
import { 
  ActionResponse, 
  CollectionCase, 
  CollectionStage, 
  PromiseToPay, 
  PaymentPlan, 
  CollectionActivity, 
  CollectionActivityType,
  PaymentMethod
} from './types';
import { CollectionCaseService } from './services/collection-case-service';
import { PromiseToPayService } from './services/promise-to-pay-service';
import { PaymentPlanService } from './services/payment-plan-service';
import { CollectionActivityService } from './services/collection-activity-service';
import { adminDb } from './firebase-admin';

export async function createOrUpdateCollectionCaseAction(
  entityId: string,
  workspaceId: string,
  userId: string,
  userName: string
): Promise<ActionResponse & { collectionCase?: CollectionCase }> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'edit', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient finance permissions to manage collection cases.' };
    }

    const collectionCase = await CollectionCaseService.getOrCreateCaseForEntity(
      entityId,
      workspaceId,
      userId,
      userName
    );
    return { success: true, collectionCase };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to initialize collection case';
    return { success: false, error: msg };
  }
}

export async function updateCaseStageAction(
  caseId: string,
  stage: CollectionStage,
  workspaceId: string,
  userId: string,
  userName: string,
  notes?: string
): Promise<ActionResponse & { collectionCase?: CollectionCase }> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'edit', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient permissions to update collection stage.' };
    }

    const collectionCase = await CollectionCaseService.updateCaseStage(
      caseId,
      stage,
      userId,
      userName,
      notes
    );
    return { success: true, collectionCase };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update collection stage';
    return { success: false, error: msg };
  }
}

export async function assignCaseAction(
  caseId: string,
  assignedToUserId: string,
  assignedToName: string,
  workspaceId: string,
  userId: string,
  userName: string
): Promise<ActionResponse> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'edit', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient permissions to assign collection case.' };
    }

    await CollectionCaseService.assignCase(caseId, assignedToUserId, assignedToName, userId, userName);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to assign collection case';
    return { success: false, error: msg };
  }
}

export interface RecordPromiseInput {
  caseId?: string;
  accountId: string;
  entityId: string;
  entityName: string;
  promisedAmount: number;
  currency?: string;
  promisedDate: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
}

export async function recordPromiseToPayAction(
  input: RecordPromiseInput,
  workspaceId: string,
  userId: string,
  userName: string
): Promise<ActionResponse & { promise?: PromiseToPay }> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'edit', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient permissions to record promise-to-pay.' };
    }

    const promise = await PromiseToPayService.recordPromise({
      ...input,
      workspaceId,
      userId,
      userName,
    });

    return { success: true, promise };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to record promise-to-pay';
    return { success: false, error: msg };
  }
}

export async function evaluatePromisesAction(
  workspaceId: string,
  userId: string,
  userName: string
): Promise<ActionResponse & { brokenCount?: number }> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'edit', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient permissions to evaluate promises.' };
    }

    const brokenCount = await PromiseToPayService.evaluateBrokenPromises(workspaceId, userId, userName);
    return { success: true, brokenCount };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to evaluate promises';
    return { success: false, error: msg };
  }
}

export interface CreatePaymentPlanInput {
  caseId?: string;
  accountId: string;
  entityId: string;
  entityName: string;
  totalDebt: number;
  downPayment: number;
  installmentsCount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  startDate: string;
  currency?: string;
}

export async function createPaymentPlanAction(
  input: CreatePaymentPlanInput,
  workspaceId: string,
  userId: string,
  userName: string
): Promise<ActionResponse & { plan?: PaymentPlan }> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'edit', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient permissions to create payment plan.' };
    }

    const plan = await PaymentPlanService.createPlan({
      ...input,
      workspaceId,
      userId,
      userName,
    });

    return { success: true, plan };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create payment plan';
    return { success: false, error: msg };
  }
}

export interface LogActivityInput {
  caseId: string;
  entityId: string;
  type: CollectionActivityType;
  summary: string;
  details?: string;
  outcome?: string;
}

export async function logCollectionActivityAction(
  input: LogActivityInput,
  workspaceId: string,
  userId: string,
  userName: string
): Promise<ActionResponse & { activity?: CollectionActivity }> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'edit', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient permissions to log collection activity.' };
    }

    const activity = await CollectionActivityService.logActivity({
      ...input,
      workspaceId,
      userId,
      userName,
    });

    return { success: true, activity };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to log collection activity';
    return { success: false, error: msg };
  }
}

export async function getCollectionCaseDetailsAction(
  caseId: string,
  workspaceId: string,
  userId: string
): Promise<ActionResponse & { 
  collectionCase?: CollectionCase; 
  promises?: PromiseToPay[]; 
  paymentPlans?: PaymentPlan[];
  activities?: CollectionActivity[];
}> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'view', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient finance viewing permissions.' };
    }

    const caseSnap = await adminDb.collection('collection_cases').doc(caseId).get();
    if (!caseSnap.exists) {
      return { success: false, error: 'Collection case not found.' };
    }

    const collectionCase = { id: caseSnap.id, ...(caseSnap.data() as Omit<CollectionCase, 'id'>) };

    // Fetch related promises, plans, activities
    const [promisesSnap, plansSnap, activitiesSnap] = await Promise.all([
      adminDb.collection('promises_to_pay').where('caseId', '==', caseId).orderBy('createdAt', 'desc').get(),
      adminDb.collection('payment_plans').where('caseId', '==', caseId).orderBy('createdAt', 'desc').get(),
      adminDb.collection('collection_activities').where('caseId', '==', caseId).orderBy('timestamp', 'desc').limit(50).get(),
    ]);

    const promises: PromiseToPay[] = promisesSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<PromiseToPay, 'id'>) }));
    const paymentPlans: PaymentPlan[] = plansSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<PaymentPlan, 'id'>) }));
    const activities: CollectionActivity[] = activitiesSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<CollectionActivity, 'id'>) }));

    return {
      success: true,
      collectionCase,
      promises,
      paymentPlans,
      activities,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to load collection case details';
    return { success: false, error: msg };
  }
}
