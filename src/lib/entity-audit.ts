/**
 * Entity Audit Logging Utility
 * 
 * Provides audit logging for all entity and workspace_entity operations
 * to meet security and compliance requirements.
 * 
 * Requirements: 29.4
 */

'use server';

import { adminDb } from './firebase-admin';
import type { EntityAuditLog } from './types';

/**
 * Log an entity operation to the audit trail
 * 
 * @param data - Audit log data
 * @returns Promise that resolves when log is written
 */
export async function logEntityAudit(data: Omit<EntityAuditLog, 'id' | 'timestamp'>) {
  try {
    const auditRef = adminDb.collection('entity_audit_logs').doc();
    const auditLog: EntityAuditLog = {
      ...data,
      id: auditRef.id,
      timestamp: new Date().toISOString(),
    };
    
    await auditRef.set(auditLog);
  } catch (error) {
    console.error('Failed to log entity audit:', error);
    // Don't throw - audit logging failure shouldn't break the main operation
  }
}

/**
 * Log entity creation
 */
export async function logEntityCreated(params: {
  organizationId: string;
  entityId: string;
  entityType: 'institution' | 'family' | 'person';
  userId: string;
  userName: string;
  userEmail: string;
  newValue: any;
  operationContext?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  await logEntityAudit({
    organizationId: params.organizationId,
    action: 'entity_created',
    entityId: params.entityId,
    entityType: params.entityType,
    userId: params.userId,
    userName: params.userName,
    userEmail: params.userEmail,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: {
      newValue: params.newValue,
      operationContext: params.operationContext || 'manual_edit',
    },
  });
}

/**
 * Log entity update
 */
export async function logEntityUpdated(params: {
  organizationId: string;
  entityId: string;
  entityType: 'institution' | 'family' | 'person';
  userId: string;
  userName: string;
  userEmail: string;
  oldValue: any;
  newValue: any;
  changedFields: string[];
  operationContext?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  await logEntityAudit({
    organizationId: params.organizationId,
    action: 'entity_updated',
    entityId: params.entityId,
    entityType: params.entityType,
    userId: params.userId,
    userName: params.userName,
    userEmail: params.userEmail,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: {
      oldValue: params.oldValue,
      newValue: params.newValue,
      changedFields: params.changedFields,
      operationContext: params.operationContext || 'manual_edit',
    },
  });
}

/**
 * Log entity deletion
 */
export async function logEntityDeleted(params: {
  organizationId: string;
  entityId: string;
  entityType: 'institution' | 'family' | 'person';
  userId: string;
  userName: string;
  userEmail: string;
  oldValue: any;
  operationContext?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  await logEntityAudit({
    organizationId: params.organizationId,
    action: 'entity_deleted',
    entityId: params.entityId,
    entityType: params.entityType,
    userId: params.userId,
    userName: params.userName,
    userEmail: params.userEmail,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: {
      oldValue: params.oldValue,
      operationContext: params.operationContext || 'manual_edit',
    },
  });
}

/**
 * Log entity read access (for sensitive operations)
 */
export async function logEntityRead(params: {
  organizationId: string;
  entityId: string;
  entityType: 'institution' | 'family' | 'person';
  userId: string;
  userName: string;
  userEmail: string;
  operationContext?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  await logEntityAudit({
    organizationId: params.organizationId,
    action: 'entity_read',
    entityId: params.entityId,
    entityType: params.entityType,
    userId: params.userId,
    userName: params.userName,
    userEmail: params.userEmail,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: {
      operationContext: params.operationContext || 'manual_access',
    },
  });
}

/**
 * Log workspace_entity creation
 */
export async function logWorkspaceEntityCreated(params: {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  entityType: 'institution' | 'family' | 'person';
  userId: string;
  userName: string;
  userEmail: string;
  newValue: any;
  operationContext?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  await logEntityAudit({
    organizationId: params.organizationId,
    workspaceId: params.workspaceId,
    action: 'workspace_entity_created',
    entityId: params.entityId,
    entityType: params.entityType,
    userId: params.userId,
    userName: params.userName,
    userEmail: params.userEmail,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: {
      newValue: params.newValue,
      operationContext: params.operationContext || 'manual_edit',
    },
  });
}

/**
 * Log workspace_entity update
 */
export async function logWorkspaceEntityUpdated(params: {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  entityType: 'institution' | 'family' | 'person';
  userId: string;
  userName: string;
  userEmail: string;
  oldValue: any;
  newValue: any;
  changedFields: string[];
  operationContext?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  await logEntityAudit({
    organizationId: params.organizationId,
    workspaceId: params.workspaceId,
    action: 'workspace_entity_updated',
    entityId: params.entityId,
    entityType: params.entityType,
    userId: params.userId,
    userName: params.userName,
    userEmail: params.userEmail,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: {
      oldValue: params.oldValue,
      newValue: params.newValue,
      changedFields: params.changedFields,
      operationContext: params.operationContext || 'manual_edit',
    },
  });
}

/**
 * Log workspace_entity deletion
 */
export async function logWorkspaceEntityDeleted(params: {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  entityType: 'institution' | 'family' | 'person';
  userId: string;
  userName: string;
  userEmail: string;
  oldValue: any;
  operationContext?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  await logEntityAudit({
    organizationId: params.organizationId,
    workspaceId: params.workspaceId,
    action: 'workspace_entity_deleted',
    entityId: params.entityId,
    entityType: params.entityType,
    userId: params.userId,
    userName: params.userName,
    userEmail: params.userEmail,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: {
      oldValue: params.oldValue,
      operationContext: params.operationContext || 'manual_edit',
    },
  });
}

/**
 * Log workspace_entity read access (for sensitive operations)
 */
export async function logWorkspaceEntityRead(params: {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  entityType: 'institution' | 'family' | 'person';
  userId: string;
  userName: string;
  userEmail: string;
  operationContext?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  await logEntityAudit({
    organizationId: params.organizationId,
    workspaceId: params.workspaceId,
    action: 'workspace_entity_read',
    entityId: params.entityId,
    entityType: params.entityType,
    userId: params.userId,
    userName: params.userName,
    userEmail: params.userEmail,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: {
      operationContext: params.operationContext || 'manual_access',
    },
  });
}

/**
 * Get entity audit logs with optional filters
 * 
 * @param organizationId - Organization ID to filter by
 * @param filters - Optional filters
 * @returns Promise resolving to audit logs
 */
export async function getEntityAuditLogs(
  organizationId: string,
  filters?: {
    workspaceId?: string;
    entityId?: string;
    userId?: string;
    action?: EntityAuditLog['action'];
    startDate?: string;
    endDate?: string;
    limit?: number;
  }
): Promise<{ success: boolean; data?: EntityAuditLog[]; error?: string }> {
  try {
    let query = adminDb
      .collection('entity_audit_logs')
      .where('organizationId', '==', organizationId) as FirebaseFirestore.Query;

    if (filters?.workspaceId) {
      query = query.where('workspaceId', '==', filters.workspaceId);
    }

    if (filters?.entityId) {
      query = query.where('entityId', '==', filters.entityId);
    }

    if (filters?.userId) {
      query = query.where('userId', '==', filters.userId);
    }

    if (filters?.action) {
      query = query.where('action', '==', filters.action);
    }

    if (filters?.startDate) {
      query = query.where('timestamp', '>=', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.where('timestamp', '<=', filters.endDate);
    }

    query = query.orderBy('timestamp', 'desc');

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const snapshot = await query.get();
    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as EntityAuditLog[];

    return { success: true, data: logs };
  } catch (error: any) {
    console.error('getEntityAuditLogs error:', error);
    return { success: false, error: error.message };
  }
}
