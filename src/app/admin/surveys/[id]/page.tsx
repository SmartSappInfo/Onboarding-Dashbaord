import SurveySummaryClient from './components/SurveySummaryClient';

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SurveyDetailPage({ params }: Props) {
  const { id } = await params;
  
  return <SurveySummaryClient id={id} />;
}
