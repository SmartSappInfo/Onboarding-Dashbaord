'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — WhatsApp Cloud Business Campaign Distribution Tab
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Meta WhatsApp Cloud Business API Compliance:
 *    - Uses pre-approved templates or interactive reply buttons.
 *    - Personalizes survey links per recipient with cryptographic tracking tokens (ref).
 * 2. Tag Selection Single Source of Truth:
 *    - Exclusively routes contact filtering through <AudienceSelector>.
 * 3. Mobile-first touch optimization (min-h-[44px], active:scale-[0.97]).
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Send, Loader2, CheckCircle2, AlertCircle, Smartphone } from 'lucide-react';
import { AudienceSelector } from './AudienceSelector';
import { createSurveyDistributionCampaignAction, dispatchSurveyDistributionCampaignAction } from '@/lib/surveys/survey-campaign-actions';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import type { Survey } from '@/lib/types';
import type { SurveyDeployment } from '@/lib/surveys/survey-v2-types';

export interface WhatsAppCampaignTabProps {
  survey: Survey;
  deployments: SurveyDeployment[];
  defaultUrl: string;
  onRefresh: () => void;
}

export function WhatsAppCampaignTab({
  survey,
  deployments,
  defaultUrl,
  onRefresh,
}: WhatsAppCampaignTabProps) {
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const [campaignName, setCampaignName] = React.useState(`${survey.title || 'Survey'} WhatsApp Blast`);
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([]);
  const [buttonText, setButtonText] = React.useState('Take Survey');
  const [templateName, setTemplateName] = React.useState('survey_invitation_v2');
  const [audienceCount, setAudienceCount] = React.useState(0);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<{ dispatched: number; failed: number } | null>(null);

  const handleLaunchCampaign = async () => {
    if (!activeWorkspaceId || !user) return;
    setIsSubmitting(true);
    setLastResult(null);

    try {
      // Find or default deployment
      const dep = deployments.find((d) => d.channel === 'whatsapp') || deployments[0];
      if (!dep) {
        toast({ variant: 'destructive', title: 'Error', description: 'No active deployment found.' });
        return;
      }

      // 1. Create campaign record
      const createRes = await createSurveyDistributionCampaignAction({
        surveyId: survey.id,
        deploymentId: dep.id,
        workspaceId: activeWorkspaceId,
        name: campaignName,
        channel: 'whatsapp',
        audienceConfig: {
          targetType: selectedTagIds.length > 0 ? 'tags' : 'all',
          filterTagIds: selectedTagIds,
          recipientCount: audienceCount,
        },
        messageConfig: {
          templateName,
          buttonText,
          templateId: templateName,
        },
        createdBy: user.uid,
      });

      if (!createRes.success || !createRes.campaignId) {
        toast({ variant: 'destructive', title: 'Campaign Creation Failed', description: createRes.error });
        return;
      }

      // 2. Dispatch batch campaign
      const dispatchRes = await dispatchSurveyDistributionCampaignAction(createRes.campaignId, activeWorkspaceId);
      if (dispatchRes.success) {
        setLastResult({ dispatched: dispatchRes.dispatchedCount, failed: dispatchRes.failedCount });
        toast({
          title: 'WhatsApp Campaign Dispatched',
          description: `Successfully delivered to ${dispatchRes.dispatchedCount} contacts.`,
        });
        onRefresh();
      } else {
        toast({ variant: 'destructive', title: 'Dispatch Error', description: dispatchRes.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Dispatch Error', description: 'Failed to broadcast WhatsApp campaign.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Configuration Form */}
      <div className="lg:col-span-7 space-y-6">
        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4 w-full">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 shrink-0 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div className="flex flex-col justify-center min-w-0">
                  <CardTitle className="text-base font-bold text-foreground">WhatsApp Cloud Campaign</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Send high-converting WhatsApp survey notifications with interactive CTA buttons.
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Campaign Name</Label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g. Q3 Parent Feedback Blast"
                className="h-11 rounded-xl text-xs"
              />
            </div>

            {/* Audience Targeting */}
            <AudienceSelector
              selectedTagIds={selectedTagIds}
              onTagsChange={setSelectedTagIds}
              onAudienceCountChange={setAudienceCount}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Meta Template ID</Label>
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="h-10 rounded-lg font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Button CTA Label</Label>
                <Input
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  className="h-10 rounded-lg text-xs"
                />
              </div>
            </div>

            {lastResult && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  Dispatched <strong>{lastResult.dispatched}</strong> messages ({lastResult.failed} failed/missing numbers).
                </span>
              </div>
            )}

            <Button
              type="button"
              disabled={isSubmitting || audienceCount === 0}
              onClick={handleLaunchCampaign}
              className="w-full h-11 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-[0.97]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Dispatching Broadcast...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" /> Launch WhatsApp Campaign (~{audienceCount} Recipients)
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* WhatsApp Message Preview */}
      <div className="lg:col-span-5 space-y-6">
        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4 w-full">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 shrink-0 flex items-center justify-center">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div className="flex flex-col justify-center min-w-0">
                  <CardTitle className="text-sm font-bold text-foreground">WhatsApp Recipient Preview</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Live preview of Meta WhatsApp business chat bubble.
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {/* Phone Screen Mockup */}
            <div className="w-[280px] rounded-[32px] border-[6px] border-slate-800 bg-[#efeae2] p-3 shadow-xl overflow-hidden text-left">
              <div className="space-y-2 pt-2">
                {/* Chat Bubble */}
                <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm text-xs space-y-2 border border-slate-200">
                  <p className="font-semibold text-slate-800">
                    Hello {'{{contact.name}}'},
                  </p>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    We would love to hear your thoughts regarding <strong>{survey.title || 'our recent program'}</strong>. It takes less than 3 minutes.
                  </p>
                  <div className="pt-1 border-t border-slate-100">
                    <div className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-center rounded-xl text-xs flex items-center justify-center gap-1">
                      <Smartphone className="h-3.5 w-3.5" />
                      {buttonText}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
