import { notFound } from 'next/navigation';
import { getFormByIdAction, getFormSubmissionsAction } from '@/lib/forms-actions';
import SubmissionsClient from './SubmissionsClient';
import type { Metadata } from 'next';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const form = await getFormByIdAction(id);
  return { title: form ? `Submissions — ${form.internalName}` : 'Submissions' };
}

export default async function FormSubmissionsPage({ params }: Props) {
  const { id } = await params;

  // Parallel fetch: form metadata + first page of submissions (no waterfall)
  const [form, result] = await Promise.all([
    getFormByIdAction(id),
    getFormSubmissionsAction(id, { limit: 50 }),
  ]);

  if (!form) notFound();

  return (
    <SubmissionsClient
      form={form}
      initialSubmissions={result.submissions}
      initialNextCursor={result.nextCursor}
    />
  );
}
