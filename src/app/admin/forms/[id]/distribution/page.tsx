import { notFound } from 'next/navigation';
import { getFormByIdAction } from '@/lib/forms-actions';
import FormDistributionClient from './components/FormDistributionClient';
import type { Metadata } from 'next';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const form = await getFormByIdAction(id);
  return { title: form ? `Distribution — ${form.internalName || form.title}` : 'Distribution Hub' };
}

export default async function FormDistributionPage({ params }: Props) {
  const { id } = await params;
  const form = await getFormByIdAction(id);

  if (!form) notFound();

  return <FormDistributionClient form={form} />;
}
