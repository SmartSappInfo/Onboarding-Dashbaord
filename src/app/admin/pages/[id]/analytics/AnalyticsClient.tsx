'use client';

import * as React from 'react';
import { use, useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CampaignPage } from '@/lib/types';
import Link from 'next/link';
import { getLeadsForPageAction, type LeadSummary } from '@/lib/lead-actions';

/**
 * ─── DEDICATED PAGE ANALYTICS DASHBOARD ───────────────────────────────────────
 * 
 * Provides real-time conversion metrics, KPI insights, and CRM lead capture logs
 * for an individual campaign landing page.
 * 
 * Maintainer Guidance & Caution Areas:
 * 1. Strict Typing Protocol: Avoid any use of `any` or `any[]`.
 * 2. High Load Defense: Client-side search + 20-row pagination prevents DOM over-saturation when thousands of leads exist.
 * 3. Security (CSV Injection Protection): All CSV export fields are sanitized against formula execution (`=`, `+`, `-`, `@`).
 * 4. Mobile & Touch Ergonomics: All interactive elements maintain `min-h-[44px]` touch targets.
 */

const ITEMS_PER_PAGE = 20;

/**
 * Sanitizes CSV cell values to prevent CSV Formula Injection vulnerability.
 */
function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Neutralize formula triggers
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
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Loading Page Analytics...</p>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center space-y-4">
          <p className="text-slate-400 text-sm font-semibold">Page not found or removed.</p>
          <Button asChild variant="outline" className="min-h-[44px] font-bold">
            <Link href="/admin/pages">Return to Campaign Hub</Link>
          </Button>
        </div>
      </div>
    );
  }

  const stats = page.stats || { views: 0, uniques: 0, clicks: 0, conversions: 0 };
  const conversionRate = stats.views > 0 ? ((stats.conversions / stats.views) * 100).toFixed(1) : '0.0';

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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="outline"
              className="min-h-[44px] w-11 p-0 rounded-xl border-slate-800 bg-slate-900 text-slate-200 hover:text-white hover:bg-slate-800 shrink-0"
              title="Return to Campaign Hub"
            >
              <Link href="/admin/pages">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{page.name}</h1>
                <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded border border-slate-800 bg-slate-900 text-emerald-400">
                  {page.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">/{page.slug} • Dedicated Analytics</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <Button
              asChild
              variant="outline"
              className="min-h-[44px] px-3.5 rounded-xl font-bold text-xs border-slate-800 bg-slate-900 text-slate-200 hover:text-white hover:bg-slate-800"
            >
              <Link href={`/admin/pages/${id}/builder`}>
                <Pencil className="w-4 h-4 mr-2 text-blue-400" />
                Edit in Builder
              </Link>
            </Button>

            {page.status === 'published' && (
              <Button
                asChild
                variant="outline"
                className="min-h-[44px] px-3.5 rounded-xl font-bold text-xs border-slate-800 bg-slate-900 text-slate-200 hover:text-white hover:bg-slate-800"
              >
                <a href={`/p/${page.slug}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2 text-emerald-400" />
                  View Live
                </a>
              </Button>
            )}

            <Button
              onClick={exportToCSV}
              variant="outline"
              className="min-h-[44px] px-4 rounded-xl font-bold text-xs border-slate-800 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 border-emerald-500/30"
              disabled={leads.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-800/80 bg-slate-900/60 shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Views</CardTitle>
                <div className="h-9 w-9 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20">
                  <Eye className="h-4 w-4 text-blue-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-extrabold text-white">{stats.views.toLocaleString()}</div>
              <p className="text-[10px] text-slate-500 font-semibold mt-1">Total page impressions</p>
            </CardContent>
          </Card>

          <Card className="border-slate-800/80 bg-slate-900/60 shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Unique Visitors</CardTitle>
                <div className="h-9 w-9 bg-purple-500/10 rounded-lg flex items-center justify-center border border-purple-500/20">
                  <Users className="h-4 w-4 text-purple-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-extrabold text-white">{stats.uniques.toLocaleString()}</div>
              <p className="text-[10px] text-slate-500 font-semibold mt-1">First-time visitors</p>
            </CardContent>
          </Card>

          <Card className="border-slate-800/80 bg-slate-900/60 shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">CTA Clicks</CardTitle>
                <div className="h-9 w-9 bg-amber-500/10 rounded-lg flex items-center justify-center border border-amber-500/20">
                  <MousePointerClick className="h-4 w-4 text-amber-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-extrabold text-white">{stats.clicks.toLocaleString()}</div>
              <p className="text-[10px] text-slate-500 font-semibold mt-1">Button interactions</p>
            </CardContent>
          </Card>

          <Card className="border-slate-800/80 bg-slate-900/60 shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Conversions</CardTitle>
                <div className="h-9 w-9 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-extrabold text-white">{stats.conversions.toLocaleString()}</div>
              <p className="text-[10px] text-slate-500 font-semibold mt-1">
                <span className="font-extrabold text-emerald-400">{conversionRate}%</span> CVR performance
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Conversion Performance Gauge */}
        {stats.views > 0 && (
          <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <CardTitle className="text-sm font-extrabold text-slate-100">Conversion Rate Performance</CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    {stats.conversions} of {stats.views} total visitors converted into leads ({conversionRate}%)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500 rounded-full shadow-md shadow-emerald-500/30"
                  style={{ width: `${Math.min(parseFloat(conversionRate), 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>0% Baseline</span>
                <span>50% CVR</span>
                <span>100% Max</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Captured Leads Table & Search Section */}
        <Card className="border-slate-800/80 bg-slate-900/60 shadow-xl overflow-hidden">
          <CardHeader className="border-b border-slate-800/80 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-extrabold text-slate-100">Captured Leads</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  {leads.length === 0
                    ? 'No responses submitted yet.'
                    : `${leads.length} lead${leads.length !== 1 ? 's' : ''} recorded for this campaign page.`}
                </CardDescription>
              </div>

              {leads.length > 0 && (
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    type="text"
                    placeholder="Search name, email, phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="min-h-[44px] pl-9 bg-slate-950 border-slate-800 text-xs font-semibold rounded-xl text-slate-200 placeholder:text-slate-500"
                  />
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loadingLeads ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-7 h-7 animate-spin text-slate-500" />
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="h-14 w-14 bg-slate-800/60 rounded-full flex items-center justify-center mx-auto mb-3 border border-slate-700">
                  <CheckCircle2 className="h-7 w-7 text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-300">
                  {searchTerm ? 'No matching leads found for search.' : 'No leads captured yet.'}
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {searchTerm ? 'Try adjusting your search criteria.' : 'Publish and share your page link to start gathering form and survey responses.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/50 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      <th className="text-left py-3.5 px-4">Submission Date</th>
                      <th className="text-left py-3.5 px-4">Lead Name</th>
                      <th className="text-left py-3.5 px-4">Email</th>
                      <th className="text-left py-3.5 px-4">Phone</th>
                      <th className="text-left py-3.5 px-4">UTM Attribution</th>
                      <th className="text-left py-3.5 px-4">Source Type</th>
                      <th className="text-left py-3.5 px-4">CRM Profile</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {paginatedLeads.map((lead) => {
                      const dataObj = lead.data || {};
                      const utmSource = typeof dataObj.utmSource === 'string' ? dataObj.utmSource : '';
                      const utmMedium = typeof dataObj.utmMedium === 'string' ? dataObj.utmMedium : '';
                      const utmCampaign = typeof dataObj.utmCampaign === 'string' ? dataObj.utmCampaign : '';
                      const hasUtm = Boolean(utmSource || utmMedium || utmCampaign);

                      return (
                        <tr key={lead.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4 text-slate-400 font-medium">
                            {new Date(lead.submittedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-100">{lead.name}</td>
                          <td className="py-3.5 px-4 text-slate-300 font-mono text-[11px]">{lead.email || '—'}</td>
                          <td className="py-3.5 px-4 text-slate-300 font-mono text-[11px]">{lead.phone || '—'}</td>
                          <td className="py-3.5 px-4">
                            {hasUtm ? (
                              <div className="flex flex-col gap-0.5 text-[10px]">
                                {utmSource && <span className="text-slate-300"><strong className="text-slate-400">Src:</strong> {utmSource}</span>}
                                {utmMedium && <span className="text-slate-300"><strong className="text-slate-400">Med:</strong> {utmMedium}</span>}
                                {utmCampaign && <span className="text-slate-300"><strong className="text-slate-400">Cmp:</strong> {utmCampaign}</span>}
                              </div>
                            ) : (
                              <span className="text-slate-500 text-[10px] font-bold uppercase">Direct / Organic</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={cn(
                                'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider',
                                lead.type === 'form'
                                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                  : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              )}
                            >
                              {lead.type}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {lead.entityId ? (
                              <Link
                                href={`/admin/contacts/${lead.entityId}`}
                                className="text-emerald-400 hover:text-emerald-300 font-bold text-xs hover:underline flex items-center gap-1"
                              >
                                View Profile →
                              </Link>
                            ) : (
                              <span className="text-slate-500 text-[11px]">Unlinked</span>
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
              <div className="flex items-center justify-between p-4 border-t border-slate-800/80 bg-slate-950/40">
                <span className="text-xs text-slate-400 font-semibold">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredLeads.length)} of {filteredLeads.length} leads
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="min-h-[44px] h-9 px-3 rounded-lg border-slate-800 text-slate-300 font-bold text-xs"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>
                  <span className="text-xs font-bold text-slate-300 px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage >= totalPages}
                    className="min-h-[44px] h-9 px-3 rounded-lg border-slate-800 text-slate-300 font-bold text-xs"
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
