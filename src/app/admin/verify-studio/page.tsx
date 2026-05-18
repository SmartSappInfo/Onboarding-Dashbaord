import VerifyStudioClient from './VerifyStudioClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verify Studio | SmartSapp',
  description: 'Advanced native email verification and hygiene diagnostics.',
};

export default function VerifyStudioPage() {
  return <VerifyStudioClient />;
}
