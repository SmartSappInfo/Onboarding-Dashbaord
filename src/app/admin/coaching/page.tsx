import { Metadata } from 'next';
import CoachingClient from './CoachingClient';

export const metadata: Metadata = {
  title: 'Coaching & Practice Lab | SmartSapp Sales Intelligence',
  description:
    'Conversation intelligence, Gong-style call scorecards, and interactive AI Buyer roleplay simulator with multi-pillar competency evaluations.',
};

export default function CoachingPage() {
  return <CoachingClient />;
}
