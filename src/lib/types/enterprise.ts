/**
 * {{Org_name}} Experience Platform — Enterprise, Scale & Marketplace Domain Types
 *
 * Strict TypeScript models for Enterprise SSO (SAML/OIDC), White-Labeling,
 * Multi-Level Organization Hierarchy, Multi-Portal Fleet, Marketplace Listings,
 * and Enterprise Audit Logging.
 * Zero `any` or `any[]` typing.
 */

export type SsoProvider = 'saml' | 'oidc' | 'google_workspace' | 'microsoft_entra';

export type SsoStatus = 'active' | 'pending_verification' | 'inactive';

export type HierarchyNodeType = 'enterprise' | 'region' | 'branch' | 'department' | 'team';

export type MarketplaceCategory =
  | 'education'
  | 'corporate_training'
  | 'coaching'
  | 'community_hub'
  | 'certification';

export type MarketplaceListingType = 'portal_template' | 'curriculum_package';

export interface SystemTerminologyConfig {
  course: string;
  courses: string;
  lesson: string;
  instructor: string;
  student: string;
  certificate: string;
  community: string;
}

export interface EnterpriseSsoConfig {
  id: string;
  organizationId: string;
  portalId: string;
  provider: SsoProvider;
  domain: string;
  issuerUrl: string;
  ssoLoginUrl: string;
  clientId?: string;
  certificateFingerprint?: string;
  autoProvisionRoles: string[];
  enforceSsoOnly: boolean;
  status: SsoStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EnterpriseWhiteLabelConfig {
  id: string;
  organizationId: string;
  portalId: string;
  customDomain?: string;
  cnameTarget?: string;
  sslStatus: 'active' | 'pending' | 'failed';
  customLoginHeadline?: string;
  customLoginSubheadline?: string;
  customSenderEmail?: string;
  customFooterHtml?: string;
  systemTerminology: SystemTerminologyConfig;
  createdAt: string;
  updatedAt: string;
}

export interface OrgHierarchyNode {
  id: string;
  organizationId: string;
  name: string;
  type: HierarchyNodeType;
  parentId?: string;
  assignedMemberCount: number;
  leadName?: string;
  leadEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceListing {
  id: string;
  title: string;
  description: string;
  category: MarketplaceCategory;
  listingType: MarketplaceListingType;
  iconEmoji: string;
  previewImageUrl?: string;
  price: number;
  currency: string;
  rating: number;
  installCount: number;
  isFeatured: boolean;
  templateData: {
    themePresetName?: string;
    navigation: Array<{ label: string; path: string; icon?: string }>;
    curriculumSummary?: Array<{ title: string; lessonCount: number }>;
  };
  createdAt: string;
  updatedAt: string;
}

export interface EnterpriseAuditLog {
  id: string;
  organizationId: string;
  portalId?: string;
  actorUserId: string;
  actorEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress?: string;
  timestamp: string;
  details: Record<string, string | number | boolean>;
}

// ── Input Types ─────────────────────────────────────────────────────────────

export interface SaveEnterpriseSsoInput {
  organizationId: string;
  portalId: string;
  provider: SsoProvider;
  domain: string;
  issuerUrl: string;
  ssoLoginUrl: string;
  clientId?: string;
  certificateFingerprint?: string;
  autoProvisionRoles?: string[];
  enforceSsoOnly?: boolean;
}

export interface SaveWhiteLabelConfigInput {
  organizationId: string;
  portalId: string;
  customDomain?: string;
  cnameTarget?: string;
  customLoginHeadline?: string;
  customLoginSubheadline?: string;
  customSenderEmail?: string;
  customFooterHtml?: string;
  systemTerminology?: Partial<SystemTerminologyConfig>;
}

export interface CreateHierarchyNodeInput {
  organizationId: string;
  name: string;
  type: HierarchyNodeType;
  parentId?: string;
  leadName?: string;
  leadEmail?: string;
}
