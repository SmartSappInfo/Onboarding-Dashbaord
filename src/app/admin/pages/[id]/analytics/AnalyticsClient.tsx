'use client';

import * as React from 'react';
import { use, useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CampaignPage } from '@/lib/types';
import Link from 'next/link';
import { getLeadsForPageAction } from '@/lib/lead-actions';

interface LeadSummary {
  id: string;
  submittedAt: string;
  name: string;
  email: string;
  phone: string;
  data: Record<string, any>;
  entityId?: string;
  type: 'form' | 'survey';
  sourceId: string;
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


  useEffect(() => {
    if (!firestore) return;

    const loadData = async () => {
      try {
        // Fetch page
        const pageSnap = await getDoc(doc(firestore, 'campaign_pages', id));
        if (!pageSnap.exists()) throw new Error('Page not found');
        setPage(pageSnap.data() as CampaignPage);

        // Fetch leads
        setLoadingLeads(true);
        const leadsRes = await getLeadsForPageAction(id);
        if (leadsRes.success && leadsRes.data) {
          setLeads(leadsRes.data);
        }
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'Error loading analytics', description: err.message });
      } finally {
        setLoading(false);
        setLoadingLeads(false);
      }
    };

    loadData();
  }, [firestore, id, toast]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-slate-400">Page not found</p>
      </div>
    );
  }

  const stats = page.stats || { views: 0, uniques: 0, clicks: 0, conversions: 0 };
  const conversionRate = stats.views > 0 ? ((stats.conversions / stats.views) * 100).toFixed(1) : '0.0';

  const exportToCSV = () => {
    if (leads.length === 0) {
      toast({ title: 'No Data', description: 'No leads to export.' });
      return;
    }

    const headers = ['Submitted At', 'Name', 'Email', 'Phone', 'Type', 'UTM Source', 'UTM Medium', 'UTM Campaign', 'Entity ID'];
    const rows = leads.map(lead => [
      new Date(lead.submittedAt).toLocaleString(),
      lead.name,
      lead.email,
      lead.phone,
      lead.type,
      (lead.data as any).utmSource || '',
      (lead.data as any).utmMedium || '',
      (lead.data as any).utmCampaign || '',
      lead.entityId || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${page.name.replace(/\s+/g, '-')}-leads-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: 'Exported', description: `${leads.length} leads exported to CSV.` });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              asChild
              variant="outline"
              className="h-10 w-10 p-0 rounded-xl border-slate-200"
            >
              <Link href={`/admin/pages/${id}/builder`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{page.name}</h1>
              <p className="text-sm text-slate-500">Page Analytics</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {page.status === 'published' && (
              <Button
                asChild
                variant="outline"
                className="h-10 rounded-xl font-semibold"
              >
                <a href={`/p/${page.slug}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Live
                </a>
              </Button>
            )}
            <Button
              onClick={exportToCSV}
              variant="outline"
              className="h-10 rounded-xl font-semibold"
              disabled={leads.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>


        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-600">Total Views</CardTitle>
                <div className="h-10 w-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Eye className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{stats.views.toLocaleString()}</div>
              <p className="text-xs text-slate-500 mt-1">Page visits</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-600">Unique Visitors</CardTitle>
                <div className="h-10 w-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{stats.uniques.toLocaleString()}</div>
              <p className="text-xs text-slate-500 mt-1">First-time visitors</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-600">CTA Clicks</CardTitle>
                <div className="h-10 w-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <MousePointerClick className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{stats.clicks.toLocaleString()}</div>
              <p className="text-xs text-slate-500 mt-1">Button interactions</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-600">Conversions</CardTitle>
                <div className="h-10 w-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{stats.conversions.toLocaleString()}</div>
              <p className="text-xs text-slate-500 mt-1">
                <span className="font-semibold text-emerald-600">{conversionRate}%</span> conversion rate
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Conversion Rate Insight */}
        {stats.views > 0 && (
          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-emerald-50 to-teal-50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-emerald-500 rounded-xl flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg">Conversion Performance</CardTitle>
                  <CardDescription>
                    {stats.conversions} of {stats.views} visitors converted ({conversionRate}%)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${Math.min(parseFloat(conversionRate), 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-slate-600">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </CardContent>
          </Card>
        )}


        {/* Leads Table */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Captured Leads</CardTitle>
            <CardDescription>
              {leads.length === 0
                ? 'No submissions yet'
                : `${leads.length} submission${leads.length !== 1 ? 's' : ''} from this page`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingLeads ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-12">
                <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-8 w-8 text-slate-400" />
                </div>
                <p className="text-sm text-slate-500">No leads captured yet. Share your page to start collecting responses!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 font-semibold text-slate-600">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-600">Name</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-600">Email</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-600">Phone</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-600">Source</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-600">Type</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-600">Entity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr key={lead.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-slate-600">
                          {new Date(lead.submittedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">{lead.name}</td>
                        <td className="py-3 px-4 text-slate-600">{lead.email || '-'}</td>
                        <td className="py-3 px-4 text-slate-600">{lead.phone || '-'}</td>
                        <td className="py-3 px-4">
                          {(lead.data as any).utmSource || (lead.data as any).utmMedium ? (
                            <div className="flex flex-col gap-0.5">
                              {(lead.data as any).utmSource && (
                                <span className="text-xs text-slate-600">
                                  <span className="font-semibold">Source:</span> {(lead.data as any).utmSource}
                                </span>
                              )}
                              {(lead.data as any).utmMedium && (
                                <span className="text-xs text-slate-600">
                                  <span className="font-semibold">Medium:</span> {(lead.data as any).utmMedium}
                                </span>
                              )}
                              {(lead.data as any).utmCampaign && (
                                <span className="text-xs text-slate-600">
                                  <span className="font-semibold">Campaign:</span> {(lead.data as any).utmCampaign}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">Direct</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={cn(
                              'inline-flex items-center px-2 py-1 rounded-md text-xs font-medium',
                              lead.type === 'form'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-purple-100 text-purple-700'
                            )}
                          >
                            {lead.type === 'form' ? 'Form' : 'Survey'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {lead.entityId ? (
                            <Link
                              href={`/admin/contacts/${lead.entityId}`}
                              className="text-emerald-600 hover:text-emerald-700 font-medium text-xs hover:underline"
                            >
                              View Contact →
                            </Link>
                          ) : (
                            <span className="text-slate-400 text-xs">Not linked</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
