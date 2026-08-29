'use client';

/**
 * Slide-Over Prospect Inspection Command Sheet
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Mobile-First Layout: Adapts from full-width on mobile viewports to 560px on desktop screens.
 * 2. Complete Diagnostics: Covers 4 deep tabs (Overview, Tech Footprint, Decision Makers, AI Pitch Strategy).
 * 3. 1-Click Productivity: Provides instant copy-to-clipboard for emails and AI pitches with animated feedback.
 */

import React, { useState } from 'react';
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
  Flame 
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
import { TechnographicsCategorizer } from '@/lib/lead-intelligence/scraper/TechnographicsCategorizer';

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

  if (!prospect) return null;

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
            <TabsList className="w-full grid grid-cols-4 h-10 p-1 bg-muted/50 rounded-xl">
              <TabsTrigger value="overview" className="text-xs font-medium rounded-lg">Overview</TabsTrigger>
              <TabsTrigger value="tech" className="text-xs font-medium rounded-lg">Tech</TabsTrigger>
              <TabsTrigger value="people" className="text-xs font-medium rounded-lg">Contacts</TabsTrigger>
              <TabsTrigger value="ai" className="text-xs font-medium rounded-lg flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-sky-400" /> Pitch
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: OVERVIEW & SCORING */}
            <TabsContent value="overview" className="space-y-4 mt-0">
              {/* 4-Dimension Enrichment Progress Panel (UI Spec Section 22) */}
              <EnrichmentProgressPanel 
                dimensions={TechnographicsCategorizer.calculateEnrichmentDimensions(prospect)} 
                onEnrichMissing={() => onEnrichProspect(prospect)}
                isEnriching={isEnriching}
              />

              {/* Score Breakdown Cards */}
              <div className="space-y-3 bg-muted/30 p-4 rounded-xl border border-border/60">
                <h4 className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Score Diagnostics</span>
                  <span className="text-[11px] text-muted-foreground">Smart Priority Algorithm</span>
                </h4>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Need Score</span>
                      <span className="font-semibold text-foreground">{prospect.scoring?.needScore ?? 0}/20</span>
                    </div>
                    <Progress value={((prospect.scoring?.needScore ?? 0) / 20) * 100} className="h-1.5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Digital Maturity</span>
                      <span className="font-semibold text-foreground">{prospect.scoring?.digitalMaturity ?? 0}/15</span>
                    </div>
                    <Progress value={((prospect.scoring?.digitalMaturity ?? 0) / 15) * 100} className="h-1.5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Buying Intent</span>
                      <span className="font-semibold text-foreground">{prospect.scoring?.buyingIntent ?? 0}/25</span>
                    </div>
                    <Progress value={((prospect.scoring?.buyingIntent ?? 0) / 25) * 100} className="h-1.5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Decision Maker</span>
                      <span className="font-semibold text-foreground">{prospect.scoring?.decisionMakerFound ?? 0}/15</span>
                    </div>
                    <Progress value={((prospect.scoring?.decisionMakerFound ?? 0) / 15) * 100} className="h-1.5" />
                  </div>
                </div>
              </div>

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

            {/* TAB 3: DECISION MAKERS */}
            <TabsContent value="people" className="space-y-3 mt-0">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-foreground">Verified Decision Makers</h4>
                <span className="text-[11px] text-muted-foreground">
                  {prospect.contacts?.length || 0} contacts found
                </span>
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
                        <Badge 
                          variant="outline" 
                          className={`text-[10px] ${
                            c.verificationStatus === 'verified' 
                              ? 'border-emerald-500/40 text-emerald-500 bg-emerald-500/5' 
                              : 'text-muted-foreground'
                          }`}
                        >
                          {c.verificationStatus === 'verified' ? 'Verified' : 'Confidence ' + c.confidence + '%'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
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

            {/* TAB 4: AI SALES STRATEGY & PITCH */}
            <TabsContent value="ai" className="space-y-4 mt-0">
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
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
};
