/**
 * {{Org_name}} Experience Platform — Membership, Identity & Entitlement Types
 *
 * Universal domain models for multi-tier membership, portal identity,
 * cryptographic invitations, membership plans, and access grants.
 *
 * Architecture Notes:
 * - Strictly typed (Zero any / any[]).
 * - Multi-tenant isolation: Scoped by organizationId, portalId, and workspaceIds.
 * - Centralized authorization contract for EntitlementService.
 */

// ── 1. Roles & Status Enums ──────────────────────────────────────────────────

export type PortalMemberRole =
  | 'owner'
  | 'admin'
  | 'instructor'
  | 'moderator'
  | 'content_editor'
  | 'member'
  | 'student'
  | 'guest';

export type MembershipStatus =
  | 'active'
  | 'invited'
  | 'pending_verification'
  | 'suspended'
  | 'expired'
  | 'canceled';

export type PlanBillingInterval =
  | 'one_time'
  | 'monthly'
  | 'annual'
  | 'lifetime';

export type GrantType =
  | 'membership_plan'
  | 'one_time_purchase'
  | 'invitation'
  | 'manual_admin_grant'
  | 'cohort_enrollment';

export type ResourceType =
  | 'portal'
  | 'course'
  | 'module'
  | 'lesson'
  | 'content_item'
  | 'community_space'
  | 'resource_vault';

export type InvitationStatus =
  | 'pending'
  | 'accepted'
  | 'expired'
  | 'revoked';

// ── 2. Portal Membership Model ───────────────────────────────────────────────

export interface MemberPointsHistory {
  action: string;
  points: number;
  timestamp: string;
  referenceId?: string;
}

export interface MemberBadge {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  awardedAt: string;
}

export interface PortalMembership {
  id: string;
  organizationId: string;
  portalId: string;
  workspaceIds: string[];
  userId: string;
  contactId?: string; // Two-way reference to CRM Contact
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: PortalMemberRole;
  status: MembershipStatus;
  planId?: string;
  planName?: string;
  joinedAt: string;
  lastActiveAt: string;
  points: number;
  streakDays: number;
  badges: MemberBadge[];
  pointsHistory?: MemberPointsHistory[];
  completedLessonIds: string[];
  enrolledCourseIds: string[];
  bookmarkedContentIds: string[];
  customFields?: Record<string, string | number | boolean | null>;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// ── 3. Portal Invitation Model ───────────────────────────────────────────────

export interface PortalInvitation {
  id: string;
  organizationId: string;
  portalId: string;
  workspaceIds: string[];
  email?: string; // Nullable for multi-use shareable links
  token: string;
  role: PortalMemberRole;
  planId?: string;
  assignedCourseIds?: string[];
  maxUses: number;
  usedCount: number;
  expiresAt?: string;
  status: InvitationStatus;
  note?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ── 4. Membership Plan / Tier Model ──────────────────────────────────────────

export interface MembershipPlan {
  id: string;
  organizationId: string;
  portalId: string;
  workspaceIds: string[];
  name: string;
  slug: string;
  description?: string;
  price: number; // 0 for Free tier
  currency: string; // e.g. GHS, USD, EUR
  interval: PlanBillingInterval;
  trialDays?: number;
  features: string[];
  badgeText?: string;
  isPopular?: boolean;
  order: number;
  status: 'active' | 'archived';
  unlockedResourceIds?: string[];
  unlockedCourseIds?: string[];
  unlockedSpaceIds?: string[];
  createdAt: string;
  updatedAt: string;
}

// ── 5. Access Grant Model ────────────────────────────────────────────────────

export interface AccessGrant {
  id: string;
  organizationId: string;
  portalId: string;
  membershipId: string;
  userId: string;
  grantType: GrantType;
  resourceType: ResourceType;
  resourceId: string;
  grantedAt: string;
  expiresAt?: string;
  grantedBy: string;
  notes?: string;
  createdAt: string;
}

// ── 6. Entitlement Evaluation Result ─────────────────────────────────────────

export interface EntitlementCheckResult {
  hasAccess: boolean;
  reason:
    | 'admin_bypass'
    | 'plan_entitlement'
    | 'direct_grant'
    | 'public_access'
    | 'no_entitlement'
    | 'membership_inactive'
    | 'grant_expired';
  membership?: PortalMembership | null;
  grant?: AccessGrant | null;
  matchedPlan?: MembershipPlan | null;
  requiredPlanName?: string;
}

// ── 7. Input / Mutation Contracts ────────────────────────────────────────────

export interface CreateMembershipInput {
  organizationId: string;
  portalId: string;
  workspaceIds: string[];
  userId: string;
  contactId?: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role?: PortalMemberRole;
  status?: MembershipStatus;
  planId?: string;
  planName?: string;
  customFields?: Record<string, string | number | boolean | null>;
  tags?: string[];
}

export interface UpdateMembershipInput {
  displayName?: string;
  avatarUrl?: string;
  role?: PortalMemberRole;
  status?: MembershipStatus;
  planId?: string;
  planName?: string;
  points?: number;
  streakDays?: number;
  customFields?: Record<string, string | number | boolean | null>;
  tags?: string[];
}

export interface CreateInvitationInput {
  organizationId: string;
  portalId: string;
  workspaceIds: string[];
  email?: string;
  role?: PortalMemberRole;
  planId?: string;
  assignedCourseIds?: string[];
  maxUses?: number;
  expiresAt?: string;
  note?: string;
}

export interface CreatePlanInput {
  organizationId: string;
  portalId: string;
  workspaceIds: string[];
  name: string;
  slug?: string;
  description?: string;
  price: number;
  currency?: string;
  interval?: PlanBillingInterval;
  trialDays?: number;
  features?: string[];
  badgeText?: string;
  isPopular?: boolean;
  order?: number;
  unlockedResourceIds?: string[];
  unlockedCourseIds?: string[];
  unlockedSpaceIds?: string[];
}

export interface UpdatePlanInput {
  name?: string;
  slug?: string;
  description?: string;
  price?: number;
  currency?: string;
  interval?: PlanBillingInterval;
  trialDays?: number;
  features?: string[];
  badgeText?: string;
  isPopular?: boolean;
  order?: number;
  status?: 'active' | 'archived';
  unlockedResourceIds?: string[];
  unlockedCourseIds?: string[];
  unlockedSpaceIds?: string[];
}

export interface GrantAccessInput {
  organizationId: string;
  portalId: string;
  membershipId: string;
  userId: string;
  grantType: GrantType;
  resourceType: ResourceType;
  resourceId: string;
  expiresAt?: string;
  notes?: string;
}

export interface MemberFilterOptions {
  role?: PortalMemberRole;
  status?: MembershipStatus;
  planId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}
