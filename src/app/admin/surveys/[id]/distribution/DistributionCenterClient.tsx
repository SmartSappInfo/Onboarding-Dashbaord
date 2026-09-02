'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Multi-Channel Distribution Hub
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Coordinates all 7 distribution vectors for Surveys 2.0:
 *    - Distribution Overview & Live Delivery Funnel
 *    - Custom Links & Password Gates
 *    - Email Campaigns with Personalized Tracking Links
 *    - SMS Blasts via mNotify Gateway
 *    - Meta WhatsApp Cloud Campaigns
 *    - High-Fidelity Vector QR Studio & Print Kits
 *    - Embed Widget SDK (Inline, Modal, Drawer, FAB)
 *    - Event Kiosk Mode with Inactivity Timeout Resets
 * 2. Strict Zero-Any typing standard.
 * 3. Responsive, mobile-first navigation tabs with active scale interactions.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ArrowLeft, 
  Share2, 
  Link2, 
  Mail, 
  Smartphone, 
  MessageSquare, 
  QrCode, 
  Code, 
  Monitor, 
  Loader2,
  ExternalLink,
  BarChart3
} from 'lucide-react';
import { useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import type { Survey } from '@/lib/types';
import type { SurveyDeployment } from '@/lib/surveys/survey-v2-types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageContainerFluid } from '@/components/ui/page-container';
import { getSurveyDeploymentsAction } from '@/lib/surveys/survey-deployment-actions';
import { DeploymentManagerDialog } from '@/app/admin/surveys/components/DeploymentManagerDialog';

import { DistributionOverviewTab } from './components/DistributionOverviewTab';
import { LinksTab } from './components/LinksTab';
import { EmailCampaignTab } from './components/EmailCampaignTab';
import { SmsBlastTab } from './components/SmsBlastTab';
import { WhatsAppCampaignTab } from './components/WhatsAppCampaignTab';
import { QrStudioTab } from './components/QrStudioTab';
import { WebEmbedTab } from './components/WebEmbedTab';
import { KioskModeTab } from './components/KioskModeTab';

interface DistributionCenterClientProps {
  surveyId: string;
}

export default function DistributionCenterClient({ surveyId }: DistributionCenterClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();

  const activeTab = searchParams.get('tab') || 'overview';
  const [managerOpen, setManagerOpen] = React.useState(false);
  const [serverDeployments, setServerDeployments] = React.useState<SurveyDeployment[]>([]);

  const setTab = (newTab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', newTab);
    router.replace(`?${params.toString()}`);
  };

  // Fetch Survey Doc
  const surveyDocRef = useMemoFirebase(
    () => (firestore && surveyId ? doc(firestore, 'surveys', surveyId) : null),
    [firestore, surveyId]
  );
  const { data: survey, isLoading: isLoadingSurvey } = useDoc<Survey>(surveyDocRef);

  const activeWorkspaceId = survey?.workspaceIds?.[0] || '';

  const fetchDeployments = React.useCallback(async () => {
    if (!surveyId) return;
    try {
      const res = await getSurveyDeploymentsAction(surveyId, activeWorkspaceId || 'default');
      if (res.success && res.deployments) {
        setServerDeployments(res.deployments);
      }
    } catch {
      // Ignored: fallback to Firestore listener
    }
  }, [surveyId, activeWorkspaceId]);

  React.useEffect(() => {
    fetchDeployments();
  }, [fetchDeployments]);

  // Fetch Deployments via Firestore Live Listener
  const deploymentsQuery = useMemoFirebase(
    () => (firestore && surveyId ? query(
      collection(firestore, 'survey_deployments'),
      where('surveyId', '==', surveyId),
      orderBy('createdAt', 'desc')
    ) : null),
    [firestore, surveyId]
  );
  const { data: rawDeployments } = useCollection<SurveyDeployment>(deploymentsQuery);
  const deployments = React.useMemo(() => {
    if (rawDeployments && rawDeployments.length > 0) return rawDeployments;
    return serverDeployments;
  }, [rawDeployments, serverDeployments]);

  // Build Default Public URL
  const defaultUrl = React.useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.smartsapp.com';
    if (!survey) return `${origin}/s/${surveyId}`;
    return `${origin}/s/${survey.slug || survey.id}`;
  }, [survey, surveyId]);

  if (isLoadingSurvey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-semibold text-muted-foreground">Loading Survey Distribution Hub...</p>
      </div>
    );
  }

  if (!survey) {
    return (
      <PageContainerFluid>
        <div className="p-12 text-center space-y-4">
          <h2 className="text-xl font-bold">Survey Not Found</h2>
          <p className="text-sm text-muted-foreground">The requested survey could not be loaded or has been deleted.</p>
          <Button asChild variant="outline">
            <Link href="/admin/surveys">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Surveys
            </Link>
          </Button>
        </div>
      </PageContainerFluid>
    );
  }

  return (
    <PageContainerFluid>
      <div className="space-y-6 pb-12 text-left">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="h-9 w-9 rounded-xl border border-border/60 hover:bg-muted"
              >
                <Link href="/admin/surveys">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{survey.title || 'Untitled Survey'}</h1>
                <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-full border-primary/30 text-primary bg-primary/5">
                  Distribution Hub
                </Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground ml-12">
              Share and track your survey across 7 automated outreach channels.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setManagerOpen(true)}
              className="rounded-xl h-10 px-4 text-xs font-semibold gap-1.5"
            >
              <Share2 className="h-3.5 w-3.5 text-primary" />
              Manage Channels & Links
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="rounded-xl h-10 px-4 text-xs font-semibold"
            >
              <Link href={`/admin/surveys/${surveyId}/results`}>
                <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                Results & Analytics
              </Link>
            </Button>
            <Button
              variant="default"
              size="sm"
              asChild
              className="rounded-xl h-10 px-4 text-xs font-semibold gap-1.5"
            >
              <a href={defaultUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Open Live Survey
              </a>
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setTab} className="space-y-6">
          <div className="overflow-x-auto pb-1 scrollbar-none">
            <TabsList className="bg-muted/40 p-1 rounded-2xl h-auto gap-1 border border-border/40 inline-flex min-w-full sm:min-w-0">
              <TabsTrigger
                value="overview"
                className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-background data-[state=active]:shadow-xs min-h-[44px] sm:min-h-[38px] flex items-center gap-2"
              >
                <Share2 className="h-3.5 w-3.5 text-primary" />
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="links"
                className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-background data-[state=active]:shadow-xs min-h-[44px] sm:min-h-[38px] flex items-center gap-2"
              >
                <Link2 className="h-3.5 w-3.5 text-emerald-500" />
                Links & Slugs
              </TabsTrigger>
              <TabsTrigger
                value="email"
                className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-background data-[state=active]:shadow-xs min-h-[44px] sm:min-h-[38px] flex items-center gap-2"
              >
                <Mail className="h-3.5 w-3.5 text-blue-500" />
                Email Campaign
              </TabsTrigger>
              <TabsTrigger
                value="sms"
                className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-background data-[state=active]:shadow-xs min-h-[44px] sm:min-h-[38px] flex items-center gap-2"
              >
                <Smartphone className="h-3.5 w-3.5 text-violet-500" />
                SMS Blast
              </TabsTrigger>
              <TabsTrigger
                value="whatsapp"
                className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-background data-[state=active]:shadow-xs min-h-[44px] sm:min-h-[38px] flex items-center gap-2"
              >
                <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                WhatsApp
              </TabsTrigger>
              <TabsTrigger
                value="qr"
                className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-background data-[state=active]:shadow-xs min-h-[44px] sm:min-h-[38px] flex items-center gap-2"
              >
                <QrCode className="h-3.5 w-3.5 text-amber-500" />
                QR Studio
              </TabsTrigger>
              <TabsTrigger
                value="embed"
                className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-background data-[state=active]:shadow-xs min-h-[44px] sm:min-h-[38px] flex items-center gap-2"
              >
                <Code className="h-3.5 w-3.5 text-indigo-500" />
                Web Embed
              </TabsTrigger>
              <TabsTrigger
                value="kiosk"
                className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-background data-[state=active]:shadow-xs min-h-[44px] sm:min-h-[38px] flex items-center gap-2"
              >
                <Monitor className="h-3.5 w-3.5 text-slate-500" />
                Kiosk Mode
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-0 focus-visible:outline-none">
            <DistributionOverviewTab
              survey={survey}
              deployments={deployments}
              totalResponses={survey.totalResponses || 0}
              onRefresh={fetchDeployments}
            />
          </TabsContent>

          <TabsContent value="links" className="mt-0 focus-visible:outline-none">
            <LinksTab
              survey={survey}
              deployments={deployments}
              defaultUrl={defaultUrl}
              onRefresh={fetchDeployments}
            />
          </TabsContent>

          <TabsContent value="email" className="mt-0 focus-visible:outline-none">
            <EmailCampaignTab
              survey={survey}
              deployments={deployments}
              defaultUrl={defaultUrl}
              onRefresh={fetchDeployments}
            />
          </TabsContent>

          <TabsContent value="sms" className="mt-0 focus-visible:outline-none">
            <SmsBlastTab
              survey={survey}
              deployments={deployments}
              defaultUrl={defaultUrl}
              onRefresh={fetchDeployments}
            />
          </TabsContent>

          <TabsContent value="whatsapp" className="mt-0 focus-visible:outline-none">
            <WhatsAppCampaignTab
              survey={survey}
              deployments={deployments}
              defaultUrl={defaultUrl}
              onRefresh={fetchDeployments}
            />
          </TabsContent>

          <TabsContent value="qr" className="mt-0 focus-visible:outline-none">
            <QrStudioTab
              survey={survey}
              defaultUrl={defaultUrl}
            />
          </TabsContent>

          <TabsContent value="embed" className="mt-0 focus-visible:outline-none">
            <WebEmbedTab
              survey={survey}
              defaultUrl={defaultUrl}
            />
          </TabsContent>

          <TabsContent value="kiosk" className="mt-0 focus-visible:outline-none">
            <KioskModeTab
              survey={survey}
              defaultUrl={defaultUrl}
            />
          </TabsContent>
        </Tabs>

        {/* Deployment Manager Dialog */}
        <DeploymentManagerDialog
          open={managerOpen}
          onOpenChange={(val) => {
            setManagerOpen(val);
            if (!val) fetchDeployments();
          }}
          surveyId={surveyId}
          workspaceId={activeWorkspaceId || 'default'}
          surveyTitle={survey.title || 'Survey'}
          defaultSlug={survey.slug || surveyId}
        />
      </div>
    </PageContainerFluid>
  );
}
