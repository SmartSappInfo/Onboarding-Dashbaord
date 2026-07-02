'use client';

import * as React from 'react';
import { query, collection, where, limit } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  Globe, 
  Activity, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2,
  RefreshCw
} from 'lucide-react';
import type { Prospect } from '@/lib/lead-intelligence/types';
import { enrichProspectAction } from '@/app/actions/lead-intelligence-actions';
import { useToast } from '@/hooks/use-toast';

interface EntityLeadIntelTabProps {
  entityId: string;
}

export default function EntityLeadIntelTab({ entityId }: EntityLeadIntelTabProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isEnriching, setIsEnriching] = React.useState(false);

  // Query prospect that corresponds to this CRM entity
  const prospectQuery = useMemoFirebase(() => {
    if (!firestore || !entityId) return null;
    return query(
      collection(firestore, 'prospects'),
      where('syncedEntityId', '==', entityId),
      limit(1)
    );
  }, [firestore, entityId]);

  const { data: prospects, isLoading } = useCollection<Prospect>(prospectQuery);
  const prospect = prospects?.[0] || null;

  const handleReEnrich = async () => {
    if (!prospect) return;
    setIsEnriching(true);
    try {
      const res = await enrichProspectAction(prospect);
      if (res.success && res.prospect) {
        toast({ title: 'Lead Re-Enriched', description: 'Updated technical audit and AI pitch metrics.' });
      } else {
        toast({ variant: 'destructive', title: 'Enrichment Failed', description: res.error });
      }
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Enrichment Failed', description: 'Failed to enrich prospect data.' });
    } finally {
      setIsEnriching(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!prospect) {
    return (
      <Card className="border border-border/50 bg-card/20 p-6 text-center space-y-4">
        <div className="flex justify-center">
          <Sparkles className="h-10 w-10 text-muted-foreground opacity-35" />
        </div>
        <h3 className="font-bold text-sm">No Lead Intelligence Available</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          This contact was created manually or has not been analyzed by the Lead Intelligence engine yet. Scan this company domain in the Lead Intelligence workspace to enrich.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 text-xs text-left">
      {/* Lead Score & Re-Enrich block */}
      <div className="flex justify-between items-center border-b border-border/30 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-blue-400">Digital Audit Profile</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Enriched via SmartSapp AI Opportunity Stethoscope</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleReEnrich} 
            disabled={isEnriching}
            variant="outline" 
            className="h-8 text-[10px] font-bold border-border/40 hover:bg-muted/10 active:scale-[0.97] rounded-lg"
          >
            {isEnriching ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <RefreshCw className="h-3 w-3 mr-1.5" />}
            Refresh Intelligence
          </Button>
          <div className="text-right pl-3 border-l border-border/30">
            <div className="text-lg font-black text-blue-400">{prospect.scoring.overallScore}%</div>
            <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-bold">Smart Score</div>
          </div>
        </div>
      </div>

      {/* Main Analysis Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Technographics */}
        <Card className="bg-card/35 border-border/40">
          <CardHeader className="p-4"><CardTitle className="text-[10px] uppercase font-bold text-blue-400">Technographics</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex flex-wrap gap-1.5">
              {prospect.websiteScan?.technologies && prospect.websiteScan.technologies.length > 0 ? (
                prospect.websiteScan.technologies.map((t, i) => (
                  <Badge key={i} variant="outline" className="bg-muted/10 text-foreground text-[9px] font-bold py-0.5 px-2">{t}</Badge>
                ))
              ) : (
                <span className="text-muted-foreground">No technology footprint available.</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Website Performance */}
        <Card className="bg-card/35 border-border/40">
          <CardHeader className="p-4"><CardTitle className="text-[10px] uppercase font-bold text-sky-400">Site Performance</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            <div className="flex justify-between items-center border-b border-border/20 pb-2">
              <span>SSL Status</span>
              <Badge className={prospect.websiteScan?.sslValid ? 'bg-blue-500/15 text-blue-400 border-none' : 'bg-rose-500/15 text-rose-400 border-none'}>
                {prospect.websiteScan?.sslValid ? 'Secure' : 'Insecure'}
              </Badge>
            </div>
            <div className="flex justify-between items-center border-b border-border/20 pb-2">
              <span>Load Time</span>
              <span className="font-bold">{prospect.websiteScan?.loadTimeMs ? `${prospect.websiteScan.loadTimeMs}ms` : 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Social Handles</span>
              <span className="text-muted-foreground">
                {[
                  prospect.websiteScan?.hasFacebook && 'FB',
                  prospect.websiteScan?.hasInstagram && 'IG',
                  prospect.websiteScan?.hasLinkedIn && 'LN'
                ].filter(Boolean).join(', ') || 'None'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Score metrics */}
        <Card className="bg-card/35 border-border/40">
          <CardHeader className="p-4"><CardTitle className="text-[10px] uppercase font-bold text-blue-400">Scoring breakdown</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 space-y-1.5">
            <div className="flex justify-between"><span>Need Score</span><span className="font-bold">{prospect.scoring.needScore}/25</span></div>
            <div className="flex justify-between"><span>Digital Maturity</span><span className="font-bold">{prospect.scoring.digitalMaturity}/15</span></div>
            <div className="flex justify-between"><span>Buying Intent</span><span className="font-bold">{prospect.scoring.buyingIntent}/20</span></div>
            <div className="flex justify-between"><span>Budget Probability</span><span className="font-bold">{prospect.scoring.budgetProbability}/15</span></div>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights & Pitch */}
      {prospect.aiInsights && (
        <div className="space-y-4">
          <div className="p-4 bg-muted/10 border border-border/40 rounded-xl space-y-2">
            <h4 className="font-bold text-blue-400 text-[10px] uppercase tracking-wider">AI Audit Summary</h4>
            <p className="leading-relaxed text-muted-foreground">{prospect.aiInsights.summary}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-xl space-y-2">
              <h4 className="font-bold text-rose-400 text-[10px] uppercase tracking-wider">Detected Weaknesses</h4>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                {prospect.aiInsights.problemsFound.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl space-y-2">
              <h4 className="font-bold text-blue-400 text-[10px] uppercase tracking-wider">Transformation Solutions</h4>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                {prospect.aiInsights.opportunities.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
          </div>

          {/* Sales pitch & objection handler */}
          <div className="p-4 bg-blue-500/5 border border-blue-500/15 rounded-xl space-y-3">
            <div className="flex justify-between items-center border-b border-border/20 pb-2">
              <h4 className="font-bold text-blue-400 text-[10px] uppercase tracking-wider">Elevator Sales Pitch</h4>
              <span className="font-bold text-sky-400">Estimated Revenue Opportunity: ${prospect.aiInsights.estimatedRevenueOpportunity}/yr</span>
            </div>
            <p className="italic text-muted-foreground leading-relaxed">"{prospect.aiInsights.recommendedPitch}"</p>

            <div className="border-t border-border/20 pt-3 mt-3">
              <h4 className="font-bold text-rose-400 text-[10px] uppercase tracking-wider mb-2">Objection Helper</h4>
              <div className="space-y-3">
                {prospect.aiInsights.objectionsAnswered.map((obj, i) => (
                  <div key={i} className="p-2.5 bg-background/50 border border-border/30 rounded-lg">
                    <div className="font-bold text-foreground">Objection: "{obj.objection}"</div>
                    <div className="text-muted-foreground mt-1">Smart Counter: {obj.counter}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
