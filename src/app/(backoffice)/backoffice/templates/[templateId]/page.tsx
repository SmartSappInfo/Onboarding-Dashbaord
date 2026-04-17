import TemplateDetailClient from './TemplateDetailClient';

/**
 * Template Detail Page
 * Fetches templateId from URL params and renders the detail view.
 */
export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  return <TemplateDetailClient templateId={templateId} />;
}
