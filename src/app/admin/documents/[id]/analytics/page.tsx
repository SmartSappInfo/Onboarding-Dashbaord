import React from 'react';
import { Metadata } from 'next';
import DocumentAnalyticsClient from './DocumentAnalyticsClient';

export const metadata: Metadata = {
  title: 'Document Analytics & Behavioral Intelligence | SmartSapp',
  description: 'Track reader retention, dwell times, and conversion attribution.',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DocumentAnalyticsPage({ params }: PageProps) {
  const { id } = await params;
  return <DocumentAnalyticsClient documentId={id} />;
}
