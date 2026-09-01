/**
 * SmartSapp Forms 2.0: Optimization Studio Page
 * 
 * Server Component fetching form, health score snapshot, and active experiments.
 */

import React from 'react';
import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import { COLLECTIONS } from '@/lib/collection-constants';
import type { Form } from '@/lib/types';
import FormOptimizationClient from './components/FormOptimizationClient';
import {
  computeFormHealthScoreAction,
  scanFormAnomaliesAction,
  getFormExperimentsAction,
} from '@/lib/forms/form-optimization-actions';

interface FormOptimizationPageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: 'Form Optimization & A/B Testing | SmartSapp',
  description: 'A/B testing, 7-dimensional health scorecard, and anomaly detection.',
};

export default async function FormOptimizationPage({ params }: FormOptimizationPageProps) {
  const { id } = await params;

  const formDoc = await adminDb.collection(COLLECTIONS.FORMS).doc(id).get();
  if (!formDoc.exists) {
    notFound();
  }
  const form = formDoc.data() as Form;

  const [healthRes, anomalyRes, expRes] = await Promise.all([
    computeFormHealthScoreAction({ formId: id, forceRefresh: false }),
    scanFormAnomaliesAction({ formId: id }),
    getFormExperimentsAction({ formId: id }),
  ]);

  const initialHealthScore = healthRes.healthScore || {
    overallScore: 80,
    grade: 'good' as const,
    categories: {
      conversion: 75,
      ux: 85,
      accessibility: 90,
      logic: 85,
      crm: 80,
      analytics: 85,
      security: 95,
    },
    diagnostics: [],
    calculatedAt: new Date().toISOString(),
  };

  const initialAnomalies = anomalyRes.anomalies || [];
  const initialExperiments = expRes.experiments || [];

  return (
    <FormOptimizationClient
      form={form}
      initialHealthScore={initialHealthScore}
      initialAnomalies={initialAnomalies}
      initialExperiments={initialExperiments}
    />
  );
}
