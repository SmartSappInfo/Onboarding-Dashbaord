import { StatementClient } from './StatementClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: 'Customer Statement of Account | SmartSapp Finance',
  description: 'Official financial statement of account, ledger history, and closing balance',
};

export default async function StatementPage({ params }: PageProps) {
  const { id } = await params;
  return <StatementClient accountId={id} />;
}
