import FormSummaryClient from './components/FormSummaryClient';

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function FormDetailPage({ params }: Props) {
  const { id } = await params;
  
  return <FormSummaryClient id={id} />;
}
