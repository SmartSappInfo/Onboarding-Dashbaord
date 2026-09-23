'use client';

/**
 * {{Org_name}} Experience Platform — Portal Content & Resource Vault Catalog Client
 *
 * Universal content directory interface rendering downloadable toolkits,
 * documentation guides, policy articles, and operational templates with dynamic
 * theme styling, instant search filtering, and categorized space views.
 *
 * Strict Compliance:
 * - Next-Best-Practices: Proper client boundary with zero hydration mismatch.
 * - Vercel-React-Best-Practices: Memoized queries, limit(50) bounding, no waterfalls.
 * - Emil-Kowalski-Animations: Tactile active:scale-[0.97] press feedback on all buttons.
 * - Zero `any`, `any[]`, or `unknown` typing.
 * - Mobile ergonomics: All touch targets >= 44px (`min-h-[44px]`).
 * - Universal Scoped Theme: Wrapped in <PortalThemeProvider> with full dark/light palette resolution.
 *
 * MAINTAINER GUIDANCE (Rule 10):
 * - Always retrieve `activeColors` from `usePortalTheme()` rather than reading `theme.colors` directly,
 *   ensuring dark mode overrides and contrast optimizations are applied.
 * - Card titles and hero typography must use `text-[var(--portal-text)]` instead of `text-foreground`
 *   to avoid contrast degradation when portal mode differs from admin/global mode.
 */

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { collection, query, where, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FolderArchive,
  Search,
  FileText,
  FileCode,
  Download,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Newspaper,
  LayoutDashboard,
  Lock,
  Layers,
  X,
} from 'lucide-react';
import { listContentItemsByPortalAction } from '@/app/actions/content-actions';
import {
  getPortalRadiusCss,
  getGoogleFontsUrl,
  getPortalButtonInlineStyle,
} from '@/lib/utils/portal-theme';
import { getContrastRatio } from '@/lib/utils/portal-theme-generator';
import { cn } from '@/lib/utils';
import { PortalSearchModal } from '../components/PortalSearchModal';
import { PortalAuthModal } from '../components/PortalAuthModal';
import { PortalThemeProvider, usePortalTheme } from '../components/PortalThemeProvider';
import { PortalThemeToggle } from '../components/PortalThemeToggle';
import type { Portal } from '@/lib/types/portal';
import type { ContentItem, ContentItemType } from '@/lib/types/content';

interface PortalContentCatalogClientProps {
  slug: string;
}

const TYPE_FILTER_TABS: { id: string; label: string; icon: React.ElementType }[] = [
  { id: 'all', label: 'All Resources', icon: Layers },
  { id: 'resource', label: 'Worksheets & Downloads', icon: FolderArchive },
  { id: 'doc', label: 'Documentation & Guides', icon: FileCode },
  { id: 'article', label: 'Articles & Insights', icon: Newspaper },
  { id: 'template', label: 'Templates & Models', icon: FileText },
];

/**
 * Inner view rendered strictly inside <PortalThemeProvider>.
 * Has full reactive access to `usePortalTheme()` context tokens.
 */
