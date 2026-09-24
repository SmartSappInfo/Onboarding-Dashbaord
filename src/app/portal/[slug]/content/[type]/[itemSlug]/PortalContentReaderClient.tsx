'use client';

/**
 * {{Org_name}} Experience Platform — Dynamic Content Reader Shell
 *
 * Polymorphic content reader rendering Articles, Documentation trees,
 * Lessons, Resources, and bespoke PageBuilder documents with dynamic theme tokens.
 *
 * Strict Compliance:
 * - Scoped Theme Provider: Wrapped in <PortalThemeProvider> with full dark/light resolution.
 * - Zero `any`, `any[]`, or `unknown` typing.
 * - Mobile ergonomics: >=44px touch targets (`min-h-[44px]`) and tactile active:scale-[0.97] press.
 * - High-contrast typography: All headings bound to `text-[var(--portal-text)]`.
 *
 * MAINTAINER GUIDANCE (Rule 10):
 * - Consume `activeColors` from `usePortalTheme()` for icon backgrounds and primary CTAs.
 * - Preserve sibling documentation hierarchy queries for tree navigation in doc views.
 */

import * as React from 'react';
import Link from 'next/link';
import { collection, query, where, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  ArrowLeft,
  Download,
  Copy,
  ChevronRight,
  FileText,
  FolderArchive,
  Search,
  Lock,
} from 'lucide-react';
import { PortalSearchModal } from '../../../components/PortalSearchModal';
import { PortalAuthModal } from '../../../components/PortalAuthModal';
import { PortalAccessGate } from '@/components/portal/PortalAccessGate';
import { PortalThemeProvider, usePortalTheme } from '../../../components/PortalThemeProvider';
import { PortalThemeToggle } from '../../../components/PortalThemeToggle';
import { getPortalRadiusCss, getPortalButtonInlineStyle } from '@/lib/utils/portal-theme';
import { getContrastRatio } from '@/lib/utils/portal-theme-generator';
import type { Portal } from '@/lib/types/portal';
import type { ContentItem } from '@/lib/types/content';
import type { PortalMembership, EntitlementDenialReason, MembershipPlan } from '@/lib/types/membership';
import { BlockRenderer } from '@/components/page-builder/BlockRenderer';
import type { BlockRenderContext } from '@/lib/page-builder/registry';
import { DEFAULT_THEME } from '@/lib/page-builder/resolve-theme';
import '@/lib/page-builder/blocks';

interface PortalContentReaderClientProps {
  slug: string;
  type: string;
  itemSlug: string;
}

/**
 * Inner reader view rendered strictly inside <PortalThemeProvider>.
 */
