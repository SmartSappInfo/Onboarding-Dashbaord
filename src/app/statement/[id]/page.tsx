import { PublicStatementClient } from './PublicStatementClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: 'Statement of Account | SmartSapp Portal',
  description: 'Public customer financial statement portal',
};

export default async function PublicStatementPage({ params }: PageProps) {
  const { id } = await params;
  return <PublicStatementClient tokenOrId={id} />;
}
