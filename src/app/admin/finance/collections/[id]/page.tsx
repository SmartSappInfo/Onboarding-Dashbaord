import { Metadata } from 'next';
import { CollectionCaseDetailsClient } from './CollectionCaseDetailsClient';

export const metadata: Metadata = {
  title: 'Collection Case Details | SmartSapp Finance',
  description: 'Multi-invoice debt rollup, promise-to-pay timeline, and outreach logs.',
};

export default async function CollectionCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CollectionCaseDetailsClient caseId={id} />;
}
