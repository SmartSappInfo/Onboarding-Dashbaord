'use client';

import * as React from 'react';
import {
  ExternalLink,
  Link2,
  MoreVertical,
  QrCode,
  Globe,
  ClipboardList,
  FileText,
  Calendar,
  Zap,
  LayoutList,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PortalPreview } from './PortalPreview';
import CreateQRButton from '@/components/qr-studio/create-qr-button';
import type { CampaignPage } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PortalCardProps {
  kind: 'survey' | 'pdf' | 'meeting' | 'custom';
  title: string;
  description?: string;
  entityName?: string;
  logoUrl?: string;
  entityId?: string;
  path: string;
  /** For custom pages — passed to PortalPreview to select the page-specific layout */
  pageKey?: string;
  backgroundColor?: string;
  meetingTime?: string;
  questionCount?: number;
  fieldCount?: number;
  themeColor?: string;
  onCopy: (path: string) => void;
  onEditSeo?: (pageKey: string, currentTitle: string, currentPath: string) => void;
  workspaceIds?: string[];
  onAssignWorkspaces?: (pageKey: string, currentWorkspaceIds: string[]) => void;
  pageId?: string;
  pageSettings?: CampaignPage['settings'];
}

// ─── Kind display config ──────────────────────────────────────────────────────

