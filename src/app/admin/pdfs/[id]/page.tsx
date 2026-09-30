import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PdfDetailPage({ params }: Props) {
  const { id } = await params;
  
  if (id === 'new') {
    redirect('/admin/pdfs/new');
  }

  // Redirect to the edit page
  redirect(`/admin/pdfs/${id}/edit`);
}
