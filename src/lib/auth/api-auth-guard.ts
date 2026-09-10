/**
 * @fileOverview Standardized API Authentication & Multi-Tenant Authorization Guard
 *
 * Verifies incoming HTTP Request Firebase ID Tokens, validates user authorization status,
 * and enforces strict tenant/workspace isolation boundaries.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Why this exists: REST API route handlers (`route.ts`) in Next.js execute in server runtime.
 *   Without explicit token verification, routes using `adminDb` bypass Firestore security rules.
 * - Usage Pattern: Call `authenticateApiRequest(request, { requiredWorkspaceId, requiredOrgId })`
 *   at the start of any internal API route handler.
 * - System Admins: Platform administrators (`permissions: ['system_admin']`) have superuser
 *   cross-tenant access. Standard workspace operators are restricted to their assigned tenants.
 * - Zero `any` or `any[]` typing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import type { UserProfile } from '@/lib/types';
import { hasPlatformAdminClaim } from '@/lib/auth/platform-admin';

export interface AuthenticatedUserContext {
  uid: string;
  email: string | null;
  profile: UserProfile;
  isSystemAdmin: boolean;
}

export interface ApiAuthGuardOptions {
  requiredWorkspaceId?: string;
  requiredOrgId?: string;
  requireSystemAdmin?: boolean;
}

export type ApiAuthResult =
  | { success: true; user: AuthenticatedUserContext; errorResponse?: never }
  | { success: false; user?: never; errorResponse: NextResponse };

/**
 * Authenticates an incoming NextRequest and verifies workspace / organization permissions.
 *
 * @param request The incoming NextRequest
 * @param options Optional workspace, organization, or admin requirement
 * @returns An `ApiAuthResult` containing either the verified user context or a ready-to-return error `NextResponse`.
 */
export async function authenticateApiRequest(
  request: NextRequest | Request,
  options?: ApiAuthGuardOptions
): Promise<ApiAuthResult> {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Missing or malformed Bearer authorization token.' },
        { status: 401 }
      ),
    };
  }

  const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!idToken) {
    return {
      success: false,
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Empty token provided.' },
        { status: 401 }
      ),
    };
  }

  let uid: string;
  let email: string | null = null;
  let isPlatformAdmin = false;

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    uid = decodedToken.uid;
    email = decodedToken.email ?? null;
    // Capture the platform-admin claim here: decodedToken is scoped to this block
    // (audit F8).
    isPlatformAdmin = hasPlatformAdminClaim(decodedToken);
  } catch (authErr: unknown) {
    const errMessage = authErr instanceof Error ? authErr.message : 'Invalid session token';
    console.warn(`[API_AUTH_GUARD] Token verification failed: ${errMessage}`);
    return {
      success: false,
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Invalid or expired authentication token.' },
        { status: 401 }
      ),
    };
  }

  // Load user profile from Firestore to verify system authorization & tenant assignment
  try {
    const userDoc = await adminDb.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      // SECURITY (audit F8): a bootstrap branch used to fabricate a system-admin profile
      // here for any token carrying a hardcoded email address, even with no user record.
      // That made platform admin unrevocable by account deactivation. It is removed:
      // a caller with no profile is refused, and platform admin is the signed `admin`
      // custom claim instead (see @/lib/auth/platform-admin).

      return {
        success: false,
        errorResponse: NextResponse.json(
          { error: 'Forbidden: User profile not registered in the system.' },
          { status: 403 }
        ),
      };
    }

    const profile = { id: userDoc.id, ...userDoc.data() } as UserProfile;

    // Check account authorization status
    if (!profile.isAuthorized) {
      return {
        success: false,
        errorResponse: NextResponse.json(
          { error: 'Forbidden: User account is pending administrator approval or inactive.' },
          { status: 403 }
        ),
      };
    }

    const isSystemAdmin = Boolean(
      isPlatformAdmin || profile.permissions?.includes('system_admin')
    );

    // Require platform system admin if specified
    if (options?.requireSystemAdmin && !isSystemAdmin) {
      return {
        success: false,
        errorResponse: NextResponse.json(
          { error: 'Forbidden: Platform system administrator privileges required.' },
          { status: 403 }
        ),
      };
    }

    // Tenant Organization check (system admins bypass)
    if (options?.requiredOrgId && !isSystemAdmin) {
      if (profile.organizationId !== options.requiredOrgId) {
        return {
          success: false,
          errorResponse: NextResponse.json(
            { error: 'Forbidden: Access to requested organization is denied.' },
            { status: 403 }
          ),
        };
      }
    }

    // Workspace membership check (system admins bypass)
    if (options?.requiredWorkspaceId && !isSystemAdmin) {
      const userWorkspaces = profile.workspaceIds || [];
      if (!userWorkspaces.includes(options.requiredWorkspaceId)) {
        return {
          success: false,
          errorResponse: NextResponse.json(
            { error: 'Forbidden: Access to requested workspace is denied.' },
            { status: 403 }
          ),
        };
      }
    }

    return {
      success: true,
      user: {
        uid,
        email,
        profile,
        isSystemAdmin,
      },
    };
  } catch (dbErr: unknown) {
    const errorMsg = dbErr instanceof Error ? dbErr.message : 'Database error during authorization check';
    console.error('[API_AUTH_GUARD] Profile lookup error:', dbErr);
    return {
      success: false,
      errorResponse: NextResponse.json(
        { error: `Internal server error during authorization verification: ${errorMsg}` },
        { status: 500 }
      ),
    };
  }
}
