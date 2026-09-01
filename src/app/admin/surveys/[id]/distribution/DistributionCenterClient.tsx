'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Omnichannel Distribution Center Client Hub
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Unified Operating Center for Survey Distribution:
 *    - Connects Links, QR Codes, WhatsApp, Email, SMS, Web Embeds, and Kiosks.
 * 2. Mobile-First Ergonomics & Accessibility (WCAG 2.1 AA):
 *    - Touch targets min-h-[44px], active:scale-[0.97] tactile press states.
 * 3. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { doc, collection, getCountFromServer } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { PageContainer } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Share2,
  Globe,
  QrCode,
  MessageSquare,
  Mail,
  Smartphone,
  Layers,
  Monitor,
  BarChart3,
  Edit,
  ArrowLeft,
  ExternalLink,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { getSurveyDeploymentsAction } from '@/lib/surveys/survey-deployment-actions';
import { DeploymentManagerDialog } from '@/app/admin/surveys/components/DeploymentManagerDialog';
import type { Survey } from '@/lib/types';
import type { SurveyDeployment } from '@/lib/surveys/survey-v2-types';
import { getBaseUrl } from '@/lib/utils/url-helpers';

// Tab components
import { DistributionOverviewTab } from './components/DistributionOverviewTab';
import { LinksTab } from './components/LinksTab';
import { QrStudioTab } from './components/QrStudioTab';
import { WhatsAppCampaignTab } from './components/WhatsAppCampaignTab';
import { EmailCampaignTab } from './components/EmailCampaignTab';
import { SmsBlastTab } from './components/SmsBlastTab';
import { WebEmbedTab } from './components/WebEmbedTab';
import { KioskModeTab } from './components/KioskModeTab';

export interface DistributionCenterClientProps {
  surveyId: string;
}

