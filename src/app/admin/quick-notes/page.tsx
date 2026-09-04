import { Suspense } from 'react';
import type { Metadata } from 'next';
import QuickNotesClient from './components/QuickNotesClient';
import Loading from './loading';

export const metadata: Metadata = {
  title: 'Company Brain',
  description: 'Organizational knowledge, ideas, decisions, feedback, and AI intelligence.',
};

export default function QuickNotesPage() {
  // QuickNotesClient reads useSearchParams (deep-link ?category=…), so it must
  // sit behind a Suspense boundary to avoid a CSR bailout (next-best-practices).
  return (
    <Suspense fallback={<Loading />}>
      <div className="font-figtree">
        <QuickNotesClient />
      </div>
    </Suspense>
  );
}
