'use client';

import * as React from 'react';
import {
  Send,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Archive,
  Layers,
  Rocket,
  Check,
  Loader2,
  MessageSquare,
  Smartphone,
  Mail,
  PhoneCall,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  type CampaignConcept,
  type CampaignChannel,
} from '@/lib/quick-notes-types';
import {
  getCampaignChannelMeta,
  getCampaignConceptStatusMeta,
} from '@/lib/quick-notes-domain';
import { useToast } from '@/hooks/use-toast';
import {
  deployConceptToCampaignStudioAction,
  updateCampaignConceptStatusAction,
} from '@/lib/quick-notes-campaign-actions';

interface CampaignConceptCardProps {
  concept: CampaignConcept;
  onOpenDrawer?: (concept: CampaignConcept) => void;
  onConceptUpdated?: () => void;
}

export const CampaignConceptCard = React.memo(function CampaignConceptCard({
  concept,
  onOpenDrawer,
  onConceptUpdated,
}: CampaignConceptCardProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isDeploying, setIsDeploying] = React.useState(false);

  const statusMeta = getCampaignConceptStatusMeta(concept.status);

  const handleDeploy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeploying(true);
    try {
      const res = await deployConceptToCampaignStudioAction(
        concept.workspaceId,
        concept.id
      );
      if (res.success) {
        toast({
          title: 'Concept Deployed to Campaign Studio',
          description: `Campaign concept "${concept.title}" is now ready in Messaging Wizard.`,
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

  const handleStatusChange = async (newStatus: 'draft' | 'approved' | 'archived') => {
    try {
      const res = await updateCampaignConceptStatusAction(
        concept.workspaceId,
        concept.id,
        newStatus
      );
      if (res.success) {
        toast({ title: `Concept status updated to ${newStatus}` });
        onConceptUpdated?.();
      }
    } catch {
      toast({ title: 'Error updating status', variant: 'destructive' });
    }
  };

  const getChannelIcon = (channel: CampaignChannel) => {
    switch (channel) {
      case 'whatsapp':
        return <MessageSquare className="h-3 w-3 mr-1 text-emerald-600 dark:text-emerald-400" />;
      case 'sms':
        return <Smartphone className="h-3 w-3 mr-1 text-blue-600 dark:text-blue-400" />;
      case 'email':
        return <Mail className="h-3 w-3 mr-1 text-purple-600 dark:text-purple-400" />;
      case 'call_center':
        return <PhoneCall className="h-3 w-3 mr-1 text-amber-600 dark:text-amber-400" />;
      default:
        return <Send className="h-3 w-3 mr-1 text-muted-foreground" />;
    }
  };

  return (
    <div
      onClick={() => onOpenDrawer?.(concept)}
      className="group relative flex flex-col rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-all duration-200 hover:border-border hover:shadow-md cursor-pointer"
    >
      {/* Header Row: Title + Status + Relevance Score */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
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

            {concept.sourceIdeaTitle && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground truncate max-w-[200px]">
                <Layers className="h-3 w-3 shrink-0" />
                Idea: {concept.sourceIdeaTitle}
              </span>
            )}
          </div>

          <h3 className="text-sm sm:text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 pt-1">
            {concept.title}
          </h3>
        </div>

        {/* Action Menu */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-xl">
              <DropdownMenuItem onClick={() => handleStatusChange('approved')}>
                <Check className="h-3.5 w-3.5 mr-2 text-emerald-600" />
                Mark Approved
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('draft')}>
                <Send className="h-3.5 w-3.5 mr-2 text-slate-500" />
                Mark Draft
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('archived')}>
                <Archive className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                Archive Concept
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Target Persona Summary */}
      <div className="mt-3 p-2.5 rounded-xl bg-muted/40 border border-border/50 text-xs text-foreground/90">
        <span className="font-semibold text-foreground block mb-0.5">
          🎯 Target: {concept.targetAudience}
        </span>
        <p className="text-muted-foreground line-clamp-2">
          {concept.targetPersonaSummary}
        </p>
      </div>

      {/* Core Message Hook */}
      <div className="mt-3 text-xs">
        <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase block mb-1">
          Opening Hook
        </span>
        <p className="italic text-foreground font-medium border-l-2 border-primary/60 pl-2.5 py-0.5">
          &quot;{concept.coreMessageHook}&quot;
        </p>
      </div>

      {/* Value Pillars Badges */}
      <div className="mt-3 space-y-1">
        <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase block">
          Key Value Pillars
        </span>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {concept.valuePillars.slice(0, 3).map((pillar, idx) => (
            <span
              key={idx}
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-background border border-border text-foreground/80 font-medium"
            >
              <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />
              {pillar}
            </span>
          ))}
        </div>
      </div>

      {/* Collapsible Objection Rebuttals Preview */}
      {concept.objectionRebuttals && concept.objectionRebuttals.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/60">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors min-h-[36px] sm:min-h-[28px]"
          >
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
              {concept.objectionRebuttals.length} Objection Rebuttals Grounded
            </span>
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {isExpanded && (
            <div className="mt-2 space-y-2 pt-1">
              {concept.objectionRebuttals.map((reb, idx) => (
                <div
                  key={reb.id || idx}
                  className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs space-y-1"
                >
                  <p className="font-semibold text-amber-900 dark:text-amber-200">
                    ❌ Objection: &quot;{reb.objection}&quot;
                  </p>
                  <p className="text-foreground/80">
                    👉 Rebuttal: {reb.rebuttal}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer: Channels + Handoff CTA */}
      <div className="mt-4 pt-3 border-t border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Recommended Channels */}
        <div className="flex flex-wrap items-center gap-1.5">
          {concept.recommendedChannels.map((ch) => {
            const meta = getCampaignChannelMeta(ch);
            return (
              <span
                key={ch}
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${meta.badgeClass}`}
              >
                {getChannelIcon(ch)}
                {meta.label}
              </span>
            );
          })}
        </div>

        {/* Deploy to Campaign Studio Button */}
        <div onClick={(e) => e.stopPropagation()}>
          {concept.status === 'deployed_to_campaign' ? (
            <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 py-1">
              <Check className="h-3 w-3 mr-1" /> Deployed to Studio
            </Badge>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleDeploy}
              disabled={isDeploying}
              className="h-9 min-h-[44px] sm:min-h-[36px] w-full sm:w-auto rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm active:scale-[0.97] transition-all"
            >
              {isDeploying ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Rocket className="h-3.5 w-3.5 mr-1.5" />
                  🚀 Deploy to Studio
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});
