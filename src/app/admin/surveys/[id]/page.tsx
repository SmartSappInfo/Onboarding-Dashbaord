import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SurveyDetailPage({ params }: Props) {
  const { id } = await params;
  
  // Redirect to the edit page
  redirect(`/admin/surveys/${id}/edit`);
}
