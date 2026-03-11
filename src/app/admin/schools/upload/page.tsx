
import { Metadata } from 'next';
import BulkUploadClient from './BulkUploadClient';

/**
 * @fileOverview AI Bulk Onboarding Page (Server Entry).
 * Central hub for automated institutional ingestion.
 */

export const metadata: Metadata = {
  title: 'AI Bulk Ingestion',
  description: 'Automated institutional onboarding via spreadsheet mapping and AI normalization.',
};

export default function BulkUploadPage() {
  return <BulkUploadClient />;
}
