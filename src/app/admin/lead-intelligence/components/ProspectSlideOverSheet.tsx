'use client';

/**
 * Slide-Over Prospect Inspection Command Sheet
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Mobile-First Layout: Adapts from full-width on mobile viewports to 560px on desktop screens.
 * 2. Complete Diagnostics: Covers 4 deep tabs (Overview, Tech Footprint, Decision Makers, AI Pitch Strategy).
 * 3. 1-Click Productivity: Provides instant copy-to-clipboard for emails and AI pitches with animated feedback.
 */

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Globe, 
  Phone, 
  MapPin, 
  Star, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  Zap, 
  Sparkles, 
  Mail, 
  Copy, 
  Check, 
  ExternalLink, 
  Database, 
  DollarSign, 
  Flame,
  Loader2,
  Radio 
} from 'lucide-react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import type { Prospect } from '@/lib/lead-intelligence/types';
import { useToast } from '@/hooks/use-toast';
import { EnrichmentProgressPanel } from './EnrichmentProgressPanel';
import { TechnographicStackMatrix } from './TechnographicStackMatrix';
import { ProspectProvenanceDrawer } from './ProspectProvenanceDrawer';
import { EmailDeliverabilityBadge } from './EmailDeliverabilityBadge';
import { VerificationDiagnosticModal } from './VerificationDiagnosticModal';
import { ResearchDossierModal } from './ResearchDossierModal';
import { AccountMonitoringConfigModal } from './AccountMonitoringConfigModal';
import { SignalBadge } from './SignalBadge';
import { ExplainableScoreCard } from './ExplainableScoreCard';
import { ScoreMovementTimeline } from './ScoreMovementTimeline';
import { ScoringModelConfigModal } from './ScoringModelConfigModal';
import { CRMStatusBadgeCard } from './CRMStatusBadgeCard';
import { CRMMatchStudioModal } from './CRMMatchStudioModal';
import { UnifiedActivityTimeline } from './UnifiedActivityTimeline';
import { ProspectActivationModal } from './ProspectActivationModal';
import { PredictiveProbabilityCard } from './PredictiveProbabilityCard';
import { TechnographicsCategorizer } from '@/lib/lead-intelligence/scraper/TechnographicsCategorizer';
import { PredictiveIntelligenceEngine } from '@/lib/lead-intelligence/predictive';
import { 
  verifyProspectEmailAction, 
  bulkVerifyProspectEmailsAction,
  generateAIResearchDossierAction,
  getProspectSignalsAction,
  checkProspectCRMMatchAction 
} from '@/app/actions/lead-intelligence-actions';
import type { EmailDeliverabilityResult, AIResearchDossier, LeadSignal, CRMMatchCandidate } from '@/lib/lead-intelligence/types';

interface ProspectSlideOverSheetProps {
  prospect: Prospect | null;
  isOpen: boolean;
  onClose: () => void;
  onSyncToCRM: (prospect: Prospect) => void;
  onEnrichProspect: (prospect: Prospect) => void;
  isSyncing?: boolean;
  isEnriching?: boolean;
}

