'use client';

/**
 * AI Research Dossier Modal (Lead Intelligence 2.0 - Phase 6)
 * UI Spec Section 26 & 27: "Phase 6 UX — AI Research Dossier & Multi-Channel Outreach"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. 4-Score Suite: ICP Fit, Buying Intent, Opportunity Priority, Digital Maturity.
 * 2. Commercial Packaging: Recommended tier, estimated ACV, and urgency.
 * 3. Multi-Channel Outreach: Email, WhatsApp, and Phone Cold Call playbooks.
 * 4. Grounded Evidence: Zero-hallucination citations linking back to observed scan results.
 * 5. Strict Zero-`any` typing.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Sparkles, 
  Target, 
  Flame, 
  Award, 
  TrendingUp, 
  DollarSign, 
  Mail, 
  Phone, 
  MessageSquare, 
  Copy, 
  Check, 
  RefreshCw, 
  ExternalLink,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';
import type { AIResearchDossier, Prospect } from '@/lib/lead-intelligence/types';
import { generateAIResearchDossierAction } from '@/app/actions/lead-intelligence-actions';
import { EvidenceGroundingPanel } from './EvidenceGroundingPanel';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ResearchDossierModalProps {
  prospect: Prospect | null;
  dossier: AIResearchDossier | null;
  isOpen: boolean;
  onClose: () => void;
  onSyncToCRM?: (prospect: Prospect) => void;
  onDossierUpdated?: (dossier: AIResearchDossier) => void;
}

export const ResearchDossierModal: React.FC<ResearchDossierModalProps> = ({
  prospect,
  dossier,
  isOpen,
  onClose,
  onSyncToCRM,
  onDossierUpdated
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'email' | 'whatsapp' | 'phone' | 'evidence'>('overview');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  if (!prospect || !dossier) return null;

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(label);
    toast({ title: 'Copied ✓', description: `${label} copied to clipboard!` });
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleRegenerate = async () => {
    if (!prospect.id || !prospect.workspaceId || isRegenerating) return;
    setIsRegenerating(true);
    try {
      const res = await generateAIResearchDossierAction(prospect.id, prospect.workspaceId);
      if (res.success && res.dossier) {
        toast({
          title: 'Dossier Re-Synthesized ✓',
          description: 'AI Research Dossier refreshed with latest data points.'
        });
        if (onDossierUpdated) {
          onDossierUpdated(res.dossier);
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Generation Failed',
          description: res.error || 'Failed to re-synthesize AI research dossier.'
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Network Error',
        description: 'Failed to communicate with research engine.'
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const emailPlaybook = dossier.outreachPlaybook.find(p => p.channel === 'email');
  const whatsappPlaybook = dossier.outreachPlaybook.find(p => p.channel === 'whatsapp');
  const phonePlaybook = dossier.outreachPlaybook.find(p => p.channel === 'phone_script');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl w-[96vw] p-0 bg-card border-border/80 shadow-2xl rounded-2xl overflow-hidden z-[10001] flex flex-col max-h-[90vh]">
        {/* Header */}
        <DialogHeader className="p-6 border-b bg-muted/20 shrink-0 space-y-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                <DialogTitle className="text-base font-extrabold text-foreground tracking-tight">
                  {dossier.prospectName}
                </DialogTitle>
                <a
                  href={`https://${dossier.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 ml-1"
                >
                  <span>{dossier.domain}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <DialogDescription className="text-xs text-muted-foreground pt-0.5">
                Executive AI Intelligence Brief & Outreach Playbook • Researched {new Date(dossier.researchedAt).toLocaleDateString()}
              </DialogDescription>
            </div>

            {/* 4 Score Badges (UI Spec Section 26) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30 text-[10px] font-bold font-mono px-2 py-0.5 flex items-center gap-1">
                <Target className="h-3 w-3" />
                <span>ICP {dossier.icpFitScore}%</span>
              </Badge>

              <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold font-mono px-2 py-0.5 flex items-center gap-1">
                <Flame className="h-3 w-3" />
                <span>Intent {dossier.intentScore}%</span>
              </Badge>

              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold font-mono px-2 py-0.5 flex items-center gap-1">
                <Award className="h-3 w-3" />
                <span>Priority {dossier.priorityScore}%</span>
              </Badge>

              <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 text-[10px] font-bold font-mono px-2 py-0.5 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                <span>Maturity {dossier.digitalMaturityScore}%</span>
              </Badge>
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as typeof activeTab)} className="w-full">
            <TabsList className="grid grid-cols-5 h-9 bg-muted/60 p-1 rounded-xl">
              <TabsTrigger value="overview" className="text-xs font-semibold rounded-lg">Overview</TabsTrigger>
              <TabsTrigger value="email" className="text-xs font-semibold rounded-lg flex items-center gap-1">
                <Mail className="h-3 w-3" /> Email
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="text-xs font-semibold rounded-lg flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> WhatsApp
              </TabsTrigger>
              <TabsTrigger value="phone" className="text-xs font-semibold rounded-lg flex items-center gap-1">
                <Phone className="h-3 w-3" /> Call Script
              </TabsTrigger>
              <TabsTrigger value="evidence" className="text-xs font-semibold rounded-lg flex items-center gap-1">
                <Zap className="h-3 w-3" /> Evidence ({dossier.evidenceGrounding.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </DialogHeader>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh]">
          {/* TAB 1: OVERVIEW & COMMERCIAL PACKAGING */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Executive Summary Block */}
              <div className="p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Why This Prospect Matters
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyText(dossier.executiveSummary, 'Executive Summary')}
                    className="h-6 px-2 text-[10px] text-sky-500 hover:text-sky-400 font-semibold"
                  >
                    {copiedSection === 'Executive Summary' ? 'Copied ✓' : 'Copy'}
                  </Button>
                </div>
                <p className="text-xs text-foreground/90 font-medium leading-relaxed">
                  {dossier.executiveSummary}
                </p>
              </div>

              {/* Commercial Packaging Card */}
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> Recommended Commercial Tier & ACV
                    </span>
                    <h4 className="text-sm font-extrabold text-foreground pt-0.5">
                      {dossier.commercialPackaging.recommendedTier}
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono block">
                      ${dossier.commercialPackaging.estimatedAnnualValue.toLocaleString()} USD
                    </span>
                    <Badge 
                      className={cn(
                        "text-[9px] font-bold uppercase tracking-wider px-2 py-0.2",
                        dossier.commercialPackaging.urgency === 'critical' && "bg-rose-500/20 text-rose-600 border-rose-500/40",
                        dossier.commercialPackaging.urgency === 'high' && "bg-amber-500/20 text-amber-600 border-amber-500/40",
                        dossier.commercialPackaging.urgency === 'medium' && "bg-emerald-500/20 text-emerald-600 border-emerald-500/40"
                      )}
                    >
                      {dossier.commercialPackaging.urgency} Urgency
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1 pt-1 border-t border-emerald-500/20 text-xs">
                  <span className="font-semibold text-foreground text-[11px] block">Target Product Modules:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                    {dossier.commercialPackaging.targetProductModules.map((module, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-xs text-foreground/85 bg-background/60 p-2 rounded-lg border border-border/50">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span className="truncate">{module}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground italic pt-1">
                  Rationale: {dossier.commercialPackaging.pricingRationale}
                </p>
              </div>

              {/* Root-Cause Pain Points */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-foreground block">
                  Identified Digital Pain Points & SmartSapp Solutions
                </span>
                <div className="space-y-2">
                  {dossier.painPoints.map((item, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl border bg-card space-y-2 text-xs">
                      <div className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-foreground block">{item.problem}</strong>
                          <p className="text-[11px] text-muted-foreground pt-0.5 leading-relaxed">{item.businessImpact}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 bg-emerald-500/5 p-2.5 rounded-lg border border-emerald-500/20">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-emerald-700 dark:text-emerald-300 block">SmartSapp Solution:</strong>
                          <p className="text-[11px] text-foreground/90 pt-0.5 leading-relaxed">{item.smartSappSolution}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EMAIL PLAYBOOK */}
          {activeTab === 'email' && emailPlaybook && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-foreground">{emailPlaybook.headline}</h4>
                  <span className="text-[11px] text-muted-foreground">
                    Target Contact: <strong className="text-foreground">{emailPlaybook.targetContactName || 'Decision Maker'}</strong>
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleCopyText(emailPlaybook.scriptOrMessage, 'Email Script')}
                  className="h-7 px-3 text-xs font-bold bg-primary text-primary-foreground flex items-center gap-1 active:scale-[0.97]"
                >
                  {copiedSection === 'Email Script' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedSection === 'Email Script' ? 'Copied ✓' : 'Copy Email'}</span>
                </Button>
              </div>

              <div className="p-4 rounded-xl border bg-muted/20 font-mono text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {emailPlaybook.scriptOrMessage}
              </div>

              <div className="p-3.5 rounded-xl border bg-card space-y-1.5 text-xs">
                <strong className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider block">
                  Key Talking Points
                </strong>
                <ul className="space-y-1 text-[11px] text-muted-foreground">
                  {emailPlaybook.keyTalkingPoints.map((pt, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-sky-400 shrink-0" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: WHATSAPP PLAYBOOK */}
          {activeTab === 'whatsapp' && whatsappPlaybook && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-foreground">{whatsappPlaybook.headline}</h4>
                  <span className="text-[11px] text-muted-foreground">
                    Target Contact: <strong className="text-foreground">{whatsappPlaybook.targetContactName || 'Decision Maker'}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyText(whatsappPlaybook.scriptOrMessage, 'WhatsApp Script')}
                    className="h-7 px-3 text-xs font-semibold flex items-center gap-1 active:scale-[0.97]"
                  >
                    {copiedSection === 'WhatsApp Script' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedSection === 'WhatsApp Script' ? 'Copied' : 'Copy'}</span>
                  </Button>

                  {prospect.phone && (
                    <Button
                      size="sm"
                      asChild
                      className="h-7 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 active:scale-[0.97]"
                    >
                      <a 
                        href={`https://wa.me/${prospect.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(whatsappPlaybook.scriptOrMessage)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageSquare className="h-3 w-3" />
                        <span>Launch WhatsApp</span>
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 font-sans text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {whatsappPlaybook.scriptOrMessage}
              </div>

              <div className="p-3.5 rounded-xl border bg-card space-y-1.5 text-xs">
                <strong className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider block">
                  Messaging Strategy Notes
                </strong>
                <ul className="space-y-1 text-[11px] text-muted-foreground">
                  {whatsappPlaybook.keyTalkingPoints.map((pt, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* TAB 4: PHONE COLD CALL SCRIPT */}
          {activeTab === 'phone' && phonePlaybook && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-foreground">{phonePlaybook.headline}</h4>
                  <span className="text-[11px] text-muted-foreground">
                    Target Contact: <strong className="text-foreground">{phonePlaybook.targetContactName || 'Decision Maker'}</strong>
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleCopyText(phonePlaybook.scriptOrMessage, 'Call Script')}
                  className="h-7 px-3 text-xs font-bold bg-primary text-primary-foreground flex items-center gap-1 active:scale-[0.97]"
                >
                  {copiedSection === 'Call Script' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedSection === 'Call Script' ? 'Copied ✓' : 'Copy Script'}</span>
                </Button>
              </div>

              <div className="p-4 rounded-xl border bg-muted/20 text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {phonePlaybook.scriptOrMessage}
              </div>

              <div className="p-3.5 rounded-xl border bg-card space-y-1.5 text-xs">
                <strong className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider block">
                  Call Execution Flow
                </strong>
                <ul className="space-y-1 text-[11px] text-muted-foreground">
                  {phonePlaybook.keyTalkingPoints.map((pt, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* TAB 5: VERIFIABLE EVIDENCE GROUNDING */}
          {activeTab === 'evidence' && (
            <EvidenceGroundingPanel evidence={dossier.evidenceGrounding} />
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-4 bg-muted/20 border-t flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="h-9 px-3 text-xs font-bold rounded-xl flex items-center gap-1.5 active:scale-[0.97]"
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Re-Generate Dossier</span>
                </>
              )}
            </Button>

            {onSyncToCRM && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => onSyncToCRM(prospect)}
                className="h-9 px-3 text-xs font-bold rounded-xl flex items-center gap-1.5 active:scale-[0.97]"
              >
                <Award className="h-3.5 w-3.5 text-primary" />
                <span>Sync to CRM</span>
              </Button>
            )}
          </div>

          <Button
            type="button"
            onClick={onClose}
            className="h-9 px-4 text-xs font-semibold rounded-xl"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
