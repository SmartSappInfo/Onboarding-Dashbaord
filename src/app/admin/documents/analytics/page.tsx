import React from 'react';
import { Metadata } from 'next';
import DocumentsAnalyticsHubClient from './DocumentsAnalyticsHubClient';

export const metadata: Metadata = {
  title: 'Documents Analytics Hub | SmartSapp',
  description: 'Portfolio-wide document reading intelligence, cross-document comparison, and conversion funnels.',
};

export default function DocumentsAnalyticsPage() {
  return <DocumentsAnalyticsHubClient />;
}
