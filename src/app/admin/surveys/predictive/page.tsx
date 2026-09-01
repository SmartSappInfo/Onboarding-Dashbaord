import * as React from 'react';
import { PredictiveIntelligenceClient } from './PredictiveIntelligenceClient';

export const metadata = {
  title: 'Predictive Intelligence | SmartSapp Surveys 2.0',
  description: 'Multidimensional Churn Forecasting, Lead Conversion Propensity & Next-Best-Action Engine',
};

export default function PredictiveIntelligencePage() {
  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl">
      <PredictiveIntelligenceClient />
    </div>
  );
}