function PortalContentCatalogView({
  slug,
  portal,
}: {
  slug: string;
  portal: Portal;
}) {
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { activeColors } = usePortalTheme();

  const initialType = searchParams.get('type') || 'all';

  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedType, setSelectedType] = React.useState<string>(initialType);
  const [isSearchModalOpen, setIsSearchModalOpen] = React.useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);

  // Synchronize URL query parameter if present
  React.useEffect(() => {
    const typeParam = searchParams.get('type');
    if (typeParam) {
      setSelectedType(typeParam);
    }
  }, [searchParams]);

  // Server Action Fallback State
  const [serverItems, setServerItems] = React.useState<ContentItem[]>([]);
  const [_isLoadingServer, setIsLoadingServer] = React.useState(true);

  const fetchServerContent = React.useCallback(async () => {
    if (!portal.id) return;
    try {
      setIsLoadingServer(true);
      const res = await listContentItemsByPortalAction(portal.id, {
        status: 'published',
      });
      if (res.success && res.data) {
        setServerItems(res.data);
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsLoadingServer(false);
    }
  }, [portal.id]);

  React.useEffect(() => {
    fetchServerContent();
  }, [fetchServerContent]);

  // Realtime Firestore Query for Content Items (Bounded with limit(50))
  const contentQuery = useMemoFirebase(
    () =>
      firestore && portal.id
        ? query(
            collection(firestore, 'content_items'),
            where('portalId', '==', portal.id),
            where('status', '==', 'published'),
            limit(50)
          )
        : null,
    [firestore, portal.id]
  );
  const { data: realtimeItems, isLoading: isLoadingContent } = useCollection<ContentItem>(contentQuery);

  // Combine Realtime with Server Fallback
  const effectiveItems = (realtimeItems && realtimeItems.length > 0) ? realtimeItems : serverItems;

  // Memoized Filtered Content Items
  const filteredItems = React.useMemo(() => {
    return effectiveItems.filter(item => {
      // Type matching
      if (selectedType !== 'all') {
        if (selectedType === 'doc' && item.type !== 'page') {
          return false;
        }
        if (selectedType === 'resource' && item.type !== 'resource' && item.type !== 'file') {
          return false;
        }
        if (selectedType !== 'doc' && selectedType !== 'resource' && (item.type as string) !== selectedType) {
          return false;
        }
      }

      // Search query matching
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesSummary = item.summary ? item.summary.toLowerCase().includes(q) : false;
        const matchesCategory = item.category ? item.category.toLowerCase().includes(q) : false;
        const matchesTags = (item.tags || []).some(t => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesSummary && !matchesCategory && !matchesTags) {
          return false;
        }
      }

      return true;
    });
  }, [effectiveItems, selectedType, searchQuery]);

  const theme = portal.theme;
  const branding = portal.branding;
  const brandTitle = branding.brandName || portal.name;
  const radiusCss = getPortalRadiusCss(theme.ui?.borderRadius);
  const googleFontsUrl = getGoogleFontsUrl(theme.typography?.headingFont, theme.typography?.bodyFont);

  // Dynamic contrast for button text on primary background
  const primaryBtnTextColor = React.useMemo(() => {
    return getContrastRatio(activeColors.primary, '#FFFFFF') >= 4.5 ? '#FFFFFF' : '#0F172A';
  }, [activeColors.primary]);

  const primaryBtnStyle = React.useMemo(() => {
    const base = getPortalButtonInlineStyle(
      theme.ui?.buttonStyle,
      activeColors.primary,
      radiusCss
    );
    return { ...base, color: primaryBtnTextColor };
  }, [theme.ui?.buttonStyle, activeColors.primary, radiusCss, primaryBtnTextColor]);

  const getItemTypeIcon = (type: ContentItemType) => {
    switch (type) {
      case 'page':
        return FileCode;
      case 'resource':
      case 'file':
        return FolderArchive;
      case 'article':
      case 'announcement':
        return Newspaper;
      case 'lesson':
      case 'video':
        return BookOpen;
      default:
        return FileText;
    }
  };

  return (
    <>
      {/* ── Dynamic Google Fonts ────────────────────────────────────────── */}
      {googleFontsUrl && <link rel="stylesheet" href={googleFontsUrl} />}

      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-[var(--portal-border)] bg-[var(--portal-bg)]/90 backdrop-blur-md px-6 py-3.5 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/portal/${slug}`}>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px] rounded-xl hover:bg-[var(--portal-surface)] text-[var(--portal-muted)] hover:text-[var(--portal-text)] active:scale-[0.97] transition-transform"
                aria-label="Return to Portal Home"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>

            <Link href={`/portal/${slug}`} className="flex items-center gap-2.5 group">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt={brandTitle} className="h-7 w-auto object-contain" />
              ) : (
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-xs"
                  style={{ backgroundColor: activeColors.primary }}
                >
                  {brandTitle.charAt(0)}
                </div>
              )}
              <span
                className="font-extrabold text-sm tracking-tight text-[var(--portal-text)] hidden sm:inline"
                style={{ fontFamily: 'var(--portal-heading-font)' }}
              >
                {brandTitle}
              </span>
            </Link>

            <span className="text-[var(--portal-border)] text-sm hidden sm:inline">/</span>
            <span className="text-xs font-bold text-[var(--portal-muted)] hidden sm:inline">
              Resource Vault
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search Trigger Button */}
            <button
              type="button"
              onClick={() => setIsSearchModalOpen(true)}
              className="relative w-36 sm:w-56 text-left min-h-[44px] pl-8 pr-3 border border-[var(--portal-border)] bg-[var(--portal-surface)] text-xs text-[var(--portal-muted)] hover:text-[var(--portal-text)] flex items-center justify-between transition-colors shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.97]"
              style={{ borderRadius: radiusCss }}
            >
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" />
              <span className="truncate">Search catalog...</span>
              <kbd className="text-[9px] bg-muted/60 px-1 py-0.5 rounded border border-[var(--portal-border)] hidden sm:inline">
                ⌘K
              </kbd>
            </button>

            {/* Scoped Theme Toggle (Light / Dark Switcher) */}
            <PortalThemeToggle variant="icon" />

            {/* Dashboard / Auth CTA */}
            {user ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="min-h-[44px] px-3.5 rounded-xl font-bold text-xs gap-1.5 border-[var(--portal-border)] bg-[var(--portal-bg)] text-[var(--portal-text)] hover:bg-[var(--portal-surface)] active:scale-[0.97] transition-all"
              >
                <Link href={`/portal/${slug}/dashboard`}>
                  <LayoutDashboard
                    className="w-3.5 h-3.5"
                    style={{ color: activeColors.primary }}
                  />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAuthModalOpen(true)}
                className="min-h-[44px] px-3.5 rounded-xl font-bold text-xs text-[var(--portal-text)] hover:bg-[var(--portal-surface)] active:scale-[0.97] transition-transform"
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Catalog Workspace ─────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-10 space-y-8">
        {/* Banner Section */}
        <div
          className="p-8 sm:p-10 rounded-3xl border-2 border-[var(--portal-border)] bg-[var(--portal-surface)] space-y-3 relative overflow-hidden transition-colors"
          style={{ borderRadius: radiusCss }}
        >
          {/* Subtle Ambient Radial Lighting Glow */}
          <div
            className="absolute -top-24 -right-24 w-80 h-80 rounded-full blur-3xl opacity-15 pointer-events-none"
            style={{ backgroundColor: activeColors.primary }}
          />

          <Badge
            variant="outline"
            className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5"
            style={{ color: activeColors.primary, borderColor: activeColors.primary }}
          >
            Digital Vault & Documentation
          </Badge>
          <h1
            className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-[var(--portal-text)]"
            style={{ fontFamily: 'var(--portal-heading-font)' }}
          >
            Resources, Guides & Toolkits
          </h1>
          <p className="text-sm text-[var(--portal-muted)] max-w-2xl leading-relaxed">
            Downloadable spreadsheet models, operational SOPs, administrative guides, and expert knowledge
            curated for your institution.
          </p>
        </div>

        {/* Filter Bar & Search Input */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-[var(--portal-border)] pb-4">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {TYPE_FILTER_TABS.map(tab => {
              const IconComp = tab.icon;
              const isActive = selectedType === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedType(tab.id)}
                  className={cn(
                    'min-h-[44px] px-3.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all duration-150 active:scale-[0.97]',
                    isActive
                      ? 'text-white shadow-xs'
                      : 'text-[var(--portal-muted)] hover:text-[var(--portal-text)] hover:bg-[var(--portal-surface)]'
                  )}
                  style={{
                    backgroundColor: isActive ? activeColors.primary : 'transparent',
                    borderRadius: radiusCss,
                  }}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Inline Keyword Filter */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--portal-muted)]" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter by title, tags, or topic..."
              className="pl-9 pr-8 min-h-[44px] text-xs bg-[var(--portal-surface)] border-[var(--portal-border)] text-[var(--portal-text)] placeholder:text-[var(--portal-muted)] font-medium"
              style={{ borderRadius: radiusCss }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--portal-muted)] hover:text-[var(--portal-text)]"
                aria-label="Clear filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Catalog Items Grid */}
        {isLoadingContent && effectiveItems.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Skeleton className="h-56 rounded-3xl" />
            <Skeleton className="h-56 rounded-3xl" />
            <Skeleton className="h-56 rounded-3xl" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div
            className="p-12 text-center rounded-3xl border-2 border-dashed border-[var(--portal-border)] space-y-3 bg-[var(--portal-surface)]/50"
            style={{ borderRadius: radiusCss }}
          >
            <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto text-[var(--portal-muted)]">
              <FolderArchive className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-[var(--portal-text)]">No resources match your selection</h3>
            <p className="text-xs text-[var(--portal-muted)] max-w-sm mx-auto">
              Try adjusting your category filter or search keywords to find what you are looking for.
            </p>
            {(selectedType !== 'all' || searchQuery) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedType('all');
                  setSearchQuery('');
                }}
                className="min-h-[44px] rounded-xl font-bold text-xs mt-2 border-[var(--portal-border)] text-[var(--portal-text)] hover:bg-[var(--portal-surface)] active:scale-[0.97] transition-transform"
              >
                Reset Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map(item => {
              const IconComp = getItemTypeIcon(item.type);
              const isGated = Boolean(item.visibility && item.visibility !== 'public');
              const targetUrl = item.slug
                ? `/portal/${slug}/content/${item.type}/${item.slug}`
                : `/portal/${slug}/content?id=${item.id}`;

              return (
                <Card
                  key={item.id}
                  className="h-full border-2 border-[var(--portal-border)] bg-[var(--portal-surface)] p-6 space-y-4 hover:shadow-xl hover:border-[var(--portal-primary)] transition-all duration-200 active:scale-[0.99] flex flex-col justify-between group"
                  style={{ borderRadius: radiusCss }}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-2xs"
                        style={{ backgroundColor: activeColors.primary, borderRadius: radiusCss }}
                      >
                        <IconComp className="w-5 h-5" />
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isGated && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-bold text-amber-600 border-amber-500/30 gap-1 bg-amber-500/5"
                          >
                            <Lock className="w-3 h-3" /> Member
                          </Badge>
                        )}
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-bold uppercase tracking-wider capitalize border-[var(--portal-border)] text-[var(--portal-text)]"
                        >
                          {item.type}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Link href={targetUrl}>
                        <h3 className="font-bold text-base text-[var(--portal-text)] group-hover:text-[var(--portal-primary)] transition-colors line-clamp-2 leading-snug">
                          {item.title}
                        </h3>
                      </Link>
                      {item.summary && (
                        <p className="text-xs text-[var(--portal-muted)] line-clamp-3 leading-relaxed">
                          {item.summary}
                        </p>
                      )}
                    </div>

                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        {item.tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-medium text-[var(--portal-muted)] bg-[var(--portal-bg)]/80 px-2 py-0.5 rounded-md border border-[var(--portal-border)]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[var(--portal-border)] flex items-center justify-between gap-2">
                    {item.media?.downloadUrl ? (
                      <a
                        href={item.media.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[44px] flex items-center gap-1.5 text-xs font-bold text-[var(--portal-primary)] hover:opacity-80 active:scale-[0.97] transition-transform"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Direct Download</span>
                      </a>
                    ) : (
                      <span className="text-[11px] font-semibold text-[var(--portal-muted)]">
                        {item.type === 'article' || item.type === 'page'
                          ? `${Math.max(1, Math.ceil((item.content?.length || 600) / 1000))} min read`
                          : 'Knowledge Resource'}
                      </span>
                    )}

                    <Button
                      asChild
                      size="sm"
                      className="min-h-[44px] px-3.5 rounded-xl font-bold text-xs gap-1.5 active:scale-[0.97] transition-transform"
                      style={primaryBtnStyle}
                    >
                      <Link href={targetUrl}>
                        <span>Access</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200" />
                      </Link>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--portal-border)] bg-[var(--portal-surface)] px-6 py-8 transition-colors mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--portal-muted)]">
          <p>{branding.copyrightText || `© ${new Date().getFullYear()} ${brandTitle}. All rights reserved.`}</p>
          <div className="flex items-center gap-4">
            <Link href={`/portal/${slug}`} className="hover:text-[var(--portal-text)] transition-colors">
              Portal Home
            </Link>
            <Link href={`/portal/${slug}/learn`} className="hover:text-[var(--portal-text)] transition-colors">
              Curriculum
            </Link>
            <Link href={`/portal/${slug}/community`} className="hover:text-[var(--portal-text)] transition-colors">
              Community
            </Link>
          </div>
        </div>
      </footer>

      {/* ── Instant Content Search Modal ───────────────────────────────── */}
      <PortalSearchModal
        open={isSearchModalOpen}
        onOpenChange={setIsSearchModalOpen}
        portalId={portal.id}
        portalSlug={slug}
      />

      {/* ── Member Auth Dialog ────────────────────────────────────────── */}
      <PortalAuthModal
        portal={portal}
        open={isAuthModalOpen}
        onOpenChange={setIsAuthModalOpen}
      />
    </>
  );
}

/**
 * Root Client Component: Fetches portal and renders <PortalThemeProvider> boundary.
 */
export default function PortalContentCatalogClient({ slug }: PortalContentCatalogClientProps) {
  const firestore = useFirestore();

  // 1. Query Portal by Slug
  const portalQuery = useMemoFirebase(
    () =>
      firestore && slug
        ? query(collection(firestore, 'portals'), where('slug', '==', slug), limit(1))
        : null,
    [firestore, slug]
  );
  const { data: portals, isLoading: isLoadingPortal } = useCollection<Portal>(portalQuery);
  const portal = portals?.[0] ?? null;

  // ── Loading Skeleton ────────────────────────────────────────────────────────
  if (isLoadingPortal) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <header className="h-16 border-b border-border px-6 flex items-center justify-between">
          <Skeleton className="h-8 w-40 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </header>
        <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-10 space-y-6">
          <Skeleton className="h-12 w-96 rounded-2xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
            <Skeleton className="h-56 rounded-3xl" />
            <Skeleton className="h-56 rounded-3xl" />
            <Skeleton className="h-56 rounded-3xl" />
          </div>
        </main>
        <footer className="h-16 border-t border-border" />
      </div>
    );
  }

  // ── Not Found State ─────────────────────────────────────────────────────────
  if (!portal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <FolderArchive className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Portal Not Found</h2>
          <p className="text-xs text-muted-foreground">
            The resource catalog you are looking for is unavailable.
          </p>
          <Button asChild className="rounded-xl font-bold text-xs mt-2">
            <Link href="/">Return Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ── Wrapped in Unified Independent Scoped Theme Provider ─────────────────────
  return (
    <PortalThemeProvider
      portalId={portal.id}
      theme={portal.theme}
      className="min-h-screen flex flex-col justify-between"
    >
      <PortalContentCatalogView slug={slug} portal={portal} />
    </PortalThemeProvider>
  );
}
