/**
 * {{Org_name}} Experience Platform — Portal Access Evaluation Service
 *
 * Implements the centralized access decision pipeline and safe public
 * projection serializer, preventing sensitive internal data leaks.
 *
 * Architecture Notes:
 * - Server & client safe (pure functions, zero side effects).
 * - Strictly typed (Zero any / any[]).
 * - Enforces Principle P3 (Entitlement-driven access).
 */

import { createHash } from 'crypto';
import type {
  Portal,
  PublicPortalProjection,
} from '../types/portal';

export type AccessDenialReason =
  | 'not_found'
  | 'draft'
  | 'suspended'
  | 'archived'
  | 'auth_required'
  | 'password_required'
  | 'invalid_password'
  | 'insufficient_role'
  | 'domain_restricted';

export interface AccessEvaluationContext {
  userId?: string;
  userEmail?: string;
  userRoles?: string[];
  isOrgAdmin?: boolean;
  isSystemAdmin?: boolean;
  passwordAttempt?: string;
}

export interface AccessDecision {
  allowed: boolean;
  reason?: AccessDenialReason;
  message?: string;
  suspendedReason?: string;
}

export class PortalAccessService {
  /**
   * Hashes a portal password using SHA-256 with a standard salt.
   */
  static hashPassword(password: string): string {
    const salt = 'smartsapp_portal_salt_v1';
    return createHash('sha256').update(`${salt}:${password.trim()}`).digest('hex');
  }

  /**
   * Verifies a plain text password attempt against a stored hash.
   */
  static verifyPassword(passwordAttempt: string, storedHash?: string): boolean {
    if (!storedHash) return false;
    const computedHash = this.hashPassword(passwordAttempt);
    return computedHash === storedHash;
  }

  /**
   * Evaluates the complete access decision pipeline for a portal and visitor context.
   */
  static evaluateAccess(
    portal: Portal | null | undefined,
    context: AccessEvaluationContext = {}
  ): AccessDecision {
    if (!portal) {
      return { allowed: false, reason: 'not_found', message: 'Portal not found.' };
    }

    const isPrivilegedAdmin = context.isSystemAdmin || context.isOrgAdmin;

    // 1. Check Status State Machine
    if (portal.status === 'archived') {
      return {
        allowed: false,
        reason: 'archived',
        message: 'This experience portal has been archived and is no longer active.',
      };
    }

    if (portal.status === 'suspended') {
      if (isPrivilegedAdmin) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'suspended',
        suspendedReason: portal.accessPolicy.suspendedReason || 'This portal is temporarily offline.',
        message: portal.accessPolicy.suspendedReason || 'This portal is temporarily offline.',
      };
    }

    if (portal.status === 'draft' || portal.status === 'configuring') {
      if (isPrivilegedAdmin) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'draft',
        message: 'This portal is currently in preparation and has not yet been published.',
      };
    }

    // 2. Published Portal Access Policies
    const policy = portal.accessPolicy;

    // Password Protection Check
    if (policy.passwordProtected && policy.passwordHash) {
      if (isPrivilegedAdmin) {
        return { allowed: true };
      }

      if (!context.passwordAttempt) {
        return {
          allowed: false,
          reason: 'password_required',
          message: 'A password is required to access this portal.',
        };
      }

      const isValidPassword = this.verifyPassword(context.passwordAttempt, policy.passwordHash);
      if (!isValidPassword) {
        return {
          allowed: false,
          reason: 'invalid_password',
          message: 'The password entered is incorrect.',
        };
      }

      // Password validated successfully
      return { allowed: true };
    }

    // Authentication Requirement Check
    if (policy.requireAuth || policy.visibility === 'authenticated' || policy.visibility === 'membership_required') {
      if (!context.userId) {
        return {
          allowed: false,
          reason: 'auth_required',
          message: 'Please sign in to access this portal.',
        };
      }

      // Email Domain Restrictions
      if (policy.allowedEmailDomains && policy.allowedEmailDomains.length > 0) {
        if (!context.userEmail) {
          return { allowed: false, reason: 'domain_restricted', message: 'Unauthorized email domain.' };
        }
        const userDomain = context.userEmail.split('@')[1]?.toLowerCase();
        const isAllowedDomain = policy.allowedEmailDomains.some(d => d.toLowerCase() === userDomain);
        if (!isAllowedDomain && !isPrivilegedAdmin) {
          return {
            allowed: false,
            reason: 'domain_restricted',
            message: `Access is restricted to specific organization email domains.`,
          };
        }
      }

      // Role Restrictions
      if (policy.allowedRoles && policy.allowedRoles.length > 0) {
        const userRoles = context.userRoles || [];
        const hasRequiredRole = policy.allowedRoles.some(role => userRoles.includes(role));
        if (!hasRequiredRole && !isPrivilegedAdmin) {
          return {
            allowed: false,
            reason: 'insufficient_role',
            message: 'You do not have the required permissions to view this portal.',
          };
        }
      }

      return { allowed: true };
    }

    // Public Portal
    return { allowed: true };
  }

  /**
   * Generates a sanitized public projection of a Portal.
   * Strips all internal security tokens and administrative data.
   */
  static serializePublicPortal(portal: Portal): PublicPortalProjection {
    return {
      id: portal.id,
      organizationId: portal.organizationId,
      name: portal.name,
      slug: portal.slug,
      description: portal.description,
      primaryMode: portal.primaryMode,
      enabledModes: portal.enabledModes || [portal.primaryMode],
      status: portal.status,
      visibility: portal.visibility,
      branding: {
        brandName: portal.branding.brandName || portal.name,
        tagline: portal.branding.tagline,
        logoUrl: portal.branding.logoUrl,
        darkLogoUrl: portal.branding.darkLogoUrl,
        faviconUrl: portal.branding.faviconUrl,
        coverImageUrl: portal.branding.coverImageUrl,
        copyrightText: portal.branding.copyrightText,
      },
      theme: {
        colors: portal.theme.colors,
        typography: portal.theme.typography,
        ui: portal.theme.ui,
        colorMode: portal.theme.colorMode,
        customCssVariables: portal.theme.customCssVariables,
      },
      navigation: {
        headerItems: portal.navigation.headerItems || [],
        headerActions: portal.navigation.headerActions || { showLoginButton: false, showSearch: false },
        sidebarItems: portal.navigation.sidebarItems || [],
        footerColumns: portal.navigation.footerColumns || [],
        socialLinks: portal.navigation.socialLinks || [],
      },
      features: portal.features,
      seo: portal.seo,
      homeLayout: portal.homeLayout || 'hero_grid',
      isPasswordProtected: Boolean(portal.accessPolicy.passwordProtected && portal.accessPolicy.passwordHash),
      requiresAuth: Boolean(portal.accessPolicy.requireAuth || portal.accessPolicy.visibility === 'authenticated'),
    };
  }
}
