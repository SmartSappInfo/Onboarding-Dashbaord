'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Email Campaign Distribution Tab
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Powered by SmartSapp Messaging Engine with recipient tracking tokens (ref).
 * 2. Variable interpolation routes strictly through FieldsVariablesService.
 * 3. Mobile-first touch optimization (min-h-[44px], active:scale-[0.97]).
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Mail, Send, Loader2, CheckCircle2, Inbox } from 'lucide-react';
import { AudienceSelector } from './AudienceSelector';
import { createSurveyDistributionCampaignAction, dispatchSurveyDistributionCampaignAction } from '@/lib/surveys/survey-campaign-actions';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import type { Survey } from '@/lib/types';
import type { SurveyDeployment } from '@/lib/surveys/survey-v2-types';

export interface EmailCampaignTabProps {
  survey: Survey;
  deployments: SurveyDeployment[];
  defaultUrl: string;
  onRefresh: () => void;
}

export function EmailCampaignTab({
  survey,
  deployments,
  defaultUrl,
  onRefresh,
}: EmailCampaignTabProps) {
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const [campaignName, setCampaignName] = React.useState(`${survey.title || 'Survey'} Email Invitation`);
  const [subject, setSubject] = React.useState(`We'd love your feedback: ${survey.title || 'Survey'}`);
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([]);
  const [audienceCount, setAudienceCount] = React.useState(0);
  const [messageBody, setMessageBody] = React.useState(
    'Hi {{recipient_name}},\n\nWe value your opinion and would appreciate it if you could take a few moments to complete our brief survey:\n\n{{survey_link}}\n\nThank you for your time!'
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<{ dispatched: number; failed: number } | null>(null);

  const handleLaunchCampaign = async () => {
    if (!activeWorkspaceId || !user) return;
    setIsSubmitting(true);
    setLastResult(null);

    try {
      const dep = deployments.find((d) => d.channel === 'email') || deployments[0];
      if (!dep) {
        toast({ variant: 'destructive', title: 'Error', description: 'No active deployment found.' });
        return;
      }

      const createRes = await createSurveyDistributionCampaignAction({
        surveyId: survey.id,
        deploymentId: dep.id,
        workspaceId: activeWorkspaceId,
        name: campaignName,
        channel: 'email',
        audienceConfig: {
          targetType: selectedTagIds.length > 0 ? 'tags' : 'all',
          filterTagIds: selectedTagIds,
          recipientCount: audienceCount,
        },
        messageConfig: {
          subject,
          messageBody,
          templateId: 'email_survey_invitation',
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
          title: 'Email Campaign Dispatched',
          description: `Successfully delivered to ${dispatchRes.dispatchedCount} contacts.`,
        });
        onRefresh();
      } else {
        toast({ variant: 'destructive', title: 'Dispatch Error', description: dispatchRes.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Dispatch Error', description: 'Failed to broadcast email campaign.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 space-y-6">
        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4 w-full">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 shrink-0 flex items-center justify-center">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="flex flex-col justify-center min-w-0">
                  <CardTitle className="text-base font-bold text-foreground">Email Campaign Dispatch</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Send personalized email survey invitations with automatic recipient tracking tokens.
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
                className="h-11 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email Subject Line</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
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
              <Label className="text-xs text-muted-foreground">Email Message Body</Label>
              <Textarea
                rows={5}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                className="font-mono text-xs rounded-xl"
              />
            </div>

            {lastResult && (
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600" />
                <span>
                  Dispatched <strong>{lastResult.dispatched}</strong> emails ({lastResult.failed} failed/missing addresses).
                </span>
              </div>
            )}

            <Button
              type="button"
              disabled={isSubmitting || audienceCount === 0}
              onClick={handleLaunchCampaign}
              className="w-full h-11 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 active:scale-[0.97]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Dispatching Emails...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" /> Send Email Campaign (~{audienceCount} Recipients)
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Email Inbox Preview */}
      <div className="lg:col-span-5 space-y-6">
        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4 w-full">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 shrink-0 flex items-center justify-center">
                  <Inbox className="h-5 w-5" />
                </div>
                <div className="flex flex-col justify-center min-w-0">
                  <CardTitle className="text-sm font-bold text-foreground">Email Inbox Preview</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Live preview of the recipient email client experience.
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="w-full max-w-[340px] rounded-2xl border border-slate-200 bg-white p-4 shadow-md text-left text-xs space-y-3">
              <div className="border-b border-slate-100 pb-2 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>From: SmartSapp Surveys</span>
                  <span>Just now</span>
                </div>
                <p className="font-bold text-slate-900 truncate">{subject}</p>
              </div>

              <div className="text-slate-700 text-xs whitespace-pre-wrap leading-relaxed">
                {messageBody
                  .replace('{{recipient_name}}', 'Jane Doe')
                  .replace('{{survey_link}}', defaultUrl)}
              </div>

              <div className="pt-2">
                <div className="w-full py-2.5 bg-blue-600 text-white font-bold text-center rounded-xl text-xs shadow-sm">
                  Start Survey
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
