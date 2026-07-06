'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Pencil,
  Eye,
  ExternalLink,
  Link2,
  Copy,
  MoreVertical,
  Loader2,
  BarChart2,
  Settings2,
  Archive,
  Trash2,
  Globe,
  Code,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CampaignPage } from '@/lib/types';
import { GoalPreview } from './GoalPreview';
import { formatCVR, formatStatCount } from '../utils/page-stats';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PageCardProps {
  page: CampaignPage;
  /** Owned by PagesClient — guards all duplicate buttons in the grid simultaneously */
  duplicatingId: string | null;
  onDuplicate:     (e: React.MouseEvent, pageId: string) => void;
  onViewAnalytics: (page: CampaignPage) => void;
  onPublish:       (pageId: string) => Promise<void>;
  onUnpublish:     (pageId: string) => Promise<void>;
  onArchive:       (pageId: string) => Promise<void>;
  onDeleteRequest: (page: CampaignPage) => void;
  onSettings:      (page: CampaignPage) => void;
  onCopyLink:      (e: React.MouseEvent, page: CampaignPage) => void;
}

// ─── Status badge config ──────────────────────────────────────────────────────

const STATUS_CONFIG = {
  published: { label: 'Published', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  draft:     { label: 'Draft',     className: 'bg-slate-100 text-slate-500 border-slate-200' },
  archived:  { label: 'Archived',  className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
} as const;

const GOAL_LABEL: Record<CampaignPage['pageGoal'], string> = {
  lead_capture: 'Lead Capture',
  registration: 'Registration',
  information:  'Information',
  payment:      'Payment',
  thank_you:    'Thank You',
};

// ─── Overlay icon button ──────────────────────────────────────────────────────
// Extracted to module level — rerender-no-inline-components

interface OverlayBtnProps {
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  href?: string;
  disabled?: boolean;
  children: React.ReactNode;
}

// Static base styles hoisted outside component — rendering-hoist-jsx
const OVERLAY_BTN_BASE =
  'group/btn relative flex h-9 w-9 items-center justify-center rounded-xl ' +
  'border border-white/25 bg-white/12 backdrop-blur-sm text-white ' +
  'transition-all duration-150 hover:bg-primary hover:border-white/50 hover:scale-110 ' +
  'active:scale-95 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-white/50';

function OverlayBtn({ label, onClick, href, disabled, children }: OverlayBtnProps) {
  const tooltip = (
    <span
      className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap
                 rounded-md bg-slate-900/90 px-2 py-0.5 text-[10px] font-bold text-white
                 opacity-0 transition-opacity group-hover/btn:opacity-100"
    >
      {label}
    </span>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className={OVERLAY_BTN_BASE}
      >
        {tooltip}
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={OVERLAY_BTN_BASE}
    >
      {tooltip}
      {children}
    </button>
  );
}

// ─── PageCard ─────────────────────────────────────────────────────────────────

export const PageCard = React.memo(function PageCard({
  page,
  duplicatingId,
  onDuplicate,
  onViewAnalytics,
  onPublish,
  onUnpublish,
  onArchive,
  onDeleteRequest,
  onSettings,
  onCopyLink,
}: PageCardProps) {
  const publicPath  = `/p/${page.slug}`;
  const builderPath = `/admin/pages/${page.id}/builder`;

  const isPublished = page.status === 'published';
  const isDraft     = page.status === 'draft';
  const isArchived  = page.status === 'archived';

  const { views = 0, conversions = 0 } = page.stats ?? {};
  const statusCfg = STATUS_CONFIG[page.status] ?? STATUS_CONFIG.draft;

  // Stable callbacks for kebab items — use refs to avoid closing over stale page
  // (page object is stable per Firestore snapshot, but being explicit is safer)
  const handlePublish   = React.useCallback(() => onPublish(page.id),   [onPublish,   page.id]);
  const handleUnpublish = React.useCallback(() => onUnpublish(page.id), [onUnpublish, page.id]);
  const handleArchive   = React.useCallback(() => onArchive(page.id),   [onArchive,   page.id]);

  const themeColor = page.settings?.themeOverrides?.primary ?? '#6366f1';

  return (
    <div
      className={cn(
        // Shape — perfect square
        'group relative flex flex-col overflow-hidden rounded-2xl',
        'aspect-square',
        // Border — uses CSS vars, not hardcoded hex (dark-mode safe)
        'border-2 border-border bg-card',
        // Hover — pure CSS, zero JS state
        'cursor-pointer transition-all duration-200',
        'hover:border-primary hover:shadow-[0_8px_40px_hsl(var(--primary)/0.18)] hover:-translate-y-[3px]',
      )}
    >
      {/* ── Preview window ──────────────────────────────────────────────── */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <GoalPreview
          goal={page.pageGoal}
          themeColor={themeColor}
          pageName={page.name}
          pageId={page.id}
          pageSettings={page.settings}
        />

        {/* Kebab — always visible, top-right */}
        <div className="absolute right-2.5 top-2.5 z-20">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="More options"
                onClick={e => e.stopPropagation()}
                className={cn(
                  'flex h-[30px] w-[30px] items-center justify-center rounded-lg',
                  'border border-white/30 bg-black/45 text-white backdrop-blur-md',
                  'transition-all duration-150 hover:bg-primary/85 hover:border-white/55',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
                )}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-48">
              {/* Edit Draft — draft only */}
              {isDraft ? (
                <DropdownMenuItem asChild>
                  <Link href={builderPath} className="flex items-center gap-2">
                    <Pencil className="h-3.5 w-3.5" />
                    Edit Draft
                  </Link>
                </DropdownMenuItem>
              ) : null}

              <DropdownMenuItem
                onClick={() => onViewAnalytics(page)}
                className="flex items-center gap-2"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                View Analytics
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={e => { e.stopPropagation(); onCopyLink(e, page); }}
                className="flex items-center gap-2"
              >
                <Code className="h-3.5 w-3.5" />
                Share & Embed
              </DropdownMenuItem>

              {/* Publish — draft or archived */}
              {isDraft || isArchived ? (
                <DropdownMenuItem
                  onClick={handlePublish}
                  className="flex items-center gap-2"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Publish
                </DropdownMenuItem>
              ) : null}

              {/* Unpublish — published only */}
              {isPublished ? (
                <DropdownMenuItem
                  onClick={handleUnpublish}
                  className="flex items-center gap-2"
                >
                  <Globe className="h-3.5 w-3.5 opacity-50" />
                  Unpublish
                </DropdownMenuItem>
              ) : null}

              <DropdownMenuItem
                onClick={() => onSettings(page)}
                className="flex items-center gap-2"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Settings
              </DropdownMenuItem>

              {/* Archive — any status except already archived */}
              {!isArchived ? (
                <DropdownMenuItem
                  onClick={handleArchive}
                  className="flex items-center gap-2"
                >
                  <Archive className="h-3.5 w-3.5" />
                  Archive
                </DropdownMenuItem>
              ) : null}

              {/* Delete — draft only; destructive action */}
              {isDraft ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDeleteRequest(page)}
                    className="flex items-center gap-2 text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Hover overlay — CSS group-hover, zero JS state (rerender-move-effect-to-event) */}
        <div
          className={cn(
            'absolute inset-0 z-10',
            'flex items-center justify-center gap-2.5',
            'bg-slate-900/62 backdrop-blur-[3px]',
            'opacity-0 transition-opacity duration-200 group-hover:opacity-100',
          )}
        >
          {/* Open Builder */}
          <OverlayBtn label="Open Builder" href={builderPath}>
            <Pencil className="h-4 w-4" />
          </OverlayBtn>

          {/* Preview — opens builder in preview mode */}
          <OverlayBtn label="Preview" href={`${builderPath}?preview=true`}>
            <Eye className="h-4 w-4" />
          </OverlayBtn>

          {/* Live Page */}
          <OverlayBtn
            label={isPublished ? 'Live Page' : 'Draft Preview'}
            href={publicPath}
          >
            <ExternalLink className="h-4 w-4" />
          </OverlayBtn>

          {/* Copy Link */}
          <OverlayBtn
            label="Share & Embed"
            onClick={e => { e.stopPropagation(); onCopyLink(e, page); }}
          >
            <Link2 className="h-4 w-4" />
          </OverlayBtn>

          {/* Duplicate — Risk 6: disabled={duplicatingId !== null} blocks any in-flight op */}
          <OverlayBtn
            label="Duplicate"
            disabled={duplicatingId !== null}
            onClick={e => { e.stopPropagation(); onDuplicate(e, page.id); }}
          >
            {duplicatingId === page.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </OverlayBtn>
        </div>
      </div>

      {/* ── Identity row — fixed height ─────────────────────────────────── */}
      <div className="flex h-[52px] flex-shrink-0 items-start justify-between gap-2 px-3.5 pt-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-bold leading-tight text-foreground">
            {page.name}
          </p>
          <p className="truncate text-[10px] font-semibold text-muted-foreground/60 mt-0.5">
            /{page.slug}
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          <Badge
            variant="outline"
            className={cn('text-[9px] font-bold uppercase tracking-widest rounded-md px-1.5 py-0', statusCfg.className)}
          >
            {statusCfg.label}
          </Badge>
          <Badge
            variant="outline"
            className="text-[9px] font-bold uppercase tracking-widest bg-primary/5 text-primary border-primary/20 rounded-md px-1.5 py-0"
          >
            {GOAL_LABEL[page.pageGoal] ?? page.pageGoal}
          </Badge>
        </div>
      </div>

      {/* ── Stats row — 3 columns, 1 row, fixed height ──────────────────── */}
      <div className="grid h-[52px] flex-shrink-0 grid-cols-3 border-t border-border">
        <StatCell label="Views"    value={formatStatCount(views)}      />
        <StatCell label="Converts" value={formatStatCount(conversions)} className="border-x border-border" color="text-emerald-500" />
        <StatCell label="CVR"      value={formatCVR(views, conversions)} color="text-primary" />
      </div>
    </div>
  );
});

PageCard.displayName = 'PageCard';

// ─── StatCell ─────────────────────────────────────────────────────────────────
// Module-level — rerender-no-inline-components

interface StatCellProps {
  label: string;
  value: string;
  className?: string;
  color?: string;
}

function StatCell({ label, value, className, color }: StatCellProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      <span className={cn('text-[13px] font-extrabold leading-none', color ?? 'text-foreground')}>
        {value}
      </span>
      <span className="mt-1 text-[8px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
