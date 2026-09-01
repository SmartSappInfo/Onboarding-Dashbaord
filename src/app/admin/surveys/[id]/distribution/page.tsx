import * as React from 'react';
import DistributionCenterClient from './DistributionCenterClient';

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function SurveyDistributionPage({ params }: Props) {
  const { id } = await params;
  return <DistributionCenterClient surveyId={id} />;
}
