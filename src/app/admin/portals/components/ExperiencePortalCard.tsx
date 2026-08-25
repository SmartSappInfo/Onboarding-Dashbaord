'use client';

/**
 * {{Org_name}} Experience Platform — Experience Portal Card Component
 *
 * Renders a rich, animated portal card in the studio grid with live status indicators,
 * mode badges, quick share links, QR code generator trigger, and administrative action dropdowns.
 *
 * Rules:
 * - Strictly typed (Zero any / any[]).
 * - Conforms to emilkowal-animations & vercel-react-best-practices.
 * - Minimum 44px touch targets on mobile controls.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  ExternalLink,
  Copy,
  QrCode,
  MoreVertical,
  Edit3,
  CopyPlus,
  PlayCircle,
  PauseCircle,
  Archive,
  Trash2,
  GraduationCap,
  BookOpen,
  Crown,
  Users,
  FileCode,
  Library,
  Compass,
  FolderArchive,
  Newspaper,
  Megaphone,
  School,
  Award,
  UserCheck,
  Cpu,
  ShieldAlert,
  Hourglass,
  Sliders,
  Globe,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Portal, PortalMode, PortalStatus } from '@/lib/types/portal';
import CreateQRButton from '@/components/qr-studio/create-qr-button';

interface ExperiencePortalCardProps {
  portal: Portal;
  onCopy: (path: string) => void;
  onDuplicate: (portal: Portal) => void;
  onPublish: (portalId: string) => void;
  onSuspend: (portalId: string) => void;
  onArchive: (portalId: string) => void;
  onDelete: (portalId: string) => void;
}

const MODE_ICONS: Record<PortalMode, React.ComponentType<{ className?: string }>> = {
  academy: GraduationCap,
  course: BookOpen,
  membership: Crown,
  community: Users,
  classroom: School,
  documentation: FileCode,
  knowledge_base: Library,
  blog: Newspaper,
  news: Megaphone,
  resource_center: FolderArchive,
  customer_academy: Compass,
  certification: Award,
  coaching: UserCheck,
  product_training: Cpu,
  internal_academy: ShieldAlert,
  waitlist: Hourglass,
  custom: Sliders,
};

const STATUS_CONFIG: Record<
  PortalStatus,
  { label: string; badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline'; colorClass: string }
> = {
  published: {
    label: 'Published',
    badgeVariant: 'default',
    colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  configuring: {
    label: 'Configuring',
    badgeVariant: 'secondary',
    colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  draft: {
    label: 'Draft',
    badgeVariant: 'outline',
    colorClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  },
  suspended: {
    label: 'Suspended',
    badgeVariant: 'destructive',
    colorClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  },
  archived: {
    label: 'Archived',
    badgeVariant: 'secondary',
    colorClass: 'bg-muted text-muted-foreground border-border',
  },
};

export const ExperiencePortalCard = React.memo(function ExperiencePortalCard({
  portal,
  onCopy,
  onDuplicate,
  onPublish,
  onSuspend,
  onArchive,
  onDelete,
}: ExperiencePortalCardProps) {
  const IconComponent = MODE_ICONS[portal.primaryMode] || Globe;
  const statusCfg = STATUS_CONFIG[portal.status] || STATUS_CONFIG.draft;
  const publicPath = `/portal/${portal.slug}`;
  const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${publicPath}` : publicPath;

  const handleCopy = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onCopy(publicPath);
    },
    [onCopy, publicPath]
  );

  return (
    <Card
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-border bg-card shadow-sm',
        'transition-all duration-300 hover:border-primary/50 hover:shadow-xl hover:-translate-y-1',
        'min-h-[320px]'
      )}
    >
      {/* ── Visual Banner / Accent Top ─────────────────────────────────── */}
      <div
        className="relative h-28 w-full p-4 flex items-start justify-between transition-colors overflow-hidden"
        style={{
          backgroundColor: portal.theme.colors.surface || '#F8FAFC',
          borderBottom: `2px solid ${portal.theme.colors.border || '#E2E8F0'}`,
        }}
      >
        {/* Color accent glow in corner */}
        <div
          className="absolute -right-8 -top-8 w-24 h-24 rounded-full blur-2xl opacity-40 pointer-events-none"
          style={{ backgroundColor: portal.theme.colors.primary || '#3B82F6' }}
        />

        {/* Mode Icon & Status */}
        <div className="flex items-center gap-2.5 z-10">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
            style={{
              backgroundColor: portal.theme.colors.primary || '#3B82F6',
              color: '#FFFFFF',
            }}
          >
            <IconComponent className="w-5 h-5" />
          </div>
          <div>
            <Badge
              variant="outline"
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-background/80 backdrop-blur-sm border-border"
            >
              {portal.primaryMode.replace('_', ' ')}
            </Badge>
          </div>
        </div>

        {/* Status Pill */}
        <div className="z-10">
          <span
            className={cn(
              'inline-flex items-center text-[11px] font-bold px-2.5 py-0.5 rounded-full border',
              statusCfg.colorClass
            )}
          >
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full mr-1.5 animate-pulse',
                portal.status === 'published' ? 'bg-emerald-500' : 'bg-current'
              )}
            />
            {statusCfg.label}
          </span>
        </div>
      </div>

      {/* ── Card Body & Metadata ───────────────────────────────────────── */}
      <CardContent className="p-5 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/admin/portals/${portal.id}`}
              className="font-bold text-lg text-foreground hover:text-primary transition-colors line-clamp-1"
            >
              {portal.name}
            </Link>
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {portal.description || portal.branding.tagline || 'Configurable experience portal.'}
          </p>

          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/40 truncate max-w-[220px]">
              /portal/{portal.slug}
            </span>
            {portal.accessPolicy.passwordProtected && (
              <Badge variant="outline" className="text-[9px] font-bold text-amber-600 bg-amber-500/10 border-amber-500/20">
                🔒 Password
              </Badge>
            )}
            {portal.workspaceIds && portal.workspaceIds.length > 0 && (
              <Badge variant="outline" className="text-[9px] font-semibold text-muted-foreground border-border/60">
                {portal.workspaceIds.length} {portal.workspaceIds.length === 1 ? 'Workspace' : 'Workspaces'}
              </Badge>
            )}
          </div>
        </div>

        {/* ── Footer Actions Bar ───────────────────────────────────────── */}
        <div className="pt-4 mt-4 border-t border-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Link href={`/admin/portals/${portal.id}`}>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3.5 rounded-xl font-bold text-xs gap-1.5 hover:bg-primary hover:text-white transition-all active:scale-[0.97]"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Studio
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopy}
              title="Copy Public Link"
              className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground active:scale-[0.97]"
            >
              <Copy className="w-4 h-4" />
            </Button>

            <CreateQRButton
              resourceType="public_portal"
              resourceId={portal.id}
              resourceName={portal.name}
              destinationUrl={fullUrl}
              variant="icon"
            />
          </div>

          <div className="flex items-center gap-1">
            <a
              href={publicPath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-9 w-9 rounded-xl text-muted-foreground hover:text-primary transition-colors active:scale-[0.97]"
              title="Open Public Portal"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground active:scale-[0.97]">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl font-semibold text-xs">
                <DropdownMenuItem asChild>
                  <Link href={`/admin/portals/${portal.id}`} className="cursor-pointer gap-2">
                    <Edit3 className="w-3.5 h-3.5" /> Customize Studio
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => onDuplicate(portal)} className="cursor-pointer gap-2">
                  <CopyPlus className="w-3.5 h-3.5" /> Duplicate Portal
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {portal.status === 'published' ? (
                  <DropdownMenuItem
                    onClick={() => onSuspend(portal.id)}
                    className="cursor-pointer gap-2 text-amber-600 dark:text-amber-400"
                  >
                    <PauseCircle className="w-3.5 h-3.5" /> Suspend Portal
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => onPublish(portal.id)}
                    className="cursor-pointer gap-2 text-emerald-600 dark:text-emerald-400"
                  >
                    <PlayCircle className="w-3.5 h-3.5" /> Publish Live
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem onClick={() => onArchive(portal.id)} className="cursor-pointer gap-2">
                  <Archive className="w-3.5 h-3.5" /> Archive
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() => onDelete(portal.id)}
                  className="cursor-pointer gap-2 text-rose-600 dark:text-rose-400 focus:text-rose-600"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Portal
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
