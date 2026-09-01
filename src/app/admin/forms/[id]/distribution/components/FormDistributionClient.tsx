'use client';

/**
 * SmartSapp Forms 2.0: Distribution Hub Master Command Center
 * 
 * Centralized multi-channel distribution studio uniting hosted URLs,
 * iframe/popup embed generators, QR codes, UTM campaigns, and developer APIs.
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Share2, 
  Globe, 
  Code2, 
  QrCode, 
  Target, 
  Terminal, 
  ArrowLeft, 
  Edit, 
  BarChart3, 
  Inbox,
  ExternalLink 
} from 'lucide-react';
import { PageContainer } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';
import type { Form } from '@/lib/types';

import HostedLinkCard from './HostedLinkCard';
import EmbedStudioCard from './EmbedStudioCard';
import QrStudioCard from './QrStudioCard';
import UtmCampaignBuilderCard from './UtmCampaignBuilderCard';
import ApiWebhooksCard from './ApiWebhooksCard';

interface FormDistributionClientProps {
  form: Form;
}

export default function FormDistributionClient({ form }: FormDistributionClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>('hosted');
  const [currentForm, setCurrentForm] = useState<Form>(form);

  useSetBreadcrumb('Distribution', `/admin/forms/${form.id}/distribution`);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.smartsapp.com';
  const publicUrl = `${origin}/p/f/${currentForm.slug || currentForm.id}`;

  return (
    <PageContainer>
      <div className="space-y-6 pb-20 max-w-screen-xl mx-auto">
        {/* ── 1. Header & Navigation Controls ── */}
        <div className="space-y-4 pb-2 border-b border-border/40">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/admin/forms/${form.id}`)}
                  className="h-8 px-2 rounded-xl text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back to Form
                </Button>
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-primary/5 text-primary border-primary/20">
                  Distribution Hub 2.0
                </Badge>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                  <Share2 className="h-7 w-7 text-primary" />
                  Share & Distribute: {currentForm.internalName || currentForm.title}
                </h1>
              </div>
            </div>

            {/* Quick Action Pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(publicUrl, '_blank')}
                className="h-10 rounded-2xl text-xs font-bold gap-1.5 min-h-[44px] sm:min-h-0 text-primary border-primary/30 hover:bg-primary/5"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open Live Form</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/admin/forms/${form.id}/analytics`)}
                className="h-10 rounded-2xl text-xs font-bold gap-1.5 min-h-[44px] sm:min-h-0"
              >
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
                <span>Analytics</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/admin/forms/${form.id}/submissions`)}
                className="h-10 rounded-2xl text-xs font-bold gap-1.5 min-h-[44px] sm:min-h-0"
              >
                <Inbox className="h-3.5 w-3.5" />
                <span>Responses</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/admin/forms/${form.id}/edit`)}
                className="h-10 rounded-2xl text-xs font-bold gap-1.5 min-h-[44px] sm:min-h-0"
              >
                <Edit className="h-3.5 w-3.5" />
                <span>Studio</span>
              </Button>
            </div>
          </div>

          {/* Channel Selector Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full pt-2">
            <TabsList className="h-11 p-1 rounded-2xl bg-muted/30 border border-border/40 flex-wrap overflow-x-auto w-full justify-start">
              <TabsTrigger value="hosted" className="text-xs font-bold rounded-xl gap-2 min-h-[36px]">
                <Globe className="h-3.5 w-3.5 text-primary" />
                Hosted Link & Social
              </TabsTrigger>
              <TabsTrigger value="embed" className="text-xs font-bold rounded-xl gap-2 min-h-[36px]">
                <Code2 className="h-3.5 w-3.5 text-indigo-500" />
                Embed Studio & Preview
              </TabsTrigger>
              <TabsTrigger value="qr" className="text-xs font-bold rounded-xl gap-2 min-h-[36px]">
                <QrCode className="h-3.5 w-3.5 text-amber-500" />
                QR Code Studio
              </TabsTrigger>
              <TabsTrigger value="utm" className="text-xs font-bold rounded-xl gap-2 min-h-[36px]">
                <Target className="h-3.5 w-3.5 text-emerald-500" />
                UTM Campaigns
              </TabsTrigger>
              <TabsTrigger value="api" className="text-xs font-bold rounded-xl gap-2 min-h-[36px]">
                <Terminal className="h-3.5 w-3.5 text-slate-500" />
                Developer API
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* ── 2. Active Channel Studio Cards ── */}
        <div className="space-y-6">
          {activeTab === 'hosted' && (
            <HostedLinkCard
              form={currentForm}
              onSlugUpdated={(newSlug) => setCurrentForm(prev => ({ ...prev, slug: newSlug }))}
            />
          )}

          {activeTab === 'embed' && (
            <EmbedStudioCard form={currentForm} />
          )}

          {activeTab === 'qr' && (
            <QrStudioCard form={currentForm} />
          )}

          {activeTab === 'utm' && (
            <UtmCampaignBuilderCard form={currentForm} />
          )}

          {activeTab === 'api' && (
            <ApiWebhooksCard form={currentForm} />
          )}
        </div>
      </div>
    </PageContainer>
  );
}
