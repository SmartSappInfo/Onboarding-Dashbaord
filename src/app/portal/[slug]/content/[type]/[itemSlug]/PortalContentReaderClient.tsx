'use client';

/**
 * {{Org_name}} Experience Platform — Dynamic Content Reader Shell
 *
 * Polymorphic content reader rendering Articles, Documentation trees,
 * Lessons, Resources, and bespoke PageBuilder documents with dynamic theme tokens.
 */

import * as React from 'react';
import Link from 'next/link';
import { collection, query, where, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  Share2,
  Copy,
  ChevronRight,
  BookOpen,
  FileText,
  Sparkles,
  FolderArchive,
  Search,
  ExternalLink,
  CheckCircle2,
  Video,
  Globe,
} from 'lucide-react';
import { PortalSearchModal } from '../../../components/PortalSearchModal';
import type { Portal } from '@/lib/types/portal';
import type { ContentItem, ContentItemType } from '@/lib/types/content';

interface PortalContentReaderClientProps {
  slug: string;
  type: string;
  itemSlug: string;
}

export default function PortalContentReaderClient({
  slug,
  type,
  itemSlug,
}: PortalContentReaderClientProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isSearchOpen, setIsSearchOpen] = React.useState(false);

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

  // 2. Query Content Item
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

  // 3. Query Sibling items for documentation sidebar or lesson syllabus
  const siblingsQuery = useMemoFirebase(
    () =>
      firestore && portal?.id && type
        ? query(
            collection(firestore, 'content_items'),
            where('portalId', '==', portal.id),
            where('type', '==', type),
            where('status', '==', 'published'),
            limit(50)
          )
        : null,
    [firestore, portal?.id, type]
  );
  const { data: siblings } = useCollection<ContentItem>(siblingsQuery);

  const isLoading = isLoadingPortal || isLoadingContent;

  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
    toast({ title: 'Link Copied', description: 'Content URL copied to clipboard.' });
  };

  const handleShareSocial = (platform: 'twitter' | 'linkedin' | 'whatsapp') => {
    if (typeof window === 'undefined' || !item) return;
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(item.title);

    let target = '';
    if (platform === 'twitter') target = `https://twitter.com/intent/tweet?url=${url}&text=${text}`;
    if (platform === 'linkedin') target = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    if (platform === 'whatsapp') target = `https://api.whatsapp.com/send?text=${text}%20${url}`;

    window.open(target, '_blank', 'noopener,noreferrer');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between p-6">
        <div className="max-w-4xl mx-auto w-full space-y-6 pt-12">
          <Skeleton className="h-8 w-40 rounded-xl" />
          <Skeleton className="h-12 w-3/4 rounded-2xl" />
          <Skeleton className="h-64 rounded-3xl" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-5/6 rounded" />
            <Skeleton className="h-4 w-4/6 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!portal || !item) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <FileText className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Content Not Found</h2>
          <p className="text-xs text-muted-foreground">
            The article, documentation guide, or resource you requested could not be located.
          </p>
          <Link href={`/portal/${slug}`}>
            <Button className="rounded-xl font-bold text-xs">Return to Portal</Button>
          </Link>
        </div>
      </div>
    );
  }

  const theme = portal.theme;
  const branding = portal.branding;
  const brandTitle = branding.brandName || portal.name;

  const runtimeStyles: React.CSSProperties = {
    ['--portal-primary' as string]: theme.colors.primary,
    ['--portal-secondary' as string]: theme.colors.secondary,
    ['--portal-accent' as string]: theme.colors.accent,
    ['--portal-bg' as string]: theme.colors.background,
    ['--portal-surface' as string]: theme.colors.surface,
    ['--portal-text' as string]: theme.colors.text,
    ['--portal-muted' as string]: theme.colors.mutedText,
    ['--portal-border' as string]: theme.colors.border,
    fontFamily: `${theme.typography.bodyFont}, sans-serif`,
  };

  const isDocType = item.type === 'page';

  return (
    <div
      style={runtimeStyles}
      className="min-h-screen flex flex-col justify-between bg-[var(--portal-bg)] text-[var(--portal-text)] transition-colors"
    >
      {/* ── Top Header Bar ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-[var(--portal-border)] bg-[var(--portal-bg)]/90 backdrop-blur-md px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/portal/${slug}`}>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>

          <Link href={`/portal/${slug}`} className="flex items-center gap-2">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={brandTitle} className="h-7 w-auto object-contain" />
            ) : (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                style={{ backgroundColor: theme.colors.primary }}
              >
                {brandTitle.charAt(0)}
              </div>
            )}
            <span className="font-bold text-sm tracking-tight hidden sm:inline">{brandTitle}</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSearchOpen(true)}
            className="h-9 px-3 rounded-xl font-medium text-xs gap-1.5 text-[var(--portal-muted)]"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Search portal...</span>
            <kbd className="hidden sm:inline text-[9px] bg-muted px-1.5 py-0.5 rounded border border-border">
              ⌘K
            </kbd>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopyLink}
            title="Copy Link"
            className="h-9 w-9 rounded-xl text-[var(--portal-muted)]"
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
                    className={`block px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-[var(--portal-primary)] text-white font-bold shadow-xs'
                        : 'text-[var(--portal-muted)] hover:text-foreground hover:bg-[var(--portal-bg)]'
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
            <span className="capitalize">{item.type}</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-bold truncate max-w-xs">{item.title}</span>
          </div>

          {/* Header & Meta */}
          <div className="space-y-4 border-b border-[var(--portal-border)] pb-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                style={{ borderColor: theme.colors.primary, color: theme.colors.primary }}
              >
                {item.category || item.type}
              </Badge>
              {item.tags?.map(t => (
                <span key={t} className="text-xs text-[var(--portal-muted)] font-medium">
                  #{t}
                </span>
              ))}
            </div>

            <h1
              className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground"
              style={{ fontFamily: `${theme.typography.headingFont}, sans-serif` }}
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
                <Avatar className="w-9 h-9 border border-border">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                    {item.authors?.[0]?.name ? item.authors[0].name.charAt(0) : brandTitle.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-xs">
                  <p className="font-bold text-foreground">
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
                  className="h-8 px-2.5 rounded-xl text-xs font-bold text-emerald-600 hover:bg-emerald-500/10"
                >
                  WhatsApp
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleShareSocial('linkedin')}
                  className="h-8 px-2.5 rounded-xl text-xs font-bold text-blue-600 hover:bg-blue-500/10"
                >
                  LinkedIn
                </Button>
              </div>
            </div>
          </div>

          {/* Media Player / Download Vault Banner */}
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

          {item.type === 'resource' && item.media?.downloadUrl && (
            <Card className="rounded-3xl border-2 border-primary/30 bg-primary/5 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-xs">
                  <FolderArchive className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">Download Resource Toolkit</h4>
                  <p className="text-xs text-muted-foreground">
                    {item.media.fileName || 'Resource File'} • {item.media.mimeType || 'Standard Format'}
                  </p>
                </div>
              </div>

              <a href={item.media.downloadUrl} download>
                <Button className="rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-2 min-h-[42px] px-5">
                  <Download className="w-4 h-4" /> Download File
                </Button>
              </a>
            </Card>
          )}

          {/* Rich Content Body */}
          <article className="prose dark:prose-invert max-w-none text-sm md:text-base leading-relaxed space-y-4">
            {item.content ? (
              <div className="whitespace-pre-wrap font-normal leading-relaxed text-[var(--portal-text)]">
                {item.content}
              </div>
            ) : (
              <p className="text-xs text-[var(--portal-muted)] italic">No written body text provided.</p>
            )}
          </article>
        </div>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--portal-border)] bg-[var(--portal-surface)] px-6 py-8 text-center text-xs text-[var(--portal-muted)]">
        <p>{branding.copyrightText || `© ${new Date().getFullYear()} ${brandTitle}. All rights reserved.`}</p>
      </footer>

      {/* Global Search Modal */}
      <PortalSearchModal
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        portalId={portal.id}
        portalSlug={slug}
      />
    </div>
  );
}
