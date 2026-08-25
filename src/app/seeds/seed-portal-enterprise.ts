/**
 * {{Org_name}} Experience Platform — Enterprise, Scale & Marketplace Seeder
 *
 * Seeds Enterprise SSO, White-Labeling configs, Organizational Hierarchy trees,
 * Marketplace blueprints, and initial Compliance Audit Logs.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  EnterpriseSsoConfig,
  EnterpriseWhiteLabelConfig,
  OrgHierarchyNode,
  MarketplaceListing,
  EnterpriseAuditLog,
} from '@/lib/types/enterprise';

export async function seedPortalEnterprise(
  portalId: string,
  organizationId: string
): Promise<void> {
  const now = new Date().toISOString();

  // 1. Seed Enterprise SSO Config
  const ssoRef = adminDb.collection('enterprise_sso_configs').doc(`sso_${portalId}`);
  const ssoConfig: EnterpriseSsoConfig = {
    id: ssoRef.id,
    organizationId,
    portalId,
    provider: 'saml',
    domain: 'schoolbursar.org',
    issuerUrl: 'https://login.microsoftonline.com/smartsapp-tenant/saml2',
    ssoLoginUrl: 'https://login.microsoftonline.com/smartsapp-tenant/saml2/login',
    autoProvisionRoles: ['member', 'student'],
    enforceSsoOnly: false,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  await ssoRef.set(ssoConfig, { merge: true });

  // 2. Seed Enterprise White-Label Config
  const wlRef = adminDb.collection('enterprise_whitelabel_configs').doc(`wl_${portalId}`);
  const wlConfig: EnterpriseWhiteLabelConfig = {
    id: wlRef.id,
    organizationId,
    portalId,
    customDomain: 'academy.schoolbursar.org',
    cnameTarget: 'cname.smartsapp.com',
    sslStatus: 'active',
    customLoginHeadline: 'Welcome to the Executive School Bursary Academy',
    customLoginSubheadline: 'Secure single sign-on for accredited educational administrators',
    customSenderEmail: 'dean@schoolbursar.org',
    systemTerminology: {
      course: 'Executive Module',
      courses: 'Executive Modules',
      lesson: 'Practical Brief',
      instructor: 'Lead Dean',
      student: 'Bursar Scholar',
      certificate: 'Conferred Credential',
      community: 'Bursar Forum',
    },
    createdAt: now,
    updatedAt: now,
  };
  await wlRef.set(wlConfig, { merge: true });

  // 3. Seed 3-Tier Organizational Hierarchy
  const rootNodeRef = adminDb.collection('org_hierarchy_nodes').doc(`org_node_${organizationId}_hq`);
  const rootNode: OrgHierarchyNode = {
    id: rootNodeRef.id,
    organizationId,
    name: 'Ghana Educational Administration Service (HQ)',
    type: 'enterprise',
    assignedMemberCount: 142,
    leadName: 'Dr. Kwabena Asante',
    leadEmail: 'k.asante@schoolbursar.org',
    createdAt: now,
    updatedAt: now,
  };
  await rootNodeRef.set(rootNode, { merge: true });

  const regionNodeRef = adminDb.collection('org_hierarchy_nodes').doc(`org_node_${organizationId}_accra`);
  const regionNode: OrgHierarchyNode = {
    id: regionNodeRef.id,
    organizationId,
    name: 'Greater Accra Regional Division',
    type: 'region',
    parentId: rootNodeRef.id,
    assignedMemberCount: 86,
    leadName: 'Ebenezer Mensah',
    leadEmail: 'e.mensah@schoolbursar.org',
    createdAt: now,
    updatedAt: now,
  };
  await regionNodeRef.set(regionNode, { merge: true });

  const deptNodeRef = adminDb.collection('org_hierarchy_nodes').doc(`org_node_${organizationId}_bursary`);
  const deptNode: OrgHierarchyNode = {
    id: deptNodeRef.id,
    organizationId,
    name: 'Bursary & Financial Audit Department',
    type: 'department',
    parentId: regionNodeRef.id,
    assignedMemberCount: 44,
    leadName: 'Kofi Owusu-Ansah',
    leadEmail: 'kofi.owusu@school.edu.gh',
    createdAt: now,
    updatedAt: now,
  };
  await deptNodeRef.set(deptNode, { merge: true });

  // 4. Seed 4 Curated Marketplace Blueprints
  const listings: MarketplaceListing[] = [
    {
      id: 'blueprint_executive_academy',
      title: 'Executive Bursar & School Admin Academy',
      description: 'Comprehensive high-stakes curriculum template with financial reconciliation spreadsheets, automated certification, and private discussion spaces.',
      category: 'education',
      listingType: 'portal_template',
      iconEmoji: '🎓',
      price: 0,
      currency: 'USD',
      rating: 4.95,
      installCount: 1240,
      isFeatured: true,
      templateData: {
        themePresetName: 'emerald_executive',
        navigation: [
          { label: 'Overview', path: '/' },
          { label: 'Curriculum', path: '/learn' },
          { label: 'Community', path: '/community' },
          { label: 'Live Masterclasses', path: '/events' },
        ],
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'blueprint_corporate_ld',
      title: 'Enterprise Corporate L&D University',
      description: 'Pre-configured employee onboarding and compliance training academy with SCORM/xAPI statement emission and department cohort tracking.',
      category: 'corporate_training',
      listingType: 'portal_template',
      iconEmoji: '🏢',
      price: 0,
      currency: 'USD',
      rating: 4.88,
      installCount: 890,
      isFeatured: true,
      templateData: {
        themePresetName: 'navy_corporate',
        navigation: [
          { label: 'Dashboard', path: '/' },
          { label: 'Training Paths', path: '/learn' },
          { label: 'Certifications', path: '/credentials' },
        ],
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'blueprint_saas_university',
      title: 'SaaS Customer Academy & Community',
      description: 'Customer success portal blueprint with video walkthroughs, feature changelog feed, gamification badges, and product masterclasses.',
      category: 'community_hub',
      listingType: 'portal_template',
      iconEmoji: '⚡',
      price: 0,
      currency: 'USD',
      rating: 4.92,
      installCount: 2150,
      isFeatured: true,
      templateData: {
        themePresetName: 'indigo_modern',
        navigation: [
          { label: 'Home', path: '/' },
          { label: 'Getting Started', path: '/learn' },
          { label: 'Forum', path: '/community' },
          { label: 'Webinars', path: '/events' },
        ],
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'blueprint_certification_center',
      title: 'Accredited Professional Certification Hub',
      description: 'Strict exam-proctored certification portal with Open Badges 3.0 W3C JSON-LD verifiable credential exports and public QR verification pages.',
      category: 'certification',
      listingType: 'portal_template',
      iconEmoji: '🏅',
      price: 0,
      currency: 'USD',
      rating: 4.97,
      installCount: 1640,
      isFeatured: true,
      templateData: {
        themePresetName: 'gold_academic',
        navigation: [
          { label: 'Portal', path: '/' },
          { label: 'Exams', path: '/learn' },
          { label: 'Verify Credential', path: '/verify' },
        ],
      },
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const item of listings) {
    await adminDb.collection('marketplace_listings').doc(item.id).set(item, { merge: true });
  }

  // 5. Seed Initial Compliance Audit Log
  const auditRef = adminDb.collection('enterprise_audit_logs').doc(`audit_${portalId}_init`);
  const auditLog: EnterpriseAuditLog = {
    id: auditRef.id,
    organizationId,
    portalId,
    actorUserId: 'admin_root',
    actorEmail: 'admin@schoolbursar.org',
    action: 'enterprise.provisioned',
    resourceType: 'portal',
    resourceId: portalId,
    ipAddress: '102.176.65.12',
    timestamp: now,
    details: {
      ssoEnabled: true,
      customDomain: 'academy.schoolbursar.org',
      hierarchyNodesCount: 3,
    },
  };
  await auditRef.set(auditLog, { merge: true });

  console.log(`[SEED] Successfully seeded Enterprise & Marketplace data for portal: ${portalId}`);
}
