'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTenant } from '@/context/TenantContext';
import type { CustomPageStats } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { assignCustomPageWorkspaceAction } from '@/lib/custom-page-analytics-actions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Globe,
  ArrowRight,
  Check,
  Users,
  BarChart2,
  MoreVertical,
  Loader2,
  Eye,
  Play,
  CheckCircle2,
  RotateCcw,
  MousePointerClick,
} from 'lucide-react';

interface CustomPageListItem {
  slug: string;
  stats: CustomPageStats;
  updatedAt: string;
  pageId?: string | null;
  workspaceIds?: string[];
}

interface CustomPagesClientProps {
  initialPages: CustomPageListItem[];
}

// ─── Stat Pill ───────────────────────────────────────────────────────────────

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold tabular-nums">
      {label}
      <span className="text-slate-900 font-bold">{value.toLocaleString()}</span>
    </span>
  );
}

// ─── Summary Bar ─────────────────────────────────────────────────────────────

function SummaryBar({ pages }: { pages: CustomPageListItem[] }) {
  const totals = pages.reduce(
    (acc, p) => ({
      views: acc.views + p.stats.views,
      uniqueViews: acc.uniqueViews + p.stats.uniqueViews,
      videoStarts: acc.videoStarts + p.stats.videoStarts,
      videoCompletions: acc.videoCompletions + p.stats.videoCompletions,
      videoReplays: acc.videoReplays + p.stats.videoReplays,
      ctaClicks: acc.ctaClicks + p.stats.ctaClicks,
    }),
    { views: 0, uniqueViews: 0, videoStarts: 0, videoCompletions: 0, videoReplays: 0, ctaClicks: 0 }
  );

  const cards = [
    { label: 'Total Views', value: totals.views, icon: Eye },
    { label: 'Unique Visitors', value: totals.uniqueViews, icon: Users },
    { label: 'Video Plays', value: totals.videoStarts, icon: Play },
    { label: 'Completions', value: totals.videoCompletions, icon: CheckCircle2 },
    { label: 'Replays', value: totals.videoReplays, icon: RotateCcw },
    { label: 'CTA Clicks', value: totals.ctaClicks, icon: MousePointerClick },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
      {cards.map(({ label, value, icon: Icon }) => (
        <div
          key={label}
          className="flex flex-col gap-1.5 p-4 rounded-2xl bg-white border border-slate-200"
        >
          <Icon className="h-4 w-4 text-slate-400" />
          <p className="text-2xl font-bold text-slate-900 tabular-nums">
            {value.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 font-medium">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── CustomPagesClient ───────────────────────────────────────────────────────

export default function CustomPagesClient({ initialPages }: CustomPagesClientProps) {
  const { accessibleWorkspaces, activeOrganizationId } = useTenant();
  const { toast } = useToast();
  const [pages, setPages] = React.useState<CustomPageListItem[]>(initialPages);
  const [assigningSlug, setAssigningSlug] = React.useState<string | null>(null);

  const handleAssignWorkspace = async (slug: string, workspaceId: string) => {
    setAssigningSlug(slug);
    try {
      const res = await assignCustomPageWorkspaceAction(slug, workspaceId, activeOrganizationId);
      if (res.success) {
        toast({
          title: 'Workspace Assigned',
          description: `Custom page has been successfully linked to the selected workspace.`,
        });
        
        // Update local state
        setPages((prev) =>
          prev.map((p) =>
            p.slug === slug
              ? { ...p, workspaceIds: [workspaceId] }
              : p
          )
        );
      } else {
        toast({
          variant: 'destructive',
          title: 'Assignment Failed',
          description: res.error,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      toast({
        variant: 'destructive',
        title: 'Error occurred',
        description: message,
      });
    } finally {
      setAssigningSlug(null);
    }
  };

  return (
    <div className="space-y-6">
      <SummaryBar pages={pages} />
      
      <div className="space-y-3">
        {pages.map((page) => {
          const completionRate =
            page.stats.videoStarts > 0
              ? Math.round((page.stats.videoCompletions / page.stats.videoStarts) * 100)
              : 0;

          const formattedDate = page.updatedAt
            ? new Date(page.updatedAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : '—';

          // Resolve assigned workspaces from tenant context
          const pageWorkspaces = page.workspaceIds
            ?.map((id) => accessibleWorkspaces.find((w) => w.id === id))
            .filter((w): w is typeof accessibleWorkspaces[number] => !!w) ?? [];

          return (
            <div
              key={page.slug}
              className="group relative flex flex-col gap-4 p-5 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-[0_4px_20px_-4px_rgba(59,95,255,0.15)] transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Globe className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 truncate text-sm">
                        {page.slug}
                      </p>
                      
                      {/* Workspace assignment badges */}
                      {pageWorkspaces.map((ws) => (
                        <Badge
                          key={ws.id}
                          variant="outline"
                          style={{
                            borderColor: ws.color + '40',
                            color: ws.color,
                            backgroundColor: ws.color + '0a',
                          }}
                          className="text-[10px] font-bold tracking-wide rounded-full px-2"
                        >
                          {ws.name}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Last activity: {formattedDate}</p>
                  </div>
                </div>

                <div className="flex-shrink-0 flex items-center gap-2">
                  {/* Actions Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                      >
                        {assigningSlug === page.slug ? (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        ) : (
                          <MoreVertical className="h-4 w-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-slate-500" />
                          <span>Assign Workspace</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                          <DropdownMenuSubContent className="w-56">
                            {accessibleWorkspaces.map((ws) => (
                              <DropdownMenuItem
                                key={ws.id}
                                onClick={() => handleAssignWorkspace(page.slug, ws.id)}
                                className="flex items-center justify-between"
                              >
                                <span>{ws.name}</span>
                                {page.workspaceIds?.includes(ws.id) && (
                                  <Check className="h-4 w-4 text-blue-600" />
                                )}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                      </DropdownMenuSub>
                      
                      <DropdownMenuSeparator />
                      
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/admin/analytics/custom-pages/${encodeURIComponent(page.slug)}`}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <BarChart2 className="h-4 w-4 text-slate-500" />
                          <span>View detailed analytics</span>
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Standard view analytics arrow button */}
                  <Link
                    href={`/admin/analytics/custom-pages/${encodeURIComponent(page.slug)}`}
                    className="flex h-8 items-center gap-1 px-3 text-xs font-semibold text-slate-400 hover:text-blue-500 transition-colors"
                  >
                    <span>View</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <StatPill label="Views" value={page.stats.views} />
                <StatPill label="Unique" value={page.stats.uniqueViews} />
                <StatPill label="Plays" value={page.stats.videoStarts} />
                <StatPill label="Completions" value={page.stats.videoCompletions} />
                <StatPill label="CTA Clicks" value={page.stats.ctaClicks} />
                {page.stats.videoStarts > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                    {completionRate}% completion
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
