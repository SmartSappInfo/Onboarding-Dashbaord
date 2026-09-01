/**
 * @fileOverview Core Authorization Engine (Authorization 2.0)
 *
 * Orchestrates RBAC schema checks, ABAC policy enforcement, natural-language
 * access explanation, and dry-run access simulation.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Single point of entry for checking permissions, explaining access paths, and simulating role blueprints.
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 *
 * @testability Covered in `authorization-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  Role,
  PermissionsSchema,
  AppPermissionId,
  AccessEvaluationResult,
  AccessExplanation,
  AccessGrantHierarchyNode,
  AccessSimulationRequest,
  AccessSimulationResult,
  PolicyRule,
  UserProfile,
} from '@/lib/types';
import {
  evaluatePermission,
  mergePermissionsSchemas,
  flattenPermissionsSchema,
  normalizePermissionsSchema,
  getBlankPermissions,
} from '@/lib/permissions-engine';
import { PermissionRegistryService } from './permission-registry-service';
import { PolicyEngineService, EvaluationContext } from './policy-engine-service';
import { WorkspaceMembershipService } from '@/lib/services/identity/workspace-membership-service';

export class AuthorizationService {
  /**
   * Checks if an actor is authorized to perform an action on a resource.
   */
  static async checkPermission(params: {
    actorId: string;
    organizationId: string;
    permissionId: string; // e.g. "operations.campuses.create"
    workspaceId?: string;
    resourceContext?: EvaluationContext['resource'];
  }): Promise<AccessEvaluationResult> {
    const { actorId, organizationId, permissionId, workspaceId, resourceContext } = params;

    // 1. Fetch actor profile
    const userDoc = await adminDb.collection('users').doc(actorId).get();
    if (!userDoc.exists) {
      return {
        isAllowed: false,
        grantedByRoles: [],
        matchedPolicies: [],
        reasons: ['Actor profile not found'],
        evaluationDurationMs: 0,
      };
    }

    const profile = { id: userDoc.id, ...userDoc.data() } as UserProfile;

    // Super Admin Bypass
    if (profile.email === 'admin@smartsapp.com' || profile.permissions?.includes('system_admin')) {
      return {
        isAllowed: true,
        grantedByRoles: ['builtin-super-admin'],
        matchedPolicies: [],
        reasons: ['System Super Administrator override'],
        evaluationDurationMs: 0,
      };
    }

    // Account authorization check
    if (!profile.isAuthorized) {
      return {
        isAllowed: false,
        grantedByRoles: [],
        matchedPolicies: [],
        reasons: ['Account is inactive or pending approval'],
        evaluationDurationMs: 0,
      };
    }

    // 2. Parse permission coordinates
    const parts = permissionId.split('.');
    const section = parts[0] as keyof PermissionsSchema;
    const feature = parts[1];
    const action = (parts[2] || 'view') as 'view' | 'create' | 'edit' | 'delete';

    // 3. Resolve effective schema for target workspace or global
    let effectiveSchema: PermissionsSchema;
    let activeRoleIds: string[] = [];

    if (workspaceId && profile.workspacePermissionsSchemas?.[workspaceId]) {
      effectiveSchema = normalizePermissionsSchema(profile.workspacePermissionsSchemas[workspaceId]);
      activeRoleIds = profile.workspaceRoles?.[workspaceId] || [];
    } else if (profile.permissionsSchema) {
      effectiveSchema = normalizePermissionsSchema(profile.permissionsSchema);
      activeRoleIds = profile.roles || [];
    } else {
      effectiveSchema = getBlankPermissions();
    }

    // 4. Base RBAC check
    const rbacAllowed = evaluatePermission(effectiveSchema, section, feature, action);

    // 5. Fetch and evaluate ABAC policies
    const policiesSnap = await adminDb
      .collection('policies')
      .where('organizationId', '==', organizationId)
      .where('status', '==', 'active')
      .get();

    const policies: PolicyRule[] = policiesSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as PolicyRule)
    );

    const evalContext: EvaluationContext = {
      actor: {
        uid: actorId,
        organizationId,
        workspaceId,
        department: profile.department,
        roles: activeRoleIds,
      },
      resource: resourceContext,
      action: permissionId,
    };

    return PolicyEngineService.evaluatePolicies(policies, evalContext, rbacAllowed);
  }

  /**
   * Produces a visual and textual audit explanation of why a person has or does not have access.
   */
  static async explainAccess(params: {
    personId: string;
    organizationId: string;
    permissionId: string; // e.g. "operations.pipeline.delete"
    workspaceId?: string;
  }): Promise<AccessExplanation> {
    const { personId, organizationId, permissionId, workspaceId } = params;

    const [userDoc, rolesSnap, wsMemberships] = await Promise.all([
      adminDb.collection('users').doc(personId).get(),
      adminDb.collection('roles').where('organizationId', '==', organizationId).get(),
      WorkspaceMembershipService.listWorkspaceMembershipsByPerson(organizationId, personId),
    ]);

    const profile = userDoc.exists ? ({ id: userDoc.id, ...userDoc.data() } as UserProfile) : null;
    const personName = profile?.name || 'Unknown User';

    const rolesMap = new Map<string, Role>();
    rolesSnap.docs.forEach((d) => rolesMap.set(d.id, { id: d.id, ...d.data() } as Role));

    const parts = permissionId.split('.');
    const section = parts[0] as keyof PermissionsSchema;
    const feature = parts[1];
    const action = (parts[2] || 'view') as 'view' | 'create' | 'edit' | 'delete';

    const grantHierarchy: AccessGrantHierarchyNode[] = [];
    let hasAccess = false;

    // Check workspace roles
    const targetWsMems = workspaceId
      ? wsMemberships.filter((w) => w.workspaceId === workspaceId)
      : wsMemberships;

    for (const wsMem of targetWsMems) {
      for (const rId of wsMem.roleAssignmentIds || []) {
        const rObj = rolesMap.get(rId);
        if (rObj?.permissionsSchema) {
          const norm = normalizePermissionsSchema(rObj.permissionsSchema);
          if (evaluatePermission(norm, section, feature, action)) {
            hasAccess = true;
            grantHierarchy.push({
              roleId: rId,
              roleName: rObj.name,
              section,
              feature,
              action,
              scope: `Workspace: ${wsMem.workspaceName || wsMem.workspaceId}`,
            });
          }
        }
      }
    }

    // Check global roles
    for (const rId of profile?.roles || []) {
      const rObj = rolesMap.get(rId);
      if (rObj?.permissionsSchema) {
        const norm = normalizePermissionsSchema(rObj.permissionsSchema);
        if (evaluatePermission(norm, section, feature, action)) {
          hasAccess = true;
          grantHierarchy.push({
            roleId: rId,
            roleName: rObj.name,
            section,
            feature,
            action,
            scope: 'Organization Global',
          });
        }
      }
    }

    let explanationText = '';
    if (hasAccess) {
      const roleNames = Array.from(new Set(grantHierarchy.map((g) => g.roleName))).join(', ');
      explanationText = `${personName} is GRANTED '${permissionId}' via assigned role(s): ${roleNames}.`;
    } else {
      explanationText = `${personName} is NOT granted '${permissionId}' because no assigned role contains '${action}' on '${section}.${feature}'.`;
    }

    return {
      personId,
      personName,
      permissionId,
      workspaceId: workspaceId || 'global',
      hasAccess,
      grantHierarchy,
      policyConstraints: [],
      explanationText,
    };
  }

  /**
   * Dry-run simulation of combining arbitrary roles and mock policies.
   */
  static async simulateAccess(
    organizationId: string,
    request: AccessSimulationRequest
  ): Promise<AccessSimulationResult> {
    const rolesSnap = await adminDb
      .collection('roles')
      .where('organizationId', '==', organizationId)
      .get();

    const rolesMap = new Map<string, Role>();
    rolesSnap.docs.forEach((d) => rolesMap.set(d.id, { id: d.id, ...d.data() } as Role));

    const selectedSchemas: PermissionsSchema[] = [];
    for (const rId of request.roleIds) {
      const role = rolesMap.get(rId);
      if (role?.permissionsSchema) {
        selectedSchemas.push(normalizePermissionsSchema(role.permissionsSchema));
      }
    }

    const mergedSchema =
      selectedSchemas.length > 0 ? mergePermissionsSchemas(selectedSchemas) : getBlankPermissions();
    const flattenedPermissions = flattenPermissionsSchema(mergedSchema) as AppPermissionId[];

    const grantedActions: string[] = [];
    const deniedActions: string[] = [];

    const targetActions = request.targetActions || PermissionRegistryService.getAllPermissions().map((p) => p.id);

    targetActions.forEach((act) => {
      const parts = act.split('.');
      const section = parts[0] as keyof PermissionsSchema;
      const feature = parts[1];
      const action = (parts[2] || 'view') as 'view' | 'create' | 'edit' | 'delete';

      if (evaluatePermission(mergedSchema, section, feature, action)) {
        grantedActions.push(act);
      } else {
        deniedActions.push(act);
      }
    });

    const metrics = PermissionRegistryService.calculateRiskMetrics(mergedSchema);

    return {
      mergedSchema,
      flattenedPermissions,
      grantedActions,
      deniedActions,
      capabilitySummary: metrics.capabilitySummary,
      riskBreakdown: metrics.riskBreakdown,
    };
  }
}
