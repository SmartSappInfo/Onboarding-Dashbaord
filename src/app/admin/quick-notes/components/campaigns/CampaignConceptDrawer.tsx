'use client';

import * as React from 'react';
import {
  X,
  Send,
  Sparkles,
  Rocket,
  CheckCircle2,
  ShieldAlert,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  Smartphone,
  Mail,
  PhoneCall,
  Loader2,
  FileText,
  Target,
  Layers,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  type CampaignConcept,
  type CampaignChannel,
} from '@/lib/quick-notes-types';
import {
  getCampaignChannelMeta,
  getCampaignConceptStatusMeta,
} from '@/lib/quick-notes-domain';
import { useToast } from '@/hooks/use-toast';
import { deployConceptToCampaignStudioAction } from '@/lib/quick-notes-campaign-actions';

interface CampaignConceptDrawerProps {
  concept: CampaignConcept | null;
  isOpen: boolean;
  onClose: () => void;
  onConceptUpdated?: () => void;
}

export function CampaignConceptDrawer({
  concept,
  isOpen,
  onClose,
  onConceptUpdated,
}: CampaignConceptDrawerProps) {
  const { toast } = useToast();
  const [isDeploying, setIsDeploying] = React.useState(false);
  const [copiedSection, setCopiedSection] = React.useState<string | null>(null);

  if (!concept) return null;

  const statusMeta = getCampaignConceptStatusMeta(concept.status);

  const handleCopy = (text: string, sectionKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionKey);
    toast({ title: 'Copied to clipboard' });
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    try {
      const res = await deployConceptToCampaignStudioAction(
        concept.workspaceId,
        concept.id
      );
      if (res.success) {
        toast({
          title: 'Concept Deployed to Campaign Studio',
          description: `Campaign concept "${concept.title}" is now active in Messaging Wizard.`,
          actionConfig: {
            path: '/admin/messaging/campaigns',
            label: 'Open Campaigns',
          },
        });
        onConceptUpdated?.();
      } else {
        toast({
          title: 'Deployment Failed',
          description: res.error || 'Failed to deploy concept.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Unexpected error deploying concept.',
        variant: 'destructive',
      });
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl p-0 flex flex-col h-full bg-background border-l border-border"
      >
        {/* Drawer Header */}
        <SheetHeader className="p-5 border-b border-border/70 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${statusMeta.badgeClass}`}
              >
                {statusMeta.label}
              </span>

              {concept.relevanceScore !== undefined && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                  <Sparkles className="h-3 w-3" />
                  {concept.relevanceScore}% Fit
                </span>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 rounded-lg"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <SheetTitle className="text-base sm:text-lg font-bold text-foreground text-left line-clamp-2">
            {concept.title}
          </SheetTitle>
        </SheetHeader>

        {/* Drawer Body Tabs */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <Tabs defaultValue="brief" className="w-full">
            <TabsList className="grid grid-cols-3 w-full rounded-xl bg-muted/60 p-1 mb-5">
              <TabsTrigger value="brief" className="rounded-lg text-xs font-semibold">
                Strategic Brief
              </TabsTrigger>
              <TabsTrigger value="objections" className="rounded-lg text-xs font-semibold">
                Objection Vault ({concept.objectionRebuttals.length})
              </TabsTrigger>
              <TabsTrigger value="channels" className="rounded-lg text-xs font-semibold">
                Channels & Proof
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: STRATEGIC BRIEF */}
            <TabsContent value="brief" className="space-y-4">
              {/* Target Persona Card */}
              <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5 text-primary" /> Target Audience Persona
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {concept.targetAudience}
                  </Badge>
                </div>
                <p className="text-xs text-foreground/90 leading-relaxed">
                  {concept.targetPersonaSummary}
                </p>
              </div>

              {/* Core Value Proposition */}
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-1.5">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 block">
                  💎 Core Value Proposition
                </span>
                <p className="text-xs text-foreground font-semibold leading-relaxed">
                  "{concept.valueProposition}"
                </p>
              </div>

              {/* Opening Message Hook */}
              <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Opening Hook / Headline
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(concept.coreMessageHook, 'hook')}
                    className="h-7 text-[11px] px-2"
                  >
                    {copiedSection === 'hook' ? <Check className="h-3 w-3 mr-1 text-emerald-600" /> : <Copy className="h-3 w-3 mr-1" />}
                    Copy Hook
                  </Button>
                </div>
                <p className="text-xs italic font-medium text-foreground border-l-2 border-primary pl-3 py-1">
                  "{concept.coreMessageHook}"
                </p>
              </div>

              {/* Value Pillars List */}
              <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Strategic Value Pillars
                </span>
                <div className="space-y-2 pt-1">
                  {concept.valuePillars.map((pillar, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-foreground font-medium">{pillar}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Call to Action */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 space-y-1">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Call to Action (CTA)
                </span>
                <p className="text-xs font-semibold text-foreground">
                  👉 {concept.callToAction}
                </p>
              </div>
            </TabsContent>

            {/* TAB 2: OBJECTIONS & REBUTTALS */}
            <TabsContent value="objections" className="space-y-4">
              {concept.objectionRebuttals.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No objections mapped to this concept.
                </div>
              ) : (
                concept.objectionRebuttals.map((reb, idx) => (
                  <div
                    key={reb.id || idx}
                    className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                        <ShieldAlert className="h-3 w-3" />
                        Objection #{idx + 1}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(reb.rebuttal, `reb_${idx}`)}
                        className="h-7 text-[11px] px-2"
                      >
                        {copiedSection === `reb_${idx}` ? <Check className="h-3 w-3 mr-1 text-emerald-600" /> : <Copy className="h-3 w-3 mr-1" />}
                        Copy Rebuttal
                      </Button>
                    </div>

                    <div className="p-2.5 rounded-xl bg-destructive/5 border border-destructive/20 text-xs">
                      <span className="font-bold text-destructive block mb-0.5">Prospect Statement:</span>
                      <p className="italic text-foreground">"{reb.objection}"</p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs space-y-1">
                      <span className="font-bold text-emerald-700 dark:text-emerald-300 block">Verified Rebuttal Script:</span>
                      <p className="text-foreground leading-relaxed">{reb.rebuttal}</p>
                    </div>

                    {reb.counterProofPoints && reb.counterProofPoints.length > 0 && (
                      <div className="space-y-1 text-xs">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase">Counter Proof Points:</span>
                        <ul className="space-y-1 pt-0.5">
                          {reb.counterProofPoints.map((pt, pIdx) => (
                            <li key={pIdx} className="flex items-start gap-1.5 text-muted-foreground text-[11px]">
                              <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{pt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            {/* TAB 3: CHANNELS & PROOF */}
            <TabsContent value="channels" className="space-y-4">
              {/* Channel Breakdown */}
              <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-3">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Recommended Channel Strategy
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {concept.recommendedChannels.map((ch) => {
                    const meta = getCampaignChannelMeta(ch);
                    return (
                      <div
                        key={ch}
                        className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold ${meta.badgeClass}`}
                      >
                        <Send className="h-4 w-4" />
                        <span>{meta.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Source Knowledge Provenance */}
              <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary" /> Source Intelligence Provenance
                </span>
                {concept.sourceIdeaTitle && (
                  <p className="text-xs text-foreground">
                    <span className="font-semibold text-muted-foreground">Derived from Idea: </span>
                    {concept.sourceIdeaTitle}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Linked to {concept.sourceKnowledgeIds.length} customer feedback notes and call logs in Company Brain.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-5 border-t border-border/70 flex items-center justify-between gap-3 bg-muted/20">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-xl text-xs h-9 min-h-[44px] sm:min-h-[36px]"
          >
            Close Brief
          </Button>

          {concept.status === 'deployed_to_campaign' ? (
            <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 py-1.5 px-3">
              <Check className="h-3.5 w-3.5 mr-1.5" /> Deployed to Studio
            </Badge>
          ) : (
            <Button
              type="button"
              onClick={handleDeploy}
              disabled={isDeploying}
              className="h-9 min-h-[44px] sm:min-h-[36px] rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm active:scale-[0.97] transition-all"
            >
              {isDeploying ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Rocket className="h-3.5 w-3.5 mr-1.5" />
                  🚀 Deploy to Campaign Studio
                </>
              )}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
