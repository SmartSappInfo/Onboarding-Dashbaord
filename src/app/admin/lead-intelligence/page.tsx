import { Suspense } from 'react';
import { Metadata } from 'next';
import LeadIntelligenceClient from './LeadIntelligenceClient';
import { Loader2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Lead Intelligence',
  description: 'SmartSapp Lead Intelligence, prospect search maps, and website tech auditing tools.',
};

export default function LeadIntelligencePage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      }
    >
      <LeadIntelligenceClient />
    </Suspense>
  );
}
