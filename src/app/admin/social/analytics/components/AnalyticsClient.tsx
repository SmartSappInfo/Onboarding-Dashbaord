'use client';

import * as React from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, query, where } from 'firebase/firestore';
import { Label } from '@/components/ui/label';
import { 
  BarChart as ChartBarIcon, 
  TrendingUp, 
  MousePointer, 
  Users, 
  DollarSign, 
  Loader2, 
  Sparkles 
} from 'lucide-react';
import { 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { simulateSocialConversionsAction } from '@/app/actions/social-composer-actions';
import type { SocialPost, WorkspaceEntity, Invoice } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TimeMetric {
  date: string;
  Reach: number;
  Clicks: number;
  Engagements: number;
}

interface FunnelMetric {
  stage: string;
  value: number;
  fill: string;
}

export default function AnalyticsClient() {
  const db = useFirestore();
  const { activeWorkspaceId, activeOrganizationId } = useTenant();
  const { toast } = useToast();

  const [activePlatform, setActivePlatform] = React.useState<string>('all');
  const [selectedPostId, setSelectedPostId] = React.useState<string>('all');
  const [isSeeding, setIsSeeding] = React.useState(false);

  // 1. Load Social Posts
  const postsQuery = React.useMemo(() => {
    if (!db || !activeWorkspaceId) return null;
    return query(
      collection(db, 'socialPosts'),
      where('workspaceId', '==', activeWorkspaceId)
    );
  }, [db, activeWorkspaceId]);

  const { data: postsRaw, isLoading: isLoadingPosts } = useCollection<SocialPost>(postsQuery);
  const posts = postsRaw || [];

  // 2. Load CRM Contacts
  const contactsQuery = React.useMemo(() => {
    if (!db || !activeWorkspaceId) return null;
    return query(
      collection(db, 'workspaceEntities'),
      where('workspaceId', '==', activeWorkspaceId),
      where('entityType', '==', 'person')
    );
  }, [db, activeWorkspaceId]);

  const { data: contactsRaw } = useCollection<WorkspaceEntity>(contactsQuery);
  const contacts = contactsRaw || [];

  // 3. Load Invoices
  const invoicesQuery = React.useMemo(() => {
    if (!db || !activeWorkspaceId) return null;
    return query(
      collection(db, 'invoices'),
      where('workspaceIds', 'array-contains', activeWorkspaceId),
      where('status', '==', 'paid')
    );
  }, [db, activeWorkspaceId]);

  const { data: invoicesRaw } = useCollection<Invoice>(invoicesQuery);
  const invoices = invoicesRaw || [];

  // 4. Heuristics Aggregation
  const kpis = React.useMemo(() => {
    let totalReach = 0;
    let totalClicks = 0;

    posts.forEach((post) => {
      if (selectedPostId !== 'all' && post.id !== selectedPostId) return;

      Object.entries(post.platformVariations).forEach(([platform, variation]) => {
        if (activePlatform !== 'all' && platform !== activePlatform) return;

        // Calculate reach and clicks from mock/simulated indices
        const multiplier = post.aiOptimized ? 2.5 : 1.0;
        totalReach += Math.floor((platform === 'linkedin' ? 800 : 450) * multiplier);
        totalClicks += Math.floor((platform === 'linkedin' ? 65 : 30) * multiplier);
      });
    });

    // CRM Lead attribution mapping
    const attributedLeads = contacts.filter((c) => {
      const matchCampaign = selectedPostId === 'all' || c.utmCampaign === selectedPostId;
      const matchPlatform = activePlatform === 'all' || c.utmSource === activePlatform;
      return c.utmMedium === 'social' && matchCampaign && matchPlatform;
    });

    const leadIds = attributedLeads.map(l => l.id);

    // Revenue ROI Attribution mapping
    const attributedRevenue = invoices
      .filter((inv) => inv.entityId && leadIds.includes(inv.entityId))
      .reduce((sum, inv) => sum + inv.totalPayable, 0);

    return {
      reach: totalReach,
      clicks: totalClicks,
      leads: attributedLeads.length,
      revenue: attributedRevenue,
    };
  }, [posts, contacts, invoices, activePlatform, selectedPostId]);

  // Seeding Campaign conversions helper
  const handleSeedMetrics = async () => {
    if (posts.length === 0) {
      toast({
        title: 'No Social Posts Found',
        description: 'Please create a scheduled/published post first before seeding conversions.',
        variant: 'destructive',
      });
      return;
    }

    setIsSeeding(true);
    try {
      // Pick the first post to seed conversions for
      const targetPost = posts[0];
      const res = await simulateSocialConversionsAction(activeWorkspaceId, activeOrganizationId, targetPost.id);

      if (res.success) {
        toast({
          title: 'Conversions Generated',
          description: `Seeded click traffic, CRM leads, and paid invoices attributed to: "${targetPost.contentObject.title}"`,
        });
      } else {
        throw new Error(res.error || 'Seed conversions API failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Seeding error';
      toast({
        title: 'Seeding Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSeeding(false);
    }
  };

  // Timeline charts data mapping
  const timelineData = React.useMemo<TimeMetric[]>(() => {
    const dates = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return dates.map((day, idx) => {
      const reachFactor = kpis.reach > 0 ? kpis.reach / 7 : 120;
      const clickFactor = kpis.clicks > 0 ? kpis.clicks / 7 : 12;

      return {
        date: day,
        Reach: Math.floor(reachFactor * (0.8 + Math.sin(idx) * 0.3)),
        Clicks: Math.floor(clickFactor * (0.7 + Math.cos(idx) * 0.4)),
        Engagements: Math.floor(clickFactor * 1.8 * (0.6 + Math.sin(idx + 1) * 0.3)),
      };
    });
  }, [kpis]);

  // Conversion funnel data mapping
  const funnelData = React.useMemo<FunnelMetric[]>(() => {
    return [
      { stage: 'Post Clicks', value: kpis.clicks || 10, fill: 'hsl(142, 70%, 45%)' },
      { stage: 'CRM Leads', value: kpis.leads || 2, fill: 'hsl(142, 60%, 55%)' },
      { stage: 'Paid ROI', value: invoices.filter(inv => inv.entityId && contacts.find(c => c.id === inv.entityId && c.utmMedium === 'social')).length || 0, fill: 'hsl(142, 50%, 65%)' },
    ];
  }, [kpis, invoices, contacts]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-8 px-4">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <ChartBarIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">ROI Analytics</h1>
            <p className="text-muted-foreground text-xs font-medium">Track your social content click-through rates, lead acquisitions, and attributed program revenue.</p>
          </div>
        </div>

        <Button 
          onClick={handleSeedMetrics}
          disabled={isSeeding}
          className="rounded-xl h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs tracking-wide active:scale-[0.97] transition-all gap-1.5 shadow-lg shadow-emerald-500/10 self-end md:self-auto"
        >
          {isSeeding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Simulate Post Conversions
        </Button>
      </div>

      {/* Select filters row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
        <div className="space-y-1">
          <Label className="text-[10px] font-bold text-muted-foreground uppercase">Filter Profile Channel</Label>
          <Select value={activePlatform} onValueChange={setActivePlatform}>
            <SelectTrigger className="rounded-xl border-border/30 h-10 bg-card/40">
              <SelectValue placeholder="All channels" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Profiles</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="x">X</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-bold text-muted-foreground uppercase">Filter Specific Campaign</Label>
          <Select value={selectedPostId} onValueChange={setSelectedPostId}>
            <SelectTrigger className="rounded-xl border-border/30 h-10 bg-card/40">
              <SelectValue placeholder="All campaigns" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Posts / Campaigns</SelectItem>
              {posts.map((post) => (
                <SelectItem key={post.id} value={post.id}>
                  {post.contentObject.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI metric summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="border border-border/30 bg-card/40 backdrop-blur-sm rounded-2xl hover:-translate-y-1 hover:shadow-lg transition-all duration-300 relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardDescription className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Platform Reach</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between pb-4">
            <span className="text-xl font-black text-foreground">{kpis.reach.toLocaleString()}</span>
            <TrendingUp className="h-5 w-5 text-emerald-500 opacity-60" />
          </CardContent>
        </Card>

        <Card className="border border-border/30 bg-card/40 backdrop-blur-sm rounded-2xl hover:-translate-y-1 hover:shadow-lg transition-all duration-300 relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardDescription className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Post Link Clicks</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between pb-4">
            <span className="text-xl font-black text-foreground">{kpis.clicks.toLocaleString()}</span>
            <MousePointer className="h-5 w-5 text-emerald-500 opacity-60" />
          </CardContent>
        </Card>

        <Card className="border border-border/30 bg-card/40 backdrop-blur-sm rounded-2xl hover:-translate-y-1 hover:shadow-lg transition-all duration-300 relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardDescription className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">CRM Leads Generated</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between pb-4">
            <span className="text-xl font-black text-foreground">{kpis.leads.toLocaleString()}</span>
            <Users className="h-5 w-5 text-emerald-500 opacity-60" />
          </CardContent>
        </Card>

        <Card className="border border-border/30 bg-card/40 backdrop-blur-sm rounded-2xl hover:-translate-y-1 hover:shadow-lg transition-all duration-300 relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardDescription className="text-[9px] font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1">
              Attributed ROI Revenue
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between pb-4">
            <span className="text-xl font-black text-foreground">${kpis.revenue.toLocaleString()}</span>
            <DollarSign className="h-5 w-5 text-emerald-500 opacity-60" />
          </CardContent>
        </Card>
      </div>

      {/* Visual Analytics graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Engagement log (8/12) */}
        <Card className="lg:col-span-8 border border-border/20 bg-card/10 backdrop-blur-md rounded-3xl overflow-hidden relative shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/2 to-transparent pointer-events-none" />
          <CardHeader className="pb-6 border-b border-border/10 bg-muted/5">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Weekly Engagement Timeline</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-80">
            <ResponsiveContainer width="100%" height="100%" debounce={100}>
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 70%, 45%)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="hsl(142, 70%, 45%)" stopOpacity={0.01}/>
                  </linearGradient>
                  <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(200, 70%, 45%)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="hsl(200, 70%, 45%)" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.1)" />
                <XAxis dataKey="date" stroke="rgba(128,128,128,0.5)" tickLine={false} axisLine={false} style={{ fontSize: '9px', fontWeight: 'bold' }} />
                <YAxis stroke="rgba(128,128,128,0.5)" tickLine={false} axisLine={false} style={{ fontSize: '9px', fontWeight: 'bold' }} />
                <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.85)', borderRadius: '12px', border: 'rgba(128,128,128,0.2)', fontSize: '10px', color: '#fff' }} />
                <Area type="monotone" dataKey="Reach" stroke="hsl(142, 70%, 45%)" fillOpacity={1} fill="url(#colorReach)" strokeWidth={2} />
                <Area type="monotone" dataKey="Clicks" stroke="hsl(200, 70%, 45%)" fillOpacity={1} fill="url(#colorClicks)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Funnel Conversions (4/12) */}
        <Card className="lg:col-span-4 border border-border/20 bg-card/10 backdrop-blur-md rounded-3xl overflow-hidden relative shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/2 to-transparent pointer-events-none" />
          <CardHeader className="pb-6 border-b border-border/10 bg-muted/5">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pipeline Funnel</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 h-80">
            <ResponsiveContainer width="100%" height="100%" debounce={100}>
              <BarChart data={funnelData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.1)" />
                <XAxis dataKey="stage" stroke="rgba(128,128,128,0.5)" tickLine={false} axisLine={false} style={{ fontSize: '9px', fontWeight: 'bold' }} />
                <YAxis stroke="rgba(128,128,128,0.5)" tickLine={false} axisLine={false} style={{ fontSize: '9px', fontWeight: 'bold' }} />
                <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.85)', borderRadius: '12px', border: 'rgba(128,128,128,0.2)', fontSize: '10px', color: '#fff' }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