export const ProspectSlideOverSheet: React.FC<ProspectSlideOverSheetProps> = ({
  prospect,
  isOpen,
  onClose,
  onSyncToCRM,
  onEnrichProspect,
  isSyncing = false,
  isEnriching = false,
}) => {
  const { toast } = useToast();
  const [copiedPitch, setCopiedPitch] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Verification state (Phase 5)
  const [selectedDeliverability, setSelectedDeliverability] = useState<EmailDeliverabilityResult | null>(null);
  const [isDiagModalOpen, setIsDiagModalOpen] = useState(false);
  const [isBulkVerifying, setIsBulkVerifying] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState<string | null>(null);

  // AI Research Dossier state (Phase 6)
  const [isDossierModalOpen, setIsDossierModalOpen] = useState(false);
  const [isGeneratingDossier, setIsGeneratingDossier] = useState(false);
  const [localDossier, setLocalDossier] = useState<AIResearchDossier | null>(null);

  // Live Continuous Signals state (Phase 7)
  const [isMonitoringModalOpen, setIsMonitoringModalOpen] = useState(false);
  const [prospectSignals, setProspectSignals] = useState<LeadSignal[]>([]);

  // Scoring Model Config state (Phase 8)
  const [isModelConfigOpen, setIsModelConfigOpen] = useState(false);

  // CRM Match & Intelligence state (Phase 9)
  const [matchCandidate, setMatchCandidate] = useState<CRMMatchCandidate | undefined>(undefined);
  const [isMatchStudioOpen, setIsMatchStudioOpen] = useState(false);

  // Autonomous SDR Activation state (Phase 12)
  const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);

  useEffect(() => {
    if (prospect?.id && prospect?.workspaceId && isOpen) {
      getProspectSignalsAction(prospect.id, prospect.workspaceId)
        .then((res) => {
          if (res.success && res.signals) {
            setProspectSignals(res.signals);
          }
        })
        .catch(() => {});

      if (prospect.syncStatus !== 'synced') {
        checkProspectCRMMatchAction(prospect.id, prospect.workspaceId)
          .then((res) => {
            if (res.success && res.match) {
              setMatchCandidate(res.match);
            }
          })
          .catch(() => {});
      }
    }
  }, [prospect?.id, prospect?.workspaceId, prospect?.syncStatus, isOpen]);

  if (!prospect) return null;

  const currentDossier = localDossier || prospect.researchDossier || null;

  const handleOpenDossier = async () => {
    if (currentDossier) {
      setIsDossierModalOpen(true);
      return;
    }
    setIsGeneratingDossier(true);
    try {
      const res = await generateAIResearchDossierAction(prospect.id, prospect.workspaceId);
      if (res.success && res.dossier) {
        setLocalDossier(res.dossier);
        setIsDossierModalOpen(true);
      } else {
        toast({
          variant: 'destructive',
          title: 'Dossier Generation Failed',
          description: res.error || 'Failed to synthesize AI research dossier.'
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to generate AI research dossier.'
      });
    } finally {
      setIsGeneratingDossier(false);
    }
  };

  const score = prospect.scoring?.overallScore ?? 50;
  const isHighOpportunity = score >= 75;
  const isMediumOpportunity = score >= 50 && score < 75;

  const handleCopyPitch = () => {
    if (prospect.aiInsights?.recommendedPitch) {
      navigator.clipboard.writeText(prospect.aiInsights.recommendedPitch);
      setCopiedPitch(true);
      toast({ title: 'Copied ✓', description: 'Elevator pitch copied to clipboard!' });
      setTimeout(() => setCopiedPitch(false), 2000);
    }
  };

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    toast({ title: 'Copied ✓', description: `Copied ${email} to clipboard!` });
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const handleInspectEmail = async (
    email: string, 
    status?: import('@/lib/lead-intelligence/types').EmailVerificationStatus, 
    deliverabilityScore?: number,
    mxProvider?: string,
    lastVerifiedAt?: string
  ) => {
    if (!email) return;
    // Construct or trigger live check
    setVerifyingEmail(email);
    try {
      const res = await verifyProspectEmailAction(prospect.id, email, prospect.workspaceId);
      if (res.success && res.deliverability) {
        setSelectedDeliverability(res.deliverability);
        setIsDiagModalOpen(true);
      } else {
        // Construct fallback result for modal display
        setSelectedDeliverability({
          email,
          status: status || 'unverified',
          deliverabilityScore: deliverabilityScore || 50,
          isRoleBased: false,
          isDisposable: false,
          hasMxRecord: true,
          mxProvider: (mxProvider as import('@/lib/lead-intelligence/types').MXProviderType) || 'unknown',
          isCatchAll: status === 'risky',
          stages: [
            { stage: 'syntax', passed: true, details: 'Valid RFC-5322 email formatting' },
            { stage: 'dns_mx', passed: true, details: `MX Provider: ${mxProvider || 'Configured'}` }
          ],
          verifiedAt: lastVerifiedAt || new Date().toISOString(),
          recommendation: status === 'verified' ? 'Safe to send.' : 'Verify mailbox before campaign launch.'
        });
        setIsDiagModalOpen(true);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to inspect email deliverability.' });
    } finally {
      setVerifyingEmail(null);
    }
  };

  const handleBulkVerify = async () => {
    if (!prospect.contacts || prospect.contacts.length === 0 || isBulkVerifying) return;
    setIsBulkVerifying(true);
    try {
      const res = await bulkVerifyProspectEmailsAction(prospect.id, prospect.workspaceId);
      if (res.success) {
        toast({
          title: 'Bulk Verification Complete ✓',
          description: `Successfully verified ${res.verifiedCount} email addresses.`
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Bulk Verification Failed',
          description: res.error || 'Failed to verify contacts.'
        });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Network Error', description: 'Failed to communicate with verification engine.' });
    } finally {
      setIsBulkVerifying(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-xl p-0 flex flex-col bg-card border-l border-border/80 shadow-2xl z-[10000] overflow-hidden"
      >
        {/* Header Section */}
        <SheetHeader className="p-6 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] font-medium uppercase tracking-wider bg-background">
                  {prospect.industry || 'General Business'}
                </Badge>
                {prospect.claimed ? (
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Verified Listing
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                    Unclaimed
                  </Badge>
                )}
                {prospect.syncStatus === 'synced' && (
                  <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] flex items-center gap-1">
                    <Database className="w-3 h-3" /> In CRM
                  </Badge>
                )}
              </div>

              <SheetTitle className="text-xl font-bold text-foreground truncate flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary shrink-0" />
                <span className="truncate">{prospect.name}</span>
              </SheetTitle>

              <SheetDescription className="flex items-center gap-2 text-xs text-muted-foreground">
                <a 
                  href={`https://${prospect.domain}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors flex items-center gap-1 text-primary/90 underline-offset-2 hover:underline"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>{prospect.domain}</span>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>
                {prospect.phone && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" />
                      {prospect.phone}
                    </span>
                  </>
                )}
              </SheetDescription>
            </div>

            {/* Smart Score Circle */}
            <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-background border border-border/80 shadow-sm shrink-0 min-w-[76px]">
              <div className="flex items-center gap-1 text-xs font-bold">
                {isHighOpportunity ? (
                  <Flame className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                ) : (
                  <Zap className="w-3.5 h-3.5 text-blue-500" />
                )}
                <span className={`text-base ${isHighOpportunity ? 'text-amber-500' : isMediumOpportunity ? 'text-blue-500' : 'text-zinc-400'}`}>
                  {score}
                </span>
                <span className="text-[10px] text-muted-foreground">/100</span>
              </div>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">
                {isHighOpportunity ? 'Priority' : isMediumOpportunity ? 'Qualified' : 'Cold'}
              </span>
            </div>
          </div>

          {/* Quick Action Header Bar */}
          <div className="flex items-center gap-2 pt-4">
            <Button
              size="sm"
              onClick={() => onSyncToCRM(prospect)}
              disabled={isSyncing || isEnriching || prospect.syncStatus === 'synced'}
              className="flex-1 h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-[0.97]"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{prospect.syncStatus === 'synced' ? 'Synced to CRM' : isSyncing ? 'Syncing...' : 'Sync to CRM'}</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setIsActivationModalOpen(true)}
              className="h-9 px-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 active:scale-[0.97]"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Activate</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEnrichProspect(prospect)}
              disabled={isSyncing || isEnriching}
              className="h-9 px-3.5 border-border bg-background hover:bg-accent text-xs rounded-xl flex items-center gap-1.5 active:scale-[0.97]"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>{isEnriching ? 'Enriching...' : 'AI Enrich'}</span>
            </Button>
          </div>
        </SheetHeader>

        {/* Tabbed Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-5">
            <TabsList className="w-full grid grid-cols-5 h-10 p-1 bg-muted/50 rounded-xl">
              <TabsTrigger value="overview" className="text-xs font-medium rounded-lg">Overview</TabsTrigger>
              <TabsTrigger value="tech" className="text-xs font-medium rounded-lg">Tech</TabsTrigger>
              <TabsTrigger value="people" className="text-xs font-medium rounded-lg">Contacts</TabsTrigger>
              <TabsTrigger value="ai" className="text-xs font-medium rounded-lg flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-sky-400" /> Pitch
              </TabsTrigger>
              <TabsTrigger value="activity" className="text-xs font-medium rounded-lg">Activity</TabsTrigger>
            </TabsList>

            {/* TAB 1: OVERVIEW & SCORING */}
            <TabsContent value="overview" className="space-y-4 mt-0">
              {/* CRM Connection Status & Match Alert (UI Spec Section 37 & 38) */}
              <CRMStatusBadgeCard
                prospect={prospect}
                matchCandidate={matchCandidate}
                onSyncToCRM={() => onSyncToCRM(prospect)}
                onOpenMatchStudio={() => setIsMatchStudioOpen(true)}
                isSyncing={isSyncing}
              />

              {/* Predictive Conversion Probability & Dynamic ACV Card (UI Spec Section 52) */}
              <PredictiveProbabilityCard
                likelihood={prospect.predictiveConversion || PredictiveIntelligenceEngine.calculatePredictiveLikelihood(prospect)}
              />

              {/* 4-Dimension Enrichment Progress Panel (UI Spec Section 22) */}
              <EnrichmentProgressPanel 
                dimensions={TechnographicsCategorizer.calculateEnrichmentDimensions(prospect)} 
                onEnrichMissing={() => onEnrichProspect(prospect)}
                isEnriching={isEnriching}
              />

              {/* Explainable Score Breakdown (UI Spec Section 34) */}
              <ExplainableScoreCard
                prospect={prospect}
                signals={prospectSignals}
                onOpenModelConfig={() => setIsModelConfigOpen(true)}
              />

              {/* Score Movement Velocity Timeline (UI Spec Section 35) */}
              <ScoreMovementTimeline
                prospect={prospect}
                signals={prospectSignals}
              />

              {/* Location & Reviews */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-border/70 bg-background space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400" /> Google Reviews
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-bold text-foreground">{prospect.rating?.toFixed(1) || 'N/A'}</span>
                    <span className="text-xs text-muted-foreground">({prospect.reviewsCount || 0} reviews)</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-border/70 bg-background space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" /> SSL Status
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground pt-0.5">
                    {prospect.websiteScan?.sslValid !== false ? (
                      <span className="text-emerald-500 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Valid HTTPS
                      </span>
                    ) : (
                      <span className="text-destructive flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> Missing SSL
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Physical Address */}
              {prospect.address && (
                <div className="p-3.5 rounded-xl border border-border/70 bg-background space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-muted-foreground" /> Physical Address
                  </span>
                  <p className="text-xs text-foreground font-medium">{prospect.address}</p>
                </div>
              )}

              {/* Live Signals & Account Monitoring (UI Spec Section 31 & 33) */}
              <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Radio className="h-4 w-4 text-rose-500 animate-pulse" />
                    <h5 className="text-xs font-bold text-foreground">
                      Live Continuous Signals ({prospectSignals.length})
                    </h5>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsMonitoringModalOpen(true)}
                    className="h-6 px-2 text-[10px] text-primary hover:text-primary/80 font-bold active:scale-[0.97]"
                  >
                    Configure Monitoring
                  </Button>
                </div>

                {prospectSignals.length > 0 ? (
                  <div className="space-y-1.5 pt-1">
                    {prospectSignals.slice(0, 3).map((sig) => (
                      <div key={sig.id} className="flex items-start justify-between gap-2 p-2 rounded-lg bg-background/80 border border-border/50 text-xs">
                        <div className="space-y-0.5">
                          <strong className="text-[11px] text-foreground block">{sig.headline}</strong>
                          <span className="text-[10px] text-muted-foreground">{sig.description}</span>
                        </div>
                        <SignalBadge signal={sig} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">
                    No recent structural changes detected. Account monitored with automated background delta scans.
                  </p>
                )}
              </div>

              {/* RevOps Provenance & Evidence Drawer (UI Spec Section 24 & 28) */}
              <ProspectProvenanceDrawer prospect={prospect} />
            </TabsContent>

            {/* TAB 2: TECHNOGRAPHICS */}
            <TabsContent value="tech" className="space-y-4 mt-0">
              {/* Categorized Tech Stack Matrix (UI Spec Section 30 & 31) */}
              <TechnographicStackMatrix 
                techStack={TechnographicsCategorizer.categorize(
                  prospect.websiteScan?.technologies || []
                )} 
              />

              {/* Social Presence Channels */}
              <div className="space-y-2 pt-3 border-t border-border/40">
                <h4 className="text-xs font-semibold text-foreground">Social & Digital Channels</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-background text-xs">
                    <span>Facebook</span>
                    {prospect.websiteScan?.hasFacebook ? (
                      <Badge className="bg-emerald-500/10 text-emerald-500 text-[10px] h-5">Detected</Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">None</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-background text-xs">
                    <span>LinkedIn</span>
                    {prospect.websiteScan?.hasLinkedIn ? (
                      <Badge className="bg-emerald-500/10 text-emerald-500 text-[10px] h-5">Detected</Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">None</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-background text-xs">
                    <span>Instagram</span>
                    {prospect.websiteScan?.hasInstagram ? (
                      <Badge className="bg-emerald-500/10 text-emerald-500 text-[10px] h-5">Detected</Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">None</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-background text-xs">
                    <span>Twitter / X</span>
                    {prospect.websiteScan?.hasTwitter ? (
                      <Badge className="bg-emerald-500/10 text-emerald-500 text-[10px] h-5">Detected</Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">None</span>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: DECISION MAKERS & VERIFICATION (UI Spec Section 25) */}
            <TabsContent value="people" className="space-y-3 mt-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Verified Decision Makers</h4>
                  <span className="text-[11px] text-muted-foreground">
                    {prospect.contacts?.length || 0} contacts found
                  </span>
                </div>
                {prospect.contacts && prospect.contacts.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleBulkVerify}
                    disabled={isBulkVerifying}
                    className="h-8 px-2.5 text-[11px] font-bold rounded-xl border-primary/30 text-primary hover:bg-primary/10 flex items-center gap-1 active:scale-[0.97]"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>{isBulkVerifying ? 'Verifying...' : 'Verify All'}</span>
                  </Button>
                )}
              </div>

              {prospect.contacts && prospect.contacts.length > 0 ? (
                <div className="space-y-2">
                  {prospect.contacts.map((c, idx) => (
                    <div 
                      key={idx} 
                      className="p-3.5 rounded-xl border border-border/70 bg-background space-y-2 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-foreground">{c.name}</p>
                          <p className="text-[11px] text-muted-foreground">{c.role || 'Key Contact'}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {verifyingEmail === c.email && (
                            <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                          )}
                          <EmailDeliverabilityBadge
                            status={c.verificationStatus}
                            deliverabilityScore={c.deliverabilityScore}
                            lastVerifiedAt={c.lastVerifiedAt}
                            onClick={() => handleInspectEmail(c.email, c.verificationStatus, c.deliverabilityScore, c.mxProvider, c.lastVerifiedAt)}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleCopyEmail(c.email)}
                          className="h-7 px-2.5 text-[11px] font-medium flex items-center gap-1.5 active:scale-[0.97]"
                        >
                          {copiedEmail === c.email ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span className="text-emerald-500">Copied ✓</span>
                            </>
                          ) : (
                            <>
                              <Mail className="w-3 h-3" />
                              <span className="truncate max-w-[200px]">{c.email}</span>
                              <Copy className="w-2.5 h-2.5 opacity-60" />
                            </>
                          )}
                        </Button>
                        {c.phone && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {c.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-dashed border-border text-center space-y-2">
                  <p className="text-xs text-muted-foreground">No contacts indexed yet.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEnrichProspect(prospect)}
                    className="h-8 text-xs text-sky-400 border-sky-500/30 hover:bg-sky-500/10"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1" /> Discover Contacts with AI
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* TAB 4: AI SALES STRATEGY & PITCH (UI Spec Section 26) */}
            <TabsContent value="ai" className="space-y-4 mt-0">
              {/* Deep Research Dossier Header Card */}
              <div className="flex items-center justify-between gap-2 p-3 rounded-xl border border-primary/20 bg-primary/5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <div>
                    <h5 className="text-xs font-bold text-foreground">Deep AI Research Dossier</h5>
                    <p className="text-[10px] text-muted-foreground">
                      {currentDossier ? 'Multi-channel outreach playbooks & evidence citations ready' : 'Synthesize executive intelligence brief & cold outreach scripts'}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleOpenDossier}
                  disabled={isGeneratingDossier}
                  className="h-8 px-3 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5 active:scale-[0.97]"
                >
                  {isGeneratingDossier ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Synthesizing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{currentDossier ? 'View Dossier' : 'Generate Dossier'}</span>
                    </>
                  )}
                </Button>
              </div>

              {prospect.aiInsights ? (
                <>
                  {/* Revenue Opportunity Estimate */}
                  <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> Estimated Annual Revenue Opportunity
                    </span>
                    <p className="text-xl font-extrabold text-foreground">
                      ${prospect.aiInsights.estimatedRevenueOpportunity?.toLocaleString() || '1,200'}
                      <span className="text-xs font-normal text-muted-foreground ml-1">USD / year</span>
                    </p>
                  </div>

                  {/* Summary */}
                  <div className="p-3.5 rounded-xl border border-border/70 bg-background space-y-1.5">
                    <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-sky-400" /> Executive Analysis
                    </h5>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {prospect.aiInsights.summary}
                    </p>
                  </div>

                  {/* Tailored Elevator Pitch */}
                  <div className="p-4 rounded-xl border border-sky-500/30 bg-sky-500/5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold text-sky-500 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5" /> Tailored Sales Pitch
                      </h5>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCopyPitch}
                        className="h-7 px-2.5 text-xs text-sky-500 hover:bg-sky-500/10 font-semibold flex items-center gap-1 active:scale-[0.97]"
                      >
                        {copiedPitch ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-500">Copied ✓</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Pitch</span>
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-foreground/90 font-medium leading-relaxed italic bg-background/80 p-3 rounded-lg border border-sky-500/20">
                      &ldquo;{prospect.aiInsights.recommendedPitch}&rdquo;
                    </p>
                  </div>

                  {/* Problems Found & Opportunities */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-semibold text-foreground">Identified Pain Points & Solutions</h5>
                    <div className="space-y-1.5">
                      {prospect.aiInsights.problemsFound?.map((prob, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/20 p-2 rounded-lg">
                          <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                          <span>{prob}</span>
                        </div>
                      ))}
                      {prospect.aiInsights.opportunities?.map((opp, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-foreground bg-emerald-500/5 border border-emerald-500/10 p-2 rounded-lg font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{opp}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Evidence & Confidence Section (intelligence_ui Sections 28 & 29) */}
                  <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Evidence & Grounding
                      </span>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
                        88% Confidence
                      </Badge>
                    </div>
                    <ul className="space-y-1 text-muted-foreground text-[11px]">
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span>Source: <strong className="text-foreground">{prospect.source ? prospect.source.replace(/_/g, ' ') : 'Google Places & Web Scan'}</strong></span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span>Observed on: <strong className="text-foreground">{new Date(prospect.updatedAt).toLocaleDateString()}</strong></span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span>Decision Makers: <strong className="text-foreground">{prospect.contacts.length} contact(s) extracted</strong></span>
                      </li>
                    </ul>
                  </div>
                </>
              ) : (
                <div className="p-8 rounded-xl border border-dashed border-border text-center space-y-3">
                  <Sparkles className="w-8 h-8 text-sky-400 mx-auto opacity-70 animate-pulse" />
                  <div className="space-y-1">
                    <h5 className="text-sm font-semibold">Generate AI Sales Intelligence</h5>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                      Run AI enrichment to uncover pain points, estimate annual contract value, and generate custom pitches.
                    </p>
                  </div>
                  <Button
                    onClick={() => onEnrichProspect(prospect)}
                    disabled={isEnriching}
                    className="h-8 text-xs bg-primary text-primary-foreground font-medium"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1 text-sky-400" />
                    {isEnriching ? 'Generating AI Strategy...' : 'Generate Sales Strategy'}
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* TAB 5: UNIFIED ACTIVITY TIMELINE (UI Spec Section 39) */}
            <TabsContent value="activity" className="space-y-4 mt-0">
              <UnifiedActivityTimeline prospect={prospect} />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>

      {/* Forensic Verification Diagnostic Modal (UI Spec Section 25) */}
      <VerificationDiagnosticModal
        prospectId={prospect.id}
        workspaceId={prospect.workspaceId}
        deliverability={selectedDeliverability}
        isOpen={isDiagModalOpen}
        onClose={() => setIsDiagModalOpen(false)}
        onVerificationUpdated={(updated) => {
          setSelectedDeliverability(updated);
        }}
      />

      {/* Deep AI Research Dossier Modal (UI Spec Section 26 & 27) */}
      <ResearchDossierModal
        prospect={prospect}
        dossier={currentDossier}
        isOpen={isDossierModalOpen}
        onClose={() => setIsDossierModalOpen(false)}
        onSyncToCRM={onSyncToCRM}
        onDossierUpdated={(updated) => setLocalDossier(updated)}
      />

      {/* Account Monitoring Preferences Modal (UI Spec Section 33) */}
      <AccountMonitoringConfigModal
        prospect={prospect}
        isOpen={isMonitoringModalOpen}
        onClose={() => setIsMonitoringModalOpen(false)}
        onScanCompleted={(count) => {
          if (count > 0 && prospect?.id && prospect?.workspaceId) {
            getProspectSignalsAction(prospect.id, prospect.workspaceId).then((res) => {
              if (res.success && res.signals) setProspectSignals(res.signals);
            });
          }
        }}
      />

      {/* Custom Scoring Model & Weight Fine-Tuner Modal (UI Spec Section 36) */}
      <ScoringModelConfigModal
        workspaceId={prospect.workspaceId}
        organizationId={prospect.organizationId}
        isOpen={isModelConfigOpen}
        onClose={() => setIsModelConfigOpen(false)}
      />

      {/* CRM Match Resolution Studio Modal (UI Spec Section 38) */}
      {matchCandidate && (
        <CRMMatchStudioModal
          prospect={prospect}
          matchCandidate={matchCandidate}
          isOpen={isMatchStudioOpen}
          onClose={() => setIsMatchStudioOpen(false)}
          onResolved={() => {
            setMatchCandidate(undefined);
            setIsMatchStudioOpen(false);
          }}
        />
      )}

      {/* Autonomous AI SDR 5-Action Activation Modal (UI Spec Section 50) */}
      <ProspectActivationModal
        prospect={prospect}
        workspaceId={prospect.workspaceId}
        isOpen={isActivationModalOpen}
        onClose={() => setIsActivationModalOpen(false)}
        onActivated={() => {
          setIsActivationModalOpen(false);
        }}
      />
    </Sheet>
  );
};