const KIND_CONFIG = {
  survey:  { label: 'Survey',   Icon: ClipboardList, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  pdf:     { label: 'Document', Icon: FileText,       color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  meeting: { label: 'Meeting',  Icon: Calendar,       color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  custom:  { label: 'Portal',   Icon: Zap,            color: 'bg-slate-100 text-slate-500 border-slate-200' },
} as const;

const THEME_COLOR = {
  survey:  '#6366f1',
  pdf:     '#f97316',
  meeting: '#8b5cf6',
  custom:  '#6366f1',
} as const;

// ─── Overlay button — module-level to avoid rerender-no-inline-components ─────

interface OverlayBtnProps {
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  href?: string;
  children: React.ReactNode;
}

const OVERLAY_BTN_BASE =
  'group/btn relative flex h-9 w-9 items-center justify-center rounded-xl ' +
  'border border-white/25 bg-white/12 backdrop-blur-sm text-white ' +
  'transition-all duration-150 hover:bg-primary hover:border-white/50 hover:scale-110 ' +
  'active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50';

function OverlayBtn({ label, onClick, href, children }: OverlayBtnProps) {
  const tooltip = (
    <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900/90 px-2 py-0.5 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover/btn:opacity-100">
      {label}
    </span>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={OVERLAY_BTN_BASE}>
        {tooltip}{children}
      </a>
    );
  }

  return (
    <button type="button" aria-label={label} onClick={onClick} className={OVERLAY_BTN_BASE}>
      {tooltip}{children}
    </button>
  );
}

// ─── PortalCard ───────────────────────────────────────────────────────────────

export const PortalCard = React.memo(function PortalCard({
  kind,
  title,
  description,
  entityName,
  logoUrl,
  entityId,
  path,
  pageKey,
  backgroundColor,
  meetingTime,
  questionCount,
  fieldCount,
  themeColor: themeColorProp,
  onCopy,
  onEditSeo,
  workspaceIds = [],
  onAssignWorkspaces,
  pageId,
  pageSettings,
}: PortalCardProps) {
  const cfg        = KIND_CONFIG[kind] ?? KIND_CONFIG.custom;
  const themeColor = themeColorProp ?? THEME_COLOR[kind];
  const fullUrl    = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;

  const handleCopy = React.useCallback(
    (e: React.MouseEvent) => { e.stopPropagation(); onCopy(path); },
    [onCopy, path],
  );

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl',
        'aspect-square',
        'border-2 border-border bg-card',
        'transition-all duration-200 cursor-pointer',
        'hover:border-primary hover:shadow-[0_8px_40px_hsl(var(--primary)/0.18)] hover:-translate-y-[3px]',
      )}
    >
      {/* ── Preview window ──────────────────────────────────────────────── */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <PortalPreview
          kind={kind}
          title={title}
          description={description}
          entityName={entityName}
          logoUrl={logoUrl}
          pageKey={pageKey}
          backgroundColor={backgroundColor}
          meetingTime={meetingTime}
          questionCount={questionCount}
          fieldCount={fieldCount}
          themeColor={themeColor}
          pageId={pageId}
          pageSettings={pageSettings}
        />

        {/* Kebab — always visible top-right */}
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
              <DropdownMenuItem asChild>
                <a href={path} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Portal
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onCopy(path)}
                className="flex items-center gap-2"
              >
                <Link2 className="h-3.5 w-3.5" />
                Copy Link
              </DropdownMenuItem>
              {onEditSeo && pageKey && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditSeo(pageKey, title, path);
                  }}
                  className="flex items-center gap-2"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Configure SEO
                </DropdownMenuItem>
              )}
              {onAssignWorkspaces && pageKey && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onAssignWorkspaces(pageKey, workspaceIds);
                  }}
                  className="flex items-center gap-2"
                >
                  <LayoutList className="h-3.5 w-3.5" />
                  Assign Workspaces
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Hover overlay */}
        <div className={cn(
          'absolute inset-0 z-10',
          'flex items-center justify-center gap-2.5',
          'bg-slate-900/60 backdrop-blur-[3px]',
          'opacity-0 transition-opacity duration-200 group-hover:opacity-100',
        )}>
          {/* Open */}
          <OverlayBtn label="Open Portal" href={path}>
            <ExternalLink className="h-4 w-4" />
          </OverlayBtn>

          {/* Copy link */}
          <OverlayBtn label="Copy Link" onClick={handleCopy}>
            <Link2 className="h-4 w-4" />
          </OverlayBtn>

          {/* Edit SEO */}
          {onEditSeo && pageKey && (
            <OverlayBtn
              label="Configure SEO"
              onClick={(e) => {
                e.stopPropagation();
                onEditSeo(pageKey, title, path);
              }}
            >
              <Globe className="h-4 w-4" />
            </OverlayBtn>
          )}

          {/* Assign Workspaces */}
          {onAssignWorkspaces && pageKey && (
            <OverlayBtn
              label="Assign Workspaces"
              onClick={(e) => {
                e.stopPropagation();
                onAssignWorkspaces(pageKey, workspaceIds);
              }}
            >
              <LayoutList className="h-4 w-4" />
            </OverlayBtn>
          )}

          {/* QR — wrapped in span to allow tooltip without breaking CreateQRButton */}
          <div className="group/btn relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/25 bg-white/12 backdrop-blur-sm text-white transition-all duration-150 hover:bg-primary hover:border-white/50 hover:scale-110 active:scale-95">
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900/90 px-2 py-0.5 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover/btn:opacity-100">
              Generate QR
            </span>
            <CreateQRButton
              resourceType="public_portal"
              resourceId={title.replace(/\s+/g, '-').toLowerCase()}
              resourceName={title}
              destinationUrl={fullUrl}
              variant="icon"
            />
          </div>
        </div>
      </div>

      {/* ── Identity row ─────────────────────────────────────────────────── */}
      <div className="flex h-[52px] flex-shrink-0 items-start justify-between gap-2 px-3.5 pt-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-bold leading-tight text-foreground">{title}</p>
          <p className="truncate text-[10px] font-semibold text-muted-foreground/60 mt-0.5">
            {entityName ?? path}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn('text-[9px] font-bold uppercase tracking-widest rounded-md px-1.5 py-0 flex-shrink-0', cfg.color)}
        >
          {cfg.label}
        </Badge>
      </div>

      {/* ── Live indicator row ───────────────────────────────────────────── */}
      <div className="flex h-[36px] flex-shrink-0 items-center justify-between border-t border-border px-3.5">
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-emerald-600">Live</span>
        </div>
        <a
          href={path}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${title}`}
          onClick={e => e.stopPropagation()}
          className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground hover:text-primary transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Launch
        </a>
      </div>
    </div>
  );
});

PortalCard.displayName = 'PortalCard';