function PortalContentReaderView({
  slug,
  type,
  itemSlug,
  portal,
}: {
  slug: string;
  type: string;
  itemSlug: string;
  portal: Portal;
}) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { activeColors } = usePortalTheme();

  const [isSearchOpen, setIsSearchOpen] = React.useState(false);

  // 1. Query Content Item
  const contentQuery = useMemoFirebase(
    () =>
      firestore && portal?.id && itemSlug && type
        ? query(
            collection(firestore, 'content_items'),
            where('portalId', '==', portal.id),
            where('type', '==', type),
            where('slug', '==', itemSlug),
            limit(1)
          )
        : null,
    [firestore, portal?.id, itemSlug, type]
  );
  const { data: contentList, isLoading: isLoadingContent } = useCollection<ContentItem>(contentQuery);
  const item = contentList?.[0] ?? null;

  // 2. Query Sibling items for documentation sidebar or lesson syllabus
  const siblingsQuery = useMemoFirebase(
    () =>
      firestore && portal?.id && type
        ? query(
            collection(firestore, 'content_items'),
            where('portalId', '==', portal.id),
            where('type', '==', type),
            where('status', '==', 'published'),
            limit(20)
          )
        : null,
    [firestore, portal?.id, type]
  );
  const { data: siblings } = useCollection<ContentItem>(siblingsQuery);

  // 3. User Authentication & Portal Membership Resolution
  const { user, isUserLoading } = useUser();
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);

  const membershipQuery = useMemoFirebase(
    () =>
      firestore && portal?.id && user?.uid
        ? query(
            collection(firestore, 'portal_memberships'),
            where('portalId', '==', portal.id),
            where('userId', '==', user.uid),
            limit(1)
          )
        : null,
    [firestore, portal?.id, user?.uid]
  );
  const { data: memberships, isLoading: isLoadingMembership } = useCollection<PortalMembership>(membershipQuery);
  const membership = memberships?.[0] ?? null;

  // 4. Query Membership Plans to resolve plan display names for paywalls
  const plansQuery = useMemoFirebase(
    () =>
      firestore && portal?.id
        ? query(
            collection(firestore, 'membership_plans'),
            where('portalId', '==', portal.id)
          )
        : null,
    [firestore, portal?.id]
  );
  const { data: plans } = useCollection<MembershipPlan>(plansQuery);

  // 5. Evaluate Client-Side Entitlement
  const entitlement = React.useMemo<{
    hasAccess: boolean;
    reason: EntitlementDenialReason;
    requiredPlanName?: string;
  }>(() => {
    if (!item) return { hasAccess: true, reason: 'public_access' };

    // Explicitly public items are accessible by all visitors
    if (item.visibility === 'public') {
      return { hasAccess: true, reason: 'public_access' };
    }

    // While authentication is determining, don't lock prematurely if user might be authenticated
    if (isUserLoading || isLoadingMembership) {
      return { hasAccess: false, reason: 'auth_required' };
    }

    // Unauthenticated visitors cannot access non-public content
    if (!user) {
      return { hasAccess: false, reason: 'auth_required' };
    }

    // User is authenticated but has no membership record in this portal
    if (!membership) {
      return { hasAccess: false, reason: 'membership_required' };
    }

    // Suspended or inactive membership
    if (membership.status !== 'active') {
      return { hasAccess: false, reason: 'membership_inactive' };
    }

    // Portal admin / instructor bypass
    if (membership.role === 'owner' || membership.role === 'admin' || membership.role === 'instructor') {
      return { hasAccess: true, reason: 'admin_bypass' };
    }

    // Role-based restrictions
    if (item.accessRoles && item.accessRoles.length > 0) {
      if (!item.accessRoles.includes(membership.role)) {
        return { hasAccess: false, reason: 'role_restricted' };
      }
    }

    // Plan tier restrictions
    if (item.requiredPlanIds && item.requiredPlanIds.length > 0) {
      if (!membership.planId || !item.requiredPlanIds.includes(membership.planId)) {
        const matchingPlan = plans?.find(p => item.requiredPlanIds?.includes(p.id));
        return {
          hasAccess: false,
          reason: 'plan_upgrade_required',
          requiredPlanName: matchingPlan?.name || 'Exclusive Tier',
        };
      }
      return { hasAccess: true, reason: 'plan_entitlement' };
    }

    return { hasAccess: true, reason: 'member_access' };
  }, [item, isUserLoading, isLoadingMembership, user, membership, plans]);

  // Compute visible blocks based on teaser mode if gated
  const visibleBlocks = React.useMemo(() => {
    if (!item?.blocks || item.blocks.length === 0) return [];
    if (entitlement.hasAccess) return item.blocks;

    const mode = item.teaserMode || 'first_block';
    if (mode === 'none' || mode === 'summary') {
      return [];
    }
    if (mode === 'two_blocks') {
      return item.blocks.slice(0, 2);
    }
    return item.blocks.slice(0, 1);
  }, [item?.blocks, item?.teaserMode, entitlement.hasAccess]);

  // Compute visible content text based on teaser mode if gated
  const visibleContent = React.useMemo(() => {
    if (!item?.content) return '';
    if (entitlement.hasAccess) return item.content;
    const mode = item.teaserMode || 'first_block';
    if (mode === 'none') return '';
    const paragraphs = item.content.split('\n\n');
    return paragraphs[0] || item.content.slice(0, 250);
  }, [item?.content, item?.teaserMode, entitlement.hasAccess]);

  const theme = portal.theme;
  const branding = portal.branding;
  const brandTitle = branding.brandName || portal.name;
  const radiusCss = getPortalRadiusCss(theme.ui?.borderRadius);

  // Dynamic button text color based on contrast
  const primaryBtnTextColor = React.useMemo(() => {
    return getContrastRatio(activeColors.primary, '#FFFFFF') >= 4.5 ? '#FFFFFF' : '#0F172A';
  }, [activeColors.primary]);

  const primaryBtnStyle = React.useMemo(() => {
    const base = getPortalButtonInlineStyle(
      theme.ui?.buttonStyle,
      'var(--portal-primary, #3B82F6)',
      radiusCss
    );
    return { ...base, color: primaryBtnTextColor };
  }, [theme.ui?.buttonStyle, radiusCss, primaryBtnTextColor]);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: 'Link Copied',
        description: 'Resource URL copied to your clipboard.',
      });
    }
  };

  const handleShareSocial = (platform: 'whatsapp' | 'linkedin') => {
    if (typeof window === 'undefined') return;
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(item?.title || brandTitle);

    if (platform === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${title}%20${url}`, '_blank');
    } else {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
    }
  };

  const renderCtx: BlockRenderContext = React.useMemo(() => {
    return {
      mode: 'view',
      theme: {
        ...DEFAULT_THEME,
        colors: {
          ...DEFAULT_THEME.colors,
          primary: activeColors.primary || DEFAULT_THEME.colors.primary,
        },
        typography: {
          headingFont: 'Figtree, sans-serif',
          bodyFont: 'Figtree, sans-serif',
          baseSize: '16px',
        },
      },
      interpolate: (text: string) => text,
      resources: {
        forms: [],
        surveys: [],
        agreements: [],
        meetings: [],
        qrCodes: [],
      },
    };
  }, [activeColors.primary]);

  if (isLoadingContent) {
    return (
      <div className="min-h-screen bg-[var(--portal-bg)] flex flex-col justify-between">
        <header className="h-16 border-b border-[var(--portal-border)] px-6 flex items-center justify-between">
          <Skeleton className="h-8 w-32 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </header>
        <main className="max-w-4xl mx-auto w-full p-6 md:p-12 space-y-6 flex-1">
          <Skeleton className="h-10 w-3/4 rounded-2xl" />
          <Skeleton className="h-5 w-1/2 rounded-xl" />
          <Skeleton className="h-72 w-full rounded-3xl pt-6" />
        </main>
        <footer className="h-16 border-t border-[var(--portal-border)]" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-[var(--portal-bg)] flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[var(--portal-surface)] border border-[var(--portal-border)] flex items-center justify-center mx-auto text-[var(--portal-muted)]">
            <FileText className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-[var(--portal-text)]">Resource Not Found</h2>
          <p className="text-xs text-[var(--portal-muted)]">
            The article, document, or toolkit you requested could not be located.
          </p>
          <Button
            asChild
            className="rounded-xl font-bold text-xs mt-2 min-h-[44px] active:scale-[0.97]"
            style={primaryBtnStyle}
          >
            <Link href={`/portal/${slug}/content`}>
              Browse Catalog
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const isDocType = item.type === 'page';

  return (
    <>
      {/* ── Top Header Bar ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-[var(--portal-border)] bg-[var(--portal-bg)]/90 backdrop-blur-md px-6 py-3 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-4">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px] rounded-xl hover:bg-[var(--portal-surface)] text-[var(--portal-muted)] hover:text-[var(--portal-text)] active:scale-[0.97] transition-transform"
            aria-label="Return to Catalog"
          >
            <Link href={`/portal/${slug}/content`}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>

          <Link href={`/portal/${slug}`} className="flex items-center gap-2 group">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={brandTitle} className="h-7 w-auto object-contain" />
            ) : (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                style={{ backgroundColor: 'var(--portal-primary, #3B82F6)' }}
              >
                {brandTitle.charAt(0)}
              </div>
            )}
            <span
              className="font-bold text-sm tracking-tight text-[var(--portal-text)] hidden sm:inline"
              style={{ fontFamily: 'var(--portal-heading-font)' }}
            >
              {brandTitle}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSearchOpen(true)}
            className="min-h-[44px] px-3.5 rounded-xl font-medium text-xs gap-1.5 border-[var(--portal-border)] bg-[var(--portal-surface)] text-[var(--portal-muted)] hover:text-[var(--portal-text)] active:scale-[0.97] transition-transform"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Search portal...</span>
            <kbd className="hidden sm:inline text-[9px] bg-muted/60 px-1.5 py-0.5 rounded border border-[var(--portal-border)]">
              ⌘K
            </kbd>
          </Button>

          {/* Scoped Portal Theme Switcher */}
          <PortalThemeToggle variant="icon" />

          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopyLink}
            title="Copy Link"
            className="min-h-[44px] min-w-[44px] rounded-xl text-[var(--portal-muted)] hover:text-[var(--portal-text)] hover:bg-[var(--portal-surface)] active:scale-[0.97] transition-transform"
            aria-label="Copy Link"
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* ── Main Content Area ─────────────────────────────────────────── */}
      <main className="flex-1 flex w-full">
        {/* If Documentation Type: Show Left Sidebar Tree */}
        {isDocType && siblings && siblings.length > 0 && (
          <aside className="hidden lg:block w-72 border-r border-[var(--portal-border)] bg-[var(--portal-surface)] p-6 space-y-4 shrink-0">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--portal-muted)]">
              Documentation Index
            </h4>
            <nav className="space-y-1">
              {siblings.map(sib => {
                const isActive = sib.slug === item.slug;
                return (
                  <Link
                    key={sib.id}
                    href={`/portal/${slug}/content/${sib.type}/${sib.slug}`}
                    className={`block px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-[0.98] ${
                      isActive
                        ? 'bg-[var(--portal-primary)] text-white font-bold shadow-xs'
                        : 'text-[var(--portal-muted)] hover:text-[var(--portal-text)] hover:bg-[var(--portal-bg)]'
                    }`}
                  >
                    {sib.title}
                  </Link>
                );
              })}
            </nav>
          </aside>
        )}

        {/* Content Body Canvas */}
        <div className="flex-1 max-w-4xl mx-auto w-full p-6 md:p-12 space-y-8">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs text-[var(--portal-muted)] font-medium">
            <Link href={`/portal/${slug}`} className="hover:underline">
              {brandTitle}
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href={`/portal/${slug}/content`} className="hover:underline capitalize">
              {item.type}
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-[var(--portal-text)] font-semibold truncate max-w-xs">{item.title}</span>
          </div>

          {/* Header Section */}
          <div className="space-y-4 border-b border-[var(--portal-border)] pb-8">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5"
                style={{ color: 'var(--portal-primary, #3B82F6)', borderColor: 'var(--portal-primary, #3B82F6)' }}
              >
                {item.type}
              </Badge>
              {item.category && (
                <span className="text-xs font-bold text-[var(--portal-muted)]">{item.category}</span>
              )}
            </div>

            <h1
              className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--portal-text)]"
              style={{ fontFamily: 'var(--portal-heading-font)' }}
            >
              {item.title}
            </h1>

            {item.summary && (
              <p className="text-base text-[var(--portal-muted)] leading-relaxed">
                {item.summary}
              </p>
            )}

            {/* Author / Date Info */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3">
                <Avatar className="w-9 h-9 border border-[var(--portal-border)]">
                  <AvatarFallback
                    className="font-bold text-xs"
                    style={{ backgroundColor: `${activeColors.primary}20`, color: activeColors.primary }}
                  >
                    {item.authors?.[0]?.name ? item.authors[0].name.charAt(0) : brandTitle.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-xs">
                  <p className="font-bold text-[var(--portal-text)]">
                    {item.authors?.[0]?.name || brandTitle}
                  </p>
                  <p className="text-[11px] text-[var(--portal-muted)]">
                    {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : 'Published'}
                  </p>
                </div>
              </div>

              {/* Social Share Buttons */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleShareSocial('whatsapp')}
                  className="min-h-[44px] px-3 rounded-xl text-xs font-bold text-emerald-600 hover:bg-emerald-500/10 active:scale-[0.97]"
                >
                  WhatsApp
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleShareSocial('linkedin')}
                  className="min-h-[44px] px-3 rounded-xl text-xs font-bold text-blue-600 hover:bg-blue-500/10 active:scale-[0.97]"
                >
                  LinkedIn
                </Button>
              </div>
            </div>
          </div>

          {/* Media Player Banner */}
          {item.media?.videoUrl && (
            <div className="rounded-3xl overflow-hidden border border-[var(--portal-border)] shadow-md bg-black aspect-video flex items-center justify-center">
              <iframe
                src={item.media.videoUrl.replace('watch?v=', 'embed/')}
                title={item.title}
                className="w-full h-full border-0"
                allowFullScreen
              />
            </div>
          )}

          {/* Download Resource Toolkit (Entitlement Gated) */}
          {item.type === 'resource' && item.media?.downloadUrl && entitlement.hasAccess && (
            <Card
              className="rounded-3xl border-2 border-[var(--portal-border)] bg-[var(--portal-surface)] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
              style={{ borderRadius: radiusCss }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-2xl text-white flex items-center justify-center shadow-xs shrink-0"
                  style={{ backgroundColor: 'var(--portal-primary, #3B82F6)', borderRadius: radiusCss }}
                >
                  <FolderArchive className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[var(--portal-text)]">Download Resource Toolkit</h4>
                  <p className="text-xs text-[var(--portal-muted)]">
                    {item.media.fileName || 'Resource File'} • {item.media.mimeType || 'Standard Format'}
                  </p>
                </div>
              </div>

              <Button
                asChild
                className="rounded-xl font-bold text-xs gap-2 min-h-[44px] px-5 active:scale-[0.97] transition-transform"
                style={primaryBtnStyle}
              >
                <a
                  href={item.media.downloadUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="w-4 h-4" /> Download File
                </a>
              </Button>
            </Card>
          )}

          {/* Rich Content Body: Dual Mode (Modular PageBuilder Blocks vs Legacy Markdown) with Teaser Support */}
          {item.blocks && item.blocks.length > 0 ? (
            <div className="space-y-6 pt-2">
              {visibleBlocks.map((block) => (
                <BlockRenderer key={block.id} block={block} ctx={renderCtx} />
              ))}
            </div>
          ) : (
            <article className="prose dark:prose-invert max-w-none text-sm md:text-base leading-relaxed space-y-4 text-[var(--portal-text)]">
              {visibleContent ? (
                <div className="whitespace-pre-wrap font-normal leading-relaxed text-[var(--portal-text)]">
                  {visibleContent}
                </div>
              ) : (
                <p className="text-xs text-[var(--portal-muted)] italic">No written body text provided.</p>
              )}
            </article>
          )}

          {/* Access Gate & Paywall rendered when access is denied */}
          {!entitlement.hasAccess && (
            <PortalAccessGate
              slug={slug}
              portalName={brandTitle}
              reason={entitlement.reason}
              customPaywall={item.customPaywall}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              requiredPlanName={entitlement.requiredPlanName}
              itemType={item.type}
              redirectUrl={`/portal/${slug}/content/${type}/${itemSlug}`}
            />
          )}
        </div>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--portal-border)] bg-[var(--portal-surface)] px-6 py-8 text-center text-xs text-[var(--portal-muted)] transition-colors">
        <p>{branding.copyrightText || `© ${new Date().getFullYear()} ${brandTitle}. All rights reserved.`}</p>
      </footer>

      {/* Global Search Modal */}
      <PortalSearchModal
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        portalId={portal.id}
        portalSlug={slug}
      />

      {/* Member Auth Modal (Sign In / Register / Reset) */}
      <PortalAuthModal
        open={isAuthModalOpen}
        onOpenChange={setIsAuthModalOpen}
        portal={portal}
      />
    </>
  );
}

/**
 * Root Content Reader Client: Fetches portal and renders <PortalThemeProvider> boundary.
 */
export default function PortalContentReaderClient({
  slug,
  type,
  itemSlug,
}: PortalContentReaderClientProps) {
  const firestore = useFirestore();

  // 1. Query Portal
  const portalQuery = useMemoFirebase(
    () =>
      firestore && slug
        ? query(collection(firestore, 'portals'), where('slug', '==', slug), limit(1))
        : null,
    [firestore, slug]
  );
  const { data: portals, isLoading: isLoadingPortal } = useCollection<Portal>(portalQuery);
  const portal = portals?.[0] ?? null;

  if (isLoadingPortal) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <header className="h-16 border-b border-border px-6 flex items-center justify-between">
          <Skeleton className="h-8 w-32 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </header>
        <main className="max-w-4xl mx-auto w-full p-6 md:p-12 space-y-6 flex-1">
          <Skeleton className="h-10 w-3/4 rounded-2xl" />
          <Skeleton className="h-5 w-1/2 rounded-xl" />
          <Skeleton className="h-72 w-full rounded-3xl pt-6" />
        </main>
        <footer className="h-16 border-t border-border" />
      </div>
    );
  }

  if (!portal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <FileText className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Portal Not Found</h2>
          <p className="text-xs text-muted-foreground">The requested portal could not be found.</p>
          <Button asChild className="rounded-xl font-bold text-xs mt-2">
            <Link href="/">Return Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PortalThemeProvider
      portalId={portal.id}
      portalSlug={slug}
      theme={portal.theme}
      className="min-h-screen flex flex-col justify-between"
    >
      <PortalContentReaderView
        slug={slug}
        type={type}
        itemSlug={itemSlug}
        portal={portal}
      />
    </PortalThemeProvider>
  );
}
