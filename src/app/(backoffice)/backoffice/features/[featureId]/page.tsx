import FeatureDetailClient from './FeatureDetailClient';

/**
 * Feature Detail Page
 * Fetches featureId from URL params and renders the detail view.
 */
export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ featureId: string }>;
}) {
  const { featureId } = await params;
  return <FeatureDetailClient featureId={featureId} />;
}
