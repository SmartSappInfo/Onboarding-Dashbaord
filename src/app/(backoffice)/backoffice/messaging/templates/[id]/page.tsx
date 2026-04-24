import EditTemplateClient from './EditTemplateClient';

export const metadata = { title: 'Edit Template — Backoffice' };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditTemplatePage({ params }: Props) {
  const { id } = await params;
  return <EditTemplateClient templateId={id} />;
}
