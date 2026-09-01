import FormAnalyticsClient from './components/FormAnalyticsClient';

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function FormAnalyticsPage({ params }: Props) {
  const { id } = await params;
  return <FormAnalyticsClient id={id} />;
}
