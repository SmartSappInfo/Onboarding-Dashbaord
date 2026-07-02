import { Metadata } from 'next';
import SalesEffortClient from './SalesEffortClient';

export const metadata: Metadata = {
  title: 'Sales Effort Analytics & Leaderboard',
  description: 'View sales activity performance metrics, leaderboards, and effort distributions.',
};

export default function SalesEffortPage() {
  return <SalesEffortClient />;
}
