'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — SMS Blast Distribution Tab
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Powered by mNotify SMS Engine with shortened personalized tracking links.
 * 2. Mobile-first touch optimization (min-h-[44px], active:scale-[0.97]).
 * 3. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Smartphone, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { AudienceSelector } from './AudienceSelector';
import { createSurveyDistributionCampaignAction, dispatchSurveyDistributionCampaignAction } from '@/lib/surveys/survey-campaign-actions';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import type { Survey } from '@/lib/types';
import type { SurveyDeployment } from '@/lib/surveys/survey-v2-types';

export interface SmsBlastTabProps {
  survey: Survey;
  deployments: SurveyDeployment[];
  defaultUrl: string;
  onRefresh: () => void;
}

export function SmsBlastTab({
  survey,
  deployments,
  defaultUrl,
  onRefresh,
}: SmsBlastTabProps) {
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const [campaignName, setCampaignName] = React.useState(`${survey.title || 'Survey'} SMS Blast`);
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([]);
  const [audienceCount, setAudienceCount] = React.useState(0);
  const [messageBody, setMessageBody] = React.useState(
    'Hi {{recipient_name}}, please take 2 mins to complete our survey: {{survey_link}}'
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<{ dispatched: number; failed: number } | null>(null);

  const charCount = messageBody.length;
  const segments = Math.ceil(charCount / 160) || 1;

  const handleLaunchCampaign = async () => {
    if (!activeWorkspaceId || !user) return;
    setIsSubmitting(true);
    setLastResult(null);

    try {
      const dep = deployments.find((d) => d.channel === 'sms') || deployments[0];
      if (!dep) {
        toast({ variant: 'destructive', title: 'Error', description: 'No active deployment found.' });
        return;
      }

      const createRes = await createSurveyDistributionCampaignAction({
        surveyId: survey.id,
        deploymentId: dep.id,
        workspaceId: activeWorkspaceId,
        name: campaignName,
        channel: 'sms',
        audienceConfig: {
          targetType: selectedTagIds.length > 0 ? 'tags' : 'all',
          filterTagIds: selectedTagIds,
          recipientCount: audienceCount,
        },
        messageConfig: {
          messageBody,
          templateId: 'sms_survey_blast',
        },
        createdBy: user.uid,
      });

      if (!createRes.success || !createRes.campaignId) {
        toast({ variant: 'destructive', title: 'Campaign Creation Failed', description: createRes.error });
        return;
      }

      const dispatchRes = await dispatchSurveyDistributionCampaignAction(createRes.campaignId, activeWorkspaceId);
      if (dispatchRes.success) {
        setLastResult({ dispatched: dispatchRes.dispatchedCount, failed: dispatchRes.failedCount });
        toast({
          title: 'SMS Campaign Dispatched',
          description: `Successfully delivered to ${dispatchRes.dispatchedCount} contacts.`,
        });
        onRefresh();
      } else {
        toast({ variant: 'destructive', title: 'Dispatch Error', description: dispatchRes.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Dispatch Error', description: 'Failed to broadcast SMS campaign.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 space-y-6">
        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">SMS Text Blast</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Send direct SMS invitations with high deliverability and personalized tracking tokens.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Campaign Name</Label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="h-11 rounded-xl text-xs"
              />
            </div>

            {/* Audience Targeting */}
            <AudienceSelector
              selectedTagIds={selectedTagIds}
              onTagsChange={setSelectedTagIds}
              onAudienceCountChange={setAudienceCount}
            />

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">SMS Message Body</Label>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {charCount} chars • {segments} SMS segment{segments > 1 ? 's' : ''}
                </span>
              </div>
              <Textarea
                rows={4}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                className="font-mono text-xs rounded-xl"
              />
            </div>

            {lastResult && (
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-800 dark:text-purple-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-purple-600" />
                <span>
                  Dispatched <strong>{lastResult.dispatched}</strong> SMS texts ({lastResult.failed} failed/missing numbers).
                </span>
              </div>
            )}

            <Button
              type="button"
              disabled={isSubmitting || audienceCount === 0}
              onClick={handleLaunchCampaign}
              className="w-full h-11 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20 active:scale-[0.97]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Dispatching SMS...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" /> Send SMS Blast (~{audienceCount} Recipients)
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* SMS Screen Mockup */}
      <div className="lg:col-span-5 space-y-6">
        <Card className="rounded-2xl border-border bg-card shadow-sm text-center">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">SMS Mobile Preview</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="w-[280px] rounded-[32px] border-[6px] border-slate-800 bg-slate-100 p-3 shadow-xl text-left text-xs">
              <div className="bg-blue-600 text-white p-3 rounded-2xl rounded-br-none shadow-sm text-xs leading-relaxed">
                {messageBody
                  .replace('{{recipient_name}}', 'Jane')
                  .replace('{{survey_link}}', defaultUrl)}
              </div>
              <span className="text-[10px] text-slate-400 block text-right mt-1">Delivered</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
