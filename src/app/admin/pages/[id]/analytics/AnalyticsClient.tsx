'use client';

import * as React from 'react';
import { use, useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Eye,
  Users,
  MousePointerClick,
  CheckCircle2,
  TrendingUp,
  Download,
  ExternalLink,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Video,
  Play,
  FileText,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CampaignPage, CustomPageStats } from '@/lib/types';
import Link from 'next/link';
import { getLeadsForPageAction, type LeadSummary } from '@/lib/lead-actions';
import { formatCVR, formatStatCount } from '../../utils/page-stats';

/**
 * ─── DEDICATED PAGE ANALYTICS DASHBOARD ───────────────────────────────────────
 * 
 * Provides real-time conversion metrics, KPI insights, and CRM lead capture logs
 * for an individual campaign landing page, respecting global Light/Dark themes.
 * 
 * Maintainer Guidance & Caution Areas:
 * 1. Strict Typing Protocol: Avoid any use of `any` or `any[]`.
 * 2. Theme Token Alignment: Route background, card, border, and text styling strictly
 *    through semantic CSS design tokens (`bg-background`, `bg-card`, `text-foreground`, `border-border`).
 * 3. High Load Defense: Client-side search + 20-row pagination prevents DOM over-saturation when thousands of leads exist.
 * 4. Security (CSV Injection Protection): All CSV export fields are sanitized against formula execution (`=`, `+`, `-`, `@`).
 * 5. Mobile & Touch Ergonomics: All interactive elements maintain `min-h-[44px]` touch targets.
 * 6. Micro-Animations: Button presses include `active:scale-[0.97]` per `emilkowal-animations`.
 */

const ITEMS_PER_PAGE = 20;

/**
 * Sanitizes CSV cell values to prevent CSV Formula Injection vulnerability.
 */
function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Neutralize formula triggers (=, +, -, @, \t, \r)
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str.replace(/"/g, '""');
}

