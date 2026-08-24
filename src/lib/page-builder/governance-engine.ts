/**
 * @file src/lib/page-builder/governance-engine.ts
 * @description Enterprise Governance & RBAC Guard Engine for SmartSapp Page Builder.
 * Evaluates team role permissions (`studios_view`, `studios_edit`, `studios_publish`, `studios_admin`),
 * multi-tenant organization boundaries, and mandatory publish approval workflows.
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - Pure function design for zero-latency client/server permission evaluation.
 * - Testable utility pure functions.
 */

import type { ApprovalRequest, BuilderPermission } from '@/lib/types';

/**
 * Checks if user holds a specific builder permission or administrative override.
 * 
 * TESTABILITY POINTER:
 * Pass various permission arrays (e.g. ['studios_view', 'studios_edit']) and verify
 * that 'studios_publish' evaluates to false while 'studios_edit' evaluates to true.
 */
export function hasBuilderPermission(
  userPermissions: string[],
  required: BuilderPermission,
): boolean {
  if (!userPermissions || userPermissions.length === 0) {
    return false;
  }

  // Admin role automatically grants all builder permissions
  if (userPermissions.includes('studios_admin') || userPermissions.includes('system_admin')) {
    return true;
  }

  return userPermissions.includes(required);
}

/**
 * Evaluates whether a user can directly publish a landing page or if an ApprovalRequest is required.
 */
export function evaluatePublishEligibility(
  requiresApproval: boolean,
  userPermissions: string[],
  activeApprovalRequest?: ApprovalRequest,
): {
  canPublish: boolean;
  requiresApprovalRequest: boolean;
  reason?: string;
} {
  const isPublisher = hasBuilderPermission(userPermissions, 'studios_publish');
  const isAdmin = hasBuilderPermission(userPermissions, 'studios_admin');

  if (!isPublisher) {
    return {
      canPublish: false,
      requiresApprovalRequest: false,
      reason: 'Insufficient permissions. You require the studios_publish role to publish pages.',
    };
  }

  // Direct publish permitted if page does not mandate approval or user is admin
  if (!requiresApproval || isAdmin) {
    return {
      canPublish: true,
      requiresApprovalRequest: false,
    };
  }

  // Page requires approval and user is a standard publisher
  if (!activeApprovalRequest) {
    return {
      canPublish: false,
      requiresApprovalRequest: true,
      reason: 'This landing page mandates approval before publishing. Submit an approval request for admin review.',
    };
  }

  if (activeApprovalRequest.status === 'approved') {
    return {
      canPublish: true,
      requiresApprovalRequest: false,
    };
  }

  if (activeApprovalRequest.status === 'rejected') {
    return {
      canPublish: false,
      requiresApprovalRequest: true,
      reason: 'The previous publish approval request was rejected. Submit a revised request for review.',
    };
  }

  return {
    canPublish: false,
    requiresApprovalRequest: false,
    reason: 'Publish approval request is pending admin review.',
  };
}