export default function DistributionCenterClient({ surveyId }: DistributionCenterClientProps) {
  const router = useRouter();
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState('overview');
  const [deployments, setDeployments] = React.useState<SurveyDeployment[]>([]);
  const [totalResponses, setTotalResponses] = React.useState(0);
  const [isLoadingDeployments, setIsLoadingDeployments] = React.useState(false);
  const [showDeployDialog, setShowDeployDialog] = React.useState(false);

  // Firestore Survey Doc Binding
  const surveyDocRef = useMemoFirebase(() => {
    if (!firestore || !surveyId) return null;
    return doc(firestore, 'surveys', surveyId);
  }, [firestore, surveyId]);

  const { data: survey, isLoading: isLoadingSurvey } = useDoc<Survey>(surveyDocRef);

  useSetBreadcrumb(
    survey?.title ? `${survey.title} — Distribution` : 'Distribution Center',
    `/admin/surveys/${surveyId}/distribution`
  );

  // Fetch Deployments
  const fetchDeployments = React.useCallback(async () => {
    if (!surveyId || !activeWorkspaceId) return;
    setIsLoadingDeployments(true);
    try {
      const res = await getSurveyDeploymentsAction(surveyId, activeWorkspaceId);
      if (res.success && res.deployments) {
        setDeployments(res.deployments);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load distribution channels.' });
    } finally {
      setIsLoadingDeployments(false);
    }
  }, [surveyId, activeWorkspaceId, toast]);

  // Fetch total response counts
  React.useEffect(() => {
    if (!firestore || !surveyId) return;
    let active = true;
    async function loadCount() {
      try {
        const responsesColl = collection(firestore!, 'surveys', surveyId, 'responses');
        const snap = await getCountFromServer(responsesColl);
        if (active) setTotalResponses(snap.data().count);
      } catch (err) {
        console.error('Failed to count responses:', err);
      }
    }
    loadCount();
    return () => {
      active = false;
    };
  }, [firestore, surveyId]);

  React.useEffect(() => {
    fetchDeployments();
  }, [fetchDeployments]);

  const defaultUrl = React.useMemo(() => {
    const slug = survey?.slug || surveyId;
    return `${getBaseUrl()}/surveys/${encodeURIComponent(slug)}`;
  }, [survey?.slug, surveyId]);

  if (isLoadingSurvey) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </PageContainer>
    );
  }

  if (!survey) {
    return (
      <PageContainer>
        <div className="py-16 text-center space-y-4">
          <p className="text-muted-foreground">Survey not found or access denied.</p>
          <Button onClick={() => router.push('/admin/surveys')}>Back to Surveys</Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/70 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/admin/surveys/${surveyId}`)}
                className="h-8 px-2 text-muted-foreground hover:text-foreground rounded-lg -ml-2 active:scale-[0.97]"
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Overview
              </Button>
              <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                Distribution Hub
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Share2 className="h-6 w-6 text-primary" />
              {survey.title || 'Untitled Survey'}
            </h1>
            <p className="text-xs text-muted-foreground">
              Orchestrate multi-channel audience delivery, QR marketing kits, embeds, and field kiosks.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeployDialog(true)}
              className="h-10 px-4 rounded-xl text-xs font-semibold border-primary/30 text-primary hover:bg-primary/5 active:scale-[0.97]"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" /> New Channel Link
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/admin/surveys/${surveyId}/edit`)}
              className="h-10 px-4 rounded-xl text-xs font-semibold hover:bg-muted active:scale-[0.97]"
            >
              <Edit className="h-3.5 w-3.5 mr-1.5" /> Studio
            </Button>
            <Button
              size="sm"
              onClick={() => router.push(`/admin/surveys/${surveyId}/results`)}
              className="h-10 px-4 rounded-xl text-xs font-semibold shadow-sm active:scale-[0.97]"
            >
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" /> Analytics
            </Button>
          </div>
        </div>

        {/* Tabbed Navigation Hub */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/60 p-1 rounded-2xl h-auto flex flex-wrap gap-1 border border-border/50">
            {[
              { id: 'overview', label: 'Overview & Funnel', icon: BarChart3 },
              { id: 'links', label: 'Public Links', icon: Globe },
              { id: 'qr', label: 'QR Studio', icon: QrCode },
              { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
              { id: 'email', label: 'Email', icon: Mail },
              { id: 'sms', label: 'SMS Blast', icon: Smartphone },
              { id: 'embed', label: 'Web Embed', icon: Layers },
              { id: 'kiosk', label: 'Kiosk Mode', icon: Monitor },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="rounded-xl px-3.5 py-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs transition-all flex items-center gap-1.5 active:scale-[0.97]"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="overview">
            <DistributionOverviewTab
              survey={survey}
              deployments={deployments}
              totalResponses={totalResponses}
              onRefresh={fetchDeployments}
            />
          </TabsContent>

          <TabsContent value="links">
            <LinksTab
              survey={survey}
              deployments={deployments}
              defaultUrl={defaultUrl}
              onRefresh={fetchDeployments}
            />
          </TabsContent>

          <TabsContent value="qr">
            <QrStudioTab
              survey={survey}
              defaultUrl={defaultUrl}
            />
          </TabsContent>

          <TabsContent value="whatsapp">
            <WhatsAppCampaignTab
              survey={survey}
              deployments={deployments}
              defaultUrl={defaultUrl}
              onRefresh={fetchDeployments}
            />
          </TabsContent>

          <TabsContent value="email">
            <EmailCampaignTab
              survey={survey}
              deployments={deployments}
              defaultUrl={defaultUrl}
              onRefresh={fetchDeployments}
            />
          </TabsContent>

          <TabsContent value="sms">
            <SmsBlastTab
              survey={survey}
              deployments={deployments}
              defaultUrl={defaultUrl}
              onRefresh={fetchDeployments}
            />
          </TabsContent>

          <TabsContent value="embed">
            <WebEmbedTab
              survey={survey}
              defaultUrl={defaultUrl}
            />
          </TabsContent>

          <TabsContent value="kiosk">
            <KioskModeTab
              survey={survey}
              defaultUrl={defaultUrl}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Deployment Manager Dialog */}
      <DeploymentManagerDialog
        open={showDeployDialog}
        onOpenChange={setShowDeployDialog}
        surveyId={surveyId}
        workspaceId={activeWorkspaceId || ''}
        surveyTitle={survey.title || 'Survey'}
        defaultSlug={survey.slug || surveyId}
      />
    </PageContainer>
  );
}
