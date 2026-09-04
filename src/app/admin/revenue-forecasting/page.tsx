import type { Metadata } from 'next';
import RevenueForecastingClient from './RevenueForecastingClient';

export const metadata: Metadata = {
  title: 'Revenue & Predictive Forecasting | SmartSapp Sales Performance',
  description:
    'Multi-touch revenue attribution, Monte Carlo stochastic simulations, Clari-style forecast categorization, and deal slippage velocity tracking.',
};

export default function RevenueForecastingPage() {
  return <RevenueForecastingClient />;
}