export function AnalyticsClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [page, setPage] = useState<CampaignPage | null>(null);
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch page details & captured leads from server action
  useEffect(() => {
    if (!firestore) return;

    const loadData = async () => {
      try {
        const pageSnap = await getDoc(doc(firestore, 'campaign_pages', id));
        if (!pageSnap.exists()) throw new Error('Campaign page not found');
        setPage(pageSnap.data() as CampaignPage);

        setLoadingLeads(true);
        const leadsRes = await getLeadsForPageAction(id);
        if (leadsRes.success && leadsRes.data) {
          setLeads(leadsRes.data);
        } else if (leadsRes.error) {
          toast({ variant: 'destructive', title: 'Leads fetch warning', description: leadsRes.error });
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Failed to load page analytics';
        toast({ variant: 'destructive', title: 'Analytics Load Error', description: errMsg });
      } finally {
        setLoading(false);
        setLoadingLeads(false);
      }
    };

    loadData();
  }, [firestore, id, toast]);

  // Client-side search filtering
  const filteredLeads = useMemo(() => {
    if (!searchTerm.trim()) return leads;
    const q = searchTerm.toLowerCase().trim();
    return leads.filter(lead => {
      const nameMatch = lead.name.toLowerCase().includes(q);
      const emailMatch = lead.email.toLowerCase().includes(q);
      const phoneMatch = lead.phone.toLowerCase().includes(q);
      return nameMatch || emailMatch || phoneMatch;
    });
  }, [leads, searchTerm]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE) || 1;
  const paginatedLeads = useMemo(() => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLeads.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [filteredLeads, currentPage]);

  // Reset pagination on search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Loading Page Analytics...</p>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground text-sm font-semibold">Page not found or removed.</p>
          <Button asChild variant="outline" className="min-h-[44px] font-bold active:scale-[0.97] transition-all">
            <Link href="/admin/pages">Return to Campaign Hub</Link>
          </Button>
        </div>
      </div>
    );
  }

  const stats: CustomPageStats = (page.stats as unknown as CustomPageStats) || { 
    views: 0, 
    uniqueViews: 0, 
    uniques: 0,
    videoStarts: 0, 
    videoMilestone50: 0, 
    videoCompletions: 0, 
    videoReplays: 0, 
    ctaClicks: 0, 
    clicks: 0,
    conversions: 0,
    formSubmissions: 0, 
    formAbandonments: 0, 
    meetingConfirmations: 0 
  };
  const conversionsCount = stats.conversions ?? 0;
  const uniquesCount = stats.uniques ?? stats.uniqueViews ?? 0;
  const clicksCount = stats.clicks ?? stats.ctaClicks ?? 0;

  const rawCVR = stats.views > 0 ? ((conversionsCount / stats.views) * 100).toFixed(1) : '0.0';
  const formattedCVRString = formatCVR(stats.views, conversionsCount);

  // Secure CSV Export with Injection Prevention
  const exportToCSV = () => {
    if (leads.length === 0) {
      toast({ title: 'No Submissions', description: 'No leads available to export.' });
      return;
    }

    const headers = ['Submitted At', 'Name', 'Email', 'Phone', 'Type', 'UTM Source', 'UTM Medium', 'UTM Campaign', 'Entity ID'];
    const rows = leads.map(lead => {
      const dataObj = lead.data || {};
      const utmSource = typeof dataObj.utmSource === 'string' ? dataObj.utmSource : '';
      const utmMedium = typeof dataObj.utmMedium === 'string' ? dataObj.utmMedium : '';
      const utmCampaign = typeof dataObj.utmCampaign === 'string' ? dataObj.utmCampaign : '';

      return [
        sanitizeCsvCell(new Date(lead.submittedAt).toLocaleString()),
        sanitizeCsvCell(lead.name),
        sanitizeCsvCell(lead.email),
        sanitizeCsvCell(lead.phone),
        sanitizeCsvCell(lead.type),
        sanitizeCsvCell(utmSource),
        sanitizeCsvCell(utmMedium),
        sanitizeCsvCell(utmCampaign),
        sanitizeCsvCell(lead.entityId || 'N/A'),
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${page.name.replace(/\s+/g, '-').toLowerCase()}-analytics-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: 'Export Complete', description: `Exported ${leads.length} captured leads.` });
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 md:p-8 transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Navigation Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="outline"
              className="min-h-[44px] w-11 p-0 rounded-xl border-border bg-card text-foreground hover:bg-muted shrink-0 active:scale-[0.97] transition-all"
              title="Return to Campaign Hub"
            >
              <Link href="/admin/pages">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{page.name}</h1>
                <Badge 
                  variant="outline"
                  className={cn(
                    "text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-lg border",
                    page.status === 'published' 
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" 
                      : "bg-muted text-muted-foreground border-border"
                  )}
                >
                  {page.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">/{page.slug} • Dedicated Analytics</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <Button
              asChild
              variant="outline"
              className="min-h-[44px] px-3.5 rounded-xl font-bold text-xs border-border bg-card text-foreground hover:bg-muted active:scale-[0.97] transition-all"
            >
              <Link href={`/admin/pages/${id}/builder`}>
                <Pencil className="w-4 h-4 mr-2 text-blue-500 dark:text-blue-400" />
                Edit in Builder
              </Link>
            </Button>

            {page.status === 'published' && (
              <Button
                asChild
                variant="outline"
                className="min-h-[44px] px-3.5 rounded-xl font-bold text-xs border-border bg-card text-foreground hover:bg-muted active:scale-[0.97] transition-all"
              >
                <a href={`/p/${page.slug}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2 text-emerald-500 dark:text-emerald-400" />
                  View Live
                </a>
              </Button>
            )}

            <Button
              onClick={exportToCSV}
              variant="outline"
              className="min-h-[44px] px-4 rounded-xl font-bold text-xs border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 active:scale-[0.97] transition-all"
              disabled={leads.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* KPI Cards Row (QR Studio Standard: Icon on Left, No Subtitles, No Partition Borders) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 rounded-2xl border-none ring-1 ring-border shadow-sm bg-card hover:ring-primary/20 hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Eye className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">TOTAL VIEWS</p>
                <p className="text-2xl font-bold text-foreground tracking-tight">{formatStatCount(stats.views)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 rounded-2xl border-none ring-1 ring-border shadow-sm bg-card hover:ring-primary/20 hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">UNIQUE VISITORS</p>
                <p className="text-2xl font-bold text-foreground tracking-tight">{formatStatCount(uniquesCount)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 rounded-2xl border-none ring-1 ring-border shadow-sm bg-card hover:ring-primary/20 hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <MousePointerClick className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">CTA CLICKS</p>
                <p className="text-2xl font-bold text-foreground tracking-tight">{formatStatCount(clicksCount)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 rounded-2xl border-none ring-1 ring-border shadow-sm bg-card hover:ring-primary/20 hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">CONVERSIONS</p>
                <p className="text-2xl font-bold text-foreground tracking-tight">{formatStatCount(conversionsCount)}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Conversion Performance Gauge (No Subtitles, No Partition) */}
        {stats.views > 0 && (
          <Card className="p-5 rounded-2xl border-none ring-1 ring-border shadow-sm bg-card hover:ring-primary/20 hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">CONVERSION RATE PERFORMANCE</p>
                <p className="text-lg font-bold text-foreground tracking-tight">{formattedCVRString} CVR</p>
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-3 overflow-hidden border border-border/40">
              <div
                className="bg-emerald-500 h-full transition-all duration-500 rounded-full shadow-sm"
                style={{ width: `${Math.min(parseFloat(rawCVR), 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <span>0% BASELINE</span>
              <span>50% CVR</span>
              <span>100% MAX</span>
            </div>
          </Card>
        )}

        {/* Media & Insertable Block Interactions Section (No Subtitles, No Partition) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Video Engagement Card */}
          <Card className="p-5 rounded-2xl border-none ring-1 ring-border shadow-sm bg-card hover:ring-primary/20 hover:shadow-md transition-all duration-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Video className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">VIDEO WATCH ENGAGEMENT</p>
                  <p className="text-base font-bold text-foreground tracking-tight">Playback Retention</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold bg-muted text-muted-foreground rounded-lg">
                Media Block
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center border border-border/50 rounded-xl p-3 bg-muted/20">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Video Starts</p>
                <p className="text-lg sm:text-xl font-extrabold text-foreground">{formatStatCount(stats.videoStarts || 0)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">50% Watched</p>
                <p className="text-lg sm:text-xl font-extrabold text-blue-600 dark:text-blue-400">{formatStatCount(stats.videoMilestone50 || 0)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Completed</p>
                <p className="text-lg sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{formatStatCount(stats.videoCompletions || 0)}</p>
              </div>
            </div>

            {/* Retention Progress Bar */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-1.5">
                <span>50% Watch Depth Rate</span>
                <span className="font-extrabold text-foreground">
                  {stats.videoStarts > 0 ? `${(((stats.videoMilestone50 || 0) / stats.videoStarts) * 100).toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border/40">
                <div
                  className="bg-blue-500 h-full transition-all duration-500 rounded-full"
                  style={{
                    width: `${stats.videoStarts > 0 ? Math.min((((stats.videoMilestone50 || 0) / stats.videoStarts) * 100), 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          </Card>

          {/* Form & Interactive Funnel Card */}
          <Card className="p-5 rounded-2xl border-none ring-1 ring-border shadow-sm bg-card hover:ring-primary/20 hover:shadow-md transition-all duration-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">INTERACTIVE BLOCKS & FUNNELS</p>
                  <p className="text-base font-bold text-foreground tracking-tight">Form & Booking Metrics</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold bg-muted text-muted-foreground rounded-lg">
                Interactive Blocks
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center border border-border/50 rounded-xl p-3 bg-muted/20">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Form Submits</p>
                <p className="text-lg sm:text-xl font-extrabold text-foreground">{formatStatCount(stats.formSubmissions || 0)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Abandonments</p>
                <p className="text-lg sm:text-xl font-extrabold text-amber-600 dark:text-amber-400">{formatStatCount(stats.formAbandonments || 0)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Meetings</p>
                <p className="text-lg sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{formatStatCount(stats.meetingConfirmations || 0)}</p>
              </div>
            </div>

            {/* Form Completion Rate Indicator */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-1.5">
                <span>Form Completion Efficiency</span>
                <span className="font-extrabold text-foreground">
                  {(stats.formSubmissions || 0) + (stats.formAbandonments || 0) > 0
                    ? `${(((stats.formSubmissions || 0) / ((stats.formSubmissions || 0) + (stats.formAbandonments || 0))) * 100).toFixed(1)}%`
                    : '—'}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border/40">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
                  style={{
                    width: `${
                      (stats.formSubmissions || 0) + (stats.formAbandonments || 0) > 0
                        ? Math.min(
                            (((stats.formSubmissions || 0) /
                              ((stats.formSubmissions || 0) + (stats.formAbandonments || 0))) *
                              100),
                            100
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Captured Leads Table & Search Section */}
        <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-card overflow-hidden">
          <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-foreground">Captured Leads</h2>
            </div>

              {leads.length > 0 && (
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search name, email, phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="min-h-[44px] pl-9 bg-background border-input text-xs font-semibold rounded-xl text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              )}
          </div>

          <CardContent className="p-0">
            {loadingLeads ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="h-14 w-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-3 border border-border">
                  <CheckCircle2 className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {searchTerm ? 'No matching leads found for search.' : 'No leads captured yet.'}
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  {searchTerm ? 'Try adjusting your search criteria.' : 'Publish and share your page link to start gathering form and survey responses.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                      <th className="text-left py-3.5 px-4">Submission Date</th>
                      <th className="text-left py-3.5 px-4">Lead Name</th>
                      <th className="text-left py-3.5 px-4">Email</th>
                      <th className="text-left py-3.5 px-4">Phone</th>
                      <th className="text-left py-3.5 px-4">UTM Attribution</th>
                      <th className="text-left py-3.5 px-4">Source Type</th>
                      <th className="text-left py-3.5 px-4">CRM Profile</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {paginatedLeads.map((lead) => {
                      const dataObj = lead.data || {};
                      const utmSource = typeof dataObj.utmSource === 'string' ? dataObj.utmSource : '';
                      const utmMedium = typeof dataObj.utmMedium === 'string' ? dataObj.utmMedium : '';
                      const utmCampaign = typeof dataObj.utmCampaign === 'string' ? dataObj.utmCampaign : '';
                      const hasUtm = Boolean(utmSource || utmMedium || utmCampaign);

                      return (
                        <tr key={lead.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3.5 px-4 text-muted-foreground font-medium">
                            {new Date(lead.submittedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-foreground">{lead.name}</td>
                          <td className="py-3.5 px-4 text-muted-foreground font-mono text-[11px]">{lead.email || '—'}</td>
                          <td className="py-3.5 px-4 text-muted-foreground font-mono text-[11px]">{lead.phone || '—'}</td>
                          <td className="py-3.5 px-4">
                            {hasUtm ? (
                              <div className="flex flex-col gap-0.5 text-[10px]">
                                {utmSource && <span className="text-foreground"><strong className="text-muted-foreground">Src:</strong> {utmSource}</span>}
                                {utmMedium && <span className="text-foreground"><strong className="text-muted-foreground">Med:</strong> {utmMedium}</span>}
                                {utmCampaign && <span className="text-foreground"><strong className="text-muted-foreground">Cmp:</strong> {utmCampaign}</span>}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-[10px] font-bold uppercase">Direct / Organic</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={cn(
                                'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider',
                                lead.type === 'form'
                                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                  : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                              )}
                            >
                              {lead.type}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {lead.entityId ? (
                              <Link
                                href={`/admin/contacts/${lead.entityId}`}
                                className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold text-xs flex items-center gap-1"
                              >
                                View Profile →
                              </Link>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">Unlinked</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {filteredLeads.length > ITEMS_PER_PAGE && (
              <div className="flex items-center justify-between p-4 border-t border-border bg-muted/20">
                <span className="text-xs text-muted-foreground font-semibold">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredLeads.length)} of {filteredLeads.length} leads
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="min-h-[44px] h-9 px-3 rounded-lg border-border text-foreground font-bold text-xs active:scale-[0.97] transition-all"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>
                  <span className="text-xs font-bold text-foreground px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage >= totalPages}
                    className="min-h-[44px] h-9 px-3 rounded-lg border-border text-foreground font-bold text-xs active:scale-[0.97] transition-all"
                  >
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
