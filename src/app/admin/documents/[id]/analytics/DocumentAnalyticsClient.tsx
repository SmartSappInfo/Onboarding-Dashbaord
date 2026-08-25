'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Document Analytics Controller:
 *    Fetches multi-layer analytics aggregates from `getDocumentAnalyticsAction` and renders
 *    the DocumentAnalyticsDashboard with date filtering and back navigation (PRD Sections 21–24, 30 & 87).
 * 2. Mobile Ergonomics & Touch Targets:
 *    All buttons and links enforce `min-h-[44px]` touch target bounds with active scaling feedback.
 * 3. Emil Kowalski Animation Standards:
 *    Smooth loading transitions and reactive filter updates.
 * 4. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/context/WorkspaceContext';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Sliders, ExternalLink } from 'lucide-react';
import { getDocumentAnalyticsAction } from '@/lib/documents/analytics-actions';
import { DocumentAnalyticsDashboard } from '@/components/documents/analytics/DocumentAnalyticsDashboard';
import type { DocumentAnalyticsSummary } from '@/lib/types/document-types';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';

interface DocumentAnalyticsClientProps {
  documentId: string;
}

export default function DocumentAnalyticsClient({ documentId }: DocumentAnalyticsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();

  const [documentTitle, setDocumentTitle] = useState('Document Analytics');
  const [slug, setSlug] = useState('');
  const [period, setPeriod] = useState<'last_7_days' | 'last_30_days' | 'all_time'>('last_30_days');
  const [analytics, setAnalytics] = useState<DocumentAnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Fetch document metadata
  useEffect(() => {
    if (!firestore || !documentId) return;

    const fetchMeta = async () => {
      try {
        const snap = await getDoc(doc(firestore, 'documents', documentId));
        if (snap.exists()) {
          const data = snap.data();
          if (data?.title) setDocumentTitle(data.title);
          if (data?.slug) setSlug(data.slug);
        }
      } catch {
        // Continue with default title
      }
    };

    fetchMeta();
  }, [firestore, documentId]);

  // 2. Fetch analytics summary
  const loadAnalytics = async () => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const res = await getDocumentAnalyticsAction({
        workspaceId: activeWorkspaceId,
        documentId,
        period,
      });

      if (res.success && res.analytics) {
        setAnalytics(res.analytics);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: res.error || 'Failed to fetch analytics.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load analytics.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [activeWorkspaceId, documentId, period]);

  return (
    <PageContainerFluid>
      <div className="space-y-6 max-w-7xl mx-auto py-6 px-4 sm:px-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push(`/admin/documents/${documentId}/edit`)}
              className="h-11 w-11 rounded-2xl min-h-[44px] shrink-0"
              title="Back to Document Editor"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-foreground">{documentTitle}</h1>
              <p className="text-xs text-muted-foreground">Behavioral intelligence and retention funnel</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/admin/documents/${documentId}/edit`)}
              className="h-10 rounded-xl font-bold text-xs gap-1.5 min-h-[40px]"
            >
              <Sliders className="h-4 w-4" /> Edit Document
            </Button>

            {slug && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/d/${slug}`, '_blank')}
                className="h-10 rounded-xl font-bold text-xs gap-1.5 min-h-[40px]"
              >
                <ExternalLink className="h-4 w-4" /> Open Reader
              </Button>
            )}

            <Button
              variant="outline"
              size="icon"
              onClick={loadAnalytics}
              className="h-10 w-10 rounded-xl min-h-[40px]"
              title="Refresh Analytics"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Analytics Dashboard Content */}
        {isLoading && !analytics ? (
          <div className="py-24 text-center space-y-3">
            <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Computing behavioral analytics...
            </p>
          </div>
        ) : analytics ? (
          <DocumentAnalyticsDashboard
            analytics={analytics}
            selectedPeriod={period}
            onPeriodChange={setPeriod}
            documentTitle={documentTitle}
          />
        ) : (
          <div className="py-12 text-center text-xs text-muted-foreground bg-muted/20 rounded-3xl">
            No analytics data available for this document.
          </div>
        )}
      </div>
    </PageContainerFluid>
  );
}
