'use client';

import * as React from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageContainerFluid } from '@/components/ui/page-container';
import { collection, query, where, doc, setDoc, getDocs, limit } from 'firebase/firestore';
import { 
  Radio, 
  Settings, 
  ListFilter, 
  Sparkles, 
  Loader2, 
  Plus, 
  X, 
  Save, 
  Bell, 
  Mail, 
  Activity, 
  Linkedin, 
  Facebook, 
  Instagram, 
  Twitter, 
  Youtube, 
  Globe 
} from 'lucide-react';
import { simulateListeningMentionAction } from '@/app/actions/social-composer-actions';
import type { SocialListeningRule } from '@/lib/types';
import { cn } from '@/lib/utils';

const platformIcons: Record<string, React.ElementType> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  x: Twitter,
  youtube: Youtube,
};

const sentimentColors = {
  positive: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  neutral: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  negative: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
};

interface SocialListeningAlert {
  id: string;
  orgId: string;
  workspaceId: string;
  author: string;
  platform: string;
  content: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  matchingKeyword: string;
  createdAt: string;
}

export default function ListeningClient() {
  const db = useFirestore();
  const { activeWorkspaceId, activeOrganizationId } = useTenant();
  const { toast } = useToast();

  const [isLoadingRule, setIsLoadingRule] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSimulating, setIsSimulating] = React.useState(false);

  // Rules form state
  const [ruleId, setRuleId] = React.useState<string | null>(null);
  const [trackKeywords, setTrackKeywords] = React.useState<string[]>([]);
  const [excludeKeywords, setExcludeKeywords] = React.useState<string[]>([]);
  const [trackCompetitors, setTrackCompetitors] = React.useState<string[]>([]);
  const [alertThreshold, setAlertThreshold] = React.useState<'any' | 'negative' | 'viral_potential'>('any');
  const [notifyEmail, setNotifyEmail] = React.useState(false);
  const [notifyInApp, setNotifyInApp] = React.useState(true);
  const [notifyFeed, setNotifyFeed] = React.useState(true);

  // Input builders
  const [keywordInput, setKeywordInput] = React.useState('');
  const [excludeInput, setExcludeInput] = React.useState('');
  const [competitorInput, setCompetitorInput] = React.useState('');

  // 1. Fetch active Social Listening alerts
  const alertsQuery = React.useMemo(() => {
    if (!db || !activeWorkspaceId) return null;
    return query(
      collection(db, 'socialListeningAlerts'),
      where('workspaceId', '==', activeWorkspaceId)
    );
  }, [db, activeWorkspaceId]);

  const { data: alertsRaw, isLoading: isLoadingAlerts } = useCollection<SocialListeningAlert>(alertsQuery);
  const alerts = alertsRaw || [];

  // Sort alerts by date descending
  const sortedAlerts = React.useMemo(() => {
    return [...alerts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [alerts]);

  // 2. Fetch Rules Settings for Workspace
  React.useEffect(() => {
    async function loadRules() {
      if (!db || !activeWorkspaceId) return;
      setIsLoadingRule(true);
      try {
        const rulesSnap = await getDocs(
          query(
            collection(db, 'socialListeningRules'),
            where('workspaceId', '==', activeWorkspaceId),
            limit(1)
          )
        );

        if (!rulesSnap.empty) {
          const ruleDoc = rulesSnap.docs[0];
          const data = ruleDoc.data() as SocialListeningRule;

          setRuleId(ruleDoc.id);
          setTrackKeywords(data.trackKeywords || []);
          setExcludeKeywords(data.excludeKeywords || []);
          setTrackCompetitors(data.trackCompetitors || []);
          setAlertThreshold(data.alertThreshold || 'any');
          setNotifyEmail(data.notifyEmail || false);
          setNotifyInApp(data.notifyInApp || false);
          setNotifyFeed(data.notifyFeed || false);
        }
      } catch (err: unknown) {
        console.error('[LISTENING:LOAD_RULES] Error:', err);
      } finally {
        setIsLoadingRule(false);
      }
    }

    loadRules();
  }, [db, activeWorkspaceId]);

  // Save rules changes to Firestore
  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !activeWorkspaceId) return;

    setIsSaving(true);
    try {
      const activeId = ruleId || `rule_${Math.random().toString(36).substring(2, 11)}`;
      const payload: SocialListeningRule = {
        id: activeId,
        orgId: activeOrganizationId,
        workspaceId: activeWorkspaceId,
        name: 'Workspace Listening Profile',
        trackKeywords,
        excludeKeywords,
        trackCompetitors,
        trackHashtags: [],
        alertThreshold,
        notifyEmail,
        notifyInApp,
        notifyFeed,
        active: true,
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'socialListeningRules', activeId), payload);
      setRuleId(activeId);

      toast({
        title: 'Listening Rules Saved',
        description: 'Your brand monitoring rule keyword guidelines are active.',
      });
    } catch (err: unknown) {
      console.error('[LISTENING:SAVE_RULES] Error:', err);
      const msg = err instanceof Error ? err.message : 'Save rules failed';
      toast({
        title: 'Save Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Simulate brand mention trigger
  const handleSimulateMention = async () => {
    if (!ruleId) {
      toast({
        title: 'Profile Profile Required',
        description: 'Please save your rules profile settings first before triggering simulations.',
        variant: 'destructive',
      });
      return;
    }

    setIsSimulating(true);
    try {
      const res = await simulateListeningMentionAction(activeWorkspaceId, activeOrganizationId);
      if (res.success) {
        toast({
          title: 'Brand Mention Logged',
          description: 'A mock social mention was processed and cataloged in your alerts feed.',
        });
      } else {
        throw new Error(res.error || 'Simulate mention API returned fail');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Simulation failed';
      toast({
        title: 'Mention Not Captured',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSimulating(false);
    }
  };

  // Helper additions
  const handleAddKeyword = () => {
    if (!keywordInput.trim()) return;
    if (!trackKeywords.includes(keywordInput.trim().toLowerCase())) {
      setTrackKeywords(prev => [...prev, keywordInput.trim().toLowerCase()]);
    }
    setKeywordInput('');
  };

  const handleAddExclude = () => {
    if (!excludeInput.trim()) return;
    if (!excludeKeywords.includes(excludeInput.trim().toLowerCase())) {
      setExcludeKeywords(prev => [...prev, excludeInput.trim().toLowerCase()]);
    }
    setExcludeInput('');
  };

  const handleAddCompetitor = () => {
    if (!competitorInput.trim()) return;
    if (!trackCompetitors.includes(competitorInput.trim())) {
      setTrackCompetitors(prev => [...prev, competitorInput.trim()]);
    }
    setCompetitorInput('');
  };

  return (
    <PageContainerFluid className="space-y-6 max-w-6xl mx-auto py-8">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <Radio className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Listening Engine</h1>
            <p className="text-muted-foreground text-xs font-medium">Track public mentions, hashtags, and competitor actions to protect your brand reputation.</p>
          </div>
        </div>

        <Button 
          onClick={handleSimulateMention}
          disabled={isSimulating}
          className="rounded-xl h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs tracking-wide active:scale-[0.97] transition-all gap-1.5 shadow-lg shadow-emerald-500/10 self-end sm:self-auto"
        >
          {isSimulating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Simulate Brand Mention
        </Button>
      </div>

      {isLoadingRule ? (
        <Card className="border border-border/30 rounded-3xl bg-card/40 backdrop-blur-md">
          <CardContent className="h-96 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              <span className="text-xs font-bold uppercase tracking-widest">Loading engine parameters...</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="alert-logs" className="w-full">
          <TabsList className="grid grid-cols-2 max-w-sm rounded-2xl bg-muted/40 p-1 border border-border/20 h-11">
            <TabsTrigger value="alert-logs" className="rounded-xl text-xs font-bold tracking-wider gap-1.5 data-[state=active]:bg-background/80">
              <Activity className="h-4 w-4" /> Alert Feed ({alerts.length})
            </TabsTrigger>
            <TabsTrigger value="rules-config" className="rounded-xl text-xs font-bold tracking-wider gap-1.5 data-[state=active]:bg-background/80">
              <Settings className="h-4 w-4" /> Listening Rules
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Alert Logs Feed */}
          <TabsContent value="alert-logs" className="pt-4 space-y-4">
            {isLoadingAlerts ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Loading alerts...</span>
              </div>
            ) : sortedAlerts.length === 0 ? (
              <Card className="border border-border/20 rounded-3xl bg-card/10 backdrop-blur-md p-10 text-center">
                <div className="flex flex-col items-center justify-center text-muted-foreground/60 gap-2">
                  <Radio className="h-8 w-8 opacity-45" />
                  <span className="text-xs font-bold uppercase tracking-widest">Alert feed empty</span>
                  <p className="text-[10px] text-muted-foreground/90 max-w-xs mt-1">Configure rule keywords in the Listening Rules tab and trigger a simulation to seed brand posts.</p>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortedAlerts.map((alert) => {
                  const Icon = platformIcons[alert.platform] || Globe;
                  return (
                    <Card key={alert.id} className="border border-border/30 bg-card/40 rounded-2xl relative overflow-hidden flex flex-col justify-between hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                      <CardHeader className="pb-2 border-b border-border/10 bg-muted/10 flex flex-row items-center justify-between space-y-0 py-3">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-extrabold text-xs text-foreground block">{alert.author}</span>
                        </div>
                        <Badge className="text-[9px] uppercase tracking-widest h-5 px-2 border" variant="outline">
                          matched '{alert.matchingKeyword}'
                        </Badge>
                      </CardHeader>
                      <CardContent className="pt-4 space-y-4 flex-1">
                        <p className="text-[11px] leading-relaxed text-foreground/90 font-medium">
                          {alert.content}
                        </p>
                        
                        <div className="flex items-center justify-between w-full pt-2">
                          <Badge className={cn("text-[9px] uppercase tracking-wider h-5 border", sentimentColors[alert.sentiment])} variant="outline">
                            {alert.sentiment}
                          </Badge>
                          <span className="text-[9px] text-muted-foreground font-semibold">
                            {new Date(alert.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Tab 2: Listening Rules Settings Form */}
          <TabsContent value="rules-config" className="pt-4">
            <form onSubmit={handleSaveRules}>
              <Card className="border border-border/30 rounded-3xl bg-card/40 backdrop-blur-md overflow-hidden relative">
                <CardHeader className="border-b border-border/20 pb-4">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Listening profile criteria</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  {/* Keywords builder */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase">Track Brand Keywords</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g., tuition, admissions, curriculum"
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddKeyword(); } }}
                        className="rounded-xl border-border/30 h-10 bg-background/50 text-xs"
                      />
                      <Button type="button" onClick={handleAddKeyword} className="rounded-xl h-10 px-4 bg-muted hover:bg-muted/80 text-xs font-bold active:scale-[0.97] transition-all">
                        <Plus className="h-4 w-4" /> Add
                      </Button>
                    </div>
                    {trackKeywords.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1.5">
                        {trackKeywords.map((kw) => (
                          <Badge key={kw} className="h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider text-[9px] gap-1">
                            {kw}
                            <button type="button" onClick={() => setTrackKeywords(prev => prev.filter(k => k !== kw))} className="hover:text-red-500">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Exclusions builder */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase">Exclude Alert Keywords</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g., spam, ads, careers"
                        value={excludeInput}
                        onChange={(e) => setExcludeInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddExclude(); } }}
                        className="rounded-xl border-border/30 h-10 bg-background/50 text-xs"
                      />
                      <Button type="button" onClick={handleAddExclude} className="rounded-xl h-10 px-4 bg-muted hover:bg-muted/80 text-xs font-bold active:scale-[0.97] transition-all">
                        <Plus className="h-4 w-4" /> Add
                      </Button>
                    </div>
                    {excludeKeywords.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1.5">
                        {excludeKeywords.map((ex) => (
                          <Badge key={ex} className="h-6 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 font-bold uppercase tracking-wider text-[9px] gap-1">
                            {ex}
                            <button type="button" onClick={() => setExcludeKeywords(prev => prev.filter(k => k !== ex))} className="hover:text-red-600">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Competitors builder */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase">Track Competitor Accounts</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g., Horizon Academy, Crestwood Prep"
                        value={competitorInput}
                        onChange={(e) => setCompetitorInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCompetitor(); } }}
                        className="rounded-xl border-border/30 h-10 bg-background/50 text-xs"
                      />
                      <Button type="button" onClick={handleAddCompetitor} className="rounded-xl h-10 px-4 bg-muted hover:bg-muted/80 text-xs font-bold active:scale-[0.97] transition-all">
                        <Plus className="h-4 w-4" /> Add
                      </Button>
                    </div>
                    {trackCompetitors.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1.5">
                        {trackCompetitors.map((comp) => (
                          <Badge key={comp} className="h-6 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-bold uppercase tracking-wider text-[9px] gap-1">
                            {comp}
                            <button type="button" onClick={() => setTrackCompetitors(prev => prev.filter(c => c !== comp))} className="hover:text-red-500">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Alert Threshold select */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="threshold-select" className="text-xs font-bold text-muted-foreground uppercase">Alert Trigger Threshold</Label>
                      <Select value={alertThreshold} onValueChange={(val: 'any' | 'negative' | 'viral_potential') => setAlertThreshold(val)}>
                        <SelectTrigger id="threshold-select" className="rounded-xl border-border/30 h-10 bg-background/50 text-xs">
                          <SelectValue placeholder="Select alert triggers" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl font-medium text-xs">
                          <SelectItem value="any">Trigger on Any Mention</SelectItem>
                          <SelectItem value="negative">Negative Sentiment Mentions Only</SelectItem>
                          <SelectItem value="viral_potential">Viral Potential / High reach Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Delivery settings checkboxes */}
                    <div className="space-y-2 flex flex-col justify-end">
                      <span className="text-xs font-bold text-muted-foreground uppercase mb-2">Delivery Channels</span>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer select-none">
                          <Checkbox checked={notifyInApp} onCheckedChange={(val) => setNotifyInApp(!!val)} />
                          <Bell className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> In-App Notification
                        </label>
                        <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer select-none">
                          <Checkbox checked={notifyFeed} onCheckedChange={(val) => setNotifyFeed(!!val)} />
                          <Activity className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> Alerts Feed
                        </label>
                        <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer select-none">
                          <Checkbox checked={notifyEmail} onCheckedChange={(val) => setNotifyEmail(!!val)} />
                          <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> Email Alert Simulator
                        </label>
                      </div>
                    </div>
                  </div>
                </CardContent>

                <div className="border-t border-border/10 p-4 bg-muted/10 flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={isSaving}
                    className="rounded-xl h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs tracking-wider uppercase active:scale-[0.97] transition-all gap-1.5 shadow-lg shadow-emerald-500/10"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Rules Guidelines
                  </Button>
                </div>
              </Card>
            </form>
          </TabsContent>
        </Tabs>
      )}
    </PageContainerFluid>
  );
}
